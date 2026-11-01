# PartyPlus Web Rebuild — durable checkpoint

Latest follow-up (2026-11-01): authentic original PP artwork/navy branding is released and locked at deploy `6ae7aa2735ea84cd7acb7d95`, reviewed browser source `fc72234f571ffeec0ab50f6f951a87676e4e726c`. Current receipt/provenance/visual checks/rollback: [BRAND_REFINEMENT_2026-11-01.md](BRAND_REFINEMENT_2026-11-01.md). Exact current external-note fallback: [WEB_REBUILD_LEDGER_ENTRIES_2026-11-01.md](WEB_REBUILD_LEDGER_ENTRIES_2026-11-01.md). Entries below retain the dated original rebuild history.

**LATEST feedback work completed:** priority item/maps/copy correction shipped at 21:30 UTC, optional password/recovery at 21:42 UTC, and the complete invitation/poster redesign at 21:56 UTC. Live https://partyplusapp.com now serves locked deploy `6ae663c013623bb52b726f3d`, browser source `182c67d`. Michael's party/Tiffany's RSVP were not modified. Use `FEEDBACK_RELEASE_RECEIPT_2026-10-31.md` for current source, checks, limitations, the one-time Dessert re-entry action and compatible rollback. Earlier preparation/release checkpoints below are historical.

**RELEASED October 31 20:37:34 UTC:** https://partyplusapp.com now serves deploy `6ae65016a97425eaaa716db8`. The production verified-write gate is enabled, all 347 parties / 637 items / 118 RSVPs and original columns are preserved, raw client table access remains closed, and real production delivered-code sign-in passed. Netlify publication is locked against the old Git branch overwriting the new app. Browser source `e7e748e` includes explicit Share invite and Copy link. See `WEB_REBUILD_RELEASE_RECEIPT_2026-10-31.md` for current delivery, limits and rollback; the preparation checkpoints below are historical.

Owner: 6.1 Sol integration lead. User brief dated October 31 supersedes earlier mobile-first and milestone-approval instructions. Web production release is authorized with existing resources and no additional charges once core journeys pass. Preserve customer records, keep unsafe legacy writes closed, defer mobile submissions.

## Baseline and location

- Isolated worktree: `C:\Users\clogh\partyplus-native\.worktrees\web-rebuild`, branch `codex/web-rebuild`, base `e6124a3`.
- Root `audit/modernization-2026-08-31` and `.worktrees/modernization-phase-1` both have preexisting dirty work, left intact. No AGENTS.md found under repository.
- Existing website: https://partyplusapp.com; existing Supabase production project `typbofemqhjoiwbkdvuc`; staging `qmbwrbxbbshbavfhkujx`; existing staging Netlify site `famous-fairy-b9cb63.netlify.app`.
- Independent backend diagnosis confirmed production SELECT HTTP 200 with aggregate 347 parties / 637 items / 118 RSVPs on October 31. October 3 intentional security freeze denies all unsafe legacy writes. Secure v2 production contract was not installed. This explains failure of old write operations; the precise device error wording remains unverified.
- Last documented store state October 10: iOS 1.0.3(15) and Android 1.0.3(12) publicly released, staging private iOS 17 waiting for review / Android 14 changes in review. Current store state unverified; mobile deferred.

## Decisions

- Independent React/TypeScript browser app, existing esbuild + React dependencies, no native screen reuse. Source `web/`, static artifact `web-dist/`, existing Netlify resources retained. Sites guidance applied with the user's existing-hosting preference.
- Reuse transactional v2 RPC authorization, revisions, stable IDs, receipt replay and safe write gate. Persist pending payload+operation+principal before a request; unknown network outcomes retry same operation. New changes cannot overwrite a pending payload.
- Host account uses verified email code; creator appears in Hosting from server ownership ledger immediately. Guest can join/RSVP with a persistent anonymous identity, then convert to verified email without changing principal. Signed-in accounts recover membership across devices.
- Backend agent owns additive SQL: explicit joined membership, My Parties, privacy-safe projection and enum-only first-party events. Invitation possession permits intended party content; database ownership and other principals are excluded, full guest response names are host-only.
- Older customer parties remain intact and their IDs stay valid. Device UUID possession is not sufficient host proof; reviewed support recovery is required for historical host ownership. Product must state this limitation and retain support route.
- Existing completed mobile-specific physical-upgrade gates do not control new browser architecture. Production backup/recovery and authorization safety remain material prerequisites; no blind unfreeze.
- Measurement distinguishes link copied from share sheet opened; neither asserts delivery. No party IDs, names, email addresses or invitation URLs in event records.

## Verification so far

- Six focused client tests pass: reload-safe unknown save retry, conflicting payload prevention, identity mismatch denial, anonymous-to-email conversion intent, verified-host gate/draft preservation, rejection archive and telemetry privacy/failure isolation.
- Browser implementation complete. TypeScript passes; final focused client/backend/production-package suite 27 passed, zero failed. Full inherited suite 84 passed, zero failed, one independent-PostgreSQL concurrency skip. Browser-only changes do not rebuild or submit mobile apps.
- Synthetic rendered browser passed host code sign-in, draft retained through account navigation, create/date-time/save, automatic Hosting and reload return, copied direct invitation, independent guest RSVP/2, own claim, suggestion, reload/Joined return, anonymous-to-email identity conversion retaining guest access, host recovery in a new session and host edit preserving all guest contributions. Synthetic Auth transport is explicitly not evidence of delivered mail or hosted authentication.
- Phone and tablet layouts inspected and saved; DOM scroll width fits viewport. Browser zoom made requested390/768 widths report433/853 CSS pixels; desktop reports1180. Small-screen screenshot API timed out without a clip; documented clipped capture succeeded. Viewport override reset.
- Existing Netlify draft previews deployed without changing either published site: first `https://6ae649426f3f0121a47997e1--famous-fairy-b9cb63.netlify.app`, latest address-aware `https://6ae649cd40e8400ac37aa9b2--famous-fairy-b9cb63.netlify.app`. Six public assets, hash and CSP/route smoke verified. Existing account exposed included credits3000/used0 at preflight, no new plan/resources purchased.
- Live hosted staging guest path passed real anonymous Supabase Auth, RSVP/2, Ice claim, suggestion, copied correct invitation, reload and Joined return on latest draft. The guest-only response view and no host controls were observed. Backend agent independently verifies persisted rows. These are synthetic staging events, not production activation metrics.
- Staging initially paused by Supabase inactivity. Existing Free project resumed; user explicitly approved exact additive browser migration after automatic approval review initially rejected its new persistent access scope. Migration then committed with original-table fingerprints and safe grants unchanged. Separate legacy-address projection patch preserved stored addresses and all original table fingerprints.
- User subsequently explicitly approved reading the latest PartyPlus staging sign-in email. Narrow company-inbox search found only PartyPlus mail; code extracted in memory and never displayed/persisted, successful delivered-code sign-in recovered the original host's two synthetic parties and one joined party. Created new synthetic party `0ca7544c-d486-4672-b55f-1b3ed49db883`; automatic Hosting, date/time and reload return passed. Independent guest origin RSVP/3 + Fruit salad claim was visible to host; host edit retained them.
- Same-account independent-origin recovery passed using a third draft `https://6ae64afaaa5fee650a934c14--famous-fairy-b9cb63.netlify.app`: a fresh delivered code recovered Hosting3 (including new updated party) and Joined1. This tests separate browser origin storage, not a physical second device. The guest session was retained after automatic review rejected switching its identity; no switch bypass attempted. New mail tabs closed and code/message variables cleared.

## Current release limitations / next work

- Production unchanged and legacy writes remain frozen. Production built-in SMTP cannot deliver to general public recipients; existing Resend account access is awaiting the user's login action. Parent/backend agent own exact reversible production preflight, Auth configuration and preservation package.
- Live staging browser acceptance is complete within the documented scope. Next: approved safe production cutover and release with existing SMTP access; commit/push final source and release evidence. Account acquisition/activation/engagement/retention and current store status remain unknown.
- An anonymous guest verifying a new email retains the same identity. Switching that guest session to a different existing account does not merge identities; explicit warning explains that old response editing may be lost. Sign in first when using an existing account. Historical device-only ownership still requires support review.

## Finish line

1. Desktop, tablet, phone rendering; create/save; automatic Hosting; account return; working direct browser invitation; RSVP/count; own claim/unclaim; suggestion; Joined return/cross-device account; host edit/delete with guest preservation; stranger denial/privacy.
2. Focused client/backend tests and TypeScript/build; real staging workflows; reversible production artifact+backend rollout only with verified access, retained customer totals and recoverable backup.
3. Record artifact/commit/URL, actual checks, material limitations and rollback. Update exact external-ledger entries below if Pages becomes accessible.

## External notes access

Parent searched exact requested titles and broader Current Status / Clogher via connected Pages: no matching accessible Pages. Exact fallback entries are in `WEB_REBUILD_LEDGER_ENTRIES_2026-10-31.md`. No external note was silently created.
