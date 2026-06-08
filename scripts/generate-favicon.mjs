import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const INPUT = resolve("beajee icon.jpg");
const sizes = {
  "public/icon.png": 512,
  "public/apple-icon.png": 180,
  "src/app/favicon.ico": 32,
};

async function makeCircular(inputPath, size) {
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`
  );

  return sharp(inputPath)
    .resize(size, size, { fit: "cover" })
    .composite([{ input: circle, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function main() {
  console.log("Processing:", INPUT);

  for (const [outPath, size] of Object.entries(sizes)) {
    const buf = await makeCircular(INPUT, size);
    const fullPath = resolve(outPath);

    if (outPath.endsWith(".ico")) {
      // For .ico, just use a 32px PNG (modern browsers accept PNG favicons)
      writeFileSync(fullPath, buf);
      console.log(`  ✓ ${outPath} (${size}x${size})`);
    } else {
      writeFileSync(fullPath, buf);
      console.log(`  ✓ ${outPath} (${size}x${size})`);
    }
  }

  console.log("Done!");
}

main().catch(console.error);
