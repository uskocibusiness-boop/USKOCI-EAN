"""Offline parser/negative tests; these synthetic fixtures are not APK evidence."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
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

    def test_compiled_source_literal_detected(self):
        proof = self.scan(self.strings())
        self.assertTrue(proof["compiledSourcePinPresent"])
        self.assertEqual(proof["compiledSourcePinRows"], 1)
        self.assertEqual(proof["compiledSourceCommit"], VERIFIER.HEAD)
        self.assertFalse(proof["rawStringsPublished"])

    def test_embedded_configuration_alone_does_not_substitute_for_compiled_pin(self):
        self.rejected("COMPILED_SOURCE_PIN_MISSING", lambda: self.scan(self.strings()[:2]))

    def test_source_sha_substring_of_longer_hex_value_is_not_a_pin(self):
        self.rejected("COMPILED_SOURCE_PIN_MISSING", lambda: self.scan(self.strings()[:2] + ["a" + VERIFIER.HEAD + "0"]))

    def test_other_backend_host_rejected(self):
        self.rejected("PACKAGED_BACKEND_HOST_MISMATCH", lambda: self.scan(self.strings() + ["https://abcdefghijklmnopqrst.supabase.co"]))

    def test_modern_secret_literal_rejected(self):
        self.rejected("PACKAGED_MODERN_SECRET_LITERAL_FOUND", lambda: self.scan(self.strings() + ["sb_secret_fixture_only_not_real"]))

    def test_service_role_jwt_rejected_without_echoing_token(self):
        encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")
        token = encode({"alg": "HS256"}) + "." + encode({"role": "service_role"}) + ".synthetic"
        self.rejected("PACKAGED_SERVICE_ROLE_JWT_FOUND", lambda: self.scan(self.strings() + [token]))


if __name__ == "__main__":
    unittest.main()
