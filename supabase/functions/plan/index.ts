// supabase/functions/plan/index.ts
// Deno Edge Function that always replies {ok:true}. CORS set for Sheets sidebar.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function cors(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "https://docs.google.com",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
    ...extra,
  };
}

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  // Try to parse body (optional)
  let payload: unknown = null;
  try {
    if (req.method === "POST") payload = await req.json();
  } catch {}

  const body = {
    ok: true,
    echo: payload ?? null,
    time: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: cors({ "Content-Type": "application/json; charset=utf-8" }),
  });
});
