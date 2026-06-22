import { assertValidCapture } from "../contracts/capture-validator.js";

const MAX_MARKDOWN_BYTES = 20 * 1024 * 1024;

export const FRONTMATTER_FIELDS = Object.freeze([
  "contract_version",
  "capture_id",
  "source_type",
  "source_url",
  "video_id",
  "title",
  "channel",
  "channel_url",
  "duration_seconds",
  "published_date",
  "captured_at",
  "transcript_language",
  "has_transcript",
  "transcript_source",
  "extraction_method",
  "plugin_version",
  "status"
]);

export class MarkdownValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MarkdownValidationError";
    this.code = "MARKDOWN_VALIDATION_FAILED";
  }
}

function yamlScalar(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(String(value));
}

function singleLine(value, fallback = "No disponible") {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const parts = hours > 0 ? [hours, minutes, remainder] : [minutes, remainder];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

export function buildCaptureMarkdown(candidate) {
  assertValidCapture(candidate);

  const frontmatter = FRONTMATTER_FIELDS
    .map((field) => `${field}: ${yamlScalar(candidate[field] ?? null)}`)
    .join("\n");
  const transcript = candidate.has_transcript ? candidate.transcript_content : "";

  const lines = [
    "---",
    frontmatter,
    "---",
    "",
    `# ${singleLine(candidate.title)}`,
    "",
    `**Canal:** ${singleLine(candidate.channel)}  `,
    `**Duración:** ${formatDuration(candidate.duration_seconds)}  `,
    `**Publicado:** ${singleLine(candidate.published_date)}  `,
    `**Capturado:** ${singleLine(candidate.captured_at)}  `,
    "",
    "## Transcripción"
  ];
  lines.push(...(transcript ? ["", transcript, ""] : ["", ""]));
  return lines.join("\n");
}

export function parseCaptureFrontmatter(markdown) {
  if (typeof markdown !== "string" || !markdown.startsWith("---\n")) {
    throw new MarkdownValidationError("El documento no comienza con frontmatter YAML");
  }

  const closingIndex = markdown.indexOf("\n---\n", 4);
  if (closingIndex < 0) throw new MarkdownValidationError("El frontmatter YAML no está cerrado");

  const result = {};
  const lines = markdown.slice(4, closingIndex).split("\n");
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator <= 0) throw new MarkdownValidationError(`Línea YAML inválida: ${line}`);
    const field = line.slice(0, separator).trim();
    const encodedValue = line.slice(separator + 1).trim();
    if (!FRONTMATTER_FIELDS.includes(field) || field in result) {
      throw new MarkdownValidationError(`Campo YAML inesperado o duplicado: ${field}`);
    }
    try {
      result[field] = JSON.parse(encodedValue);
    } catch {
      throw new MarkdownValidationError(`Valor YAML inválido en ${field}`);
    }
  }
  return result;
}

export function assertValidCaptureMarkdown(markdown, expectedCandidate) {
  const byteLength = new TextEncoder().encode(markdown).byteLength;
  if (byteLength > MAX_MARKDOWN_BYTES) {
    throw new MarkdownValidationError("El documento supera el límite de 20 MiB");
  }
  const parsed = parseCaptureFrontmatter(markdown);
  try {
    assertValidCapture({ ...parsed, transcript_content: expectedCandidate.transcript_content });
  } catch (error) {
    throw new MarkdownValidationError(`El frontmatter no cumple el contrato: ${error.message}`);
  }

  for (const field of FRONTMATTER_FIELDS) {
    if (!Object.is(parsed[field], expectedCandidate[field] ?? null)) {
      throw new MarkdownValidationError(`El campo ${field} cambió durante la serialización`);
    }
  }

  const transcriptMarker = "\n## Transcripción\n\n";
  const markerIndex = markdown.indexOf(transcriptMarker);
  if (markerIndex < 0) throw new MarkdownValidationError("Falta la sección de transcripción");
  const transcript = markdown.slice(markerIndex + transcriptMarker.length).replace(/\n$/, "");
  if (transcript !== expectedCandidate.transcript_content) {
    throw new MarkdownValidationError("La transcripción cambió durante la serialización");
  }

  return markdown;
}
