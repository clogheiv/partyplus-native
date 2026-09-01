# PartyPlus modernization and quality audit

Audit date: 2026-08-31
Audit base: `origin/backup/share-working` at `510430c04df1013e0f5825f70cc0d5caf4a4309b`
Audit branch: `audit/modernization-2026-08-31`

## Scope and verification limits

This audit covers every Expo Router route, shared React Native component, local storage module, Supabase access module, checked-in migration, invite website, and Android/Expo configuration in the repository. Findings marked **Confirmed** follow directly from a reachable code path or a repeatable static check. Findings marked **Risk — device/backend verification required** are not presented as observed production failures.

Baseline checks:

- `npm run lint`: passed with one warning in `CreatePartyScreen` (duplicate edit-loading effect has incomplete dependencies).
- `npx tsc --noEmit`: passed.
- `npx expo-doctor`: 17/18 checks passed; eight Expo SDK 54 packages have patch-version mismatches.
- `npm audit --omit=dev`: 38 transitive findings (2 critical, 20 high, 15 moderate, 1 low). npm's suggested aggregate remediation is an Expo SDK major upgrade, so no automatic upgrade was attempted.
- No automated test script or test files are present.
- iOS device/simulator testing is unavailable from this Windows workspace. Android device/emulator testing was not available during the static audit. Large text, screen reader, keyboard, notch, tablet, and device deep-link behavior therefore still require a device matrix.

## Critical

### C1 — Whole-table RSVP and item writes can lose concurrent guest updates

- **Status:** Confirmed from the write algorithm; multi-device timing should be reproduced against staging.
- **Exact file/component:** `src/data/partyRsvps.ts` / `replaceRemotePartyRsvps`; `src/data/parties.ts` / `replaceRemotePartyItems`; callers in `app/party/[id].tsx` (`saveRsvp`, `toggleItemClaim`, `addItemSuggestion`).
- **What is wrong:** Every RSVP, claim, unclaim, and suggestion deletes every row for the party and reinserts a client snapshot. Two guests acting close together can overwrite each other, and realtime observers can see a transient empty list. The operations are not atomic.
- **How to reproduce:** Open one party on two devices. Load the same initial state, then submit different RSVPs or claim different items nearly simultaneously. The last delete/insert sequence can remove the first device's change.
- **User impact:** Lost RSVPs, lost claims, duplicate availability, or a briefly empty bring list. This meets the audit's data-loss definition of critical.
- **Recommended fix:** Replace snapshot writes with row-level `upsert`/`delete` operations and an atomic claim RPC or conditional update (`claimed_by_user_id is null OR equals caller`). Add optimistic-concurrency/version checks and multi-client integration tests.
- **Risk of changing it:** High. It affects synchronization semantics and must preserve legacy rows and realtime behavior.
- **Estimated effort:** Large.
- **External changes:** Requires Supabase/database changes, RLS review, staging verification, and production rollout approval.

### C2 — Host authorization is client-only and backend enforcement is not evidenced in the repository

- **Status:** Risk — production Supabase verification required; client weakness is confirmed.
- **Exact file/component:** `src/lib/ids.ts` (`ensureUserId`); `src/lib/supabase.ts`; `src/data/parties.ts`; `src/data/partyRsvps.ts`; `app/(tabs)/create-party.tsx`; `app/pick-action.tsx`; all files under `supabase/migrations/`.
- **What is wrong:** Identity is a random UUID in AsyncStorage, not a Supabase-authenticated principal. Host checks only hide UI. Remote update/delete queries constrain by party ID but not host ID. Checked-in migrations contain no RLS enablement or policies, so the repository cannot demonstrate tenant/host enforcement.
- **How to reproduce:** With the publishable client key, inspect whether an anonymous client can update or delete a known party ID, or write another user's RSVP ID. Also navigate directly to the edit route for a locally cached guest party.
- **User impact:** If production policies are absent or permissive, anyone with an invite ID could alter party details, delete parties, impersonate RSVPs, or change claims.
- **Recommended fix:** Immediately audit production RLS/policies and API grants. Design authenticated or signed capability-based host/guest operations, enforce authorization in database policies/RPCs, and retain client checks only as defense in depth.
- **Risk of changing it:** High; a policy mistake could lock out current live users or break legacy invites.
- **Estimated effort:** Large.
- **External changes:** Requires Supabase, authentication/authorization design, privacy/security review, and production approval.

### C3 — Remote save/delete sequences are non-transactional and can leave partial state

- **Status:** Confirmed from the sequence; failure injection should verify each partial state on staging.
- **Exact file/component:** `src/data/parties.ts` / `createRemoteParty`, `updateRemoteParty`, `deleteRemoteParty`.
- **What is wrong:** Party upsert, item replacement, and RSVP replacement are separate requests. Deletes remove RSVP and item rows before deleting the party. A failure midway can leave a party without children, one child collection updated and the other stale, or child data removed while the party remains.
- **How to reproduce:** Interrupt connectivity or force an API error after the first request in create/update/delete.
- **User impact:** Partial saves and data loss; the current create alert specifically says items failed even when another stage may have failed.
- **Recommended fix:** Move aggregate create/update/delete into transactional Supabase RPCs, or change to idempotent row-level operations with explicit recovery and accurate stage reporting.
- **Risk of changing it:** High because it alters persistence and compatibility behavior.
- **Estimated effort:** Large.
- **External changes:** Requires database/Supabase and production rollout approval.

## High

### H1 — Editing a bring list can transfer a claim to the wrong item

- **Status:** Confirmed.
- **Exact file/component:** `app/(tabs)/create-party.tsx` / `handleSave`, where edited names are matched to `existing.items[index]`.
- **What is wrong:** Item identity and claim fields are preserved by array position instead of stable ID or name. Removing or inserting an earlier item shifts later positions.
- **How to reproduce:** Create items A and B, have a guest claim B, edit the party, remove A, and save. B occupies index 0 and can inherit A's identity/fields; other insertion/removal patterns transfer B's claim to another name.
- **User impact:** The app can show a guest claiming something they never selected, or silently lose/change claim ownership.
- **Recommended fix:** Reconcile edited names to unused existing items by stable identity/name; treat a renamed item as new unless the editing UI tracks its original item ID.
- **Risk of changing it:** Medium; duplicate item names and intentional renames need deterministic handling.
- **Estimated effort:** Small.
- **External changes:** No database, store, privacy, or production configuration change.

### H2 — A direct edit route can take over a cached guest party in the client

- **Status:** Confirmed client behavior; backend impact depends on C2.
- **Exact file/component:** `app/(tabs)/create-party.tsx` / edit-loading effects and `handleSave`; `app/_layout.tsx` linking config.
- **What is wrong:** The edit screen accepts any local party ID and saves it with the current device UUID as `hostId`. It does not verify the existing host before displaying or saving.
- **How to reproduce:** Open an invite so it is cached locally, then open `partyplusnative://create-party?id=<party-id>` (or otherwise navigate directly). Save it from the guest device.
- **User impact:** A guest can see host editing UI and may overwrite party details or claim local ownership; remote impact can include takeover if backend policies allow it.
- **Recommended fix:** Verify `existing.hostId === ensureUserId()` before loading/saving host edits, reject mismatches, and enforce the same rule server-side.
- **Risk of changing it:** Medium because legacy parties without a host ID need an explicit compatibility rule.
- **Estimated effort:** Small client defense; large complete authorization fix.
- **External changes:** Client defense needs none; complete fix requires Supabase approval.

### H3 — Sync failures during RSVP, claim, unclaim, and suggestion are silent

- **Status:** Confirmed.
- **Exact file/component:** `app/party/[id].tsx` / `saveRsvp`, `toggleItemClaim`, `addItemSuggestion`.
- **What is wrong:** The UI updates local storage optimistically. Remote errors are logged and suppress success feedback, but no error message tells the user that other guests will not see the change.
- **How to reproduce:** Disable network after a party loads, then save an RSVP, claim/unclaim, or add a suggestion.
- **User impact:** Users believe a local-looking change is shared when it is not, causing incorrect headcounts and duplicate bring items.
- **Recommended fix:** Show explicit "saved on this device, not synced" feedback, retain retry context, and eventually add a persistent pending-sync indicator/queue.
- **Risk of changing it:** Low for explicit feedback; medium for retry/queue behavior.
- **Estimated effort:** Small for first feedback; medium for robust offline sync.
- **External changes:** None for feedback; no database change.

### H4 — Invite landing page renders decoded URL data with `innerHTML`

- **Status:** Confirmed.
- **Exact file/component:** `invite-web/index.html` / `decodeInviteData` result rendering around the invite details.
- **What is wrong:** Legacy `d` payload values are interpolated into HTML and assigned to `details.innerHTML`. A crafted invite can inject event-handler markup such as an image with `onerror`.
- **How to reproduce:** Construct a valid base64url `d` payload whose location or note contains HTML with an event handler and open `/i/<id>?d=<payload>`.
- **User impact:** Script execution in the invite site's origin, phishing/content injection, and loss of trust in invite links.
- **Recommended fix:** Build DOM nodes and assign user values with `textContent`; never concatenate decoded payload into HTML.
- **Risk of changing it:** Low.
- **Estimated effort:** Small.
- **External changes:** Requires invite-site deployment approval, but no database/store change.

### H5 — Core controls are largely unlabeled for screen readers

- **Status:** Confirmed by static inventory.
- **Exact file/component:** `app/(tabs)/create-party.tsx`, `app/load-parties.tsx`, `app/pick-action.tsx`, `app/share.tsx`, and `app/party/[id].tsx`. Only the home screen currently declares accessibility roles/labels/hints.
- **What is wrong:** 44 `Pressable` controls exist, but non-home screens do not expose explicit button roles, labels, selected/disabled state, or field relationships. Symbol-only remove, plus, and minus controls are especially ambiguous.
- **How to reproduce:** Navigate with VoiceOver or TalkBack through create/edit, RSVP, and claim flows.
- **User impact:** Core actions are hard to identify or operate without sight; selected RSVP state and claimed state may not be announced.
- **Recommended fix:** Add roles, concise labels/hints, `accessibilityState`, live regions for feedback, input labels, and minimum 44x44 point targets; validate focus order on devices.
- **Risk of changing it:** Low.
- **Estimated effort:** Medium.
- **External changes:** None; device accessibility testing required.

### H6 — Invite loading turns network failures into an undifferentiated "not found"

- **Status:** Confirmed.
- **Exact file/component:** `app/party/[id].tsx` / `loadRemotePartyWithRetry` and the `!party` state.
- **What is wrong:** Remote exceptions are swallowed after two attempts. The final UI says the party could not be loaded, with only Home as an action, even when the problem is offline/timeout/transient.
- **How to reproduce:** Open a valid invite while offline on a device that has never cached it.
- **User impact:** Guests may conclude an invite is invalid and cannot retry without reopening the link.
- **Recommended fix:** Track not-found separately from network failure, add Retry, preserve the invite ID, and show an offline-specific message.
- **Risk of changing it:** Low.
- **Estimated effort:** Small.
- **External changes:** None.

### H7 — My Parties has no failure or retry state

- **Status:** Confirmed.
- **Exact file/component:** `app/load-parties.tsx` / `load`.
- **What is wrong:** AsyncStorage failures pass through `finally` without `catch`, potentially becoming unhandled rejections; the screen has loading and empty states but no error state.
- **How to reproduce:** Mock/reject `AsyncStorage.getItem` and focus the screen.
- **User impact:** The screen can appear empty/stale or generate an unhandled rejection with no recovery action.
- **Recommended fix:** Catch the error, show a clear error card, and provide Retry.
- **Risk of changing it:** Low.
- **Estimated effort:** Small.
- **External changes:** None.

### H8 — Dependency tree contains current critical/high advisories

- **Status:** Confirmed by `npm audit` on 2026-08-31; exploitability in the shipped mobile runtime varies.
- **Exact file/component:** `package-lock.json` / Expo SDK 54 toolchain and transitive dependencies, including `shell-quote`, `tar`, `ws`, PostCSS, Metro/Expo tooling.
- **What is wrong:** npm reports 2 critical and 20 high transitive vulnerability groups. Expo Doctor also reports eight patch mismatches. npm's aggregate remediation proposes Expo 57, a major upgrade.
- **How to reproduce:** Run `npm audit --omit=dev` and `npx expo-doctor`.
- **User impact:** Some findings primarily affect local/build tooling; runtime-reachable packages such as realtime/WebSocket code require review. Leaving the tree stale increases build and supply-chain exposure.
- **Recommended fix:** First align SDK 54 patch versions using `npx expo install --check`, rerun audit, then plan a separate Expo SDK upgrade with full native regression testing. Do not run `npm audit fix --force` on the release branch.
- **Risk of changing it:** High for a major Expo/React Native upgrade.
- **Estimated effort:** Medium for patch alignment; large for SDK major upgrade.
- **External changes:** Requires store-build regression testing and release approval; no database change.

### H9 — Expo web static export crashes during Supabase initialization

- **Status:** Confirmed by `npx expo export --platform all`.
- **Exact file/component:** `src/lib/supabase.ts` / module-level Supabase client auth storage configuration.
- **What is wrong:** React Native AsyncStorage is supplied during server-side static rendering. Supabase auth immediately reads it, but AsyncStorage's web implementation expects `window`, which is unavailable in the Node renderer.
- **How to reproduce:** Run `npx expo export --platform web` with Supabase environment variables configured.
- **User impact:** Web builds fail and cannot be deployed from the Expo app. Android and iOS bundle generation is unaffected.
- **Recommended fix:** Disable persistent auth storage/refresh only during server rendering, while retaining AsyncStorage on native and in the browser.
- **Risk of changing it:** Low; PartyPlus does not currently use signed-in Supabase sessions, and native configuration remains unchanged.
- **Estimated effort:** Small.
- **External changes:** None; verify a generated web export before deployment.

## Medium

### M1 — RSVP and claim realtime errors are swallowed

- **Status:** Confirmed.
- **Exact file/component:** `app/party/[id].tsx` / both realtime subscription callbacks.
- **What is wrong:** Refresh errors use empty `catch {}` blocks and subscription status is not surfaced.
- **How to reproduce:** Revoke connectivity or deny a realtime/select request after the screen subscribes.
- **User impact:** The screen silently becomes stale while appearing live.
- **Recommended fix:** Track connection state, log sanitized diagnostics, show a non-blocking stale/offline banner, and retry on foreground/reconnect.
- **Risk of changing it:** Medium because retry loops and duplicate subscriptions must be avoided.
- **Estimated effort:** Medium.
- **External changes:** May require Supabase realtime configuration verification; no schema change.

### M2 — Date/time meaning changes with the viewer's timezone

- **Status:** Risk — product decision and cross-timezone device testing required.
- **Exact file/component:** `app/(tabs)/create-party.tsx`, `src/lib/inviteShare.ts`, `app/party/[id].tsx`, `app/load-parties.tsx`.
- **What is wrong:** A local picker value is saved as UTC ISO and every viewer formats it in their own timezone. There is no event timezone or "floating local time" choice.
- **How to reproduce:** Create at 7:00 PM in one timezone and open the invite in another.
- **User impact:** Guests may see a different clock time than the host intended.
- **Recommended fix:** Decide whether events are fixed instants or host-local wall times; then store timezone metadata and display it explicitly.
- **Risk of changing it:** High for existing data compatibility.
- **Estimated effort:** Large.
- **External changes:** Likely requires database/schema and production migration approval.

### M3 — App is portrait-locked, so landscape layouts cannot be supported or audited

- **Status:** Confirmed configuration; landscape layout quality remains untested.
- **Exact file/component:** `app.json` (`orientation: "portrait"`); generated `android/app/src/main/AndroidManifest.xml` (`screenOrientation="portrait"`).
- **What is wrong:** The requested landscape device matrix is disabled by configuration.
- **How to reproduce:** Rotate a phone/tablet while the app is open.
- **User impact:** Users who mount devices or need landscape orientation cannot use it; iPad multitasking expectations may also be affected.
- **Recommended fix:** Make orientation support a deliberate product decision, then test/rework every screen before enabling it.
- **Risk of changing it:** Medium to high due to broad layout impact.
- **Estimated effort:** Medium.
- **External changes:** Requires store-build/device testing and release approval.

### M4 — Modal sheets can overflow with large accessibility text or short landscape heights

- **Status:** Risk — device verification required.
- **Exact file/component:** `app/(tabs)/create-party.tsx` / iOS date picker and template chooser modals.
- **What is wrong:** The sheets contain fixed-height picker content and non-scrollable template lists. There is no maximum-height/scroll fallback.
- **How to reproduce:** Use the largest iOS text size or a short/landscape screen, then open either modal.
- **User impact:** Cancel/Done or lower templates may be clipped or unreachable.
- **Recommended fix:** Use safe-area-aware max height and a ScrollView for sheet content; preserve native font scaling.
- **Risk of changing it:** Low.
- **Estimated effort:** Small.
- **External changes:** None; device testing required.

### M5 — Fixed tab bar and fixed bottom action sizing are not validated for large text

- **Status:** Risk — device verification required.
- **Exact file/component:** `app/(tabs)/_layout.tsx`; `app/party/[id].tsx` (`footerHeight = 74` and absolute bottom actions).
- **What is wrong:** Content padding assumes a fixed footer height, while tab/footer labels may grow. No dynamic measurement feeds the ScrollView inset.
- **How to reproduce:** Enable maximum font size, navigate to the party bottom, and inspect overlap/reachability on iOS and Android.
- **User impact:** Last controls or feedback can be hidden behind navigation/footer UI.
- **Recommended fix:** Measure rendered footer height or use inset-aware layout without absolute overlap; test tab label scaling.
- **Risk of changing it:** Low to medium.
- **Estimated effort:** Small.
- **External changes:** None.

### M6 — Input placeholder contrast is too weak in RSVP/suggestion fields

- **Status:** Confirmed by declared colors; visual contrast should be measured on target displays.
- **Exact file/component:** `app/party/[id].tsx` (`placeholderTextColor="#666"` on `#132038`).
- **What is wrong:** The muted placeholder is substantially dimmer than the app's established `#8ea4c5` placeholder color and is likely below accessible contrast.
- **How to reproduce:** Inspect the RSVP name and suggestion fields in dark mode or run a WCAG color contrast calculation.
- **User impact:** Low-vision users may not perceive input purpose/examples.
- **Recommended fix:** Use the established `#8ea4c5` token and verify WCAG contrast.
- **Risk of changing it:** Low.
- **Estimated effort:** Small.
- **External changes:** None.

### M7 — Edit initialization is duplicated and lint warns about stale dependencies

- **Status:** Confirmed.
- **Exact file/component:** `app/(tabs)/create-party.tsx` / effects near initial field setup and `loadForEdit`.
- **What is wrong:** Two effects fetch the same party and set overlapping fields. The second depends only on `editingId` while reading `isEditing`, `partyId`, and the reset function. Races can apply stale data during route changes.
- **How to reproduce:** Run lint; rapidly switch between create and edit routes or between IDs.
- **User impact:** Stale fields/items can flash or populate in the wrong form; maintainability is poor.
- **Recommended fix:** Consolidate into one cancelable initialization effect with complete dependencies and a single reset path.
- **Risk of changing it:** Medium because create-tab focus/reset behavior is delicate.
- **Estimated effort:** Small.
- **External changes:** None.

### M8 — Web date validation alerts but still saves without the invalid date

- **Status:** Confirmed.
- **Exact file/component:** `app/(tabs)/create-party.tsx` / inline web date conversion in `handleSave`.
- **What is wrong:** Invalid input triggers an alert inside an expression and returns `undefined`; the surrounding save continues and removes/omits the date.
- **How to reproduce:** On web, enter invalid date text and press Save Party.
- **User impact:** The user is told the value is invalid but the party still saves with missing date, potentially overwriting a prior date.
- **Recommended fix:** Validate before constructing/writing the party and abort the save on invalid input.
- **Risk of changing it:** Low.
- **Estimated effort:** Small.
- **External changes:** None.

### M9 — No analytics instrumentation exists for core funnel health

- **Status:** Confirmed by repository search.
- **Exact file/component:** App-wide; create/save/share/invite-open/RSVP/claim/return-host paths.
- **What is wrong:** There is no analytics dependency, consent model, or event instrumentation for the requested funnel.
- **How to reproduce:** Search dependencies and source for analytics/event tracking.
- **User impact:** The team cannot quantify creation completion, invite opens, RSVP conversion, claim usage, sync failure, or returning hosts.
- **Recommended fix:** Define a privacy-reviewed event taxonomy with no party titles, guest names, locations, notes, or invite payloads; select a provider only after approval.
- **Risk of changing it:** Medium due to privacy disclosures, consent, and store data-safety forms.
- **Estimated effort:** Medium.
- **External changes:** Requires analytics vendor, privacy policy, store disclosures, and production approval.

### M10 — Android native manifest contains broad legacy/development permissions

- **Status:** Risk — release-manifest verification required.
- **Exact file/component:** `android/app/src/main/AndroidManifest.xml` (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`).
- **What is wrong:** The checked-in native manifest requests permissions not used by PartyPlus source. Some may be added for development tooling or ignored on newer Android, but their presence should not be assumed harmless in release builds.
- **How to reproduce:** Generate/inspect the final release merged manifest and install permission listing.
- **User impact:** Unnecessary permission surface, store review questions, and user trust concerns.
- **Recommended fix:** Determine which Expo plugin introduces each permission and block unused release permissions through Expo config after a native build check.
- **Risk of changing it:** Medium because dev-client behavior and library requirements may depend on them.
- **Estimated effort:** Small to medium.
- **External changes:** Requires Android release-build/store verification.

### M11 — Repeated bring-list additions make the create screen jump with the keyboard open

- **Status:** Confirmed on physical Android and iPhone; fixed in this branch with Michael's newest-item-first behavior, with cross-platform visual retesting required.
- **Exact file/component:** `app/(tabs)/create-party.tsx` / `KeyboardAvoidingView`, `ScrollView`, `scrollToInput`, and `addItem`.
- **What is wrong:** `blurOnSubmit={false}` and `keyboardShouldPersistTaps="handled"` already keep the bring-list input focused, but every successful addition unconditionally sent another native `focus()` command while the list expanded below the entry controls. While `KeyboardAvoidingView` maintained the keyboard-reduced viewport, the redundant focus request, ScrollView content growth, and possible delayed `scrollToInput` animation competed over position. The result was a move toward the expanding list or Save button followed by a snap back toward the input.
- **How to reproduce:** On either platform, focus the bring-list input and add several items without dismissing the keyboard. Later additions make the viewport visibly move down and then back even though every item is appended correctly.
- **User impact:** Rapid item entry feels unstable and can temporarily move the input, Add Item button, or newest row away from the user's expected position.
- **Recommended fix:** Preserve the existing focus/keyboard settings and initial focus scrolling, but only issue `focus()` when the input is actually unfocused. Insert each new manual item directly below Add Item so earlier items move down without any forced post-add scrolling. Preserve stored order on edit load, keep template merging unchanged, and mark the new manual prefix during save reconciliation so duplicate names cannot steal existing IDs or claims.
- **Risk of changing it:** Low; only manual-entry display order changes. Stored item order, templates, existing IDs/claims, save behavior, and synchronization remain unchanged.
- **Estimated effort:** Small.
- **External changes:** None; repeat the multi-item test on physical Android and iPhone, including maximum text size.

### M12 — Focus scrolling can place create-party inputs under the top system area

- **Status:** Confirmed on physical iPhone and observed near the top edge on Android; fixed in this branch, with final device retesting required.
- **Exact file/component:** `app/(tabs)/create-party.tsx` / shared `scrollToInput` used by Notes and What to bring; `src/lib/inputFocus.ts` / safe focus offset calculation.
- **What is wrong:** The tab navigator has no visible header and the prior focus target always placed an input 20 points below the ScrollView viewport top. That target ignored the device's actual top safe-area inset, so an iPhone with a Dynamic Island/notch could scroll the focused field beneath status/camera content; Android fields could also settle too close to the status area.
- **How to reproduce:** On a notched/Dynamic Island iPhone, focus the bring-list input with the keyboard open after scrolling the create screen. The automatic focus scroll positions the input under the top system area. Repeat with Notes, which uses the same helper.
- **User impact:** Text and the active field can be obscured while typing, especially at large text sizes.
- **Recommended fix:** Calculate the focus scroll offset from `useSafeAreaInsets().top` plus a small 12-point visual margin, clamped at the beginning of the ScrollView. Apply it through the existing shared focus path only; do not add post-add scrolling.
- **Risk of changing it:** Low; the measured inset adapts by device, so Android receives only its own smaller top clearance and no platform-specific notch constant.
- **Estimated effort:** Small.
- **External changes:** None; final physical Android/iPhone and maximum-text retesting required.

## Low

### L1 — Obsolete starter routes and components remain checked in

- **Status:** Confirmed.
- **Exact file/component:** `app/modal.tsx`, `app/app/index.tsx`, hidden `app/(tabs)/explore.tsx`, `components/external-link.tsx`, `hello-wave.tsx`, `parallax-scroll-view.tsx`, `components/ui/collapsible.tsx`, duplicate `src/partyStore.ts`, and unused `src/lib/dateFormat.TS`.
- **What is wrong:** These are unused Expo starter/demo or superseded files; some contain inconsistent styling/copy and still create routes.
- **How to reproduce:** Search imports/references or directly navigate to generated routes such as `/modal` and `/app`.
- **User impact:** Larger maintenance/security review surface and accidental dead-route exposure.
- **Recommended fix:** Confirm no external links depend on them, then remove in a dedicated cleanup commit with route smoke tests.
- **Risk of changing it:** Low to medium because direct external route usage is unknown.
- **Estimated effort:** Small.
- **External changes:** None.

### L2 — Visual tokens are duplicated instead of centralized

- **Status:** Confirmed.
- **Exact file/component:** Styles across all route files versus `constants/theme.ts`.
- **What is wrong:** PartyPlus colors, radii, spacing, and buttons are repeated inline while the starter theme contains unrelated colors.
- **How to reproduce:** Search repeated values such as `#08111f`, `#101a2b`, and `#243554`.
- **User impact:** Small inconsistencies (placeholder colors, button sizing, typography) and slower safe iteration.
- **Recommended fix:** Introduce PartyPlus semantic tokens and shared primitives incrementally without redesigning the identity.
- **Risk of changing it:** Medium if done as a sweeping rewrite; low if incremental.
- **Estimated effort:** Medium.
- **External changes:** None.

### L3 — Development logging is noisy and inconsistent

- **Status:** Confirmed.
- **Exact file/component:** `app/_layout.tsx`, `app/share.tsx`, `app/party/[id].tsx`, `src/lib/inviteShare.ts`, create/pick action error logs.
- **What is wrong:** Numerous console logs include IDs, party titles, URLs, payload length/keys, and raw error objects. They are not consistently gated to development or sanitized.
- **How to reproduce:** Open/share an invite and observe the console.
- **User impact:** Debug noise and possible exposure of personal party metadata in captured production logs.
- **Recommended fix:** Use the existing in-progress sanitized development logger pattern, gate diagnostics, and never log party/guest text or full payloads.
- **Risk of changing it:** Low if diagnostic coverage is preserved.
- **Estimated effort:** Small to medium.
- **External changes:** Privacy review recommended; no database change.

### L4 — My Parties and action screens do not communicate loading consistently

- **Status:** Confirmed.
- **Exact file/component:** `app/load-parties.tsx`, `app/pick-action.tsx`, `app/share.tsx`.
- **What is wrong:** Loading indicators lack accessible labels/live announcements; Pick Action renders generic actions before its party/host lookup completes.
- **How to reproduce:** Open the screens on a slow device or with a large local store.
- **User impact:** Brief ambiguity and possible premature taps.
- **Recommended fix:** Add explicit loading state, accessible announcements, and disable party-specific actions until lookup completes.
- **Risk of changing it:** Low.
- **Estimated effort:** Small.
- **External changes:** None.

## Feature opportunities

### F1 — Reliable pending-sync queue and status

- **Status:** Opportunity based on H3/M1, not an existing promised behavior.
- **Exact file/component:** `src/lib/partyStore.ts`, Supabase data modules, party/create screens.
- **What is wrong:** Local-first writes have no durable outbox, retry state, or conflict UI.
- **How to reproduce:** Make changes offline and relaunch.
- **User impact:** A visible, retryable queue would increase trust and completion under poor connectivity.
- **Recommended fix:** After row-level/transactional APIs exist, add an idempotent outbox with per-operation status and conflict handling.
- **Risk of changing it:** High.
- **Estimated effort:** Large.
- **External changes:** Supabase/API design and product approval required.

### F2 — Host dashboard with actionable RSVP/bring-list summary

- **Status:** Opportunity.
- **Exact file/component:** `app/pick-action.tsx`, `app/party/[id].tsx`.
- **What is wrong:** Hosts must enter the guest-oriented party page to interpret response and coverage state.
- **How to reproduce:** Open a saved host party with several RSVPs/items.
- **User impact:** A concise headcount, unclaimed-item count, and reminder action could improve returning-host engagement.
- **Recommended fix:** Prototype only after analytics and authorization foundations; reuse existing data without schema changes where possible.
- **Risk of changing it:** Medium.
- **Estimated effort:** Medium.
- **External changes:** Analytics/product approval; possibly none for database.

### F3 — Calendar and timezone-aware sharing

- **Status:** Opportunity dependent on M2.
- **Exact file/component:** Create, party detail, and invite-share flows.
- **What is wrong:** Guests cannot add an event to their calendar and event timezone intent is implicit.
- **How to reproduce:** Open a dated invite.
- **User impact:** Calendar export could improve attendance and reduce forgotten events.
- **Recommended fix:** Resolve timezone semantics first, then add explicit calendar export with permission-free event files/links where possible.
- **Risk of changing it:** Medium to high.
- **Estimated effort:** Medium.
- **External changes:** Product/privacy review; database change likely for timezone.

### F4 — Privacy-preserving funnel analytics

- **Status:** Opportunity dependent on M9.
- **Exact file/component:** App launch, create/save, share, invite open, RSVP, claim/unclaim, duplicate, and returning host entry.
- **What is wrong:** Product improvements cannot be evaluated quantitatively.
- **How to reproduce:** No event stream exists.
- **User impact:** Carefully scoped aggregate analytics could focus investment on steps that actually improve successful parties.
- **Recommended fix:** Track anonymous event names and coarse outcomes only; prohibit user-entered content and stable cross-app identifiers.
- **Risk of changing it:** Medium.
- **Estimated effort:** Medium.
- **External changes:** Vendor, privacy policy, consent/store disclosure, and production approval required.

## Recommended sequencing

1. **Immediate safe client batch:** H1, client defense for H2, H3 feedback, H4, H5 core semantics, H7, H9, M6, and M8.
2. **Backend integrity/security batch (approval required):** verify C2 in production; design C1/C3 row-level transactional APIs and policies; add multi-client tests.
3. **Reliability/accessibility device batch:** H6, M1, M4, M5, full VoiceOver/TalkBack and large-text matrix.
4. **Maintenance release batch:** SDK 54 patch alignment, advisory reevaluation, manifest cleanup, dead-code removal, and centralized tokens.
5. **Product batch:** timezone decision, privacy-reviewed analytics, then measured feature experiments.

## First safe batch completion

Completed on `audit/modernization-2026-08-31`:

- Preserved bring-list item IDs and claim ownership by item name rather than array position during host edits, with duplicate-name and rename behavior covered by regression tests.
- Added client-side host checks before loading or saving an existing party in the edit route while retaining compatibility for legacy parties with no `hostId`.
- Consolidated duplicate edit initialization, resolved the baseline hook warning, and made invalid web dates abort rather than silently save without a date.
- Added explicit local-only/not-synced alerts for RSVP, claim/unclaim, and suggestion failures.
- Added a My Parties failure state with Retry and a loading gate for party actions.
- Added screen-reader roles, labels, hints, selected/disabled/busy states, and live feedback semantics to the core create/edit, saved-party, action, share, RSVP, stepper, claim, suggestion, and back controls.
- Improved RSVP/suggestion placeholder contrast.
- Replaced decoded invite-payload `innerHTML` rendering with text-only DOM construction.
- Made Supabase auth storage safe during Expo web static rendering without changing native session persistence.
- Prevented redundant native focus commands during repeated bring-list additions and placed each new manual item first beneath Add Item, avoiding forced post-add scrolling while preserving stored edit order and existing IDs/claims.
- Made the shared Notes/bring-list focus target reserve the measured top safe-area inset plus a small margin, preventing focused fields from settling under iPhone or Android system UI.

Verification after changes:

- `npm test`: 10/10 regression tests passed, including focused-input safe-area geometry, newest-item-first ordering, and duplicate-name claim preservation.
- `npm run lint`: passed with zero warnings/errors.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed for audit changes; remaining working-tree changes predate the audit.
- `npx expo export --platform all`: Android, iOS, and web bundles/static routes exported successfully.
- No database migration, dependency upgrade, production configuration change, deployment, merge, store build, or production data operation was performed.

Not locally verified:

- Physical Android/iPhone testing confirmed the repeated bring-list viewport jump and then the top safe-area overlap after newest-item-first behavior. The measured safe-area focus correction still requires same-device retesting. The remaining create, save, edit, load, duplicate, share-sheet, invite-open, RSVP, claim, and unclaim matrix is not complete.
- VoiceOver/TalkBack focus order, maximum system text, keyboard overlap, notch/safe-area behavior, tablet sizes, or orientation changes.
- Multi-device realtime races, offline recovery, production RLS/policies, and production invite-site deployment.

Pull-request assessment:

- The audit branch commits are ready for review as a narrow, reversible PR.
- The PR should not be treated as production-merge ready until the physical-device core-journey/accessibility matrix is completed.
- C1, C2, and C3 require a separately approved Supabase integrity/security project before PartyPlus can be considered fully remediated.
