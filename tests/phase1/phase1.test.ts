import { beforeAll, describe, expect, it } from "vitest";
import { google } from "googleapis";
import { config } from "dotenv";

config({ path: ".env.local" });

const requiredEnv = [
  "GAS_CLIENT_EMAIL",
  "GAS_PRIVATE_KEY",
  "GAS_SCRIPT_ID",
  "GAS_IMPERSONATE_EMAIL"
] as const;

const missingCore = requiredEnv.filter((key) => !process.env[key]);

const spreadsheetId = process.env.PHASE1_SPREADSHEET_ID || process.env.PHASE0_SPREADSHEET_ID;
const sheetName = process.env.PHASE1_SHEET_NAME || process.env.PHASE0_SHEET_NAME;
const targetRange = process.env.PHASE1_TARGET_RANGE || "A1";

const additionalMissing: string[] = [];
if (!spreadsheetId) additionalMissing.push("PHASE1_SPREADSHEET_ID or PHASE0_SPREADSHEET_ID");
if (!sheetName) additionalMissing.push("PHASE1_SHEET_NAME or PHASE0_SHEET_NAME");

const allMissing = [...missingCore, ...additionalMissing];

if (allMissing.length > 0) {
  describe.skip("Phase 1 integration", () => {
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

  const expectedCell = nextColumn(targetRange);

  describe("Phase 1 integration", () => {
    beforeAll(async () => {
      await jwt.authorize();
    }, 30000);

    it(
      "writes hello next to selection via local apply",
      async () => {
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
                range: `${sheetName}!${expectedCell}`,
                values: [[""]]
              }
            ]
          }
        });

        const { data } = await script.scripts.run({
          scriptId,
          requestBody: {
            function: "applyLocalWriteHello",
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

        const result = data?.response?.result as
          | { wroteA1: string; wroteValue: string; selectionA1: string }
          | undefined;
        expect(result, "Execution API did not return a result").toBeTruthy();
        expect(result?.wroteValue).toBe("hello");

        const { data: valuesRes } = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId!,
          range: `${sheetName}!${expectedCell}`
        });
        const wroteValue = valuesRes.values?.[0]?.[0] ?? "";
        expect(wroteValue).toBe("hello");

        await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId!,
          range: `${sheetName}!${expectedCell}`,
          valueInputOption: "RAW",
          requestBody: { values: [[""]] }
        });
      },
      60000
    );
  });
}
