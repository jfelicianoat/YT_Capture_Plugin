import { assertValidCapture } from "./contracts/capture-validator.js";
import { assertValidCaptureMarkdown } from "./markdown/markdown-builder.js";

export async function prepareCaptureForDownload(candidate, adapters) {
  if (typeof adapters?.serialize !== "function" || typeof adapters?.download !== "function") {
    throw new TypeError("serialize y download son adaptadores obligatorios");
  }

  assertValidCapture(candidate);
  const markdown = await adapters.serialize(candidate);

  if (typeof markdown !== "string" || markdown.length === 0) {
    throw new TypeError("El serializador debe devolver Markdown no vacío");
  }

  assertValidCaptureMarkdown(markdown, candidate);

  return adapters.download({ candidate, markdown });
}
