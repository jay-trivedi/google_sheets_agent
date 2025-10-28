#!/usr/bin/env bash
set -euo pipefail

echo "Running unit tests..."
pnpm vitest run --config vitest.config.ts

echo "Running Supabase edge-function tests..."
pnpm test:supabase

echo "Running Apps Script integration tests..."
pnpm vitest run --config vitest.config.integration.ts
