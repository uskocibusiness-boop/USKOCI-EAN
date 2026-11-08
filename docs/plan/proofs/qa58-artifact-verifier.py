#!/usr/bin/env python3
"""Offline, bounded verification of a downloaded USKOCI QA artifact.

No network, application changes or Android execution. GitHub metadata and
downloaded archives are supplied by the coordinator; only the requested proof
is written. Raw Hermes strings and credential values are never published.

Metadata is an envelope with run, jobs and artifacts from the GitHub REST API.
The latter two accept either their API objects or the contained arrays. Archives
must be the original artifact ZIPs, not ZIPs rebuilt from extracted contents.
"""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import resource
import shutil
import subprocess
import tempfile
import zipfile


HEAD = "f0ea98106537f5a844721400d5357d5e21689cc1"
RUN_ID = 42435554637
PACKAGE = "rs.uskoci.preview.qa"
PROJECT = "leqcwgzvjsxugfgzdmth"
RUNTIME = "uskoci-v1-preview-r1"
JOURNAL = "uskoci.selection.command.v1."
MIB = 1024 * 1024


class Rejected(Exception):
    pass


def require(value, code):
    if not value:
        raise Rejected(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(MIB):
            digest.update(block)
    return digest.hexdigest()


def file_proof(path):
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": file_hash(path)}


def object_json(raw, code):
    value = json.loads(raw)
    require(isinstance(value, dict), code)
    return value


def bounded_members(archive, total_limit, member_limit):
    infos = archive.infolist()
    require(len(infos) <= 5000, "ZIP_ENTRY_COUNT_LIMIT")
    names = [item.filename for item in infos]
    require(len(names) == len(set(names)), "ZIP_DUPLICATE_ENTRY")
    require(sum(item.file_size for item in infos) <= total_limit, "ZIP_TOTAL_SIZE_LIMIT")
    for item in infos:
        require(not item.flag_bits & 1, "ZIP_ENCRYPTED_ENTRY")
        require(0 <= item.file_size <= member_limit, "ZIP_MEMBER_SIZE_LIMIT")
        require(not Path(item.filename).is_absolute() and ".." not in Path(item.filename).parts,
                "ZIP_UNSAFE_PATH")
    return names


def artifact_record(metadata, name, head, run_id):
    artifacts = metadata.get("artifacts")
    if isinstance(artifacts, dict):
        artifacts = artifacts.get("artifacts")
    require(isinstance(artifacts, list), "GITHUB_ARTIFACTS_MISSING")
    rows = [item for item in artifacts if item.get("name") == name]
    require(len(rows) == 1, "GITHUB_ARTIFACT_NOT_UNIQUE")
    item = rows[0]
    require(item.get("workflow_run", {}).get("head_sha") == head, "ARTIFACT_HEAD_MISMATCH")
    require(item.get("workflow_run", {}).get("id") == run_id, "ARTIFACT_RUN_MISMATCH")
    require(item.get("expired") is False, "ARTIFACT_EXPIRED")
    return item


def verify_zip(path, metadata):
    actual = file_proof(path)
    digest = metadata.get("digest", "")
    require(re.fullmatch(r"sha256:[0-9a-f]{64}", digest) is not None, "ARTIFACT_DIGEST_MISSING")
    require(actual["sha256"] == digest[7:], "ARTIFACT_ZIP_DIGEST_MISMATCH")
    require(actual["bytes"] == metadata.get("size_in_bytes"), "ARTIFACT_ZIP_SIZE_MISMATCH")
    return {**actual, "artifactId": metadata["id"], "artifactName": metadata["name"],
            "matchesGithubDigestAndSize": True}


def checks_proof(path, metadata, expected_tests, expected_migrations, expected_migration_tests):
    verified = verify_zip(path, metadata)
    with zipfile.ZipFile(path) as archive:
        names = bounded_members(archive, 10 * MIB, 8 * MIB)
        require(set(names) == {"tests.tap", "typescript.txt", "migration-integrity.txt"}, "CHECKS_FILES_MISMATCH")
        values = {name: archive.read(name) for name in names}
    text = values["tests.tap"].decode("utf-8")
    stats = {}
    for key in ["tests", "pass", "fail", "cancelled", "skipped", "todo"]:
        found = re.findall(r"^(?:#|ℹ) " + key + r" (\d+)\s*$", text, re.M)
        require(len(found) == 1, "TEST_SUMMARY_MISSING_OR_DUPLICATE")
        stats[key] = int(found[0])
    require(stats == {"tests": expected_tests, "pass": expected_tests, "fail": 0,
                      "cancelled": 0, "skipped": 0, "todo": 0}, "TAP_TOTAL_MISMATCH")
    require(values["typescript.txt"] == b"", "TYPESCRIPT_DIAGNOSTICS_PRESENT")
    migration = values["migration-integrity.txt"].decode("utf-8")
    summaries = re.findall(r"^PASS migration_integrity files=(\d+)[^\r\n]*$", migration, re.M)
    require(len(summaries) == 1 and not re.search(r"^(?:FAIL|ERROR)\b", migration, re.M), "MIGRATION_CHECK_FAILED")
    require(int(summaries[0]) == expected_migrations, "MIGRATION_FILE_COUNT_MISMATCH")
    python_summary = re.findall(r"^Ran (\d+) tests in [0-9.]+s\r?$", migration, re.M)
    require(len(python_summary) == 1 and int(python_summary[0]) == expected_migration_tests,
            "MIGRATION_PYTHON_TEST_COUNT_MISMATCH")
    require(re.search(r"\nOK\s*\Z", migration) is not None
            and not re.search(r"^(?:FAILED|FAIL:|ERROR:)", migration, re.M), "MIGRATION_PYTHON_TESTS_FAILED")
    return {"archive": verified, "tests": stats, "testReportFormat": "NODE_SPEC" if "ℹ tests " in text else "TAP",
            "typescript": {"status": "PASS_FROM_SUCCESSFUL_CI_STEP_AND_EMPTY_OUTPUT", "outputBytes": 0},
            "migrationIntegrity": {"status": "PASS", "physicalFiles": int(summaries[0]),
                                   "pythonTests": {"tests": expected_migration_tests, "status": "OK"}},
            "fileSha256": {name: sha(data) for name, data in values.items()}}


def scan_strings(dump, expected_marker, expected_source, expected_project):
    require(len(dump) <= 128 * MIB, "HERMES_DUMP_SIZE_LIMIT")
    begin = dump.find(b"Global String Table:\n")
    require(0 <= begin < 8192, "HERMES_STRING_TABLE_HEADER_MISSING")
    header = dump[:begin]
    count_match = re.search(rb"(?m)^  String count: (\d+)$", header)
    version_match = re.search(rb"(?m)^  Bytecode version number: (\d+)$", header)
    require(count_match is not None and version_match is not None, "HERMES_HEADER_INVALID")
    expected = int(count_match[1])
    require(0 < expected <= 150000, "HERMES_STRING_COUNT_LIMIT")
    start = begin + len(b"Global String Table:\n")
    end = dump.find(b"\nLiteral Value Buffer:\n", start)
    require(start < end and end - start <= 32 * MIB, "HERMES_STRING_TABLE_BOUNDARY_INVALID")
    table = dump[start:end]
    pattern = re.compile(rb"^([si])(\d+)\[(ASCII|UTF-16), (-?\d+)\.\.(-?\d+)\](?: #[0-9A-Fa-f]+)?: ?(.*)$")
    rows = [line for line in table.splitlines() if line]
    require(len(rows) == expected, "HERMES_STRING_ROW_COUNT_MISMATCH")
    counts = {"ascii": 0, "utf16": 0, "jwtCandidates": 0, "jwtPayloadsDecoded": 0,
              "serviceRoleJwt": 0, "modernSecretLiterals": 0, "modernSecretPrefix": 0,
              "journalMarker": 0, "sourceShaLiteralRows": 0}
    hosts = set()
    for index, line in enumerate(rows):
        require(len(line) <= MIB, "HERMES_STRING_ROW_SIZE_LIMIT")
        match = pattern.fullmatch(line)
        require(match is not None and int(match[2]) == index, "HERMES_STRING_ROW_INVALID")
        expected_bytes = int(match[5]) - int(match[4]) + 1
        require(expected_bytes >= 0, "HERMES_STRING_LENGTH_INVALID")
        raw = match[6]
        # The dumper emits actual ASCII backslashes unchanged. Use the declared
        # storage length to preserve literal \xNN rather than over-decoding it.
        if match[3] == b"ASCII" and len(raw) == expected_bytes:
            decoded = raw
        else:
            decoded = re.sub(rb"\\x([0-9A-Fa-f]{2})", lambda m: bytes([int(m[1], 16)]), raw)
        require(len(decoded) == expected_bytes, "HERMES_DECODED_LENGTH_MISMATCH")
        if match[3] == b"UTF-16":
            require(expected_bytes % 2 == 0, "HERMES_UTF16_LENGTH_INVALID")
            text = decoded.decode("utf-16-le", errors="surrogatepass")
            counts["utf16"] += 1
        else:
            text = decoded.decode("latin1")
            counts["ascii"] += 1
        counts["journalMarker"] += JOURNAL in text
        counts["sourceShaLiteralRows"] += bool(re.search(r"(?<![0-9a-f])" + re.escape(expected_source) + r"(?![0-9a-f])", text))
        counts["modernSecretPrefix"] += text.count("sb_secret_")
        counts["modernSecretLiterals"] += len(re.findall(r"sb_secret_[A-Za-z0-9_-]{8,}", text))
        hosts.update(re.findall(r"(?<![a-z0-9])[a-z0-9]{20}\.supabase\.co\b", text))
        for token in re.findall(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", text):
            counts["jwtCandidates"] += 1
            encoded = token.split(".")[1]
            try:
                payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
            except (ValueError, UnicodeError):
                continue
            counts["jwtPayloadsDecoded"] += 1
            if isinstance(payload, dict) and payload.get("role") == "service_role":
                counts["serviceRoleJwt"] += 1
    host_ok = hosts == {expected_project + ".supabase.co"}
    result = {"scope": "Bounded Hermes string table; credential and Supabase-host patterns, not a full native binary audit",
              "bytecodeVersion": int(version_match[1]), "decodedStringCount": expected,
              "unmatchedStringRows": 0, "decodedAsciiRows": counts["ascii"], "decodedUtf16Rows": counts["utf16"],
              "serviceRoleJwtFound": counts["serviceRoleJwt"] > 0,
              "modernSecretLiteralFound": counts["modernSecretLiterals"] > 0,
              "literalPrefixCount": counts["modernSecretPrefix"], "jwtCandidateCount": counts["jwtCandidates"],
              "jwtPayloadsDecoded": counts["jwtPayloadsDecoded"], "supabaseHostCount": len(hosts),
              "canonicalDevHostOnly": host_ok, "journalMarkerPresent": counts["journalMarker"] > 0,
              "journalMarkerRows": counts["journalMarker"],
              "sourceShaLiteralPresent": counts["sourceShaLiteralRows"] > 0,
              "sourceShaLiteralRows": counts["sourceShaLiteralRows"],
              "sourceShaLiteralExpected": expected_source,
              "sourceShaLiteralRequiredByBuildContract": False, "rawStringsPublished": False,
              "nativeBinaryFullAudit": False}
    require(counts["serviceRoleJwt"] == 0, "PACKAGED_SERVICE_ROLE_JWT_FOUND")
    require(counts["modernSecretLiterals"] == 0, "PACKAGED_MODERN_SECRET_LITERAL_FOUND")
    require(host_ok, "PACKAGED_BACKEND_HOST_MISMATCH")
    require(result["journalMarkerPresent"] == (expected_marker == "present"), "JOURNAL_MARKER_EXPECTATION_MISMATCH")
    return result


def hermes_proof(compiler, bundle, expected_marker, expected_source, expected_project, temporary):
    require(compiler.is_file(), "HERMESC_NOT_AVAILABLE")
    bundle_path = temporary / "index.android.bundle.hbc"
    bundle_path.write_bytes(bundle)
    # Bound output on disk and wall-clock runtime. The temporary disassembly is
    # consumed locally and removed; never return its raw credential/string text.
    def output_limit():
        resource.setrlimit(resource.RLIMIT_FSIZE, (128 * MIB, 128 * MIB))
    with tempfile.TemporaryFile(dir=temporary) as output, tempfile.TemporaryFile(dir=temporary) as errors:
        result = subprocess.run([str(compiler), "-b", "-dump-bytecode", str(bundle_path)],
                                stdout=output, stderr=errors, timeout=40, check=False, preexec_fn=output_limit)
        require(result.returncode == 0, "HERMES_DISASSEMBLY_FAILED")
        length = output.tell()
        require(length <= 128 * MIB, "HERMES_DISASSEMBLY_SIZE_LIMIT")
        output.seek(0)
        dump = output.read(128 * MIB + 1)
    scanned = scan_strings(dump, expected_marker, expected_source, expected_project)
    return {**scanned, "compiler": file_proof(compiler), "dumpBytes": length, "dumpSha256": sha(dump),
            "rawDumpRetained": False, "timeoutSeconds": 40, "maxDumpBytes": 128 * MIB}


def verify(args, proof):
    directory = args.directory.resolve()
    metadata_path = args.metadata.resolve() if args.metadata else directory / "github-metadata.json"
    metadata = object_json(metadata_path.read_bytes(), "GITHUB_METADATA_INVALID")
    reference = object_json(args.reference.read_bytes(), "REFERENCE_INVALID")
    require(reference.get("run", {}).get("number") == 47, "REFERENCE_NOT_QA47")
    run = metadata.get("run", {})
    run_id = run.get("id")
    require(run_id == args.run_id, "GITHUB_RUN_ID_MISMATCH")
    require(run.get("source", run.get("head_sha")) == args.head, "GITHUB_RUN_HEAD_MISMATCH")
    require(run.get("number", run.get("run_number")) == args.run, "GITHUB_RUN_NUMBER_MISMATCH")
    require(run.get("branch", run.get("head_branch")) == args.branch, "GITHUB_RUN_BRANCH_MISMATCH")
    require(run.get("status") == "completed" and run.get("conclusion") == "success", "GITHUB_RUN_NOT_SUCCESSFUL")
    jobs = metadata.get("jobs")
    if isinstance(jobs, dict):
        jobs = jobs.get("jobs")
    require(isinstance(jobs, list) and jobs, "GITHUB_JOBS_MISSING")
    require(all(job.get("run_id") == run_id and job.get("status") == "completed"
                and job.get("conclusion") == "success" for job in jobs), "GITHUB_JOB_RUN_OR_STATUS_MISMATCH")
    steps = [step for job in jobs for step in job.get("steps", [])]
    for name in ["Verify the active clean source", "Pin canonical DEV settings and isolate app identity",
                 "Generate only the Android native project", "Verify generated native update isolation",
                 "Build standalone installable release JS bundle and APK", "Attest isolated APK and source identity"]:
        require(any(step.get("name") == name and step.get("conclusion") == "success" for step in steps), "REQUIRED_CI_STEP_NOT_SUCCESSFUL")
    proof.update({"sourceCommit": args.head, "runNumber": args.run, "runId": run_id,
                  "githubMetadata": file_proof(metadata_path), "reference": file_proof(args.reference),
                  "ciRunAndRequiredStepsSuccessful": True})
    checks = artifact_record(metadata, "uskoci-checks-" + args.head, args.head, run_id)
    proof["checks"] = checks_proof(args.checks.resolve() if args.checks else directory / "checks.zip", checks, args.tests, args.migrations, args.migration_tests)
    artifact = artifact_record(metadata, "uskoci-isolated-qa-apk-" + str(args.run), args.head, run_id)
    apk_zip = args.apk.resolve() if args.apk else directory / "apk.zip"
    proof["artifact"] = verify_zip(apk_zip, artifact)
    with zipfile.ZipFile(apk_zip) as archive:
        names = bounded_members(archive, 256 * MIB, 128 * MIB)
        apks = [name for name in names if name.endswith(".apk")]
        require(len(apks) == 1 and re.fullmatch(r"USKOCI-QA-[0-9a-f]{9}\.apk", apks[0]) is not None, "APK_FILE_COUNT_OR_NAME_INVALID")
        filename = apks[0]
        require(filename == "USKOCI-QA-" + args.head[:9] + ".apk", "APK_FILENAME_HEAD_MISMATCH")
        required = {filename, "build-receipt.json", "native-receipt.json", "SHA256SUMS.txt",
                    "signature.txt", "apk-badging.txt", "AndroidManifest-tree.txt", "README.txt"}
        require(set(names) == required, "APK_ARTIFACT_FILES_MISMATCH")
        data = {name: archive.read(name) for name in names}  # zipfile also verifies each CRC.
    receipt = object_json(data["build-receipt.json"], "BUILD_RECEIPT_INVALID")
    native = object_json(data["native-receipt.json"], "NATIVE_RECEIPT_INVALID")
    for key, expected in {"embeddedBundle": True, "otaEnabled": False, "nativePatchMarker": "USKOCI_RNR01"}.items():
        require(native.get(key) == expected and receipt.get(key) == expected, "NATIVE_RECEIPT_FACT_MISMATCH")
    apk = data[filename]
    digest = sha(apk)
    require(receipt.get("sourceCommit") == args.head and receipt.get("filename") == filename, "BUILD_RECEIPT_IDENTITY_MISMATCH")
    require(receipt.get("bytes") == len(apk) and receipt.get("sha256") == digest, "BUILD_RECEIPT_APK_BYTES_MISMATCH")
    require(data["SHA256SUMS.txt"].decode("ascii").strip() == digest + "  " + filename, "SHA256SUMS_MISMATCH")
    for key, value in {"package": args.package, "backend": "DEV", "runtimeVersion": args.runtime,
                       "signing": "EXPO_TEMPLATE_ANDROID_DEBUG_KEY", "otaEnabled": False,
                       "embeddedBundle": True, "deviceInstall": "NOT_PERFORMED", "push": "NOT_PROVEN",
                       "replacesExistingPreview": False}.items():
        require(receipt.get(key) == value, "BUILD_RECEIPT_CONFIGURATION_MISMATCH")
    extracted = directory / "apk" / filename
    if extracted.exists():
        require(extracted.stat().st_size == len(apk) and file_hash(extracted) == digest, "EXTRACTED_APK_MISMATCH")
    proof["apk"] = {"filename": filename, "bytes": len(apk), "sha256": digest,
                    "matchesBuildReceiptAndSha256sums": True,
                    "extractedApkCompared": extracted.exists(), "package": args.package, "backend": "DEV",
                    "backendProject": args.project, "runtimeVersion": args.runtime}
    proof["artifactEvidenceSha256"] = {name: sha(raw) for name, raw in data.items() if name != filename}
    badge = data["apk-badging.txt"].decode("utf-8")
    package = re.search(r"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badge, re.M)
    minimum = re.search(r"^sdkVersion:'(\d+)'", badge, re.M)
    target = re.search(r"^targetSdkVersion:'(\d+)'", badge, re.M)
    require(package is not None and package[1] == args.package and minimum is not None and target is not None, "CI_AAPT_RECEIPT_INVALID")
    require(int(minimum[1]) == 24 and int(target[1]) == 36, "CI_ANDROID_SDK_MISMATCH")
    xml = data["AndroidManifest-tree.txt"].decode("utf-8")
    blocks = re.split(r"(?m)^\s*E: ", xml)
    def named_block(name):
        found = [block for block in blocks if block.startswith("meta-data ") and '"' + name + '"' in block]
        require(len(found) == 1, "CI_NATIVE_UPDATE_METADATA_INVALID")
        return found[0]
    require(re.search(r"android:value\([^)]*\)=\(type 0x12\)0x0\b", named_block("expo.modules.updates.ENABLED")), "CI_NATIVE_OTA_NOT_DISABLED")
    require(re.search(r'android:value\([^)]*\)="NEVER"', named_block("expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH")), "CI_NATIVE_OTA_CHECK_NOT_NEVER")
    signature = data["signature.txt"].decode("utf-8")
    certificate = re.findall(r"certificate SHA-256 digest: ([0-9a-f]{64})", signature)
    signers = re.search(r"^Number of signers: (\d+)$", signature, re.M)
    require(signature.startswith("Verifies\n") and "Verified using v2 scheme (APK Signature Scheme v2): true" in signature,
            "CI_APKSIGNER_RECEIPT_INVALID")
    require(signers is not None and int(signers[1]) == 1 and len(certificate) == 1, "CI_SIGNER_COUNT_INVALID")
    require(certificate[0] == reference["apk"]["signature"]["certificateSha256"], "QA47_CERTIFICATE_CONTINUITY_FAILED")
    require("key algorithm: RSA" in signature and "key size (bits): 2048" in signature, "CI_SIGNER_KEY_MISMATCH")
    proof["ciAndroidEvidence"] = {
        "scope": "aapt/apksigner receipts in GitHub-digest-verified artifact; APK bytes independently matched to the build receipt",
        "localAaptVerificationPerformed": False, "localApksignerVerificationPerformed": False,
        "localToolsAvailable": {name: shutil.which(name) is not None for name in ["aapt", "apksigner"]},
        "package": package[1], "versionCode": int(package[2]), "versionName": package[3],
        "minSdk": int(minimum[1]), "targetSdk": int(target[1]), "otaEnabled": False, "otaCheckAutomatically": "NEVER",
        "signatureReceiptVerified": True, "schemeV2": True, "signers": 1,
        "certificateSha256": certificate[0], "sameCertificateAsQa47": True, "publicKeyType": "RSA", "publicKeyBits": 2048}
    with zipfile.ZipFile(io.BytesIO(apk)) as packaged:
        members = bounded_members(packaged, 512 * MIB, 128 * MIB)
        abis = sorted({name.split("/")[1] for name in members if name.startswith("lib/") and name.endswith(".so")})
        dex = [name for name in members if re.fullmatch(r"classes\d*\.dex", name)]
        require(abis == ["arm64-v8a"] and len(dex) == native.get("dexFiles") == receipt.get("dexFiles"), "APK_NATIVE_LAYOUT_MISMATCH")
        require(len(dex) == reference["apk"]["dexFiles"], "QA47_DEX_COUNT_CHANGED")
        require(native.get("abis") == abis and receipt.get("abis") == abis, "CI_ABI_RECEIPT_MISMATCH")
        require(any(b"USKOCI_RNR01" in packaged.read(name) for name in dex), "APK_NATIVE_PATCH_MARKER_MISSING")
        config_raw = packaged.read("assets/app.config")
        config = object_json(config_raw, "EMBEDDED_CONFIG_INVALID")
        manifest_raw = packaged.read("assets/app.manifest")
        manifest = object_json(manifest_raw, "EMBEDDED_MANIFEST_INVALID")
        require(isinstance(manifest.get("assets"), list), "EMBEDDED_ASSET_INVENTORY_INVALID")
        build = config.get("extra", {}).get("uskociBuild", {})
        updates = config.get("updates", {})
        require(build.get("sourceCommit") == args.head and build.get("backendTarget") == "canonical", "EMBEDDED_BUILD_IDENTITY_MISMATCH")
        require(config.get("android", {}).get("package") == args.package and config.get("runtimeVersion") == args.runtime, "EMBEDDED_RUNTIME_MISMATCH")
        require(updates.get("enabled") is False and updates.get("checkAutomatically") == "NEVER" and updates.get("useEmbeddedUpdate") is True,
                "EMBEDDED_UPDATE_ISOLATION_FAILED")
        bundle = packaged.read("assets/index.android.bundle")
        require(0 < len(bundle) <= 32 * MIB, "EMBEDDED_BUNDLE_SIZE_INVALID")
        disk_bundle = directory / "apk" / "index.android.bundle"
        if disk_bundle.exists():
            require(disk_bundle.stat().st_size == len(bundle) and file_hash(disk_bundle) == sha(bundle), "EXTRACTED_BUNDLE_MISMATCH")
    proof["embedded"] = {
        "sourceCommit": build["sourceCommit"], "sourceCommitLocation": "assets/app.config -> extra.uskociBuild.sourceCommit",
        "sourceDirtyFlag": build.get("sourceDirty"), "backendTarget": build["backendTarget"],
        "package": args.package, "runtimeVersion": args.runtime, "otaEnabled": False, "otaCheckAutomatically": "NEVER", "useEmbeddedUpdate": True,
        "googleServicesFilePresent": bool(config.get("android", {}).get("googleServicesFile")),
        "configSha256": sha(config_raw), "configBytes": len(config_raw),
        "manifestSha256": sha(manifest_raw), "manifestBytes": len(manifest_raw), "manifestAssets": len(manifest["assets"]),
        "manifestContainsSourceCommit": args.head.encode() in manifest_raw,
        "bundleBytes": len(bundle), "bundleSha256": sha(bundle),
        "bundleSource": "assets/index.android.bundle from the exact APK entry in the verified artifact ZIP",
        "standaloneBundleInArtifact": "index.android.bundle" in names, "extractedBundleCompared": disk_bundle.exists(),
        "abis": abis, "dexFiles": len(dex), "nativePatchMarkerPresent": True}
    with tempfile.TemporaryDirectory(prefix="qa-apk-verify-", dir=args.output.parent) as temporary:
        proof["boundedPackagedAssetScan"] = hermes_proof(args.hermesc.resolve(), bundle, args.expect_marker, args.head, args.project, Path(temporary))
    # This project's SHA is generated into Expo's app.config asset and read from
    # the native Constants module at runtime. There is no compile-time SHA
    # literal contract in the JavaScript source. Requiring that unrelated Hermes
    # literal would reject a correctly built app. The config, CI run, build
    # receipt, GitHub ZIP digest and contained APK/bundle bytes remain mandatory.
    proof["sourceIdentity"] = {
        "contract": "EMBEDDED_APP_CONFIG_AND_SAME_CI_BUILD",
        "status": "CONFIRMED",
        "sourceCommit": args.head,
        "embeddedConfigSourceCommitMatched": True,
        "ciSourceIdentityCheckSucceeded": True,
        "githubRunAndArtifactSourceMatched": True,
        "buildReceiptAndApkBytesMatched": True,
        "hermesBundleReadFromSameApk": True,
        "hermesSourceShaLiteralRequired": False,
        "hermesSourceShaLiteralObserved": proof["boundedPackagedAssetScan"]["sourceShaLiteralPresent"],
        "reproducibleRebuildPerformed": False,
    }
    proof["status"] = "LOCAL_ARTIFACT_BYTES_AND_CI_RECEIPTS_CONFIRMED_NOT_NATIVE_E2E"


def main():
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    root = here.parents[2]
    parser.add_argument("--directory", type=Path, default=here / "qa58",
                        help="Directory with official checks.zip, apk.zip and github-metadata.json")
    parser.add_argument("--metadata", type=Path, help="GitHub API run/jobs/artifacts JSON envelope")
    parser.add_argument("--checks", type=Path, help="Official checks ZIP; default DIRECTORY/checks.zip")
    parser.add_argument("--apk", type=Path, help="Official APK artifact ZIP; default DIRECTORY/apk.zip")
    parser.add_argument("--reference", type=Path, default=here / "qa47-readback-20261107.json",
                        help="QA47 independent proof pinning the known debug certificate and DEX count")
    parser.add_argument("--hermesc", type=Path, default=root / "node_modules/hermes-compiler/hermesc/linux64-bin/hermesc")
    parser.add_argument("--head", default=HEAD)
    parser.add_argument("--run", type=int, default=58)
    parser.add_argument("--run-id", type=int, default=RUN_ID)
    parser.add_argument("--branch", default="work/uskoci-cist-proizvod-20261104")
    parser.add_argument("--tests", type=int, default=963)
    parser.add_argument("--migrations", type=int, default=221)
    parser.add_argument("--migration-tests", type=int, default=39)
    parser.add_argument("--package", default=PACKAGE)
    parser.add_argument("--project", default=PROJECT)
    parser.add_argument("--runtime", default=RUNTIME)
    parser.add_argument("--expect-marker", choices=["present", "absent"], default="present")
    parser.add_argument("--output", type=Path, default=here / "qa58-local-verifier-20261108.json")
    args = parser.parse_args()
    require(re.fullmatch(r"[0-9a-f]{40}", args.head) is not None, "EXPECTED_HEAD_INVALID")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    proof = {"schema": "USKOCI_QA_APK_LOCAL_VERIFIER_V2", "observedAtUtc": datetime.now(timezone.utc).isoformat(),
             "verifier": file_proof(Path(__file__).resolve()), "status": "INCOMPLETE",
             "boundaries": ["No network, installation, emulator or device execution was performed.",
                            "CI aapt/apksigner receipts are not represented as local signature verification.",
                            "Source identity is pinned by assets/app.config and the same GitHub CI run/artifact; this build contract does not require a SHA literal inside Hermes bytecode.",
                            "The source identity checks do not constitute a reproducible rebuild of every bundled module.",
                            "The Hermes string scan does not inspect every native binary or establish server key revocation.",
                            "No production backend, production signing, Google Play AAB or public-release acceptance is claimed."]}
    code = 0
    try:
        verify(args, proof)
    except Rejected as error:
        proof.update({"status": "FAILED", "failureCode": str(error)})
        code = 1
    except Exception as error:
        # Do not echo provider text, decoded assets, secrets or arbitrary inputs.
        proof.update({"status": "INCOMPLETE", "failureCode": "VERIFIER_INPUT_OR_TOOL_UNAVAILABLE",
                      "exceptionType": type(error).__name__})
        code = 2
    args.output.write_text(json.dumps(proof, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"status": proof["status"], "failureCode": proof.get("failureCode"),
                      "proof": file_proof(args.output)}, ensure_ascii=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
