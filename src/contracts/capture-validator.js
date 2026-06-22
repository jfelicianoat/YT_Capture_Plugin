import { CAPTURE_CONTRACT_VERSION, captureV1Schema } from "./capture-v1.schema.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function contractError(field, code, message) {
  return { field, code, message };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidUri(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function hasExpectedType(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => {
    if (type === "null") return value === null;
    if (type === "integer") return Number.isInteger(value);
    if (type === "object") return isPlainObject(value);
    return typeof value === type;
  });
}

function validateProperty(field, value, rules, errors) {
  if (rules.type && !hasExpectedType(value, rules.type)) {
    errors.push(contractError(field, "INVALID_TYPE", `debe ser ${[].concat(rules.type).join(" o ")}`));
    return;
  }

  if (rules.const !== undefined && value !== rules.const) {
    errors.push(contractError(field, "INVALID_VALUE", `debe ser ${JSON.stringify(rules.const)}`));
  }
  if (rules.enum && !rules.enum.includes(value)) {
    errors.push(contractError(field, "INVALID_ENUM", `valor permitido: ${rules.enum.map(String).join(", ")}`));
  }

  if (typeof value === "string") {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push(contractError(field, "TOO_SHORT", `debe tener al menos ${rules.minLength} caracteres`));
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push(contractError(field, "TOO_LONG", `no puede superar ${rules.maxLength} caracteres`));
    }
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      errors.push(contractError(field, "INVALID_FORMAT", "no cumple el patrón requerido"));
    }
    if (rules.format === "uri" && !isValidUri(value)) {
      errors.push(contractError(field, "INVALID_URI", "debe ser una URL HTTP(S) válida"));
    }
    if (rules.format === "date" && !ISO_DATE.test(value)) {
      errors.push(contractError(field, "INVALID_DATE", "debe usar YYYY-MM-DD"));
    }
    if (rules.format === "date-time" && !ISO_DATE_TIME.test(value)) {
      errors.push(contractError(field, "INVALID_DATE_TIME", "debe ser ISO 8601 con zona horaria"));
    }
  }

  if (typeof value === "number" && rules.minimum !== undefined && value < rules.minimum) {
    errors.push(contractError(field, "OUT_OF_RANGE", `debe ser mayor o igual que ${rules.minimum}`));
  }
}

function addMissingFields(candidate, fields, code, message, errors) {
  for (const field of fields) {
    if (!(field in candidate)) errors.push(contractError(field, code, message));
  }
}

export function validateCapture(candidate) {
  const errors = [];
  if (!isPlainObject(candidate)) {
    return { valid: false, errors: [contractError("$", "INVALID_TYPE", "la captura debe ser un objeto")] };
  }

  addMissingFields(candidate, captureV1Schema.required, "REQUIRED", "campo obligatorio ausente", errors);

  for (const [field, rules] of Object.entries(captureV1Schema.properties)) {
    if (field in candidate) validateProperty(field, candidate[field], rules, errors);
  }

  if (candidate.contract_version !== CAPTURE_CONTRACT_VERSION) {
    errors.push(contractError("contract_version", "UNSUPPORTED_VERSION", `versión soportada: ${CAPTURE_CONTRACT_VERSION}`));
  }

  if (candidate.source_type === "youtube") {
    addMissingFields(
      candidate,
      captureV1Schema.allOf[0].then.required,
      "REQUIRED_FOR_YOUTUBE",
      "campo obligatorio para YouTube",
      errors
    );
  }

  const transcriptRule = captureV1Schema.allOf[1];
  if (candidate.has_transcript === true) {
    addMissingFields(
      candidate,
      transcriptRule.then.required,
      "REQUIRED_WITH_TRANSCRIPT",
      "campo obligatorio cuando hay transcripción",
      errors
    );
    for (const [field, rules] of Object.entries(transcriptRule.then.properties)) {
      if (field in candidate) validateProperty(field, candidate[field], rules, errors);
    }
  } else if (candidate.has_transcript === false) {
    for (const [field, rules] of Object.entries(transcriptRule.else.properties)) {
      if (field in candidate) validateProperty(field, candidate[field], rules, errors);
    }
  }

  return { valid: errors.length === 0, errors };
}

export class CaptureContractError extends Error {
  constructor(errors) {
    const first = errors[0] ?? { field: "$", message: "captura inválida" };
    super(`Error de contrato: ${first.field} — ${first.message}`);
    this.name = "CaptureContractError";
    this.code = "CONTRACT_VALIDATION_FAILED";
    this.errors = errors;
  }
}

export function assertValidCapture(candidate) {
  const result = validateCapture(candidate);
  if (!result.valid) throw new CaptureContractError(result.errors);
  return candidate;
}
