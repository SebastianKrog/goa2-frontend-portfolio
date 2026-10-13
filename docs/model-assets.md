# Model assets without repeated Git LFS downloads

Current and archived hero models are distributed in a private GitHub Release
attachment. `scripts/model-assets.json` pins the release, archive checksum and
each model's checksum. The deployed URLs and rendering remain unchanged.

`.lfsconfig` excludes all paths from normal LFS fetches, including checkout
smudging and `git lfs pull`. Existing LFS objects and Git history remain intact.
Do not override this setting in build configuration or use `git lfs fetch --all`.

## Cloudflare setup before merging

1. Create a fine-grained GitHub personal access token owned by PedroVIOliv,
   restricted to `goa2-frontend`, with **Contents: Read-only** permission. Give it
   an expiration date and renew it before expiry.
2. In the Worker's **Settings > Build**, add `MODEL_ASSET_TOKEN` as a **build
   secret**. This is needed during builds, not as a Worker runtime binding.
   Never put the token in source control or a `VITE_` variable.
3. Keep the build command `npm run build`. Its `prebuild` prepares the models.
4. Verify a fresh build's checkout does not download LFS objects. The preparation
   step should report downloading the Release bundle and preparing 66 models.
   Deployment still uploads the built static assets to Cloudflare.

Private release downloads require authentication. A missing/expired token fails
the build; there is deliberately no automatic fallback to Git LFS.

## Local development

Existing models with matching checksums need no download or token. `npm run dev`
and `npm run build` prepare missing models automatically. For a fresh checkout,
authenticate GitHub CLI and export a token into your shell:

```sh
export MODEL_ASSET_TOKEN="$(gh auth token)"
npm run models:prepare
unset MODEL_ASSET_TOKEN
```

The script refuses to overwrite modified model bytes. If you intentionally edit
a model, publish an updated bundle and manifest before using the normal build.
The asset converter can still operate on local model files before that step.

## Publish updated models

Choose a new unused tag, such as `models-v2`. Stage the changed models first so
their Git LFS pointers represent the intended bytes. Then:

```sh
npm run models:bundle -- models-v2 /tmp/goa2-models-v2
gh release create models-v2 /tmp/goa2-models-v2/goa2-models-v2.tar.gz \
  --target "$(git rev-parse HEAD)" --title "Hero models v2" \
  --notes "Versioned hero model bundle for frontend builds." --latest=false
cp /tmp/goa2-models-v2/model-assets.json scripts/model-assets.json
npm run models:prepare
npm run test:models
npm run build
```

Commit the updated manifest together with the model changes. Keep old release
attachments so older commits can still build. Never replace an attachment under
an existing tag: its pinned checksum would no longer match.

## Verification and recovery

- `npm run test:models` checks fresh pointer restoration, missing files, corrupted
  bundles, stale manifests, changed local files, and download failures.
- `npm run models:prepare` checks all expected local model hashes and downloads
  nothing if they match.
- For an explicit one-time LFS recovery, `git lfs pull --exclude=""` overrides
  the exclusion and **consumes LFS bandwidth** when objects are missing locally.
- Retain the $0 Git LFS budget. Historical checkouts or explicit exclusion
  overrides can still download from LFS; this change does not erase old history.

GitHub documents Release attachment bandwidth separately from Git LFS:
https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
