import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend, UltraHonkVerifierBackend } from "@aztec/bb.js";
import { toHex } from "./utils";

type GrayImage = {
  width: number;
  height: number;
  pixels: number[][]; // [height][width]
};

const H_ORIG = 64;
const W_ORIG = 64;
const H_NEW = 32;
const W_NEW = 32;

const INPUT_JPG = path.resolve("imgs/bread.jpg");
const ORIG_JPG = path.resolve("imgs/bread_64x64.jpg");
const RESIZED_JPG = path.resolve("imgs/bread_32x32.jpg");
const PROOF_JSON = path.resolve("proof_resize.json");

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function decodeJpegToGray(filePath: string): Promise<GrayImage> {
  const { data, info } = await sharp(filePath)
    .resize(W_ORIG, H_ORIG, { kernel: sharp.kernel.linear })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels < 3) {
    throw new Error(`Unexpected channel count: ${channels}`);
  }

  const pixels: number[][] = Array.from({ length: height }, () => Array(width).fill(0));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const gray = clampByte(0.299 * r + 0.587 * g + 0.114 * b);
      pixels[y][x] = gray;
    }
  }

  return { width, height, pixels };
}

function resizeBilinear(source: GrayImage, outWidth: number, outHeight: number): GrayImage {
  const { width, height, pixels } = source;
  if (width < 2 || height < 2) {
    throw new Error("Source image too small for bilinear resize");
  }

  const outPixels: number[][] = Array.from({ length: outHeight }, () => Array(outWidth).fill(0));

  for (let y = 0; y < outHeight; y += 1) {
    const yFloat = ((height - 1) * y) / (outHeight - 1);
    const y0 = Math.floor(yFloat);
    const y1 = Math.min(y0 + 1, height - 1);
    const yRatio = yFloat - y0;

    for (let x = 0; x < outWidth; x += 1) {
      const xFloat = ((width - 1) * x) / (outWidth - 1);
      const x0 = Math.floor(xFloat);
      const x1 = Math.min(x0 + 1, width - 1);
      const xRatio = xFloat - x0;

      const top = pixels[y0][x0] * (1 - xRatio) + pixels[y0][x1] * xRatio;
      const bottom = pixels[y1][x0] * (1 - xRatio) + pixels[y1][x1] * xRatio;
      const value = top * (1 - yRatio) + bottom * yRatio;

      outPixels[y][x] = clampByte(value);
    }
  }

  return { width: outWidth, height: outHeight, pixels: outPixels };
}

function resizeBilinearInteger(orig: number[][]): number[][] {
  const hOrig = orig.length;
  const wOrig = orig[0].length;
  if (hOrig !== H_ORIG || wOrig !== W_ORIG) {
    throw new Error(`Unexpected original size ${wOrig}x${hOrig}, expected ${W_ORIG}x${H_ORIG}`);
  }

  const denom = (W_NEW - 1) * (H_NEW - 1);
  const out: number[][] = Array.from({ length: H_NEW }, () => Array(W_NEW).fill(0));

  for (let i = 0; i < H_NEW; i += 1) {
    for (let j = 0; j < W_NEW; j += 1) {
      const x_l = Math.floor(((wOrig - 1) * j) / (W_NEW - 1));
      const y_l = Math.floor(((hOrig - 1) * i) / (H_NEW - 1));

      const x_h = (x_l * (W_NEW - 1) === (wOrig - 1) * j) ? x_l : x_l + 1;
      const y_h = (y_l * (H_NEW - 1) === (hOrig - 1) * i) ? y_l : y_l + 1;

      const x_ratio_weighted = ((wOrig - 1) * j) - (W_NEW - 1) * x_l;
      const y_ratio_weighted = ((hOrig - 1) * i) - (H_NEW - 1) * y_l;

      const w_a = (W_NEW - 1) - x_ratio_weighted;
      const w_b = x_ratio_weighted;
      const h_a = (H_NEW - 1) - y_ratio_weighted;
      const h_b = y_ratio_weighted;

      const sum = orig[y_l][x_l] * w_a * h_a
        + orig[y_l][x_h] * w_b * h_a
        + orig[y_h][x_l] * w_a * h_b
        + orig[y_h][x_h] * w_b * h_b;

      out[i][j] = Math.floor((sum + Math.floor(denom / 2)) / denom);
    }
  }

  return out;
}

async function writeJpeg(filePath: string, image: GrayImage) {
  const { width, height, pixels } = image;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 3;
      const v = pixels[y][x];
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
    }
  }

  await sharp(data, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92 })
    .toFile(filePath);
}

async function compileCircuit() {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync("nargo", ["compile"], {
    cwd: path.resolve("circuit"),
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error("nargo compile failed");
  }
}

async function generateAndVerifyProof(orig: number[][], resized: number[][]) {
  const circuitPath = path.resolve("circuit/target/circuit.json");
  const circuit = JSON.parse(await readFile(circuitPath, "utf8"));

  if (!circuit.bytecode) {
    throw new Error("Missing circuit bytecode. Did you run `nargo compile`?");
  }

  const inputs = {
    orig,
    new: resized,
  };

  const noir = new Noir(circuit);
  await noir.init();
  const { witness } = await noir.execute(inputs);

  const backend = new UltraHonkBackend(circuit.bytecode);
  const proof = await backend.generateProof(witness);
  const verificationKey = await backend.getVerificationKey();
  await backend.destroy();

  const verifier = new UltraHonkVerifierBackend();
  const ok = await verifier.verifyProof({
    proof: proof.proof,
    publicInputs: proof.publicInputs,
    verificationKey,
  });
  await verifier.destroy();

  const payload = {
    inputs,
    proof: {
      publicInputs: proof.publicInputs,
      proofHex: toHex(proof.proof),
      verificationKeyHex: toHex(verificationKey),
    },
    images: {
      origJpeg: path.relative(process.cwd(), ORIG_JPG),
      resizedJpeg: path.relative(process.cwd(), RESIZED_JPG),
    },
  };

  await writeFile(PROOF_JSON, JSON.stringify(payload, null, 2));

  return ok;
}

const run = async () => {
  const orig = await decodeJpegToGray(INPUT_JPG);
  await writeJpeg(ORIG_JPG, orig);

  const resizedPixels = resizeBilinearInteger(orig.pixels);
  await writeJpeg(RESIZED_JPG, { width: W_NEW, height: H_NEW, pixels: resizedPixels });

  await compileCircuit();
  const ok = await generateAndVerifyProof(orig.pixels, resizedPixels);

  console.log(ok ? "Proof verified" : "Proof invalid");
  console.log(`Original (64x64) JPEG: ${path.relative(process.cwd(), ORIG_JPG)}`);
  console.log(`Resized (32x32) JPEG: ${path.relative(process.cwd(), RESIZED_JPG)}`);
  console.log(`Proof JSON: ${path.relative(process.cwd(), PROOF_JSON)}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
