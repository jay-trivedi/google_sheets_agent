import "./setup.ts";
import { anonKey, functionsBaseUrl } from "./helpers.ts";

Deno.test("plan endpoint stores context snapshot", async () => {
  const base = functionsBaseUrl();
  const runId = crypto.randomUUID();
  const res = await fetch(new URL("/plan", base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anonKey() ? { Authorization: `Bearer ${anonKey()}`, apikey: anonKey() } : {})
    },
    body: JSON.stringify({
      sessionId: "session-test",
      spreadsheetId: "sheet-test",
      runId,
      sheetContext: {
        spreadsheetId: "sheet-test",
        sheetId: 1,
        sheetName: "Sheet1",
        activeRangeA1: "A1",
        activeRowCount: 1,
        activeColumnCount: 1,
        headers: [],
        sample: [[]]
      }
    })
  });

  if (res.status === 404) {
    console.warn("plan function not deployed; skipping assertion");
    await res.text();
    return;
  }

  if (!res.ok) {
    throw new Error(`Unexpected status ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (!json?.ok) {
    throw new Error(`plan response missing ok flag: ${JSON.stringify(json)}`);
  }
  if (json?.message !== "Context captured") {
    throw new Error(`plan response missing context message: ${JSON.stringify(json)}`);
  }
});
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
