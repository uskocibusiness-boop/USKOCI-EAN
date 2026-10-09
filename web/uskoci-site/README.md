# USKOČI promo / release web

Isolated static marketing + release/legal site. It does not import, build, or mutate the React Native app.

## Build

From repository root:

```bash
node web/uskoci-site/build.mjs
```

Output: `web/uskoci-site/dist`

## Vercel settings

- Project name: `uskoci-rs`
- Repository root: repository root
- Framework: Other / None
- Build command: `node web/uskoci-site/build.mjs`
- Output directory: `web/uskoci-site/dist`
- Production domain (after review): `uskoci.rs`

Do not assign the production domain until RELEASE_WEB_CHECKLIST.md is green.
