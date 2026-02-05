import { exiftool } from "exiftool-vendored";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const [,, inputPath, outputPath, ...tagArgs] = process.argv;

if (!inputPath || !outputPath || tagArgs.length === 0) {
  console.error("Usage: pnpm exif:remove <input.jpg> <output.jpg> TagName [TagName2 ...]");
  process.exit(1);
}

const run = async () => {
  const inPath = path.resolve(inputPath);
  const outPath = path.resolve(outputPath);

  await stat(inPath);
  await mkdir(path.dirname(outPath), { recursive: true });
  await copyFile(inPath, outPath);

  const tags = tagArgs.map((t) => t.trim()).filter(Boolean);
  if (tags.length === 0) {
    throw new Error("No tag names provided");
  }

  const deleteTags: Record<string, null> = Object.fromEntries(
    tags.map((tag) => [tag, null])
  );

  await exiftool.write(outPath, deleteTags, { writeArgs: ["-overwrite_original"] });
  await exiftool.end();

  console.log(`Removed tags from ${outPath}: ${tags.join(", ")}`);
};

run().catch(async (err) => {
  console.error(err);
  try {
    await exiftool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
