import { svc } from "./db.ts";
import { buildContext as buildContextStack } from "../../../packages/context-manager/src/index.ts";
import type { ContextBuildOptions, ContextBuildResult } from "../../../packages/context-manager/src/index.ts";
import { recordTelemetry } from "../../../packages/shared/src/telemetry.ts";

async function safeSelect<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.warn("Context fetch failed", error);
    return null;
  }
}

function stringifyRows(rows: unknown[] | null, fallbackTitle: string): string {
  if (!rows || rows.length === 0) return "";
  return `${fallbackTitle}\n${rows
    .map((row) => {
      try {
        return typeof row === "string" ? row : JSON.stringify(row);
      } catch {
        return String(row);
      }
    })
    .join("\n")}`;
}

export async function buildContext(options: ContextBuildOptions): Promise<ContextBuildResult> {
  const supabase = svc();

  const result = await buildContextStack(options, {
    dependencies: {
      fetchChatHistory: async ({ sessionId, limit }) => {
        const result = await safeSelect(async () => {
          const { data } = await supabase
            .from("agent_messages")
            .select("role,content,created_at")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(limit);
          return data ?? [];
        });
        if (!result) return "";
        return result
          .reverse()
          .map((row: any) => `[${row.role}] ${row.content ?? ""}`)
          .join("\n");
      },
      fetchProjectRules: async ({ spreadsheetId }) => {
        const rows = await safeSelect(async () => {
          const { data } = await supabase
            .from("context_project_rules")
            .select("content")
            .eq("spreadsheet_id", spreadsheetId)
            .order("updated_at", { ascending: false })
            .limit(1);
          return data ?? [];
        });
        if (!rows || rows.length === 0) return "";
        return rows[0].content ?? "";
      },
      fetchUserRules: async ({ userId }) => {
        const rows = await safeSelect(async () => {
          const { data } = await supabase
            .from("context_user_rules")
            .select("content")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1);
          return data ?? [];
        });
        if (!rows || rows.length === 0) return "";
        return rows[0].content ?? "";
      },
      fetchPlannerTodo: async ({ sessionId }) => {
        const rows = await safeSelect(async () => {
          const { data } = await supabase
            .from("planner_todos")
            .select("title,done,order_index")
            .eq("session_id", sessionId)
            .order("order_index", { ascending: true });
          return data ?? [];
        });
        if (!rows || rows.length === 0) return "";
        return rows
          .map((row: any) => `${row.done ? "[x]" : "[ ]"} ${row.title ?? ""}`)
          .join("\n");
      },
      fetchLocalMemory: async ({ sessionId }) => {
        const rows = await safeSelect(async () => {
          const { data } = await supabase
            .from("agent_memories")
            .select("content")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(5);
          return data ?? [];
        });
        return stringifyRows(rows, "Session notes:");
      },
      fetchCompressionSummary: async ({ sessionId }) => {
        const rows = await safeSelect(async () => {
          const { data } = await supabase
            .from("context_compressions")
            .select("summary")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(1);
          return data ?? [];
        });
        if (!rows || rows.length === 0) return null;
        return rows[0].summary ?? null;
      },
      fetchAgentRules: async () => {
        // Developer-managed rules are stored with the codebase for now.
        try {
          const module = await import("../../../packages/planner/src/agent_rules.ts");
          if (module?.AGENT_RULES) return String(module.AGENT_RULES);
        } catch (error) {
          console.warn("Agent rules module missing", error);
        }
        return "";
      },
      fetchSheetContext: async ({ sessionId, spreadsheetId }) => {
        const rows = await safeSelect(async () => {
          const { data } = await supabase
            .from("session_sheet_context")
            .select("context_text")
            .eq("session_id", sessionId)
            .eq("spreadsheet_id", spreadsheetId)
            .order("updated_at", { ascending: false })
            .limit(1);
          return data ?? [];
        });
        if (!rows || rows.length === 0) return "";
        return rows[0].context_text ?? "";
      },
    },
  });
  await recordTelemetry({
    type: "context_size",
    sessionId: options.sessionId,
    tokens: result.totalTokens,
    timestamp: new Date().toISOString()
  });
  return result;
}
