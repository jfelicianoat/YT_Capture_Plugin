import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { captureV1Schema } from "../src/contracts/capture-v1.schema.js";
import { CaptureContractError, assertValidCapture, validateCapture } from "../src/contracts/capture-validator.js";
import { validYoutubeCapture, validYoutubeCaptureWithoutTranscript } from "./fixtures/captures.js";

test("el esquema JSON y el esquema runtime permanecen sincronizados", async () => {
  const json = JSON.parse(await readFile(new URL("../src/contracts/capture-v1.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(json, captureV1Schema);
});

test("acepta una captura YouTube válida", () => {
  assert.deepEqual(validateCapture(validYoutubeCapture), { valid: true, errors: [] });
});

test("acepta una captura válida sin transcripción", () => {
  assert.deepEqual(validateCapture(validYoutubeCaptureWithoutTranscript), { valid: true, errors: [] });
});

for (const field of captureV1Schema.required) {
  test(`rechaza la ausencia del campo obligatorio ${field}`, () => {
    const candidate = { ...validYoutubeCapture };
    delete candidate[field];
    const result = validateCapture(candidate);
    assert.equal(result.valid, false);
    assert(result.errors.some((item) => item.field === field));
  });
}

test("rechaza una versión desconocida", () => {
  const result = validateCapture({ ...validYoutubeCapture, contract_version: "2.0" });
  assert.equal(result.valid, false);
  assert(result.errors.some((item) => item.code === "UNSUPPORTED_VERSION"));
});

test("rechaza tipos incorrectos", () => {
  const result = validateCapture({ ...validYoutubeCapture, duration_seconds: "1725" });
  assert.equal(result.valid, false);
  assert(result.errors.some((item) => item.field === "duration_seconds" && item.code === "INVALID_TYPE"));
});

test("rechaza transcripción vacía cuando has_transcript es true", () => {
  const result = validateCapture({ ...validYoutubeCapture, transcript_content: "" });
  assert.equal(result.valid, false);
  assert(result.errors.some((item) => item.field === "transcript_content"));
});

test("assertValidCapture expone un error claro", () => {
  assert.throws(
    () => assertValidCapture({ ...validYoutubeCapture, title: "" }),
    (error) => error instanceof CaptureContractError
      && error.code === "CONTRACT_VALIDATION_FAILED"
      && error.message.startsWith("Error de contrato: title")
  );
});
