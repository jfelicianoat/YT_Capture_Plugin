const OUTPUT_DIRECTORY = "YT-Knowledge-Inbox";
const MAX_FILENAME_LENGTH = 200;
const INVALID_WINDOWS_CHARACTERS = /[<>:"/\\|?*\u0000-\u001F]/g;

function trimToCodePoints(value, maximumLength) {
  return Array.from(value).slice(0, Math.max(0, maximumLength)).join("");
}

export function sanitizeFilenamePart(value) {
  const sanitized = String(value ?? "")
    .replace(INVALID_WINDOWS_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return sanitized || "Vídeo de YouTube";
}

export function buildCaptureFilename(candidate, { collision = false } = {}) {
  const date = String(candidate.captured_at).slice(0, 10);
  const collisionSuffix = collision ? ` [${sanitizeFilenamePart(candidate.video_id)}]` : "";
  const prefix = `${date} - `;
  const extension = ".md";
  const fixedLength = Array.from(prefix + collisionSuffix + extension).length;
  const title = trimToCodePoints(sanitizeFilenamePart(candidate.title), MAX_FILENAME_LENGTH - fixedLength)
    .replace(/[. ]+$/g, "") || "Vídeo";
  return `${prefix}${title}${collisionSuffix}${extension}`;
}

function basename(path) {
  return String(path ?? "").split(/[\\/]/).pop();
}

async function hasPreviousDownload(downloads, filename) {
  const matches = await downloads.search({ query: [filename] });
  return matches.some((item) => basename(item.filename).toLocaleLowerCase() === filename.toLocaleLowerCase());
}

export async function downloadCaptureMarkdown(
  { candidate, markdown },
  {
    downloads = chrome.downloads,
    urlApi = URL,
    BlobConstructor = Blob
  } = {}
) {
  const baseFilename = buildCaptureFilename(candidate);
  let collision = false;
  try {
    collision = await hasPreviousDownload(downloads, baseFilename);
  } catch {
    collision = true;
  }

  const filename = buildCaptureFilename(candidate, { collision });
  const path = `${OUTPUT_DIRECTORY}/${filename}`;
  const blobUrl = urlApi.createObjectURL(new BlobConstructor([markdown], { type: "text/markdown;charset=utf-8" }));

  try {
    const downloadId = await downloads.download({
      url: blobUrl,
      filename: path,
      conflictAction: "uniquify",
      saveAs: false
    });
    if (!Number.isInteger(downloadId)) throw new Error("Chrome no devolvió un identificador de descarga");
    return { downloadId, filename, path };
  } finally {
    urlApi.revokeObjectURL(blobUrl);
  }
}
