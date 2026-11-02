# Host-written invitation description

User request: remove the automatic invitation description, including “A little something to look forward to.” and equivalent public fallback. The existing optional **A note for your guests** field is the sole host-written description. Host words should appear in every layout and in the editor preview; empty notes should produce no description or reserved description spacing. No additional field or customer-data edit.

The shared poster now displays the existing `party.notes` once below the party title in illustrated, photo and elegant layouts. Its common copy block also serves the live preview. Nonempty notes retain their exact text and line breaks as safely escaped text; empty/whitespace-only notes omit the paragraph and its margin entirely. The duplicate host-letter section below the invitation is removed. The generic public actionbar welcome copy is also removed, leaving the real RSVP/Share/Copy/Edit controls. Original PartyPlus branding/tagline remain branding, not a generated party description.

The supplied example **Bon fire and Karaoke.** was used only in read-only synthetic fixtures. No Michael/Friendsgiving party, customer note or production data was fetched/edited. Existing saved notes automatically supply the description through the unchanged API; no new field/schema/save operation is introduced.

Focused checks complete: six component tests cover populated, missing, empty and whitespace-only notes, exact single display, multiline/HTML escaping and no generated fallback across all three layouts in preview/public modes. Twelve rendered local-browser states cover each layout populated/empty for actual invitation and live editor preview, with one note or no description element as appropriate and no duplicate host-note block. TypeScript and targeted lint pass. Parent reviewed populated and empty invitation screenshots without blocker. Phone390CSS / scroll373 fit; viewport reset. No auth/file-picker/backend/full-flow test cycle.

Evidence: `description-evidence-2026-11-01/render-checks.json`, `populated-invitation.png`, `empty-invitation.png`. Baseline source `515b617423ec70eb2c5c3c48d1ed6a31be312111`; prior compatible deploy `6ae7d64d87b5c3af8f3fc3b0`. Root dirty work and parent staging screenshot remain preserved; preloaded-design improvement remains deferred to its separate discussion.

## Released result and rollback

Live https://partyplusapp.com, published and locked **November 2, 2026 at 01:22:00 UTC / November 1 at 19:22:00 America/Chicago**. Current deploy `6ae7e58121c131c27086d331`; reviewed browser source `78a836bdc6b9aee2d22a31d02838993ac80a91e4`, pushed to `codex/web-rebuild`. Later receipt-only commits leave browser inputs unchanged. Immutable artifact: https://6ae7e58121c131c27086d331--partyplus-invite.netlify.app.

All 16 downloadable public assets hash-match the reviewed draft and canonical domain; all 18 files total **1,264,390 bytes**. CSP and legacy SPA routing passed. Exact safe source/publication/lock/hash evidence: `description-evidence-2026-11-01/publication.json`. No customer/production fixture was created or edited; no new service/spending/mobile change. The user's supplied Friendsgiving sentence was tested synthetically, with no actual customer read or edit. Existing notes will display through the unchanged API without needing to save the party again.

Rollback: restore and lock prior compatible deploy **`6ae7d64d87b5c3af8f3fc3b0`**. It restores previous presentation, including the unwanted generated copy, but leaves actual notes/party/guest/photo data intact. No database rollback is needed. Keep automatic publishing locked and raw table access closed.

## Exact pending external-note entries

Requested external Pages destinations were unavailable in the rebuild's connected searches. These are the exact current updates to apply when access returns.

### 00 — Current Status & Next Actions

PartyPlus host-written description correction RELEASED November 1, 2026 at 19:22 America/Chicago (November 2 at 01:22 UTC). Live https://partyplusapp.com; locked deploy 6ae7e58121c131c27086d331, reviewed source 78a836bdc6b9aee2d22a31d02838993ac80a91e4 plus later receipt-only notes. Existing optional “A note for your guests” is the sole description, displayed once below the party title in illustrated/photo/elegant layouts and their editor previews. Empty/whitespace notes omit the paragraph/margin; generated preview/public fallback and duplicate note section removed. Brand tagline remains branding. No new field/API/schema/customer edit.

Six focused render tests and 12 local browser states passed for populated/empty actual invitations and previews across all layouts, with exact supplied “Bon fire and Karaoke.” once or no description element. Multiline/escaping checks passed; parent populated/empty visual review and phone 390 CSS / scroll 373 passed; viewport reset. TypeScript/targeted lint/build, 16 public asset hashes / all 18 files totaling 1,264,390 bytes and CSP/routes passed. The actual Michael/Friendsgiving party was neither read nor edited; supplied text used only in synthetic fixtures. Existing notes now render automatically. Receipt/evidence/rollback: docs/HOST_DESCRIPTION_2026-11-01.md. Prior compatible6ae7d64d87b5c3af8f3fc3b0 retained. No new spending/mobile work; substantial preloaded-design feedback remains for next discussion only.

### Clogher Labs — Company Operating Ledger

2026-11-01 — PartyPlus invitation description corrected to use only the existing host-written note, once, in every layout and editor preview, omitting empty description and spacing. Generated fallback/public welcome and redundant note display removed. Locked deploy 6ae7e58121c131c27086d331/source 78a836bdc6b9aee2d22a31d02838993ac80a91e4 serves https://partyplusapp.com. Focused render/browser/phone/type/build/hash checks passed. Supplied Friendsgiving wording tested synthetically; no actual customer read/edit, backend/API/schema change, new spending or mobile work. Compatible rollback retained. Exact status/ledger fallback and evidence saved in repository; broader design/hosting/shopping directions remain deferred/documentation only.
