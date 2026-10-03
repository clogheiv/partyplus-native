# PartyPlus modernization engineering log — 2026-10-02

## Review point and scope

Option B is implemented through Phase 1 containment and the locally testable parts of the Phase 2 contract and browser invitation. This branch is a nonproduction candidate, not a release. Nothing was deployed, published, merged, or migrated in production; no customer records were used as fixtures. There is no paid service or external notification integration.

Worktree: `C:/Users/clogh/partyplus-native/.worktrees/modernization-phase-1`.
Branch: `codex/modernization-phase-1`.
Original source HEAD: `6af06cc4b9d71a00869180672891f5b6795a31f8`.
Assessment baseline: `58ae63b` (`chore: preserve assessed modernization baseline`).
Isolation commit: `30e631f`. Implementation/test/CI commit: `2acfc8b`.
The original checkout's assessment changes remain separate. This local branch and its logical commits are the equivalent review point; it was not pushed because deployment hooks have not been established.

## Provenance and environment boundaries

- The GitHub source commit was verified as `fix: enforce create screen safe area`. Source HEAD does not identify the deployed database, invitation site, or store binary.
- A connector lookup returned no matching PR workflow runs in its filtered first page. This does not prove that no builds or deployments exist.
- A read-only OpenAPI/schema metadata request to the existing backend returned HTTP 401. No customer table query was made. The result does not establish that production is broken or that the published key is unusable for the existing application.
- Applied schema, RLS policies, grants, security-definer functions, constraints, migrations, and realtime publications remain unverified. `supabase/read-only-provenance.sql` is prepared for an authorized metadata-only export.
- Development and preview now require explicit local/staging configuration and use separate native package identifiers and schemes. Nonproduction clients reject the known production project. Invalid environment labels and privileged/URL-embedded credentials fail closed. A missing backend permits local work but cannot report a cloud save.
- Existing production package identifiers, invite IDs, and native scheme are preserved. Candidate invitation builds deliberately require local/staging and a development/preview scheme. Publishing needs a separately reviewed release configuration.

## Completed implementation

### Durable local state and acknowledgement

New parties allocate one ID before saving; editor drafts preserve form fields, unfinished item text, prepared item IDs, operation ID, base revision, and explicit save state. Pending writes are persisted before any request. Retries replay the same request rather than reconstructing it. A successful HTTP call alone cannot declare success: the receipt must acknowledge the operation and party and contain a valid authoritative revision.

If an acknowledgement is lost, the same operation can recover the receipt. If local caching fails after server success, the pending operation remains recoverable. Edits made after an uncertain save preserve both the original request and the newer form; after replay, the newer form requires its own save. Explicit edit discard archives the draft and operation atomically. Starting a new party preserves a recovery copy before replacing the form.

One repository serializes cache/draft/current-party operations. First-use device identity initialization is single-flight and preserves the existing ID. Corrupt data is never silently replaced with an empty collection; its raw bytes remain at the source key and a recovery record is captured when storage permits. Failed storage access blocks sending nondurable operations and gives a keep-open/retry message.

### Reads, guest changes, sharing, and host recovery

Invitation viewing performs reads; it no longer repairs the backend or initializes an anonymous Auth user. Guest actions use a durable outbox with signed principal binding, stable suggestion IDs, explicit claim direction, and operation receipts. Host edits never write an RSVP snapshot. Missing/unauthorized/offline/server errors have retry paths; route generations reject stale responses. A cached offline copy is labeled and cannot revive an authoritative deletion. Older receipts cannot downgrade a newer cache revision.

Share/copy operations reread the authoritative party and require committed persistence. Legacy payloads are display fallbacks and never convey server authority. Local duplicates open as drafts and do not eagerly create a cloud party. Remote deletion is acknowledged and replayable; post-commit cache cleanup failure is recoverable.

The host account screen implements email OTP and linking an existing anonymous principal to a verified account. New host mutations require a nonanonymous confirmed account. Host listings use server grants and refresh the local cache. Account-refresh errors are visible while saved parties remain available. Real Supabase Auth/email delivery has not been tested here.

Device ownership remains an editor/UI hint during the bridge period. A known legacy device UUID or party ID cannot grant server access. The candidate bridge records an evidence reference and signed principal in a private grant table. Its assisted-recovery fixture proves the contract, not the validity of any real user's ownership evidence.

### Candidate database contract

`supabase/nonproduction/10-v2-contract.sql` provides versioned RPCs for transactional create/edit, tombstone deletion, own RSVP upsert, individual suggestions, atomic claim/unclaim, public known-ID aggregate reads, and verified host listing. Operation receipts, operation/party locks, and revisions prevent duplicates and conflicting snapshots. Mutations lock in a consistent order. Host edits merge items and remove only explicitly named items; claimed removals conflict. RSVP changes release only that principal's claims. RLS/grants deny direct collection writes and private helper invocation.

The blank synthetic baseline is inferred from repository usage. It is explicitly guarded, includes a stub Auth schema, and is not an export of production. Neither SQL file is an approved production migration. The contract must be reconciled against authoritative metadata and tested with real Supabase Auth before promotion.

### Browser invitation

The candidate site displays live party details, RSVP, claims/unclaims, suggestions, and responses without mandatory installation. The existing marketing/legal pages remain. Public URL IDs and valid legacy aliases/payload names remain supported; candidate app links open the matching nonproduction scheme.

Server text is rendered as text, including an HTML-like synthetic title. Guest writes use the same durable domain outbox and verified receipts. Web Locks serialize storage and operations across tabs; browsers lacking that capability can read but receive an upgrade message for writes. Polling/focus refresh provides live updates while direct table grants stay denied. Production realtime delivery is not inferred from repository code.

## Verification and evidence

| Check | Result | Scope and limit |
| --- | --- | --- |
| ESLint and `tsc --noEmit` | Passed | Final source checks; no device execution |
| `npm test` | 65 passed, 0 failed | Pure domain, routing, adapters, SQL/RLS/grants, rollback, recovery |
| Expo export | iOS, Android, web passed; 18 static routes | Bundling, not installed-device or store validation |
| Invitation build | Passed with explicit loopback configuration | Privileged keys/production targets rejected |
| Browser journey | Passed | Synthetic guest; live read, lost RSVP acknowledgement, reload, same-op retry, claim, suggestion |
| Synthetic backup restore | Passed | PGlite dump/restore preserves schema, grants, IDs, bridge evidence and receipts |
| True concurrent PostgreSQL sessions | Prepared, not run | CI PostgreSQL 17 job; local Docker daemon unavailable |
| Supabase Auth, mail OTP, publication integration | Not run | Needs isolated project and authorized access |

SQL tests include independent guests preserving their RSVP/suggestion records; host title edits preserving guest state; one claim winner; unauthorized unclaim rejection; stale edits; simultaneous same-operation retry receipts; rollback after failure, including absence of a failed receipt; denied table enumeration/private helpers; UUID knowledge not granting ownership; assisted bridge; authorized deletion; and verified host recovery. Restore checks exercise the recovered host listing and deletion receipt replay, bridge evidence, retained guest IDs and denied anonymous deletion. PGlite serializes its connections, so competing-request tests are not evidence of parallel database sessions. The optional PostgreSQL harness uses separate pooled connections and refuses remote databases.

Browser fault injection committed the RSVP before returning a synthetic 503. After a reload, retry sent the same operation ID twice in total and the database contained one RSVP, one Ice claim, and one suggestion. Initial invitation reads preceded any synthetic guest-session creation. The local transport uses synthetic token-to-principal mapping; it is not proof of real JWT verification. The temporary server is stopped after evidence capture.

Evidence is in `docs/modernization-evidence-2026-10-02/`: test/export outputs, browser request/state JSON and screenshot, before/after npm audits, dependency paths, and lockfile-change report. All party/person/address values there are synthetic. Reproduction and recovery procedures are in [the nonproduction runbook](PARTYPLUS_NONPRODUCTION_RUNBOOK.md).

## Assessment disposition

These are branch-level dispositions; no production defect is declared resolved before deployment verification.

| Findings | Branch disposition | Remaining gate |
| --- | --- | --- |
| H1, H2, H4–H9, H11, H12 | Implemented with regression coverage for stable IDs, acknowledgements, read-only views, storage/identity races, guest retries, claims, stale loads and isolation | Real Auth/network/storage/device journey |
| C1, C2 | Unsafe client collection replacement removed; transactional candidate tested locally | Authoritative schema reconciliation, real concurrent sessions and staging rollout |
| C3 | New contract denies UUID/ID-based authority; verified-grant bridge fixture passes | Production policies/grants unknown; actual legacy evidence and transition design |
| H3 | Durable drafts and verified host listing/account UI implemented | Cross-device recovery and email-link integration in staging |
| H10 | Install-free live web candidate verified synthetically | Staging hosting/Auth/mobile-browser matrix and production release review |
| H13 | Meaningful test suite and CI added | Hosted CI has not run; physical devices/store build and production restore absent |
| H14 | Compatible patches reduce current audit to zero critical | 12 high, 23 moderate, 1 low remain; controlled maintenance plan below |

## Dependency triage

The refreshed starting audit reported 41 findings (2 critical, 15 high, 23 moderate, 1 low), versus the earlier assessment's 39. Feed differences are not necessarily newly introduced code defects. Compatible lockfile-only updates covered shell-quote, tar, xmldom, undici and each existing ws major line. Direct runtime package specifications and Expo SDK 54 did not change. No `audit fix --force`, framework major update, or downgrade was used.

After these patches: **36 findings: 0 critical, 12 high, 23 moderate, 1 low**. Counts include vulnerable packages and affected parent packages; they are not a count of distinct exploitable application attacks. Evidence records exact paths and advisory details.

| Category | Examples and treatment |
| --- | --- |
| Build/development/lint paths | Glob/minimatch/brace expansion, browserslist, YAML, flatted, image-size, node-forge, PostCSS, AJV/fast-uri, humanfs and Babel need compatible patch/SDK planning. Audit parent labels such as `expo` alone do not establish a shipped runtime path. Keep build inputs controlled; don't dismiss these as irrelevant. |
| Runtime path needing specific review | `nanoid` is used by navigation/router dependencies; `query-string`/`decode-uri-component` by navigation/router link handling. Review fixed-size generator call sites and malformed external links; upgrade compatible versions with routing/device regression checks. No blanket runtime-safety claim. |
| Transport paths already patched | `ws` includes a Supabase realtime Node dependency as well as tooling copies; `undici` includes Node transport paths. Browser/native transports differ, so reachability depends on the actual built target. |

Next maintenance should review resolved paths against built artifacts, patch compatible remaining packages where ranges allow, and plan the SDK upgrade as its own branch/batch with native regression tests. Audit recommendations that jump Expo majors are not accepted automatically.

## New findings and autonomous decisions

- A later authorization denial does not prove an earlier timed-out operation failed. The outbox records an attempted marker before sending and retains the original operation when prior outcome is uncertain. A definite first-attempt transaction rejection is archived and stops blocking unrelated actions. Regression tests cover both paths.
- A replayed old receipt can contain an older revision; cache/render logic ignores a downgrade while still acknowledging the original operation.
- Cross-tab browser writes need a lock around both storage mutation and operation execution. Older browsers are read-only until upgraded rather than silently losing operations.
- Draft discard must not destroy an uncertain save; an atomic recovery archive now retains its operation.
- Direct table grants are denied by the candidate contract. Polling is the explicit live-update fallback until publication/channel delivery is verified.
- Synthetic deletion uses a recoverable tombstone. Retention, purge, account deletion, host transfer, and operation-receipt retention are deferred to reviewed policy/migrations.
- Legacy guest UUID-based RSVPs/claims cannot be silently attributed to a newly signed principal. Existing labels are preserved; safe guest recovery/reconciliation remains unresolved. An unlinked anonymous session lost with device/browser storage is not cross-device recoverable.
- Corrupt storage bytes and recovery drafts are preserved, but a polished in-app recovery/export UI is still deferred. Do not advise users to clear storage to fix a load error.
- The compatibility period preserves reading and ownership hints, not anonymous destructive writes. An upgrade path and evidence-backed legacy grant process must precede production write retirement.

## Access needed and next batch

No new product decision is required for this review point. Needed external access is an authorized metadata-only export of the existing Supabase project and a separate nonproduction Supabase project with Auth configuration. Store/EAS/Netlify build-to-commit provenance also needs authorized read access. Credentials should be supplied through secure environment/connection configuration, never committed or embedded in logs.

Recommended next batch: capture schema/provenance; reconcile the candidate SQL with real constraints/grants; run PostgreSQL independent-session tests and isolated Supabase JWT/OTP/RLS integration; exercise two guest browsers plus a verified host on iOS/Android; verify cross-device return/recovery, offline replay, expired sessions, legacy bridge, publication/polling and backup restore. Prepare a versioned legacy read/write transition and production rollback plan. Then review staging evidence before requesting any production migration, deployment or store release approval.

## Subsequent batch: authoritative reconciliation and real staging

Michael authorized read-only production metadata and isolated free staging/testing. The earlier access-needed statements above describe the prior review point; this batch resolves the Supabase metadata/staging access gate.

Captured catalogs through an explicit read-only production transaction without selecting customer records. C3 is now confirmed: eleven unconditional permissive policies enable anonymous edits and child deletion. Missing parent DELETE policy produces partial legacy deletion in synthetic reproduction. Actual schema uses UUID item/RSVP IDs and legacy date/location/name fields; claim ownership columns are not deployed, no migration ledger exists, and no PartyPlus tables are in the realtime publication. Request traffic does not establish actual customer usage, so production remains live and untouched.

Created a separate Free organization instead of accepting the Pro organization's $10/month additional-project quote. Michael created the isolated project with his own database password. Project `qmbwrbxbbshbavfhkujx` now contains the metadata-matched candidate contract and real Auth. Its deployed metadata confirms RLS, removed legacy policies, revoked direct client grants and intended RPC grants. No spending, production changes or store/website publication occurred.

Reconciled canonical/legacy fields additively; preserved UUID keys, address/coordinates, RSVP names and legacy claim labels. Typed item/RSVP operations and explicit insert columns now handle observed constraints. The synthetic transition proves unsafe policy behavior and safe retirement without identity rewriting. Ambiguous legacy ownership remains preserved rather than assigned from UUID knowledge.

Validation:

- Full regression suite: **71 passed**, zero failed; lint and TypeScript passed.
- Independent PostgreSQL 17.11: **14 contract tests + 5 observed-schema tests passed**, with one PGlite-only restore case skipped on this path.
- Separate real `pg_dump`/`pg_restore`: exact synthetic data, effective grants, RLS, functions, access evidence and receipts restored; denied anonymous deletion, replay and host listing worked afterward.
- Real Supabase Auth/HTTP: **eight integration groups passed**, including stable receipts, concurrent same-name RSVPs/suggestions, one claim winner, transaction rollback, authorization denial, stale revision, independent-client email OTP recovery, session refresh/revocation and replayable tombstone.
- Actual browser guest against staging: live read, saved RSVP, claim, suggestion and reload passed. Independent verified host saw all guest state, edited its title without loss, and the returning browser displayed that title. The website was served on loopback, not deployed.

Autonomous corrections: made the Windows harness compatible with both Windows PowerShell and modern PowerShell; fixed a test-only random-UUID sort assumption; compare effective ACLs because PostgreSQL restores owner-only privileges using an equivalent default representation. Neither correction changed customer behavior. Temporary loopback servers are stopped, and local privileged staging credential files are removed after verification.

Final source review found a **new candidate-only** null expected-revision bypass. A failing regression reproduced it; `IS DISTINCT FROM` fixes it, and the updated local/independent PostgreSQL suites and restore pass. Staging's installed commit function and the recorded eight-group integration result predate that correction. A generated function-only staging patch and updated integration assertion are ready; applying/reverifying them requires the Edge extension update requested from Michael. This is an access limitation, not a request for production permission. Staging is not fully qualified against the final source until that step succeeds.

Evidence and the versioned transition/rollback proposal are in [the staging reconciliation review](PARTYPLUS_STAGING_RECONCILIATION_2026-10-02.md). C1/C2 now have real transaction/concurrency proof; C3 has authoritative production metadata and real staging denial proof; H3 has generated OTP/second-client recovery proof; H10 has a real staging guest/host journey. **No production finding is closed by this nonproduction work.**

Remaining: physical iOS/Android and mobile-browser qualification, actual email delivery/code templates, anonymous-to-verified linking, hosted backup/Auth restoration, EAS/store/Netlify source provenance, hosted CI and a reviewed production upgrade/cutover. Immediate validity of an existing short-lived JWT after global sign-out is not claimed revoked. The candidate preserves known-ID web invitations but denies old direct-table readers; unchanged old native clients need an upgrade. Edge control stopped after evidence capture because the extension requires an update.

Recommended next batch: qualify native staging previews and delivered email/linking flows, establish deployment provenance and hosted restoration, then finalize the exact production migration/compatibility review. No routine product approval is needed now; production migrations, policy changes, publication and any new spending remain separately gated.
