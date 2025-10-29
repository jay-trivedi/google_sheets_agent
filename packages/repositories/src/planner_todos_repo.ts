export type PlannerTodoStatus = "pending" | "in_progress" | "blocked" | "done";

export type PlannerTodoRow = {
  id: string;
  session_id: string;
  spreadsheet_id: string;
  title: string;
  status: PlannerTodoStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type PlannerTodoInsert = {
  session_id: string;
  spreadsheet_id: string;
  title: string;
  status?: PlannerTodoStatus;
  order_index?: number;
};

type SupabaseLikeClient = {
  from(table: string): any;
};

export async function listPlannerTodos(client: SupabaseLikeClient, params: {
  sessionId: string;
}): Promise<PlannerTodoRow[]> {
  const query = client
    .from("planner_todos")
    .select("*")
    .eq("session_id", params.sessionId)
    .order("order_index", { ascending: true });
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list planner todos: ${error.message}`);
  return (data ?? []) as PlannerTodoRow[];
}

export async function insertPlannerTodo(
  client: SupabaseLikeClient,
  input: PlannerTodoInsert,
): Promise<PlannerTodoRow> {
  const { data, error } = await client
    .from("planner_todos")
    .insert({
      session_id: input.session_id,
      spreadsheet_id: input.spreadsheet_id,
      title: input.title,
      status: input.status ?? "pending",
      order_index: input.order_index ?? 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to insert planner todo: ${error.message}`);
  return data as PlannerTodoRow;
}

export async function updatePlannerTodoStatus(
  client: SupabaseLikeClient,
  params: {
    id: string;
    status: PlannerTodoStatus;
  },
): Promise<PlannerTodoRow> {
  const { data, error } = await client
    .from("planner_todos")
    .update({ status: params.status })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update planner todo status: ${error.message}`);
  return data as PlannerTodoRow;
}
