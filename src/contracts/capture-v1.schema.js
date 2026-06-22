export const CAPTURE_CONTRACT_VERSION = "1.0";

export const captureV1Schema = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://local.yt-knowledge/contracts/capture-v1.schema.json",
  title: "YT Knowledge Capture payload v1",
  type: "object",
  required: [
    "contract_version", "capture_id", "source_type", "title",
    "captured_at", "has_transcript", "status", "transcript_content"
  ],
  properties: {
    contract_version: { const: CAPTURE_CONTRACT_VERSION },
    capture_id: { type: "string", pattern: "^[A-Za-z0-9._-]+$", minLength: 1, maxLength: 128 },
    source_type: { type: "string", enum: ["youtube"] },
    title: { type: "string", minLength: 1, maxLength: 500 },
    captured_at: { type: "string", format: "date-time" },
    has_transcript: { type: "boolean" },
    status: { const: "pending" },
    transcript_content: { type: "string" },
    source_url: { type: "string", format: "uri" },
    published_date: { type: ["string", "null"], format: "date" },
    transcript_language: { type: ["string", "null"], minLength: 2 },
    video_id: { type: "string", minLength: 1, maxLength: 32 },
    channel: { type: "string", minLength: 1, maxLength: 300 },
    channel_url: { type: ["string", "null"], format: "uri" },
    duration_seconds: { type: "integer", minimum: 0 },
    extraction_method: { type: "string", enum: ["schema_jsonld", "yt_globals", "dom_selectors"] },
    transcript_source: { type: ["string", "null"], enum: ["manual", "automatic", null] },
    plugin_version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" }
  },
  allOf: [
    {
      if: { properties: { source_type: { const: "youtube" } } },
      then: {
        required: [
          "source_url", "video_id", "channel", "duration_seconds",
          "extraction_method", "transcript_source", "plugin_version"
        ]
      }
    },
    {
      if: { properties: { has_transcript: { const: true } } },
      then: {
        required: ["transcript_language"],
        properties: {
          transcript_content: { type: "string", minLength: 1 },
          transcript_language: { type: "string", minLength: 2 },
          transcript_source: { enum: ["manual", "automatic"] }
        }
      },
      else: {
        properties: {
          transcript_content: { const: "" },
          transcript_source: { const: null }
        }
      }
    }
  ],
  additionalProperties: true
});
