import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildDeterministicZip } from "../scripts/package.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("genera un ZIP reproducible con solo los ficheros de la extensión", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "yt-capture-package-"));
  try {
    const firstPath = path.join(temporaryDirectory, "first.zip");
    const secondPath = path.join(temporaryDirectory, "second.zip");
    const first = await buildDeterministicZip({ rootDirectory: PROJECT_ROOT, outputPath: firstPath });
    const second = await buildDeterministicZip({ rootDirectory: PROJECT_ROOT, outputPath: secondPath });
    const firstBytes = await readFile(firstPath);
    const secondBytes = await readFile(secondPath);

    assert.equal(createHash("sha256").update(firstBytes).digest("hex"), first.sha256);
    assert.deepEqual(firstBytes, secondBytes);
    assert.deepEqual(first.filenames, second.filenames);
    assert.ok(first.filenames.includes("manifest.json"));
    assert.ok(first.filenames.includes("popup/popup.html"));
    assert.ok(first.filenames.includes("src/background.js"));
    assert.equal(first.filenames.some((filename) => filename.startsWith("tests/")), false);
    assert.equal(firstBytes.readUInt32LE(0), 0x04034B50);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
