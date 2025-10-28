## Testing

All JavaScript/TypeScript packages share a Vitest harness and a Deno suite that hits the deployed Supabase dev stack.

- `pnpm test` — run Vitest once across `packages/**/tests/*.test.ts` (fast unit smoke tests).
- `pnpm test:watch` — watch mode for local TDD.
- `pnpm test:coverage` — Vitest run with V8 coverage output.
- `pnpm test:phase0` — Exercise the Phase 0 add-on flow against the live seed Sheet via Apps Script Execution API.
- `pnpm test:supabase` — Deno tests that exercise deployed Edge Functions (requires network + Supabase dev env vars).

### Environment

Create a `.env.local` at the repo root (already used by Supabase CLI / Add-on). The Deno tests load it automatically via `std/dotenv`. Make sure it defines:

- `SUPABASE_FUNCTIONS_URL` — base URL for your dev functions, e.g. `https://<ref>.functions.supabase.co`.
- `SUPABASE_ANON_KEY` (or `SB_ANON_KEY`) — anon key for authenticated calls.
- Any additional secrets the remote functions require (e.g. Google OAuth, OpenAI). For service-role tests add `SUPABASE_SERVICE_ROLE_KEY`.
- **Phase 0 integration** (`pnpm test:phase0`) additionally expects:
  - `GAS_CLIENT_EMAIL`, `GAS_PRIVATE_KEY` — service account credentials with access to the add-on project + seed sheets.
  - `GAS_SCRIPT_ID` — Apps Script project ID that hosts the add-on code.
  - `GAS_DEPLOYMENT_ID` — optional; Execution API deployment to run (omit to use `devMode`).
  - `PHASE0_SPREADSHEET_ID` — seed spreadsheet ID for Phase 0 tests.
  - Optional helpers for deterministic assertions:
    - `PHASE0_SHEET_NAME` — specific tab to target.
    - `PHASE0_TARGET_RANGE` — explicit range to read instead of relying on the sheet’s active selection.
    - `PHASE0_EXPECTED_ACTIVE_RANGE` — asserted range string.
    - `PHASE0_EXPECTED_HEADERS` — pipe-separated header row (e.g. `Name|Team|Total`).
    - `PHASE0_EXPECTED_SAMPLE` — JSON string for the expected sample rows (e.g. `[["Alice","Ops"],["Bob","Sales"]]`).

Because the Deno suite targets the shared dev project, keep test data isolated (IDs prefixed with `test_`) and clean up as needed.

## Apps Script Deployment (clasp)

1. Copy `apps/addon/.clasp.example.json` → `apps/addon/.clasp.json` and replace `REPLACE_WITH_SCRIPT_ID` with your Apps Script project ID (from the Apps Script editor → Project Settings).
2. Authenticate once: `cd apps/addon && npx clasp login` (or provide a service-account JSON via `npx clasp login --creds path/to/creds.json`).
3. Push local changes: `pnpm clasp:push` (runs `npx clasp push` in `apps/addon/`).
4. Create a new version when ready: `cd apps/addon && npx clasp version "Phase 0 context"`.
5. Deploy or update an execution deployment: `cd apps/addon && npx clasp deploy -d "Dev"`.

Keep `.clasp.json` out of version control so you can point different environments to their own script IDs. Store `.clasprc.json` (generated OAuth tokens) securely on each developer machine or inject through CI secrets when automating deployments.
