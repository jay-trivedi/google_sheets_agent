/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
export function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(
      `Missing ${key}. Set it in your environment (e.g., via .env.local) before running Supabase function tests.`
    );
  }
  return value;
}

export function functionsBaseUrl(): URL {
  const direct = Deno.env.get("SUPABASE_FUNCTIONS_URL");
  if (direct) {
    return new URL(direct.replace(/\/$/, ""));
  }

  const base = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
  if (!base) {
    throw new Error(
      "Missing SUPABASE_FUNCTIONS_URL or SUPABASE_URL/SB_URL. Set one before running Supabase function tests."
    );
  }

  const url = new URL(base);
  const host = url.hostname;
  let resolved: string;

  if (host === "localhost" || host === "127.0.0.1") {
    resolved = `${url.protocol}//${host}:${url.port || "54321"}/functions/v1`;
  } else if (host.endsWith(".supabase.co")) {
    const fnHost = host.replace(/\.supabase\.co$/, ".functions.supabase.co");
    resolved = `${url.protocol}//${fnHost}`;
  } else {
    resolved = `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}/functions/v1`;
  }

  return new URL(resolved.replace(/\/$/, ""));
}

export function anonKey(): string | undefined {
  return Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_ANON_KEY");
}
/// <reference lib="deno.ns" />
