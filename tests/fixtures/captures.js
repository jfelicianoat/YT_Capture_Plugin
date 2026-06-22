export const validYoutubeCapture = Object.freeze({
  contract_version: "1.0",
  capture_id: "yt_20260622_120000_dQw4w9WgXcQ",
  source_type: "youtube",
  source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  video_id: "dQw4w9WgXcQ",
  title: "Cómo configurar Ollama",
  channel: "TechChannel Pro",
  channel_url: "https://www.youtube.com/@techchannelpro",
  duration_seconds: 1725,
  published_date: "2026-05-10",
  captured_at: "2026-06-22T12:00:00Z",
  transcript_language: "es",
  has_transcript: true,
  transcript_source: "manual",
  transcript_content: "[00:00:00] Bienvenidos al vídeo.",
  extraction_method: "schema_jsonld",
  plugin_version: "0.1.0",
  status: "pending"
});

export const validYoutubeCaptureWithoutTranscript = Object.freeze({
  ...validYoutubeCapture,
  capture_id: "yt_20260622_120001_noTranscript",
  has_transcript: false,
  transcript_language: null,
  transcript_source: null,
  transcript_content: ""
});
