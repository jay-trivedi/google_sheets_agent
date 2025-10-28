import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { svc } from "../_shared/db.ts";
import { cors } from "../_shared/cors.ts";
import { open } from "../_shared/crypto.ts";

type SheetContext = {
  spreadsheetId: string;
  sheetId: number;
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

async function refreshAccessToken(refresh_token: string) {
  const client_id = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const client_secret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const body = new URLSearchParams({ client_id, client_secret, grant_type: "refresh_token", refresh_token });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Failed to refresh token: " + JSON.stringify(j));
  return j.access_token as string;
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

  const supabase = svc();
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("sealed_refresh_token")
    .eq("user_id", clientUserId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors(req, { "Content-Type": "application/json" }) });
  if (!data) return new Response(JSON.stringify({ error: "No token for user. Connect Google first." }), { status: 401, headers: cors(req, { "Content-Type": "application/json" }) });

  const refreshToken = await open(data.sealed_refresh_token);
  const accessToken = await refreshAccessToken(refreshToken);

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

  // Write the value
  const updateBody = { values: [["hello"]] };
  const r2 = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${context.spreadsheetId}/values/${encodeURIComponent(targetA1)}:update?valueInputOption=RAW`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(updateBody),
  });
  const j2 = await r2.json();

  return new Response(JSON.stringify({ ok: true, wroteA1: targetA1, update: j2 }), {
    status: 200, headers: cors(req, { "Content-Type": "application/json" }),
  });
});
