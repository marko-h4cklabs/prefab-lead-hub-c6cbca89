/**
 * Safely extract a displayable error message string from any error shape.
 * Prevents React crash (error #31) from rendering objects in JSX.
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return "An unexpected error occurred.";
  if (typeof error === "string") return error;

  const e = error as any;

  // API error with details.name array (validation)
  if (e?.details?.name && Array.isArray(e.details.name) && e.details.name.length > 0) {
    return String(e.details.name[0]);
  }

  if (typeof e.message === "string" && e.message) return e.message;
  if (typeof e.error === "string" && e.error) return e.error;
  if (typeof e.detail === "string" && e.detail) return e.detail;

  return "An unexpected error occurred. Please try again.";
}

/**
 * Extract field-level validation errors from an API error response.
 * Returns a map of field name → first error message string.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  const details = (error as any)?.details;
  if (details && typeof details === "object") {
    for (const [key, val] of Object.entries(details)) {
      if (Array.isArray(val) && val.length > 0) {
        result[key] = String(val[0]);
      } else if (typeof val === "string") {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Safely convert any value to a displayable string for React rendering.
 * Prevents React error #31 by never returning an object.
 */
export function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
      return value.join(", ");
    }
    return `${value.length} items: ${JSON.stringify(value)}`;
  }
  return JSON.stringify(value);
}

/**
 * Safely ensure a value is an array. If not, log a warning and return [].
 */
export function safeArray<T = any>(value: unknown, label = "data"): T[] {
  if (Array.isArray(value)) return value;
  if (value !== null && value !== undefined) {
    console.warn(`Expected array for ${label}, got ${typeof value}`);
  }
  return [];
}

/** Name normalization: replace underscores with spaces, collapse whitespace, trim. */
export function normalizeLeadName(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\s+/g, " ").trimStart();
}

/** Validate a lead name: only letters (incl. diacritics), spaces, apostrophe, hyphen, dot. */
const VALID_NAME_RE = /^[a-zA-ZÀ-ÖØ-öø-ÿ'\-.\s]*$/;

export function validateLeadName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length > 0 && trimmed.length < 2) return "Name must be at least 2 characters.";
  if (!VALID_NAME_RE.test(trimmed)) return "Name can only contain letters, spaces, apostrophes, hyphens, and dots.";
  return null;
}
