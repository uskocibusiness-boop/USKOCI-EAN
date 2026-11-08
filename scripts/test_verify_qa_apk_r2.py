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
        for filename in RUNNER.AUDIO:
            data = (self.repo / "assets/audio" / filename).read_bytes()
            self.inner["res/raw/" + filename] = data
            self.hashes[filename] = RUNNER.BASE.sha(data)
        for name in ("native-receipt.json", "build-receipt.json"):
            receipt = json.loads(self.outer[name])
            receipt.update(bundledAudioSha256=self.hashes, customSoundActivation=RUNNER.ACTIVATION)
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

    def test_working_tree_change_cannot_change_expected_audio(self):
        (self.repo / "assets/audio" / RUNNER.AUDIO[0]).write_bytes(b"uncommitted changed audio")
        self.assertEqual(self.verify()["nativeAudio"]["resources"][RUNNER.AUDIO[0]]["sha256"], self.hashes[RUNNER.AUDIO[0]])

    def test_tampered_wav_rejected_even_after_all_outer_apk_hashes_match(self):
        key = "res/raw/" + RUNNER.AUDIO[0]
        self.inner[key] = self.inner[key][:-1] + bytes([self.inner[key][-1] ^ 1])
        self.refresh_archive()
        self.rejected("APK_NATIVE_AUDIO_BYTES_MISMATCH")

    def test_missing_native_resource_rejected(self):
        del self.inner["res/raw/" + RUNNER.AUDIO[1]]
        self.refresh_archive()
        self.rejected("APK_NATIVE_AUDIO_RESOURCE_SET_MISMATCH")

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
