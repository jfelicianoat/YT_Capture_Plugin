import assert from "node:assert/strict";
import test from "node:test";

import {
  assertValidCaptureMarkdown,
  buildCaptureMarkdown,
  MarkdownValidationError,
  parseCaptureFrontmatter
} from "../src/markdown/markdown-builder.js";
import { validYoutubeCapture, validYoutubeCaptureWithoutTranscript } from "./fixtures/captures.js";

test("serializa y reconstruye el contrato sin cambiar valores", () => {
  const candidate = {
    ...validYoutubeCapture,
    title: "Título: \"especial\"\nsegunda línea",
    channel: "Canal #1",
    transcript_content: "[00:00:00] Texto con á, comillas y dos puntos: correcto."
  };
  const markdown = buildCaptureMarkdown(candidate);
  const frontmatter = parseCaptureFrontmatter(markdown);

  assert.equal(frontmatter.title, candidate.title);
  assert.equal(frontmatter.duration_seconds, 1725);
  assert.equal(frontmatter.has_transcript, true);
  assert.match(markdown, /^---\n/);
  assert.match(markdown, /## Transcripción\n\n\[00:00:00\]/);
  assert.equal(assertValidCaptureMarkdown(markdown, candidate), markdown);
});

test("genera una sección de transcripción vacía cuando no hay subtítulos", () => {
  const markdown = buildCaptureMarkdown(validYoutubeCaptureWithoutTranscript);
  assert.equal(parseCaptureFrontmatter(markdown).transcript_source, null);
  assert.ok(markdown.endsWith("## Transcripción\n\n"));
  assert.doesNotThrow(() => assertValidCaptureMarkdown(markdown, validYoutubeCaptureWithoutTranscript));
});

test("rechaza frontmatter ausente, abierto o alterado", () => {
  assert.throws(() => parseCaptureFrontmatter("# Sin YAML"), MarkdownValidationError);
  assert.throws(() => parseCaptureFrontmatter("---\ntitle: \"abierto\""), MarkdownValidationError);

  const markdown = buildCaptureMarkdown(validYoutubeCapture).replace(
    `capture_id: "${validYoutubeCapture.capture_id}"`,
    "capture_id: \"identificador_alterado\""
  );
  assert.throws(() => assertValidCaptureMarkdown(markdown, validYoutubeCapture), MarkdownValidationError);
});

test("rechaza documentos que superan el límite contractual de 20 MiB", () => {
  const oversizedCandidate = {
    ...validYoutubeCapture,
    transcript_content: "x".repeat(20 * 1024 * 1024)
  };
  const markdown = buildCaptureMarkdown(oversizedCandidate);
  assert.throws(
    () => assertValidCaptureMarkdown(markdown, oversizedCandidate),
    /supera el límite de 20 MiB/
  );
});
