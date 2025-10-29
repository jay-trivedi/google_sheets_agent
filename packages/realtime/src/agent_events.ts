export type AgentEventType =
  | "thinking"
  | "plan_started"
  | "plan_step_update"
  | "todo_update"
  | "verification"
  | "summary"
  | "cancelled"
  | "info";

export type AgentEvent = {
  type: AgentEventType;
  sessionId: string;
  spreadsheetId: string;
  runId: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

type EventStore = Map<string, AgentEvent[]>; // sessionId -> events

const globalEvents: EventStore = (globalThis as any).__agentEvents ?? new Map();
if (!(globalThis as any).__agentEvents) {
  (globalThis as any).__agentEvents = globalEvents;
}

const cancellationStore: Map<string, boolean> = (globalThis as any).__agentRunCancels ?? new Map();
if (!(globalThis as any).__agentRunCancels) {
  (globalThis as any).__agentRunCancels = cancellationStore;
}

const MAX_EVENTS_PER_SESSION = 500;

export function appendAgentEvent(event: AgentEvent) {
  const list = globalEvents.get(event.sessionId) ?? [];
  list.push(event);
  if (list.length > MAX_EVENTS_PER_SESSION) list.splice(0, list.length - MAX_EVENTS_PER_SESSION);
  globalEvents.set(event.sessionId, list);
}

export function listAgentEvents(sessionId: string, after?: string, limit = 100): AgentEvent[] {
  const list = globalEvents.get(sessionId) ?? [];
  const filtered = after ? list.filter((evt) => evt.timestamp > after) : list;
  return filtered.slice(-limit);
}

export function cancelRun(runId: string) {
  cancellationStore.set(runId, true);
}

export function isRunCancelled(runId: string): boolean {
  return cancellationStore.get(runId) === true;
}

export function clearRunCancellation(runId: string) {
  cancellationStore.delete(runId);
}
