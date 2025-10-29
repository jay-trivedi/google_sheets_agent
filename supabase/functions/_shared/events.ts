import { appendAgentEvent } from "../../../packages/realtime/src/agent_events.ts";
import type { AgentEventType } from "../../../packages/realtime/src/agent_events.ts";

export function createEventTracker(sessionId: string, spreadsheetId: string, runId: string) {
  return {
    async record(type: AgentEventType, payload: Record<string, unknown>) {
      appendAgentEvent({
        type,
        sessionId,
        spreadsheetId,
        runId,
        timestamp: new Date().toISOString(),
        payload,
      });
    },
  };
}
