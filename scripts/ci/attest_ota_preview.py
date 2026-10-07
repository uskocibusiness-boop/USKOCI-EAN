"""Attest the compiled Preview APK, not merely its source Expo configuration.

Uses Android SDK apkanalyzer/apksigner. Never reads or emits signing private keys.
A passing receipt proves the APK boundary only, never a physical-phone OTA update.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Callable
import xml.etree.ElementTree as ET
import zipfile

ANDROID = "{http://schemas.android.com/apk/res/android}"
PROJECT = "1e6cc490-9851-4741-9226-128612122db6"
RUNTIME = "uskoci-v1-preview-r1"
URL = f"https://u.expo.dev/{PROJECT}"
PREFIX = "expo.modules.updates."


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise ValueError(reason)


def _manifest_fields(xml: str) -> tuple[dict[str, str], dict[str, str]]:
    """Read only the manifest fields needed by the attestor.

    apkanalyzer normally emits XML, but some SDK versions print raw JSON quotes
    inside android:value attributes. That text is useful but not strict XML, so
    keep strict parsing first and use a narrow tag/attribute fallback only when
    ElementTree rejects the analyzer output.
    """
    try:
        root = ET.fromstring(xml)
        app = root.find("application")
        require(app is not None, "APK_APPLICATION_MISSING")
        manifest = {
            "package": root.attrib.get("package", ""),
            "versionName": root.attrib.get(ANDROID + "versionName", ""),
            "versionCode": root.attrib.get(ANDROID + "versionCode", ""),
            "debuggable": app.attrib.get(ANDROID + "debuggable", "false"),
        }
        metadata = {
            node.attrib.get(ANDROID + "name", ""): node.attrib.get(ANDROID + "value", "")
            for node in app.findall("meta-data")
        }
        return manifest, metadata
    except ET.ParseError:
        manifest_tag = re.search(r"<manifest\b.*?>", xml, re.DOTALL)
        application_tag = re.search(r"<application\b.*?>", xml, re.DOTALL)
        require(manifest_tag is not None, "APK_MANIFEST_MISSING")
        require(application_tag is not None, "APK_APPLICATION_MISSING")

        def attr(tag: str, name: str, default: str = "") -> str:
            match = re.search(rf'(?:android:)?{re.escape(name)}="([^"]*)"', tag)
            return html.unescape(match.group(1)) if match else default

        manifest = {
            "package": attr(manifest_tag.group(0), "package"),
            "versionName": attr(manifest_tag.group(0), "versionName"),
            "versionCode": attr(manifest_tag.group(0), "versionCode"),
            "debuggable": attr(application_tag.group(0), "debuggable", "false"),
        }
        metadata: dict[str, str] = {}
        for tag_match in re.finditer(r"<meta-data\b.*?/>", xml, re.DOTALL):
            tag = tag_match.group(0)
            name_match = re.search(r'android:name="([^"]+)"', tag)
            if not name_match:
                continue
            # Expo's generated meta-data uses android:value as the final
            # attribute. Greedy capture is intentional so raw JSON quotes in
            # the value do not truncate the channel header.
            value_match = re.search(r'android:value="(.*)"\s*/>', tag, re.DOTALL)
            metadata[html.unescape(name_match.group(1))] = html.unescape(value_match.group(1)) if value_match else ""
        return manifest, metadata


def validate_manifest(xml: str, read_string: Callable[[str], str]) -> dict:
    manifest, metadata = _manifest_fields(xml)
    package = manifest["package"]
    require(package == "rs.uskoci.preview", "APK_NOT_PREVIEW_PACKAGE")
    require(manifest["debuggable"] == "false", "APK_DEBUGGABLE")
    require(metadata.get(PREFIX + "ENABLED") == "true", "APK_UPDATES_DISABLED")
    runtime = metadata.get(PREFIX + "EXPO_RUNTIME_VERSION", "") or ""
    if runtime.startswith("@string/"):
        runtime = read_string(runtime[len("@string/"):]).strip()
    elif runtime.startswith("@ref/"):
        # Newer apkanalyzer versions may render the compiled binary XML value
        # as a numeric resource reference (for example @ref/0x7f1300b9)
        # instead of preserving @string/expo_runtime_version. Resolve the
        # canonical Expo resource from the app package and validate its value.
        runtime = read_string("expo_runtime_version").strip()
    # apkanalyzer may quote string resource values.
    if runtime.startswith('"') and runtime.endswith('"'):
        runtime = json.loads(runtime)
    require(runtime == RUNTIME, f"APK_RUNTIME_MISMATCH: expected={RUNTIME!r} actual={runtime!r}")
    require(metadata.get(PREFIX + "EXPO_UPDATE_URL") == URL, "APK_UPDATE_URL_MISMATCH")
    headers = json.loads(metadata.get(PREFIX + "UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY") or "{}")
    require(headers.get("expo-channel-name") == "preview", "APK_CHANNEL_MISMATCH")
    require(metadata.get(PREFIX + "EXPO_UPDATES_CHECK_ON_LAUNCH") == "ALWAYS", "APK_NOT_ON_LOAD")
    require(metadata.get(PREFIX + "EXPO_UPDATES_LAUNCH_WAIT_MS") == "0", "APK_FALLBACK_NOT_ZERO")
    require(metadata.get(PREFIX + "DISABLE_ANTI_BRICKING_MEASURES", "false") == "false", "APK_ANTI_BRICKING_DISABLED")
    require(manifest["versionCode"].isdigit(), "APK_VERSION_CODE_MISSING")
    return {"androidPackage": package, "version": manifest["versionName"],
            "versionCode": int(manifest["versionCode"]), "runtimeVersion": runtime,
            "channel": headers["expo-channel-name"], "projectId": PROJECT, "updateUrl": URL,
            "updatesEnabled": True, "checkOnLaunch": "ALWAYS", "fallbackToCacheTimeout": 0,
            "debuggable": False}


def run(*args: str) -> str:
    return subprocess.check_output(args, text=True, stderr=subprocess.PIPE).strip()


def _version_key(path: Path) -> tuple:
    """Numeric order of an SDK directory such as build-tools/36.0.0 (a plain string sort puts 9.0.0 after 36.0.0)."""
    return tuple(int(part) if part.isdigit() else -1 for part in re.split(r"[.\-]", path.parent.name))


def sdk_tool(name: str) -> str:
    sdk = Path(os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or "/usr/local/lib/android/sdk")
    build_tools = sorted(sdk.glob(f"build-tools/*/{name}"), key=_version_key)
    if build_tools:
        # The SDK's own newest build-tools copy wins over anything on PATH (a distribution package of the same
        # name can print a different format or verify differently).
        return str(build_tools[-1])
    found = shutil.which(name)
    if found:
        return found
    candidates = list(sdk.glob(f"cmdline-tools/*/bin/{name}"))
    require(bool(candidates), f"ANDROID_SDK_TOOL_MISSING:{name}")
    return str(sorted(candidates)[-1])


def apk_signing_fingerprints(apk: Path) -> list:
    tool = sdk_tool("apksigner")
    result = subprocess.run([tool, "verify", "--print-certs", "-v", str(apk)], capture_output=True, text=True)
    combined = (result.stdout or "") + "\n" + (result.stderr or "")
    # build-tools <= 36 print "Signer #1 certificate SHA-256 digest: <hex>"; build-tools 37 prints
    # "V2 Signer: certificate SHA-256 digest: <hex>" (one line per scheme). Public-key digests are never matched.
    found = re.findall(r"(?:Signer #\d+|V\d+(?:\.\d+)? Signer:) certificate SHA-256 digest: ([a-fA-F0-9]{64})", combined)
    fingerprints = list(dict.fromkeys(value.lower() for value in found))
    if not fingerprints:
        # Diagnostic only: the tool path, its exit code and the first public lines (certificate digests are public, keys never appear).
        head = " | ".join(line.strip() for line in combined.strip().splitlines()[:4])[:300]
        print(f"apksigner diagnostic: tool={tool} exit={result.returncode} output={head}", file=sys.stderr)
    require(result.returncode == 0, "APK_SIGNATURE_DOES_NOT_VERIFY")
    require(bool(fingerprints), "APK_SIGNING_FINGERPRINT_MISSING")
    return fingerprints


def attest(apk: Path, target: str) -> dict:
    analyzer = sdk_tool("apkanalyzer")
    manifest = run(analyzer, "manifest", "print", str(apk))
    identity = validate_manifest(manifest, lambda name: run(analyzer, "resources", "value", "--config", "default", "--name", name, "--type", "string", "--package", "rs.uskoci.preview", str(apk)))
    require(target in ("phone", "emulator"), "APK_TARGET_UNKNOWN")
    expected_abi = "arm64-v8a" if target == "phone" else "x86_64"
    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        abis = sorted({name.split("/")[1] for name in names if name.startswith("lib/") and name.endswith(".so")})
        require(abis == [expected_abi], "APK_ABI_MISMATCH")
        require(any(b"expo/modules/updates/" in archive.read(name) for name in names if re.fullmatch(r"classes\d*\.dex", name)), "APK_UPDATES_NATIVE_CODE_MISSING")
    fingerprints = apk_signing_fingerprints(apk)
    digest = hashlib.sha256(apk.read_bytes()).hexdigest()
    config = json.loads(Path("app.json").read_text(encoding="utf-8"))["expo"]
    require(identity["version"] == config["version"], "APK_VERSION_DRIFT")
    require(identity["versionCode"] == config["android"]["versionCode"], "APK_VERSION_CODE_DRIFT")
    source_sha = run("git", "rev-parse", "HEAD")
    require(source_sha == os.environ.get("GITHUB_SHA", source_sha), "APK_SOURCE_SHA_DRIFT")
    flags = {key: value for key, value in sorted(os.environ.items()) if key.startswith("EXPO_PUBLIC_") and "KEY" not in key and "TOKEN" not in key and "SECRET" not in key}
    return {"status": "APK_ATTESTED_NOT_PHONE_VERIFIED", **identity, "sourceSha": source_sha,
            "nativeBaselineSha": source_sha, "sourceTree": run("git", "rev-parse", "HEAD^{tree}"),
            "githubRunId": os.environ.get("GITHUB_RUN_ID"), "githubRunAttempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
            "githubRunUrl": f"https://github.com/{os.environ.get('GITHUB_REPOSITORY', 'Uskoci1/USKOCI-CLEAN')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}",
            "apkFile": apk.name, "apkSizeBytes": apk.stat().st_size, "apkSha256": digest,
            "architectures": abis, "signingCertificateSha256": [value.lower() for value in fingerprints],
            "publicBuildFlags": flags, "physicalPhone": "NOT_TESTED", "otaPreview": "NOT_VERIFIED",
            "production": "NOT_BUILT_OR_DEPLOYED"}


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 3, "USAGE: attest_ota_preview.py APK RECEIPT_JSON")
        receipt = attest(Path(sys.argv[1]), os.environ.get("USKOCI_ANDROID_BUILD_TARGET", "phone"))
        output = json.dumps(receipt, ensure_ascii=False, indent=2) + "\n"
        Path(sys.argv[2]).write_text(output, encoding="utf-8")
        print(output)
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError, zipfile.BadZipFile, ET.ParseError) as error:
        failure = {
            "status": "APK_ATTESTATION_FAILED",
            "error": str(error),
            "sourceSha": os.environ.get("GITHUB_SHA"),
            "githubRunId": os.environ.get("GITHUB_RUN_ID"),
            "physicalPhone": "NOT_TESTED",
            "otaPreview": "NOT_VERIFIED",
            "production": "NOT_BUILT_OR_DEPLOYED",
        }
        if len(sys.argv) >= 3:
            Path(sys.argv[2]).write_text(json.dumps(failure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"OTA_APK_ATTESTATION_FAILED: {error}", file=sys.stderr)
        sys.exit(1)
