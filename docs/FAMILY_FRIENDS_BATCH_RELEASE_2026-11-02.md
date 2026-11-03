# Family and friends usability batch — released

Live [PartyPlus](https://partyplusapp.com), published and locked **November 2, 2026 at 19:56:08 America/Chicago / November 3 at 01:56:08 UTC**. Deploy `6ae93dce850a924fd26f894d`; browser source `dae5c5a5d0dbbcb90a2040d4d01a0c798b01d5fa`. Later backend-evidence/receipt commits do not change browser inputs. Immutable reviewed artifact: https://6ae93dce850a924fd26f894d--partyplus-invite.netlify.app.

## Limited changes

- My Parties no longer displays “Give your people something to look forward to.” Its primary **+ Create party** is larger and prominent on desktop and phone.
- **Party location** offers separate **Street address**, **City** and **ZIP code**. ZIP is text, retaining leading zeros without restrictive country-format assumptions. Saved fields reload across sessions, My Parties and invitations; preview, invitation, lists and map/directions links use one formatter for the complete address.
- Exact item guidance: **Give guests a few ideas for what to bring. Guests can add their own items and you can add more later.**
- Section04 remains **Party appearance / OPTIONAL**, with **Choose a design or upload your own image.** The redundant inner “INVITATION APPEARANCE” / “Make it yours” heading and extra introductory sentence are removed. Design/upload/replace/remove/crop controls and truthful photo-sharing notice remain.

Older freeform location/address text remains intact and unparsed. On edit, its saved wording is visibly shown with **Replace saved location**; ordinary edits preserve it. Only explicit replacement adopts blank structured fields. Once a structured address exists, clearing all three fields intentionally shows no location rather than resurrecting old text. No state/country field, address inference or paid mapping service was added.

## Persistence and preservation

One nullable `parties.location_details` JSONB column stores version1 streetAddress/city/zipCode. Existing verified-host/revision/replay/privacy logic remains authoritative; no new public RPC or table-access permission. Older clients that omit the field or echo null preserve it. A complete blank version1 object explicitly clears the guest-facing address. Client normalization happens before durable request storage; a missing/mismatched server address cannot report success or clear pending state.

Guarded production install at `2026-11-03T01:55:23Z`, independently checked at `01:55:40Z`, preserved **all eight original aggregate fingerprints**, all34 existing RPC access flags, denied raw access and the enabled write gate. Existing **350 parties /642 items /121 RSVPs** and all original fields remained unchanged; every new column value initially null, with no backfill or production fixture/customer edit. Auth, Storage, identities, notes, appearance, claims, RSVPs and old mutation receipts were preserved. Exact backend contract, hashes and evidence: [STRUCTURED_LOCATION_BACKEND_2026-11-02.md](STRUCTURED_LOCATION_BACKEND_2026-11-02.md).

## Focused acceptance

Fifteen affected client/address tests, six backend contract checks, TypeScript, targeted lint and build passed. Two existing App effect-dependency lint warnings remain unchanged. Tests cover complete map queries, leading-zero ZIP, freeform preservation, explicit empty semantics, saved retry/receipt validation and null-echo compatibility; backend proof covers ownership/revision/privacy, atomic invalid-input rejection and unchanged guest/photo/appearance state.

Actual hosted staging proved receipt/replay, fresh host session, unsigned invitation and My Parties persistence, legacy/appearance/Going2/claim retention, denied guest/stranger edits and invalid-input rollback. Parent's bounded supported-browser acceptance created a synthetic staged party, saved all three address fields including **01234**, refreshed and reopened Edit, and verified the complete directions href. A separate legacy fixture retained its freeform text with explicit replacement. Exact item/appearance copy passed. Phone390 CSS/client375=scroll375 had no horizontal overflow and a full-width primary; desktop1440 primary212×64. Viewport reset; temporary synthetic reviewer credential file removed. Local loopback access was unavailable, so actual HTTPS staging supplied acceptance; no firewall/network/browser settings or native fallback was used. No broad re-audit or production customer read/edit.

Draft and canonical domain each matched **16 downloadable asset hashes** against the same **18-file /1,273,921-byte** artifact. CSP, original-brand metadata and legacy SPA route passed. [Publication/hash proof](family-friends-evidence-2026-11-02/publication.json), [browser-checks.json](family-friends-evidence-2026-11-02/browser-checks.json), [phone address fields](family-friends-evidence-2026-11-02/location-fields-phone.png), [desktop My Parties](family-friends-evidence-2026-11-02/location-list-desktop.png).

No Michael action is required. Existing root dirty work and parent's staging screenshot are preserved. No new service/spending/mobile/billing/shopping work or redesign occurred. Broader design, business/pricing and retail ideas remain paused for later field feedback; usage/store metrics were not re-audited.

## Rollback and recovery

Prior deploy **`6ae7f8ce6b1fc10a226a7a17`** is retained and can be restored/locked on the same site. Retain the additive backend and saved address data; never drop the column or reconstruct customer text. The prior UI preserves unknown structured values when saving but does **not format new structured-only addresses**, so it restores prior presentation and is a temporary fallback. Reapply this formatter build or a forward correction to display those addresses. Original legacy text remains available. For a data-integrity issue, use the existing verified-write pause without opening raw client access or deleting records. Keep automatic publishing locked.

## Exact pending external-note entries

Requested external Pages destinations were unavailable in connected searches. These are the exact entries to apply when access returns.

### 00 — Current Status & Next Actions

PartyPlus limited family/friends usability batch RELEASED November2,2026 19:56America/Chicago (November3 01:56UTC). Live https://partyplusapp.com; locked deploy6ae93dce850a924fd26f894d, browser sourcedae5c5a5d0dbbcb90a2040d4d01a0c798b01d5fa plus backend-evidence/receipt-only notes. My Parties promotional sentence removed; larger + Create party primary. Party location now has Street address/City/ZIP code persisted in a validated version1 JSONB field and formatted fully across preview/invitation/MyParties/maps. ZIP stays text with leading zeros. Legacy freeform location/address remains unparsed/unchanged and visible on edit until explicit Replace saved location; old-client omission/null preserve structured values, full blank object explicitly clears display. Exact item guidance and simplified optional appearance intro shipped; design/upload/image-adjust controls retained. Fifteen client/address plus six backend checks, real staging save/reload/guest/list/legacy/claim/appearance preservation, parent desktop1440/phone390 no-overflow review, type/lint/build and canonical16 hashes/all18files1,273,921B passed. Guarded production install preserved all8 original fingerprints,350parties642items121RSVPs,34RPC flags/raw restrictions/gate; no customer fixture/backfill/Auth/Storage change. Receipt/evidence/rollback limitation: docs/FAMILY_FRIENDS_BATCH_RELEASE_2026-11-02.md. Prior deploy6ae7f8ce retained; retain new address data, prior UI temporarily lacks structured formatting. No Michael action/new spending/mobile/billing/shopping/redesign; further work paused for family/friends field feedback.

### Clogher Labs — Company Operating Ledger

2026-11-02 — PartyPlus released the limited family/friends usability batch: clearer larger Create party, separate persisted Street address/City/ZIP, complete invitation/map formatting, preserved legacy freeform text, exact guest-item guidance and simpler optional appearance introduction. Locked deploy6ae93dce850a924fd26f894d/browser sourcedae5c5a5d0dbbcb90a2040d4d01a0c798b01d5fa. One additive nullable validated JSONB column and existing secure-RPC wrappers; all original production fingerprints/access controls unchanged,350parties642items121RSVPs preserved, no customer mutation or permission expansion. Focused tests/actual staging/desktop/phone/type/build/hash acceptance passed. Exact status/evidence/rollback saved in repository; no new charges, service, mobile, billing, shopping or broad redesign. Await family/friends usability feedback; no Michael action needed.
