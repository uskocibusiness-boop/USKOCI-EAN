"""Offline parser/negative tests; these synthetic fixtures are not APK evidence."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("qa58_verifier", HERE / "qa58-artifact-verifier.py")
VERIFIER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFIER)


def hermes_dump(strings):
    """The actual ASCII dump shape, with declared lengths and consecutive IDs."""
    rows = []
    offset = 0
    for index, text in enumerate(strings):
        raw = text.encode("ascii")
        rows.append(f"s{index}[ASCII, {offset}..{offset + len(raw) - 1}]: ".encode() + raw)
        offset += len(raw)
    return (f"  Bytecode version number: 96\n  String count: {len(strings)}\nGlobal String Table:\n".encode()
            + b"\n".join(rows) + b"\n\nLiteral Value Buffer:\n")


class VerifierTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="qa58-verifier-test-")
        self.directory = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)

    def checks_archive(self, *, prefix="ℹ", tests=963, extra_summary="", migration=None, typescript=b""):
        values = {"tests": tests, "pass": tests, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0}
        report = "\n".join(f"{prefix} {key} {value}" for key, value in values.items()) + "\n" + extra_summary
        if migration is None:
            migration = "PASS migration_integrity files=221 participant_contract=PASS\n.......................................\nRan 39 tests in 0.042s\n\nOK\n"
        path = self.directory / "checks.zip"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("tests.tap", report)
            archive.writestr("typescript.txt", typescript)
            archive.writestr("migration-integrity.txt", migration)
        metadata = {"id": 1, "name": "synthetic-checks", "digest": "sha256:" + VERIFIER.file_hash(path),
                    "size_in_bytes": path.stat().st_size}
        return path, metadata

    def check(self, **kwargs):
        path, metadata = self.checks_archive(**kwargs)
        return VERIFIER.checks_proof(path, metadata, 963, 221, 39)

    def rejected(self, code, call):
        with self.assertRaisesRegex(VERIFIER.Rejected, "^" + code + "$"):
            call()

    def strings(self):
        return ["https://" + VERIFIER.PROJECT + ".supabase.co", VERIFIER.JOURNAL,
                '{"sourceCommit":"' + VERIFIER.HEAD + '"}']

    def scan(self, strings):
        return VERIFIER.scan_strings(hermes_dump(strings), "present", VERIFIER.HEAD, VERIFIER.PROJECT)

    def test_node24_spec_and_node22_tap_formats(self):
        for prefix in ("ℹ", "#"):
            with self.subTest(prefix=prefix):
                proof = self.check(prefix=prefix)
                self.assertEqual(proof["tests"]["pass"], 963)
                self.assertEqual(proof["migrationIntegrity"]["physicalFiles"], 221)
                self.assertEqual(proof["migrationIntegrity"]["pythonTests"], {"tests": 39, "status": "OK"})

    def test_duplicate_summary_rejected_instead_of_selecting_last_success(self):
        self.rejected("TEST_SUMMARY_MISSING_OR_DUPLICATE", lambda: self.check(extra_summary="ℹ tests 963\n"))

    def test_wrong_test_total_rejected(self):
        self.rejected("TAP_TOTAL_MISMATCH", lambda: self.check(tests=962))

    def test_typescript_diagnostics_rejected(self):
        self.rejected("TYPESCRIPT_DIAGNOSTICS_PRESENT", lambda: self.check(typescript=b"error TS2322\n"))

    def test_wrong_migration_count_rejected(self):
        migration = "PASS migration_integrity files=220\nRan 39 tests in 0.04s\n\nOK\n"
        self.rejected("MIGRATION_FILE_COUNT_MISMATCH", lambda: self.check(migration=migration))

    def test_wrong_python_count_rejected(self):
        migration = "PASS migration_integrity files=221\nRan 38 tests in 0.04s\n\nOK\n"
        self.rejected("MIGRATION_PYTHON_TEST_COUNT_MISMATCH", lambda: self.check(migration=migration))

    def test_python_failed_or_skipped_is_not_success(self):
        for final in ("FAILED (failures=1)", "OK (skipped=1)"):
            with self.subTest(final=final):
                migration = "PASS migration_integrity files=221\nRan 39 tests in 0.04s\n\n" + final + "\n"
                self.rejected("MIGRATION_PYTHON_TESTS_FAILED", lambda: self.check(migration=migration))

    def test_archive_digest_mismatch_rejected(self):
        path, metadata = self.checks_archive()
        metadata["digest"] = "sha256:" + "0" * 64
        self.rejected("ARTIFACT_ZIP_DIGEST_MISMATCH", lambda: VERIFIER.checks_proof(path, metadata, 963, 221, 39))

    def test_unexpected_archive_entry_rejected_after_matching_digest(self):
        path, metadata = self.checks_archive()
        with zipfile.ZipFile(path, "a") as archive:
            archive.writestr("extra.txt", "not allowed")
        metadata.update(digest="sha256:" + VERIFIER.file_hash(path), size_in_bytes=path.stat().st_size)
        self.rejected("CHECKS_FILES_MISMATCH", lambda: VERIFIER.checks_proof(path, metadata, 963, 221, 39))

    def test_zip_traversal_rejected(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("../outside.txt", b"x")
        with zipfile.ZipFile(io.BytesIO(buffer.getvalue())) as archive:
            self.rejected("ZIP_UNSAFE_PATH", lambda: VERIFIER.bounded_members(archive, 1024, 1024))

    def test_artifact_from_another_run_rejected(self):
        metadata = {"artifacts": [{"name": "fixture", "workflow_run": {"head_sha": VERIFIER.HEAD, "id": VERIFIER.RUN_ID + 1}, "expired": False}]}
        self.rejected("ARTIFACT_RUN_MISMATCH", lambda: VERIFIER.artifact_record(metadata, "fixture", VERIFIER.HEAD, VERIFIER.RUN_ID))

    def test_optional_source_literal_is_detected_when_present(self):
        proof = self.scan(self.strings())
        self.assertTrue(proof["sourceShaLiteralPresent"])
        self.assertEqual(proof["sourceShaLiteralRows"], 1)
        self.assertEqual(proof["sourceShaLiteralExpected"], VERIFIER.HEAD)
        self.assertFalse(proof["sourceShaLiteralRequiredByBuildContract"])
        self.assertFalse(proof["rawStringsPublished"])

    def test_absent_hermes_literal_is_recorded_without_inventing_a_build_requirement(self):
        proof = self.scan(self.strings()[:2])
        self.assertFalse(proof["sourceShaLiteralPresent"])
        self.assertEqual(proof["sourceShaLiteralRows"], 0)
        self.assertFalse(proof["sourceShaLiteralRequiredByBuildContract"])

    def test_source_sha_substring_of_longer_hex_value_is_not_a_pin(self):
        proof = self.scan(self.strings()[:2] + ["a" + VERIFIER.HEAD + "0"])
        self.assertFalse(proof["sourceShaLiteralPresent"])

    def test_other_backend_host_rejected(self):
        self.rejected("PACKAGED_BACKEND_HOST_MISMATCH", lambda: self.scan(self.strings() + ["https://abcdefghijklmnopqrst.supabase.co"]))

    def test_modern_secret_literal_rejected(self):
        self.rejected("PACKAGED_MODERN_SECRET_LITERAL_FOUND", lambda: self.scan(self.strings() + ["sb_secret_fixture_only_not_real"]))

    def test_service_role_jwt_rejected_without_echoing_token(self):
        encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")
        token = encode({"alg": "HS256"}) + "." + encode({"role": "service_role"}) + ".synthetic"
        self.rejected("PACKAGED_SERVICE_ROLE_JWT_FOUND", lambda: self.scan(self.strings() + [token]))

    def artifact_fixture(self, *, config_source=VERIFIER.HEAD, omit_identity_step=False):
        """Synthetic ZIPs exercise the full verification chain, never native code."""
        checks, checks_metadata = self.checks_archive()
        reference_path = HERE / "qa47-readback-20261107.json"
        reference = json.loads(reference_path.read_text())
        certificate = reference["apk"]["signature"]["certificateSha256"]
        dex_count = reference["apk"]["dexFiles"]
        config = {"extra": {"uskociBuild": {"sourceCommit": config_source, "backendTarget": "canonical"}},
                  "android": {"package": VERIFIER.PACKAGE}, "runtimeVersion": VERIFIER.RUNTIME,
                  "updates": {"enabled": False, "checkAutomatically": "NEVER", "useEmbeddedUpdate": True}}
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("assets/app.config", json.dumps(config))
            archive.writestr("assets/app.manifest", '{"assets":[]}')
            archive.writestr("assets/index.android.bundle", b"synthetic-test-bundle")
            archive.writestr("lib/arm64-v8a/libfixture.so", b"synthetic")
            for index in range(dex_count):
                archive.writestr("classes" + (str(index + 1) if index else "") + ".dex", b"USKOCI_RNR01")
        apk = buffer.getvalue()
        filename = "USKOCI-QA-" + VERIFIER.HEAD[:9] + ".apk"
        native = {"abis": ["arm64-v8a"], "dexFiles": dex_count, "embeddedBundle": True,
                  "otaEnabled": False, "nativePatchMarker": "USKOCI_RNR01"}
        receipt = {**native, "sourceCommit": VERIFIER.HEAD, "filename": filename, "bytes": len(apk),
                   "sha256": VERIFIER.sha(apk), "package": VERIFIER.PACKAGE, "backend": "DEV",
                   "runtimeVersion": VERIFIER.RUNTIME, "signing": "EXPO_TEMPLATE_ANDROID_DEBUG_KEY",
                   "deviceInstall": "NOT_PERFORMED", "push": "NOT_PROVEN", "replacesExistingPreview": False}
        xml = (' E: meta-data (line=1)\n A: android:name(0x1)="expo.modules.updates.ENABLED"\n A: android:value(0x1)=(type 0x12)0x0\n'
               ' E: meta-data (line=2)\n A: android:name(0x1)="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH"\n A: android:value(0x1)="NEVER"\n')
        signature = ("Verifies\nVerified using v2 scheme (APK Signature Scheme v2): true\nNumber of signers: 1\n"
                     + "Signer #1 certificate SHA-256 digest: " + certificate + "\nSigner #1 key algorithm: RSA\nSigner #1 key size (bits): 2048\n")
        apk_zip = self.directory / "apk.zip"
        with zipfile.ZipFile(apk_zip, "w") as archive:
            for name, data in {filename: apk, "build-receipt.json": json.dumps(receipt), "native-receipt.json": json.dumps(native),
                               "SHA256SUMS.txt": VERIFIER.sha(apk) + "  " + filename, "signature.txt": signature,
                               "apk-badging.txt": "package: name='" + VERIFIER.PACKAGE + "' versionCode='36' versionName='1.0.0'\nsdkVersion:'24'\ntargetSdkVersion:'36'\n",
                               "AndroidManifest-tree.txt": xml, "README.txt": "synthetic test fixture"}.items():
                archive.writestr(name, data)
        checks_metadata.update(name="uskoci-checks-" + VERIFIER.HEAD, expired=False,
                               workflow_run={"head_sha": VERIFIER.HEAD, "id": VERIFIER.RUN_ID})
        apk_metadata = {"id": 2, "name": "uskoci-isolated-qa-apk-58", "expired": False,
                        "workflow_run": {"head_sha": VERIFIER.HEAD, "id": VERIFIER.RUN_ID},
                        "digest": "sha256:" + VERIFIER.file_hash(apk_zip), "size_in_bytes": apk_zip.stat().st_size}
        step_names = ["Verify the active clean source", "Pin canonical DEV settings and isolate app identity",
                      "Generate only the Android native project", "Verify generated native update isolation",
                      "Build standalone installable release JS bundle and APK", "Attest isolated APK and source identity"]
        if omit_identity_step:
            step_names.remove("Pin canonical DEV settings and isolate app identity")
        metadata = {"run": {"id": VERIFIER.RUN_ID, "run_number": 58, "head_sha": VERIFIER.HEAD,
                            "head_branch": "work/uskoci-cist-proizvod-20261104", "status": "completed", "conclusion": "success"},
                    "jobs": {"jobs": [{"run_id": VERIFIER.RUN_ID, "status": "completed", "conclusion": "success",
                                        "steps": [{"name": name, "conclusion": "success"} for name in step_names]}]},
                    "artifacts": {"artifacts": [checks_metadata, apk_metadata]}}
        metadata_path = self.directory / "github-metadata.json"
        metadata_path.write_text(json.dumps(metadata))
        return SimpleNamespace(directory=self.directory, metadata=metadata_path, reference=reference_path,
                               run_id=VERIFIER.RUN_ID, head=VERIFIER.HEAD, run=58, branch="work/uskoci-cist-proizvod-20261104",
                               checks=None, apk=None, tests=963, migrations=221, migration_tests=39,
                               package=VERIFIER.PACKAGE, project=VERIFIER.PROJECT, runtime=VERIFIER.RUNTIME,
                               output=self.directory / "proof.json", hermesc=self.directory / "fixture-hermesc", expect_marker="present")

    def test_full_identity_contract_passes_without_uncontracted_hermes_literal(self):
        args = self.artifact_fixture()
        proof = {}
        with patch.object(VERIFIER, "hermes_proof", return_value=self.scan(self.strings()[:2])):
            VERIFIER.verify(args, proof)
        self.assertEqual(proof["sourceIdentity"]["contract"], "EMBEDDED_APP_CONFIG_AND_SAME_CI_BUILD")
        self.assertTrue(proof["sourceIdentity"]["embeddedConfigSourceCommitMatched"])
        self.assertFalse(proof["sourceIdentity"]["hermesSourceShaLiteralObserved"])

    def test_wrong_embedded_sha_rejected_even_with_matching_ci_and_archive_hashes(self):
        args = self.artifact_fixture(config_source="0" * 40)
        self.rejected("EMBEDDED_BUILD_IDENTITY_MISMATCH", lambda: VERIFIER.verify(args, {}))

    def test_missing_ci_source_identity_check_is_not_replaced_by_matching_config(self):
        args = self.artifact_fixture(omit_identity_step=True)
        self.rejected("REQUIRED_CI_STEP_NOT_SUCCESSFUL", lambda: VERIFIER.verify(args, {}))


if __name__ == "__main__":
    unittest.main()
