import { svc } from "./db.ts";
import { open } from "./crypto.ts";

async function refreshAccessToken(refresh_token: string) {
  const client_id = Deno.env.get("GOOGLE_CLIENT_ID");
  const client_secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!client_id || !client_secret) {
    throw new Error("Missing Google OAuth client credentials");
  }
  const body = new URLSearchParams({ client_id, client_secret, grant_type: "refresh_token", refresh_token });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Failed to refresh token: " + JSON.stringify(j));
  return j.access_token as string;
}

export async function getAccessTokenForUser(userId: string): Promise<{ accessToken: string; refreshToken: string; tokenJson: any }>
{
  if (!userId) throw new Error("clientUserId required");
  const supabase = svc();
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("sealed_refresh_token")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("No token for user. Connect Google first.");

  const sealed = await open(data.sealed_refresh_token);
  let refreshToken: string | null = null;
  let tokenJson: any = null;
  try {
    tokenJson = JSON.parse(sealed);
    refreshToken = tokenJson?.refresh_token ?? null;
  } catch {
    refreshToken = sealed;
  }
  if (!refreshToken) {
    throw new Error("Stored token missing refresh_token");
  }
  const accessToken = await refreshAccessToken(refreshToken);
  return { accessToken, refreshToken, tokenJson };
}
