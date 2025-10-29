import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { svc } from "../_shared/db.ts";
import { createEventTracker } from "../_shared/events.ts";
import { isRunCancelled, appendAgentEvent } from "../../../packages/realtime/src/agent_events.ts";

type PlanRequest = {
  sessionId: string;
  spreadsheetId: string;
  runId: string;
  sheetContext: unknown;
};

httpServe(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  let body: PlanRequest;
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
  const sheetContext = body?.sheetContext;

  if (!sessionId || !spreadsheetId || !runId || sheetContext === undefined) {
    return new Response(
      JSON.stringify({ error: "sessionId, spreadsheetId, runId, sheetContext required" }),
      {
        status: 400,
        headers: cors(req, { "Content-Type": "application/json" }),
      },
    );
  }

  const tracker = createEventTracker(sessionId, spreadsheetId, runId);

  if (isRunCancelled(runId)) {
    appendAgentEvent({
      type: "cancelled",
      sessionId,
      spreadsheetId,
      runId,
      timestamp: new Date().toISOString(),
      payload: { note: "Plan skipped due to cancellation." },
    });
    return new Response(JSON.stringify({ ok: false, cancelled: true }), {
      status: 409,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  let contextText: string;
  try {
    contextText = typeof sheetContext === "string" ? sheetContext : JSON.stringify(sheetContext);
  } catch (error) {
    return new Response(JSON.stringify({ error: "sheetContext must be serializable", details: String(error) }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  const supabase = svc();
  const { error: upsertError } = await supabase
    .from("session_sheet_context")
    .upsert(
      {
        session_id: sessionId,
        spreadsheet_id: spreadsheetId,
        context_text: contextText,
      },
      { onConflict: "session_id,spreadsheet_id" },
    );

  if (upsertError) {
    return new Response(
      JSON.stringify({ error: "Failed to persist sheet context", details: upsertError.message }),
      {
        status: 500,
        headers: cors(req, { "Content-Type": "application/json" }),
      },
    );
  }

  await tracker.record("info", { message: "Context captured" });

  return new Response(
    JSON.stringify({
      ok: true,
      message: "Context captured",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: cors(req, { "Content-Type": "application/json" }),
    },
  );
});
