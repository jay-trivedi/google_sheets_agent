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
  const raw = requireEnv("SUPABASE_FUNCTIONS_URL");
  return new URL(raw.replace(/\/$/, ""));
}

export function anonKey(): string | undefined {
  return Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_ANON_KEY");
}
