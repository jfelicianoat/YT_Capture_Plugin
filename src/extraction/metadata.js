const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);

export function getYoutubeVideoId(value) {
  try {
    const url = new URL(value);
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;
    const queryId = url.searchParams.get("v");
    if (queryId) return queryId;
    const match = url.pathname.match(/^\/(?:shorts|live)\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function parseIsoDuration(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return null;
  return Math.round(Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0));
}

export function parseClockDuration(value) {
  if (typeof value !== "string") return null;
  const parts = value.trim().split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function selectMetadata(pageData, tabUrl) {
  const videoId = getYoutubeVideoId(pageData?.url ?? tabUrl);
  if (pageData?.schema?.title) {
    return {
      videoId,
      title: pageData.schema.title,
      channel: pageData.schema.channel ?? "Canal no disponible",
      channelUrl: pageData.schema.channelUrl ?? null,
      durationSeconds: parseIsoDuration(pageData.schema.duration) ?? pageData.globals?.durationSeconds ?? 0,
      publishedDate: pageData.schema.publishedDate ?? null,
      extractionMethod: "schema_jsonld"
    };
  }
  if (pageData?.globals?.title) {
    return {
      videoId,
      title: pageData.globals.title,
      channel: pageData.globals.channel ?? "Canal no disponible",
      channelUrl: pageData.globals.channelUrl ?? null,
      durationSeconds: Number.isFinite(pageData.globals.durationSeconds) ? pageData.globals.durationSeconds : 0,
      publishedDate: pageData.globals.publishedDate ?? null,
      extractionMethod: "yt_globals"
    };
  }
  return {
    videoId,
    title: pageData?.dom?.title ?? null,
    channel: pageData?.dom?.channel ?? "Canal no disponible",
    channelUrl: pageData?.dom?.channelUrl ?? null,
    durationSeconds: parseClockDuration(pageData?.dom?.durationText) ?? 0,
    publishedDate: null,
    extractionMethod: "dom_selectors"
  };
}

function compactUtcTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_");
}

export function buildCaptureCandidate({
  metadata, tabUrl, videoId, transcriptContent, transcriptLanguage,
  transcriptSource, capturedAt, pluginVersion
}) {
  const hasTranscript = transcriptContent.length > 0;
  return {
    contract_version: "1.0",
    capture_id: `yt_${compactUtcTimestamp(capturedAt)}_${videoId}`,
    source_type: "youtube",
    source_url: tabUrl,
    video_id: videoId,
    title: metadata.title,
    channel: metadata.channel,
    channel_url: metadata.channelUrl,
    duration_seconds: metadata.durationSeconds,
    published_date: metadata.publishedDate,
    captured_at: capturedAt.toISOString(),
    transcript_language: hasTranscript ? transcriptLanguage : null,
    has_transcript: hasTranscript,
    transcript_source: hasTranscript ? transcriptSource : null,
    transcript_content: hasTranscript ? transcriptContent : "",
    extraction_method: metadata.extractionMethod,
    plugin_version: pluginVersion,
    status: "pending"
  };
}
