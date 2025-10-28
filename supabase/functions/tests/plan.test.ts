/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
import "./setup.ts";
import { anonKey, functionsBaseUrl } from "./helpers.ts";

Deno.test("plan endpoint echoes payload", async () => {
  const base = functionsBaseUrl();
  const res = await fetch(new URL("/plan", base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anonKey() ? { Authorization: `Bearer ${anonKey()}`, apikey: anonKey() } : {})
    },
    body: JSON.stringify({ instruction: "ping", from: "deno-test" })
  });

  if (!res.ok) {
    if (res.status === 404) {
      console.warn("plan function not deployed; skipping assertion");
      await res.text();
      return;
    }
    throw new Error(`Unexpected status ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (!json?.ok) {
    throw new Error(`plan response missing ok flag: ${JSON.stringify(json)}`);
  }
  if (json?.echo?.instruction !== "ping") {
    throw new Error(`plan response missing echo payload: ${JSON.stringify(json)}`);
  }
});
/// <reference lib="deno.ns" />
