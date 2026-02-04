import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { COMMIT_BASE, MAX_TAGS } from "./constants";
import {
  commitTagIds,
  extractExifTags,
  hashTagName,
  padTagIds,
  toHex,
} from "./utils";

const [,, imagePath, queryTag, outPathArg] = process.argv;

if (!imagePath || !queryTag) {
  console.error("Usage: pnpm prove <imagePath> <queryTagName> [proof.json]");
  process.exit(1);
}

const outPath = outPathArg ?? "proof.json";

const run = async () => {
  const circuitPath = path.resolve("circuit/target/circuit.json");
  const circuit = JSON.parse(await readFile(circuitPath, "utf8"));

  if (!circuit.bytecode) {
    throw new Error("Missing circuit bytecode. Did you run `nargo compile`?");
  }

  const { tagNames, tagIds, tagCount } = await extractExifTags(imagePath);
  if (tagCount === 0) {
    throw new Error("No EXIF tags found in this image.");
  }

  const queryId = hashTagName(queryTag);
  if (!tagIds.includes(queryId)) {
    throw new Error(`Tag '${queryTag}' not found in EXIF tags.`);
  }

  const trimmedTagIds = tagIds.slice(0, tagCount);
  const paddedTagIds = padTagIds(trimmedTagIds, MAX_TAGS);
  const commitment = commitTagIds(paddedTagIds, tagCount);

  const inputs = {
    tag_ids: paddedTagIds,
    tag_count: tagCount,
    query_tag: queryId,
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
      queryTag,
      commitBase: COMMIT_BASE.toString(),
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
