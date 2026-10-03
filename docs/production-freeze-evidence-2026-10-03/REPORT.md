# PartyPlus legacy write freeze: executed and verified

Michael approved only 01-freeze-legacy-writes.sql, subject to fresh backup, aggregate usage and matching baseline. Those prerequisites passed. Production typbofemqhjoiwbkdvuc committed that exact file at **2026-10-03T03:36:58.518Z**. No verified-contract install, v2 enablement, other production migration, publication, or customer test writes occurred. The earlier held status is preserved in previous-held-status.json and commit 6b46566.

## Fresh backup and recovery custody

A full logical PostgreSQL custom archive was captured from a repeatable-read read-only exported snapshot starting **2026-10-03T03:36:01.033Z**, verified and protected by **2026-10-03T03:36:22.300Z**. PostgreSQL 17.11 pg_dump completed successfully against PostgreSQL 17.6. The archive has **639 entries**, including TABLE DATA for all three PartyPlus tables and auth.users. pg_restore decoded the entire archive into NUL without executing SQL or displaying private contents. A separate role metadata export excludes passwords. DPAPI CurrentUser encryption round trips matched the original SHA256 bytes for both files. Customer records were never inspected or used as QA fixtures.

Recovery files are in the ignored, restricted directory:

C:\Users\clogh\partyplus-native\.worktrees\modernization-phase-1\.test-cache\production-backups\2026-10-03T03-36-01-033Z

- production.dump.dpapi: encrypted full logical archive; original SHA256 42de771c6821313839be49afc0952d3c083985c40a2e267ec71ab236dc02b871.
- roles.sql.dpapi: encrypted role metadata; original SHA256 1e1e69712b86e3e434d421cbe21e353329f14b1d4d6ddef9bc2f4871356c35ae.
- manifest.json: capture, checksum and verification/custody record.

Only the current Windows user, SYSTEM and Administrators have directory access. Preserve this Windows identity/profile/DPAPI key to recover the files. The local encrypted backup is available and its readability/integrity was verified; **an offsite copy and full hosted restoration were not performed**. Storage binary objects, external Auth/SMTP/hosting configuration, role passwords and encryption-root custody are outside the logical database/role archive. The prior provider physical backup remains listed separately. Strict TLS used the official dashboard CA (SHA256 700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7); certificate verification was never disabled. Pooler-to-database pg_stat_ssl reported false; the client-to-pooler connection was strictly verified TLS. No network/SSL settings were changed.

The temporary local credential file has been reset to an empty password after verification. Archive plaintext was removed only after verified encrypted copies existed. No production recovery/restore was attempted.

## Read-only recent usage and baseline

Immediately before execution, every compared baseline metadata category matched (policies, grants, owners/RLS, columns, constraints, indexes, functions/triggers, schemas/defaults/publications/migrations and server version). Exact file SHA256 after CRLF-to-LF normalization: **b87fef62a48798d71d633a7e0d4074e29abeb884507d51ba9511d22d1796959b**. The file contents were submitted unchanged; only the required approval/target session settings preceded them.

| Retained rows | Total before/after | Created last 24 hours | Created last 7 days | Created last 30 days | Latest creation UTC |
| --- | ---: | ---: | ---: | ---: | --- |
| Parties | 347 / 347 | 1 | 5 | 15 | 2026-10-02 15:35:49.026 |
| Items | 637 / 637 | 5 | 15 | 66 | 2026-10-02 15:43:42.183157 |
| RSVPs | 118 / 118 | 2 | 5 | 12 | 2026-10-02 15:38:35.979671 |

Party updated-at counts for 24 hours/7 days/30 days were 1/5/15; RSVP counts were 2/5/12. Current retained rows prove recent activity, not unique human users or all operations. Reads/deletions and item edits without updated_at are not captured. Only aggregate counts and timestamps were returned; no private party content or individual IDs were read. The earlier dashboard traffic aggregate is preserved as historical evidence; it is not user-count proof.

## Exact production verification

Verification completed **2026-10-03T03:37:04.453Z**:

- Eight unconditional mutation policies are absent; nine restrictive INSERT/UPDATE/DELETE deny policies are present, and the three preexisting unrestricted SELECT policies remain. Raw read/enumeration exposure is intentionally still present during this compatibility window.
- anon and authenticated have no effective INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER or MAINTAIN table privilege. The script's final assertion also checks all column mutation privileges.
- **18 of 18 nonexecuting EXPLAIN checks returned 42501 permission denied**: both client roles × three tables × INSERT/UPDATE/DELETE. No EXPLAIN ANALYZE and no DML were executed. These are server-role enforcement checks, not production synthetic writes.
- Both roles' SELECT counts matched the owner counts for all three tables: **six of six read checks passed**.
- Anonymous PostgREST HEAD requests returned **HTTP 200** and exact counts **347, 637, 118**. No response bodies/customer content were retrieved.
- Before/after counts and latest creation/update timestamps matched exactly. The executed file contains no customer-row mutation statements. This is bounded aggregate evidence, not an unperformed row-by-row content comparison.
- Table owners/RLS flags, columns, constraints, indexes, schemas, functions, triggers, defaults, publications/publication tables and migration ledger are unchanged. Only expected policy and grant changes occurred.

## Recovery/rollback and time bound

The local encrypted recovery archive and role/catalog baseline are available now, with verified decryption and archive integrity. Any actual production restore, privilege expansion or permissive-policy reinstatement requires separate approval. A restored archive contains the old unsafe policies: reapply reviewed hardening before exposing a recovered backend to clients.

Before commit, the file's transaction would roll back on error. After commit, the approved safe response is to retain the read-only freeze and repair compatibility/communications. **There is no authorized automatic rollback reopening unsafe writes.** File 04 is a v2 release-gate pause; it remains inapplicable because file 02 was not installed. Immediate restoration of old write behavior is not claimed.

Compatibility/upgrade review deadline: **2026-10-10T03:37:04.453Z** (seven days after verification). This is a review deadline, **not an automatic unfreeze**. All unchanged legacy create/edit/RSVP/claim/suggestion/delete calls now fail; preserved reads continue. No website or store build was published. Full cutover remains separately gated on physical devices, delivered-email linking, hosted restoration and upgrade provenance.

## Evidence

- [Fresh backup verification](fresh-backup.json), [final recovery/custody recheck](local-recovery-verification.json) and [snapshot metadata/usage](backup-preflight.json).
- [Immediate preflight](execution-preflight.json), [execution start](execution-start.json), [commit receipt](commit-receipt.json).
- [Exact verification](execution-verification.json), [post-freeze catalog](production-post-freeze.json), [anonymous HTTP read results](http-read-verification.json).
- The production policy dashboard also showed the twelve expected policies. Screenshot capture timed out; the exported catalog and SQL/HTTP results above are the saved verification evidence.
