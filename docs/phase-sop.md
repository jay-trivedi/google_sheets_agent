# Phase SOP Checklist (Draft)

Shared operating procedure for validating and closing the phases captured in `blueprint.md`. Adjust as phases evolve, and link any phase-specific runbooks here when they solidify.

## Standard Phase Workflow

1. **Summarise the phase scope**  
   Capture DoD, risks, touch-points, and any open questions in the PR/issue description. Copy the relevant slice of `blueprint.md` into the ticket for quick reference.
2. **Cut a working branch off `main`**  
   `git checkout main && git pull && git switch -c phase/<number>-<slug>`.
3. **Plan tasks**  
   Break requirements into work items (code, infra, docs, QA). Link to this checklist so reviewers know which steps were followed.
4. **Update local configuration**  
   Refresh `.env.local` (and any secrets files) with values needed for the phase. Note changes in the PR so teammates can replicate.
5. **Execute code changes**  
   Implement features plus unit coverage. Add integration tests as applicable; keep test names phase-specific (e.g., `tests/phase3/...`).
6. **Refresh scripts/tooling**  
   If new tests were added, update `scripts/run-all-tests.sh` or other runners to include them.
7. **Deploy backend dependencies**  
   - `supabase functions deploy ...` for relevant Edge Functions.  
   - Apply DB migrations if new tables/policies ship with the phase.
8. **Sync Apps Script code**  
   Run `pnpm clasp:push` (and any additional push scripts) so the live add-on matches the branch.
9. **Run validation suite**  
   - `pnpm vitest run --config vitest.config.ts`  
   - `pnpm test:supabase` (when touched)  
   - `pnpm vitest run --config vitest.config.integration.ts`  
   - Phase-specific commands (e.g., `tests/phase3/cas_preflight.test.ts`).  
   Record outcomes in the PR.
10. **Update docs**  
    - `README.md` for new commands/env vars.  
    - `.env.local` sample comments if defaults changed.  
    - `blueprint.md` for phase progress + architectural notes.  
    - This SOP if the workflow evolved.
11. **Commit and merge**  
    - `git status` should show only intended files.  
    - Squash commits with descriptive messages.  
    - Ensure branch passes CI before merge.  
    - Tag phase milestones if agreed (see blueprint’s tagging section).

> Tip: If Supabase or Apps Script deployments are optional for the phase (e.g., pure planning), mark the skipped steps and explain why in the PR.

## Cross-Phase Reminders

Keep these in mind alongside the workflow above:

- Double-check `.env.local` and shared secrets before running tests (Step 4).
- Run `pnpm install` after pulling `main` to avoid mismatched lockfiles (Step 3).
- Capture test output (screenshots/logs) so reviewers can verify results quickly (Step 9).
- Update `blueprint.md` incrementally instead of waiting until merge (Step 10).

## Phase 0 – Bootstrap Add-on

- ✅ Preconditions: Apps Script project deployed; `.clasp.json` points at the dev script.
- Actions:
  - `pnpm clasp:push` to sync sidebar assets.
  - Open sheet → `AI Analyst → Open` to validate sidebar loads.
  - Run `Read context` button and capture payload in PR notes.
- Verifications:
  - Manual: context object includes spreadsheet/sheet IDs + sample rows.
  - Automated: `pnpm vitest run --config vitest.config.ts --run packages/preview/tests/preview.test.ts`.
  - Docs: update blueprint phase table, note sheet IDs in project wiki.

## Phase 0.5 – Supabase Ping

- ✅ Preconditions: Supabase dev project up; `.env.local` holds `SUPABASE_URL`, anon key.
- Actions:
  - `pnpm dev` to serve functions or deploy `/plan`.
  - Sidebar `Ping backend (/plan)` returns `{ ok: true }`.
- Verifications:
  - Manual: confirm response includes timestamp.
  - Automated: `pnpm vitest run --config vitest.config.ts --run packages/shared/tests/smoke.test.ts`.
  - Docs: add function base URL to README environment section.

## Phase 1 – Local Apply

- ✅ Preconditions: Phase 0/0.5 green; sheet seeded with target range.
- Actions:
  - `Read context` → `Preview change` → `Write "hello" locally`.
  - Commit screenshots or JSON output for QA log.
- Verifications:
  - Manual: new column populates `hello`.
  - Automated: `pnpm vitest run --config vitest.config.ts --run packages/preview/tests/preview.test.ts`.
  - Docs: record active sheet + range in `.env.local`.

## Phase 1.1 – Backend Executor

- ✅ Preconditions: OAuth tokens stored in Supabase (`PHASE1_CLIENT_USER_ID` authorized).
- Actions:
  - `Connect Google` in sidebar to refresh tokens if expired.
  - `Preview change` → `Apply via backend`.
  - `pnpm test:supabase` to exercise executor path.
- Verifications:
  - Manual: `patches` table row inserted with before/after payloads.
  - Automated: `pnpm vitest run --config vitest.config.integration.ts --run tests/phase1/backend_apply.test.ts` (replace with actual file name once added).
  - Docs: update README with OAuth steps if anything changed.

## Phase 1.2 – pgsodium / Vault (Deferred)

- SOP not active; revisit when Vault is provisioned. Document blockers in README `Testing` section.

## Phase 2 – Preview + Diff

- ✅ Preconditions: Phase 1 flows stable.
- Actions:
  - `Preview` ensures diff summary describes affected cells.
  - Capture `summary` string and attach to PR.
- Verifications:
  - Manual: confirm diff renders in sidebar with expected change count.
  - Automated: `pnpm vitest run --config vitest.config.ts --run packages/preview/tests/preview.test.ts`.
  - Docs: ensure diff behavior captured in `apps/addon/ui` specs.

## Phase 2.5 – Audit Log + Undo

- ✅ Preconditions: Phase 1.1 apply works; `AI_AUDIT_LOG` sheet exists.
- Actions:
  - Run `scripts/run-all-tests.sh` to sweep unit + integration + Supabase suites.
  - Execute manual apply, then `/undo` via sidebar.
- Verifications:
  - Manual: audit log row appended with `patchId`; target cell restored.
  - Automated: `pnpm vitest run --config vitest.config.integration.ts --run tests/phase2_5/undo.test.ts`.
  - Docs: confirm README `Testing` section references undo integration command.

## Phase 3 – CAS Preflight (In progress)

- ✅ Preconditions: Fingerprint utilities wired; preview returns fingerprint.
- Actions:
  - `pnpm vitest run --config vitest.config.integration.ts --reporter verbose --run tests/phase3/cas_preflight.test.ts`.
  - Manual: run preview, hand-edit target cell outside Add-on, re-run apply to receive `E_STALE`.
- Verifications:
  - Manual: second preview/apply succeeds and writes `hello`; stale response includes `reason`.
  - Automated: ensure CAS test above passes.
  - Docs: keep README and blueprint phase notes aligned (status + command).

## Future Phases (4+)

- Add SOP entries once scope clarifies (pull modes, presence, queueing, guardrails, performance, security, polish).
