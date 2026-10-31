# Browser rebuild verification — October 31, 2026

## Final production acceptance

Production secure installation committed paused with original-column fingerprints and counts preserved; reviewed gate enable independently confirmed at 20:36:58 UTC. Actual production email delivered through the existing Free sender and its code verified a legitimate company account. No synthetic parties, items or RSVPs were written in production. The release published and locked at 20:37:34 UTC; https://partyplusapp.com renders the new browser app. Seven public app/deep routes return200 with CSP, and four served public assets match the reviewed six-file artifact. Screenshot `web-evidence-2026-10-31/production-released.png` records the live product. All broader host/guest workflows below passed in staging; no new production customer fixtures were created to repeat them.

## Focused checks

| Check | Result | Limits |
| --- | --- | --- |
| `npm run check:web` | Pass | Browser TypeScript only; no native rebuild |
| `node --test tests/web-api.test.mjs supabase/web-rebuild/*.test.mjs` | 27 pass / 0 fail | Ephemeral PGlite tests exercise synthetic and observed UUID schemas plus the exact combined production package; no parallel SQL sessions |
| `node --test tests/*.test.mjs` | 84 pass / 0 fail / 1 skip | Independent-PostgreSQL pause-drain case skipped in PGlite; prior PostgreSQL evidence is historical |
| `git diff --check` | Pass | Whitespace/conflict markers only |
| Existing Netlify draft routes/assets | Pass | Eight routes, exact asset hashes and CSP; original published deploys unchanged |

## Rendered synthetic browser journey

Ephemeral loopback test process uses mock Auth with actual SQL behavior. It is not shipped and binds loopback only. No customer data used.

1. Draft title/location/note/items survives navigation to host sign-in and back.
2. Local date/time remains after another field changes; save displays selected November 20 6PM. A real observed date reset was fixed with native input handling and then reverified.
3. Verified host creates party, sees host controls without joining, and returns from Hosting after reload.
4. Copied clipboard URL is current origin `/i/<same-id>`.
5. Fresh guest signs anonymously on first response, saves Going /2; claims Fresh bread; suggests Sparkling lemonade. Reload retains response/count/own claim and all items.
6. Joined navigation returns to same party without joining again. New email verification retains the guest principal, claim and Joined membership.
7. Host signs back in under same account in a new session; original party appears in Hosting. Host title edit retains guest response/count, claim and suggestion.
8. Phone and tablet layouts inspected; no horizontal page overflow. Requested widths390/768 yielded433/853 CSS pixels at existing browser zoom; desktop1180. Screenshot evidence: `web-evidence-2026-10-31/{phone-invitation,tablet-invitation,desktop-joined}.png`. Viewport override cleared.

## Hosted staging verification

Latest artifact: https://6ae649cd40e8400ac37aa9b2--famous-fairy-b9cb63.netlify.app . Separate first draft origin retains the account sign-in flow, allowing independent browser storage.

Synthetic staging fixture `20667f51-1e84-4784-b2ba-895b86d91fa0` created by authorized existing reviewer host through real RPC. On latest public preview:

- Direct unsigned invitation opens without installing an app; title/date/location/notes and bring list load.
- First guest action creates real anonymous Supabase Auth session. Going /2 response acknowledged; own RSVP appears, host controls absent.
- Ice claim acknowledged with own Release control. Browser QA fruit platter suggestion persisted, making four list items.
- Clipboard contains correct hosted `/i/<id>` link. Copy event is an action record, not proof of delivery.
- Reload to My Parties opens Joined1 automatically; same party retained. Banner explains browser-bound guest access and email verification for another device.
- Screenshot `web-evidence-2026-10-31/live-staging-joined.png` records hosted return behavior.
- After exact user approval, the latest PartyPlus staging message was read through a narrowly scoped company Gmail search. Its code was extracted in memory with output masked, entered into the first preview, then cleared. Real delivered-code sign-in recovered the existing verified host's Hosting2/Joined1. No unrelated message was opened, and new mail tabs were closed.
- Verified host created `0ca7544c-d486-4672-b55f-1b3ed49db883` through the actual product, with selected December 12 6:30PM date/time and Fruit salad. Saved party showed host controls and appeared in Hosting3 after reload, without a join step.
- Existing independent guest preview opened that new invitation, RSVP Going/3 and Fruit salad claim passed. Host saw guest group count/name and claim, then changed the title to “Web host acceptance — updated”; response/count and claim remained.
- Third clean origin `https://6ae64afaaa5fee650a934c14--famous-fairy-b9cb63.netlify.app` used another delivered code for the same account. It recovered Hosting3 including that updated party and Joined1 including the existing synthetic joined party. This proves independent browser storage return; it is not a physical second-device test.
- Guest identity was preserved: automatic approval review rejected ending the anonymous test session to sign into an existing account. The safer third-origin test avoided that switch; no workaround changed the guest identity or records.
- Independent strict-TLS backend verification confirmed the first browser fixture has one RSVP/count2, four items, one claim and signed membership, with no host grant for guest. A separate real-Auth/RPC fixture passed eight focused server checks; see `supabase/web-rebuild/LIVE_STAGING_CHECK_2026-10-31.json`.

## Preserved boundaries

- Production customer records unchanged; no synthetic production writes. Legacy unsafe writes stay closed.
- Browser projection removes host/principal ownership fields, exposes own response only to guest and masked guest identities to host; server authorizes every operation. Host/guest UI controls do not replace authorization.
- API durable-operation tests verify exact replay across reload, no overwriting unknown pending payloads, principal mismatch denial, verified-host requirement, safe definite-rejection recovery and content-free event parameters.
- SQL tests cover privacy across reads and historical receipts, Hosting/Joined/backfill, RSVP/suggestion membership, own claim, telemetry enum/deduplication, safe pause and receipt replay. Inherited contract tests cover stale revisions, competing claims, transaction rollback, tombstones and legacy-ID preservation.

## Remaining acceptance

Verified production public SMTP and reversible data-preserving cutover/release remain. Historical device-only host ownership is preserved but cannot be safely self-claimed; support review required. Existing-account sign-in does not merge a different anonymous guest identity; UI warns before ending that guest session. No current production acquisition/activation/retention or promotion metric is claimed.

## Explicit invitation-sharing clarification

The user's final clarification requested both Share invite and Copy link, with available messaging outlets. The former browser-native action was renamed and expanded into an always-available share panel. It exposes the device's native share chooser when supported, plus text message, WhatsApp and email handoffs. Messenger and other apps can use the native chooser when available or the copied invitation link. The recipient always receives the same `/i/<party-id>` browser invitation; no PartyPlus app is required. The sender chooses recipients and sends within their chosen app.

Focused browser verification opened the panel, confirmed all three encoded outlet links preserve the exact invitation and include its browser context, confirmed native chooser availability, and separately copied the exact link after acknowledgement. No message was sent to anyone and no delivery was claimed. Screenshot: `web-evidence-2026-10-31/share-invite-options.png`. TypeScript and the production build pass after this necessary UI clarification; backend/auth/ownership behavior is unchanged.
