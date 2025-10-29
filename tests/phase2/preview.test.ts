import { beforeAll, describe, expect, it } from "vitest";
import { google } from "googleapis";
import { config } from "dotenv";
import { randomUUID } from "crypto";

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
      // fall through
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

const allMissing = [...missingCore, ...additionalMissing];

if (allMissing.length > 0) {
  describe.skip("Phase 2 preview integration", () => {
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
  const functionsBase = resolveFunctionsBase()!;

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SB_ANON_KEY;
  if (anonKey) {
    headers.Authorization = `Bearer ${anonKey}`;
    headers.apikey = anonKey;
  }

  describe("Phase 2 preview integration", () => {
    beforeAll(async () => {
      await jwt.authorize();
    }, 30000);

    it(
      "returns summary for hello preview",
      async () => {
        const { data } = await script.scripts.run({
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

        const context = data?.response?.result?.context;
        expect(context, "Apps Script context unavailable").toBeTruthy();

        const sessionId = randomUUID();
        const runId = randomUUID();
        const todoId = randomUUID();

        const res = await fetch(`${functionsBase}/preview`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            sessionId,
            spreadsheetId: context.spreadsheetId,
            runId,
            todoId,
            context
          })
        });

        const json = await res.json();
        expect(res.ok, `Preview failed: ${JSON.stringify(json)}`).toBe(true);
        expect(json?.ok).toBe(true);
        expect(json?.preview?.changeCount).toBe(1);
        expect(json?.preview?.changes?.[0]?.after).toBe("hello");
      },
      60000
    );
  });
}
