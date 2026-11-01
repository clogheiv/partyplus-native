# Preview Pinterest investigation — November 1, 2026

At 23:38 UTC, the reported behavior was reproduced as a browser-added Pinterest Save overlay on the ordinary public blank PartyPlus editor. Clicking the PartyPlus image itself retained `/create`. Clicking the separately injected Save control opened a browser-extension iframe. This is direct observed extension behavior, rather than an inference from the absence of an application link.

## Bounded reproduction

The investigation used its own Edge tab at `https://partyplusapp.com/create`, without opening any customer party, entering content, uploading anything, saving a party, changing account/browser settings, or submitting a Pin. The pre-existing signed-in browser session was left intact.

1. Before image interaction, the page contained only the first-party `https://partyplusapp.com/app.js` script, no external anchors, and no element attributes matching Pinterest, pinimg or pinit. The preview was a plain `section[aria-label="Invitation preview"]`; the PP banner was an ordinary `img.ap-original-banner` without a link or image click handler in the component source.
2. Clicking `.ap-poster-preview .ap-original-banner` kept the tab at `/create` and created no new tab. The accessibility tree then added the text `Save`.
3. Read-only DOM inspection identified the new control:

   ```html
   <body>
     <div id="root">…PartyPlus application…</div>
     <span data-test-id="pinterest-save-button" style="…position:absolute!important;…z-index:9007199254740990!important;…">Save</span>
   </body>
   ```

   Its inline background contained the Pinterest logo. Its parent was `BODY`, and `closest('#root')` was false. It was placed over the image independently of React's preview tree.
4. Clicking that exact `[data-test-id="pinterest-save-button"]` control injected an iframe whose visible DOM `src` was:

   ```text
   chrome-extension://85912f9d-ba0b-43de-a73a-ffe15217f936/index.html?mountId=…
   ```

   The mount identifier is omitted because it is incidental to that instance. The PartyPlus tab remained `/create`; no new top-level tab appeared. No final Save/Pin action was taken. No extension code, profile files, credentials, history or unrelated settings were inspected.

The exact installed extension product/version and any later Pinterest destination were not established. The observed control and extension iframe establish the immediate cause of the reproduced interaction. This does not establish how every possible browser or the user's exact click behaves.

## Released-asset evidence

The checked source was commit `2863abfa0c96f5c9f9aeae09d892f261d4f75b5e`, corresponding to release `6ae7c57a0ba7fdac70a1b031`. Public HTTP responses returned 200:

| Asset | SHA256 | Bytes | Pinterest/pinimg/pinit matches |
| --- | --- | ---: | ---: |
| `https://partyplusapp.com/` | `c20c1ac52c1aaa3b0d3cf68737697ec0d7b3c70c25de7c4d6c0f9c8750f68f36` | 778 | 0 |
| `https://partyplusapp.com/app.js` | `4e2f25f26dc7c4cc3ca6b137a443b5e0073b11d0ac42f44551d2b16c1305ff53` | 454130 | 0 |
| `https://partyplusapp.com/app.css` | `003977a464f98770c5b254b6e76ec0028467e8e34488f24a95097ba4cc426cb3` | 80199 | 0 |
| `https://6ae7c57a0ba7fdac70a1b031--partyplus-invite.netlify.app/app.js` | `4e2f25f26dc7c4cc3ca6b137a443b5e0073b11d0ac42f44551d2b16c1305ff53` | 454130 | 0 |

The live and immutable release bundles match. The current source search across `web/src`, `web/index.html` and `web/_headers` likewise found no Pinterest integration. `PartyAppearance.tsx` renders artwork/photos as images and design choices as form controls. `App.tsx`'s See invitation preview action opens and scrolls to the inline preview. No preview navigation to Pinterest is present in that source. These source/asset findings support, but do not replace, the observed overlay/extension evidence above.

The shipped CSP allows first-party scripts; it is not a guarantee that an installed browser extension cannot add page controls. No CSP or browser protections were changed.

## Supported mitigation sent to the frontend lead

Pinterest's [official developer documentation](https://developer.pinterest.com/docs/web-features/buttons/) documents per-image `data-pin-nopin` to opt an image out of saving and hover controls. It separately documents `data-pin-no-hover` for hiding hover controls while retaining saving. Pinterest's [official business help](https://help.pinterest.com/en/business/article/prevent-saves-to-pinterest-from-your-site) documents an image-level `nopin="nopin"` attribute and a page-level `<meta name="pinterest" content="nopin">` option.

The narrow recommendation is to mark preview/editor artwork and photo images with the documented per-image opt-out attributes, alongside the lead's explicit design/upload/change-image controls. Verify the resulting artifact in the same browser that demonstrated the overlay. A page-level opt-out is broader and should be intentional. Do not add Pinterest's widget script, disable/change the user's extension, intercept arbitrary browser controls, or promise that opt-out markup is an access-control or screenshot/copy protection mechanism. Ordinary PartyPlus Share invite and Copy link should continue to work.

One screenshot capture timed out in the documented browser API. No native screenshot fallback or repeated screenshot attempt was used; the evidence above is from accessibility state and read-only live DOM. This investigation changed only this note. Frontend implementation and release remain with the lead.
