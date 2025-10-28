import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";
import { ensureAuditLogSheet, appendAuditRow } from "../_shared/audit_log.ts";
import { svc } from "../_shared/db.ts";
import { buildSingleCellPatch } from "../../../packages/repositories/src/patches_repo.ts";

type SheetContext = {
  spreadsheetId: string;
  sheetId: number;
  sheetName: string;
  activeRangeA1: string; // e.g., "B2:D2"
};

function colToIndex1(letter: string) {
  let n = 0; for (let i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64); return n;
}
function index1ToCol(n: number) {
  let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s;
}
function parseA1(a1: string) {
  const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i.exec(a1);
  if (!m) throw new Error("Bad A1: " + a1);
  const c1 = colToIndex1(m[1].toUpperCase());
  const r1 = parseInt(m[2], 10);
  const c2 = m[3] ? colToIndex1(m[3].toUpperCase()) : c1;
  const r2 = m[4] ? parseInt(m[4], 10) : r1;
  return { c1, r1, c2, r2, width: c2 - c1 + 1, height: r2 - r1 + 1 };
}

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

  // Compute target cell (right of selection, first row)
  const { c1, r1, width } = parseA1(context.activeRangeA1);
  const targetCol1 = c1 + width;
  const targetA1 = `${index1ToCol(targetCol1)}${r1}`;

  // Ensure columns exist
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${context.spreadsheetId}?fields=sheets(properties(sheetId,title,gridProperties(columnCount)))`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  const sheetProps = meta.sheets.find((s: any) => s.properties.sheetId === context.sheetId)?.properties;
  if (!sheetProps) throw new Error("Sheet not found");
  const colCount = sheetProps.gridProperties.columnCount as number;

  if (targetCol1 > colCount) {
    const insertCount = targetCol1 - colCount;
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

  const rangeWithSheet = context.sheetName ? `${context.sheetName}!${targetA1}` : targetA1;
  const beforeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${context.spreadsheetId}/values/${encodeURIComponent(rangeWithSheet)}?majorDimension=ROWS`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  const beforeJson = beforeRes.ok ? await beforeRes.json() : {};
  const beforeValues = Array.isArray(beforeJson.values) && beforeJson.values.length > 0 ? beforeJson.values : [[""]];

  // Write the value
  const updateBody = { values: [["hello"]] };
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
