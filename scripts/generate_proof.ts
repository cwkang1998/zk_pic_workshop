import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";

import {
  commitTagPairs,
  extractExifTags,
  padTagIds,
  padFieldValues,
  toHex,
  writeProofToExif,
} from "./utils";

const MAX_TAGS = 32;

const [,, imagePath, outPathArg] = process.argv;

if (!imagePath) {
  console.error("Usage: pnpm prove <imagePath> [proof.json]");
  process.exit(1);
}

const outPath = outPathArg ?? "proof.json";

const run = async () => {
  const circuitPath = path.resolve("circuit/target/circuit.json");
  const circuit = JSON.parse(await readFile(circuitPath, "utf8"));

  if (!circuit.bytecode) {
    throw new Error("Missing circuit bytecode. Did you run `nargo compile`?");
  }

  // Write your logic here...

  // await writeFile(outPath, JSON.stringify(payload, null, 2));
  // await writeProofToExif(imagePath, payload, "XMP-dc:Description");
  console.log(`Proof written to ${outPath}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
