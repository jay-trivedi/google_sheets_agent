/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
import "./setup.ts";
import { anonKey, functionsBaseUrl } from "./helpers.ts";

Deno.test("agent messages endpoint persists and lists entries", async () => {
  const base = functionsBaseUrl();
  const sessionId = `session-${crypto.randomUUID()}`;
  const spreadsheetId = `sheet-${crypto.randomUUID()}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(anonKey() ? { Authorization: `Bearer ${anonKey()}`, apikey: anonKey() } : {}),
  };

  const postRes = await fetch(new URL("/agent_messages", base), {
    method: "POST",
    headers,
    body: JSON.stringify({
      sessionId,
      spreadsheetId,
      role: "user",
      content: "Hello from Deno test",
    }),
  });

  if (postRes.status === 404) {
    console.warn("agent/messages function not deployed; skipping assertion");
    await postRes.text();
    return;
  }

  if (!postRes.ok) {
    throw new Error(`Unexpected status ${postRes.status}: ${await postRes.text()}`);
  }

  const listRes = await fetch(
    new URL(`/agent_messages?sessionId=${encodeURIComponent(sessionId)}&spreadsheetId=${encodeURIComponent(spreadsheetId)}`, base),
    { headers },
  );
  if (!listRes.ok) {
    throw new Error(`Unexpected status ${listRes.status}: ${await listRes.text()}`);
  }
  const json = await listRes.json();
  if (!json?.ok) {
    throw new Error(`messages response missing ok flag: ${JSON.stringify(json)}`);
  }
  const message = json?.messages?.[0];
  if (!message || message.content !== "Hello from Deno test") {
    throw new Error(`messages response missing inserted entry: ${JSON.stringify(json)}`);
  }
});
/// <reference lib="deno.ns" />
