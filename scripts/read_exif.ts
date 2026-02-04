import { readFile } from "node:fs/promises";
import path from "node:path";
import ExifReader from "exifreader";

const [,, imagePath] = process.argv;

if (!imagePath) {
  console.error("Usage: pnpm exif:read <image.jpg>");
  process.exit(1);
}

const run = async () => {
  const absPath = path.resolve(imagePath);
  const buffer = await readFile(absPath);
  const tags = ExifReader.load(buffer);
  console.log(JSON.stringify(tags, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
