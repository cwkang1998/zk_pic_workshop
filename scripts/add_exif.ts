import { exiftool } from "exiftool-vendored";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const [,, inputPath, outputPath, ...tagArgs] = process.argv;

if (!inputPath || !outputPath || tagArgs.length === 0) {
  console.error("Usage: pnpm exif:write <input.jpg> <output.jpg> Tag=Value [Tag2=Value2 ...]");
  process.exit(1);
}

const parseTags = (args: string[]) => {
  const tags: Record<string, string | number> = {};
  for (const arg of args) {
    const idx = arg.indexOf("=");
    if (idx <= 0) {
      throw new Error(`Invalid tag argument '${arg}', expected Tag=Value`);
    }
    const key = arg.slice(0, idx).trim();
    const valueRaw = arg.slice(idx + 1).trim();
    if (!key || !valueRaw) {
      throw new Error(`Invalid tag argument '${arg}', expected Tag=Value`);
    }
    const num = Number(valueRaw);
    tags[key] = Number.isFinite(num) && valueRaw.match(/^[-+]?\d+(\.\d+)?$/) ? num : valueRaw;
  }
  return tags;
};

const run = async () => {
  const inPath = path.resolve(inputPath);
  const outPath = path.resolve(outputPath);

  await stat(inPath);
  await mkdir(path.dirname(outPath), { recursive: true });
  await copyFile(inPath, outPath);

  const tags = parseTags(tagArgs);
  await exiftool.write(outPath, tags, {writeArgs: ["-overwrite_original"]});
  await exiftool.end();

  console.log(`Wrote EXIF tags to ${outPath}`);
};

run().catch(async (err) => {
  console.error(err);
  try {
    await exiftool.end();
  } catch (e) {
    // ignore
    console.error(e)
  }
  process.exit(1);
});
