import { BN254_FR_MODULUS, BarretenbergSync } from "@aztec/bb.js";
import path from "node:path";
import { exiftool } from "exiftool-vendored";

const MAX_TAGS = 32;

let exiftoolEnded = false;
const ensureExiftoolShutdown = () => {
  if (exiftoolEnded) return;
  exiftoolEnded = true;
  exiftool.end().catch(() => { });
};

if (typeof process !== "undefined" && process?.on) {
  process.on("beforeExit", ensureExiftoolShutdown);
  process.on("SIGINT", () => {
    ensureExiftoolShutdown();
    process.exit(1);
  });
  process.on("SIGTERM", () => {
    ensureExiftoolShutdown();
    process.exit(1);
  });
}

export type ExifExtraction = {
  tagNames: string[];
  tagIds: string[];
  tagValues: any[];
  tagValueHashes: bigint[];
  tagCount: number;
};

let poseidonApi: BarretenbergSync | null = null;

const getPoseidon = async (): Promise<BarretenbergSync> => {
  if (!poseidonApi) {
    poseidonApi = await BarretenbergSync.initSingleton();
  }
  return poseidonApi;
};

async function hashTagName(name: string): Promise<string> {
  throw new Error("Not implemented")
}

const bytesToBigIntBE = (bytes: Uint8Array): bigint => {
  let out = 0n;
  for (const b of bytes) {
    out = (out << 8n) + BigInt(b);
  }
  return out;
};

const toFieldBytes = (value: bigint): Uint8Array => {
  let v = value % BN254_FR_MODULUS;
  if (v < 0n) v += BN254_FR_MODULUS;
  let hex = v.toString(16);
  if (hex.length > 64) {
    hex = (v % BN254_FR_MODULUS).toString(16);
  }
  hex = hex.padStart(64, "0");
  return Uint8Array.from(Buffer.from(hex, "hex"));
};

const hashBytesToField = async (bytes: Uint8Array): Promise<bigint> => {
  throw new Error("Not implemented")
};

export async function commitTagPairs(
  tagIds: string[],
  tagValueHashes: bigint[],
  tagCount: number,
  secret: bigint
): Promise<bigint> {
  throw new Error("Not implemented")
}

export function padTagIds(tagIds: string[], maxTags = MAX_TAGS): string[] {
  throw new Error("Not implemented")
}

export function padFieldValues(values: bigint[], maxTags = MAX_TAGS): bigint[] {
  throw new Error("Not implemented")
}

const normalizeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return toHex(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, normalizeValue(v)]);
    return Object.fromEntries(entries);
  }
  return String(value);
};

export const hashValueToField = async (value: unknown): Promise<bigint> => {
  const normalized = normalizeValue(value);
  const encoded = new TextEncoder().encode(JSON.stringify(normalized));
  return hashBytesToField(encoded);
};

export async function extractExifTags(imagePath: string): Promise<ExifExtraction> {
  throw new Error("Not implemented");
}

export async function writeProofToExif(
  imagePath: string,
  payload: unknown,
  tagName = "XMP-dc:Description"
): Promise<void> {
  const absolutePath = path.resolve(imagePath);
  const value = JSON.stringify(payload);
  await exiftool.write(
    absolutePath,
    { [tagName]: value },
    { writeArgs: ["-overwrite_original"] }
  );
}


export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
