# PartyPlus next design — integration handoff

The full-product redesign is integrated in `web/src/App.tsx` and `web/src/styles.css`. The design prototype was developed separately, then integrated after the priority item correction and optional-password releases. The production app uses its actual API/account/draft modules; prototype fixtures are not bundled.

## Design direction

**The invitation is the interface.** Bold paper posters, clean ink rules, expressive Fraunces event titles, and practical Space Grotesk controls replace the earlier sidebar-and-card dashboard. Cobalt, persimmon, and sunny yellow are assigned deterministically from an event ID, so its poster, dashboard ticket, and live preview have one recognizable identity. Artwork is original inline SVG: a cut-paper star, a tulip, and a friendly sun. No generated images or paid assets are used.

The design changes composition throughout the product:

- A horizontal masthead gives My parties, Create a party, and Account a consistent home on desktop and phone.
- My parties features the next gathering, then a dated ticket agenda organized by Hosting/Joined, Coming up, and a collapsible past section. Search appears when useful. Counts come from the actual party list.
- Creation is a numbered worksheet with a live invitation preview. The phone preview starts collapsed; desktop starts open. Pending item name/quantity remain durable and are included when saving.
- Invitations open with a full poster, then clear date/location information and Google Maps actions. RSVP, Share invite, Copy link, and host Edit party actions sit directly below.
- RSVP, the bring-along ledger, guest responses, sharing outlets, and host management each receive a clear hierarchy. The DOM follows RSVP → main details/list → sharing → host controls; the desktop grid places the response/sharing column alongside the main content, and phone follows the same logical reading order.
- The parent-owned Account component retains all email code/password behavior. Shared styles cover its tabs, settings, notices, and optional password section.

## Files to integrate

| Isolated file | Intended destination |
| --- | --- |
| `next-App.tsx` | `web/src/App.tsx` |
| `next-styles.css` | `web/src/styles.css` |
| `assets/fonts/*` | Public build output at `/assets/fonts/*` |

The App imports `Account` from `./Account` and the existing `api` and `editorDraft` helpers. Its own small Icon/Notice components are intentional; the Account component continues using the parent's shared UI helpers. Do not replace Account, API, or editorDraft with the mock preview files.

The production build/deploy allowlist must include the explicit font assets and bundled licenses. CSS uses absolute `/assets/fonts/…` URLs, with local system fallbacks and `font-display: swap`. No browser requests to a font service or tracker are introduced.

## Preserved workflow behavior

The implementation started from release `3c64d877e05aa705eea39e91022df420521b7b03`. Existing save/action handlers were retained, including session initialization, OTP/account conversion, host capability hints, direct and legacy invitation routes, own RSVP projection, item ownership, durable editor draft references, pending item IDs/name/quantity, auto-inclusion on Save, stable item IDs, explicit unclaimed-item removal, guest contribution preservation, operation retry, offline/pause/conflict notices, delete confirmation, and distinct copy/share telemetry.

The exact requested invitation copy remains: “Are you coming?”, “Claim an item to bring”, “Share invite”, and “Copy link”. Maps use `partyMapLinks`, including the existing separate legacy address. Invitation sharing retains native share, text, WhatsApp, email, and Messenger/copy guidance; it does not claim delivery.

## Fonts and licenses

- Space Grotesk variable WOFF2: Florian Karsten's official repository.
- Fraunces 144pt Semibold and Italic WOFF2: Undercase Type's official repository.
- Complete SIL Open Font License 1.1 text is bundled separately for both families.
- `assets/fonts/SOURCES.json` records official download URLs, file sizes, and SHA-256 hashes.

These are unmodified, self-hosted font files, approximately 130 KB total. Both families include their original licenses. No fees or remote font dependencies are required.

## Verification and review

`node design-next/check-design.mjs` passes strict TypeScript against the current parent-owned API and extracted Account. It also verifies preservation markers for the approved editor, map, capability, retry, copy, share, and invitation flows. The parent runs final integrated functional checks before release.

`node design-next/preview.mjs` serves an isolated local visual preview at `http://localhost:8133`. It bundles fixtures from `preview-api.ts`, performs no backend/email requests, and writes only its own design-preview storage keys. It is a development review tool, not production code. Generated bundles are under ignored `.test-cache/design-next-preview`.

Rendered review covered:

- Desktop dashboard, poster/ticket identity, creation preview, invitation action hierarchy, and no horizontal overflow. Parent independently reviewed desktop DOM and visuals at its actual viewport.
- Actual phone CSS width 390 px, with `scrollWidth === clientWidth` (360–390 px depending on the browser's scaled scrollbar). Input text measured 16 px.
- Phone mock RSVP saved a name and group size and enabled unclaimed item actions.
- Phone creation preview reflected title, local date/time, location, and a pending item with quantity. The durable date/pending fields survived navigation/reload in the isolated preview.
- Self-hosted fonts reached the browser's loaded state.
- Parent requested looser headline spacing after the first phone capture; final CSS uses less-negative tracking plus modest positive word spacing for clear word separation.

Saved evidence:

- `evidence/phone-invitation.jpg`
- `evidence/desktop-dashboard.jpg`

The browser was at 50% zoom, producing an unusually large screenshot canvas. The saved desktop capture is still reviewable in its content area. Further screenshot attempts timed out and were stopped; the viewport override was reset. The parent completed its bounded visual review and found no blocker after the headline spacing correction. These captures precede the final small spacing/DOM-order polish; use the integrated hosted preview for the final user-facing visual artifact.

## Remaining integration checks

After copying the two implementation files and font assets, verify the existing password/email account states, create/edit/auth-detour draft preservation, pending-item Save inclusion, guest RSVP → claim, host edit preserving guest contributions, map links, Share invite outlets, and Copy link in the integrated harness. Recheck actual phone/tablet widths and the production CSP/font paths. The redesign introduces no backend or authorization changes.

## Final integrated acceptance

TypeScript passes. The integrated synthetic SQL/Auth harness passed creation with a pending item through an account detour, automatic host save, independent guest RSVP and claim, host refresh, and host edit adding a second pending item while preserving the original claim/quantity. Share invite opens the available outlet panel and Copy link copies the exact browser invitation. Map/directions links remain correct. The standalone Account module and its password/OTP behavior are unchanged from the separately released password update. No production customer records were used for mutations.

The build copies only explicit self-hosted fonts/licenses; the hosting helper validates an explicit recursive allowlist, WOFF2 signatures and public configuration, and retains credential scans. Production CSP keeps fonts on the same origin. The local review server is stopped after acceptance.
