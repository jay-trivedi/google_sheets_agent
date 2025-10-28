import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { svc } from "../_shared/db.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";
import { appendAuditRow, ensureAuditLogSheet } from "../_shared/audit_log.ts";
import { markUndo, PatchState } from "../../../packages/repositories/src/patches_repo.ts";

httpServe(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors(req) });

  let body: any;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON body", details: String(error) }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  const clientUserId = body?.clientUserId;
  const patchId = body?.patchId;
  if (!clientUserId || !patchId) {
    return new Response(JSON.stringify({ error: "clientUserId and patchId required" }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  const supabase = svc();
  const { data: patch, error } = await supabase
    .from("patches")
    .select("id, spreadsheet_id, user_id, before_state, after_state")
    .eq("id", patchId)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }
  if (!patch) {
    return new Response(JSON.stringify({ error: "Patch not found" }), {
      status: 404,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }
  if (patch.user_id !== clientUserId) {
    return new Response(JSON.stringify({ error: "Patch belongs to a different user" }), {
      status: 403,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  const afterState = patch.after_state as PatchState | null;
  if (afterState?.undo?.undoneAt) {
    return new Response(JSON.stringify({ error: "Patch already undone" }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  const beforeState = patch.before_state as PatchState | null;
  const restoreRange = beforeState?.range || afterState?.range;
  if (!restoreRange) {
    return new Response(JSON.stringify({ error: "Patch does not include a target range" }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }
  const restoreValues = beforeState?.values ?? [[""]];

  let accessToken: string;
  try {
    const tokenInfo = await getAccessTokenForUser(clientUserId);
    accessToken = tokenInfo.accessToken;
  } catch (tokenError) {
    return new Response(JSON.stringify({ error: tokenError instanceof Error ? tokenError.message : String(tokenError) }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${patch.spreadsheet_id}/values/${encodeURIComponent(restoreRange)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: restoreValues })
    }
  );
  const updateJson = await updateRes.json();
  if (!updateRes.ok) {
    return new Response(JSON.stringify({ error: "Failed to restore range", details: updateJson }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  const undoneAt = new Date().toISOString();
  const newAfterState = markUndo(afterState, undoneAt);
  const { error: updateError } = await supabase
    .from("patches")
    .update({ after_state: newAfterState })
    .eq("id", patchId);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  try {
    await ensureAuditLogSheet(accessToken, patch.spreadsheet_id);
    await appendAuditRow(accessToken, patch.spreadsheet_id, [
      undoneAt,
      "undo",
      patchId,
      clientUserId,
      restoreRange,
      JSON.stringify(afterState?.values ?? []),
      JSON.stringify(restoreValues)
    ]);
  } catch (auditError) {
    console.warn("Failed to append undo audit row:", auditError);
  }

  return new Response(JSON.stringify({ ok: true, patchId, restoredRange: restoreRange, update: updateJson }), {
    status: 200,
    headers: cors(req, { "Content-Type": "application/json" })
  });
});
