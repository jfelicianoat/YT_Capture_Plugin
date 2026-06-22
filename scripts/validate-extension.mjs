import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function assertFile(rootDirectory, relativePath) {
  const info = await stat(path.join(rootDirectory, relativePath));
  assert.equal(info.isFile(), true, `No es un fichero: ${relativePath}`);
}

async function collectScripts(directory) {
  const scripts = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) scripts.push(...await collectScripts(absolutePath));
    else if (/\.(?:js|mjs)$/.test(entry.name)) scripts.push(absolutePath);
  }
  return scripts;
}

async function assertValidJavaScript(rootDirectory) {
  const directories = ["popup", "src", "scripts"];
  for (const directory of directories) {
    const scripts = await collectScripts(path.join(rootDirectory, directory));
    for (const script of scripts) {
      const result = spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr || `JavaScript inválido: ${script}`);
    }
  }
}

export async function validateExtension(rootDirectory = PROJECT_ROOT) {
  const manifest = JSON.parse(await readFile(path.join(rootDirectory, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3, "El manifiesto debe ser V3");
  assert.equal(manifest.background?.type, "module", "El service worker debe ser un módulo");
  assert.ok(manifest.permissions?.includes("activeTab"), "Falta activeTab");
  assert.ok(manifest.permissions?.includes("downloads"), "Falta downloads");
  assert.ok(manifest.permissions?.includes("scripting"), "Falta scripting");
  assert.deepEqual(manifest.host_permissions, ["https://www.youtube.com/*"]);

  await Promise.all([
    assertFile(rootDirectory, manifest.background.service_worker),
    assertFile(rootDirectory, manifest.action.default_popup),
    assertFile(rootDirectory, "popup/popup.css"),
    assertFile(rootDirectory, "popup/popup.js"),
    assertFile(rootDirectory, "src/contracts/capture-v1.schema.json")
  ]);

  JSON.parse(await readFile(path.join(rootDirectory, "src/contracts/capture-v1.schema.json"), "utf8"));
  await assertValidJavaScript(rootDirectory);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateExtension();
  console.log("Validación estática de la extensión: OK");
}
