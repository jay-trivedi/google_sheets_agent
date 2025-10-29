import { defaultProviders, estimateTokens } from "./default_providers.ts";
export { createCompressionHarness, shouldCompress, DEFAULT_COMPRESSION_CONFIG } from "./compression.ts";
import type {
  ContextBuildOptions,
  ContextBuildResult,
  ContextDependencies,
  ContextProvider,
  ContextSegment,
} from "./types.ts";

const EMPTY_DEPENDENCIES: ContextDependencies = {
  fetchChatHistory: async () => "",
  fetchProjectRules: async () => "",
  fetchUserRules: async () => "",
  fetchPlannerTodo: async () => "",
  fetchLocalMemory: async () => "",
  fetchCompressionSummary: async () => null,
  fetchAgentRules: async () => "",
};

export type { ContextBuildOptions, ContextBuildResult, ContextSegment, ContextDependencies };

export async function buildContext(
  options: ContextBuildOptions,
  overrides?: {
    providers?: ContextProvider[];
    dependencies?: Partial<ContextDependencies>;
  },
): Promise<ContextBuildResult> {
  const providers = overrides?.providers ?? defaultProviders();
  const deps = { ...EMPTY_DEPENDENCIES, ...(overrides?.dependencies ?? {}) } as ContextDependencies;

  const segments: ContextSegment[] = [];
  for (const provider of providers) {
    const segment = await provider.load(options, deps);
    if (segment) segments.push(segment);
  }

  const totalTokens = segments.reduce((sum, seg) => sum + (seg.tokens ?? estimateTokens(seg.content)), 0);
  return { segments, totalTokens };
}
