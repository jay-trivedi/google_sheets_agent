import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { computeLocalHelloPreview } from "../../../packages/preview/src/preview.ts";

httpServe(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors(req) });

  let payload: any = null;
  try {
    payload = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body", details: String(err) }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  const context = payload?.context;
  if (!context) {
    return new Response(JSON.stringify({ error: "context is required" }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  try {
    const preview = computeLocalHelloPreview(context);
    return new Response(JSON.stringify({ ok: true, preview }), {
      status: 200,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }
});
