# PartyPlus original artwork refinement — November 1, 2026

User feedback: the updated website works well and looks better; restore the original colorful PartyPlus artwork and exact tagline **Party planning, made simple** within the current product design. This is a browser branding update only. Existing party, RSVP, item, account and sharing behavior remain the baseline. No database, Auth policy, customer record, mobile submission, new resource or paid service is part of this work.

## Source and implementation

The actual originals are `assets/partyplus-icon.png` (matching `invite-web/assets/partyplus-icon.png`) and `invite-web/assets/PartyPlusbanner.png`; the old `invite-web/index.html` supplies usage context. Both original images were visually inspected. The originals remain intact. The banner contains its original embedded “Plan. Share. Celebrate Together.” lettering; the requested new tagline is separate, readable HTML and document metadata.

The design retains the working invitation posters, ticket agenda, clear Hosting/Joined navigation and light functional panels. A deep navy masthead, authentic icon, invitation signature and original My Parties banner restore the owner's identity. Existing event palette and celebratory details support it without covering the artwork or competing with party details.

`scripts/prepare-web-brand.mjs` reproducibly resizes the supplied images proportionally with the existing Expo image utility. No crop, redraw, recolor, generated logo, external image service or new dependency. Source/output SHA-256 hashes, exact dimensions and encoding are recorded in `web/assets/brand/SOURCES.json`.

| Public asset | Dimensions | Bytes |
| --- | --- | ---: |
| Actual PP icon | 256 × 256 PNG | 110,818 |
| Browser icon | 48 × 48 PNG | 5,546 |
| Apple home-screen icon | 180 × 180 PNG | 57,069 |
| Full banner | 1440 × 697 JPEG | 289,320 |
| Phone banner | 768 × 372 JPEG | 117,886 |

Originals total 10,009,579 bytes. Public image derivatives total 580,639 bytes; responsive source selection avoids loading the large banner on phones. Strict deployment allowlists and image signatures validate all added public files. Fonts remain self-hosted; CSP remains same-origin for images.

## Checkpoint and release

Baseline source: `9072450f0179fb662cb9cd7ddd0df16da430ea47`.
Baseline published and locked compatible rollback: `6ae663c013623bb52b726f3d`.
Live URL: https://partyplusapp.com.

Implementation and bounded visual review are complete. TypeScript and targeted packaging-script ESLint pass. Source hashes prove the original icon/banner are unchanged, the native/web icons match, and all five public derivatives match their recorded hashes. Build includes the six brand files (five images plus provenance), with an exact file allowlist and PNG/JPEG signature validation.

Desktop was observed at 1413 CSS pixels. Phone was observed at 390 CSS pixels, with no horizontal overflow: My Parties scroll width 373, invitation and expanded creation-preview scroll width 390. All images loaded; the phone selected the smaller responsive banner. Form inputs remain 16px. Header navigation opened Create; live invitation preview reflected the typed party name and pending item/quantity. Guest invitation retained maps, directions, Share invite, Copy link, “Are you coming?”, RSVP and bring-list controls. Account, API, editor-draft and backend source files are unchanged. No fresh credential or production mutation was needed.

Parent bounded visual review of `brand-evidence-2026-11-01/desktop-my-parties.png` and `phone-creation.png` found no blocking issue. The phone screenshot shows the real icon and readable exact tagline on the invitation-preview rail. Some browser screenshot calls timed out; DOM geometry and the successful saved images are the scoped evidence, rather than a claim of additional physical-device testing. Temporary viewport override was reset. Screenshots capture synthetic local data, before the final minor optional-participation copy polish.

Publication remains pending. The final source/deploy/hash verification will be appended after the reviewed artifact is published.

Root dirty mobile files, the modernization worktree and the saved staging-resume screenshot are preserved. No customer party or response is needed for branding QA; synthetic local fixtures are used. External Pages destinations were unavailable in the prior connected search; exact current-status and operating-ledger entries will be saved in the repository.
