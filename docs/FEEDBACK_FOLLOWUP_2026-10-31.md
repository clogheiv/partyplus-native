# PartyPlus customer feedback follow-up — October 31, 2026

User reports desktop and phone email-code sign-in worked on release `44af0a6`; Tiffany's anonymous RSVP appeared after refresh. User also reports missing bring-list text after saving, requests clearer RSVP/bring-list copy, clickable location/directions, and optional password sign-in.

Priority is a separate bring-list/copy/maps release before optional passwords. Existing Michael party and Tiffany RSVP are preserved; mutations for verification use synthetic staging records only.

**Priority correction released at21:30:38 UTC:** source `3c64d877e05aa705eea39e91022df420521b7b03`, locked deploy `6ae65dbe5436fd281118167c`, https://partyplusapp.com. Four live public asset hashes matched the reviewed artifact. Previous compatible deploy `6ae65016a97425eaaa716db8` is retained for frontend rollback; no database change was needed. Password work began after this publication.

## Optional password acceptance

Supported Supabase Auth methods retain the same verified principal. Real staging proof used a new synthetic account and retained its Hosting/Joined lists through password addition, fresh password sign-in, wrong-password denial, OTP recovery and password replacement. No customer password, global Auth policy or production party record was changed.

The extracted Account UI keeps email codes as its default method, offers password sign-in and Set/change password for verified users, and recovers with an existing-account-only email code request (`shouldCreateUser:false`). Unknown recovery requests use conditional delivery wording. Signed-in users have an explicit fresh-code verification action before retrying a password change. Passwords remain transient form state and are not trimmed, logged, measured, or stored with drafts.

Focused local synthetic browser acceptance passed: verified-code sign-in; optional password setup; password sign-in from an independent browser origin with Hosting1 retained; reload retained the password session; Forgot password requested a code, returned directly to new-password setup, and preserved the same hosted party after recovery. This uses ephemeral mock Auth, not real customer credentials. Eleven password/recovery API tests and six existing reliability tests pass; helper/editor tests cover four additional cases. The actual live Supabase identity proof is recorded separately in `PASSWORD_IDENTITY_CHECK_2026-10-31.json`.

## Confirmed diagnosis and first fix

The released editor kept `itemName` and `itemQty` in separate React state. Neither was in the durable draft, and Save submitted only `draft.items`. A typed item was therefore omitted unless the user first clicked Add or pressed Enter. Its quantity was also lost across an account detour.

Independent real staging verification did not find a server item-drop for explicit items: Dessert / Serves12 survived create acknowledgement, receipt replay without duplication, fresh host/guest/unsigned reads, a separate verified host sign-in, host edit, and a guest claim/RSVP. See `supabase/web-rebuild/BRING_ITEM_SAVE_CHECK_2026-10-31.json`.

The fix makes pending item text, quantity and reserved identity part of the durable editor draft. Add, Enter and Save consume the same pending item operation. Save automatically includes nonempty item text; a quantity without a name prompts correction. Typed fields persist before navigation to sign-in. Duplicate names remain valid separate contributions, while a repeated consume of one pending identity does not duplicate it.

Requested copy: “Are you coming?”, omit the host-planning sentence and bring-list eyebrow, use “Claim an item to bring”, and empty state “No items listed yet. You can suggest something to bring.” Location/map and directions links prefer the stored street address, falling back to the location text. They use Google's free universal Maps URLs, which require no key and support a browser fallback: https://developers.google.com/maps/documentation/urls/get-started .

Focused helper checks: four pass; TypeScript passes. Rendered synthetic browser checks passed: unadded Dessert / Serves12 survives reload and a sign-in detour, then Save without Add includes it; editing with Add Chips /2bags and Enter Brownies /1tray followed by Save/reload yields exactly three items; independent-origin guest sees all three quantities, “Are you coming?” and the updated bring-list heading. Encoded location/map/directions links use the expected test address. These complement the independent real-staging round-trip above; no production customer record was changed.

## Subsequent phases authorized by the user

After this first functional release, add optional Supabase password sign-in for existing verified accounts on the same principal, retain email-code sign-in/recovery and persisted sessions, and leave guest RSVP unchanged. Then execute a substantial, distinctive visual redesign across creation, My Parties, invitations, RSVP and bring lists. The present site is a first working version; the design phase must create an intentional visual identity and clear everyday actions, beyond a minor color adjustment. Keep responsive behavior, contrast, keyboard access and existing no-cost resources. Release each functional correction independently before that design phase.

## Password release and visual integration

Optional password source `046190d98ab0cf6b703d2f09d5c0572576711213` was published and locked at21:42:07 UTC as deploy `6ae6607931398212cdfba8df`. It followed the already-released item correction. Existing customers choose their own passwords; no customer credential or global Auth setting was modified.

The subsequent full visual redesign replaces the generic sidebar/card presentation with an invitation/poster identity, bundled licensed Space Grotesk/Fraunces type, event palettes, dated ticket agenda, and live creation preview. Parent desktop/phone visual review passed after loosening serif headline spacing. Phone widths and readable input sizing were checked; the final integrated local creation/guest/claim/host-edit/share/copy path passed without changing Michael’s party or Tiffany’s RSVP. See `WEB_VISUAL_REDESIGN_2026-10-31.md`.
