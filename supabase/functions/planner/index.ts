import { serve as httpServe } from "https://deno.land/std@0.224.0/http/server.ts";
import { cors } from "../_shared/cors.ts";
import { svc } from "../_shared/db.ts";
import { createEventTracker } from "../_shared/events.ts";
import { isRunCancelled, appendAgentEvent } from "../../../packages/realtime/src/agent_events.ts";
import {
  insertPlannerTodo,
  listPlannerTodos,
  updatePlannerTodoStatus,
  PlannerTodoRow,
} from "../../../packages/repositories/src/planner_todos_repo.ts";

type PlannerStepRequest = {
  sessionId: string;
  spreadsheetId: string;
  runId: string;
  instruction?: string;
};

type PlannerTodoPayload = {
  id: string;
  title: string;
  status: string;
  order_index: number;
};

function mapTodos(rows: PlannerTodoRow[]): PlannerTodoPayload[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    order_index: row.order_index,
  }));
}

function normalizeInstruction(instruction?: string): string {
  if (!instruction || typeof instruction !== "string") {
    return "Review latest request";
  }
  const trimmed = instruction.trim();
  return trimmed.length === 0 ? "Review latest request" : trimmed;
}

httpServe(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  let body: PlannerStepRequest;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON body", details: String(error) }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  const sessionId = body?.sessionId;
  const spreadsheetId = body?.spreadsheetId;
  const runId = body?.runId;
  if (!sessionId || !spreadsheetId || !runId) {
    return new Response(JSON.stringify({ error: "sessionId, spreadsheetId, runId required" }), {
      status: 400,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  const tracker = createEventTracker(sessionId, spreadsheetId, runId);

  if (isRunCancelled(runId)) {
    appendAgentEvent({
      type: "cancelled",
      sessionId,
      spreadsheetId,
      runId,
      timestamp: new Date().toISOString(),
      payload: { note: "Planner step skipped due to cancellation." },
    });
    return new Response(JSON.stringify({ ok: false, cancelled: true }), {
      status: 409,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  const supabase = svc();
  const instruction = normalizeInstruction(body.instruction);

  let todos: PlannerTodoRow[];
  try {
    todos = await listPlannerTodos(supabase, { sessionId });
  } catch (error) {
    console.error("Failed to list planner todos", error);
    return new Response(JSON.stringify({ error: "Failed to load todos" }), {
      status: 500,
      headers: cors(req, { "Content-Type": "application/json" }),
    });
  }

  const existingInProgress = todos.find((todo) => todo.status === "in_progress");
  const existingPending = todos.find((todo) => todo.status === "pending");
  const nextOrderIndex = todos.length === 0 ? 0 : Math.max(...todos.map((todo) => todo.order_index ?? 0)) + 1;

  let workingTodo: PlannerTodoRow | null = existingInProgress ?? null;

  if (!workingTodo) {
    if (existingPending) {
      try {
        workingTodo = await updatePlannerTodoStatus(supabase, { id: existingPending.id, status: "in_progress" });
      } catch (error) {
        console.error("Failed to promote pending todo", error);
        return new Response(JSON.stringify({ error: "Failed to update todo status" }), {
          status: 500,
          headers: cors(req, { "Content-Type": "application/json" }),
        });
      }
    } else {
      try {
        workingTodo = await insertPlannerTodo(supabase, {
          session_id: sessionId,
          spreadsheet_id: spreadsheetId,
          title: instruction,
          status: "in_progress",
          order_index: nextOrderIndex,
        });
      } catch (error) {
        console.error("Failed to insert planner todo", error);
        return new Response(JSON.stringify({ error: "Failed to create todo" }), {
          status: 500,
          headers: cors(req, { "Content-Type": "application/json" }),
        });
      }
    }
  }

  todos = await listPlannerTodos(supabase, { sessionId });
  const todosPayload = mapTodos(todos);

  await tracker.record("todo_update", { todos: todosPayload });
  if (workingTodo) {
    await tracker.record("plan_started", {
      todoId: workingTodo.id,
      title: workingTodo.title,
      requiresApproval: false,
      status: workingTodo.status,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      todo: workingTodo ? {
        id: workingTodo.id,
        title: workingTodo.title,
        status: workingTodo.status,
        order_index: workingTodo.order_index,
      } : null,
      todos: todosPayload,
    }),
    {
      status: 200,
      headers: cors(req, { "Content-Type": "application/json" }),
    },
  );
});
