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

  const { tagNames, tagIds, tagValueHashes, tagCount } = await extractExifTags(imagePath);
  if (tagCount === 0) {
    throw new Error("No EXIF tags found in this image.");
  }

  const trimmedTagIds = tagIds.slice(0, tagCount);
  const paddedTagIds = padTagIds(trimmedTagIds, MAX_TAGS);
  const trimmedTagValueHashes = tagValueHashes.slice(0, tagCount);
  const paddedTagValueHashes = padFieldValues(trimmedTagValueHashes, MAX_TAGS);
  const commitment = await commitTagPairs(paddedTagIds, paddedTagValueHashes, tagCount);

  const inputs = {
    tag_ids: paddedTagIds,
    tag_value_hashes: paddedTagValueHashes.map((v) => v.toString()),
    tag_count: tagCount,
    commitment: commitment.toString(),
  };

  const noir = new Noir(circuit);
  await noir.init();
  const { witness } = await noir.execute(inputs);

  const backend = new UltraHonkBackend(circuit.bytecode);
  const proof = await backend.generateProof(witness);
  const verificationKey = await backend.getVerificationKey();
  await backend.destroy();

  const payload = {
    inputs,
    meta: {
      imagePath,
      commitmentHash: "poseidon2",
      maxTags: MAX_TAGS,
      extractedTagCount: tagCount,
      extractedTagNames: tagNames,
    },
    proof: {
      publicInputs: proof.publicInputs,
      proofHex: toHex(proof.proof),
      verificationKeyHex: toHex(verificationKey),
    },
  };

  await writeFile(outPath, JSON.stringify(payload, null, 2));
  console.log(`Proof written to ${outPath}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
