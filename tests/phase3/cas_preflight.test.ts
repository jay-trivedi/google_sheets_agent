import { beforeAll, describe, expect, it } from "vitest";
import { google } from "googleapis";
import { config } from "dotenv";

config({ path: ".env.local" });

const requiredEnv = ["GAS_CLIENT_EMAIL", "GAS_PRIVATE_KEY", "GAS_SCRIPT_ID", "GAS_IMPERSONATE_EMAIL"] as const;

function resolveFunctionsBase(): string | null {
  const direct = process.env.SUPABASE_FUNCTIONS_URL;
  if (direct) return direct.replace(/\/$/, "");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.SB_URL;
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      const host = parsed.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        const port = parsed.port || "54321";
        return `${parsed.protocol}//${host}:${port}/functions/v1`.replace(/\/$/, "");
      }
      if (host.endsWith(".supabase.co")) {
        const fnHost = host.replace(/\.supabase\.co$/, ".functions.supabase.co");
        return `${parsed.protocol}//${fnHost}`.replace(/\/$/, "");
      }
      return `${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ""}/functions/v1`.replace(/\/$/, "");
    } catch {
      // ignore parse errors
    }
  }

  const ref = process.env.SB_PROJECT_REF || process.env.SUPABASE_PROJECT_REF;
  if (ref) {
    return `https://${ref}.functions.supabase.co`;
  }
  return null;
}

const missingCore = requiredEnv.filter((key) => !process.env[key]);
const spreadsheetId = process.env.PHASE1_SPREADSHEET_ID || process.env.PHASE0_SPREADSHEET_ID;
const sheetName = process.env.PHASE1_SHEET_NAME || process.env.PHASE0_SHEET_NAME;
const targetRange = process.env.PHASE1_TARGET_RANGE || "A1";

const additionalMissing: string[] = [];
if (!spreadsheetId) additionalMissing.push("PHASE1_SPREADSHEET_ID or PHASE0_SPREADSHEET_ID");
if (!sheetName) additionalMissing.push("PHASE1_SHEET_NAME or PHASE0_SHEET_NAME");
if (!resolveFunctionsBase()) additionalMissing.push("SUPABASE_FUNCTIONS_URL or SB_URL/SUPABASE_URL/SB_PROJECT_REF");

const clientUserId = process.env.PHASE1_CLIENT_USER_ID || process.env.PHASE0_CLIENT_USER_ID || process.env.TEST_CLIENT_USER_ID;
if (!clientUserId) additionalMissing.push("PHASE1_CLIENT_USER_ID (or fallback)");

const allMissing = [...missingCore, ...additionalMissing];

if (allMissing.length > 0) {
  describe.skip("Phase 3 CAS integration", () => {
    it.skip(`skipped because missing env vars: ${allMissing.join(", ")}`, () => {
      // noop
    });
  });
} else {
  const privateKey = (process.env.GAS_PRIVATE_KEY as string).replace(/\\n/g, "\n");
  const scriptId = process.env.GAS_SCRIPT_ID as string;
  const impersonate = process.env.GAS_IMPERSONATE_EMAIL as string;

  const scopes = [
    "https://www.googleapis.com/auth/script.projects",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/spreadsheets"
  ];

  const jwt = new google.auth.JWT({
    email: process.env.GAS_CLIENT_EMAIL,
    key: privateKey,
    scopes,
    subject: impersonate
  });

  const script = google.script({ version: "v1", auth: jwt });
  const sheets = google.sheets({ version: "v4", auth: jwt });
  const functionsBase = resolveFunctionsBase()!;

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SB_ANON_KEY;
  if (anonKey) {
    headers.Authorization = `Bearer ${anonKey}`;
    headers.apikey = anonKey;
  }

  const seedValue = process.env.PHASE1_SEED_VALUE || "target";

  function nextColumn(a1: string): string {
    const match = /^([A-Z]+)(\d+)$/i.exec(a1.trim());
    if (!match) throw new Error(`Unsupported A1 range: ${a1}`);
    const colLetters = match[1].toUpperCase();
    const row = match[2];
    let colNumber = 0;
    for (let i = 0; i < colLetters.length; i++) {
      colNumber = colNumber * 26 + (colLetters.charCodeAt(i) - 64);
    }
    let nextLetters = "";
    let n = colNumber + 1;
    while (n > 0) {
      const rem = (n - 1) % 26;
      nextLetters = String.fromCharCode(65 + rem) + nextLetters;
      n = Math.floor((n - 1) / 26);
    }
    return `${nextLetters}${row}`;
  }

  async function waitForCellValue(range: string, expected: string, tries = 5) {
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId!,
        range: `${sheetName}!${range}`
      });
      const current = data.values?.[0]?.[0] ?? "";
      if (current === expected) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Cell ${range} did not reach expected value ${expected}`);
  }

  const targetCell = nextColumn(targetRange);

  describe("Phase 3 CAS integration", () => {
    beforeAll(async () => {
      await jwt.authorize();
    }, 30000);

    it(
      "detects stale fingerprint and succeeds after re-preview",
      async () => {
        const { data: originalCell } = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId!,
          range: `${sheetName}!${targetCell}`
        });
        const originalValues = originalCell.values ?? [];

        try {
          // Prime data for deterministic run
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: spreadsheetId!,
            requestBody: {
              valueInputOption: "RAW",
              data: [
                {
                  range: `${sheetName}!${targetRange}`,
                  values: [[seedValue]]
                },
                {
                  range: `${sheetName}!${targetCell}`,
                  values: [["primed"]]
                }
              ]
            }
          });
          await waitForCellValue(targetCell, "primed");

          const { data: contextData } = await script.scripts.run({
            scriptId,
            requestBody: {
              function: "apiGetContext",
              parameters: [
                {
                  spreadsheetId,
                  sheetName,
                  rangeA1: targetRange
                }
              ],
              devMode: true
            }
          });
          const contextResult = contextData?.response?.result as
            | { ok: boolean; context: { spreadsheetId: string; sheetId: number; sheetName: string; activeRangeA1: string } }
            | undefined;

          expect(contextResult?.ok, "Apps Script context retrieval failed").toBe(true);
          const context = contextResult!.context;

          const previewRes = await fetch(`${functionsBase}/preview`, {
            method: "POST",
            headers,
            body: JSON.stringify({ clientUserId, context })
          });
          const previewJson = await previewRes.json();
          expect(previewRes.ok, `preview failed: ${JSON.stringify(previewJson)}`).toBe(true);
          const fingerprint = previewJson?.fingerprint;
          expect(fingerprint, "preview missing fingerprint").toBeTruthy();

          // Simulate a teammate edit
          await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId!,
            range: `${sheetName}!${targetCell}`,
            valueInputOption: "RAW",
            requestBody: { values: [["teammate edit"]] }
          });
          await waitForCellValue(targetCell, "teammate edit");

          const staleApply = await fetch(`${functionsBase}/apply`, {
            method: "POST",
            headers,
            body: JSON.stringify({ clientUserId, context, fingerprint })
          });
          const staleJson = await staleApply.json();
          expect(staleApply.status).toBe(409);
          expect(staleJson?.error).toBe("E_STALE");
          expect(staleJson?.reason).toBeDefined();

          // Re-preview to grab fresh fingerprint and try again
          const secondPreviewRes = await fetch(`${functionsBase}/preview`, {
            method: "POST",
            headers,
            body: JSON.stringify({ clientUserId, context })
          });
          const secondPreviewJson = await secondPreviewRes.json();
          expect(secondPreviewRes.ok, `second preview failed: ${JSON.stringify(secondPreviewJson)}`).toBe(true);
          const freshFingerprint = secondPreviewJson?.fingerprint;
          expect(freshFingerprint, "fresh fingerprint missing").toBeTruthy();

          const applyRes = await fetch(`${functionsBase}/apply`, {
            method: "POST",
            headers,
            body: JSON.stringify({ clientUserId, context, fingerprint: freshFingerprint })
          });
          const applyJson = await applyRes.json();
          expect(applyRes.ok, `apply failed: ${JSON.stringify(applyJson)}`).toBe(true);
          expect(applyJson?.ok).toBe(true);

          await waitForCellValue(targetCell, "hello");
        } finally {
          const fallback = originalValues.length > 0 ? originalValues : [[""]];
          await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId!,
            range: `${sheetName}!${targetCell}`,
            valueInputOption: "RAW",
            requestBody: { values: fallback }
          });
        }
      },
      180000
    );
  });
}
