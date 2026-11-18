import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCaptureFilename,
  downloadCaptureMarkdown,
  sanitizeFilenamePart,
  waitForDownload
} from "../src/download/chrome-downloader.js";
import { validYoutubeCapture } from "./fixtures/captures.js";

function downloaderFixture({
  searchResults = [],
  downloadResult = 42,
  searchError = null,
  outcome = "complete"
} = {}) {
  const calls = { search: [], download: [], create: [], revoke: [], order: [] };
  const listeners = new Set();
  const downloads = {
    onChanged: {
      addListener(listener) {
        listeners.add(listener);
        // Chrome avisa del final de la descarga más tarde, por su cuenta.
        if (outcome) {
          setTimeout(() => {
            calls.order.push(`evento:${outcome}`);
            for (const each of [...listeners]) {
              each({ id: downloadResult, state: { current: outcome }, error: { current: "NETWORK_FAILED" } });
            }
          }, 0);
        }
      },
      removeListener(listener) { listeners.delete(listener); }
    },
    async search(query) {
      calls.search.push(query);
      if (searchError) throw searchError;
      return searchResults;
    },
    async download(options) {
      calls.download.push(options);
      if (downloadResult instanceof Error) throw downloadResult;
      return downloadResult;
    }
  };
  const urlApi = {
    createObjectURL(blob) { calls.create.push(blob); return "blob:test"; },
    revokeObjectURL(url) { calls.revoke.push(url); calls.order.push("revocar"); }
  };
  class BlobConstructor {
    constructor(parts, options) { this.parts = parts; this.type = options.type; }
  }
  return { calls, dependencies: { downloads, urlApi, BlobConstructor } };
}

test("sanea caracteres Windows y limita el nombre completo a 200 caracteres", () => {
  assert.equal(sanitizeFilenamePart('  vídeo: prueba<>"/\\|?*...  '), "vídeo prueba");
  const filename = buildCaptureFilename({
    ...validYoutubeCapture,
    title: `Título ${"á".repeat(300)}`
  });
  assert.ok(Array.from(filename).length <= 200);
  assert.match(filename, /^2026-06-22 - /);
  assert.ok(filename.endsWith(".md"));
  assert.doesNotMatch(filename, /[<>:"/\\|?*]/);
});

test("descarga UTF-8 en el inbox y revoca la URL temporal", async () => {
  const fixture = downloaderFixture();
  const result = await downloadCaptureMarkdown(
    { candidate: validYoutubeCapture, markdown: "# contenido" },
    fixture.dependencies
  );

  assert.equal(result.downloadId, 42);
  assert.equal(result.path, "YT-Knowledge-Inbox/2026-06-22 - Cómo configurar Ollama.md");
  assert.equal(fixture.calls.download[0].url, "blob:test");
  assert.equal(fixture.calls.download[0].conflictAction, "uniquify");
  assert.equal(fixture.calls.create[0].type, "text/markdown;charset=utf-8");
  assert.deepEqual(fixture.calls.revoke, ["blob:test"]);
});

test("añade video_id cuando detecta una colisión", async () => {
  const fixture = downloaderFixture({
    searchResults: [{ filename: "C:\\Downloads\\2026-06-22 - Cómo configurar Ollama.md" }]
  });
  const result = await downloadCaptureMarkdown(
    { candidate: validYoutubeCapture, markdown: "# contenido" },
    fixture.dependencies
  );
  assert.equal(result.filename, "2026-06-22 - Cómo configurar Ollama [dQw4w9WgXcQ].md");
});

test("revoca la URL aunque Chrome rechace la descarga", async () => {
  const fixture = downloaderFixture({ downloadResult: new Error("Download denied") });
  await assert.rejects(
    downloadCaptureMarkdown(
      { candidate: validYoutubeCapture, markdown: "# contenido" },
      fixture.dependencies
    ),
    /Download denied/
  );
  assert.deepEqual(fixture.calls.revoke, ["blob:test"]);
});

test("revoca la URL solo cuando Chrome da la descarga por terminada", async () => {
  const fixture = downloaderFixture();
  await downloadCaptureMarkdown({ candidate: validYoutubeCapture, markdown: "# x" }, fixture.dependencies);
  assert.deepEqual(fixture.calls.order, ["evento:complete", "revocar"]);
});

test("una descarga interrumpida falla y revoca igualmente la URL", async () => {
  const fixture = downloaderFixture({ outcome: "interrupted" });
  await assert.rejects(
    downloadCaptureMarkdown({ candidate: validYoutubeCapture, markdown: "# x" }, fixture.dependencies),
    /interrumpió/
  );
  assert.deepEqual(fixture.calls.revoke, ["blob:test"]);
});

test("si Chrome no avisa, la espera termina con un error", async () => {
  const { dependencies } = downloaderFixture({ outcome: null });
  await assert.rejects(waitForDownload(dependencies.downloads, 42, 20), /no terminó/);
});

test("una descarga que ya terminó antes de escuchar no se queda esperando", async () => {
  const { dependencies } = downloaderFixture({ outcome: null, searchResults: [{ id: 42, state: "complete" }] });
  await waitForDownload(dependencies.downloads, 42, 1000);
});
