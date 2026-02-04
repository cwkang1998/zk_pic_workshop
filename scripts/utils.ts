import { BN254_FR_MODULUS } from "@aztec/bb.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExifReader from "exifreader";
import { COMMIT_BASE, MAX_TAGS } from "./constants";

export type ExifExtraction = {
  tagNames: string[];
  tagIds: number[];
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

export function padTagIds(tagIds: number[], maxTags = MAX_TAGS): number[] {
  if (tagIds.length > maxTags) {
    return tagIds.slice(0, maxTags);
  }
  return [...tagIds, ...Array(maxTags - tagIds.length).fill(0)];
}

export async function extractExifTags(imagePath: string): Promise<ExifExtraction> {
  const absolutePath = path.resolve(imagePath);
  const buffer = await readFile(absolutePath);
  const parsed = ExifReader.load(buffer);

  if (!parsed || typeof parsed !== "object") {
    return { tagNames: [], tagIds: [], tagCount: 0 };
  }

  const tagNames = Object.keys(parsed).sort();
  const tagIds = tagNames.map(hashTagName);
  const tagCount = Math.min(tagIds.length, MAX_TAGS);

  return { tagNames, tagIds, tagCount };
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
