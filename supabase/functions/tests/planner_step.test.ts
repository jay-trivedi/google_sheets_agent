/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
import "./setup.ts";
import { anonKey, functionsBaseUrl } from "./helpers.ts";

Deno.test("planner step seeds and promotes todos", async () => {
  const base = functionsBaseUrl();
  const sessionId = `session-${crypto.randomUUID()}`;
  const spreadsheetId = `sheet-${crypto.randomUUID()}`;
  const runId = crypto.randomUUID();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(anonKey() ? { Authorization: `Bearer ${anonKey()}`, apikey: anonKey() } : {}),
  };

  const res = await fetch(new URL("/planner", base), {
    method: "POST",
    headers,
    body: JSON.stringify({
      sessionId,
      spreadsheetId,
      runId,
      instruction: "Draft summary of recent revenue",
    }),
  });

  if (res.status === 404) {
    console.warn("planner function not deployed; skipping assertion");
    await res.text();
    return;
  }

  if (!res.ok) {
    throw new Error(`Unexpected status ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (!json?.ok) {
    throw new Error(`planner response missing ok flag: ${JSON.stringify(json)}`);
  }
  if (!json?.todo?.id) {
    throw new Error(`planner response missing todo payload: ${JSON.stringify(json)}`);
  }
  if (!Array.isArray(json.todos) || json.todos.length === 0) {
    throw new Error(`planner response missing todos list: ${JSON.stringify(json)}`);
  }
  if (json.todo.status !== "in_progress") {
    throw new Error(`planner todo not promoted to in_progress: ${JSON.stringify(json.todo)}`);
  }
});
/// <reference lib="deno.ns" />
