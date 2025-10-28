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
    throw new Error(`Unexpected status ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (!json?.ok) {
    throw new Error(`plan response missing ok flag: ${JSON.stringify(json)}`);
  }
});
