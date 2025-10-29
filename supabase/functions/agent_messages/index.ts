import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { svc } from "../_shared/db.ts";

const VALID_ROLES = new Set(["user", "agent", "event"]);

httpServe(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }

  const supabase = svc();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const spreadsheetId = url.searchParams.get("spreadsheetId");
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));

    if (!sessionId || !spreadsheetId) {
      return new Response(JSON.stringify({ error: "sessionId and spreadsheetId required" }), {
        status: 400,
        headers: cors(req, { "Content-Type": "application/json" }),
      });
    }

    const { data, error } = await supabase
      .from("agent_messages")
      .select("id, role, content, metadata, created_at")
      .eq("session_id", sessionId)
      .eq("spreadsheet_id", spreadsheetId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: cors(req, { "Content-Type": "application/json" }),
      });
    }

    return new Response(JSON.stringify({ ok: true, messages: data ?? [] }), {
      status: 200,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  if (req.method === "POST") {
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
    const role = body?.role;
    const content = body?.content;
    const metadata = body?.metadata ?? null;

    if (!sessionId || !spreadsheetId || !role || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "sessionId, spreadsheetId, role, content required" }), {
        status: 400,
        headers: cors(req, { "Content-Type": "application/json" }),
      });
    }
    if (!VALID_ROLES.has(role)) {
      return new Response(JSON.stringify({ error: `role must be one of ${Array.from(VALID_ROLES).join(", ")}` }), {
        status: 400,
        headers: cors(req, { "Content-Type": "application/json" }),
      });
    }

    const { data, error } = await supabase
      .from("agent_messages")
      .insert({
        session_id: sessionId,
        spreadsheet_id: spreadsheetId,
        role,
        content,
        metadata,
      })
      .select("id, role, content, metadata, created_at")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: cors(req, { "Content-Type": "application/json" }),
      });
    }

    return new Response(JSON.stringify({ ok: true, message: data }), {
      status: 200,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: cors(req, { "Content-Type": "application/json" }),
  });
});
