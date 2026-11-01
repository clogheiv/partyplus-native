# Appearance image controls — focused usability follow-up

User feedback: appearance choices are good, but adding/changing an image was hard to discover. Clicking the PP preview appeared to open Pinterest. Requested correction: visible **Choose a design** and **Upload your own image** at the top of Party appearance; **Change image** next to a clearly labeled invitation preview; exact save guidance; prominent Replace/Remove image and positioning/zoom for a personal image.

Baseline source `2863abfa0c96f5c9f9aeae09d892f261d4f75b5e`, published locked appearance deployment `6ae7c57a0ba7fdac70a1b031`. This follow-up changes browser controls and editor-only image markup. Appearance values, account/storage/API callbacks, original artwork, sharing, customer data and backend permissions remain the working baseline. Existing resources only; no mobile or paid integration.

## Actual Pinterest investigation

Independent read-only investigation found a browser-added Pinterest Save overlay after interacting with the live PP preview image. The outside-app `data-test-id="pinterest-save-button"` span was absent from the matching served PartyPlus bundle. Clicking that observed Save overlay introduced a `chrome-extension://.../index.html?mountId=...` iframe; PartyPlus remained on `/create`. No top-level Pinterest navigation or actual pin/save was submitted. This verifies browser-extension provenance for the reproduced overlay chain, not Michael's exact earlier click or the extension's installed name/version. Full evidence: `APPEARANCE_PINTEREST_INVESTIGATION_2026-11-01.md`.

Pinterest documents per-image `data-pin-nopin` and `nopin` attributes. The mitigation is scoped to editor/gallery/preview images; public invitations and explicit Share invite/Copy link retain their normal behavior. No global page prohibition, injected-extension CSS removal or browser setting change.

Sources: [Pinterest button documentation](https://developer.pinterest.com/docs/web-features/buttons/), [Pinterest single-image opt-out help](https://help.pinterest.com/en/business/article/prevent-saves-to-pinterest-from-your-site).

## Implementation checkpoint

The two exact top-level actions are visible without expanding anything. A personal image's Replace image, Remove image and existing position/zoom frame precede the design gallery. Choose a design focuses the always-visible gallery; only secondary layout/color/type/artwork options remain collapsible. A single file input serves both upload/replacement actions through the existing callback.

Exact explanation: “Choose a design or upload your own image. Adjust how it fits, then click Save changes.” The preview is separately labeled **Invitation preview**, has **Change image** beside it, and says “Preview only. Changes apply after you save.” Change image focuses Replace image for an attached photo and Upload your own image otherwise. Current appearance values and crop state were retained. No API/model/backend change.

Focused checks: TypeScript/build and component render checks pass. Desktop browser verified both top actions are outside collapsed details, Change image target/focus, removal of a synthetic local draft photo, and default PartyPlus selection. Replace image raised the real file chooser. A subsequent automation file transfer hung and was interrupted; it was not retried and no successful new transfer/upload is claimed. The upload callback/storage path is unchanged and its real staging acceptance is recorded in the preceding appearance release.

Phone observed at390CSS pixels, scroll width373, both top buttons50px high and available, preview label/save note correct; viewport reset. Desktop screenshot `image-controls-evidence-2026-11-01/desktop-controls.png` reviewed by parent with no blocker. The one phone screenshot attempt timed out; no screenshot retry or native fallback was attempted.

Editor-only original art, crop photos and preview brand images carry both documented per-image opt-out attributes. Public posters/thumbnails omit them (component render check), preserving ordinary invitation sharing. Clicking the marked original PP preview in the local browser left `/create` unchanged and produced no observed Pinterest overlay or extension frame. This is a bounded local observation, not proof of universal extension behavior or Michael's exact historical interaction.

Publication pending; final source/deploy/hash evidence and rollback will be appended after the reviewed artifact is released.
