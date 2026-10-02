# PartyPlus engineering assessment

Assessment date: October 2, 2026. Repository: `C:\Users\clogh\partyplus-native`.
Inspected branch: `audit/modernization-2026-08-31`, HEAD `6af06cc`.

## Recommendation and release decision

**Choose B: a staged architectural refactor of the existing application.** Keep Expo/React Native, the installed application identities, existing party IDs, the Supabase database, and public invite URLs. Replace the persistence, authorization, synchronization, and link coordination mechanisms in small, independently testable phases. Selectively simplify screens after those contracts are reliable.

The app is small enough to repair without replacing the entire client. Its most serious defects are in data integrity and recovery, not a fundamental inability of React Native to deliver the product. A new client using these same write algorithms would still lose RSVPs and claims. A full rewrite also puts existing device-local ownership and parties at unnecessary migration risk.

**The core journey is not ready for aggressive promotion.** Local tests and bundle exports pass, but reachable algorithms can lose shared data, retry Save Party under a new identity, and present unsynchronized local state as usable party data. Backend authorization has not been established. Production promotion should wait for the acceptance gates below.

This assessment adds documentation and an isolated diagnostic harness. It does not implement a rebuild, change application dependencies or runtime behavior, deploy, publish, migrate production data, change package IDs or monetization, or purchase anything.

## Scope, history, and confidence

Reviewed all application routes, data modules, identity/local storage, link/share helpers, supporting components/hooks/theme/templates, tests, checked-in SQL, Expo/EAS settings, generated Android settings, invite website/functions/redirects, and relevant history. The repository has 135 tracked files; much of `assets/` is a saved design-reference webpage and images. No applicable repository `AGENTS.md` was found.

The August 31 audit is useful history, but its vulnerability totals, lack-of-tests statement, and unresolved first-batch findings are not the current baseline. September 1 commits address bring-list focus and top safe-area placement. This assessment rechecks the current code rather than treating earlier findings as observed production incidents.

Pre-existing working changes were preserved: `eas.json`, `src/data/parties.ts`, `src/data/partyRsvps.ts`, untracked `app.config.js`, `src/lib/supabaseErrorLogging.ts`, and `store-assets/`. The current checkout includes these changes; it is not evidence of what is installed from either store. Store build provenance and deployed invite-site revision remain unknown.

Confidence labels used below:

- **Reproduced:** the current module was executed with isolated in-memory adapters and the defective outcome was asserted. No production integration was exercised.
- **Confirmed code path:** source inspection establishes the reachable behavior, but this assessment did not execute it on a phone.
- **Verification required:** the repository lacks evidence needed to determine production exposure or platform behavior.

No production party records were read or written. Public invite-site reads were attempted without real party IDs, but the browsing tool could not access the site; this does not establish an outage. No Android device was attached. iOS compilation and physical-device testing were unavailable on this Windows host.

## 1. Current architecture

| Area | Current implementation | Consequence |
| --- | --- | --- |
| Client | TypeScript React Native with Expo SDK 54; New Architecture and React Compiler enabled | Viable foundation; upgrade needs a separate regression phase |
| Navigation | Expo Router entry, root Stack, Home/Create tabs, several invite/share redirect routes | Router handling overlaps custom Linking handlers and redirect effects |
| Create/edit | One approximately 1,400-line route, component state, name-array bring-list editor | UI, identity, local persistence, cloud save, and navigation are coupled |
| Party/RSVP | One approximately 1,500-line route, local/remote/payload hydration, two realtime channels | Race and failure state is distributed through component effects |
| Persistence | AsyncStorage whole-array cache under `partyplus.parties.v1` | Local writes are read-modify-write without serialization or a durable outbox |
| Backend | Supabase JS direct access to `parties`, `party_items`, `party_rsvps` | Aggregate saves use independent requests; no app RPC layer exists |
| Identity | A device-generated UUID stored as `userId`; `host_id` and RSVP IDs carry it | No implemented Supabase sign-in, verified principal, or account recovery |
| State | React component state plus AsyncStorage and Supabase realtime | No shared server-state cache or explicit sync state machine |
| Invites | `https://partyplus-invite.netlify.app/i/<id>` generated by `inviteShare.ts` | Current links require cloud persistence; they contain no fallback party payload |
| Invite web | Standalone static HTML/CSS/JS hosted separately from Expo web | It is an installation/open-app landing page, not a live RSVP client |
| Builds | EAS development/preview/production profiles; ignored generated Android tree | Native artifacts and Expo config can diverge; signing provenance must be checked |

Core routes are Home → Create Party → Party; Home → Parties → Choose Action → Party/Edit/Share; and `/i/[id]` or legacy share links → `/party/[id]`. Host reminders use the system share sheet, not automated messaging. Hosts read the same RSVP list/summary as guests; host management controls live in Choose Action.

`getRemoteParties()` and `updateRemoteParty()` exist but are not called by application routes. Edits call the same aggregate upsert used for creation. `src/partyStore.ts` is a second, older implementation using the same keys, with no current route imports. Hidden starter routes, starter UI helpers, the README reset instructions, and a smoke-test Netlify function remain.

## 2. Framework and dependency health

Installed versions match the lockfile for direct dependencies. `npm ls --depth=0` passes.

| Dependency/group | Installed version |
| --- | --- |
| Expo / Router | 54.0.32 / 6.0.22 |
| React / React DOM / React Native | 19.1.0 / 19.1.0 / 0.81.5 |
| React Navigation native / bottom tabs / elements | 7.1.28 / 7.10.0 / 2.9.5 |
| Supabase JS | 2.99.3 |
| AsyncStorage / datetime picker | 2.2.0 / 8.4.4 |
| Reanimated / Worklets / Gesture Handler | 4.1.6 / 0.5.1 / 2.28.0 |
| Safe Area Context / Screens | 5.6.2 / 4.16.0 |
| React Native Web / URL polyfill | 0.21.2 / 3.0.0 |
| Vector icons / base-64 | 15.0.3 / 1.0.0 |
| TypeScript / ESLint / Expo ESLint config | 5.9.3 / 9.39.2 / 10.0.0 |
| Node / npm / Java / Gradle wrapper | 24.13.0 / 10.9.8 / 17.0.17 / 8.14.3 |
| Other Expo modules | Clipboard 8.0.8; Constants 18.0.13; Dev Client 6.0.20; Font 14.0.11; Haptics 15.0.8; Image 3.0.11; Linking 8.0.11; Splash 31.0.13; Status Bar 3.0.9; Symbols 1.0.8; System UI 6.0.9; Web Browser 15.0.10 |

React Native lists 0.81 as unsupported upstream. Expo SDK 54 has a separate maintenance window approaching its end; do not conflate those policies. SDK 57 is the stable upgrade candidate in the inspected official documentation; SDK 58 is in beta. Upgrade SDKs incrementally and qualify the selected stable patch at implementation time. [React Native releases](https://reactnative.dev/releases/), [Expo SDK 57](https://expo.dev/changelog/sdk-57), [SDK 58 beta](https://expo.dev/changelog/sdk-58-beta), [Expo upgrade guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

This upgrade is more than a version bump: SDK 56 changes Expo Router's relationship to React Navigation. Direct imports used here for focus, header height, theme, and tab buttons must be reviewed/migrated. Later SDK requirements can also affect minimum supported iOS versions; measure the existing user impact before selecting a release target. [Expo SDK 56 release notes](https://expo.dev/changelog/sdk-56).

The offline bundled-version check flags declared `@react-navigation/native ^7.1.28` against expected `^7.1.8`. The installed 7.1.28 satisfies the latter semver range, so this is not evidence of a runtime-incompatible version. Current server-recommended Expo patch alignment was not verified. The earlier audit's eight patch mismatches should not be repeated as today's confirmed count.

After explicit user approval, `npm audit --omit=dev` completed: **39 affected package entries: 2 critical, 14 high, 22 moderate, 1 low**. These include propagated dependency findings; they are not 39 independent mobile exploits. Critical entries are `shell-quote` and `tar`. Both originate in tooling paths here. `undici` is under Expo CLI. `ws` appears in Supabase realtime as well as development tooling, and vulnerable URI decoding is in navigation dependencies; assess native/browser/Node reachability separately. npm proposes major upgrades for parts of the tree and even a Router downgrade for one finding. Do not apply those aggregate suggestions blindly or run `npm audit fix --force`. Refresh compatible transitive fixes in an isolated branch, retain Expo package coherence, and then perform the planned SDK upgrade. Full machine-readable results are retained with assessment evidence.

The direct `buffer` import in Party view currently resolves through a transitive package. Declare an intentional dependency or consolidate decoding instead of relying on hoisting. Native date picker, safe-area-context, and AsyncStorage are purposeful dependencies; replacing all of them is unnecessary. Remove unused starter code/dependencies only after an import and platform audit.

## 3. Critical findings

### C1 — Snapshot writes lose other guests' RSVPs and claims

**Reproduced.** `src/data/partyRsvps.ts:84` and `src/data/parties.ts:287` delete all rows belonging to the party and insert the caller's snapshot. Party screen RSVP, claim/unclaim, and suggestion actions call these functions. Aggregate create/edit also replaces both child collections.

Example: two guests load the same party. A saves an RSVP, then B submits its older snapshot containing only B. A disappears. More seriously, a host's cached party can contain no RSVPs; editing its title invokes `createRemoteParty()` and erases newer cloud RSVPs. The diagnostic harness reproduces both cases. This is not limited to exactly simultaneous network requests.

Required replacement: one RSVP upsert keyed by `(party_id, guest identity)`, one suggestion insert, atomic conditional claim/unclaim, and host edits that never replace guest responses. Host list edits must preserve stable item IDs and detect stale revisions. RSVP name/status changes and any claim releases/renames should be transactionally consistent. Add multiple-client tests before exposing the new contract.

### C2 — Aggregate saves and deletes can leave partial or empty data

**Reproduced for save/item failure; confirmed delete sequence.** `src/data/parties.ts:172`, `:248`, and `:265` issue independent requests. Parent upsert precedes parallel child replacements; each replacement deletes before inserting. A rejected insert leaves the old collection gone. Parent and one child collection can succeed while another fails. Deleting children before the parent can leave a surviving party stripped of data.

Required replacement: authorized transactional database operations for aggregate create/edit/delete and related RSVP/claim transitions. Give operations stable idempotency keys so retries after ambiguous network outcomes do not create duplicates. Check affected rows and return an authoritative commit result. Preserve existing IDs and child references; do not "fix" this by clearing production tables.

### C3 — Backend ownership enforcement is unverified and device identity is forgeable

**Confirmed client model; production exposure requires verification.** `src/lib/ids.ts:27` returns an AsyncStorage UUID. No application code signs into Supabase. Remote mutations constrain party ID but do not establish a verified host principal. The four migrations contain no RLS policies or grants and do not define the original parties/items schema. This does **not** prove production RLS is disabled; it means the repository cannot establish that writes and reads are appropriately restricted.

Current edit/management checks prevent ordinary guest UI access when a known `hostId` differs. They are useful defense in depth, not server authorization. Missing `hostId` is allowed by the edit route but does not grant controls in Choose Action. Supplied payload ownership metadata is untrusted. Do not grant a new authenticated user ownership merely because they submit an existing device UUID or party ID.

First inspect an authoritative, read-only export of schema, RLS policies, grants, functions, realtime publication, constraints, and applied migrations. Then design verified host identity and guest access. Supabase anonymous Auth can provide a signed guest principal, but anonymous-session loss still requires a recovery strategy; adding Auth alone does not recover legacy hosts. Use an explicit legacy ownership migration/recovery procedure, with stronger proof where needed. Test with real `anon`/authenticated principals in isolated staging, not a service-role bypass. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous).

This is a release-blocking uncertainty. No destructive authorization probe was performed against production.

## 4. High findings

| ID | Finding and confidence | Evidence, impact, and required action |
| --- | --- | --- |
| H1 | Save retry allocates another party ID — confirmed code path | `app/(tabs)/create-party.tsx:539` generates an ID on every new save. A failed cloud call returns while the form remains in create mode. Retry can leave duplicate local parties and partial cloud parties. Keep a durable draft ID across attempts and use server idempotency. |
| H2 | Cloud success is not positively acknowledged — reproduced adapter result, confirmed caller | `createRemoteParty()` returns null when configuration is absent; it can also return null if post-write readback sees no row. `handleSave:596` ignores its result and proceeds to success/share. RSVP/claims similarly skip remote work when unconfigured and report success. Validate configuration and require confirmed cloud commit before declaring an invite ready. |
| H3 | Returning hosts depend on one device cache — confirmed | `app/load-parties.tsx:28` reads only AsyncStorage. No host-filtered remote recovery/listing or account recovery exists. After cache/identity loss, old parties and controls cannot reliably be recovered. Preserve current local keys, introduce verified host listing and recovery, and never replace the device identity before mapping existing ownership. Android backup may help in some situations; it is not a product recovery contract. |
| H4 | Invite viewing can write cloud data — confirmed | `app/party/[id].tsx:221–257` treats an empty cloud bring list as damage and writes cached or decoded payload items back, without a host check. Empty may be intentional or a transient delete/insert interval. A view can restore removed items or erase newer ones during a race. Make viewing read-only; repair only through an explicit authorized, revision-checked operation. |
| H5 | Local corruption and concurrent writes can lose parties — reproduced | `src/lib/partyStore.ts:55–92` converts invalid data to an empty list and saves whole-array snapshots without a lock. Concurrent upserts lose one party; the next save replaces corrupt storage instead of preserving it for recovery. Validate/migrate with backups, distinguish corruption from empty state, and serialize mutations or use transactional local storage. |
| H6 | First-use identity initialization races — reproduced | Concurrent `ensureUserId()` calls can return different IDs while the last is persisted. A party can then carry an owner ID differing from the returning device ID. Use one initialization promise or serialized identity service; retain existing valid IDs. |
| H7 | Failed changes have alerts but no durable retry protocol — confirmed | RSVP/claim/suggestion handlers update UI/local cache before cloud acknowledgement. Alerts added previously disclose sync failure, but a refresh can overwrite the pending change. Retrying a failed toggle may unclaim instead; retrying a suggestion can create another ID. Add explicit pending/failed/committed operations with stable IDs and operation-specific retries. |
| H8 | RSVP/claim reconciliation can clear claims from incomplete state — reproduced pure-module behavior | `src/lib/partyLogic.ts:99` clears claims when no Yes RSVP exists. Independent realtime refreshes can observe a transient empty RSVP table and normalize claims away. A subsequent snapshot write can persist the loss. `saveRsvp()` also adjusts claims locally without persisting that item change atomically with the RSVP. Treat incomplete reads as incomplete, and enforce shared claim transitions in the backend. |
| H9 | Native invite loading has no useful failure recovery — confirmed | The Party route retries twice, swallows remote exceptions, then shows "Party not found" with only Home. Its initial load lacks cancellation/route-generation guards and does not reset loading for every new ID. A slow prior invite can update a newer route. Separate missing/offline/denied/server failure, add Retry, preserve the ID, and cancel or ignore stale loads. |
| H10 | Website cannot display current party data or accept RSVPs — confirmed | `invite-web/index.html:1007–1107` never fetches party data. Current links contain no `d` payload, so guests see a generic invitation and ID, then Open/Get App. The Netlify function only returns a smoke-test JSON response. There is no implemented install-to-invite handoff. Add live web invite viewing and preferably guest RSVP, or explicitly guide users to reopen their original link after installation. |
| H11 | Local failures can escape without actionable feedback — confirmed | Create save has an outer finally but no catch for identity/storage/JSON/current-pointer failure. Party load, RSVP, claim, and suggestion similarly have uncaught local failure paths. A cloud commit can succeed before local bookkeeping fails, yielding ambiguity. Catch by stage, preserve draft/operation state, and distinguish "saved remotely, local cache failed" from total failure. |
| H12 | Development/preview can mutate production backend — confirmed configuration risk | All EAS profiles use the same Supabase project. Development Android changes package suffix but not backend; iOS does not receive a separate bundle identifier in the existing dynamic config. Safe-looking QA can affect live data. Create isolated staging and explicitly separate client variants, link routing, and backend selection before integration tests. Preserve production package IDs. |
| H13 | No tested release/migration safety net — confirmed repository gap | The ten tests cover item-name reconciliation and focus helpers, not saves, links, RLS, concurrent writes, recovery, or the full funnel. No CI workflow is tracked. Add staging integration tests, device end-to-end tests, restore/migration fixtures, and build/release gates. Nine assessment reproductions are evidence of defects, not passing acceptance tests. |
| H14 | Dependency security/maintenance debt — confirmed audit | The refreshed audit has 2 critical and 14 high entries, with tooling and potential runtime paths requiring separate reachability triage. Resolve in a coherent dependency maintenance phase; preserve and test router/native compatibility. |

## 5. Medium and low findings

| Severity / ID | Finding | Evidence and disposition |
| --- | --- | --- |
| Medium M1 | Realtime can silently go stale | Both `.subscribe()` calls ignore status; refresh callbacks use empty catches. No foreground resync or party-row subscription exists, and realtime state is not cached durably. Hosts can miss RSVP changes or event details. Show freshness/connectivity and revalidate on focus, foreground, and reconnect. |
| Medium M2 | Links have several overlapping routing owners | Root custom initial/runtime URL handling, automatic Router linking, `/i`, `/__share`, and Share effects coexist. The exported `linking` object is not explicitly passed to a navigator. Preserve aliases but converge on one validated resolver and one navigation owner; test cold/warm/same-screen/rapid links. Startup overlay has no explicit failure recovery if the target never resolves. |
| Medium M3 | HTTPS app association is absent in inspected config | No iOS associatedDomains or Android verified HTTPS intent filters appear in Expo config/generated manifest. Website buttons use the custom scheme. No association files are tracked. Existing custom-scheme behavior can still work, but direct HTTPS opening/install continuity is not guaranteed. Add associations as an additive change after verifying signing/domain control. [iOS links](https://docs.expo.dev/linking/ios-universal-links/), [Android links](https://docs.expo.dev/linking/android-app-links/). |
| Medium M4 | Legacy identifiers/payloads can change meaning | Edit uses `ensureUuid(partyId)` and normalizes non-UUID item IDs to newly generated IDs. Legacy party IDs can thereby be duplicated under a different identity and old invites stay pointed at the original. Read adapters accept several legacy columns; write adapters emit fewer fields and omit `theme`, `t`, and `createdBy`. Preserve exact existing IDs and define explicit versioned adapters rather than silent identity/schema rewriting. |
| Medium M5 | Invalid-date fix is incomplete for existing web parties | Edit loads both `partyDate` and `webDateText`. Save starts with `partyDate.toISOString()` and only parses text if absent (`create-party:555`). Editing or corrupting web date text on an existing dated party can be ignored. Use one authoritative date representation per platform and test create/edit/clear/invalid. |
| Medium M6 | Timezone intent is absent | Picker wall time becomes UTC ISO; viewers format in their timezone. This may be correct for a fixed instant but confusing for a location-based event without an explicit timezone. Preserve old instants; add timezone semantics only after a product decision. |
| Medium M7 | Draft persistence/navigation is fragile | Create resets on focus and has no durable form draft or universal navigation-away guard. An unfinished bring-list text field is not included in Save unless Add Item was tapped. Preserve draft state, handle pending input explicitly, and guard tabs/back/app interruptions as well as the existing Cancel action. |
| Medium M8 | Safe area/large text are only partially verified | Home/Create use safe-area-context and scrolling; Create modal overlays now account for top inset. Date/template sheets remain non-scrollable with a fixed picker height, and other text/row/stepper constraints remain. My Parties header/error state sits outside its list scroller. Test largest system text, keyboard, short displays, notch, and iPad before declaring these fixed. |
| Medium M9 | Schema and recovery operations are not reproducible from repo | No original parties/items schema, policy baseline, database-generated TS types, backup/restore runbook, or policy tests are tracked. Existing SQL backfills and primary-key changes cannot simply be replayed on production. Capture the actual baseline, test migrations on representative legacy fixtures, verify constraints/indexes, and plan restoration before rollout. |
| Medium M10 | Native/build configuration can drift | Ignored generated Android tree says versionName 1.0.0/versionCode 1; Expo says 1.0.3 and EAS uses remote versioning. Local release configuration uses debug signing. These are local artifacts, not proof of store signing/version defects. Establish the actual EAS/prebuild path and signed artifact manifest. Audit merged permissions; current main manifest includes storage and SYSTEM_ALERT_WINDOW permissions. |
| Medium M11 | Debug logging is inconsistent | The uncommitted Supabase logger is development-only and redacts caller-provided text, but screens/share/root still log raw errors, titles, IDs, or URLs unconditionally. Adopt one sanitized logger and aggregate outcomes without party content; observability vendors/privacy changes need a separate decision. |
| Low L1 | Duplicated/dead code and starter instructions | Old `src/partyStore.ts`, hidden starter routes, unused helpers/assets, two Netlify configs, and reset-project instructions increase maintenance risk. Document the real workflow and remove unused code only after route/import verification. Do not run reset-project. |
| Low L2 | Storage key aliases are inconsistent | Cancel/reset write/remove `currentPartyId`, while the store uses `partyplus.currentPartyId.v1`. `hostPartyIds` is maintained but does not authorize current controls. Consolidate intentionally and migrate key aliases without clearing user data. |
| Low L3 | Android Create tab icon lacks a mapping | The tab requests `plus.circle.fill`, absent from the MaterialIcons map. A broad type assertion masks this. Add a typed exhaustive mapping. |
| Low L4 | Small UX/a11y gaps remain | Maps, Undo, missing-party Home, and starter routes have inconsistent semantics/error handling; no complete screen-reader journey was run. Guest/host views and Share rely on contextual state rather than explicit party selection. Finish the core device/accessibility pass before visual redesign. |

## 6. Condition of the Save Party workflow

Current sequence: trim/validate title → obtain device identity → allocate/normalize party ID → load cached edit data/check known host → compute date and item identities → save the full local party → upsert cloud parent → replace cloud items and RSVPs → read cloud aggregate → write current-party pointer and legacy host index → display saved/share dialog.

Useful existing behavior to retain: a synchronous ref guards double taps, the button shows Saving, the new-party invalid web date check aborts, item reconciliation preserves known names/claims across removal/insertion, and caught remote failures block the immediate share prompt. These fixes are present and the helper tests pass.

Remaining problems: partial cloud saves, unacknowledged null results, new IDs on retry, stale host snapshots replacing guest data, unhandled local failures, and no persisted draft/sync status. The failure alert always blames items/Supabase even if the parent, RSVP write, or readback failed. A locally saved failed party can still be selected and shared later; Share does not check a durable cloud-ready state. A successful write followed by a failed read is indistinguishable from a failed write.

Target contract: allocate a draft ID once; persist a recoverable local draft; record a pending operation; execute one authorized, idempotent transaction; persist its commit result; then show **Invite ready** and allow sharing. Failures retain the same ID and show a direct retry. Offline/local-only state must be durable and visible. Updates should patch host-controlled fields and authorized item changes rather than resubmit RSVP snapshots.

## 7. Invitation, web, and RSVP condition

Preserve the existing HTTPS host/path and `partyplusnative://party/<id>` scheme. Current native parsing also supports `i/<id>`, Android intent normalization, and `_share`/`__share`/`share?id=...`, with `d`/`data`/`payload` aliases in parts of the code. Legacy payload readers do not agree on all formats; native Party uses UTF-8 Buffer decoding, Share uses base-64/URI decoding, and the website reads abbreviated fields. Formalize these as compatibility fixtures before consolidation. Validate payloads and URL sources; payloads should never establish ownership or trigger backend repair.

System sharing is centralized and includes current details and one ID-only HTTPS link. The iOS interaction/keyboard delay is intentional and should be preserved until device tests justify changing it. Opening the share sheet is not proof the recipient received a usable invite or that the cloud party exists.

The website's previous decoded-payload HTML injection is fixed in the checked-in code: it builds DOM text nodes. Its remaining `innerHTML` assignment uses fixed legal-page templates, not decoded invite values. Deployment of this fix was not verified. The website supplies correct Android package and iOS App Store links; it provides neither a current party preview nor web RSVP. Installation loses invite context unless the user returns to the original invitation; no deferred-link mechanism is implemented.

RSVP name/status/count validation and accessible choice/save states are present. Each device identifies one RSVP per party. Device changes can create another RSVP, and shared devices cannot represent independent people without a defined product model. Whole-party snapshots still undermine this flow; changing Yes to No/Maybe or renaming a guest also needs an atomic claim transition. Host totals count attendees, not distinct RSVP submissions. Guest visibility currently includes other RSVP names/counts; preserve or change that only through an explicit privacy/product decision.

## 8. Mobile and release risks

Production package/bundle identifier is `com.partyplus.app`; App Store ID `6762475398`; Expo project ID `1baa13de-9930-4571-91dc-f16df7ec2bfe`; custom scheme `partyplusnative`. Keep all production identities and existing signing continuity. The uncommitted development Android package suffix is not a reason to change production identity.

Android uses Hermes, New Architecture, edge-to-edge, portrait orientation, singleTask launch, and adjustResize. The local Gradle run confirms API 36 compile/target, minimum 24, Kotlin 2.1.20, and NDK 27.1.12297006; actual production signed artifacts must still be inspected. Extra manifest permissions and debug signing require provenance/merged-manifest review, not assumptions about what is live. Both installed prod/dev clients may contend for the same custom scheme during QA.

iOS tablet support is enabled; orientation is portrait; no iOS native directory is present. Date sheets, keyboard offsets, share sheet, VoiceOver, tablet layouts, store signing/versioning, and HTTPS associations need an Apple build/device pass. Later SDK iOS minimum changes should be assessed against the current user population.

The old safe-area/focus fixes have structural and helper-test support but are not physically verified in this assessment. A passing bundle export does not establish that interactive controls remain reachable on real phones.

## 9. What to preserve and replace

**Preserve:** all existing IDs and foreign-key relationships; local `userId` and cache keys until an explicit migration; existing host controls and valid authorization intent; exact store identities/signing; old URL aliases/payload formats; current invite domain/path; current shared-data semantics; system sharing; useful safe-area, scroll, input, accessibility, date validation, and item reconciliation fixes.

**Replace:** destructive collection replacement; implicit local/cloud success; view-triggered repair; device UUID as authorization proof; fragmented routing/load effects; whole-array unsynchronized storage writes; silent realtime failures; unvalidated payload/schema adapters; generic errors and non-idempotent retries. Consolidate the duplicated store and extract domain operations/hooks from screens. A large new state-management framework is not required; use one explicit server-state/cache strategy and one draft/outbox owner, and add dependencies only where they remove demonstrated failure modes.

## 10. Modernization options

| Option | Reliability and maintainability | Time and migration/release risk | Assessment |
| --- | --- | --- | --- |
| A: modernize in place | Helps dependencies and UI, but patch-only work leaves distributed data logic fragile | Shortest initial effort; cumulative regressions likely | Useful maintenance subphase, insufficient overall |
| B: staged architectural refactor | Repairs contracts first, introduces tests, and reduces screen coupling | Moderate effort; smallest controlled migration surface | **Recommended** |
| C: rebuild major portions, preserve backend/contracts | Can improve screens/services selectively; unsafe if existing backend contract is preserved unchanged | Higher UI effort and review risk | Use selectively inside B after safe contracts exist |
| D: new client with incremental migration | Gives a clean client, but still needs backend/identity repair and cache migration | Highest parallel maintenance and user-continuity burden | Reserve for evidence that existing client cannot be repaired economically |

No finding demonstrates that a full new client is currently the safest or fastest route. Testable data operations and a coherent cache will make later screen replacement cheaper if it becomes necessary.

## 11. Proposed implementation phases

Effort bands below assume one experienced engineer, access to an existing isolated backend, timely owner decisions, and device testers. They are planning estimates, not commitments; store review and legacy recovery can extend elapsed time. Some maintenance can proceed alongside backend design, but do not combine all migrations into one release.

| Phase | Work | Exit gate | Indicative effort |
| --- | --- | --- | --- |
| 0: establish baseline | Identify installed store/source revisions; export schema/policies read-only; verify backup restoration; isolate staging; capture legacy ID/cache/link fixtures; add CI baseline | Reproducible build and representative nonproduction data; no QA writes to production | 2–4 engineering days after access |
| 1: contain client failure paths | Stable draft IDs; explicit configured/committed state; stage-aware catches; remove guest read-repair; retryable/cancellable loads; serialize identity/local writes; preserve corrupt data/drafts | Fault-injection tests retain one ID, prevent unready sharing, and preserve local parties | 3–6 days |
| 2: repair backend integrity/security | Transactional create/edit/delete; row-level RSVP/suggestions; atomic claims; authorization/RLS/grants; revisions/idempotency; ownership bridge and recovery fixtures | Multi-client and policy tests pass, existing IDs/invites survive, recovery plan reviewed | 1–3 weeks; legacy proof may dominate |
| 3: refactor synchronization/screens | One repository/domain layer and cache owner; durable operation status/outbox; foreground/reconnect revalidation; simpler form/party hooks; host-filtered cloud listing | No lost update or silent pending state across restart/offline/reconnect | 1–2 weeks |
| 4: complete invite journey | One link resolver with aliases; additive HTTPS associations; live web preview and chosen RSVP/install fallback; platform/browser matrix | Same invite works cold/warm, installed/uninstalled, across Android/iOS/web | 3–7 days, more if web RSVP is chosen |
| 5: maintenance/platform qualification | Compatible dependency repairs; incremental SDK upgrade toward qualified stable SDK 57; Router import migration; regenerate/review native artifacts; large-text/a11y verification | Native builds, signed manifest/signing checks, supported devices and legacy fixtures pass | 1–2 weeks |
| 6: release preparation | Pilot plan, migration/rollback rehearsals, measured core-loop outcomes, owner review | All blockers closed and production/store rollout explicitly authorized | 2–4 days plus external review |

A first containment batch can be much smaller than the complete modernization. It does not make the app dependable while C1–C3 remain open. Expect roughly 4–8 engineering weeks for the full sequence under favorable access/recovery conditions, then revise after Phase 0. Do not perform a production migration or release as an automatic continuation of this assessment.

Compatibility rollout must be additive and versioned. Old installed clients can keep using destructive writes even after the new client improves. Plan how those writes will be restricted or retired; do not leave insecure legacy access indefinitely, and do not claim simultaneous full backward write compatibility and stronger authorization without proving it. Reader compatibility and preserved invite IDs should survive throughout. Backend rollback must not reintroduce destructive writes or expose ownership; keep backups and use feature gates to pause affected writes if necessary.

## 12. Testing and acceptance strategy

| Layer | Required evidence |
| --- | --- |
| Local/domain | Stable party/item/guest IDs; legacy parsing/schema/cache migration; identity initialization concurrency; serialized storage; corrupt-state recovery; pending input/date edit; claim/name/status invariants |
| Adapter/fault injection | Failure/timeout before and after each operation; unknown commit result; readback denial; storage failure after cloud success; restart with pending outbox; same-ID retry; no success on absent config |
| Isolated database | Transaction rollback; idempotent repeats; unique/FK/check constraints; two concurrent RSVPs; two guests claiming one item (exactly one wins); host editing during guest writes; delete permissions; realtime setup |
| Authorization | Actual anon/authenticated host/guest/stranger principals; direct edit links; forged host/payload IDs; reading permitted party versus unrelated parties; denied impersonation/update/delete; legacy ownership proof and recovery |
| Link/web | Every existing URL alias/payload fixture; Unicode and malformed values; deleted/missing/offline/denied party; rapid incoming links; cold/warm/resumed app; no writes on viewing; installed and newly installed flows; iMessage/SMS/email/browser handoff |
| Device end-to-end | One real iPhone host → Android guest and reverse; create/edit/save/share/open/RSVP/claim/host refresh/return/relaunch; large text, VoiceOver/TalkBack, keyboard/safe area, small screens and iPad |
| Upgrade/release | Same-package in-place update from currently installed versions; local caches and ownership preserved; signing/versioning/permissions/associations verified in artifacts; staging-only debug and production-candidate smoke tests; rollback rehearsal |

Release gates:

1. Successful create returns one authoritative party ID; failed/repeated saves never create accidental duplicates or declare an unready invite ready.
2. At least two independent guests can RSVP/claim while a host edits without losing responses, suggestions, or claims. Conflicts are explicit.
3. A host sees committed guest responses after foreground/reconnect within an agreed freshness target, with a stale indicator when that target cannot be met.
4. A failed RSVP shows Pending/Retry, survives restart, and either commits exactly once or reports a conflict. No unexplained disappearance.
5. A stranger cannot impersonate a host or another guest by supplying IDs or a crafted invite payload.
6. Existing local parties, legacy IDs, installed-app ownership, and invitations pass upgrade/migration fixtures. Recovery limitations are explicit.
7. An uninstalled recipient has a tested path from invite to view/RSVP; web RSVP or returning to the original link must be a deliberate, clearly guided flow.
8. Core controls remain reachable at maximum supported text size and with screen readers on both platforms. Native/store artifacts pass qualification.

As a proposed promotion threshold, run at least 30 complete two-device journeys across the stated matrix with no data-loss/security failures and no ambiguous success, and verify fault cases separately. This sample is a release gate, not statistical proof of production reliability. Select explicit latency/freshness targets with the owner and collect coarse success/failure outcomes without guest names, addresses, notes, or full invite URLs.

## 13. Verification performed

| Check | Result and limits |
| --- | --- |
| Existing `npm test` | Passed 10/10 item identity/order and focus geometry/helper tests |
| `npm run lint` | Passed with zero warnings/errors on initial baseline |
| `npx --no-install tsc --noEmit` | Passed |
| `npm ls --depth=0` | Passed; installed direct dependencies agree with lockfile |
| Isolated assessment harness | 9 defects reproduced using current TS modules and in-memory adapters; no live DB/policy/device behavior verified |
| Expo export, all platforms, offline | Passed Android/iOS Hermes bundles and web bundle/static rendering; 17 static routes exported; this is not a signed native build |
| Expo package check, offline | One declared navigation range warning; offline freshness limitation applies |
| Cached Expo Doctor 1.20.4 | 15/18 passed; schema/directory checks could not complete due network restrictions; navigation range warning above. Not a clean doctor result |
| `npm audit --omit=dev` | Completed after user approval; exit 1 denotes findings, not a failed audit. 39 entries: 2 critical/14 high/22 moderate/1 low |
| Offline Android debug compilation | First `assembleDebug` compiled native code but failed at `packageDebug` after 5m39s. A focused `packageDebug --stacktrace` retry succeeded in 35s and produced a debug APK. Initial packaging root cause remains unknown; no clean build or device launch verified |
| iOS native compilation/device matrix | Not performed: Windows host and no attached test devices |
| Production policies/data and deployed web revision | Not verified; no production database operations performed |

Reproduce the local assessment with `node scripts/assessment-diagnostics.cjs`. It deliberately asserts existing bad outcomes and will need to be converted/replaced with acceptance tests when defects are repaired. Do not interpret its successful exit as application reliability. The harness itself passes ESLint. Detailed diagnostic, audit, Doctor, export, and Android logs are saved under `docs/assessment-evidence-2026-10-02/`. `git diff --check` passes, and the three pre-existing tracked changes retain their original diff sizes.

## 14. Decisions and access needed

No decision was needed to finish this repository assessment. Before implementation/release planning, resolve:

1. **Host identity/recovery:** approve a verified host identity and recovery model. Recommended: preserve current device ownership during an explicit bridge, offer a recoverable account/link mechanism, and define assisted recovery for records with no verifiable ownership proof. A local UUID alone is insufficient proof.
2. **Guest installation requirement:** recommended live web view/RSVP so recipients can respond without an installation detour; alternatively accept the documented install-and-reopen-link flow. This affects Phase 4 effort.
3. **Access for Phase 0:** read-only authoritative Supabase schema/policy/grant/publication export, backup/restore evidence, applied migration inventory, store/EAS build provenance, and Netlify deploy configuration; identify an isolated staging destination before any integration writes. Do not paste service-role secrets into chat.
4. **Legacy compatibility/security tradeoff:** decide how to handle installed old clients when secure APIs replace destructive anonymous writes, including whether some old write paths must be retired with an upgrade prompt.
5. **Release/platform criteria:** identify iPhone/Android testers, minimum supported iOS/device targets, and whether portrait-only remains intentional. Confirm timezone semantics and target RSVP freshness before changing stored time meaning.

The proposed next step is Phase 0 plus a small Phase 1 containment PR, followed by the independently reviewed backend contract project. Production deployment, database rollout, and store publication remain separate owner-authorized decisions after concrete results and the gates above are reviewable.
