import assert from "node:assert/strict";
import test from "node:test";

import { prepareCaptureForDownload } from "../src/capture-pipeline.js";
import { CaptureContractError } from "../src/contracts/capture-validator.js";
import { buildCaptureMarkdown, MarkdownValidationError } from "../src/markdown/markdown-builder.js";
import { validYoutubeCapture } from "./fixtures/captures.js";

test("una captura inválida no alcanza serialización ni descarga", async () => {
  let serializeCalls = 0;
  let downloadCalls = 0;

  await assert.rejects(
    prepareCaptureForDownload(
      { ...validYoutubeCapture, capture_id: "id con espacios" },
      {
        serialize: async () => { serializeCalls += 1; return "markdown"; },
        download: async () => { downloadCalls += 1; }
      }
    ),
    CaptureContractError
  );

  assert.equal(serializeCalls, 0);
  assert.equal(downloadCalls, 0);
});

test("una captura válida se valida antes de serializar y descargar", async () => {
  const calls = [];
  const result = await prepareCaptureForDownload(validYoutubeCapture, {
    serialize: async (candidate) => { calls.push("serialize"); return buildCaptureMarkdown(candidate); },
    download: async ({ markdown }) => { calls.push("download"); return markdown.length; }
  });

  assert.deepEqual(calls, ["serialize", "download"]);
  assert.ok(result > 100);
});

test("un Markdown corrupto después de serializar no alcanza la descarga", async () => {
  let downloadCalls = 0;
  await assert.rejects(
    prepareCaptureForDownload(validYoutubeCapture, {
      serialize: async () => "---\ntitle: \"otro título\"\n---\n",
      download: async () => { downloadCalls += 1; }
    }),
    MarkdownValidationError
  );
  assert.equal(downloadCalls, 0);
});
