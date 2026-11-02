# Return access and party lifecycle — focused backend verification

Verified on November 1, 2026 local time, at `2026-11-02T02:02:02Z`, against existing staging project `qmbwrbxbbshbavfhkujx`. Source baseline was `c61239a4919a24e826b396feaf00309479b556aa`. This check did not access production or customer parties and made no API, schema, Auth configuration or credential changes.

## Actual deletion contract

`scripts/verify-staging-party-lifecycle.mjs` created a uniquely named disposable party through `partyplus_v2_commit_party` using the existing verified synthetic reviewer host. A new anonymous synthetic guest saved Going/2 and claimed its only item. A different verified reviewer account and the anonymous guest each attempted deletion and received `42501`. The unrelated account's failed attempt left the invitation readable.

The actual host then called `partyplus_v2_delete_party` with a fresh operation UUID. The RPC returned a matching deletion receipt; retrying that operation returned the same receipt. After the successful deletion:

- Both `partyplus_web_read_party` and the older `partyplus_v2_read_party` returned null for unsigned, anonymous guest, host and stranger sessions.
- The host's Hosting list and the guest's Joined list excluded the deleted party.
- A fresh guest RSVP mutation was rejected.
- Owner-only read-only SQL confirmed a tombstone on the party. Its one item and one RSVP remained stored, preserving recovery potential. This implements removal from normal app/invitation access, rather than physical erasure of all underlying rows.

Six unrelated-table fingerprints were identical before and after: 25 parties, 57 items, 28 RSVPs, 25 host grants, 29 memberships and 133 mutation receipts. Fingerprints exclude only the two newly generated fixture IDs. No existing fixture/customer party was used as the deletion target. Full aggregate results are in `docs/staging-party-lifecycle-2026-11-01.json`.

## Fixture handed to the frontend lead

A separate new party remains available for the lead's rendered host Manage/Edit/Delete and confirmation checks:

```text
partyId: f8a4bad6-e418-4ed2-8ac3-6a0d536d9d07
title: Disposable host manage and confirmation UI verification
host: existing synthetic reviewer account index 0
date: 2026-12-15T18:00:00.000Z
item: Disposable dessert — Serves 2
```

It was created in staging by the same verified reviewer. Its ID is also stored in ignored `.test-cache/lifecycle-ui-fixture.json`. The lead may delete this expressly disposable fixture after confirming the rendered flow. No credentials are recorded here. Rendered UI checks and release remain the lead's responsibility.

## Scope limits

These are actual staging API/SQL results, not a claim that the new Manage controls or confirmation have already passed rendered tests. The existing backend already enforces host-only deletion, so no backend change was needed. Past-party classification belongs in the requested view logic, using the saved timestamp and current time; this investigation did not delete or alter parties based on age. Authentication identity/configuration was left unchanged.
