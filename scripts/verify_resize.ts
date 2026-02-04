import { readFile } from "node:fs/promises";
import { UltraHonkVerifierBackend } from "@aztec/bb.js";
import { fromHex } from "./utils";

const [,, proofPath] = process.argv;

if (!proofPath) {
  console.error("Usage: pnpm verify:resize <proof.json>");
  process.exit(1);
}

const run = async () => {
  const payload = JSON.parse(await readFile(proofPath, "utf8"));
  const proofHex = payload?.proof?.proofHex as string | undefined;
  const verificationKeyHex = payload?.proof?.verificationKeyHex as string | undefined;
  const publicInputs = payload?.proof?.publicInputs as string[] | undefined;

  if (!proofHex || !verificationKeyHex || !publicInputs) {
    throw new Error("Invalid proof file format.");
  }

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
