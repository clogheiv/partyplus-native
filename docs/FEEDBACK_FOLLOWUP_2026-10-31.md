# PartyPlus customer feedback follow-up — October 31, 2026

User reports desktop and phone email-code sign-in worked on release `44af0a6`; Tiffany's anonymous RSVP appeared after refresh. User also reports missing bring-list text after saving, requests clearer RSVP/bring-list copy, clickable location/directions, and optional password sign-in.

Priority is a separate bring-list/copy/maps release before optional passwords. Existing Michael party and Tiffany RSVP are preserved; mutations for verification use synthetic staging records only.

## Confirmed diagnosis and first fix

The released editor kept `itemName` and `itemQty` in separate React state. Neither was in the durable draft, and Save submitted only `draft.items`. A typed item was therefore omitted unless the user first clicked Add or pressed Enter. Its quantity was also lost across an account detour.

Independent real staging verification did not find a server item-drop for explicit items: Dessert / Serves12 survived create acknowledgement, receipt replay without duplication, fresh host/guest/unsigned reads, a separate verified host sign-in, host edit, and a guest claim/RSVP. See `supabase/web-rebuild/BRING_ITEM_SAVE_CHECK_2026-10-31.json`.

The fix makes pending item text, quantity and reserved identity part of the durable editor draft. Add, Enter and Save consume the same pending item operation. Save automatically includes nonempty item text; a quantity without a name prompts correction. Typed fields persist before navigation to sign-in. Duplicate names remain valid separate contributions, while a repeated consume of one pending identity does not duplicate it.

Requested copy: “Are you coming?”, omit the host-planning sentence and bring-list eyebrow, use “Claim an item to bring”, and empty state “No items listed yet. You can suggest something to bring.” Location/map and directions links prefer the stored street address, falling back to the location text. They use Google's free universal Maps URLs, which require no key and support a browser fallback: https://developers.google.com/maps/documentation/urls/get-started .

Focused helper checks: four pass; TypeScript passes. Rendered synthetic browser checks passed: unadded Dessert / Serves12 survives reload and a sign-in detour, then Save without Add includes it; editing with Add Chips /2bags and Enter Brownies /1tray followed by Save/reload yields exactly three items; independent-origin guest sees all three quantities, “Are you coming?” and the updated bring-list heading. Encoded location/map/directions links use the expected test address. These complement the independent real-staging round-trip above; no production customer record was changed.

## Subsequent phases authorized by the user

After this first functional release, add optional Supabase password sign-in for existing verified accounts on the same principal, retain email-code sign-in/recovery and persisted sessions, and leave guest RSVP unchanged. Then execute a substantial, distinctive visual redesign across creation, My Parties, invitations, RSVP and bring lists. The present site is a first working version; the design phase must create an intentional visual identity and clear everyday actions, beyond a minor color adjustment. Keep responsive behavior, contrast, keyboard access and existing no-cost resources. Release each functional correction independently before that design phase.
