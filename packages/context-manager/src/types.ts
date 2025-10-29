export type ContextSegmentType =
  | "user_query"
  | "agent_query"
  | "chat_history"
  | "context_compression"
  | "local_agent_memory"
  | "project_rules"
  | "user_rules"
  | "agent_rules"
  | "sheet_context"
  | "planner_todo";

export type ContextSegment = {
  type: ContextSegmentType;
  content: string;
  tokens?: number;
  metadata?: Record<string, unknown>;
};

export type ContextBuildOptions = {
  spreadsheetId: string;
  sessionId: string;
  userId: string;
  userQuery?: string;
  agentQuery?: string;
  includeHistory?: boolean;
};

export interface ContextProvider {
  readonly type: ContextSegmentType;
  load(options: ContextBuildOptions, deps: ContextDependencies): Promise<ContextSegment | null>;
}

export type ContextDependencies = {
  fetchChatHistory: (options: { sessionId: string; limit: number }) => Promise<string>;
  fetchProjectRules: (options: { spreadsheetId: string }) => Promise<string>;
  fetchUserRules: (options: { userId: string }) => Promise<string>;
  fetchPlannerTodo: (options: { sessionId: string }) => Promise<string>;
  fetchLocalMemory: (options: { sessionId: string }) => Promise<string>;
  fetchCompressionSummary: (options: { sessionId: string }) => Promise<string | null>;
  fetchAgentRules: () => Promise<string>;
  fetchSheetContext: (options: { sessionId: string; spreadsheetId: string; sheetId: number }) => Promise<string>;
};

export type ContextBuildResult = {
  segments: ContextSegment[];
  totalTokens: number;
};
