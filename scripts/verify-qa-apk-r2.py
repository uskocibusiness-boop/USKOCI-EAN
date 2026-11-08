#!/usr/bin/env python3
"""Offline r2 extension of the preserved QA58 verifier, not a new APK build.

Supply original GitHub artifact ZIPs and API run/jobs/artifacts metadata.
All run/source/test-count expectations and a NEW output path are explicit.
The original verifier keeps its certificate/DEX/source/OTA/security checks.
This runner additionally compares native WAV bytes to the exact Git commit,
and to both CI receipts. It never rewrites historical verifier/proof files.
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
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "docs/plan/proofs/qa58-artifact-verifier.py"
SPEC = importlib.util.spec_from_file_location("uskoci_qa58_preserved", BASE_PATH)
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)
RUNTIME = "uskoci-v1-preview-r2"
AUDIO = ("uskoci_message_v1.wav", "uskoci_opportunity_v1.wav", "uskoci_confirm_v1.wav")
ACTIVATION = "NOT_ACTIVE_SERVER_DEFAULT_CHANNEL_RETAINED"


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
    BASE.verify(args, proof)
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
    with zipfile.ZipFile(io.BytesIO(apk)) as packaged:
        names = BASE.bounded_members(packaged, 512 * BASE.MIB, 128 * BASE.MIB)
        expected = {"res/raw/" + filename for filename in AUDIO}
        actual = {name for name in names if re.fullmatch(r"res/raw/uskoci_.*_v1\.wav", name)}
        BASE.require(actual == expected, "APK_NATIVE_AUDIO_RESOURCE_SET_MISMATCH")
        for filename, blob in source.items():
            BASE.require(packaged.read("res/raw/" + filename) == blob, "APK_NATIVE_AUDIO_BYTES_MISMATCH")
    for record in (native, receipt):
        BASE.require(record.get("bundledAudioSha256") == hashes, "NATIVE_AUDIO_RECEIPT_MAP_MISMATCH")
        BASE.require(record.get("customSoundActivation") == ACTIVATION, "NATIVE_AUDIO_ACTIVATION_RECEIPT_MISMATCH")
    proof["nativeAudio"] = {
        "status": "APK_RAW_BYTES_MATCH_EXACT_GIT_COMMIT_AND_BOTH_CI_RECEIPTS",
        "sourceCommit": args.head,
        "source": "git show <exact sourceCommit>:assets/audio/<filename>; not working-tree files",
        "resources": {name: {"apkPath": "res/raw/" + name, "bytes": len(source[name]), "sha256": hashes[name]} for name in AUDIO},
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
    parser.add_argument("--output", type=Path, required=True, help="New proof path; existing files are never overwritten")
    parser.add_argument("--repo", type=Path, default=ROOT, help="Git repository containing the exact source commit")
    parser.add_argument("--hermesc", type=Path, default=ROOT / "node_modules/hermes-compiler/hermesc/linux64-bin/hermesc")
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
            "Native package/SDK/manifest/signature details use digest-bound CI aapt/apksigner receipts; no independent local Android tool invocation is claimed.",
            "Embedded config/source/runtime/OTA flags, APK hashes, native WAV bytes and bounded Hermes strings are checked locally.",
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
