import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { listAgentEvents } from "../../../packages/realtime/src/agent_events.ts";

httpServe(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const after = url.searchParams.get("after");
  const limit = Number(url.searchParams.get("limit") ?? "50");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId required" }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  const events = listAgentEvents(sessionId, after ?? undefined, Math.min(200, Math.max(1, limit)));

  return new Response(JSON.stringify({ ok: true, events }), {
    status: 200,
    headers: cors(req, { "Content-Type": "application/json" }),
  });
});
