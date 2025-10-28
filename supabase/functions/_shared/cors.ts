/**
 * Shared CORS headers for all Edge Functions
 * Allows requests from Google Sheets and Google Apps Script
 */

const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-script-context",
];

const ALLOWED_ORIGINS = new Set([
  "https://docs.google.com",
  "https://script.googleusercontent.com",
  "http://localhost",
  "http://127.0.0.1",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export function cors(req: Request, extra: Record<string, string> = {}) {
  const originHeader = req.headers.get("origin") ?? "";
  let allowOrigin = "https://docs.google.com";

  if (originHeader) {
    try {
      const url = new URL(originHeader);
      const normalized = url.origin;
      if (
        ALLOWED_ORIGINS.has(normalized) ||
        normalized.endsWith(".supabase.co") ||
        normalized.endsWith(".googleusercontent.com")
      ) {
        allowOrigin = normalized;
      }
    } catch (_) {
      // ignore malformed origin
    }
  }

  const requestedHeaders = req.headers.get("access-control-request-headers");
  const headers = new Set(DEFAULT_ALLOWED_HEADERS);
  if (requestedHeaders) {
    requestedHeaders
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
      .forEach((h) => headers.add(h));
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": Array.from(headers).join(", "),
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    ...extra,
  };
}
