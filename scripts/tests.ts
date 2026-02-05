import assert from "node:assert";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend, UltraHonkVerifierBackend } from "@aztec/bb.js";
import {
  commitTagPairs,
  extractExifTags,
  padTagIds,
  padFieldValues,
} from "./utils";

const MAX_TAGS = 32;

const findImage = (): string => {
  const files = readdirSync(process.cwd());
  const match = files.find((name) => /^PXL_.*\.jpg$/i.test(name));
  assert(match, "No PXL_*.jpg image found in project root");
  return path.resolve(match!);
};

const ensureCircuitCompiled = () => {
  const compiled = path.resolve("circuit/target/circuit.json");
  if (!existsSync(compiled)) {
    execSync("nargo compile", { cwd: path.resolve("circuit"), stdio: "inherit" });
  }
  return compiled;
};

const run = async () => {
  const imagePath = findImage();
  const circuitPath = ensureCircuitCompiled();

  const circuit = JSON.parse(readFileSync(circuitPath, "utf8"));
  assert(circuit.bytecode, "Missing circuit bytecode after compile");

  const { tagIds, tagValueHashes, tagCount } = await extractExifTags(imagePath);
  assert(tagCount > 0, "Expected EXIF tags to be present");

  const paddedTagIds = padTagIds(tagIds.slice(0, tagCount), MAX_TAGS);
  const paddedTagValueHashes = padFieldValues(tagValueHashes.slice(0, tagCount), MAX_TAGS);
  const commitment = await commitTagPairs(paddedTagIds, paddedTagValueHashes, tagCount);

  const inputs = {
    tag_ids: paddedTagIds,
    tag_value_hashes: paddedTagValueHashes.map((v) => v.toString()),
    tag_count: tagCount,
    commitment: commitment.toString(),
  };
  console.log(inputs)

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

  assert(ok, "Proof verification failed");
  console.log("TS scripts test passed");
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
