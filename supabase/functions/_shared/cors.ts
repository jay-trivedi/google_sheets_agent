/**
 * Shared CORS headers for all Edge Functions
 * Allows requests from Google Sheets and Google Apps Script
 */

export function cors(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "https://docs.google.com",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
    ...extra,
  };
}


