function baseLanguage(value) {
  return typeof value === "string" ? value.toLowerCase().split("-")[0] : null;
}

function languageMatches(track, preferredLanguage) {
  const preferred = baseLanguage(preferredLanguage);
  return preferred !== null && baseLanguage(track.languageCode) === preferred;
}

export function captionTrackType(track) {
  return track?.kind === "asr" ? "automatic" : "manual";
}

export function selectCaptionTrack(tracks, preferredLanguage) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  return tracks.find((track) => captionTrackType(track) === "manual" && languageMatches(track, preferredLanguage))
    ?? tracks.find((track) => captionTrackType(track) === "automatic" && languageMatches(track, preferredLanguage))
    ?? tracks[0];
}

export function withJson3Format(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", "json3");
  return url.toString();
}

function decodeHtmlEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      const isUnicodeScalar = Number.isInteger(codePoint)
        && codePoint >= 0
        && codePoint <= 0x10FFFF
        && !(codePoint >= 0xD800 && codePoint <= 0xDFFF);
      return isUnicodeScalar ? String.fromCodePoint(codePoint) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

export function formatTimestamp(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

export function parseJson3Transcript(payload) {
  if (!Array.isArray(payload?.events)) return "";
  const lines = [];
  const orderedEvents = payload.events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const leftTime = Number(left.event?.tStartMs);
      const rightTime = Number(right.event?.tStartMs);
      const safeLeft = Number.isFinite(leftTime) ? Math.max(0, leftTime) : Number.MAX_SAFE_INTEGER;
      const safeRight = Number.isFinite(rightTime) ? Math.max(0, rightTime) : Number.MAX_SAFE_INTEGER;
      return safeLeft - safeRight || left.index - right.index;
    });
  for (const { event } of orderedEvents) {
    if (!Array.isArray(event?.segs)) continue;
    const text = decodeHtmlEntities(event.segs.map((segment) => segment?.utf8 ?? "").join(""))
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    lines.push(`[${formatTimestamp(event.tStartMs)}] ${text}`);
  }
  return lines.join("\n");
}
