# PartyPlus remaining external qualification

All fixtures must use staging `qmbwrbxbbshbavfhkujx`. No production customer data, test writes or exploit probes. Production store identity remains `com.partyplus.app`; the internal preview is `com.partyplus.app.preview` / `partyplusnative-preview`. Separate preview installation does not prove an in-place store upgrade.

## Ready Android artifact

APK: `.test-cache/android-preview/partyplus-staging.apk` in the modernization worktree. SHA256 `032538db4185cf5874fe85f132bbda42b86b53a3bdba1086450163258c7e5d9d`. Version 1.0.3 / preview versionCode 1, debug-signed release-mode internal build; production versionCode is not changed. Build evidence and exact client file hashes are tracked under `docs/staging-evidence-2026-10-02`.

Michael must connect an unlocked Android phone, enable USB debugging and accept its normal device trust prompt. Confirm `adb devices -l` reports the intended device before any installation. Use `adb -s <observed serial> install -r <absolute APK path>` for this preview package only. Keep the existing production app/data installed. iOS needs an authorized internal staging build/signing and physical iPhone; no build or publication was submitted. Verify no new spending before any EAS build request.

## Physical core-loop matrix

Record OS/device, APK/build hash, environment, observed result and time for each case. Use two real devices/principals, plus Safari and Chrome as guest browsers. A third verified synthetic user is the stranger. Never mark a desktop responsive view as physical-device coverage.

| Case | Required observation |
| --- | --- |
| Fresh verified host creates, adds items, saves and shares | Exactly one durable party ID; authoritative committed status before sharing; invite remains the same ID |
| Other phone opens cold/warm invite; app installed/uninstalled | Known-ID party displays; correct preview scheme for native test; web RSVP works without installation on qualified staging hosting |
| Guest yes/2, claim, suggest; host returns | Host sees all changes; title edit preserves both guest rows and claims; guest reload sees title |
| Two guests claim one item simultaneously | One winner; other gets a useful conflict; both RSVP rows/suggestions survive |
| Airplane mode before save, save timeout, force-stop after send | Draft/outbox survives; restarting and retrying reuses original party and operation IDs; no duplicate authoritative creation |
| Pause/restart/retry | Draft and original guest operation remain available; definite prior receipt replays; new write is paused; resume does not duplicate |
| Invalid/missing party, stale edit, corrupt local cache | Useful state; no guest repair write; source bytes backed up; no unexplained disappearance |
| Large text, keyboard, safe areas and small screens | Save, retry, RSVP and sharing controls remain visible/reachable; no clipped bring-list input |
| Return later/second phone/email sign-in | Verified host retrieves its grants; verified stranger cannot edit/delete; party/device UUID cannot grant access |

## Delivered email and anonymous linking

Current staging SMTP is the Supabase default, and its preview shows a link-only sign-in email. The account screen expects a six-digit code. This delivery path is **not qualified**. Existing connected Gmail belongs to another app; it is not used as a PartyPlus test inbox. An existing PartyPlus SMTP provider/test mailbox must be configured through secure human credential entry. No credentials in chat, source, screenshots, artifacts or git. Stop for approval if setup requires a paid plan/service or added spend.

Install `supabase/auth-templates/email-code.html` for confirm-signup, magic-link/OTP and change-email templates after custom SMTP is configured. Preserve confirmation requirements; enable staging manual linking as required by Supabase. Keep tracking/prefetch from consuming one-time links; OTP verification avoids relying on that link redirect. Inspect delivery and expiry using the actual mailbox without persisting codes in evidence.

1. Fresh email host: `signInWithOtp` sends mail; wrong/expired code fails; correct delivered code yields a verified session; reuse fails; second phone gets the same principal and host grants.
2. Signed anonymous guest: RSVP and claim, record UUID; `updateUser({email})` sends change-email code; `verifyOtp` type `email_change` preserves exact UUID; existing RSVP/claim and pending outbox remain owned by that principal. Reload and independent email recovery must retain them.
3. Email already belongs to another account: linking must not silently switch principal, merge guest rows or grant another host's parties. Keep guest session/data and route explicit sign-in/recovery separately. Reassignment or merging is outside this batch and requires a reviewed identity-transfer contract.
4. Delivery outage/rate limit/resend/email correction: no claimed sign-in success, no host access until verification, and drafts remain intact. If host retrieval fails after successful verification, retry host retrieval without reusing the consumed OTP.

Administrative conversion + generated OTP passed on real Auth and preserves UUID/ownership, but it is not a substitute for these delivered-code cases.

## Hosted restoration

Needed: secure existing staging DB connection and a **blank isolated hosted destination**, available at no new cost. Use the connection shown in staging's Connect panel; never guess pooler endpoints or reuse production connections. Michael can supply it locally in an ignored file, or run the credential-dependent backup/restore himself. The staging password remains in his password manager. Creating/resetting a password through browser automation requires human entry/submission; do not ask for plaintext in chat.

Use [Supabase's official backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Hard-check source ref `qmbwrbxbbshbavfhkujx` and explicitly approved isolated destination, reject production ref, and capture roles/schema/data/managed-schema customizations/migration history and external configuration. Managed Auth identities, encryption/Vault, storage objects and mail settings need separate checks. Do not treat a normal SQL table export as a full Supabase recovery backup.

Restore with writes paused. Verify exact synthetic UUIDs/party IDs, rows/claims/legacy fields, host evidence/receipts/tombstones, effective table/function ACLs/RLS/search paths, current gate and required defaults. Sign in via destination Auth on a fresh client, list same grants, replay a pre-backup operation receipt, then reject stranger/unsigned raw mutation and permit only intended guest behavior when enabled. Source-project JWTs need not work in the destination. Measure recovery duration and backup age. No overwrite of the source staging project or production, no synthetic Auth-user purge.

Local independent-database `pg_dump`/`pg_restore` passed with existing cluster roles; hosted cross-project Auth restoration is still open.

## Store upgrade provenance

Read-only EAS evidence identifies June 10 source `d1972a0a762b71e71869fe9dd230f29adc1c3184`, iOS build 15 and Android build 12, version 1.0.3. Google Play public listing is consistent. App Store Connect/Play Console must confirm the actual released builds, signing identity/certificate and version increments. No publication is authorized by this checklist.

For an in-place upgrade rehearsal, build the known legacy source and candidate against staging, with a controlled common test package/signing lineage. Preserve representative synthetic legacy IDs/device UUID/cache bytes. Install old test build, create legacy fixtures only before write freeze, then install candidate **without uninstall/clearing data**. Verify cache migration, local-only drafts, first verified account, assisted-recovery boundaries, same invite IDs and safe failure of blocked old writes. A staging rebuild of old source approximates code behavior; an actual store binary/signature/environment qualification still requires the release channel and devices. Never sideload the debug preview over production.
