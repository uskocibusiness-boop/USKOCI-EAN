"""Synthetic offline r2 artifact fixtures, not evidence of an Android build."""
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


RUNNER = load("r2_verifier", ROOT / "scripts/verify-qa-apk-r2.py")
LEGACY = load("preserved_qa58_tests", ROOT / "docs/plan/proofs/test_qa58_artifact_verifier.py")


def zip_bytes(values):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, value in values.items():
            archive.writestr(name, value)
    return output.getvalue()


BOOTSTRAP_GENERATOR = b"...........\n----------------------------------------------------------------------\nRan 11 tests in 0.001s\n\nOK\n"
BOOTSTRAP_SEED = "\n".join(f"ℹ {key} {value}" for key, value in
                            {"tests": 1, "pass": 1, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0}.items()).encode() + b"\n"


class CurrentChecksTests(unittest.TestCase):
    def setUp(self):
        self.legacy = LEGACY.VerifierTests("test_node24_spec_and_node22_tap_formats")
        self.legacy.setUp()
        self.addCleanup(self.legacy.doCleanups)
        self.path, self.metadata = self.legacy.checks_archive()
        self.core_proof = RUNNER.BASE.checks_proof(self.path, self.metadata, 963, 221, 39)
        with zipfile.ZipFile(self.path) as archive:
            self.values = {name: archive.read(name) for name in archive.namelist()}
        self.values.update({"bootstrap-generator.txt": BOOTSTRAP_GENERATOR, "bootstrap-seed.tap": BOOTSTRAP_SEED})
        self.refresh()

    def refresh(self):
        self.path.write_bytes(zip_bytes(self.values))
        self.metadata.update(digest="sha256:" + RUNNER.BASE.file_hash(self.path), size_in_bytes=self.path.stat().st_size)

    def check(self, **kwargs):
        return RUNNER.checks_proof(self.path, self.metadata, 963, 221, 39, **kwargs)

    def rejected(self, code):
        with self.assertRaisesRegex(RUNNER.BASE.Rejected, "^" + code + "$"):
            self.check()

    def test_current_five_files_validate_every_output_and_original_zip(self):
        proof = self.check()
        self.assertEqual(proof["format"], "CORE_AND_BOOTSTRAP_FIVE_FILES")
        self.assertEqual(proof["bootstrap"]["generator"], {"tests": 11, "status": "OK"})
        self.assertEqual(proof["bootstrap"]["seed"]["stats"], {"tests": 1, "pass": 1, "fail": 0,
                                                               "cancelled": 0, "skipped": 0, "todo": 0})
        self.assertEqual(proof["archive"]["sha256"], self.metadata["digest"][7:])
        self.assertEqual(proof["fileSha256"], {name: RUNNER.BASE.sha(raw) for name, raw in self.values.items()})
        for key in ("tests", "testReportFormat", "typescript", "migrationIntegrity"):
            self.assertEqual(proof[key], self.core_proof[key])

    def test_legacy_three_files_preserve_core_proof_with_limited_scope(self):
        for name in RUNNER.BOOTSTRAP_CHECKS:
            del self.values[name]
        self.refresh()
        proof = self.check()
        self.assertEqual(proof["format"], "CORE_THREE_FILES")
        self.assertEqual(proof["bootstrap"], {"status": "NOT_PRESENT_IN_LEGACY_THREE_FILE_ARTIFACT"})
        for key in ("tests", "testReportFormat", "typescript", "migrationIntegrity", "fileSha256"):
            self.assertEqual(proof[key], self.core_proof[key])

    def test_partial_bootstrap_or_unknown_files_are_never_discarded(self):
        original = self.values.copy()
        for missing in RUNNER.BOOTSTRAP_CHECKS:
            with self.subTest(missing=missing):
                self.values = {name: raw for name, raw in original.items() if name != missing}
                self.refresh()
                self.rejected("CHECKS_FILES_MISMATCH")
        self.values = {**original, "unreviewed.txt": b"unexpected"}
        self.refresh()
        self.rejected("CHECKS_FILES_MISMATCH")

    def test_bootstrap_generator_wrong_or_duplicate_count_fails(self):
        for raw in (BOOTSTRAP_GENERATOR.replace(b"Ran 11", b"Ran 10"),
                    BOOTSTRAP_GENERATOR + BOOTSTRAP_GENERATOR, b"OK\n"):
            with self.subTest(raw=raw):
                self.values["bootstrap-generator.txt"] = raw
                self.refresh()
                self.rejected("BOOTSTRAP_GENERATOR_TEST_COUNT_MISMATCH")

    def test_bootstrap_generator_fail_skip_error_or_contradictory_success_fails(self):
        for final in (b"FAILED (failures=1)", b"OK (skipped=1)", b"OK (expected failures=1)", b"OK\nERROR: earlier failure\nOK"):
            with self.subTest(final=final):
                self.values["bootstrap-generator.txt"] = BOOTSTRAP_GENERATOR.replace(b"\nOK\n", b"\n" + final + b"\n")
                self.refresh()
                self.rejected("BOOTSTRAP_GENERATOR_TESTS_FAILED")

    def test_bootstrap_seed_supports_both_node_reporters(self):
        for prefix, expected_format in (("ℹ", "NODE_SPEC"), ("#", "TAP")):
            with self.subTest(prefix=prefix):
                self.values["bootstrap-seed.tap"] = BOOTSTRAP_SEED.decode().replace("ℹ", prefix).encode()
                self.refresh()
                self.assertEqual(self.check()["bootstrap"]["seed"]["testReportFormat"], expected_format)

    def test_bootstrap_seed_every_missing_or_duplicate_counter_fails(self):
        for key in ("tests", "pass", "fail", "cancelled", "skipped", "todo"):
            for duplicate in (False, True):
                with self.subTest(key=key, duplicate=duplicate):
                    lines = BOOTSTRAP_SEED.decode().splitlines(keepends=True)
                    row = next(line for line in lines if line.startswith("ℹ " + key + " "))
                    self.values["bootstrap-seed.tap"] = ("".join(lines) + row if duplicate else "".join(line for line in lines if line != row)).encode()
                    self.refresh()
                    self.rejected("BOOTSTRAP_SEED_TEST_SUMMARY_MISSING_OR_DUPLICATE")

    def test_bootstrap_seed_wrong_count_or_nonzero_terminal_counter_fails(self):
        for key, original, changed in (("tests", 1, 2), ("pass", 1, 0), ("fail", 0, 1),
                                       ("cancelled", 0, 1), ("skipped", 0, 1), ("todo", 0, 1)):
            with self.subTest(key=key):
                self.values["bootstrap-seed.tap"] = BOOTSTRAP_SEED.decode().replace(f"ℹ {key} {original}", f"ℹ {key} {changed}").encode()
                self.refresh()
                self.rejected("BOOTSTRAP_SEED_TAP_TOTAL_MISMATCH")

    def test_bootstrap_seed_contradictory_failure_or_bailout_fails(self):
        for line in (b"not ok 1 - failed\n", "✖ seed failed\n".encode(), b"Bail out!\n"):
            with self.subTest(line=line):
                self.values["bootstrap-seed.tap"] = line + BOOTSTRAP_SEED
                self.refresh()
                self.rejected("BOOTSTRAP_SEED_TESTS_FAILED")

    def test_expected_bootstrap_counts_remain_explicit_and_positive(self):
        self.values["bootstrap-generator.txt"] = BOOTSTRAP_GENERATOR.replace(b"Ran 11", b"Ran 12")
        self.values["bootstrap-seed.tap"] = BOOTSTRAP_SEED.decode().replace("ℹ tests 1", "ℹ tests 2").replace("ℹ pass 1", "ℹ pass 2").encode()
        self.refresh()
        proof = self.check(expected_bootstrap_generator_tests=12, expected_bootstrap_seed_tests=2)
        self.assertEqual(proof["bootstrap"]["generator"]["tests"], 12)
        self.assertEqual(proof["bootstrap"]["seed"]["stats"]["tests"], 2)
        with self.assertRaisesRegex(RUNNER.BASE.Rejected, "^EXPECTED_BOOTSTRAP_TEST_COUNT_INVALID$"):
            self.check(expected_bootstrap_seed_tests=0)

    def test_current_format_keeps_all_core_failures(self):
        original = self.values.copy()
        cases = [
            ("tests.tap", original["tests.tap"].replace(b"963", b"962"), "TAP_TOTAL_MISMATCH"),
            ("tests.tap", original["tests.tap"] + "ℹ tests 963\n".encode(), "TEST_SUMMARY_MISSING_OR_DUPLICATE"),
            ("typescript.txt", b"error TS2322\n", "TYPESCRIPT_DIAGNOSTICS_PRESENT"),
            ("migration-integrity.txt", original["migration-integrity.txt"].replace(b"files=221", b"files=220"), "MIGRATION_FILE_COUNT_MISMATCH"),
            ("migration-integrity.txt", original["migration-integrity.txt"].replace(b"Ran 39", b"Ran 38"), "MIGRATION_PYTHON_TEST_COUNT_MISMATCH"),
            ("migration-integrity.txt", original["migration-integrity.txt"].replace(b"\nOK\n", b"\nOK (skipped=1)\n"), "MIGRATION_PYTHON_TESTS_FAILED"),
            ("migration-integrity.txt", original["migration-integrity.txt"] + b"FAIL migration_integrity\n", "MIGRATION_CHECK_FAILED"),
        ]
        for filename, raw, code in cases:
            with self.subTest(code=code):
                self.values = {**original, filename: raw}
                self.refresh()
                self.rejected(code)

    def test_current_format_original_digest_and_duplicate_entry_are_checked(self):
        self.metadata["digest"] = "sha256:" + "0" * 64
        self.rejected("ARTIFACT_ZIP_DIGEST_MISMATCH")
        with zipfile.ZipFile(self.path, "a") as archive:
            with self.assertWarns(UserWarning):
                archive.writestr("bootstrap-seed.tap", BOOTSTRAP_SEED)
        self.metadata.update(digest="sha256:" + RUNNER.BASE.file_hash(self.path), size_in_bytes=self.path.stat().st_size)
        self.rejected("ZIP_DUPLICATE_ENTRY")


class R2VerifierTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="uskoci-r2-verifier-test-")
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        for filename in RUNNER.AUDIO:
            target = self.repo / "assets/audio" / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / "assets/audio" / filename, target)
        self.git("init", "-q")
        self.git("add", "assets/audio")
        self.git("-c", "user.name=USKOCI verifier fixture", "-c", "user.email=fixture@example.invalid",
                 "commit", "-qm", "Synthetic verifier fixture")
        self.head = self.git("rev-parse", "HEAD").decode().strip()
        self.legacy = LEGACY.VerifierTests("test_node24_spec_and_node22_tap_formats")
        self.legacy.setUp()
        self.addCleanup(self.legacy.doCleanups)
        with patch.object(LEGACY.VERIFIER, "HEAD", self.head), patch.object(LEGACY.VERIFIER, "RUNTIME", RUNNER.RUNTIME):
            self.args = self.legacy.artifact_fixture(config_source=self.head)
        self.args.repo = self.repo
        self.apk_zip = self.args.directory / "apk.zip"
        with zipfile.ZipFile(self.apk_zip) as archive:
            self.outer = {name: archive.read(name) for name in archive.namelist()}
        self.filename = "USKOCI-QA-" + self.head[:9] + ".apk"
        with zipfile.ZipFile(io.BytesIO(self.outer[self.filename])) as archive:
            self.inner = {name: archive.read(name) for name in archive.namelist()}
        self.hashes = {}
        self.resources = {}
        paths = {'uskoci_confirm_v1.wav': 'res/F2.wav', 'uskoci_message_v1.wav': 'res/ES.wav', 'uskoci_opportunity_v1.wav': 'res/fp.wav'}
        dump = ['Binary APK', 'Package name=rs.uskoci.preview.qa id=7f', '  type raw id=01 entryCount=3']
        for index, filename in enumerate(sorted(RUNNER.AUDIO)):
            data = (self.repo / "assets/audio" / filename).read_bytes()
            resource_id = f'0x7f01000{index}'
            resource_name = 'raw/' + Path(filename).stem
            self.inner[paths[filename]] = data
            self.hashes[filename] = RUNNER.BASE.sha(data)
            self.resources[filename] = {'logicalName': resource_name, 'resourceId': resource_id,
                                        'apkPath': paths[filename], 'bytes': len(data), 'sha256': self.hashes[filename]}
            dump.extend([f'    resource {resource_id} {resource_name}', f'      () (file) {paths[filename]}'])
        # AAPT2 itself is replaced only in this synthetic artifact fixture.
        # The helper still parses a real observed dump shape and checks actual
        # ZIP bytes. Separate native reproduction runs the official binary.
        self.inner['resources.arsc'] = b'SYNTHETIC_RESOURCE_TABLE_ONLY'
        self.inner['AndroidManifest.xml'] = b'SYNTHETIC_MANIFEST_ONLY'
        dump_path = self.repo / 'fixture-resources.txt'
        dump_path.write_text('\n'.join(dump) + '\n')
        self.args.aapt2 = self.repo / 'aapt2-fixture'
        self.args.aapt2.write_text('#!/usr/bin/env python3\nimport sys\nfrom pathlib import Path\n'
                                  'if sys.argv[1:] == ["version"]: print("Android Asset Packaging Tool (aapt) 2.20-13700139")\n'
                                  'elif sys.argv[1:3] == ["dump", "resources"]: print(Path(' + repr(str(dump_path)) + ').read_text(), end="")\n'
                                  'else: raise SystemExit(2)\n')
        self.args.aapt2.chmod(0o755)
        for name in ("native-receipt.json", "build-receipt.json"):
            receipt = json.loads(self.outer[name])
            receipt.update(bundledAudioSha256=self.hashes, bundledAudioResources=self.resources, customSoundActivation=RUNNER.ACTIVATION)
            self.outer[name] = json.dumps(receipt).encode()
        self.refresh_archive()

    def git(self, *args):
        result = subprocess.run(["git", "-C", str(self.repo), *args], capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        return result.stdout

    def refresh_archive(self):
        apk = zip_bytes(self.inner)
        self.outer[self.filename] = apk
        receipt = json.loads(self.outer["build-receipt.json"])
        receipt.update(bytes=len(apk), sha256=RUNNER.BASE.sha(apk))
        self.outer["build-receipt.json"] = json.dumps(receipt).encode()
        self.outer["SHA256SUMS.txt"] = (RUNNER.BASE.sha(apk) + "  " + self.filename).encode()
        self.apk_zip.write_bytes(zip_bytes(self.outer))
        metadata = json.loads(self.args.metadata.read_text())
        for item in metadata["artifacts"]["artifacts"]:
            if item["name"].startswith("uskoci-isolated-qa-apk-"):
                item.update(digest="sha256:" + RUNNER.BASE.file_hash(self.apk_zip), size_in_bytes=self.apk_zip.stat().st_size)
        self.args.metadata.write_text(json.dumps(metadata))

    def verify(self):
        proof = {}
        # Archive/source/receipt checks are real; the synthetic bundle is not
        # executable Hermes. Historical scanner tests cover the parser itself.
        with patch.object(RUNNER.BASE, "hermes_proof", return_value={"sourceShaLiteralPresent": False}):
            RUNNER.verify(self.args, proof)
        return proof

    def rejected(self, code):
        with self.assertRaisesRegex(RUNNER.BASE.Rejected, "^" + code + "$"):
            self.verify()

    def test_r2_fixture_matches_immutable_source_audio_and_both_receipts(self):
        proof = self.verify()
        self.assertEqual(proof["status"], "LOCAL_ARTIFACT_AND_NATIVE_AUDIO_BYTES_CONFIRMED_NOT_NATIVE_E2E")
        self.assertEqual(proof["nativeAudio"]["sourceCommit"], self.head)
        self.assertEqual(set(proof["nativeAudio"]["resources"]), set(RUNNER.AUDIO))
        self.assertFalse(proof["nativeAudio"]["audibleOutputOrDeviceExecutionVerified"])

    def test_current_checks_decoder_is_used_by_full_runner_and_base_is_restored(self):
        path = self.args.directory / "checks.zip"
        with zipfile.ZipFile(path) as archive:
            values = {name: archive.read(name) for name in archive.namelist()}
        values.update({"bootstrap-generator.txt": BOOTSTRAP_GENERATOR, "bootstrap-seed.tap": BOOTSTRAP_SEED})
        path.write_bytes(zip_bytes(values))
        metadata = json.loads(self.args.metadata.read_text())
        record = next(item for item in metadata["artifacts"]["artifacts"] if item["name"].startswith("uskoci-checks-"))
        record.update(digest="sha256:" + RUNNER.BASE.file_hash(path), size_in_bytes=path.stat().st_size)
        self.args.metadata.write_text(json.dumps(metadata))
        historical_checks = RUNNER.BASE.checks_proof
        proof = self.verify()
        self.assertEqual(proof["checks"]["format"], "CORE_AND_BOOTSTRAP_FIVE_FILES")
        self.assertEqual(proof["checks"]["bootstrap"]["status"], "PASS")
        self.assertIs(RUNNER.BASE.checks_proof, historical_checks)
        self.args.tests += 1
        self.rejected("TAP_TOTAL_MISMATCH")
        self.assertIs(RUNNER.BASE.checks_proof, historical_checks)

    def test_working_tree_change_cannot_change_expected_audio(self):
        (self.repo / "assets/audio" / RUNNER.AUDIO[0]).write_bytes(b"uncommitted changed audio")
        self.assertEqual(self.verify()["nativeAudio"]["resources"][RUNNER.AUDIO[0]]["sha256"], self.hashes[RUNNER.AUDIO[0]])

    def test_tampered_wav_rejected_even_after_all_outer_apk_hashes_match(self):
        key = self.resources[RUNNER.AUDIO[0]]['apkPath']
        self.inner[key] = self.inner[key][:-1] + bytes([self.inner[key][-1] ^ 1])
        self.refresh_archive()
        self.rejected("AUDIO_APK_RESOURCE_BYTES_MISMATCH")

    def test_missing_native_resource_rejected(self):
        del self.inner[self.resources[RUNNER.AUDIO[1]]['apkPath']]
        self.refresh_archive()
        self.rejected("AUDIO_APK_RESOURCE_MISSING")

    def test_forged_resource_mapping_rejected_even_with_correct_audio_hashes(self):
        receipt = json.loads(self.outer['native-receipt.json'])
        receipt['bundledAudioResources'][RUNNER.AUDIO[0]]['apkPath'] = 'res/forged.wav'
        self.outer['native-receipt.json'] = json.dumps(receipt).encode()
        self.refresh_archive()
        self.rejected('NATIVE_AUDIO_RESOURCE_RECEIPT_MISMATCH')

    def test_independent_resource_table_tool_is_required(self):
        self.args.aapt2 = None
        self.rejected('AAPT2_NOT_AVAILABLE')

    def test_wrong_native_receipt_map_rejected(self):
        for name in ("native-receipt.json", "build-receipt.json"):
            with self.subTest(receipt=name):
                original = self.outer[name]
                receipt = json.loads(original)
                receipt["bundledAudioSha256"][RUNNER.AUDIO[0]] = "0" * 64
                self.outer[name] = json.dumps(receipt).encode()
                self.refresh_archive()
                self.rejected("NATIVE_AUDIO_RECEIPT_MAP_MISMATCH")
                self.outer[name] = original

    def test_missing_map_or_false_activation_claim_rejected(self):
        receipt = json.loads(self.outer["native-receipt.json"])
        receipt.pop("bundledAudioSha256")
        self.outer["native-receipt.json"] = json.dumps(receipt).encode()
        self.refresh_archive()
        self.rejected("NATIVE_AUDIO_RECEIPT_MAP_MISMATCH")
        receipt["bundledAudioSha256"] = self.hashes
        receipt["customSoundActivation"] = "ACTIVE"
        self.outer["native-receipt.json"] = json.dumps(receipt).encode()
        self.refresh_archive()
        self.rejected("NATIVE_AUDIO_ACTIVATION_RECEIPT_MISMATCH")

    def test_wrong_head_rejected_by_preserved_source_identity_checks(self):
        self.args.head = "0" * 40
        self.rejected("GITHUB_RUN_HEAD_MISMATCH")

    def test_wrong_embedded_runtime_rejected_even_with_matching_archive_hash(self):
        config = json.loads(self.inner["assets/app.config"])
        config["runtimeVersion"] = "uskoci-v1-preview-r1"
        self.inner["assets/app.config"] = json.dumps(config).encode()
        self.refresh_archive()
        self.rejected("EMBEDDED_RUNTIME_MISMATCH")

    def test_unexpected_runtime_argument_rejected(self):
        self.args.runtime = "uskoci-v1-preview-r1"
        self.rejected("EXPECTED_RUNTIME_NOT_R2")

    def test_artifact_digest_and_test_count_checks_are_retained(self):
        self.args.tests += 1
        self.rejected("TAP_TOTAL_MISMATCH")
        self.args.tests -= 1
        self.apk_zip.write_bytes(self.apk_zip.read_bytes() + b"changed")
        self.rejected("ARTIFACT_ZIP_DIGEST_MISMATCH")

    def test_existing_output_is_never_overwritten(self):
        output = self.repo / "historical-proof.json"
        output.write_text("keep original proof\n")
        with self.assertRaises(FileExistsError):
            RUNNER.write_new_proof(output, {"status": "new"})
        self.assertEqual(output.read_text(), "keep original proof\n")


if __name__ == "__main__":
    unittest.main()
