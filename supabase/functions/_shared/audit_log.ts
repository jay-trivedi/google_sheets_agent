const AUDIT_SHEET_TITLE = "AI_AUDIT_LOG";
const AUDIT_HEADERS = ["timestamp", "action", "patchId", "userId", "range", "before", "after"];

async function addAuditSheet(accessToken: string, spreadsheetId: string) {
  const batchBody = {
    requests: [
      {
        addSheet: {
          properties: {
            title: AUDIT_SHEET_TITLE
          }
        }
      }
    ]
  };
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(batchBody)
  });
  if (!res.ok) {
    const text = await res.text();
    if (!text.includes("ALREADY_EXISTS") && !text.includes("already exists")) {
      throw new Error(`Failed to ensure audit log sheet: ${text}`);
    }
  }
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${AUDIT_SHEET_TITLE}!A1:G1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: [AUDIT_HEADERS] })
    }
  );
  if (!headerRes.ok) {
    const text = await headerRes.text();
    throw new Error(`Failed to write audit headers: ${text}`);
  }
}

export async function ensureAuditLogSheet(accessToken: string, spreadsheetId: string, meta?: any) {
  let sheetsMeta = meta;
  if (!sheetsMeta) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    sheetsMeta = await res.json();
  }
  const hasSheet = sheetsMeta?.sheets?.some((s: any) => s.properties?.title === AUDIT_SHEET_TITLE);
  if (hasSheet) return;
  await addAuditSheet(accessToken, spreadsheetId);
}

export async function appendAuditRow(accessToken: string, spreadsheetId: string, row: string[]) {
  const range = `${AUDIT_SHEET_TITLE}!A:G`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to append audit log row: ${text}`);
  }
}

export { AUDIT_SHEET_TITLE, AUDIT_HEADERS };
