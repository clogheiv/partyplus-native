# PartyPlus staging reconciliation and transition review

Engineering date: October 2, 2026, America/Chicago. Some evidence timestamps are October 3 UTC.

Follow-on batch: the [exact production security proposal](PARTYPLUS_PRODUCTION_SECURITY_ROLLOUT_2026-10-02.md) and [device/email/recovery qualification plan](PARTYPLUS_DEVICE_EMAIL_RECOVERY_QUALIFICATION.md) now supersede the transition outline below. Final release-gate staging checks and exact rollback rehearsal passed; a local Android staging APK is built. Physical device, delivered OTP linking and cross-project hosted restore remain open. Production is unchanged.

## Result and boundaries

The final candidate contract runs against the observed production table shapes in a completely separate **Free** Supabase project. Real Supabase Auth/JWT, multiple HTTP clients, independent PostgreSQL sessions and a real `pg_dump`/`pg_restore` passed, including the final null-revision correction. Production was inspected only through a metadata query inside `BEGIN TRANSACTION READ ONLY`; no customer rows were selected, exported, copied or changed.

| Environment | Project | Organization | Use |
| --- | --- | --- | --- |
| Live production | `typbofemqhjoiwbkdvuc` | clogher Labs, existing Pro organization | Catalog metadata only; no testing writes |
| Isolated staging | `qmbwrbxbbshbavfhkujx` | PartyPlus Staging, `umzfrympgetvlltbkqde`, Free | Synthetic accounts, parties and tests |
| Local PostgreSQL | Loopback only, `partyplus_synthetic` / `partyplus_restore` | Disposable clusters | Concurrency, observed-schema transition and restore |

The existing Pro organization's new-project form quoted an additional $10/month. That path was not submitted. A separate Free organization was created instead; Michael entered the staging database password and submitted creation. No plan upgrade or paid add-on was enabled. Supabase calls its primary branch “PRODUCTION” even on this isolated staging project; the **project reference**, not that branch badge, defines the boundary.

## Authoritative findings

Evidence: [production catalog export](staging-evidence-2026-10-02/production-metadata.json), produced by [metadata-only SQL](../supabase/production-metadata-export.sql). Export SHA256: `9830e20e7708dcf596d6c4a2f435ae31da2ae42c64f1fe7fa5854d5fc2639d88`.

- **C3 is confirmed in production metadata:** RLS is enabled, but eleven permissive policies allow anonymous/authenticated SELECT, INSERT and UPDATE on parties, and SELECT, INSERT, UPDATE and DELETE on items/RSVPs. The policies use unconditional `true`. Broad table grants also exist. No production exploit was attempted.
- Parties have **no DELETE policy**. On the synthetic metadata clone, an anonymous operation deletes child records while its parent DELETE affects zero rows. This explains an additional partial-deletion failure mechanism without testing it on live data.
- Party IDs are text; item and RSVP IDs are UUID. Production has `datetime`, `location_name`, address/coordinates and nullable legacy `guest_name`; the earlier inferred fixture did not fully represent these shapes.
- `claimed_by_user_id` and `created_by` are absent. The repository's earlier claim migration is not evidence of deployment. Existing claim labels cannot establish a principal's ownership.
- No `supabase_migrations.schema_migrations` relation exists. No PartyPlus tables appear in `supabase_realtime`; native subscriptions cannot be assumed to deliver updates. Candidate clients use explicit polling.
- The dashboard showed request traffic during the preceding day and an existing backup indicator. Neither proves actual customer activity or a successful recoverable backup. Production remains live. EAS build and published Netlify source provenance are now captured below; matching actual store releases remains unresolved.

## Reconciliation and verification

[The generator](../scripts/prepare-staging-contract.mjs) creates a guarded metadata-only legacy schema clone and an atomic staging installation. It never copies data or executes remote SQL. The clone includes the old permissive policies only to reproduce their failure; the same staging installation transaction removes them and revokes direct client grants before committing.

Additive reconciliation preserves UUID primary keys, party IDs, old columns, foreign keys and legacy RSVP/name uniqueness. It adds v2 fields and synchronizes canonical date/location with the old aliases. Typed record conversion and explicit RSVP insert columns avoid assuming text IDs or a particular column order. Legacy guest names/counts and claim labels survive; identity or ownership is never inferred from them.

[Deployed staging metadata](staging-evidence-2026-10-02/staging-metadata.json) confirms RLS, no legacy policies, no anon/authenticated table grants, intended RPC grants and fixed search paths. Private ledgers remain inaccessible through the client API. Synthetic Auth uses real `auth.users`, not the local test stub.

| Verification | Result | Practical limit |
| --- | --- | --- |
| Full regression suite | 71 passed, zero failed | Includes PGlite and final null-revision fix; not physical devices |
| PostgreSQL 17.11 | 14 contract tests and 5 observed-schema tests passed | Includes final null-revision fix; one PGlite-only restore test skipped |
| Real PostgreSQL archive restore | Passed | Separate blank database in same local cluster; existing test roles retained |
| Real Supabase Auth/RPC | Eight integration groups passed after final revision correction | Synthetic accounts; generated OTP, no delivered mail |
| Browser invitation → RSVP → claim → suggestion → reload | Passed against real staging | Edge desktop; loopback-served website, not published hosting |
| Independent verified host | Saw guest state; title edit preserved it; returning browser saw edit | SDK session, not an installed native app |
| ESLint / TypeScript | Passed | Source validation |

Concurrency includes same-operation retries, two same-name guest RSVPs, two suggestions and exactly one claim winner. Failure checks include UUID conversion rollback, payload reuse conflict, stale revision, unsigned/anonymous host denial, raw table/private ledger denial, guest delete denial and replayable tombstones. A second client signs in with the same email OTP API used by the account screen and retains host access after refresh. Global sign-out invalidates its refresh token; immediate revocation of an already-issued short-lived JWT is not claimed.

Restore compares exact synthetic rows, receipts, access evidence, effective ACLs, RLS and functions; it then executes denied anonymous deletion, receipt replay and verified host listing. PostgreSQL normalizes an explicit owner-only ACL to its equivalent default during restore, so effective ACLs are compared. A test-only assumption that random UUID sorting placed Ice first was corrected to find the item by ID.

Final source review reproduced a candidate-only conflict bypass: `v_revision <> NULL` evaluates to unknown, allowing a verified host edit with a null expected revision. The fix uses `IS DISTINCT FROM`, rejects null on both create/edit paths and leaves no mutation or receipt. Regression evidence includes the failing pre-fix case and passing tests against both local schemas and independent PostgreSQL. `prepare-staging-contract.mjs` also emits `.test-cache/staging-revision-patch.sql` to replace only the commit function in **staging**. After Michael updated the Edge extension, this patch was applied to `qmbwrbxbbshbavfhkujx`; refreshed metadata confirms the function, unchanged client grant denials and fixed search path. The final real integration rerun passed, including the null-revision rejection and unchanged authoritative snapshot assertion.

Evidence is under [staging-evidence-2026-10-02](staging-evidence-2026-10-02). Synthetic accounts and records are retained for inspection. Privileged keys/passwords are never tracked or included in evidence. The official PostgreSQL binary archive came from EnterpriseDB, linked by PostgreSQL's Windows download page; observed archive SHA256 is `80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F` (recorded integrity value, not an independently verified vendor signature). Temporary servers were stopped.

## Deployment provenance captured read-only

[EAS metadata](staging-evidence-2026-10-02/eas-build-provenance.json) was retrieved through the existing installed/authenticated CLI without starting builds or submissions. Project is `1baa13de-9930-4571-91dc-f16df7ec2bfe` / `PartyPlusNative`. The latest returned store-distribution builds are June 10, 2026: iOS version 1.0.3 build 15 (`ebad06eb-0e0c-43fc-a0fe-0ea9f7d6c7f2`) and Android version 1.0.3 build 12 (`02cf1dd2-fbf1-4e43-84fa-d0282a19636c`), both at `d1972a0a762b71e71869fe9dd230f29adc1c3184`. More recent August Android builds are internal development builds at `d4502b1573c5e69902dc7d651ad15f315e8feb54`. These records **do not prove which binary is currently released in either store**.

The authenticated [Netlify production deploy](https://app.netlify.com/projects/partyplus-invite/deploys/6a94a5c77c86e100080fe9fc) identifies published branch `backup/share-working`, commit `510430c04df1013e0f5825f70cc0d5caf4a4309b`, August 30, 2026, and primary domain `partyplusapp.com`. The deployed files are under `invite-web`. Auto-publishing from that branch is enabled; no setting was changed. Assessment HEAD `6af06cc` appears only as a September 1 **deploy preview**, not the published production revision. The deployment reports one of three redirect rules invalid; the exact rejected rule and installed-device impact are not yet established. Do not deploy or push to the production branch as a diagnostic. See [sanitized website provenance](staging-evidence-2026-10-02/netlify-provenance.json).

## Versioned legacy transition proposal

This is a **review plan**, not production authorization or an executable production migration.

1. Establish binary/site provenance, current usage and a rehearsed production backup/restore path. Inventory row-shape anomalies through separately approved handling; this metadata-only work did not inspect customer content. Confirm no duplicate/invalid identity assumptions before backfilling.
2. Ship and qualify isolated native preview builds plus a staging-hosted invitation. Verify actual email OTP templates/delivery, anonymous account linking without changing its UUID, expired sessions, local draft recovery and iOS/Android link behavior. Keep production package IDs and invite URL IDs unchanged.
3. Prepare a numbered, checksum-recorded production migration from the reconciled schema. Preserve original columns and IDs, add the v2 contract and private access/receipt ledgers, and keep guest collections independent. Review all roles/default grants and the exact write cutover together. Do not run the synthetic Auth or legacy clone scripts against production.
4. Bridge legacy hosts only after independent proof and an auditable evidence reference. Device cache/UUID and party ID alone are insufficient. Preserve ambiguous records and labels; do not silently claim or transfer them. Use assisted recovery when proof cannot be automated.
5. Preserve existing URLs through the live v2 invitation reader. Retire unsafe legacy mutations in a reviewed cutover. **The current candidate also denies direct legacy table reads:** old native binaries require an upgrade; the new web invitation preserves known-ID access. It does not provide transparent read compatibility to unchanged old binaries. Any temporary legacy read adapter/grant needs an explicit privacy review because unrestricted SELECT also enables enumeration.
6. Review staging/device evidence and exact rollback actions before requesting production migration, policy, website or store-release approval. Do not indefinitely retain anonymous destructive writes to avoid an upgrade requirement.

## Rollback and recovery proposal

- Before migration, take a verified backup and export schema/grant/policy/migration manifests. Restore into an isolated environment and verify Auth principals, access grants, IDs, receipts, legacy fields and guest state. Local SQL archive restoration is proven; hosted Supabase/Auth restoration and production recovery time are still unproven.
- During cutover, prefer a controlled read-only period if safe mutation service is unavailable. Route known-ID invitations to the validated reader; preserve drafts/outbox operations and explain delayed writes. Never treat a network timeout as proof a write failed.
- Keep additive fields, original identifiers, access evidence, receipts and tombstones. Roll forward a corrected RPC or revert a client to the last **v2-compatible** build after reconciliation. A receipt from an old operation remains authoritative even when its snapshot revision is old.
- Do not restore unconditional legacy policies or anonymous collection replacement as a rollback. Do not revert the database to a snapshot and erase post-backup customer operations without a separate approved reconciliation plan.
- No purge, receipt-retention, host-transfer or account-deletion policy was enacted. Production destructive changes remain separately gated.

## Remaining gates and next batch

No further product choice or spending is needed for the completed batch. Production C1–C3 remain open until approved rollout and verification. C1/C2 and C3 now have real staging evidence; H3 has real OTP/session evidence; H10 has a real staging browser journey. Physical iOS/Android, mobile browsers, delivered email/code templates, anonymous-to-verified linking, hosted restoration, actual store-release mapping and hosted CI remain open. The temporary Edge extension access issue was resolved by Michael; the final staging patch and tests completed afterward.

Next batch: qualify staging native previews and actual email/account-linking flows, verify store-release mapping and a hosted backup restoration, and finish the precise production cutover/upgrade communication and migration review. Framework upgrades and remaining dependency findings stay a separately controlled maintenance phase.
