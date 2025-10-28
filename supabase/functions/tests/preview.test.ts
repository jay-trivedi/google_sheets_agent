/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
import "./setup.ts";
import { anonKey, functionsBaseUrl } from "./helpers.ts";

Deno.test("preview endpoint reports hello diff", async () => {
  const base = functionsBaseUrl();
  const res = await fetch(new URL("/preview", base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anonKey() ? { Authorization: `Bearer ${anonKey()}`, apikey: anonKey() } : {})
    },
    body: JSON.stringify({
      clientUserId: "test-user",
      context: {
        spreadsheetId: "dummy",
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
    console.warn("preview function not deployed; skipping assertion");
    await res.text();
    return;
  }

  if (!res.ok) {
    throw new Error(`Unexpected status ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (!json?.ok) {
    throw new Error(`preview response missing ok flag: ${JSON.stringify(json)}`);
  }
  if (json.preview?.changes?.[0]?.cell !== "Sheet1!B1") {
    throw new Error(`preview change target mismatch: ${JSON.stringify(json.preview)}`);
  }
});
