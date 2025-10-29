import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { computeLocalHelloPreview } from "../../../packages/preview/src/preview.ts";
import { createEventTracker } from "../_shared/events.ts";
import { isRunCancelled, appendAgentEvent } from "../../../packages/realtime/src/agent_events.ts";
import type { Fingerprint } from "../../../packages/executor/src/cas.ts";

httpServe(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: cors(req) });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON body", details: String(error) }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  const sessionId = payload?.sessionId;
  const spreadsheetId = payload?.spreadsheetId;
  const runId = payload?.runId;
  const todoId = payload?.todoId;
  const context = payload?.context;
  if (!context) {
    return new Response(JSON.stringify({ error: "context is required" }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }
  if (!sessionId || !spreadsheetId || !runId || !todoId) {
    return new Response(JSON.stringify({ error: "sessionId, spreadsheetId, runId, todoId required" }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  if (isRunCancelled(runId)) {
    appendAgentEvent({
      type: "cancelled",
      sessionId,
      spreadsheetId,
      runId,
      timestamp: new Date().toISOString(),
      payload: { note: "Preview aborted due to cancellation." },
    });
    return new Response(JSON.stringify({ ok: false, cancelled: true }), {
      status: 409,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  try {
    const preview = computeLocalHelloPreview(context);
    const tracker = createEventTracker(sessionId, spreadsheetId, runId);
    await tracker.record("plan_step_update", {
      todoId,
      summary: preview.summary,
      changeCount: preview.changeCount,
      targetRange: preview.targetRangeA1,
    });

    const fingerprint: Fingerprint = {
      range: preview.targetRangeA1,
      rowCount: Number(context.activeRowCount ?? 1),
      colCount: Number(context.activeColumnCount ?? 1),
      edgeHash: `stub:${preview.targetRangeA1}:${context.activeRowCount ?? 1}:${context.activeColumnCount ?? 1}`,
    };

    return new Response(JSON.stringify({ ok: true, preview, fingerprint }), {
      status: 200,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }
});
