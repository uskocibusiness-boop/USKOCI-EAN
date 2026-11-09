# Android toolchain audit — 2026-11-09

Scope: read-only classification of the active source commit
`2d8ada07cc4e10616cc9c15619b9d87319cd0479`. No dependency, runtime or build
configuration changes were made for this inspection.

## Current audit result

The captured `npm audit --omit=dev --json` result reports **19 affected package
entries: 0 critical, 6 high, 12 moderate and 1 low**. These are npm audit package
counts, not nineteen independently demonstrated mobile exploits. The six high
entries are `@expo/cli`, `brace-expansion`, `compression`, `node-forge`,
`source-map-js` and `zod`.

Local raw evidence: `../verification/active-production-audit-20261109.json`,
relative to the repository. SHA-256:
`be21d93122dbc1a48bc261bb3dd9cc5083b438e38351c0e10744eae06acb23af`.
Do not substitute counts from the repository default branch for this checkout.

`--omit=dev` does not mean that every retained package executes in the mobile
application. Expo and its installed production dependency tree also contain
Node build, configuration and development-server tools.

## Confirmed dependency paths

The inspection covered installed package parents and JS/CJS/MJS importers,
including nested `node_modules`. Application source and Edge functions have no
direct imports of the five libraries below.

| Installed package | Confirmed path and relevant input |
| --- | --- |
| `node-forge@1.4.0` | `expo-updates → @expo/code-signing-certificates`, imported by `expo-updates/cli/build/configureCodeSigningAsync.js:7` and `generateCodeSigningAsync.js:7`; processes PEM certificate/key files in CLI operations. Expo CLI also uses certificate tooling. Android Updates verification uses Java security APIs, including `CodeSigningConfiguration.kt:93`, rather than this Forge CLI path. |
| `compression@1.8.1` | Parent: Expo CLI. `expo/node_modules/@expo/cli/build/src/start/server/metro/dev-server/compression.js:11–24` handles HTTP responses for Metro `.bundle` and `.map` requests. Exposure depends on access to the development server; this is not the embedded release-bundle execution path. |
| `source-map-js@1.2.1` | `@expo/metro-config → postcss → source-map-js`. Imports in `postcss/lib/previous-map.js:5`, `input.js:5` and `map-generator.js:4` process source maps during transformations. They are not application geographic-map handlers. |
| `zod@3.25.76` | Parent: Expo CLI. Imports in `expo/node_modules/@expo/cli/build/src/start/server/DevToolsPlugin.schema.js:20` and `createMCPDevToolsExtensionSchema.js:12` validate DevTools/plugin/MCP structures. No path from mobile user input to these schemas was established. |
| `brace-expansion@5.0.9`, `1.1.18` | `minimatch → glob`, used by fingerprint/configuration/Metro tooling; the older copy also appears through `test-exclude → babel-plugin-istanbul`, with additional Jest copies in the full install. Relevant inputs are glob/coverage patterns. `expo-updates/utils/build/vcs.js:92` uses `glob` separately from the runtime `expo-updates/build/index.js` entry. |

All listed installed paths are relative to the repository's `node_modules/`.
The high-severity `@expo/cli` audit entry is also part of this Node toolchain;
its presence is not evidence that the CLI itself runs on Android.

## Artifact evidence and limits

- `package-lock.json` has the same Git blob at QA94 source
  `cf802823dc85d9ff53fa3440ea2724a58c6a4bbf` and the inspected commit:
  `ef106054070e98d5519d0325322419d4e37b7e5e`. The intervening `package.json`
  change concerns a test command, not dependency declarations.
- The earlier QA94 APK contains a Hermes v98 bundle of 14,041,716 bytes,
  SHA-256 `5c93ca200077077584cefd669b6af9f7aa04b180d2cb43997f12a1593b013bd9`.
  Its embedded source is `cf802823…`, with OTA disabled. Selected characteristic
  library strings were absent; that is supplementary evidence only.
- QA94 has no packaged source map. String absence does not establish complete
  module attribution or prove that a vulnerability is unreachable. This note
  does not claim that the new phone-preview APK was inspected for module
  reachability, nor does an unchanged lockfile make two bundles equivalent.
- No exploit reproduction, complete advisory-by-advisory analysis, hostile
  build-input exercise or Metro network-exposure audit was performed.

Conclusion: the inspected libraries have confirmed Node/build/dev-server paths,
and this investigation did not establish an Android runtime path. The npm audit
is **not clean**; its findings remain relevant to the toolchain. Neither six
confirmed high-risk mobile flaws nor blanket non-exploitability is supported by
this evidence.
