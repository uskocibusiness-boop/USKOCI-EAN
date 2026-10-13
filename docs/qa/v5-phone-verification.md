# V5 preview APK — physical Android proof procedure

**Status:** NOT PHONE VERIFIED. A successful source build is not proof of a physical phone start.

## Build identity to verify before installation

- Canonical source: `work/ultra-master-integration-20261012`.
- APK workflow: `.github/workflows/build-latest-v5-preview-apk.yml`.
- Preview Android package: `rs.uskoci.preview` (not `rs.uskoci`).
- Runtime: `uskoci-v1-preview-r1` (compare with actual signed artifact receipt).
- Expo Updates channel: `preview`; production must not be contacted.
- Expected ARM ABI: `arm64-v8a`.
- `app.json` currently declares `versionCode=35`; the attested APK receipt is authoritative for the built version.

## 0. Before installing

1. Obtain an actual completed successful GitHub Actions artifact named `USKOCI-V5-PREVIEW-ARM64`. Confirm ZIP includes APK, SHA-256 file, receipt JSON.
2. Compare archive file hash with `.sha256`, and compare receipt SHA, ABI, package, channel and runtime against the GitHub run SHA.
3. Verify whether the **installed** `rs.uskoci.preview` APK and the **new** APK share the same signing certificate. Fresh CI runner keys may differ from a prior EAS/CI build. Never promise a seamless in-place upgrade until fingerprints match.
4. Do **not** uninstall or clear app data merely to force installation. An `INSTALL_FAILED_UPDATE_INCOMPATIBLE` result is a signature mismatch requiring an explicit migration/backup decision.

## 1. Device / old version

```sh
adb devices
adb shell pm path rs.uskoci.preview
adb shell dumpsys package rs.uskoci.preview
```

Record installed versionCode, lastUpdateTime, package name and signing fingerprint where possible. Check that the device ABI includes arm64-v8a. Save non-sensitive lines only, never tokens or private addresses.

## 2. Installation (only once signature compatibility is established)

```sh
adb install -r USKOCI-V5-PREVIEW-ARM64.apk
adb shell am force-stop rs.uskoci.preview
adb shell monkey -p rs.uskoci.preview 1
```

Do not claim the install worked without the actual `adb install` success and Android launch evidence.

## 3. Cold-start matrix

1. Start from force-stop with internet. Confirm splash resolves to normal auth/home.
2. Repeat the cold start at least three times; no circular redirect/spinner or repeat reload.
3. Navigate through all root tabs: Početna / Zadaci / Dogovori / Poruke, and open/return from a task.
4. Test app resume, Wi-Fi/mobile data switches and offline startup state.
5. Confirm account session, preview OTA runtime/channel and currently active update identifier in a safe diagnostic (do not print auth tokens).
6. Capture relevant `adb logcat` AndroidRuntime, ReactNativeJS and Expo Updates errors for any crash. Distinguish native crash, JavaScript exception, auth redirect loop and OTA reload.

## 4. End-to-end after successful cold start

Two real test accounts: owner task AI draft / location / review / publish; worker confirmed work type / activation / relevant push / application; selection / agreement / messages / completion / review. Record actor, test run, backend DEV project and whether PHONE, emulator or automated-only.

## Current proof boundaries

The 2026-10-12 diagnostic workflow [38320149549](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38320149549) passed 133 startup-focused tests and Android JS bundling; **this does not verify a physical phone**.
Emergency preview OTA restore [38319991763](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38319991763) stopped because EXPO_TOKEN was not configured; nothing was published.

**Do not mark** INSTALLED, START CONFIRMED or END-TO-END VERIFIED without observed device results.
