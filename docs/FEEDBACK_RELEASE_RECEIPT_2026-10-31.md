# PartyPlus feedback releases — October 31, 2026

**Live:** https://partyplusapp.com

The requested work shipped in order, using existing hosting and backend resources:

| Release | Browser source | Locked production deploy | Published UTC |
| --- | --- | --- | --- |
| Typed-item preservation, exact copy and maps | `3c64d877e05aa705eea39e91022df420521b7b03` | `6ae65dbe5436fd281118167c` | 21:30:38 |
| Optional password and email-code recovery | `046190d98ab0cf6b703d2f09d5c0572576711213` | `6ae6607931398212cdfba8df` | 21:42:07 |
| Complete invitation/poster visual redesign | `182c67ddc2ca36316e5e43aff77548f54a83e321` | `6ae663c013623bb52b726f3d` | 21:56:30 |

The final integration commit includes this receipt, current status/ledger entries, and all applied source. Browser inputs are unchanged from the final listed source; final artifact correspondence is verified separately against the committed tree.

## What changed

Item text, quantity and a reserved item ID are now part of the durable draft. Save includes a typed item even when Add was not clicked. Add, Enter and Save consume the same pending item, preventing duplicates. Pending quantity survives reload and the sign-in detour. A quantity without an item name prompts correction. Independent real staging checks confirm explicitly added items and quantities also survive create/read/replay, another signed-in host session, guest view/claim and host edits.

Location and street-address text opens a free map, with a separate directions link and browser fallback. The exact requested invitation wording is preserved: “Are you coming?”, “Claim an item to bring”, and “No items listed yet. You can suggest something to bring.” The host-planning sentence and old bring-list eyebrow are removed.

Existing verified accounts can optionally set/change a password in Account and use it on another device. Supabase retains the same principal, hosted/joined parties and responses. Email codes remain available; Forgot password uses an existing-account-only code request and returns to password setup. No separate password store, customer credential changes or global verification-policy changes were introduced. Guests can still respond without an account.

The visual redesign replaces the generic sidebar/card layout with expressive invitation posters, dated party tickets, clear Hosting/Joined organization, event-specific palettes, original SVG art, and a live invitation preview during creation. Space Grotesk and Fraunces are self-hosted with complete free OFL licenses. RSVP, claims, Share invite, Copy link, map links and host actions remain prominent on desktop and phone. No paid fonts/images or remote font trackers were introduced.

## Focused verification

- Twenty-one focused client/password/recovery/editor checks pass; TypeScript and production builds pass.
- Real staging item and password identity proofs pass on new synthetic fixtures. No production customer party/RSVP/item mutation was used for testing.
- Integrated rendered check: pending item → sign-in → save; independent guest RSVP/claim; host refresh; host edit adding another typed item while preserving the original claim/quantity; Share invite outlets; exact copied link; map/directions.
- Password UI check: code sign-in, optional setup, password sign-in from separate browser storage, retained session/Hosting after reload, and code-based password recovery retaining the same hosted party. This rendered check used ephemeral local mock Auth; real SDK identity behavior was verified separately in staging.
- Desktop/phone review passed after loosening serif heading spacing. Actual phone CSS width 390 px had no horizontal overflow and readable 16 px inputs; phone RSVP and live creation preview worked. The browser's existing 50% zoom caused oversized screenshot canvases; the hosted product is the primary visual deliverable.
- All twelve final artifact files were validated; ten publicly served code/style/icon/font/license files match their SHA-256 hashes. Font MIME/signatures, CSP and app/legacy routes passed. Public publication is locked against old Git branch overwrite.

## Customer data and remaining actions

Michael's actual party and Tiffany's RSVP were not changed by the agent. Earlier Dessert text that never entered the old save payload/draft cannot be reconstructed automatically. If it is still missing, Michael should edit that party and enter Dessert and its intended quantity once; subsequent saves include typed items automatically. To use a password, Michael chooses his own through Account → Set or change password; email codes continue to work.

Current aggregate acquisition/activation/engagement/retention/promotion figures remain unknown. The user reported working desktop/phone OTP and a visible anonymous RSVP after refresh; these are feedback observations, not a measured funnel. Original cutover inventory is historical, and current customer totals were not re-enumerated for this follow-up. Current app-store status is unverified; mobile remains deferred. The previously approved temporary shared Free email sender remains in use.

**Rollback:** restore and lock compatible deploy `6ae6607931398212cdfba8df` to return to the preceding password/item-fix website. These follow-up releases changed no database schema or global Auth configuration, so no data rollback is needed. Preserve accepted parties, responses, claims and identities. Do not restore the old raw-table reader or reopen unsafe legacy grants.

The requested external Pages were unavailable in connected searches. Exact current entries for “00 — Current Status & Next Actions” and “Clogher Labs — Company Operating Ledger” are saved in `WEB_REBUILD_LEDGER_ENTRIES_2026-10-31.md`.
