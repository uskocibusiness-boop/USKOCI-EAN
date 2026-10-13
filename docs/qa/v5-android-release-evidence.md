# USKOČI V5 — Android preview release proof (2026-10-13)

## Final artifact: GitHub Actions SUCCESS

- Successful workflow: [38379075267](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38379075267)
- Artifact: [USKOCI-V5-PREVIEW-ARM64](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38379075267/artifacts/11803816306), ID `11803816306`.
- Artifact contains: `USKOCI-V5-PREVIEW-ARM64.apk`, `.apk.sha256`, `USKOCI-V5-PREVIEW-ARM64-receipt.json`; archive 64,917,020 bytes compressed.
- APK binary size: **99,760,832 bytes**.
- APK SHA-256: `5be15551db287a76183803164516adbcc9ee2aafac1eecef57b42ec22db99ac2`.
- Archive ZIP SHA-256: `45c40c8a65ba6a1eb7f597a74ee71b44e43a81727d1edbfa153ccfd66ea76cb1` (not the APK hash).
- Artifact retention: until **2026-10-27 10:12:31 UTC**.
- Checkout SHA: `484957d72fb5b004b32b591a3ad1ede70bfed5b9` on `work/ultra-master-integration-20261012`.
- Source tree: `a2f77e4b452865a47d2a30922d2a0b292564edd5`.

## CI and native gates

- `npm ci --include=dev`: success.
- Preview identity guard with feature flags enabled: success.
- `npx tsc --noEmit`: success.
- `npm test -- --runInBand`: **618/618 suites and 13,773/13,773 tests passed; 6/6 snapshots**.
- `npx expo prebuild --platform android --clean`: success.
- ARM64-only native configuration: success.
- `./gradlew assembleRelease --no-daemon --max-workers=2 -x lintVitalAnalyzeRelease`: **BUILD SUCCESSFUL in 13m 34s, 940 actionable tasks executed**.
- Signed APK inspection and receipt: success.
- Artifact upload: success.

## Attested Android identity (from compiled APK, not merely app.json)

| Field | Proven value |
|---|---|
| androidPackage | `rs.uskoci.preview` |
| version / versionCode | `1.0.0` / `35` |
| runtimeVersion | `uskoci-v1-preview-r1` |
| Expo Updates channel | `preview` |
| Expo Updates URL | `https://u.expo.dev/1e6cc490-9851-4741-9226-128612122db6` |
| Updates on launch | `ALWAYS` |
| fallbackToCacheTimeout | `0` |
| ABI | `arm64-v8a` |
| debuggable | `false` |
| Signature certificate SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |

Build flags enabled in actual APK: `P6_DISCOVERY_READER`, `EX04_OWN_TASKS_PAGED`, `EX04_OWN_APPLICATIONS_PAGED`, `EX04_CANDIDATES_PAGED`, `VOICE_MESSAGES`, `AI_LOCATION_DIALOGUE`, `CONVERSATION_INBOX`. Production was not built or deployed.

## Forensic regression history

- Failed initial run [38344383850](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38344383850): 17 failed suites, 164 failed tests caused predominantly by leaking preview feature flags/OTA profile into default-off Jest mocks, plus one separate stale EX06 contract-source test.
- Fix commit `e51736b`: isolate test flags and preview/production fixture environment.
- Verification run [38378825726](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38378825726): reduced failures to **one EX06** (617 suites / 13,772 tests passing).
- Fix commit `82ea22c`: correct EX06 source extraction, preserve optional end time.
- Safety commit `484957d`: assert preview feature gates remain enabled for native APK.
- [17-suite failure matrix](../forensics/2026-10-13-v5-apk-failure.md).

## Unverified, intentionally not claimed

- **Physical Android device installation:** NOT TESTED.
- **Physical cold start / auth / repeat launch:** NOT TESTED.
- **Live OTA update receipt and rollback:** NOT VERIFIED.
- **End-to-end with two accounts/push/matching:** NOT VERIFIED.
- **In-place upgrade of existing `versionCode=35` APK:** UNKNOWN. The new certificate fingerprint must be compared with installed package; avoid uninstall/clear-data without backup/approval.

Phone checklist: [v5-phone-verification.md](v5-phone-verification.md). GitHub build SUCCESS is not a PHONE VERIFIED claim.
