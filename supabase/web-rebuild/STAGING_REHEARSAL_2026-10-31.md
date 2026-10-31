# Staging browser-contract rehearsal — 2026-10-31

Migration: `01-browser-contract.sql` (LF-normalized SHA256 `49e558980c6e2aa54133f08c7db896a42fae5a88fd3e82db923ed4548e29e306`).

At **19:56:30 UTC**, `node scripts/web-backend-staging.mjs rehearse` successfully installed the candidate inside a serializable transaction on existing Free staging `qmbwrbxbbshbavfhkujx`, checked the following invariants, and **rolled back**. No migration was committed. Production was not accessed by this rehearsal.

| Existing table | Retained rows | Before/after fingerprint |
| --- | ---: | --- |
| public.parties | 18 | `8cc7eb87a5cd98325c39467ffa4d27da` |
| public.party_items | 46 | `8919ef9389ca7878617fcc3d3b1a2dbd` |
| public.party_rsvps | 22 | `f5dd1a3c35662daa7a0b02e79f949d47` |
| partyplus_private.host_access | 18 | `ba0aeba72979d6f2cc2ca54d3f21f472` |
| partyplus_private.operations | 105 | `17e82a54fc5bcc2538a0e299c595a66c` |
| auth.users | 42 | `8a9f867d0c94275b4c56ebe58df67e94` |

Fingerprints are aggregate MD5 of sorted complete row JSON, computed inside the database; customer-like synthetic contents were not output. All six tables matched exactly. Existing verified-write gate remained true. Both anon and authenticated retained no raw SELECT/mutation grant on the three public tables (six role/table checks). Strict TLS and the pinned dashboard CA were verified.

Local isolated browser-contract tests passed **18/18**, covering both synthetic text-key and observed UUID-key schemas. They verify automatic host access, durable explicit join, RSVP/suggestion membership, historical receipt privacy, guest/host/self projections, deduplication, unsigned-open-only telemetry, and paused writes.

## Pending approval-review restriction

Automatic approval review rejected the separate persistent action `node scripts/web-backend-staging.mjs install` because it creates persistent tables/triggers and grants new anonymous/authenticated RPC access, and the reviewer required explicit approval of that exact security scope. It explicitly prohibited bypassing through another execution route. No UI/API workaround was attempted.

The prepared change adds private memberships and allowlisted enum-only event storage. It adds read/join/own-party-list/event RPCs, restricts anonymous telemetry to invitation opens, and **reduces existing v2 identity exposure**. It does not reopen direct table access, create accounts, modify customer rows, modify credentials, add spending, change the existing release gate, or touch production.

The user subsequently replied **“Approve this staging migration”**. The exact rehearsed migration committed successfully at **19:58:16 UTC**, with the same hash, counts/fingerprints, unchanged gate and six denied raw-role checks. Production was not accessed. This resolves the staging approval-review restriction; production security changes remain separately subject to their concrete action-time scope.
