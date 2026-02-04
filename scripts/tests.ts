import assert from "node:assert";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend, UltraHonkVerifierBackend } from "@aztec/bb.js";
import { MAX_TAGS } from "./constants";
import {
  commitTagIds,
  extractExifTags,
  hashTagName,
  padTagIds,
} from "./utils";

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

  const { tagNames, tagIds, tagCount } = await extractExifTags(imagePath);
  assert(tagCount > 0, "Expected EXIF tags to be present");

  const queryTag = tagNames[0];
  const queryId = hashTagName(queryTag);
  assert(tagIds.includes(queryId), "Query tag hash not found in tag list");

  const paddedTagIds = padTagIds(tagIds.slice(0, tagCount), MAX_TAGS);
  const commitment = commitTagIds(paddedTagIds, tagCount);

  const inputs = {
    tag_ids: paddedTagIds,
    tag_count: tagCount,
    query_tag: queryId,
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
