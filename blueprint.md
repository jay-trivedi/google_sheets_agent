# AI Sheets Analyst — v1 Repo Blueprint (Supabase + Add-on)

**Decisions locked**

* **Runtime:** Google Sheets Add‑on only (no Chrome extension in v1)
* **Voice:** skipped for v1
* **Backend:** Supabase for auth, DB, Realtime, storage, Edge Functions
* **Token security:** default **pgsodium + Vault** (RLS‑gated RPCs); fallback **app‑layer AES‑GCM**
* **Cross‑sheet pulls:** user‑selectable **IMPORTRANGE (live link)** or **COPY_VALUES (snapshot)**; default live link with auto‑suggest snapshot on heavy ranges or failed auth
* **SOP**: See `docs/phase-sop.md` for the checklist before marking complete.

---

## Phase Progress (running log)

- **Phase 0 – Bootstrap add-on** ✅ (sidebar read flow live)
- **Phase 0.5 – Supabase ping** ✅ (remote `/plan` wired)
- **Phase 1 – Local apply** ✅ (Apps Script write helper)
- **Phase 1.1 – Backend executor** ✅ (App-AES token path)
- **Phase 1.2 – pgsodium/Vault** ⏸️ *Deferred* — App-AES fallback in use; revisit when Vault extensions are provisioned.
- **Phase 2 — Preview + Diff** ✅ (summary + gating in sidebar)
- **Phase 2.5 — Audit Log + Undo** ✅ (AI_AUDIT_LOG sheet + undo endpoint)
- **Phase 3 — CAS preflight** ✅ (fingerprints enforced)
- **Phase 3.5 — Presence and Reservations** ⏸️ *Deferred*
- **Phase 4 — Analyst skills v1** 🚧 *In progress*

---

## Monorepo layout (updated)

```
ai-sheets-analyst/
├─ apps/
│  └─ addon/
│     ├─ appsscript.json
│     ├─ Code.gs
│     ├─ Sidebar.html
│     ├─ sidebar.js
│     ├─ ui/
│     │  ├─ PullModeToggle.spec.md
│     │  └─ ProvenanceFooter.spec.md
│     └─ README.md
│
├─ supabase/
│  ├─ functions/
│  │  ├─ plan/index.ts
│  │  ├─ preview/index.ts
│  │  ├─ apply/index.ts
│  │  ├─ undo/index.ts
│  │  ├─ reserve/index.ts
│  │  ├─ release/index.ts
│  │  ├─ explain/index.ts
│  │  ├─ pull/index.ts
│  │  ├─ oauth/callback.ts
│  │  └─ _shared/
│  │     ├─ auth.ts
│  │     ├─ db.ts
│  │     ├─ errors.ts
│  │     └─ response.ts
│  ├─ migrations/
│  │  ├─ 0001_init.sql
│  │  ├─ 0002_policies.sql
│  │  ├─ 0003_indexes.sql
│  │  ├─ 0004_pgsodium_vault_setup.sql        # keys + grants (stubs)
│  │  ├─ 0005_rpc_encrypt_decrypt_tokens.sql  # security definer RPCs
│  │  └─ 0006_rls_rpc_policies.sql            # RLS allowing only RPC paths
│  ├─ seed/
│  │  └─ dev_seed.sql
│  └─ README.md
│
├─ packages/
│  ├─ protocol/
│  │  └─ src/
│  │     ├─ ids.ts
│  │     ├─ enums.ts
│  │     ├─ types.ts
│  │     ├─ messages.ts
│  │     └─ index.ts
│  ├─ planner/
│  │  └─ src/
│  │     ├─ planner.ts
│  │     ├─ tool_schemas.ts
│  │     └─ prompts.ts
│  ├─ executor/
│  │  └─ src/
│  │     ├─ executor.ts
│  │     ├─ cas.ts
│  │     ├─ requests.ts
│  │     ├─ values.ts
│  │     └─ charts.ts
│  ├─ preview/
│  │  └─ src/
│  │     ├─ preview.ts
│  │     └─ diff.ts
│  ├─ sheets-tools/
│  │  └─ src/
│  │     ├─ sheets_client.ts
│  │     ├─ pivots.ts
│  │     ├─ formulas.ts
│  │     ├─ formatting.ts
│  │     ├─ charts.ts
│  │     └─ fingerprint.ts
│  ├─ realtime/
│  │  └─ src/
│  │     ├─ presence.ts
│  │     ├─ reservations.ts
│  │     └─ queue.ts
│  ├─ auth/
│  │  └─ src/
│  │     ├─ google_oauth.ts
│  │     ├─ token_store.ts                    # dual‑mode: pgsodium or app AES
│  │     └─ scopes.ts
│  ├─ repositories/
│  │  └─ src/
│  │     ├─ plans_repo.ts
│  │     ├─ patches_repo.ts
│  │     ├─ schema_cache_repo.ts
│  │     ├─ provenance_repo.ts
│  │     └─ sessions_repo.ts
│  ├─ voice/                                   # placeholder off in v1
│  │  └─ src/
│  │     ├─ asr.ts
│  │     └─ tts.ts
│  └─ shared/
│     └─ src/
│        ├─ env.ts
│        ├─ log.ts
│        ├─ errors.ts
│        └─ time.ts
│
├─ infra/
│  ├─ env.example
│  ├─ Makefile
│  └─ README.md
│
├─ .github/
│  └─ workflows/
│     ├─ deploy-functions.yml
│     └─ lint-test.yml
│
└─ README.md
```

---

## Environment flags (additions)

**infra/env.example**

```
FEATURE_EXTENSION=false
FEATURE_VOICE=false
TOKENS_ENCRYPTION_MODE=pgsodium   # pgsodium | app_aes

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URL=
GOOGLE_SHEETS_SCOPES=https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive.readonly

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-thinking

# App‑AES fallback only (if TOKENS_ENCRYPTION_MODE=app_aes)
TOKENS_KEK_V1=
```

---

## Supabase migrations (spec)

### 0004_pgsodium_vault_setup.sql (spec)

**Goal:** Create managed key for oauth token column encryption, and minimal grants.

**Artifacts to create**

* pgsodium and vault extensions enabled
* a named key `oauth_tokens_key_v1`
* a view of key metadata locked to service role

**Required SQL elements**

* `CREATE EXTENSION IF NOT EXISTS pgsodium;`
* `CREATE EXTENSION IF NOT EXISTS supabase_vault;` (or `vault` depending on stack)
* `SELECT key_id FROM pgsodium.create_key(name => 'oauth_tokens_key_v1');`
* Restrict `pgsodium.key` table via RLS or grant so only vault/owner can see

> Note: Exact extension names can vary by Supabase stack. Keep this file as a stub with asserts and `RAISE` notes; fill exact SQL during setup.

### 0005_rpc_encrypt_decrypt_tokens.sql (spec)

**Goal:** Security‑definer RPCs that encapsulate encrypt/decrypt of `oauth_tokens`.

**Tables**

* `public.oauth_tokens(user_id uuid pk, provider text, ciphertext bytea, kid text, nonce bytea, created_at timestamptz, updated_at timestamptz)`

**RPCs**

* `rpc_encrypt_token(user_id uuid, provider text, token_json jsonb) RETURNS void`

  * Behavior: encrypt `token_json` using `pgsodium.crypto_aead_det_encrypt` with key `oauth_tokens_key_v1`. Write `(ciphertext, nonce, kid='oauth_tokens_key_v1')` upserted by `(user_id, provider)`.
* `rpc_decrypt_token(user_id uuid, provider text) RETURNS jsonb`

  * Behavior: fetch row, decrypt with `pgsodium.crypto_aead_det_decrypt`, return jsonb.
* Mark both `SECURITY DEFINER`, owned by a dedicated role (e.g., `svc_encryption`), and only callable by Supabase Edge Functions role.

**Policies**

* Deny direct `SELECT ciphertext` to anon/authenticated roles.
* Allow `rpc_encrypt_token` for the caller whose `auth.uid()` matches `user_id` or for service role.
* Allow `rpc_decrypt_token` only for service role.

### 0006_rls_rpc_policies.sql (spec)

**Goal:** Enforce RLS so only RPC paths access token data.

**Rules**

* `ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;`
* Insert/Update via `rpc_encrypt_token` only; users can write their own token via that RPC.
* Decrypt via `rpc_decrypt_token` only; restricted to service role.
* Indexes on `(user_id, provider)` and `(kid)` for rotation.

---

## Packages — contracts and interfaces (additions)

### protocol/types.ts (new/updated fragments)

```ts
export type PullMode = "LIVE_LINK" | "SNAPSHOT"; // IMPORTRANGE vs COPY_VALUES

export type ProvenanceFooter = {
  sourceSpreadsheetId: string;
  sourceTab: string;
  sourceRangeA1: string;
  mode: PullMode;
  pulledAt: string;   // ISO
  rows: number;
  cols: number;
};
```

### auth/token_store.ts (dual‑mode, contracts only)

```ts
export interface TokenStore {
  put(userId: string, provider: "google", tokenJson: any): Promise<void>;
  get(userId: string, provider: "google"): Promise<any|null>;
}

export class PgSodiumTokenStore implements TokenStore {
  constructor(private deps: { db: any }) {}
  // put: calls rpc_encrypt_token(userId, provider, token_json)
  // get: calls rpc_decrypt_token(userId, provider) with service role
}

export class AppAesTokenStore implements TokenStore {
  constructor(private deps: { secret: { keyId: string; getKey: () => Promise<CryptoKey> }, db: any }) {}
  // put: AES‑GCM encrypt tokenJson, store ciphertext+nonce+kid
  // get: fetch row, AES‑GCM decrypt
}
```

### sheets-tools/sheets_client.ts (contracts excerpt)

```ts
export interface SheetsClient {
  batchUpdate(spreadsheetId: string, requests: any[]): Promise<void>;
  valuesBatchUpdate(spreadsheetId: string, data: Array<{ range: string; values: unknown[][] }>): Promise<void>;
  getValues(spreadsheetId: string, rangeA1: string): Promise<unknown[][]>;
  addHiddenSheetForPreview(spreadsheetId: string): Promise<{ sheetId: number; title: string }>;
}
```

### repositories/provenance_repo.ts (contracts)

```ts
export interface ProvenanceEntry {
  spreadsheetId: string;
  sourceSpreadsheetId: string;
  sourceRange: string;
  wroteRange: string;
  rows: number;
  cols: number;
  mode: "LIVE_LINK" | "SNAPSHOT";
  pulledAt: string; // ISO
}

export class ProvenanceRepo {
  constructor(db: any) {}
  log(entry: ProvenanceEntry): Promise<void>;
  list(spreadsheetId: string): Promise<ProvenanceEntry[]>;
}
```

---

## Edge Functions — request/response contracts (updated)

### /pull (unchanged route, extended payload)

**Input**

```json
{
  "spreadsheetId": "string",
  "sourceSpreadsheetId": "string",
  "sourceRangeA1": "string",
  "targetRangeA1": "string",
  "mode": "LIVE_LINK" | "SNAPSHOT"
}
```

**Output**

```json
{ "rowsWritten": 123, "provenanceId": "string", "footer": {
  "sourceSpreadsheetId": "...",
  "sourceTab": "Raw",
  "sourceRangeA1": "A1:K5000",
  "mode": "LIVE_LINK",
  "pulledAt": "2025-10-16T09:30:00Z",
  "rows": 5000,
  "cols": 11
}}
```

### /plan (add plan metadata)

* Include `requiresReservation: string[]` when plan wants to lock ranges.

### /apply (expects CAS fingerprints)

* No change to schema; enforce presence of a reservation and fingerprints.

---

## Add‑on UI specs

### PullModeToggle.spec.md

**Purpose:** Let the user choose **Live link** (IMPORTRANGE) vs **Snapshot** (Copy values) when pulling cross‑sheet data.

**Controls**

* Radio group: `Live link (auto‑updates)` / `Snapshot (faster, manual refresh)`
* If `Live link` is selected and IMPORTRANGE auth fails, show a non‑blocking banner suggesting Snapshot.

**Events**

* `pull:submit` → payload: `{ mode, sourceSpreadsheetId, sourceRangeA1, targetRangeA1 }`

### ProvenanceFooter.spec.md

**Purpose:** Always stamp a small info block under the pasted table for transparency.

**Layout**

* A 2‑column table beneath the pulled data range, with the following rows in plain text:

  * Source File ID
  * Source Tab
  * Source Range
  * Mode (Live link / Snapshot)
  * Pulled At (local time)
  * Rows × Cols
* Provide a `Refresh` button if mode is Snapshot, and `Convert to Values` button if mode is Live link.

**Actions**

* `Refresh` calls `/pull` again with the same payload.
* `Convert to Values` replaces the IMPORTRANGE output with current values and flips the footer mode to Snapshot.

---

## Realtime channels (no change; reaffirmed)

* Channel: `sheet:{spreadsheetId}`
* Events used by add‑on sidebar to render multiplayer context:

  * `reservation.created` / `reservation.released`
  * `plan.preview` (summary only, no PII)
  * `plan.applied` (patchId)

---

## Observability (additions)

* `logSecurity(event, meta)` for token encrypt/decrypt calls (counts only, no secrets)
* `logPull(spreadsheetId, mode, rows, ms)`

---

## Makefile tasks (spec)

* `make supabase-migrate` → apply all SQL in `supabase/migrations`
* `make deploy-fns` → deploy Edge Functions
* `make env-check` → verify required envs set per `TOKENS_ENCRYPTION_MODE`

---

## Rollout checklist

1. Enable pgsodium + Vault in Supabase. Record `oauth_tokens_key_v1`.
2. Apply migrations 0004..0006. Verify RPC ownership and RLS.
3. Set `TOKENS_ENCRYPTION_MODE=pgsodium` and remove any app‑AES secrets.
4. Wire add‑on Sidebar UI to call `/pull` with user‑selected mode.
5. Verify Provenance Footer renders with Refresh / Convert controls.
6. Load test `/apply` with CAS fingerprints to confirm conflict handling.
7. Smoke test with two users in the same sheet (reservations, apply, undo).

---

## What’s intentionally stubbed

* Exact pgsodium SQL function names and grants (fill per your Supabase version)
* Concrete HTML/CSS for the sidebar widgets
* Actual Sheets API request payloads (covered by executor contracts)

> This blueprint is code‑free by design. It specifies structure, interfaces, contracts, and operational steps so your team can implement quickly without ambiguity.

---

## Multi-user Flow Spec

### Actors

* Users A, B, ... using the Add-on sidebar
* Realtime (Supabase channel `sheet:{spreadsheetId}`)
* Planner (GPT-5 Thinking) that emits a Plan
* Executor that writes through the Sheets API
* Supabase repos (plans, reservations, patches, sessions)

### Core objects

* Reservation `{reservationId, a1, userId, expiresAt}`
* Plan `{planId, explain, actions[], requestedReservations[]}`
* Fingerprint `{range, rowCount, colCount, edgeHash}`
* Patch `{patchId, planId, touched[], appliedBy, appliedAt}`

### Presence

1. Sidebar joins `sheet:{spreadsheetId}` with `{userId, displayName, activeRangeA1, sheetName}`.
2. All sidebars render a presence list and current selections.

### Plan

1. User submits `{instruction, context}` to `/plan`.
2. Planner returns `{plan, requestedReservations}`.
3. Client calls `/reserve` for each target A1 range. Server creates rows in `reservations` with TTL.
4. Realtime broadcasts `reservation.created`. Sidebars show a small reserved badge on those ranges.
5. Client calls `/preview` and renders a human diff. Realtime broadcasts `plan.preview` summary.
6. Heartbeat every 5 s extends TTL while preview is open.

### Apply (compare and swap)

1. Client computes fingerprints for each reserved range: `{rowCount, colCount, edgeHash}` where `edgeHash` is a stable hash over header + first k and last k rows.
2. Client calls `/apply` with `{planId, reservationId, fingerprints[]}`.
3. Server recomputes fingerprints. If any mismatch, return `E_STALE` with a short reason. If clean, translate actions to one `batchUpdate` for structure and one `values.batchUpdate` for data.
4. Server writes an Audit Patch with before and after slices, releases the reservation, and broadcasts `plan.applied`.

### Undo

1. Client lists recent patches for this sheet.
2. On undo request, server checks for overlapping active reservations. If none, it replays the before state for values and structure. Broadcast `plan.applied` with a `revert: true` flag.

### Conflict policy

* Two users on the same range

  * First reservation wins. Second user sees who holds the lock and a queue button.
  * Queue entries are stored FIFO per sheet and auto expire when the user goes offline.
* Edits under your feet inside a reservation

  * CAS fails with `E_STALE`. Offer re-preview, write to a new tab, or cancel.
* Sorts, inserts, renames

  * Bind by header keys and developerMetadata anchors. Re locate columns by header match at apply time. If headers changed, prompt for confirmation.
* Expired reservations

  * TTL lapse auto releases. Any user can reserve again. Original user must re-preview before apply.

### Realtime events

* `reservation.created` `{reservationId, a1, userId, expiresAt}`
* `reservation.released` `{reservationId}`
* `plan.preview` `{planId, summary, reservedA1[]}`
* `plan.applied` `{planId, patchId, revert?: true}`

### Range strategies

* Keep write surface small. Compute on a hidden temp sheet if needed and paste only final values.
* Prefer dedicated output tabs for pivots, summaries, and charts.
* Always stamp a provenance footer under imported data.

### Fingerprint details

* `rowCount`, `colCount`
* `edgeHash` over header, first k rows, last k rows
* Optional `formatHash` if you want to ignore pure format changes

### Reservations state machine

* requested -> held (TTL starts)
* held + heartbeat -> extend TTL
* held -> apply -> released
* held -> cancel -> released
* held -> TTL expiry -> released

Overlap detection is by A1 intersection. Partial overlap can be split if the plan supports sub range writes.

### Fairness and queueing

* FIFO queue per spreadsheet id for conflicting reservations.
* Optional local boost for the most recent editor of the same tab to reduce thrash.

### UX

* Presence list with selections
* Reserved badges with user name and countdown
* Preview panel with human summary, row counts, and changed ranges
* Apply and Undo are single click
* Clear banners when blocked with suggested alternatives

### Failure handling

* `E_STALE` suggests re preview
* `E_SCOPE` on cross sheet pull suggests Snapshot mode
* `E_RANGE_MISSING` offers to pick a new target
* `E_QUOTA` backs off and coalesces actions

### Security

* RLS on all tables
* Only Edge Functions call decrypt RPCs for tokens
* Realtime payloads carry only user id and display name

### Performance targets

* Reservation round trip under 80 ms
* Preview under 250 ms for typical ranges
* Apply under 200 ms per batch
* CAS check under 60 ms

### Example timeline

1. A reserves `Bands_101_150!A1:D200` and previews.
2. B tries to format the same area and sees a reservation with queue option.
3. A applies. `plan.applied` broadcasts and reservation releases.
4. B is prompted to re preview due to changed values and then applies.

---

## Stubbed Interfaces — Reservation Queue

**Location**: `packages/realtime/src/queue.ts`

```ts
export type OperationStatus = "queued" | "running" | "done" | "failed" | "canceled" | "expired";

export type Operation = {
  operationId: string;
  spreadsheetId: string;
  a1: string;                  // target range for conflict routing
  planId: string;
  userId: string;
  priority: number;            // lower = higher priority
  notBefore?: string;          // ISO, optional schedule
  status: OperationStatus;
  createdAt: string;           // ISO
  claimedBy?: string;          // worker id
  claimedAt?: string;          // ISO
  expiresAt?: string;          // ISO
};

export interface OperationQueue {
  enqueue(input: {
    spreadsheetId: string;
    a1: string;
    planId: string;
    userId: string;
    priority?: number;
    notBefore?: string;
    ttlSec?: number;
  }): Promise<{ operationId: string }>;

  peek(spreadsheetId: string): Promise<Operation | null>;

  claim(input: { spreadsheetId: string; workerId: string; limit?: number }): Promise<Operation[]>; // service role only

  complete(input: { operationId: string; status: Exclude<OperationStatus, "queued" | "running">; errorCode?: string; errorMessage?: string }): Promise<void>; // writes audit

  list(input: { spreadsheetId: string; status?: OperationStatus; limit?: number; cursor?: string }): Promise<{ items: Operation[]; nextCursor?: string }>;

  purgeExpired(input?: { spreadsheetId?: string }): Promise<{ removed: number }>;
}
```

**Realtime notes**

* Queue lifecycle is **server-driven**. Client only creates entries when blocked by a reservation.
* When a reservation is released, server emits `reservation.released` and may **prompt** the next queued client to re-preview.

---

## Stubbed Interfaces — Reservations

**Location**: `packages/realtime/src/reservations.ts`

```ts
export type Reservation = {
  reservationId: string;
  spreadsheetId: string;
  a1: string;
  userId: string;
  expiresAt: string; // ISO
};

export interface ReservationsApi {
  create(input: { spreadsheetId: string; a1: string; userId: string; ttlSec: number }): Promise<Reservation>;
  extend(input: { reservationId: string; ttlSec: number }): Promise<Reservation>;
  release(reservationId: string): Promise<void>;
  overlaps(input: { spreadsheetId: string; a1: string }): Promise<Reservation[]>; // intersecting A1 ranges
  mine(input: { userId: string; spreadsheetId: string }): Promise<Reservation[]>;
  broadcast(channel: string, event: "reservation.created" | "reservation.released", payload: any): Promise<void>;
}
```

---

## Stubbed Interfaces — Compare‑and‑Swap (CAS) Fingerprinting

**Location**: `packages/executor/src/cas.ts` and `packages/sheets-tools/src/fingerprint.ts`

```ts
export type VerifyReason = "ROW_COUNT" | "COL_COUNT" | "EDGE_HASH" | "HEADER_CHANGED" | "FORMAT_CHANGED";

export type Fingerprint = {
  range: string;          // A1
  rowCount: number;
  colCount: number;
  edgeHash: string;       // 64‑bit stable hex of header+first/last k rows
  headerHash?: string;    // optional, hash of header row only
  formatHash?: string;    // optional, if formats are included
};

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyReason; changedAt?: { row?: number; col?: number } };

export interface CasApi {
  fingerprintRange(input: { spreadsheetId: string; rangeA1: string; edgeRows?: number; includeFormats?: boolean }): Promise<Fingerprint>;
  fingerprintMany(input: { spreadsheetId: string; rangesA1: string[]; edgeRows?: number; includeFormats?: boolean }): Promise<Fingerprint[]>;
  verify(input: { spreadsheetId: string; before: Fingerprint }): Promise<VerifyResult>;
  verifyMany(input: { spreadsheetId: string; before: Fingerprint[] }): Promise<VerifyResult[]>;
}
```

**Location**: `packages/sheets-tools/src/fingerprint.ts`

```ts
export const DEFAULT_EDGE_ROWS = 20;

export interface EdgeHashOptions {
  edgeRows?: number;          // how many rows from head and tail
  includeHeader?: boolean;    // default true
  includeFormats?: boolean;   // default false
}

export function computeEdgeHash(values: unknown[][], opts?: EdgeHashOptions): string; // returns 64‑bit hex (non‑crypto, stable)
export function computeHeaderHash(header: unknown[]): string;                          // 64‑bit hex
export function computeFormatHash(formats: unknown[][], opts?: { edgeRows?: number }): string; // optional
```

**Algorithm notes**

* Use a fast, stable 64‑bit non‑crypto hash (e.g., xxhash64 or murmur3) over a normalized byte stream of selected rows.
* Normalize cell values by type (string, number, boolean, blank, error) and locale‑independent number serialization.

---

## DB Schema Additions — Queue

**Location**: `supabase/migrations/0007_queue.sql` (spec)

**Table**: `operations`

* `operation_id uuid primary key`
* `spreadsheet_id text not null`
* `a1 text not null`
* `plan_id uuid not null`
* `user_id uuid not null`
* `priority int not null default 100`
* `not_before timestamptz null`
* `status text not null check (status in ('queued','running','done','failed','canceled','expired'))`
* `claimed_by text null`
* `claimed_at timestamptz null`
* `expires_at timestamptz null`
* `created_at timestamptz not null default now()`

**Indexes**

* `(spreadsheet_id, status, priority, created_at)`
* `(plan_id)`

**RLS**

* Users can `insert` their own operations
* Users can `select` operations where `user_id = auth.uid()`
* Only service role can `update` status/claim fields

**RPCs** (security definer)

* `rpc_queue_enqueue(...) RETURNS uuid`
* `rpc_queue_claim(spreadsheet_id text, worker_id text, limit int) RETURNS SETOF operations`
* `rpc_queue_complete(operation_id uuid, status text, error_code text, error_message text) RETURNS void`

---

## Edge Function Contracts — Queue (optional client use)

* `POST /queue/enqueue`

  * In: `{ spreadsheetId, a1, planId, userId, priority? }`
  * Out: `{ operationId }`

* `POST /queue/next` (service role only)

  * In: `{ spreadsheetId, workerId, limit? }`
  * Out: `{ items: Operation[] }`

* `POST /queue/complete` (service role only)

  * In: `{ operationId, status, errorCode?, errorMessage? }`
  * Out: `{ ok: true }`

---

## Client Flow Hooks (sidebar)

* When blocked by an overlapping reservation, the sidebar may call `/queue/enqueue`.
* The client listens on `sheet:{spreadsheetId}`; when it receives `reservation.released`, it checks if **its** operation is at the head of the queue and prompts the user to re‑preview.

These stubs align with the multi‑user spec and keep the implementation choices clear without committing to code.

---

## Progressive Roadmap — Working Code → Working Code

Each phase ships a usable slice. Every step has a Definition of Done (DoD), a manual test, touched files, config, and risks.

### Phase 0 — Bootstrap add‑on, no backend

**DoD**: Menu opens sidebar. “Read” shows `{sheetName, activeRangeA1, headers, sample}`.
**Manual test**: Select `B2:G50` → Read → JSON looks right.
**Touch**: `apps/addon/Code.gs` (onOpen, openSidebar, getContext), `apps/addon/Sidebar.html`, `sidebar.js`.
**Config**: Enable Advanced Sheets service.
**Risks**: None.

### Phase 0.5 — Wire Supabase ping

**DoD**: Button “Ping” calls `/plan` Edge Function → `{ok:true}`.
**Manual test**: Click Ping → see ok.
**Touch**: `supabase/functions/plan/index.ts` returns `{ok:true}`; sidebar fetch.
**Config**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, CORS allow `https://docs.google.com`.
**Risks**: CORS.

### Phase 1 — First end‑to‑end apply (local write)

**DoD**: Type “write ‘hello’ next to my selection.” Preview shows target. Apply writes locally via Apps Script.
**Manual test**: Select `G2` → Apply → `H2=hello`.
**Touch**: `apps/addon/Code.gs` add `applyLocal(requests, values)`; `/plan` returns simple plan.
**Config**: None.
**Risks**: None.

### Phase 1.1 — Backend executor (App‑AES fallback)

**DoD**: Same outcome, but via `/apply` using Sheets API with user tokens.
**Manual test**: Remove Apps Script write perms; still works.
**Touch**: `packages/auth/token_store.ts (AppAesTokenStore)`, `supabase/functions/apply/`, `supabase/functions/oauth/callback.ts`, `supabase/migrations/0001_init.sql` (oauth_tokens).
**Config**: `TOKENS_ENCRYPTION_MODE=app_aes`, `TOKENS_KEK_V1`, Google OAuth creds.
**Risks**: OAuth/scopes.

### Phase 1.2 — Switch to pgsodium + Vault

**DoD**: Tokens encrypted via RPC; decrypt only by service role.
**Manual test**: Direct select shows ciphertext; app works.
**Touch**: `0004_pgsodium_vault_setup.sql`, `0005_rpc_encrypt_decrypt_tokens.sql`, `0006_rls_rpc_policies.sql`; `PgSodiumTokenStore`.
**Config**: `TOKENS_ENCRYPTION_MODE=pgsodium`.
**Risks**: Extension names differ. Verify on project.

### Phase 2 — Minimal Preview + Diff

**DoD**: Preview renders human summary and change counts. Apply disabled until preview.
**Manual test**: Change selection → preview updates.
**Touch**: `packages/preview/preview.ts`, `diff.ts`; `/preview` function.
**Config**: None.
**Risks**: Avoid large reads.

### Phase 2.5 — Audit Log + Undo

**DoD**: Every apply creates a reversible Patch; Undo restores.
**Manual test**: Apply → Undo → exact restore.
**Touch**: `patches_repo.ts`, `/undo`, in‑sheet AI_AUDIT_LOG footer with `patchId`.
**Config**: None.
**Risks**: Large ranges; store minimal slices + structure deltas.

### Phase 3 — CAS preflight

**DoD**: If target changed since preview, apply returns `E_STALE`.
**Manual test**: Teammate edits target → your apply fails with stale.
**Touch**: `executor/cas.ts`, `sheets-tools/fingerprint.ts`, `/apply` verifies.
**Config**: None.
**Risks**: Hash stability; use header + first/last N rows.

### Phase 3.5 — Presence and Reservations *(Deferred)*

**DoD**: Others see “Reserved by <name> for 20s” while previewing.
**Manual test**: Two browsers → reservation badge appears.
**Touch**: `realtime/presence.ts`, `reservations.ts`; `/reserve`, `/release`; sidebar heartbeat.
**Config**: Supabase Realtime on.
**Risks**: Keep TTL short; extend on heartbeat.

### Phase 4 — Analyst skills v1

**Goal**: Deliver the first analyst toolbelt so users can request common aggregations, pivots, quick charts, and formatting touch-ups without writing formulas manually.

**DoD**
- Planner emits structured actions for at least four core skills:
  1. Grouped percentiles and summary stats (min/median/max, optional filters)
  2. Pivot table builder (rows, columns, values with aggregation)
  3. Quick chart (column/line/chart with optional series selection)
  4. Basic formatting (header bold, number format, conditional highlight)
- Preview presents a human-readable summary for each skill and estimates inserted ranges or tabs.
- Apply creates outputs on dedicated tabs (or adjacent blocks) with provenance entries and undo support.
- Apps Script sidebar shows skill descriptions + confirmation before apply.

**Manual test checklist**
1. Run grouped percentile command on the demo sheet; verify summary table + formatting.
2. Generate a pivot table with row/column/value selections; confirm pivot result and proper naming.
3. Create a quick chart; chart appears on new sheet with descriptive title.
4. Apply “format header + currency” command; verify formatting applied only to target range.
5. Trigger undo after each skill; original sheet state restored.

**Engineering tasks**
- `planner/tool_schemas.ts`: define prompt templates, validation, and action structures per skill.
- `packages/planner/src/planner.ts`: ensure plan includes `requestedReservations` for new outputs (e.g., new tabs) and references skills by ID.
- `packages/sheets-tools/src/{pivots,charts,formulas,formatting}.ts`: implement helpers to translate actions into Sheets API requests.
- `packages/executor/src/executor.ts`: extend executor to handle skill-specific action types, including multi-step operations (insert sheet → write values → format → create chart).
- `packages/preview/src/preview.ts`: enrich preview summary with per-skill explanation and target ranges.
- `supabase/functions/plan/index.ts` & `/preview` (if needed): thread new action payloads end-to-end.
- `supabase/functions/apply/index.ts`: ensure CAS fingerprints cover new target ranges (especially new tabs) and that patches capture before/after slices.
- `tests/phase4/`: add integration tests that run each skill against the demo sheet, assert outputs, and verify undo.
- Update `apps/addon/Sidebar.html` to list available skills, accept user parameters (e.g., metric column), and display preview summaries.

**Config / Env**
- None new; reuse existing Supabase + Google credentials.
- Demo sheet (`PHASE1_SPREADSHEET_ID`) should include sample data for pivots + charts.

**Risks & Mitigations**
- *Over-broad actions*: constrain planner prompts and add server-side validation on ranges/columns.
- *Performance*: large pivots/charts may exceed quotas—log timing and add guardrails.
- *Undo complexity*: ensure patches capture inserted sheets/tabs. Consider `AI_OUTPUT_*` tab naming convention.
- *User confusion*: provide clear preview text and require confirmation before applying multi-step skills.

**Artifacts**
- Update `docs/phase-sop.md` with any skill-specific steps.
- Record demo commands + screenshots in release notes.

### Context management toolkit (cross-phase initiative)

**Objectives**
- Supply a modular context pipeline for the planner/executor while keeping ownership clear between user-managed and agent-managed layers.
- Avoid context thrash by tracking tasks, memories, and compression in predictable components.

**Context stack (ordered)**
1. `user_query` — current user instruction.
2. `chat_history` — rolling transcript (trimmed via adaptive window).
3. `context_compression` — summaries generated when the session exceeds the LLM window; persisted with timestamps and source pointers.
4. `local_agent_memory` — session-scoped notes captured automatically (e.g., “Pivot tab created on Sheet X”).
5. `project_rules` — sheet/session rules the user controls (styling, business definitions, etc.). When the agent joins an existing sheet, snapshot current formatting/structure into these rules for later edits.
6. `user_rules` — user-specific preferences (tone, formatting, naming conventions).
7. `agent_rules` — developer-authored guardrails and non-negotiable constraints.
8. `planner_todo` — lightweight task list maintained per session/project.

> Global/long-term memory is intentionally deferred until we finalize retention/privacy guidelines.

Each layer implements a `load/save/serialize` interface inside a new `packages/context-manager` module so we can reorder or swap segments through config.

**Storage & APIs**
- `project_rules`, `user_rules`, and `planner_todo` stored in Supabase tables with RLS (sheet + user scoped). CRUD only for v1; no team/org or versioning yet.
- Agent-managed layers (`local_agent_memory`, `context_compression`) persisted with TTL policies; expose read-only previews in the UI.
- Provide a `buildContext()` helper returning ordered fragments + metadata for planner/executor.
- Add Supabase RPCs for editing rules and tasks with audit logging.

**Sidebar UX**
- Add a “Context” tab featuring:
  - Planner todo list (drag/drop, mark complete).
  - Editable cards for project + user rules (inline validation, history snapshot optional).
  - Read-only panes for agent memory/compression with “Suggest cleanup” action.
- Include neutral quick actions (e.g., “Apply house style guide”) that update the appropriate rules layer using the captured sheet styling.
- Provide file upload (image, PDF to start) so users can drop external references that become part of the context stack.

**Conflict handling**
- When rules collide, the agent must surface the mismatch, request clarification, and either adjust its own plan or ask the user to update rules. Log tie-break decisions for traceability.

**Telemetry & testing**
- Add barebones telemetry that records context size, compression events, and memory usage inside Supabase (no external tooling yet).
- Build a test harness that simulates context growth, triggers compression deterministically, and verifies the assembled context respects ordering.

**Agent task loop**
1. Decide whether to create/update the planner todo list; add items as needed.
2. Describe the next task to the user and request approval when appropriate.
3. Execute the task.
4. Validate outputs; remediate issues if validation fails.
5. Update the todo list and mark completed items.
6. Summarize key outcomes with clickable cell/range references.

### Notes on executor robustness

- Continue using a deterministic Sheets executor that translates plan actions into explicit Sheets API calls. Extend it with modular “skill adapters” instead of letting the LLM issue raw API calls.
- Introduce a validation layer that re-runs previews before apply to ensure assumptions hold.
- Explore a hybrid approach where the LLM drafts fine-grained steps, but the executor sanitizes ranges, formulas, and sheet mutations before execution. Current SoTA LLMs still mis-specify formulas under pressure, so a manual executor remains necessary for reliability.

### Phase 5 — Cross‑sheet pulls: Live link (IMPORTRANGE)

**DoD**: Pull with authorization prompt; provenance footer; Convert to Values.
**Manual test**: Change source → target updates.
**Touch**: `/pull` live‑link path; footer renderer; convert action.
**Config**: None.
**Risks**: Auth prompts.

### Phase 5.5 — Cross‑sheet pulls: Snapshot (COPY_VALUES)

**DoD**: Snapshot via API; Refresh button works; footer shows rows×cols and timestamp.
**Manual test**: Update source → Refresh updates target.
**Touch**: `/pull` snapshot path; `provenance_repo.ts`.
**Config**: None.
**Risks**: Formats only minimal preservation.

### Phase 6 — Full multiplayer safety (Queue)

**DoD**: Blocked users can queue; on release, queued user re‑previews, then applies.
**Manual test**: A reserves → B queues → A applies → B prompted.
**Touch**: `realtime/queue.ts`, `0007_queue.sql`, optional `/queue/*` functions.
**Config**: None.
**Risks**: Never auto‑apply queued ops.

### Phase 7 — Guardrails and errors

**DoD**: Clear UX for `E_STALE`, `E_SCOPE`, `E_RANGE_MISSING`, `E_QUOTA`. Admin kill switch.
**Manual test**: Force each error path.
**Touch**: `shared/errors.ts`, `shared/log.ts`; apply checks kill switch.
**Config**: Feature flags.
**Risks**: None.

### Phase 8 — Performance

**DoD**: Schema cache; preview < 250 ms; apply < 200 ms typical.
**Manual test**: Repeat run is faster.
**Touch**: `schema_cache_repo.ts`; preview temp hidden sheet where needed.
**Config**: None.
**Risks**: Cache invalidation rules for tab and header changes.

### Phase 9 — Security hardening

**DoD**: RLS verified; decrypt RPC only service role; logs present.
**Manual test**: User cannot decrypt; rotation to v2 tested on copy.
**Touch**: RLS review, logs in `shared/log.ts`.
**Config**: Rotate key to v2.
**Risks**: Rotation safety.

### Phase 10 — Dogfood and polish

**DoD**: Real working session with your data; at least one Undo; no blockers.
**Manual test**: Run Amazon cohort analysis end‑to‑end.
**Touch**: Bug fixes only.
**Config**: N/A.
**Risks**: Real‑world edge cases.

---

### CI gates and tagging

* Tag when green: `v0.0.0`, `v0.5.0`, `v1.0.0-apply-local`, `v1.1.0-executor`, `v1.2.0-pgsodium`, `v2.0.0-preview`, ...
* CI checks per phase: lint, build Edge Functions, dry‑run migrations, contract tests for `/plan`, `/preview`, `/apply`, `/pull`.

### Minimal scopes per phase

* 0–2: Sheets reads, local writes via Apps Script
* 1.1+: Google OAuth `spreadsheets`, `drive.readonly`
* Pulls need `drive.readonly` for discovery (if added later)

### Feature flags

```
FEATURE_EXTENSION=false
FEATURE_VOICE=false
TOKENS_ENCRYPTION_MODE=pgsodium
ALLOW_SNAPSHOT_PULLS=true
KILL_SWITCH_WRITES=false
```

---

## Ship Checklist (tick as you go)

| Phase | Title                      | DoD verified | Notes |
| ----: | -------------------------- | :----------: | ----- |
|     0 | Add‑on bootstrap           |      [ ]     |       |
|   0.5 | Supabase ping              |      [ ]     |       |
|     1 | Apply local                |      [ ]     |       |
|   1.1 | Backend executor (App‑AES) |      [ ]     |       |
|   1.2 | pgsodium + Vault           |      [ ]     |       |
|     2 | Preview + Diff             |      [ ]     |       |
|   2.5 | Audit + Undo               |      [ ]     |       |
|     3 | CAS preflight              |      [ ]     |       |
|   3.5 | Presence + Reservations    |      [ ]     |       |
|     4 | Analyst skills v1          |      [ ]     |       |
|     5 | Pulls: Live link           |      [ ]     |       |
|   5.5 | Pulls: Snapshot            |      [ ]     |       |
|     6 | Queue (multiplayer)        |      [ ]     |       |
|     7 | Guardrails + errors        |      [ ]     |       |
|     8 | Performance                |      [ ]     |       |
|     9 | Security hardening         |      [ ]     |       |
|    10 | Dogfood + polish           |      [ ]     |       |

---

## Solo Developer Setup — Dev and Prod Step‑by‑Step

### Assumptions

* v1 is **Add‑on only** (no Chrome extension, no voice)
* Backend = **Supabase** (DB, Realtime, Edge Functions, Secrets)
* Token security = **pgsodium + Vault** (fallback App‑AES if needed)
* Model = **GPT‑5 Thinking** (planner)

> Replace placeholders like `<PROJECT_REF>`, `<GOOGLE_CLIENT_ID>`, `<YOUR_SHEET>` with your values.

---

### Part A — Development Setup (local + Supabase dev)

1. **Install tools**

* Node 20+, pnpm, Deno, Supabase CLI, `clasp` (Apps Script CLI), git.
* VS Code extensions: ESLint, Prettier, Deno.

2. **Create Supabase dev project**

* In the Supabase dashboard, create project **dev**.
* Note **Project Ref** and **API keys** (anon + service role).

3. **Clone repo and env**

* Clone your repo.
* Copy `infra/env.example` → `.env.local` and set:

```
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
FEATURE_EXTENSION=false
FEATURE_VOICE=false
TOKENS_ENCRYPTION_MODE=pgsodium
ALLOW_SNAPSHOT_PULLS=true
KILL_SWITCH_WRITES=false
GOOGLE_CLIENT_ID=<later>
GOOGLE_CLIENT_SECRET=<later>
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:54321/functions/v1/oauth/callback
GOOGLE_SHEETS_SCOPES=https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive.readonly
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-thinking
```

4. **Apply base DB migrations**

* From repo root: `supabase db push --env-file .env.local`
* Or run SQL in `supabase/migrations/0001_init.sql .. 0003_indexes.sql` via dashboard.

5. **Enable pgsodium + Vault (dev)**

* Run `0004_pgsodium_vault_setup.sql`, `0005_rpc_encrypt_decrypt_tokens.sql`, `0006_rls_rpc_policies.sql` in order.
* If your plan doesn’t support these extensions, set `TOKENS_ENCRYPTION_MODE=app_aes` and skip to App‑AES fallback later.

6. **Serve Edge Functions locally**

* `supabase functions serve --env-file .env.local`
* Local URL baseline: `http://localhost:54321/functions/v1/` (e.g., `/plan`, `/preview`, `/apply`).

7. **Google Cloud OAuth (dev)**

* Create a Google Cloud project.
* OAuth consent: **Internal** (Workspace) for now.
* Create OAuth **Web Application** credentials.
* Authorized redirect URIs (dev): `http://localhost:54321/functions/v1/oauth/callback`
* Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env.local`.

8. **Create a Dev Sheet and Add‑on project**

* Make a new Google Sheet (e.g., “AI Analyst Dev”). Add a small test table.
* Open **Extensions → Apps Script** to create a **container‑bound** project.
* In Apps Script editor: create files per `apps/addon/` (Phase 0: `onOpen`, `openSidebar`, `getContext`, simple sidebar UI).
* Optional: use `clasp` to pull/push between local and the script: `npx clasp login`, `npx clasp clone <SCRIPT_ID>`.

9. **Connect sidebar to local functions**

* In `Sidebar.html/sidebar.js`, set your functions base to `http://localhost:54321/functions/v1` for dev.
* Add a **Ping** button calling `/plan` (returns `{ok:true}` in Phase 0.5).

10. **Phase 0 run**

* In the Sheet: **Extensions → Apps Script → Run onOpen** once.
* In the Sheet UI: **AI Analyst → Open**. Click **Read** to print context.
* Click **Ping** to hit the local function.

11. **OAuth test (Phase 1.1 path ready)**

* Implement `/oauth/callback` function (stub is fine for now).
* Visit the auth URL from your sidebar or a test page; confirm token row lands in `oauth_tokens` table (encrypted if pgsodium is on).

12. **Dev CORS**

* Edge Functions should send permissive CORS headers in responses. If needed, add `Access-Control-Allow-Origin: https://docs.google.com`.

---

### Part B — Production Setup (Supabase prod + OAuth prod)

1. **Create Supabase prod project**

* New project **prod**. Note its **Project Ref** and keys.
* Copy `.env.local` → `.env.prod` and update:

```
SUPABASE_URL=https://<PROD_PROJECT_REF>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TOKENS_ENCRYPTION_MODE=pgsodium  # or app_aes if extensions unavailable
GOOGLE_OAUTH_REDIRECT_URL=https://<PROD_FUNCTIONS_URL>/oauth/callback
```

2. **Apply migrations to prod**

* `supabase db push --project-ref <PROD_PROJECT_REF>` or run SQL files 0001..0006.

3. **Deploy Edge Functions to prod**

* `supabase functions deploy plan preview apply undo reserve release pull --project-ref <PROD_PROJECT_REF>`
* Note the base URL: `https://<PROD_PROJECT_REF>.functions.supabase.co/`

4. **Google OAuth for prod**

* Same Cloud project or a separate one.
* Add **prod** redirect URI: `https://<PROD_PROJECT_REF>.functions.supabase.co/oauth/callback`
* If you will share beyond your Workspace, switch consent to **External** and complete verification later.

5. **Add‑on configuration for prod**

* In your sidebar code, set the prod functions base to `https://<PROD_PROJECT_REF>.functions.supabase.co` behind a simple `ENV` switch.
* For now, you can keep the **container‑bound** add‑on in each prod sheet you use. When you need distribution, migrate to a Workspace Add‑on.

6. **Prod CORS**

* Ensure responses include `Access-Control-Allow-Origin: https://docs.google.com`.
* If you embed any images/assets, also allow `https://*.googleusercontent.com` as needed.

7. **Secrets in prod**

* Set `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, and any flags in **Supabase → Project Settings → Secrets**.

8. **Smoke tests (prod)**

* Open a new “AI Analyst Prod” Sheet.
* Sidebar **Read** works.
* **Ping** hits prod `/plan`.
* Run one small **Apply** via backend executor.
* Run a **Live link** pull and a **Snapshot** pull; verify Provenance Footer and Refresh/Convert.
* Check `plans`, `patches`, `provenance`, `oauth_tokens` tables populated appropriately.

---

### Part C — Switches and Fallbacks

* **Token store**

  * Prefer `pgsodium + Vault`. If unavailable, set `TOKENS_ENCRYPTION_MODE=app_aes` and a `TOKENS_KEK_V1` secret. You can migrate later.

* **Function bases**

  * Dev: `http://localhost:54321/functions/v1`
  * Prod: `https://<PROD_PROJECT_REF>.functions.supabase.co`

* **Scopes**

  * Keep to: `spreadsheets`, `drive.readonly`

* **Kill switch**

  * Set `KILL_SWITCH_WRITES=true` in prod to disable `/apply` when needed.

---

### Quick Command Cheat‑Sheet

**Local serve**

```
supabase functions serve --env-file .env.local
```

**Deploy functions (prod)**

```
supabase functions deploy plan preview apply undo reserve release pull --project-ref <PROD_PROJECT_REF>
```

**DB push (dev/prod)**

```
supabase db push --env-file .env.local
supabase db push --project-ref <PROD_PROJECT_REF>
```

**Apps Script push/pull**

```
cd apps/addon
npx clasp pull   # from Apps Script to local
npx clasp push   # from local to Apps Script
```

---

### First‑Run Smoke Test (Dev)

1. Open Dev Sheet → **AI Analyst → Open** → **Read** prints context.
2. **Ping** returns `{ok:true}`.
3. Phase 1: “Write ‘hello’ next to my selection” applies locally.
4. Phase 1.1: Run OAuth, then Apply via backend succeeds.
5. Check Supabase tables: `plans`, `patches`, `oauth_tokens` (ciphertext present), `schema_cache` (after you add it), `provenance` (after pulls).

---

### Troubleshooting

* **CORS**: Add `Access-Control-Allow-Origin: https://docs.google.com` in every Edge Function response.
* **OAuth redirect mismatch**: Must match the function URL exactly, including `/oauth/callback` path.
* **Apps Script not updating**: After `clasp push`, reload the Sheet or run `onOpen` once.
* **Permission errors on IMPORTRANGE**: Guide the user to click the authorization prompt; if blocked, suggest **Snapshot** mode.
* **pgsodium errors**: Switch to `TOKENS_ENCRYPTION_MODE=app_aes` to keep moving; revisit later.

This gives you a clean path from zero to working dev, and a mirrored prod you can promote into when each phase is green.
