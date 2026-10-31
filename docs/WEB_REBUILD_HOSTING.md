# PartyPlus browser hosting

**Current follow-up release:** locked deploy `6ae663c013623bb52b726f3d`, source `182c67d`, published October 31 at 21:56:30 UTC. The preceding compatible password/item-fix deployment `6ae6607931398212cdfba8df` is the direct frontend rollback. The source helper now validates twelve explicit assets, including self-hosted fonts and their licenses. The original six-asset release/preview records below are historical.

## Released production state

On October 31 at 20:37:34 UTC the verified production artifact `6ae65016a97425eaaa716db8` was published to https://partyplusapp.com and locked using Netlify's supported deploy-lock API. This publishes the ready atomic deploy and prevents old `backup/share-working` Git builds from replacing it. Browser inputs match `e7e748efe8ba43c8fd94b4e72946f72fa6ee13a4`; public root/routes and served asset hashes passed after publication. The previous deploy `6a94a5c77c86e100080fe9fc` is retained, but its raw-table invitation reader is incompatible with the secure database contract.

For a future release, build and verify a new compatible draft, then intentionally publish and lock that exact ready deploy. Keep auto publishing locked until the repository's continuous-deployment branch/publish settings have been deliberately migrated to `web-dist`. Unlocking now would allow the old native/invitation branch to overwrite the new product. Netlify's Deploys page provides the reversible unlock control; the [official lockDeploy API](https://open-api.netlify.com/) also documents supported locking. Do not change DNS or create another site.

Operational rollback is the reviewed database write pause plus retaining a compatible frontend; accepted responses and receipts stay intact. Restoring the older raw reader is maintenance-only, not a functioning invitation rollback, and must never be paired with reopening unsafe table grants. Current publication and artifact evidence are in `docs/web-evidence-2026-10-31/production-*.json`. The original preview preparation instructions below remain useful for building future drafts.

The browser rebuild uses the existing Netlify resources. Staging previews are draft deployments; they do not replace the published staging site. The production site, custom domain, published deployment, and backend are not changed by this staging preview workflow.

| Environment | Existing site | Site ID | Backend |
| --- | --- | --- | --- |
| Staging | famous-fairy-b9cb63.netlify.app | ef1de4c4-a3eb-4c64-939f-71392a2d24be | qmbwrbxbbshbavfhkujx.supabase.co |
| Production | partyplus-invite / partyplusapp.com | f7af2b09-2f8a-44d7-bf17-b8993eb17492 | typbofemqhjoiwbkdvuc.supabase.co |

## Prepare a preview

Use Node.js and installed repository dependencies. The existing Netlify CLI login is read in process from the current user's Netlify config. Never copy the access token into a command, document, environment file, or browser build.

The public backend config JSON must contain only `url` and `publishableKey`. The build passes these values through the child process environment. A public browser key is expected in the JavaScript bundle; privileged Supabase keys and Netlify credentials must never be included.

```powershell
npm run check:web
node scripts/deploy-web-netlify.mjs --environment staging --site-id ef1de4c4-a3eb-4c64-939f-71392a2d24be --config-file C:/Users/clogh/partyplus-native/.worktrees/modernization-phase-1/.test-cache/staging-credentials.json --build --draft
```

The command above rebuilds `web-dist`, validates it, and makes read-only Netlify checks. It does not create a deploy. Rebuilding changes the files served by the local preview server, so coordinate with anyone using that preview first.

The helper checks the exact existing site ID/name, environment-specific backend, public key role, artifact filenames and sizes, and common secret patterns. It requires all six browser assets and scans legacy JWTs for privileged roles. It reads the account plan and included credit/build capability counters where the API exposes them, and stops if exposed included credits are exhausted. These counters describe the API response at execution time; they are not a future billing guarantee. It does not create resources, change plans, enable services, start cloud builds, or buy anything.

## Deploy the reviewed artifact

```powershell
node scripts/deploy-web-netlify.mjs --environment staging --site-id ef1de4c4-a3eb-4c64-939f-71392a2d24be --config-file C:/Users/clogh/partyplus-native/.worktrees/modernization-phase-1/.test-cache/staging-credentials.json --draft --execute
```

The helper records the currently published deploy, uploads a SHA-1 file digest with `draft: true`, uploads only requested public asset hashes, and polls until ready. It prints the unique HTTPS preview URL and records artifact SHA-256 hashes, safe account capability metadata, the deploy ID, and the previous published deploy under ignored `.test-cache/web-deploy/`. It never writes the login token or public config key to the evidence record. It confirms that the staging and production published deploy IDs remain unchanged.

If a request times out after a deploy was created, use its recorded ID to inspect that deploy before starting another. The record is written immediately after deploy creation. A draft preview may still finish processing after the local script has timed out.

Test the unique draft URL for fresh-browser invitations, host email verification, guest RSVP and item claims, Joined return access, preserved drafts, retry handling, layout, and links. Guest and host identity should be tested in separate browser profiles. Never use production data as staging test fixtures.

## Publication and rollback

This helper cannot publish or restore deployments. Any later production draft additionally requires the production site ID, production public backend config, and `--allow-production-draft`; that flag still creates only a draft. Production publication requires a separate authorized release decision after reviewing the concrete build, live staging results, backend compatibility, support, and rollback record.

Before a later publication, record the site's current published deploy ID and permalink. In Netlify, open the existing site's Deploys page and select the reviewed ready deploy; use the site's publish control only for the intended environment. Do not create a new site or change DNS. Keep the previous deploy available.

To roll back a later published frontend, open that same existing site's Deploys page, select the recorded previous ready deploy, and use Netlify's publish control to restore it. Then verify the custom-domain root, an original invitation, and backend compatibility. Frontend rollback does not undo backend migrations or user responses. This staging draft needs no rollback because it leaves the existing publication in place.

## API references

The workflow follows Netlify's [file digest API and draft deploy behavior](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/) and [official API reference](https://open-api.netlify.com/). The existing account's metadata is inspected with read-only API requests; no billing endpoints are mutated.

## Preview evidence

On 2026-10-31, the reviewed six-file browser artifact (456,649 bytes) was deployed to the existing staging resource as a draft:

- Preview: [PartyPlus staging browser rebuild](https://6ae649426f3f0121a47997e1--famous-fairy-b9cb63.netlify.app)
- Draft deployment ID: `6ae649426f3f0121a47997e1` (`ready`).
- Preserved staging published deployment: `6ac9aceb68f1fd317b369189` ([previous published permalink](https://6ac9aceb68f1fd317b369189--famous-fairy-b9cb63.netlify.app)).
- Preserved production published deployment: `6a94a5c77c86e100080fe9fc`. The production site and publication were not changed.
- Existing account API reported the Pro plan, 3,000 included credits / 0 used, and 3 included concurrent builds / 0 used before this draft. No account, plan, domain, backend, or paid service was created or changed.
- Safe machine-readable metadata and local artifact hashes: `.test-cache/web-deploy/staging-1793476930802.json` (ignored local evidence).

Unauthenticated HTTPS checks passed for `/`, `/create`, `/account`, an `/i/:id` deep link, legacy `/share?id=`, `/privacy`, `/support`, and `/terms`. All returned the browser app document. The downloaded HTML, JavaScript, CSS, and favicon SHA-256 hashes matched the reviewed artifact, and the root response included the configured Content Security Policy. This verifies upload and routing; the live host/guest behavior is verified separately against staging.

A second draft was deliberately created for an independent browser origin during guest/host account testing, using the latest address-aware App/API bundle:

- Preview: [PartyPlus staging browser rebuild — second test origin](https://6ae649cd40e8400ac37aa9b2--famous-fairy-b9cb63.netlify.app).
- Deploy ID: `6ae649cd40e8400ac37aa9b2` (`ready`); six public assets, 456,752 bytes.
- Evidence: `.test-cache/web-deploy/staging-1793477069612.json`.
- HTML, JavaScript, CSS, and favicon downloaded hashes matched the local artifact. Both existing staging and production published deploy IDs remained unchanged.

A final third draft preserves the first origin's verified host session and the second origin's anonymous guest contributions while testing the same host account in a separate origin. It reused the second draft's reviewed artifact without rebuilding:

- Preview: [PartyPlus staging browser rebuild — cross-device test origin](https://6ae64afaaa5fee650a934c14--famous-fairy-b9cb63.netlify.app).
- Deploy ID: `6ae64afaaa5fee650a934c14` (`ready`); same six assets and 456,752-byte artifact.
- Evidence: `.test-cache/web-deploy/staging-1793477370742.json`.
- Existing staging and production publication IDs were verified unchanged. No additional duplicate preview deployments are planned for this test pass.
