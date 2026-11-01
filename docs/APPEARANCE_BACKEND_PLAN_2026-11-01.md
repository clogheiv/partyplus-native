# PartyPlus appearance and personal photo contract

Status: prepared, isolated tests passed, hosted staging transaction rehearsed and rolled back. No bucket, persistent policy, customer appearance or photo was created by this preparation.

## Exact proposed change

Apply `supabase/appearance/01-appearance-contract.sql`, LF-normalized SHA256 **`50b164d969f35fd97f38e14fe0e0e959510da0ecbba7c5375ebd535982ea12bb`**, first to existing staging `qmbwrbxbbshbavfhkujx`, then production `typbofemqhjoiwbkdvuc` after focused hosted checks. Create the empty bucket through the supported Storage API with `supabase/appearance/bucket-config.json`: **`partyplus-party-images`**, **public**, **JPEG only**, **1,500,000-byte file limit**. This uses the existing projects/resources; no paid service, plan, image transformation or billing feature is added. Exact approval of the public-image/permission scope is requested before persistence.

The migration adds a nullable `parties.appearance` column without backfill, private owner-bound image reservations/unsaved-party intents, strict appearance validation, a wrapper around the existing transaction/revision/claim/RSVP commit core, appearance projection, and three bucket-scoped Storage policies. All original fields and timestamps, accepted operations, memberships, claims and responses remain unchanged. Old clients omitting `appearance` retain the stored look; explicit versioned defaults reset it. Historical receipts remain historical snapshots, while a fresh read returns the latest look.

## Appearance shape

`appearance` may be absent/null for old parties. The client displays the existing PartyPlus design. Version 1 validates these exact tokens:

| Field | Allowed values |
| --- | --- |
| version | `1` |
| design | `partyplus`, `casual`, `birthday`, `cookout`, `holiday`, `shower`, `game-night` |
| layout | `illustrated`, `photo`, `elegant` |
| accent | `navy`, `cobalt`, `orchid`, `forest`, `coral`, `gold` |
| font | `editorial`, `modern`, `classic` |
| artwork | `partyplus`, `confetti`, `balloons`, `citrus`, `evergreen`, `blossom`, `game-night`, `none` |
| optional image | `{id:UUID,positionX:0..100,positionY:0..100,zoom:1..2}` |

Unknown keys/URLs/CSS/font names/versions and nonnumeric or out-of-range positioning are rejected. Only a verified actual host can save appearance. No URL or binary is stored in the party, draft JSON or receipt; an immutable image UUID derives its object path and public URL.

## Photo access and validation model

**A photo is visible to anyone who has its invitation or retained image URL. This is public capability access, not a private or guaranteed-revocable photo system.** Opaque random keys reduce discovery; they are not an authentication claim. The product must communicate this plainly before upload.

Supabase documents that [public-bucket GET bypasses RLS](https://supabase.com/docs/guides/storage/buckets/fundamentals), while listing and mutations still use access policies. There is no client list/read SELECT policy. The sole SELECT policy is authenticated, owner-bound and limited by the server-set Storage operation to deletion; [operation-aware helpers](https://supabase.com/docs/guides/storage/schema/helper-functions) were verified present in existing staging. No owner UUID, party title, original filename or personal data appears in object paths (`<image UUID>.jpg`). No overwrite/update permission is granted.

The browser decodes pixels and re-encodes JPEG on white, dropping original metadata, with a 1600-pixel maximum edge and 1.5 MB output cap. Source input is bounded to supported JPEG/PNG/WebP, 20 MB and 48 megapixels. The bucket independently enforces declared JPEG MIME and file byte size; commit validates actual stored metadata and a registered owner/party-bound slot. **This does not independently decode/sanitize bytes on the server.** The registered SHA256 binds client retry intent; duplicate/uncertain upload acceptance requires the client to fetch and hash the actual object. No untrusted HTML/SVG or arbitrary URL is an allowed appearance field.

## Upload and safe cleanup

1. Keep the photo in local IndexedDB for immediate draft/auth-return preview. Reserving a new photo needs a verified host. No remote party is created just to upload a photo.
2. `partyplus_web_prepare_image(p_party_id text,p_image_id uuid,p_byte_size integer,p_sha256 text)` returns `{imageId,bucket,path}`. A new random party UUID has one verified owner intent; another account cannot claim it. Existing party IDs require their actual host grant. Repeat identical reservations are idempotent; a changed payload or owner conflicts.
3. Upload to that exact path with `upsert:false`. For a duplicate or uncertain response, verify fetched bytes against the registered SHA256. Save the versioned appearance through the existing party commit transaction. Missing/wrong-owner/wrong-party/wrong-size/wrong-MIME objects cannot be committed as a photo.
4. After a confirmed replacement/removal, `partyplus_web_begin_image_removal(p_image_id uuid)` marks an **unreferenced** owned photo retiring under the same party lock. Future commits cannot adopt it while the multi-request Storage deletion runs. Then call `storage.remove`, followed by `partyplus_web_release_image(p_image_id uuid)` only after actual object absence. Failed cleanup keeps the old slot counted and can retry under the same owner. A currently referenced live photo cannot be deleted by this path. No customer object is automatically deleted by this migration.

Resource protection counts worst-case reserved capacity: at most 160 unreleased slots (240 MB), 40 per principal (60 MB), and 8 per party (12 MB). A released slot frees capacity only after the object is absent. `image_capacity_reached` should offer a curated design or cleanup of unused photos. This is media resource protection, not pricing, hosting eligibility or a paywall. Existing provider quota/headroom must be confirmed before production, with no paid overage enabled. Public caches/recipient copies may outlive deletion; do not promise immediate revocation.

## Verification already completed

`tests/appearance-contract.test.mjs` passes twelve focused checks: original rows/receipts untouched; old-client omission preserves appearance; valid host save/replay; invalid styles/position rollback; guest/stranger/private-core denial; verified unsaved-party reservation without an orphan party; strict uploaded metadata and cross-party binding; no listing/overwrite; safe removal/re-adoption exclusion; paused writes with preserved reads/replay; photo-specific rollback retaining saved photos and ordinary guest/host workflows; and execution of the unchanged approved source inside the production preservation wrapper.

Actual staging read-only baseline: zero buckets, objects, bytes and object policies; operation helpers installed. A hosted **rollback-only** rehearsal on November 1 at 22:41 UTC passed all eight table fingerprints: 23 parties, 55 items, 26 RSVPs, 23 host grants, 27 memberships, 124 receipts, 46 Auth users and zero Storage objects. The write gate remained enabled and all six raw client table grant checks stayed denied. Evidence: `docs/appearance-evidence-2026-11-01/backend-rehearse.json`. No image paths or contents were inspected.

After exact approval, qualify actual staging API behavior: valid JPEG upload and public guest GET, server oversized/MIME rejection, denied bucket listing/overwrite/cross-host changes, cross-session saved appearance, safe replacement cleanup, and preservation of unrelated synthetic fixtures. Production preflight must capture fresh aggregate/fingerprint/Storage metadata without outputting Michael's party, Tiffany's RSVP or other customer content. Production migration/rollback should preserve all accepted data; rollback disables new photo writes while retaining safe existing appearance reads and the compatible frontend.

The approved source was installed on staging at 22:47 UTC. Its eight original-table fingerprints, existing gate and denied raw grants were unchanged. The real Storage API then verified the exact public JPEG bucket limits, byte-identical unsigned image GET, denied listing for guest/host/stranger, denied overwrite and cross-host writes/deletion, oversized/MIME rejection, cross-session party/MyParties appearance, guest RSVP/claim preservation after an older-client edit, in-use deletion denial and replacement cleanup. Evidence is recorded in `backend-install.json`, `staging-bucket.json`, `staging-storage-api.json` and `staging-cross-host-delete.json` in the evidence directory. All mutations used synthetic staging fixtures.

The production read-only baseline at 22:57 UTC records 349 parties, 642 items and 121 RSVPs, with all eight aggregate fingerprints, zero buckets/policies, required Storage helper present and the existing gate enabled. `production-guarded.sql` wraps approved source SHA256 `50b164d969f35fd97f38e14fe0e0e959510da0ecbba7c5375ebd535982ea12bb` with a single transaction and original-data/grant/gate preservation assertions.

After the lead's actual rendered staging save/reload/edit passed, production installed at **22:58:51 UTC**. The full applied wrapper SHA256 is `48ea8de51948d3da261535cb439be17e22a7bf739e263ff320a9f8b71aa2ee63`. The public bucket was created through the dashboard's supported Storage flow. The final **23:00:13 UTC** read-only result verifies `public=true`, exact `1500000` byte cap, `image/jpeg` only, three scoped policies and zero objects. All eight original-table fingerprints still match the preflight, all existing appearances remain legacy defaults, the existing gate is unchanged and raw client access remains denied. There were no synthetic production party/image/RSVP writes and no customer-data edits. Evidence: `production-preflight.json`, `production-install.json`, `production-postflight.json`, `production-bucket.png`.

The rendered staging evidence additionally covers a newly created photo invitation, crop retention, unsigned second-origin view without host controls, MyParties thumbnail after reload, and a host design/font/accent edit preserving the anonymous Going/2 RSVP and claimed Dessert item. The lead owns publication of the matching frontend artifact. The approved public-photo disclosure and photo-only rollback remain part of the release.

## Fresh production headroom and prepared rollback

The existing production Storage dashboard shows **zero buckets**. The current Pro organization Usage screen reports **3.199/100 GB Storage**, **0.16/250 GB egress**, and **0/250 GB cached egress**, no quota exceeded, with a notice that overages are not currently billed (restrictions may apply). Usage may lag by one hour. The proposed maximum 240 MB reservation budget is within current included storage headroom; no other application settings or allowance are changed. No paid transformation/Edge feature or overage is enabled.

`supabase/appearance/02-pause-new-photo-writes.sql` is the prepared non-destructive feature rollback. It revokes new photo reservation/removal helper access and the three photo Storage policies, while retaining all appearance values/object bytes/reads/receipts and the compatible frontend. The focused rollback test proves saved photo metadata still reads and normal host editing/guest RSVPs remain functional. For a broader integrity incident, the existing reviewed overall verified-write pause remains available. Do not delete appearance columns, overwrite customer records, reopen legacy raw grants, or claim that old incompatible frontends are a working rollback.

There has been **no automatic approval rejection** for this appearance package. The exact confirmation requirement is the browser tool's action-time rule covering newly expanded security-sensitive/public access: applying production permissions and creating the public photo bucket. One concrete scope covers existing staging and production, with production execution gated on hosted staging verification and customer-data preservation.
