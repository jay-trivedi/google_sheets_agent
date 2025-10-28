/**
 * Shared CORS headers for all Edge Functions
 * Allows requests from Google Sheets and Google Apps Script
 */

const ALLOWED_ORIGINS = [
  "https://docs.google.com",
  "https://script.googleusercontent.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export function cors(req: Request, extra: Record<string, string> = {}) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
    ...extra,
  };
}

