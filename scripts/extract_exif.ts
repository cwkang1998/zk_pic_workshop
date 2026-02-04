import { extractExifTags } from "./utils";

const [,, imagePath] = process.argv;

if (!imagePath) {
  console.error("Usage: pnpm exif <imagePath>");
  process.exit(1);
}

const run = async () => {
  const { tagNames, tagIds, tagCount } = await extractExifTags(imagePath);
  const payload = {
    imagePath,
    tagCount,
    tagNames,
    tagIds,
  };
  console.log(JSON.stringify(payload, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
