# PartyPlus nonproduction verification and recovery

This runbook operates on synthetic data or an explicitly isolated staging project. The SQL baseline is not authoritative production schema. Production migrations, publishing and changes to customer data require a separate reviewed plan and approval.

## Local baseline

Use the modernization worktree with Node 24 and the checked-in lockfile. Dependency installation uses npm's public registry; no service credentials are needed for local tests.

```powershell
npm ci --ignore-scripts --no-audit
npm run lint
npx tsc --noEmit
npm test
$env:EXPO_NO_DOTENV = '1'
$env:CI = '1'
npx expo export --platform all --output-dir .test-cache/export
```

`npm test` creates ephemeral PGlite databases. It applies the explicitly marked blank synthetic baseline, the candidate SQL, and generated fixture users. It exercises actual PostgreSQL semantics, RLS, grants, receipts and rollback. PGlite serializes connections; use the separate-session path for concurrency proof. Its dump/load test verifies synthetic restoration, not production backup readiness.

## Independent PostgreSQL sessions

The CI workflow prepares PostgreSQL 17 in a disposable service. Locally, use an already available PostgreSQL server and a **blank disposable** database named `partyplus_synthetic`, with installation privileges. The harness refuses remote hosts and any other database name, and the baseline refuses an existing Auth schema. It does not reset an existing database; provision a fresh blank database for each run.

```powershell
$env:PARTYPLUS_TEST_DATABASE_URL = 'postgres://<test-user>:<test-password>@127.0.0.1:5432/partyplus_synthetic'
npm run test:backend
Remove-Item Env:PARTYPLUS_TEST_DATABASE_URL
```

Verify the diagnostic `Real PostgreSQL: independent concurrent sessions exercised`. The dump/restore test is intentionally skipped on this path; that test runs under PGlite separately. Review both results. Docker CLI availability does not imply its daemon is running. The CI workflow is prepared but was not pushed or executed during this batch.

## Synthetic browser journey

```powershell
$env:PARTYPLUS_SYNTHETIC_SITE_PORT = '8089'
node scripts/synthetic-invite-server.mjs
```

Open `http://127.0.0.1:8089/i/legacy-demo-party`. The static invitation and proxied Auth/RPC transport share the origin. The API also listens at loopback port 54321; both ports must be free. The database and synthetic sessions are ephemeral. Tokens are mock test transport, not real Supabase authentication. Stop with Ctrl+C when done. The server is never a hosting or production Auth option.

1. Open the invitation with clean browser storage; confirm details load before any guest session or mutation.
2. Arm the fault using the test-only local endpoint:

   ```powershell
   Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:54321/_synthetic/fail-next-rsvp'
   ```

3. Enter a fake guest name, Yes, and a guest count; save. The server commits and then returns 503, so the UI must leave the operation pending.
4. Reload the same invitation. Confirm the pending action is offered and the authoritative RSVP appears. Retry; confirm `Saved online`.
5. Claim Ice and suggest a fake item. Confirm the claim and suggestion appear without changing the RSVP.
6. Inspect the synthetic-only status endpoint:

   ```powershell
   Invoke-RestMethod -Uri 'http://127.0.0.1:54321/_synthetic/status' | ConvertTo-Json -Depth 30
   ```

Confirm both RSVP requests share an operation ID and the party has one RSVP, one Ice owner and one suggestion. Never use customer names, addresses or real records here. Browser storage survives server restarts, while the ephemeral database does not; use a fresh disposable browser context for a fresh server fixture.

To build without starting a server:

```powershell
$env:PARTYPLUS_BACKEND_ENV = 'local'
$env:PARTYPLUS_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:PARTYPLUS_SUPABASE_PUBLISHABLE_KEY = 'synthetic-placeholder'
$env:PARTYPLUS_NATIVE_SCHEME = 'partyplusnative-dev'
npm run build:invite
```

Output is `.test-cache/invite-site`, ignored by Git. The invitation builder rejects production labels, the known production backend and production native scheme. Do not deploy this candidate onto the existing production site through its build hook.

## Isolated Supabase staging gate

The authorized staging project is now `qmbwrbxbbshbavfhkujx` in the **Free** PartyPlus Staging organization. Production is `typbofemqhjoiwbkdvuc`. See [the current reconciliation review](PARTYPLUS_STAGING_RECONCILIATION_2026-10-02.md) for authoritative metadata, completed tests and superseding transition/rollback limits.

Obtain a separate, explicitly nonproduction project. First capture actual schema/Auth metadata and reconcile the candidate SQL. **Never apply `00-synthetic-baseline.sql` to Supabase**; it creates a stub Auth schema and refuses an existing one. The candidate contract is a one-time test installation, not an idempotent migration ledger or rollback script.

Set client configuration using ignored environment files or the build environment:

| Client | Required values |
| --- | --- |
| Native development/preview | `EXPO_PUBLIC_BACKEND_ENV=staging`, separate project URL and public key, staging invitation base URL, `PARTYPLUS_APP_VARIANT=development` or `preview` |
| Invitation | `PARTYPLUS_BACKEND_ENV=staging`, separate URL/public key, matching development or preview native scheme |

Never put service-role/secret keys in either client. Enable/configure real anonymous guest Auth and email OTP/linking in staging, including appropriate abuse/rate controls. Ensure the email templates support the implemented OTP entry flow. Test token expiry, anonymous-to-verified linking, email confirmation, second-device sign-in, denied host access, and sign-out/session loss. Signed guest claims must come from validated JWTs, not user-supplied IDs.

Verify function owners, fixed search paths, schema usage, table/sequence/function/default grants, RLS and publication behavior against the real project. Candidate direct table grants are denied; polling is intentional. Test realtime delivery through an explicitly approved channel strategy before relying on subscriptions. Restore a staging backup to a separate project and verify IDs, access evidence, grants, receipts, tombstones and recovery listings before considering production.

## Authoritative provenance export

Run `supabase/read-only-provenance.sql` through an authorized read-only administrative connection. Its catalog queries avoid party/customer records. Capture relation/column/constraint definitions, policies, grants, function definitions/owners/search paths, publications and migration-ledger availability. Review exported SQL for sensitive configuration before committing or sharing it. A public REST metadata 401 is not an authoritative schema export.

Separately identify the source commit associated with EAS/store binaries and the deployed Netlify site, including environment/build profile and applied database migration revision. Do not assume the local HEAD is deployed.

## Local data recovery

Preserved keys are `userId`, `partyplus.parties.v1` and `partyplus.currentPartyId.v1`. Durable draft/outbox data is stored in the dictionary `partyplus.drafts.v2`.

- Corrupt cache/draft JSON remains at its original key. Recovery keys have the form `<key>.recovery.<timestamp>.<sequence>` with source, captured time and the original raw string. If storage is full, the original still remains even when a second copy cannot be written.
- Drafts use `new-party` or editor keys; `outbox:<party-id>` holds a pending guest/delete operation. `rejected:<party-id>:<operation-id>` retains a definite rejected request. `recovery-draft:<id>:<timestamp>` retains a discarded/replaced editor request.
- Export original bytes and the full draft dictionary using authorized device/browser storage tooling before attempting a repair. Keep a separate verified copy; do not clear application data, allocate a new identity or remove a pending operation merely to silence an error.
- Unknown network outcomes must retry the same operation under the same signed principal. If the account changed or access was revoked after an uncertain send, preserve the operation and reconcile against the private receipt ledger through an authorized support process.
- Restore/review a recovery draft only after checking its operation receipt and current authoritative revision. A payload snapshot or old host UUID never grants host access. A polished user-facing recovery UI remains future work.

## Legacy bridge and rollback preparation

Preserve existing party/item/RSVP IDs, host labels, invite aliases and valid native payload names. Modernized reads retain legacy fallbacks only for a missing v2 read function; writes require v2. Existing legacy clients may require an upgrade when unsafe write grants are retired.

An assisted bridge must validate evidence independently and record an auditable evidence reference before granting a verified principal access. The synthetic grant fixture demonstrates the storage/authorization mechanics only. Guest session recovery, ownership transfer, retention and account deletion need reviewed rules; do not reassign legacy claims from a label or device UUID.

Before production approval, document backup/restore and a versioned read/write transition. Rolling clients back to old anonymous destructive writes is not a safe rollback. Candidate tombstones retain records; production purge and receipt-retention policies have not been authorized. The branch can be reviewed locally with `git diff 58ae63b..HEAD` once its implementation commits are made.

## Reproducing the reconciled staging batch

`node scripts/prepare-staging-contract.mjs` reads the recorded production **metadata only** and generates `observed-legacy-schema.sql` plus `.test-cache/staging-install.sql`. The combined script requires blank application tables and installs the clone, additive reconciliation and v2 contract in one transaction. The deployed staging project is already installed: **do not rerun the one-time installation there**. Never run `00-synthetic-auth.sql` or `00-synthetic-baseline.sql` against Supabase; those files are only for blank local test databases.

The final null-revision fix is deployed and verified in staging. The generator also emits `.test-cache/staging-revision-patch.sql`, replacing only the commit function. Its application, refreshed metadata and the final eight-group real integration run completed after the temporary Edge extension issue was resolved. Do not apply it to production.

For Windows local PostgreSQL, extract the official PostgreSQL 17.11 vendor binary runtime under `.test-cache/postgresql-17.11-runtime/pgsql`. Then run:

```powershell
powershell -NoProfile -File scripts/run-postgresql-tests.ps1
```

The runner creates separate SCRAM-authenticated loopback clusters, runs both contract schemas, restores a custom-format archive into a separate blank database, verifies data/effective ACLs/RLS/receipts/host recovery, stops the servers and removes their password file. Ports 55432 and 55433 must be free. It leaves ignored synthetic archives/data for inspection. Cluster-global roles already exist in the restore cluster; this is not a hosted Auth/account restore.

For real staging tests, acquire **only the staging project's existing** publishable and secret keys from its authenticated API Keys dashboard into ignored `.test-cache/staging-credentials.json`. Required JSON fields are `url`, `publishableKey` and `secretKey`; `url` must equal `https://qmbwrbxbbshbavfhkujx.supabase.co`. Keep the file private and never paste values into chat, source or command arguments. Scripts reject every other target. Anonymous sign-ins are enabled in staging, email confirmation stays enabled, and direct table access stays denied. This intentionally small synthetic workflow does not establish production abuse controls or mail deliverability.

```powershell
node scripts/test-staging.mjs
node scripts/staging-invite-preview.mjs
```

The first command uses real Auth/JWT, confirmed fake hosts and anonymous guests; it records sanitized checks and retains synthetic data. Generated email OTP validation never delivers an email. The second creates a fresh browser fixture, builds the invitation with only the publishable key, starts loopback port 8090, and prints its URL. Enter `Synthetic Browser Guest`, two guests, Yes; save, claim Ice, suggest `Synthetic Browser Cups`, reload. In a second terminal run:

```powershell
node scripts/verify-staging-preview.mjs
```

That command signs in an independent verified host, verifies the browser RSVP/claim/suggestion, and edits the title without changing guest state. Refresh the browser and verify the host edit. Stop the preview with Ctrl+C. Remove local credential files after testing; subsequent runs can securely retrieve existing staging keys again. Do not publish the preview to the production invite hostname.

Read compatibility is precise: v2 preserves known-ID invitations and legacy fields, but the candidate's revoked direct SELECT grants mean unchanged old native binaries require an upgrade. Any temporary unrestricted legacy read compatibility would re-enable enumeration and needs separate review.
