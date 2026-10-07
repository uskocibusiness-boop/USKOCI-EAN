# P00 OTA — first phone proof (2026-10-07)

Plan R2 phase P00 ("OTA baza i pouzdana isporuka"), steps P00.01 and the first half of P00.04. Evidence level: **PHYSICAL DEVICE** (owner's phone, screenshots seen in chat, not committed) for the install → update → restart path only.

## Build (P00.01)
- Repository `uskocibusiness-boop/USKOCI-EAN` (the old `Uskoci1/USKOCI-CLEAN` account is suspended).
- Run 37579151359 (source 00e563e4) and run 37582484465 (29f2c6ef) failed `Enforce compiled OTA Preview identity and signing` with `APK_SIGNING_FINGERPRINT_MISSING`. Cause found from the diagnostic: the runner's `build-tools/37.0.0/apksigner` verifies the APK but prints `V2 Signer: certificate SHA-256 digest:` instead of `Signer #1 certificate SHA-256 digest:`. Reproduced locally with build-tools 37.0.0; fixed in `scripts/ci/attest_ota_preview.py` (commits 29f2c6ef, 131d9f84); the gate still requires a fingerprint.
- **Run 37586092243, source 131d9f84: SUCCESS.** Receipt `APK_ATTESTED_NOT_PHONE_VERIFIED`: package `rs.uskoci.preview`, versionCode 35, runtime `uskoci-v1-preview-r1`, channel `preview`, ABI arm64-v8a, APK SHA-256 `6ed36228b975bcfdd66bc6250e4c3c47828dd39aa2d5ccba1951bd40e33da857`, signing certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` (**Android Debug certificate** — fine for preview testing, NOT the Play signing key; P00.07 open).

## Phone (P00.04, first half)
1. The owner installed the APK from the run artifact; it updated an existing `rs.uskoci.preview` install (same package and certificate, data kept). About screen: `USKOČI · 1.0.0 · 131d9f8 *`, runtime `uskoci-v1-preview-r1`, channel `preview`, embedded update id `118fc3d4`. The `*` means the CI working tree was not clean at build time (build-time patches); to be removed for a release build.
2. Source 85e19f48 changed the About line to name the launch kind (`ugrađena verzija · <id>` / `OTA ažuriranje · <id>`); tests 7/7, related 88/88, tsc clean.
3. **OTA update published** with `eas update --channel preview --environment preview --platform android` from the clean tree with the build's exact public env (Expo account `sljiva`, project `sljivas-team/uskoci`; the Expo `preview` environment holds no variables): update group `486e60e3-29c2-4929-8612-785acde9ba32`, Android update id `01a1156e-d3e8-7cb6-b016-ca2597056644`, branch `preview`, runtime `uskoci-v1-preview-r1`, commit 85e19f48.
4. After close → open → close → open on the phone the About screen showed `USKOČI · 1.0.0 · 85e19f4` (no `*`, "Izgrađeno iz čistog radnog stabla"), runtime `uskoci-v1-preview-r1`, channel `preview`, **`OTA sadržaj: OTA ažuriranje · 01a1156e`**.

## Not yet proven (rest of P00)
- Offline start, a failed/interrupted download and the return to the working version (P00.04 second half).
- An incompatible native base refusing an update; production channel separation exercised (P00.05).
- Play-installed AAB (P00.06) and the permanent package / signing key decision (P00.07, owner).
- Sign-in, core flows and backend behaviour on this build: not part of this proof.
