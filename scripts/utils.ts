import { BN254_FR_MODULUS, BarretenbergSync } from "@aztec/bb.js";
import path from "node:path";
import { createHash } from "node:crypto";
import { exiftool } from "exiftool-vendored";
import { COMMIT_BASE, MAX_TAGS } from "./constants";

export type ExifExtraction = {
  tagNames: string[];
  tagIds: number[];
  tagValueHashes: bigint[];
  tagCount: number;
};

export function hashTagName(name: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(name)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function commitTagIds(tagIds: number[], tagCount: number): bigint {
  if (tagCount > tagIds.length) {
    throw new Error(`tagCount ${tagCount} exceeds tagIds length ${tagIds.length}`);
  }

  let acc = 0n;
  for (let i = 0; i < tagCount; i += 1) {
    acc = (acc * COMMIT_BASE + BigInt(tagIds[i])) % BN254_FR_MODULUS;
  }
  return acc;
}

let poseidonApi: BarretenbergSync | null = null;

const getPoseidon = async (): Promise<BarretenbergSync> => {
  if (!poseidonApi) {
    poseidonApi = await BarretenbergSync.initSingleton();
  }
  return poseidonApi;
};

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

const poseidon2Hash = async (a: bigint, b: bigint): Promise<bigint> => {
  const api = await getPoseidon();
  const res = api.poseidon2Hash({ inputs: [toFieldBytes(a), toFieldBytes(b)] });
  return bytesToBigIntBE(res.hash);
};

export async function commitTagPairs(
  tagIds: number[],
  tagValueHashes: bigint[],
  tagCount: number
): Promise<bigint> {
  if (tagCount > tagIds.length || tagCount > tagValueHashes.length) {
    throw new Error("tagCount exceeds tag_ids or tag_value_hashes length");
  }

  let acc = 0n;
  for (let i = 0; i < tagCount; i += 1) {
    acc = await poseidon2Hash(acc, BigInt(tagIds[i]));
    acc = await poseidon2Hash(acc, tagValueHashes[i]);
  }
  return acc;
}

export function padTagIds(tagIds: number[], maxTags = MAX_TAGS): number[] {
  if (tagIds.length > maxTags) {
    return tagIds.slice(0, maxTags);
  }
  return [...tagIds, ...Array(maxTags - tagIds.length).fill(0)];
}

export function padFieldValues(values: bigint[], maxTags = MAX_TAGS): bigint[] {
  if (values.length > maxTags) {
    return values.slice(0, maxTags);
  }
  return [...values, ...Array(maxTags - values.length).fill(0n)];
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

export const hashValueToField = (value: unknown): bigint => {
  const normalized = normalizeValue(value);
  const encoded = new TextEncoder().encode(JSON.stringify(normalized));
  const digest = createHash("sha256").update(encoded).digest("hex");
  return BigInt(`0x${digest}`) % BN254_FR_MODULUS;
};

export async function extractExifTags(imagePath: string): Promise<ExifExtraction> {
  const absolutePath = path.resolve(imagePath);
  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = await exiftool.read(absolutePath, { readArgs: ["-G1", "-a", "-s"] });
  } finally {
    await exiftool.end();
  }

  if (!parsed || typeof parsed !== "object") {
    return { tagNames: [], tagIds: [], tagValueHashes: [], tagCount: 0 };
  }

  const entries = Object.entries(parsed)
    .filter(([name]) =>
      name !== "SourceFile" &&
      !name.startsWith("File:") &&
      !name.startsWith("System:") &&
      !name.startsWith("Composite:")
    )
    .sort(([a], [b]) => a.localeCompare(b));

  const tagNames = entries.map(([name]) => name);
  const tagIds = tagNames.map(hashTagName);
  const tagValueHashes = entries.map(([, value]) => hashValueToField(value));
  const tagCount = Math.min(tagIds.length, MAX_TAGS);

  return { tagNames, tagIds, tagValueHashes, tagCount };
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
