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
