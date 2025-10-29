import type { AgentEventType } from "../../realtime/src/agent_events.ts";

export type LlmExecutionRequest = {
  sessionId: string;
  spreadsheetId: string;
  userId: string;
  prompt: string;
  context: string;
  issueTracker?: {
    record: (event: AgentEventType, payload: Record<string, unknown>) => Promise<void>;
  };
};

export type LlmExecutionResult = {
  ok: boolean;
  error?: string;
  summary?: string;
};

async function emit(
  tracker: LlmExecutionRequest["issueTracker"],
  type: AgentEventType,
  payload: Record<string, unknown>,
) {
  if (!tracker) return;
  await tracker.record(type, payload);
}

export async function executeWithLlm(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
  await emit(request.issueTracker, "thinking", { text: "Dispatching execution run." });
  // Placeholder for future LLM orchestration: currently we just emit a stub summary.
  await emit(request.issueTracker, "plan_started", {
    steps: [{ id: "llm-step", title: "LLM execution pending implementation" }],
  });
  await emit(request.issueTracker, "plan_step_update", {
    stepId: "llm-step",
    status: "complete",
    note: "Stub executor executed no-op.",
  });
  await emit(request.issueTracker, "summary", {
    text: "LLM execution placeholder completed. No sheet changes performed.",
  });
  return { ok: true, summary: "LLM execution not yet implemented." };
}
