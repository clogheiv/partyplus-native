# Structured party location — November 2, 2026

The agreed browser/server field is optional `locationDetails`:

```json
{"version":1,"streetAddress":"123 Synthetic Lane","city":"Testville","zipCode":"12345-6789"}
```

The complete object has exactly these four keys. Version must be numeric 1. Components are strings bounded to 300, 120 and 20 characters respectively; control characters and extra keys are rejected. The server trims surrounding spaces and does not guess a country's postal-code format. A complete version-1 object with empty strings explicitly means no structured address. Omission, or a null property echoed by an older client from a read projection, preserves the existing structured value.

## Legacy and access behavior

One nullable `public.parties.location_details` JSONB column stores the new object. There is no parsing, backfill or migration-time change to old `location`, `address`, appearance, timestamps, claims, RSVPs, identities or mutation receipts. The frontend displays old freeform location/address verbatim and requires an explicit Replace saved location action to adopt the new fields. Once a structured object exists, its empty fields do not fall back to stale legacy text. The frontend lead owns the shared invitation/preview/list/maps formatter; the backend keeps the raw old fields unchanged by structured updates. Older clients retain their existing explicit `location` write behavior.

The existing verified-host commit, revision check, operation request identity, durable replay, invitation privacy projection and write gate remain in force. No new public RPC name or client table permission is introduced. The existing read projection adds `locationDetails`, so fresh invitation reads, MyParties and new commit receipts share the same persisted object. Historical operation receipts remain historical; a fresh read returns current fields. No Auth, Storage, billing, mobile or browser settings change is required.

The public commit wrapper delegates to the existing appearance-aware core and updates only the supplied nonnull structured value plus that new operation's receipt, in the same transaction. Direct client access to private cores remains revoked. The production guard compares all eight original-table fingerprints and all 34 existing public RPC access flags, raw table grants and gate state; a mismatch aborts the transaction.

## Focused verification

`tests/location-details-contract.test.mjs` passes six checks using the exact production guard: all original fields/historical receipts preserved; host receipt/replay and guest/list roundtrip; appearance/RSVP/claim retention; older-client omission and null-echo preservation; explicit empty semantics; strict atomic input rejection; unchanged ownership/revision/raw-access/privacy protections.

Hosted staging rehearsal rolled back successfully, then installed at `2026-11-03T01:45:55Z` (November 2 local). All eight original fingerprints and existing access flags were identical. Actual host/returned-host/unsigned/guest RPC checks passed at `01:46:40Z`: receipt/replay, cross-session/MyParties/invitation persistence, preserved legacy text, appearance and Going/2 plus claim, denied stranger/guest writes, and malformed input rollback. The subsequent narrow null-echo compatibility correction at `01:49:33Z` likewise preserved all eight fingerprints and access flags; its actual null-echo check passed at `01:49:35Z`.

Evidence is in `docs/location-details-staging-*.json` and `docs/location-details-null-echo-2026-11-02.json`. Only newly generated synthetic staging parties were mutated. A separate unparsed legacy fixture was prepared for the parent's rendered HTTPS acceptance check. No credentials are recorded in these documents.

## Final rollout artifacts

| Artifact | SHA256 |
| --- | --- |
| `supabase/location-details/01-location-details.sql` | `181754752dd6804a10460b2755df4aca19fd2c5dc593664ca9ddc2f918ea7ee0` |
| `supabase/location-details/production-guarded.sql` | `24d108ad382dc79e4e46370381f5eb51a8fde81e0be93f7a188ca37eeecd5ace` |

The production read-only preflight at `2026-11-03T01:47:22Z` records 350 parties, 642 items and 121 RSVPs, eight full aggregate fingerprints, unchanged enabled gate, denied raw client access and 34 existing RPC access flags. The feature was not installed at that baseline.

The parent's actual HTTPS acceptance passed on desktop1440 and phone390: create through the form/auth detour, save/reload/edit retained three components including leading-zero ZIP, invitation/map/directions used the complete address, and the legacy fixture retained unparsed text with an explicit replacement action. Production then installed the exact final guarded source at **`2026-11-03T01:55:23Z`**. The **`01:55:40Z`** read-only postflight confirms all eight original fingerprints unchanged, all 34 RPC access flags plus raw grants/gate unchanged, and every pre-existing structured value null (no backfill). No production synthetic fixture or customer write was performed. Evidence: `docs/location-details-production-{preflight,install,postflight}-2026-11-02.json`. The release lead owns matching frontend publication.

One documented-browser screenshot capture timed out; it was not repeated and no native fallback was used. Preservation proof is the successful transaction assertion receipt and saved read-only postflight JSON; rendered product evidence is held by the parent.

The migration is transactional, with lock/statement timeouts and preservation assertions. An error before commit rolls back the whole install. After successful use, retain the new column/data and a compatible frontend; use a forward correction rather than dropping saved structured addresses or reconstructing legacy text. For an integrity incident, the existing verified-write pause remains available without deleting customer records or reopening raw grants. No new account, purchase, permission expansion or public exposure mechanism is part of this change.
