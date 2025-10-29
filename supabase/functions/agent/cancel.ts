import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { cancelRun, appendAgentEvent } from "../../../packages/realtime/src/agent_events.ts";

httpServe(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON body", details: String(error) }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  const sessionId = body?.sessionId;
  const spreadsheetId = body?.spreadsheetId;
  const runId = body?.runId;
  if (!sessionId || !spreadsheetId || !runId) {
    return new Response(JSON.stringify({ error: "sessionId, spreadsheetId, runId required" }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  cancelRun(runId);
  appendAgentEvent({
    type: "cancelled",
    sessionId,
    spreadsheetId,
    runId,
    timestamp: new Date().toISOString(),
    payload: { note: "Run cancelled by user." },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: cors(req, { "Content-Type": "application/json" }),
  });
});
