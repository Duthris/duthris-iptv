import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webIcons = join(root, "apps/web/public/icons");
const desktopBuild = join(root, "apps/desktop/build");

const SOURCE = join(webIcons, "icon.svg");
const SOURCE_MASKABLE = join(webIcons, "icon-maskable.svg");

const CANVAS = { r: 11, g: 9, b: 17, alpha: 1 };

async function png(source, size, target, options = {}) {
  const buffer = await sharp(source, { density: Math.max(72, (size / 512) * 72 * 4) })
    .resize(size, size, {
      fit: "contain",
      background: options.background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(target, buffer);
  return buffer;
}

async function bmp(source, width, height, target) {
  const { data } = await sharp(source, { density: 300 })
    .resize(width, height, { fit: "contain", background: CANVAS })
    .flatten({ background: CANVAS })
    .raw()
    .toColourspace("srgb")
    .toBuffer({ resolveWithObject: true });

  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowSize * height;
  const buffer = Buffer.alloc(14 + 40 + pixelBytes, 0);

  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(14 + 40 + pixelBytes, 2);
  buffer.writeUInt32LE(14 + 40, 10);

  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(pixelBytes, 34);

  const channels = data.length / (width * height);

  for (let y = 0; y < height; y++) {
    const rowStart = 14 + 40 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * channels;
      const target = rowStart + x * 3;
      buffer[target] = data[source + 2];
      buffer[target + 1] = data[source + 1];
      buffer[target + 2] = data[source];
    }
  }

  await writeFile(target, buffer);
}

async function main() {
  await mkdir(desktopBuild, { recursive: true });

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoFrames = [];
  for (const size of icoSizes) {
    const target = join(desktopBuild, `.ico-${size}.png`);
    await png(SOURCE, size, target);
    icoFrames.push(target);
  }

  const ico = await pngToIco(icoFrames);
  await writeFile(join(desktopBuild, "icon.ico"), ico);
  await writeFile(join(desktopBuild, "installerIcon.ico"), ico);
  await writeFile(join(desktopBuild, "uninstallerIcon.ico"), ico);

  await png(SOURCE, 1024, join(desktopBuild, "icon.png"));

  await bmp(SOURCE, 164, 314, join(desktopBuild, "installerSidebar.bmp"));
  await bmp(SOURCE, 164, 314, join(desktopBuild, "uninstallerSidebar.bmp"));

  await png(SOURCE, 192, join(webIcons, "icon-192.png"));
  await png(SOURCE, 512, join(webIcons, "icon-512.png"));
  await png(SOURCE_MASKABLE, 512, join(webIcons, "icon-maskable-512.png"));
  await png(SOURCE, 180, join(webIcons, "apple-touch-icon.png"), { background: CANVAS });

  const favicon = await pngToIco([
    join(desktopBuild, ".ico-16.png"),
    join(desktopBuild, ".ico-32.png"),
    join(desktopBuild, ".ico-48.png"),
  ]);
  await writeFile(join(root, "apps/web/public/favicon.ico"), favicon);

  const { unlink } = await import("node:fs/promises");
  for (const frame of icoFrames) await unlink(frame);

  console.log("ikonlar uretildi:");
  console.log(
    `  ${desktopBuild}: icon.ico, installerIcon.ico, uninstallerIcon.ico, icon.png, installerSidebar.bmp, uninstallerSidebar.bmp`,
  );
  console.log(
    `  ${webIcons}: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png`,
  );
  console.log(`  apps/web/public/favicon.ico`);
}

await main();
