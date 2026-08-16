import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

test("planet texture extensions match their encoded image format", async () => {
  const textureDirectory = path.resolve("public/assets/planets");
  const textureNames = await readdir(textureDirectory);
  const mismatches: string[] = [];

  for (const textureName of textureNames) {
    const extension = path.extname(textureName).toLowerCase();
    if (extension !== ".png" && extension !== ".jpg" && extension !== ".jpeg") {
      continue;
    }

    const image = await readFile(path.join(textureDirectory, textureName));
    const hasExpectedSignature =
      extension === ".png"
        ? image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
        : image.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE);

    if (!hasExpectedSignature) mismatches.push(textureName);
  }

  assert.deepEqual(
    mismatches,
    [],
    `Texture filenames must match their encoded format: ${mismatches.join(", ")}`,
  );
});
