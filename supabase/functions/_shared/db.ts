// supabase/functions/_shared/db.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export function svc() {
  const url =
    Deno.env.get("SB_URL") ??
    Deno.env.get("SUPABASE_URL") ??
    (() => { throw new Error("SB_URL/SUPABASE_URL missing"); })();

  const key =
    Deno.env.get("SB_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    (() => { throw new Error("SB_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY missing"); })();

  return createClient(url, key, { auth: { persistSession: false } });
}
