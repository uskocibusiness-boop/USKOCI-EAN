#!/usr/bin/env python3
"""Offline r2 extension of the preserved QA58 verifier, not a new APK build.

Supply original GitHub artifact ZIPs and API run/jobs/artifacts metadata.
All run/source/test-count expectations and a NEW output path are explicit.
The original verifier keeps its certificate/DEX/source/OTA/security checks.
This runner additionally compares native WAV bytes to the exact Git commit,
and to both CI receipts, and validates the current five-file checks artifact.
It never rewrites historical verifier/proof files.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import importlib.util
import io
import json
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

from apk_audio_resources import AudioResourceError, verify_apk_audio

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "docs/plan/proofs/qa58-artifact-verifier.py"
SPEC = importlib.util.spec_from_file_location("uskoci_qa58_preserved", BASE_PATH)
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)
RUNTIME = "uskoci-v1-preview-r2"
AUDIO = ("uskoci_message_v1.wav", "uskoci_opportunity_v1.wav", "uskoci_confirm_v1.wav")
ACTIVATION = "NOT_ACTIVE_SERVER_DEFAULT_CHANNEL_RETAINED"
CORE_CHECKS = {"tests.tap", "typescript.txt", "migration-integrity.txt"}
BOOTSTRAP_CHECKS = {"bootstrap-generator.txt", "bootstrap-seed.tap"}


def node_summary(raw, expected, prefix=""):
    text = raw.decode("utf-8")
    stats = {}
    for key in ("tests", "pass", "fail", "cancelled", "skipped", "todo"):
        found = re.findall(r"^(?:#|ℹ) " + key + r" (\d+)\s*$", text, re.M)
        BASE.require(len(found) == 1, prefix + "TEST_SUMMARY_MISSING_OR_DUPLICATE")
        stats[key] = int(found[0])
    BASE.require(stats == {"tests": expected, "pass": expected, "fail": 0,
                           "cancelled": 0, "skipped": 0, "todo": 0}, prefix + "TAP_TOTAL_MISMATCH")
    return stats, "NODE_SPEC" if "ℹ tests " in text else "TAP"


def checks_proof(path, metadata, expected_tests, expected_migrations, expected_migration_tests,
                 expected_bootstrap_generator_tests=11, expected_bootstrap_seed_tests=1):
    """Validate original ZIP bytes and either exact, explicitly reported layout.

    The historical parser's core assertions remain here because its source is
    immutable. No projected/repacked ZIP or invented GitHub digest is used.
    Three-file archives retain their historical scope; both bootstrap outputs
    are mandatory together in the current five-file format.
    """
    BASE.require(path.stat().st_size <= 10 * BASE.MIB, "ARTIFACT_SIZE_LIMIT")
    verified = BASE.verify_zip(path, metadata)
    raw = path.read_bytes()
    BASE.require(BASE.sha(raw) == verified["sha256"] and len(raw) == verified["bytes"],
                 "ARTIFACT_CHANGED_DURING_VERIFICATION")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        names = BASE.bounded_members(archive, 10 * BASE.MIB, 8 * BASE.MIB)
        BASE.require(set(names) in (CORE_CHECKS, CORE_CHECKS | BOOTSTRAP_CHECKS), "CHECKS_FILES_MISMATCH")
        values = {name: archive.read(name) for name in names}
    stats, report_format = node_summary(values["tests.tap"], expected_tests)
    BASE.require(values["typescript.txt"] == b"", "TYPESCRIPT_DIAGNOSTICS_PRESENT")
    migration = values["migration-integrity.txt"].decode("utf-8")
    summaries = re.findall(r"^PASS migration_integrity files=(\d+)[^\r\n]*$", migration, re.M)
    BASE.require(len(summaries) == 1 and not re.search(r"^(?:FAIL|ERROR)\b", migration, re.M), "MIGRATION_CHECK_FAILED")
    BASE.require(int(summaries[0]) == expected_migrations, "MIGRATION_FILE_COUNT_MISMATCH")
    python_summary = re.findall(r"^Ran (\d+) tests in [0-9.]+s\r?$", migration, re.M)
    BASE.require(len(python_summary) == 1 and int(python_summary[0]) == expected_migration_tests,
                 "MIGRATION_PYTHON_TEST_COUNT_MISMATCH")
    BASE.require(re.search(r"\nOK\s*\Z", migration) is not None
                 and not re.search(r"^(?:FAILED|FAIL:|ERROR:)", migration, re.M), "MIGRATION_PYTHON_TESTS_FAILED")
    result = {
        "archive": verified, "tests": stats, "testReportFormat": report_format,
        "typescript": {"status": "PASS_FROM_SUCCESSFUL_CI_STEP_AND_EMPTY_OUTPUT", "outputBytes": 0},
        "migrationIntegrity": {"status": "PASS", "physicalFiles": int(summaries[0]),
                               "pythonTests": {"tests": expected_migration_tests, "status": "OK"}},
        "fileSha256": {name: BASE.sha(data) for name, data in values.items()},
        "format": "CORE_THREE_FILES",
        "bootstrap": {"status": "NOT_PRESENT_IN_LEGACY_THREE_FILE_ARTIFACT"},
    }
    if set(names) == CORE_CHECKS | BOOTSTRAP_CHECKS:
        BASE.require(all(isinstance(value, int) and value > 0 for value in
                         (expected_bootstrap_generator_tests, expected_bootstrap_seed_tests)),
                     "EXPECTED_BOOTSTRAP_TEST_COUNT_INVALID")
        generator = values["bootstrap-generator.txt"].decode("utf-8")
        summaries = re.findall(r"^Ran (\d+) tests? in [0-9.]+s\r?$", generator, re.M)
        BASE.require(len(summaries) == 1 and int(summaries[0]) == expected_bootstrap_generator_tests,
                     "BOOTSTRAP_GENERATOR_TEST_COUNT_MISMATCH")
        BASE.require(re.search(r"\nOK\s*\Z", generator) is not None
                     and not re.search(r"^(?:FAILED|FAIL:|ERROR:|Traceback\b)", generator, re.M),
                     "BOOTSTRAP_GENERATOR_TESTS_FAILED")
        seed_stats, seed_format = node_summary(values["bootstrap-seed.tap"], expected_bootstrap_seed_tests, "BOOTSTRAP_SEED_")
        BASE.require(not re.search(r"^(?:not ok\b|✖|\s*Bail out!)", values["bootstrap-seed.tap"].decode("utf-8"), re.M),
                     "BOOTSTRAP_SEED_TESTS_FAILED")
        result.update(format="CORE_AND_BOOTSTRAP_FIVE_FILES", bootstrap={
            "status": "PASS",
            "generator": {"tests": expected_bootstrap_generator_tests, "status": "OK"},
            "seed": {"stats": seed_stats, "testReportFormat": seed_format, "status": "PASS"},
        })
    return result


def git_audio(repo, head):
    """Use immutable commit blobs, never potentially changed working-tree files."""
    result = {}
    for filename in AUDIO:
        identity = f"{head}:assets/audio/{filename}"
        size = subprocess.run(["git", "-C", str(repo), "cat-file", "-s", identity],
                              capture_output=True, timeout=10, check=False)
        BASE.require(size.returncode == 0 and re.fullmatch(rb"\d+\n?", size.stdout), "SOURCE_AUDIO_BLOB_UNAVAILABLE")
        BASE.require(0 < int(size.stdout) <= 64 * 1024, "SOURCE_AUDIO_SIZE_LIMIT")
        blob = subprocess.run(["git", "-C", str(repo), "show", identity],
                              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10, check=False)
        BASE.require(blob.returncode == 0 and len(blob.stdout) == int(size.stdout), "SOURCE_AUDIO_READ_FAILED")
        result[filename] = blob.stdout
    return result


def verify(args, proof):
    BASE.require(re.fullmatch(r"[0-9a-f]{40}", args.head) is not None, "EXPECTED_HEAD_INVALID")
    BASE.require(args.runtime == RUNTIME, "EXPECTED_RUNTIME_NOT_R2")
    for value in (args.run, args.run_id, args.tests, args.migrations, args.migration_tests):
        BASE.require(isinstance(value, int) and value > 0, "EXPECTED_RUN_OR_COUNT_INVALID")
    # The imported historical module is private to this runner. Replace only
    # its checks decoder for this invocation; every other base gate still runs.
    historical_checks = BASE.checks_proof
    def current_checks(path, metadata, tests, migrations, migration_tests):
        return checks_proof(path, metadata, tests, migrations, migration_tests,
                            getattr(args, "bootstrap_generator_tests", 11),
                            getattr(args, "bootstrap_seed_tests", 1))
    try:
        BASE.checks_proof = current_checks
        BASE.verify(args, proof)
    finally:
        BASE.checks_proof = historical_checks
    # Do not expose the base success as final before checking the extension.
    proof["status"] = "INCOMPLETE_R2_NATIVE_AUDIO_CHECK"
    source = git_audio(args.repo.resolve(), args.head)
    apk_zip = args.apk.resolve() if args.apk else args.directory.resolve() / "apk.zip"
    BASE.require(apk_zip.stat().st_size <= 256 * BASE.MIB, "ARTIFACT_SIZE_LIMIT")
    # Snapshot and recheck the ZIP. Extra checks cannot silently consume bytes
    # different from the artifact already verified by the preserved verifier.
    raw = apk_zip.read_bytes()
    BASE.require(BASE.sha(raw) == proof["artifact"]["sha256"], "ARTIFACT_CHANGED_DURING_VERIFICATION")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        BASE.bounded_members(archive, 256 * BASE.MIB, 128 * BASE.MIB)
        apk = archive.read(proof["apk"]["filename"])
        native = BASE.object_json(archive.read("native-receipt.json"), "NATIVE_RECEIPT_INVALID")
        receipt = BASE.object_json(archive.read("build-receipt.json"), "BUILD_RECEIPT_INVALID")
    BASE.require(BASE.sha(apk) == proof["apk"]["sha256"], "APK_CHANGED_DURING_VERIFICATION")
    hashes = {filename: BASE.sha(blob) for filename, blob in source.items()}
    BASE.require(args.aapt2 is not None and args.aapt2.is_file(), "AAPT2_NOT_AVAILABLE")
    # Independently resolve Android resource IDs/names from the downloaded APK.
    # AGP may shorten ZIP paths; stable logical names and exact bytes are required.
    with tempfile.TemporaryDirectory(prefix="qa-audio-resource-", dir=args.output.parent) as directory:
        snapshot = Path(directory) / "verified.apk"
        snapshot.write_bytes(apk)
        try:
            audio = verify_apk_audio(snapshot, args.aapt2, args.package, source)
        except AudioResourceError as error:
            raise BASE.Rejected(str(error)) from error
    BASE.require(audio["apk"]["sha256"] == proof["apk"]["sha256"], "APK_CHANGED_DURING_AUDIO_VERIFICATION")
    for record in (native, receipt):
        BASE.require(record.get("bundledAudioSha256") == hashes, "NATIVE_AUDIO_RECEIPT_MAP_MISMATCH")
        BASE.require(record.get("bundledAudioResources") == audio["resources"], "NATIVE_AUDIO_RESOURCE_RECEIPT_MISMATCH")
        BASE.require(record.get("customSoundActivation") == ACTIVATION, "NATIVE_AUDIO_ACTIVATION_RECEIPT_MISMATCH")
    proof["nativeAudio"] = {
        "status": "APK_LOGICAL_RAW_RESOURCES_AND_BYTES_MATCH_EXACT_GIT_COMMIT_AND_BOTH_CI_RECEIPTS",
        "sourceCommit": args.head,
        "source": "git show <exact sourceCommit>:assets/audio/<filename>; not working-tree files",
        "resources": audio["resources"],
        "independentAapt2": audio["aapt2"],
        "independentResourceDump": audio["resourceDump"],
        "customSoundActivation": ACTIVATION,
        "audibleOutputOrDeviceExecutionVerified": False,
    }
    proof["status"] = "LOCAL_ARTIFACT_AND_NATIVE_AUDIO_BYTES_CONFIRMED_NOT_NATIVE_E2E"


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--checks", type=Path)
    parser.add_argument("--apk", type=Path)
    parser.add_argument("--head", required=True)
    parser.add_argument("--run", type=int, required=True)
    parser.add_argument("--run-id", type=int, required=True)
    parser.add_argument("--tests", type=int, required=True)
    parser.add_argument("--migrations", type=int, required=True)
    parser.add_argument("--migration-tests", type=int, required=True)
    parser.add_argument("--bootstrap-generator-tests", type=int, default=11,
                        help="Expected Python test count when both bootstrap reports are present")
    parser.add_argument("--bootstrap-seed-tests", type=int, default=1,
                        help="Expected Node test count when both bootstrap reports are present")
    parser.add_argument("--output", type=Path, required=True, help="New proof path; existing files are never overwritten")
    parser.add_argument("--repo", type=Path, default=ROOT, help="Git repository containing the exact source commit")
    parser.add_argument("--hermesc", type=Path, default=ROOT / "node_modules/hermes-compiler/hermesc/linux64-bin/hermesc")
    parser.add_argument("--aapt2", type=Path, help="Verified Android AAPT2 binary for independent raw resource-table checks")
    parser.add_argument("--reference", type=Path, default=ROOT / "docs/plan/proofs/qa47-readback-20261107.json")
    parser.add_argument("--branch", default="work/uskoci-cist-proizvod-20261104")
    parser.add_argument("--runtime", choices=[RUNTIME], default=RUNTIME)
    args = parser.parse_args(argv)
    args.package = "rs.uskoci.preview.qa"
    args.project = "leqcwgzvjsxugfgzdmth"
    args.expect_marker = "present"
    return args


def write_new_proof(path, proof):
    with path.open("x", encoding="utf-8") as output:
        output.write(json.dumps(proof, indent=2, ensure_ascii=False) + "\n")


def main(argv=None):
    args = parse_args(argv)
    if args.output.exists():
        print(json.dumps({"status": "REJECTED", "failureCode": "OUTPUT_ALREADY_EXISTS"}))
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    proof = {
        "schema": "USKOCI_QA_APK_R2_ARTIFACT_VERIFIER_V1",
        "observedAtUtc": datetime.now(timezone.utc).isoformat(),
        "verifier": BASE.file_proof(Path(__file__).resolve()),
        "preservedBaseVerifier": BASE.file_proof(BASE_PATH),
        "status": "INCOMPLETE",
        "boundaries": [
            "Offline verification of supplied GitHub metadata and original artifact ZIPs; no network or build is performed.",
            "Native package/SDK/manifest/signature details use digest-bound CI aapt/apksigner receipts; no independent local aapt manifest or apksigner invocation is claimed.",
            "Embedded config/source/runtime/OTA flags, APK hashes, native WAV bytes and bounded Hermes strings are checked locally.",
            "A supplied verified AAPT2 binary independently resolves logical raw resource names and IDs to optimized APK paths; exact Git WAV bytes remain mandatory.",
            "The preserved QA47 debug certificate and seven-DEX continuity checks remain mandatory; unexpected change fails for review.",
            "No device execution, audible sound, push delivery, production signing, Play AAB or public-release readiness is established.",
        ],
    }
    code = 0
    try:
        verify(args, proof)
    except BASE.Rejected as error:
        proof.update(status="FAILED", failureCode=str(error))
        code = 1
    except Exception as error:
        proof.update(status="INCOMPLETE", failureCode="VERIFIER_INPUT_OR_TOOL_UNAVAILABLE", exceptionType=type(error).__name__)
        code = 2
    try:
        write_new_proof(args.output, proof)
    except FileExistsError:
        print(json.dumps({"status": "REJECTED", "failureCode": "OUTPUT_ALREADY_EXISTS"}))
        return 1
    print(json.dumps({"status": proof["status"], "failureCode": proof.get("failureCode"), "proof": BASE.file_proof(args.output)}))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
