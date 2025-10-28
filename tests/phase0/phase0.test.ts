import { describe, expect, it, beforeAll } from "vitest";
import { google } from "googleapis";
import { config } from "dotenv";

config({ path: ".env.local" });

type ContextResponse = {
  ok: boolean;
  context: {
    spreadsheetId: string;
    sheetId: number;
    sheetName: string;
    activeRangeA1: string;
    activeRowCount: number;
    activeColumnCount: number;
    headers: readonly string[];
    sample: readonly (readonly unknown[])[];
  };
};

const requiredEnv = [
  "GAS_CLIENT_EMAIL",
  "GAS_PRIVATE_KEY",
  "GAS_SCRIPT_ID",
  "PHASE0_SPREADSHEET_ID",
  "GAS_IMPERSONATE_EMAIL"
] as const;

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  describe.skip("Phase 0 integration", () => {
    it.skip(`skipped because missing env vars: ${missing.join(", ")}`, () => {
      // noop
    });
  });
} else {
  const privateKey = (process.env.GAS_PRIVATE_KEY as string).replace(/\\n/g, "\n");
  const scriptId = process.env.GAS_SCRIPT_ID as string;
  const spreadsheetId = process.env.PHASE0_SPREADSHEET_ID as string;
  const sheetName = process.env.PHASE0_SHEET_NAME || undefined;
  const rangeOverride = process.env.PHASE0_TARGET_RANGE || undefined;
  const expectedHeaders = (process.env.PHASE0_EXPECTED_HEADERS || "")
    .split("|")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => {
      const maybeNumber = Number(h);
      return Number.isNaN(maybeNumber) ? h : maybeNumber;
    });
  const expectedSample = (() => {
    const raw = process.env.PHASE0_EXPECTED_SAMPLE;
    if (!raw) return undefined;
    const trimmed = raw.trim();
    const candidates = [trimmed];
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      candidates.push(trimmed.slice(1, -1));
    }
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        return JSON.parse(candidate) as unknown[][];
      } catch {
        // try next candidate
      }
    }
    throw new Error(`PHASE0_EXPECTED_SAMPLE is not valid JSON: ${raw}`);
  })();
  const expectedRange = process.env.PHASE0_EXPECTED_ACTIVE_RANGE || undefined;

  const scopes = [
    "https://www.googleapis.com/auth/script.projects",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/spreadsheets"
  ];

  const impersonate = process.env.GAS_IMPERSONATE_EMAIL;

  const jwt = new google.auth.JWT({
    email: process.env.GAS_CLIENT_EMAIL,
    key: privateKey,
    scopes,
    subject: impersonate
  });

  const script = google.script({ version: "v1", auth: jwt });

  describe("Phase 0 integration", () => {
    beforeAll(async () => {
      await jwt.authorize();
    }, 30000);

    it(
      "returns sheet context for seed sheet",
      async () => {
        const requestBody: Record<string, unknown> = {
          function: "apiGetContext",
          parameters: [
            {
              spreadsheetId,
              sheetName,
              rangeA1: rangeOverride
            }
          ]
        };

        const { data } = await script.scripts.run({
          scriptId,
          requestBody: {
            ...requestBody,
            devMode: true
          }
        });

        const result = data?.response?.result as ContextResponse | undefined;
        expect(result, "Apps Script did not return a result").toBeTruthy();
        expect(result?.ok).toBe(true);
        expect(result?.context?.spreadsheetId).toBe(spreadsheetId);
        if (sheetName) {
          expect(result?.context?.sheetName).toBe(sheetName);
        }
        if (expectedRange) {
          expect(result?.context?.activeRangeA1).toBe(expectedRange);
        }
        if (expectedHeaders.length > 0) {
          expect(result?.context?.headers).toEqual(expectedHeaders);
        }
        if (expectedSample) {
          expect(result?.context?.sample.slice(0, expectedSample.length)).toEqual(expectedSample);
        }
      },
      60000
    );
  });
}
