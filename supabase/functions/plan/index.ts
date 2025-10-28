// supabase/functions/plan/index.ts
import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
httpServe(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  let payload=null; try { if (req.method==="POST") payload = await req.json(); } catch {}
  return new Response(JSON.stringify({ ok:true, echo: payload, time: new Date().toISOString() }), {
    status: 200, headers: cors(req, { "Content-Type":"application/json" }),
  });
});
