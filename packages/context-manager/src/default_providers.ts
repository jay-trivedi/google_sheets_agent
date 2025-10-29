import type {
  ContextBuildOptions,
  ContextDependencies,
  ContextProvider,
  ContextSegment,
} from "./types.ts";

function wrap(content: string, type: ContextSegment["type"]): ContextSegment {
  return { type, content: content.trim(), tokens: estimateTokens(content) };
}

const TOKEN_APPROXIMATION_DIVISOR = 4;

export function estimateTokens(content: string): number {
  if (!content) return 0;
  return Math.max(1, Math.ceil(content.length / TOKEN_APPROXIMATION_DIVISOR));
}

abstract class BaseProvider implements ContextProvider {
  abstract readonly type: ContextSegment["type"];
  abstract load(
    options: ContextBuildOptions,
    deps: ContextDependencies,
  ): Promise<ContextSegment | null>;

  protected build(content: string): ContextSegment | null {
    if (!content.trim()) return null;
    return wrap(content, this.type);
  }
}

class ActiveInputProvider extends BaseProvider {
  readonly type = "user_query";

  async load(options: ContextBuildOptions): Promise<ContextSegment | null> {
    const content = options.userQuery ?? options.agentQuery ?? "";
    if (!content.trim()) return null;
    const type = options.userQuery ? "user_query" : "agent_query";
    return {
      type,
      content: content.trim(),
      tokens: estimateTokens(content),
      metadata: { source: options.userQuery ? "user" : "agent" },
    };
  }
}

class ChatHistoryProvider extends BaseProvider {
  readonly type = "chat_history";

  async load(
    options: ContextBuildOptions,
    deps: ContextDependencies,
  ): Promise<ContextSegment | null> {
    if (!options.includeHistory) return null;
    const text = await deps.fetchChatHistory({ sessionId: options.sessionId, limit: 50 });
    return this.build(text);
  }
}

class CompressionProvider extends BaseProvider {
  readonly type = "context_compression";

  async load(
    options: ContextBuildOptions,
    deps: ContextDependencies,
  ): Promise<ContextSegment | null> {
    const summary = await deps.fetchCompressionSummary({ sessionId: options.sessionId });
    if (!summary) return null;
    return this.build(summary);
  }
}

class LocalMemoryProvider extends BaseProvider {
  readonly type = "local_agent_memory";

  async load(
    options: ContextBuildOptions,
    deps: ContextDependencies,
  ): Promise<ContextSegment | null> {
    const memo = await deps.fetchLocalMemory({ sessionId: options.sessionId });
    return this.build(memo);
  }
}

class ProjectRulesProvider extends BaseProvider {
  readonly type = "project_rules";

  async load(
    options: ContextBuildOptions,
    deps: ContextDependencies,
  ): Promise<ContextSegment | null> {
    const rules = await deps.fetchProjectRules({ spreadsheetId: options.spreadsheetId });
    return this.build(rules);
  }
}

class UserRulesProvider extends BaseProvider {
  readonly type = "user_rules";

  async load(
    options: ContextBuildOptions,
    deps: ContextDependencies,
  ): Promise<ContextSegment | null> {
    const rules = await deps.fetchUserRules({ userId: options.userId });
    return this.build(rules);
  }
}

class AgentRulesProvider extends BaseProvider {
  readonly type = "agent_rules";

  async load(_: ContextBuildOptions, deps: ContextDependencies): Promise<ContextSegment | null> {
    const rules = await deps.fetchAgentRules();
    return this.build(rules);
  }
}

class PlannerTodoProvider extends BaseProvider {
  readonly type = "planner_todo";

  async load(
    options: ContextBuildOptions,
    deps: ContextDependencies,
  ): Promise<ContextSegment | null> {
    const todo = await deps.fetchPlannerTodo({ sessionId: options.sessionId });
    return this.build(todo);
  }
}

class SheetContextProvider extends BaseProvider {
  readonly type = "sheet_context";

  async load(
    options: ContextBuildOptions,
    deps: ContextDependencies,
  ): Promise<ContextSegment | null> {
    if (!options.spreadsheetId) return null;
    const context = await deps.fetchSheetContext({
      sessionId: options.sessionId,
      spreadsheetId: options.spreadsheetId,
      sheetId: NaN,
    });
    return this.build(context);
  }
}

export function defaultProviders(): ContextProvider[] {
  return [
    new ActiveInputProvider(),
    new ChatHistoryProvider(),
    new CompressionProvider(),
    new LocalMemoryProvider(),
    new ProjectRulesProvider(),
    new UserRulesProvider(),
    new AgentRulesProvider(),
    new PlannerTodoProvider(),
    new SheetContextProvider(),
  ];
}
