#!/usr/bin/env bash
set -euo pipefail

echo "Running unit tests..."
pnpm vitest run --config vitest.config.ts

echo "Running Supabase edge-function tests..."
pnpm test:supabase

echo "Running Apps Script integration tests..."
pnpm vitest run --config vitest.config.integration.ts

echo "Running Phase 3 CAS preflight integration test..."
pnpm vitest run --config vitest.config.integration.ts --reporter verbose --run tests/phase3/cas_preflight.test.ts
