import type { ContextSegment } from "./types.ts";

export type CompressionConfig = {
  maxTokens: number;
  bufferTokens: number;
};

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  maxTokens: 20000,
  bufferTokens: 4000,
};

export function calculateTotalTokens(segments: ContextSegment[]): number {
  return segments.reduce((sum, segment) => sum + (segment.tokens ?? 0), 0);
}

export function shouldCompress(
  segments: ContextSegment[],
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG,
): boolean {
  const total = calculateTotalTokens(segments);
  return total >= config.maxTokens - config.bufferTokens;
}

export type CompressionHarnessResult = {
  shouldCompress: boolean;
  totalTokens: number;
  threshold: number;
};

export function createCompressionHarness(
  segments: ContextSegment[],
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG,
): CompressionHarnessResult {
  const total = calculateTotalTokens(segments);
  return {
    shouldCompress: shouldCompress(segments, config),
    totalTokens: total,
    threshold: config.maxTokens - config.bufferTokens,
  };
}
