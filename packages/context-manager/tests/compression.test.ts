import { describe, expect, it } from "vitest";
import { createCompressionHarness, shouldCompress } from "../src/compression.ts";
import type { ContextSegment } from "../src/types.ts";

const makeSegment = (type: ContextSegment["type"], tokens: number): ContextSegment => ({
  type,
  content: `${type} (${tokens})`,
  tokens,
});

describe("context compression harness", () => {
  it("flags compression when total tokens exceed threshold", () => {
    const segments = [makeSegment("user_query", 8000), makeSegment("chat_history", 9000)];
    const harness = createCompressionHarness(segments, { maxTokens: 20000, bufferTokens: 4000 });
    expect(harness.shouldCompress).toBe(true);
    expect(harness.totalTokens).toBe(17000);
    expect(harness.threshold).toBe(16000);
  });

  it("defers compression when under threshold", () => {
    const segments = [makeSegment("user_query", 2000), makeSegment("chat_history", 3000)];
    expect(shouldCompress(segments, { maxTokens: 20000, bufferTokens: 4000 })).toBe(false);
  });
});
