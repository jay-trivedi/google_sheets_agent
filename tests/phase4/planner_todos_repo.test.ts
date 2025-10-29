import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { config } from "dotenv";
import { randomUUID } from "crypto";

import {
  insertPlannerTodo,
  listPlannerTodos,
  updatePlannerTodoStatus
} from "../../packages/repositories/src/planner_todos_repo.ts";

config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.SB_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;

type SupabaseRows<T> = { data: T; error: null };

if (!supabaseUrl || !serviceKey) {
  describe.skip("planner todos repository integration", () => {
    it.skip("skipped because Supabase environment variables are missing", () => {
      // no-op
    });
  });
} else {
  const restBase = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

  async function supabaseRest<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${restBase}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase REST ${method} ${path} failed (${res.status}): ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  function makeClient() {
    return {
      from(table: string) {
        return {
          select(_columns: string) {
            return {
              eq(column: string, value: string) {
                return {
                  order(orderColumn: string, opts: { ascending: boolean }) {
                    const orderDir = opts?.ascending === false ? "desc" : "asc";
                    return supabaseRest<any[]>(
                      "GET",
                      `/${table}?select=*&${column}=eq.${value}&order=${orderColumn}.${orderDir}`
                    ).then((data) => ({ data, error: null } satisfies SupabaseRows<any[]>));
                  }
                };
              }
            };
          },
          insert(payload: unknown) {
            return {
              select(_columns: string) {
                return {
                  single() {
                    return supabaseRest<any[]>("POST", `/${table}`, payload).then((rows) => ({
                      data: rows[0],
                      error: null
                    }));
                  }
                };
              }
            };
          },
          update(payload: unknown) {
            return {
              eq(column: string, value: string) {
                return {
                  select(_columns: string) {
                    return {
                      single() {
                        return supabaseRest<any[]>("PATCH", `/${table}?${column}=eq.${value}`, payload).then(
                          (rows) => ({
                            data: rows[0],
                            error: null
                          })
                        );
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
    };
  }

  const supabaseClient = makeClient();

  const spreadsheetId = randomUUID();
  let sessionCounter = 0;
  const nextSessionId = () => `${randomUUID()}-${sessionCounter++}`;

  const cleanupSessions: string[] = [];

  async function clearSession(sessionId: string) {
    await supabaseRest("DELETE", `/planner_todos?session_id=eq.${sessionId}`);
  }

  afterAll(async () => {
    for (const sessionId of cleanupSessions) {
      await clearSession(sessionId);
    }
  });

  describe("planner todos repository integration", () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = nextSessionId();
      cleanupSessions.push(sessionId);
      await clearSession(sessionId);
    });

    it("inserts and lists todos in order", async () => {
      const first = await insertPlannerTodo(supabaseClient as any, {
        session_id: sessionId,
        spreadsheet_id: spreadsheetId,
        title: "Collect sheet schema"
      });

      const second = await insertPlannerTodo(supabaseClient as any, {
        session_id: sessionId,
        spreadsheet_id: spreadsheetId,
        title: "Draft summary deck",
        status: "blocked",
        order_index: 5
      });

      expect(first.status).toBe("pending");
      expect(first.order_index).toBe(0);
      expect(second.status).toBe("blocked");
      expect(second.order_index).toBe(5);

      const list = await listPlannerTodos(supabaseClient as any, { sessionId });
      expect(list.map((row) => row.title)).toEqual(["Collect sheet schema", "Draft summary deck"]);
      expect(list[1]?.status).toBe("blocked");
      expect(list[1]?.order_index).toBe(5);
    });

    it("updates todo status", async () => {
      const todo = await insertPlannerTodo(supabaseClient as any, {
        session_id: sessionId,
        spreadsheet_id: spreadsheetId,
        title: "Validate preview diff"
      });

      const updated = await updatePlannerTodoStatus(supabaseClient as any, { id: todo.id, status: "done" });
      expect(updated.status).toBe("done");

      const list = await listPlannerTodos(supabaseClient as any, { sessionId });
      const fetched = list.find((row) => row.id === todo.id);
      expect(fetched?.status).toBe("done");
    });
  });
}
