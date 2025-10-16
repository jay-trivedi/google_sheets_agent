import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";

httpServe(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const clientUserId = body?.clientUserId;
  if (!clientUserId) {
    return new Response(JSON.stringify({ error: "clientUserId required" }), {
      status: 400, headers: cors({ "Content-Type": "application/json" }),
    });
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const redirectUri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URL");
  if (!clientId || !redirectUri) {
    return new Response(JSON.stringify({ error: "Missing GOOGLE_CLIENT_ID or GOOGLE_OAUTH_REDIRECT_URL" }), {
      status: 500, headers: cors({ "Content-Type": "application/json" }),
    });
  }

  const scopeList = (Deno.env.get("GOOGLE_SHEETS_SCOPES")
    ?? "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly")
    .split(/[,\s]+/).filter(Boolean);
  const scopes = scopeList.join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,                 // <— unencoded string with spaces
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: clientUserId,
  });

  return new Response(JSON.stringify({
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }), { status: 200, headers: cors({ "Content-Type": "application/json" }) });
});
