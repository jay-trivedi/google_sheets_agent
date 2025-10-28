## Testing

All JavaScript/TypeScript packages share a Vitest harness and a Deno suite that hits the deployed Supabase dev stack.

- `pnpm test` — run Vitest once across `packages/**/tests/*.test.ts` (fast unit smoke tests).
- `pnpm test:watch` — watch mode for local TDD.
- `pnpm test:coverage` — Vitest run with V8 coverage output.
- `pnpm test:supabase` — Deno tests that exercise deployed Edge Functions (requires network + Supabase dev env vars).

### Environment

Create a `.env.local` at the repo root (already used by Supabase CLI / Add-on). The Deno tests load it automatically via `std/dotenv`. Make sure it defines:

- `SUPABASE_FUNCTIONS_URL` — base URL for your dev functions, e.g. `https://<ref>.functions.supabase.co`.
- `SUPABASE_ANON_KEY` (or `SB_ANON_KEY`) — anon key for authenticated calls.
- Any additional secrets the remote functions require (e.g. Google OAuth, OpenAI). For service-role tests add `SUPABASE_SERVICE_ROLE_KEY`.

Because the Deno suite targets the shared dev project, keep test data isolated (IDs prefixed with `test_`) and clean up as needed.
