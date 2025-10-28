import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";
import { ensureAuditLogSheet, appendAuditRow } from "../_shared/audit_log.ts";
import { svc } from "../_shared/db.ts";
import { parseRangeA1, adjacentRight, rangeToA1 } from "../_shared/ranges.ts";
import { buildSingleCellPatch } from "../../../packages/repositories/src/patches_repo.ts";

type SheetContext = {
  spreadsheetId: string;
  sheetId: number;
  sheetName: string;
  activeRangeA1: string; // e.g., "B2:D2"
};

httpServe(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors(req) });

  const { clientUserId, context }: { clientUserId: string; context: SheetContext } = await req.json();
  if (!clientUserId || !context) {
    return new Response(JSON.stringify({ error: "clientUserId and context required" }), {
      status: 400, headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  let accessToken: string;
  try {
    const tokenInfo = await getAccessTokenForUser(clientUserId);
    accessToken = tokenInfo.accessToken;
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  // Compute target cell(s) to the right of the selection
  const selectionRange = parseRangeA1(context.activeRangeA1);
  const targetRange = adjacentRight(selectionRange);
  const targetSingleRange = { ...targetRange, width: selectionRange.width, height: selectionRange.height };
  const targetA1 = rangeToA1(targetSingleRange, context.sheetName);
  const targetEndCol = targetSingleRange.startCol + targetSingleRange.width - 1;

  // Ensure columns exist
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${context.spreadsheetId}?fields=sheets(properties(sheetId,title,gridProperties(columnCount)))`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  const sheetProps = meta.sheets.find((s: any) => s.properties.sheetId === context.sheetId)?.properties;
  if (!sheetProps) throw new Error("Sheet not found");
  const colCount = sheetProps.gridProperties.columnCount as number;

  if (targetEndCol > colCount) {
    const insertCount = targetEndCol - colCount;
    const batchBody = {
      requests: [{
        insertDimension: {
          range: { sheetId: context.sheetId, dimension: "COLUMNS", startIndex: colCount, endIndex: colCount + insertCount },
          inheritFromBefore: true
        }
      }]
    };
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${context.spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(batchBody),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: "insert columns failed", details: t }), { status: 400, headers: cors(req, { "Content-Type": "application/json" }) });
    }
  }

  const rangeWithSheet = targetA1;
  const beforeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${context.spreadsheetId}/values/${encodeURIComponent(rangeWithSheet)}?majorDimension=ROWS`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  const beforeJson = beforeRes.ok ? await beforeRes.json() : {};
  const emptyRow = new Array(targetSingleRange.width).fill("");
  const fallbackBefore = Array.from({ length: targetSingleRange.height }, () => [...emptyRow]);
  const beforeValues = Array.isArray(beforeJson.values) && beforeJson.values.length > 0 ? beforeJson.values : fallbackBefore;
  const afterValues = Array.from({ length: targetSingleRange.height }, () => new Array(targetSingleRange.width).fill("hello"));

  const updateBody = { values: afterValues };
  const r2 = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${context.spreadsheetId}/values/${encodeURIComponent(rangeWithSheet)}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(updateBody),
  });
  const j2 = await r2.json();

  const supabase = svc();
  const patchInsert = buildSingleCellPatch({
    spreadsheetId: context.spreadsheetId,
    userId: clientUserId,
    range: rangeWithSheet,
    beforeValues,
    afterValues: updateBody.values
  });
  const { data: patchRow, error: patchError } = await supabase.from("patches").insert(patchInsert).select("id").single();
  if (patchError) {
    return new Response(JSON.stringify({ error: patchError.message }), {
      status: 500,
      headers: cors(req, { "Content-Type": "application/json" })
    });
  }

  const patchId = patchRow?.id as string;
  const timestamp = new Date().toISOString();

  try {
    await ensureAuditLogSheet(accessToken, context.spreadsheetId, meta);
    await appendAuditRow(accessToken, context.spreadsheetId, [
      timestamp,
      "apply",
      patchId,
      clientUserId,
      rangeWithSheet,
      JSON.stringify(beforeValues),
      JSON.stringify(updateBody.values)
    ]);
  } catch (auditError) {
    console.warn("Failed to append audit log:", auditError);
  }

  return new Response(JSON.stringify({ ok: true, patchId, wroteA1: targetA1, update: j2 }), {
    status: 200, headers: cors(req, { "Content-Type": "application/json" }),
  });
});
