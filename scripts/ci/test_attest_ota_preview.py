"""Offline positive/negative boundary tests for the compiled APK manifest reader."""
import unittest
from attest_ota_preview import RUNTIME, URL, validate_manifest

MANIFEST = '''<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="rs.uskoci.preview" android:versionName="1.0.0" android:versionCode="35"><application android:debuggable="false">
<meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
<meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>
<meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="URL_PLACEHOLDER"/>
<meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;preview&quot;}"/>
<meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
<meta-data android:name="expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="0"/>
</application></manifest>'''.replace("URL_PLACEHOLDER", URL)


class PreviewBoundary(unittest.TestCase):
    def test_valid_preview(self):
        receipt = validate_manifest(MANIFEST, lambda _: RUNTIME)
        self.assertEqual(receipt["androidPackage"], "rs.uskoci.preview")
        self.assertEqual(receipt["versionCode"], 35)
        self.assertEqual(receipt["runtimeVersion"], RUNTIME)
        self.assertEqual(receipt["channel"], "preview")

    def test_apkanalyzer_raw_json_attribute_is_tolerated(self):
        raw = MANIFEST.replace('&quot;expo-channel-name&quot;:&quot;preview&quot;', '"expo-channel-name":"preview"')
        receipt = validate_manifest(raw, lambda _: RUNTIME)
        self.assertEqual(receipt["channel"], "preview")

    def test_quoted_runtime(self):
        self.assertEqual(validate_manifest(MANIFEST, lambda _: '"' + RUNTIME + '"')["runtimeVersion"], RUNTIME)

    def test_literal_runtime(self):
        self.assertEqual(validate_manifest(MANIFEST.replace("@string/expo_runtime_version", RUNTIME), lambda _: "unused")["runtimeVersion"], RUNTIME)

    def test_numeric_runtime_ref_resolves_canonical_resource(self):
        seen = []
        receipt = validate_manifest(MANIFEST.replace("@string/expo_runtime_version", "@ref/0x7f1300b9"), lambda name: (seen.append(name), RUNTIME)[1])
        self.assertEqual(receipt["runtimeVersion"], RUNTIME)
        self.assertEqual(seen, ["expo_runtime_version"])

    def test_numeric_runtime_ref_still_rejects_wrong_resource_value(self):
        with self.assertRaisesRegex(ValueError, "APK_RUNTIME_MISMATCH"):
            validate_manifest(MANIFEST.replace("@string/expo_runtime_version", "@ref/0x7f1300b9"), lambda _: "uskoci-v1-preview-r2")

    def test_production_package_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_NOT_PREVIEW_PACKAGE"):
            validate_manifest(MANIFEST.replace('package="rs.uskoci.preview"', 'package="rs.uskoci"'), lambda _: RUNTIME)

    def test_legacy_dev_package_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_NOT_PREVIEW_PACKAGE"):
            validate_manifest(MANIFEST.replace('package="rs.uskoci.preview"', 'package="rs.uskoci.dev"'), lambda _: RUNTIME)

    def test_production_runtime_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_RUNTIME_MISMATCH"):
            validate_manifest(MANIFEST, lambda _: "uskoci-v1-production-r1")

    def test_incompatible_preview_runtime_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_RUNTIME_MISMATCH"):
            validate_manifest(MANIFEST, lambda _: "uskoci-v1-preview-r2")

    def test_production_channel_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_CHANNEL_MISMATCH"):
            validate_manifest(MANIFEST.replace('&quot;preview&quot;', '&quot;production&quot;'), lambda _: RUNTIME)

    def test_updates_disabled_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_UPDATES_DISABLED"):
            validate_manifest(MANIFEST.replace('ENABLED" android:value="true"', 'ENABLED" android:value="false"'), lambda _: RUNTIME)

    def test_wrong_project_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_UPDATE_URL_MISMATCH"):
            validate_manifest(MANIFEST.replace(URL, "https://u.expo.dev/wrong"), lambda _: RUNTIME)

    def test_debug_build_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_DEBUGGABLE"):
            validate_manifest(MANIFEST.replace('debuggable="false"', 'debuggable="true"'), lambda _: RUNTIME)

    def test_disabled_auto_check_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_NOT_ON_LOAD"):
            validate_manifest(MANIFEST.replace('value="ALWAYS"', 'value="NEVER"'), lambda _: RUNTIME)

    def test_nonzero_fallback_rejected(self):
        with self.assertRaisesRegex(ValueError, "APK_FALLBACK_NOT_ZERO"):
            validate_manifest(MANIFEST.replace('value="0"', 'value="30000"'), lambda _: RUNTIME)

    def test_antibricking_disabled_rejected(self):
        xml = MANIFEST.replace('</application>', '<meta-data android:name="expo.modules.updates.DISABLE_ANTI_BRICKING_MEASURES" android:value="true"/></application>')
        with self.assertRaisesRegex(ValueError, "APK_ANTI_BRICKING_DISABLED"):
            validate_manifest(xml, lambda _: RUNTIME)


class SigningTool(unittest.TestCase):
    """The signing fingerprint comes from the SDK's newest build-tools apksigner, read from stdout and stderr."""

    def test_newest_build_tools_by_number_not_by_string(self):
        import os, tempfile
        from pathlib import Path
        import attest_ota_preview as a
        with tempfile.TemporaryDirectory() as sdk:
            for version in ("9.0.0", "34.0.0", "36.0.0"):
                tool = Path(sdk, "build-tools", version, "apksigner")
                tool.parent.mkdir(parents=True)
                tool.write_text("")
            old = os.environ.get("ANDROID_HOME")
            os.environ["ANDROID_HOME"] = sdk
            try:
                self.assertEqual(Path(a.sdk_tool("apksigner")).parent.name, "36.0.0")
            finally:
                if old is None:
                    os.environ.pop("ANDROID_HOME", None)
                else:
                    os.environ["ANDROID_HOME"] = old

    def test_fingerprint_read_from_stderr_and_missing_one_refused(self):
        import subprocess
        from pathlib import Path
        from unittest import mock
        import attest_ota_preview as a
        digest = "ab" * 32
        on_stderr = subprocess.CompletedProcess([], 0, stdout="Verifies\n", stderr=f"Signer #1 certificate SHA-256 digest: {digest}\n")
        with mock.patch.object(a, "sdk_tool", return_value="apksigner"), mock.patch.object(a.subprocess, "run", return_value=on_stderr):
            self.assertEqual(a.apk_signing_fingerprints(Path("x.apk")), [digest])
        # build-tools 37 format (seen on the GitHub runner 2026-10-07): one line per scheme; the public-key digest must not count.
        v37 = subprocess.CompletedProcess([], 0, stdout=(f"Verifies\nV2 Signer: certificate SHA-256 digest: {digest}\n"
                                                        f"V3 Signer: certificate SHA-256 digest: {digest}\n"
                                                        f"V2 Signer: public key SHA-256 digest: {'cd' * 32}\n"), stderr="")
        with mock.patch.object(a, "sdk_tool", return_value="apksigner"), mock.patch.object(a.subprocess, "run", return_value=v37):
            self.assertEqual(a.apk_signing_fingerprints(Path("x.apk")), [digest])
        nothing = subprocess.CompletedProcess([], 0, stdout="Verifies\n", stderr="")
        with mock.patch.object(a, "sdk_tool", return_value="apksigner"), mock.patch.object(a.subprocess, "run", return_value=nothing):
            with self.assertRaisesRegex(ValueError, "APK_SIGNING_FINGERPRINT_MISSING"):
                a.apk_signing_fingerprints(Path("x.apk"))
        refused = subprocess.CompletedProcess([], 1, stdout="DOES NOT VERIFY\n", stderr="")
        with mock.patch.object(a, "sdk_tool", return_value="apksigner"), mock.patch.object(a.subprocess, "run", return_value=refused):
            with self.assertRaisesRegex(ValueError, "APK_SIGNATURE_DOES_NOT_VERIFY"):
                a.apk_signing_fingerprints(Path("x.apk"))


if __name__ == "__main__":
    unittest.main()
