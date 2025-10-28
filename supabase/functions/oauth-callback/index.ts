import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { svc } from "../_shared/db.ts";
import { seal } from "../_shared/crypto.ts";

function html(msg: string) {
  return new Response(`<!doctype html><meta charset="utf-8"><body>OAuth: ${msg}. You can close this tab.</body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

httpServe(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return html("Missing code/state");

  const client_id = Deno.env.get("GOOGLE_CLIENT_ID");
  const client_secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirect_uri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URL");
  if (!client_id || !client_secret || !redirect_uri) return html("Missing Google OAuth env");

  const body = new URLSearchParams({ code, client_id, client_secret, redirect_uri, grant_type: "authorization_code" });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  const j = await r.json();
  if (!j.refresh_token) return html("No refresh_token (ensure access_type=offline & prompt=consent)");

  const sealed_refresh_token = await seal(JSON.stringify(j));
  const supabase = svc();
  const { error } = await supabase.from("oauth_tokens").upsert({
    user_id: state, provider: "google", sealed_refresh_token, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });

  if (error) return html("DB error: " + error.message);
  return html("Success");
});
