import { readFile } from "node:fs/promises";
import path from "node:path";
import { UltraHonkVerifierBackend } from "@aztec/bb.js";
import { exiftool } from "exiftool-vendored";
import {
  commitTagPairs,
  extractExifTags,
  fromHex,
  padFieldValues,
  padTagIds,
} from "./utils";

const MAX_TAGS = 32;

const [,, imagePathArg, proofPathArg] = process.argv;

if (!imagePathArg) {
  console.error("Usage: pnpm verify <imagePath> [proof.json]");
  process.exit(1);
}

const readProofFromImage = async (imagePath: string): Promise<unknown> => {
  const absPath = path.resolve(imagePath);
  const tags = await exiftool.read(absPath, { readArgs: ["-G1", "-a", "-s"] });
  const description =
    (tags as Record<string, unknown>)["XMP-dc:Description"] ??
    (tags as Record<string, unknown>)["ImageDescription"] ??
    (tags as Record<string, unknown>)["UserComment"] ??
    (tags as Record<string, unknown>)["XPComment"];
  if (typeof description !== "string" || description.trim().length === 0) {
    throw new Error("No embedded proof data found in image metadata.");
  }
  return JSON.parse(description);
};

const run = async () => {
  const imagePath = path.resolve(imagePathArg);
  const payload = proofPathArg
    ? JSON.parse(await readFile(proofPathArg, "utf8"))
    : await readProofFromImage(imagePath);
  const proofHex = payload?.proof?.proofHex as string | undefined;
  const verificationKeyHex = payload?.proof?.verificationKeyHex as string | undefined;
  const publicInputs = payload?.proof?.publicInputs as string[] | undefined;

  if (!proofHex || !verificationKeyHex || !publicInputs) {
    throw new Error("Invalid proof file format.");
  }

  const { tagIds, tagValueHashes, tagCount } = await extractExifTags(imagePath);
  if (tagCount === 0) {
    throw new Error("No EXIF tags found in this image.");
  }
  const trimmedTagIds = tagIds.slice(0, tagCount);
  const paddedTagIds = padTagIds(trimmedTagIds, MAX_TAGS);
  const trimmedTagValueHashes = tagValueHashes.slice(0, tagCount);
  const paddedTagValueHashes = padFieldValues(trimmedTagValueHashes, MAX_TAGS);

  const verifier = new UltraHonkVerifierBackend();
  const ok = await verifier.verifyProof({
    proof: fromHex(proofHex),
    publicInputs,
    verificationKey: fromHex(verificationKeyHex),
  });
  await verifier.destroy();

  console.log(ok ? "Proof verified" : "Proof invalid");
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
