import path from "node:path";
import { exiftool } from "exiftool-vendored";

const [,, imagePath] = process.argv;

if (!imagePath) {
  console.error("Usage: pnpm exif:read <image.jpg>");
  process.exit(1);
}

const run = async () => {
  const absPath = path.resolve(imagePath);
  const tags = await exiftool.read(absPath, {readArgs: ["-G1", "-a", "-s"]});
  await exiftool.end();
  console.log(JSON.stringify(tags, null, 2));
};

run().catch((err) => {
  console.error(err);
  exiftool.end().catch(() => {});
  process.exit(1);
});
