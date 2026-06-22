import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateExtension } from "./validate-extension.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_ROOTS = Object.freeze(["manifest.json", "popup", "src"]);
const UTF8_FLAG = 0x0800;
const DOS_DATE_1980_01_01 = 33;

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function collectPath(rootDirectory, relativePath, files) {
  const absolutePath = path.join(rootDirectory, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch(() => null);
  if (entries === null) {
    files.push(relativePath.replaceAll(path.sep, "/"));
    return;
  }
  for (const entry of entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) await collectPath(rootDirectory, child, files);
    else if (entry.isFile()) files.push(child.replaceAll(path.sep, "/"));
  }
}

export async function collectExtensionFiles(rootDirectory = PROJECT_ROOT) {
  const files = [];
  for (const packageRoot of PACKAGE_ROOTS) await collectPath(rootDirectory, packageRoot, files);
  return files.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

export async function buildDeterministicZip({ rootDirectory = PROJECT_ROOT, outputPath }) {
  const filenames = await collectExtensionFiles(rootDirectory);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const filename of filenames) {
    const name = Buffer.from(filename, "utf8");
    const content = await readFile(path.join(rootDirectory, ...filename.split("/")));
    const checksum = crc32(content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034B50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(UTF8_FLAG, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(DOS_DATE_1980_01_01, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014B50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(DOS_DATE_1980_01_01, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054B50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(filenames.length, 8);
  end.writeUInt16LE(filenames.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  const archive = Buffer.concat([...localParts, centralDirectory, end]);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, archive);
  return { archive, filenames, sha256: createHash("sha256").update(archive).digest("hex") };
}

async function main() {
  const manifest = await validateExtension(PROJECT_ROOT);
  const outputDirectory = process.env.YT_CAPTURE_PACKAGE_DIR
    ? path.resolve(process.env.YT_CAPTURE_PACKAGE_DIR)
    : path.join(PROJECT_ROOT, "dist");
  const outputPath = path.join(outputDirectory, `yt-capture-plugin-${manifest.version}.zip`);
  const result = await buildDeterministicZip({ outputPath });
  console.log(`ZIP: ${outputPath}`);
  console.log(`Ficheros: ${result.filenames.length}`);
  console.log(`SHA-256: ${result.sha256}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
