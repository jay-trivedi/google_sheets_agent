export type TelemetryEvent =
  | { type: "context_size"; sessionId: string; tokens: number; timestamp: string }
  | { type: "compression"; sessionId: string; before: number; after: number; timestamp: string }
  | { type: "execution_outcome"; sessionId: string; status: "success" | "failure"; details?: string; timestamp: string };

export interface TelemetrySink {
  record: (event: TelemetryEvent) => Promise<void>;
}

const noopSink: TelemetrySink = {
  async record(event) {
    if (typeof Deno !== "undefined") {
      console.log("telemetry", event);
    } else {
      console.debug("telemetry", event);
    }
  }
};

let currentSink = noopSink;

export function configureTelemetrySink(sink: TelemetrySink) {
  currentSink = sink;
}

export async function recordTelemetry(event: TelemetryEvent) {
  await currentSink.record(event);
}
