# PartyPlus approved legacy freeze: held before execution

Production is unchanged. Michael approved only file 01, conditional on a fresh verified production backup, aggregate recent usage and current-baseline match. No production mutation SQL has been submitted.

## Verified read-only preflight

Captured 2026-10-03T01:54:46.529967+00:00, role postgres, transaction_read_only=on. Exact freeze preflight assertions passed. Fresh JSON export matches the previous verified baseline in all 16 compared metadata categories: policies, columns, constraints, tables/owners/RLS/ACLs, grants, indexes, functions, triggers, schemas, PostgreSQL version, database, defaults, publications/publication tables and migration ledger. The freeze file still matches its reviewed normalized-LF SHA256: b87fef62a48798d71d633a7e0d4074e29abeb884507d51ba9511d22d1796959b. No material drift was found.

| Retained rows | Total | Created last 24 hours | Created last 7 days | Created last 30 days | Latest creation (UTC) |
| --- | ---: | ---: | ---: | ---: | --- |
| Parties | 347 | 1 | 5 | 15 | 2026-10-02 15:35:49.026 |
| Items | 637 | 5 | 15 | 66 | 2026-10-02 15:43:42.183157 |
| RSVPs | 118 | 2 | 5 | 12 | 2026-10-02 15:38:35.979671 |

Parties with updated_at in the last 24 hours/7 days/30 days: 1/5/15. RSVPs: 2/5/12. These are counts of retained rows by timestamp, not unique users or complete activity logs. Reads, deletions and item edits without an updated_at field are not measured. No private party content or individual IDs were inspected. Dashboard aggregate traffic showed 208 total requests in its displayed 24-hour window; this includes infrastructure/engineering requests and is not human usage proof. Recent retained-row activity is confirmed.

## Unmet backup prerequisite

Latest listed scheduled physical backup: **2026-10-02 04:09:43 UTC**, approximately 21 hours 45 minutes before the successful preflight. Recent retained-row activity occurred after it. The dashboard lists seven daily physical backups and Restore controls; no capture-now/download control is exposed. A backup listing is not an archive-integrity or restore verification. No fresh backup has been captured or verified.

A usable existing production PostgreSQL backup connection is required. The Connect dialog shows the existing session pooler aws-1-us-east-1.pooler.supabase.com:5432, postgres.typbofemqhjoiwbkdvuc, database postgres, with YOUR-PASSWORD placeholder. No database password, pgpass or usable connection environment is available. No credentials were reset, no role created, no paid feature enabled and no private content exported through the SQL editor.

To continue without changing permissions, enter the **existing** database password locally into the blank password field in the ignored worktree file .test-cache/production-backup-connection.json; do not send credentials in chat. This file is not a backup and currently contains no password. Alternatively, an authorized operator can capture a fresh backup using existing secure tooling and provide its custody/timestamp/checksum/integrity evidence. Follow the official [Supabase backup guidance](https://supabase.com/docs/guides/platform/backups) and [manual backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Production backups must remain recovery artifacts, never QA fixtures or customer content for inspection. Recheck usage and metadata immediately before executing the approved file after the backup prerequisite is met.

## Execution and rollback status

File 01 is **NOT EXECUTED**. Unsafe legacy write policies are still present. Post-freeze write denial, intended-read continuity, unchanged data counts and schema verification have not run. Files 02, 03 and 04 were not executed; nothing was published.

The freeze is transactional, so any pre-commit error/ROLLBACK leaves baseline unchanged. After committing phase 1, the recommended safe recovery is to retain read-only freeze and repair compatibility/communications. Restoring the permissive policies would reopen the confirmed issue and is not authorized here. File 04 is a v2 release-gate pause and is **not applicable** before file 02 installs that gate. An immediately available post-commit rollback to the old write behavior is therefore not claimed. No production backup restore was attempted.

Evidence: [exact production preflight](production-preflight.json), [baseline comparison](baseline-comparison.json), [read-only SQL](read-only-preflight.sql), [execution status](execution-status.json), [scheduled backups screenshot](scheduled-backups.png).
