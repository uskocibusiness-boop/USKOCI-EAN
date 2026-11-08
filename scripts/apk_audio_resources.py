"""Verify logical Android raw sounds through AAPT2, including shortened paths.

Only exact expected WAV bytes pass. Optimized paths are read from the resource
table of the SAME immutable APK snapshot; arbitrary ZIP hash matches do not
establish a usable Android resource. No device execution or playback is claimed.
"""
from __future__ import annotations

import hashlib
import io
from pathlib import Path
import re
import resource
import subprocess
import tempfile
import zipfile

MIB = 1024 * 1024
MAX_APK = 128 * MIB
MAX_DUMP = 32 * MIB


class AudioResourceError(ValueError):
    """Fixed failure code only; raw resource strings are never error messages."""


def require(condition, code):
    if not condition:
        raise AudioResourceError(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def expected_names(filenames):
    try:
        names = list(filenames)
    except TypeError as error:
        raise AudioResourceError("AUDIO_EXPECTED_NAMES_INVALID") from error
    require(0 < len(names) <= 16, "AUDIO_EXPECTED_NAMES_INVALID")
    require(all(isinstance(name, str) and re.fullmatch(r"[a-z][a-z0-9_]{0,127}\.wav", name) for name in names),
            "AUDIO_EXPECTED_NAMES_INVALID")
    require(len(set(names)) == len(names), "AUDIO_EXPECTED_NAMES_INVALID")
    return {"raw/" + name[:-4]: name for name in names}


def safe_resource_path(path):
    return (isinstance(path, str) and len(path) <= 512
            and re.fullmatch(r"res/[A-Za-z0-9_./-]+\.wav", path) is not None
            and all(part not in ("", ".", "..") for part in path.split("/")))


def parse_resource_dump(text, expected_package, expected_filenames):
    """Return one default direct-file mapping per logical raw name.

    Reject duplicate logical names/IDs/paths, aliases and configuration overrides.
    The parser accepts the actual AAPT2 2.20-13700139 resources dump format.
    Other resources are traversed only to establish entry/package boundaries.
    """
    wanted = expected_names(expected_filenames)
    require(isinstance(expected_package, str) and len(expected_package) <= 255
            and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+", expected_package),
            "AUDIO_EXPECTED_PACKAGE_INVALID")
    require(isinstance(text, str) and len(text) <= MAX_DUMP, "AUDIO_DUMP_SIZE_LIMIT")
    try:
        require(len(text.encode("utf-8")) <= MAX_DUMP, "AUDIO_DUMP_SIZE_LIMIT")
    except UnicodeError as error:
        raise AudioResourceError("AUDIO_DUMP_ENCODING_INVALID") from error
    lines = text.splitlines()
    require(0 < len(lines) <= 250000 and lines[0] == "Binary APK", "AUDIO_DUMP_HEADER_INVALID")
    require(all(len(line) <= 16384 for line in lines), "AUDIO_DUMP_LINE_LIMIT")
    package = package_id = resource_type = type_id = None
    package_count = 0
    selected = None
    values = []
    found = {}
    ids, paths = set(), set()
    all_ids = set()
    type_names, type_ids = set(), set()

    def finish():
        nonlocal selected, values
        if selected is None:
            return
        logical, identifier = selected
        require(len(values) == 1, "AUDIO_RESOURCE_VALUE_COUNT_INVALID")
        value = re.fullmatch(r" {6}\(\) \(file\) (\S+)", values[0])
        require(value is not None, "AUDIO_RESOURCE_NOT_DEFAULT_DIRECT_FILE")
        path = value[1]
        require(safe_resource_path(path), "AUDIO_RESOURCE_PATH_INVALID")
        require(path not in paths, "AUDIO_RESOURCE_PATH_DUPLICATE")
        require(identifier not in ids, "AUDIO_RESOURCE_ID_DUPLICATE")
        paths.add(path)
        ids.add(identifier)
        found[wanted[logical]] = {"logicalName": logical, "resourceId": identifier, "apkPath": path}
        selected, values = None, []

    for line in lines[1:]:
        # A malformed boundary must not hide a second target declaration.
        if line.lstrip().startswith("resource "):
            require(line.startswith("    resource ") and not line.startswith("     "), "AUDIO_DUMP_STRUCTURE_INVALID")
        if line.lstrip().startswith("type "):
            require(line.startswith("  type ") and not line.startswith("   "), "AUDIO_DUMP_STRUCTURE_INVALID")
        if line.lstrip().startswith("Package "):
            require(line.startswith("Package "), "AUDIO_DUMP_STRUCTURE_INVALID")
        if line.startswith("Package "):
            finish()
            match = re.fullmatch(r"Package name=([A-Za-z0-9_.]+) id=([0-9a-fA-F]{2})", line)
            require(match is not None, "AUDIO_PACKAGE_HEADER_INVALID")
            package, package_id = match[1], match[2].lower()
            resource_type = type_id = None
            if package == expected_package:
                package_count += 1
                require(package_count == 1, "AUDIO_PACKAGE_DUPLICATE")
            continue
        if line.startswith("  type "):
            finish()
            match = re.fullmatch(r"  type ([A-Za-z0-9_]+) id=([0-9a-fA-F]{2}) entryCount=(\d+)", line)
            require(match is not None, "AUDIO_TYPE_HEADER_INVALID")
            resource_type, type_id = match[1], match[2].lower()
            require(type_id != "00", "AUDIO_RESOURCE_TYPE_ID_INVALID")
            require(package is not None, "AUDIO_TYPE_WITHOUT_PACKAGE")
            # A type has one identity inside a package. A second raw type ID
            # would make the logical name-to-ID interpretation ambiguous.
            require((package, resource_type) not in type_names, "AUDIO_TYPE_NAME_DUPLICATE")
            require((package, type_id) not in type_ids, "AUDIO_TYPE_ID_DUPLICATE")
            type_names.add((package, resource_type))
            type_ids.add((package, type_id))
            continue
        if line.startswith("    resource "):
            finish()
            match = re.fullmatch(r"    resource (0x[0-9a-fA-F]{8}) (\S+)(.*)", line)
            require(match is not None, "AUDIO_RESOURCE_HEADER_INVALID")
            logical = match[2]
            identifier = match[1].lower()
            require(identifier not in all_ids, "AUDIO_RESOURCE_ID_DUPLICATE")
            all_ids.add(identifier)
            if logical in wanted:
                require(package == expected_package and package_id == "7f", "AUDIO_RESOURCE_PACKAGE_MISMATCH")
                require(resource_type == "raw", "AUDIO_RESOURCE_TYPE_MISMATCH")
                require(identifier[2:4] == package_id and identifier[4:6] == type_id, "AUDIO_RESOURCE_ID_SCOPE_MISMATCH")
                require(match[3] in ("", " PUBLIC", " _PRIVATE_"), "AUDIO_RESOURCE_FLAGS_UNSUPPORTED")
                require(wanted[logical] not in found, "AUDIO_RESOURCE_NAME_DUPLICATE")
                selected = (logical, identifier)
            continue
        if selected is not None and line.strip():
            values.append(line)
            require(len(values) <= 1, "AUDIO_RESOURCE_VALUE_COUNT_INVALID")
    finish()
    require(package_count == 1 and set(found) == set(wanted.values()), "AUDIO_RESOURCE_SET_MISMATCH")
    return found


def bounded_tool(command, limit, timeout, directory, version_may_use_stderr=False):
    def limits():
        resource.setrlimit(resource.RLIMIT_FSIZE, (limit, limit))
    try:
        with tempfile.TemporaryFile(dir=directory) as output, tempfile.TemporaryFile(dir=directory) as errors:
            result = subprocess.run(command, stdout=output, stderr=errors, timeout=timeout, check=False, preexec_fn=limits)
            require(result.returncode == 0, "AUDIO_AAPT2_FAILED")
            require(output.tell() <= limit and errors.tell() <= limit, "AUDIO_AAPT2_OUTPUT_LIMIT")
            output.seek(0)
            stdout = output.read(limit + 1)
            # Official AAPT2 2.20 prints `version` on stderr with exit code 0.
            # Resource dumps must still come from stdout only.
            if version_may_use_stderr and not stdout:
                errors.seek(0)
                return errors.read(limit + 1)
            return stdout
    except subprocess.TimeoutExpired as error:
        raise AudioResourceError("AUDIO_AAPT2_TIMEOUT") from error
    except OSError as error:
        raise AudioResourceError("AUDIO_AAPT2_UNAVAILABLE") from error


def preflight_apk(apk):
    """Inspect central-directory sizes before any native tool can inflate data."""
    try:
        with zipfile.ZipFile(io.BytesIO(apk)) as packaged:
            infos = packaged.infolist()
            names = [info.filename for info in infos]
            require(len(names) <= 5000 and len(names) == len(set(names)), "AUDIO_APK_ENTRY_COUNT_OR_DUPLICATE")
            require(sum(info.file_size for info in infos) <= 512 * MIB, "AUDIO_APK_TOTAL_SIZE_LIMIT")
            for info in infos:
                require(not info.flag_bits & 1 and 0 <= info.file_size <= MAX_APK, "AUDIO_APK_MEMBER_INVALID")
                require(not info.filename.startswith("/") and ".." not in info.filename.split("/") and "\\" not in info.filename,
                        "AUDIO_APK_UNSAFE_PATH")
            require("resources.arsc" in names and 0 < packaged.getinfo("resources.arsc").file_size <= 32 * MIB,
                    "AUDIO_APK_RESOURCE_TABLE_SIZE_LIMIT")
            require("AndroidManifest.xml" in names and 0 < packaged.getinfo("AndroidManifest.xml").file_size <= 4 * MIB,
                    "AUDIO_APK_MANIFEST_SIZE_LIMIT")
    except zipfile.BadZipFile as error:
        raise AudioResourceError("AUDIO_APK_OR_DUMP_INVALID") from error


def verify_apk_audio(apk_path, aapt2_path, expected_package, expected_sources):
    """Resolve logical resources using actual AAPT2 and compare exact WAV bytes.

    Result separates deterministic resource entries from tool/dump observations.
    CI can persist resources in both receipts; an offline verifier recomputes them.
    """
    require(isinstance(expected_sources, dict), "AUDIO_EXPECTED_SOURCES_INVALID")
    expected_names(expected_sources)
    require(all(isinstance(data, bytes) and 0 < len(data) <= 64 * 1024 for data in expected_sources.values()),
            "AUDIO_SOURCE_SIZE_LIMIT")
    apk_path, aapt2_path = Path(apk_path), Path(aapt2_path)
    require(apk_path.is_file() and 0 < apk_path.stat().st_size <= MAX_APK, "AUDIO_APK_SIZE_LIMIT")
    require(aapt2_path.is_file() and 0 < aapt2_path.stat().st_size <= 32 * MIB, "AUDIO_AAPT2_BINARY_INVALID")
    with apk_path.open("rb") as stream:
        apk = stream.read(MAX_APK + 1)
    require(0 < len(apk) <= MAX_APK, "AUDIO_APK_SIZE_LIMIT")
    preflight_apk(apk)
    tool_hash = sha(aapt2_path.read_bytes())
    try:
        with tempfile.TemporaryDirectory(prefix="uskoci-apk-audio-") as directory:
            snapshot = Path(directory) / "snapshot.apk"
            snapshot.write_bytes(apk)
            version_bytes = bounded_tool([str(aapt2_path.resolve()), "version"], 4096, 5, directory, version_may_use_stderr=True)
            version = version_bytes.decode("utf-8").strip()
            require(re.fullmatch(r"Android Asset Packaging Tool \(aapt\) [A-Za-z0-9 ._-]+", version), "AUDIO_AAPT2_VERSION_INVALID")
            dump = bounded_tool([str(aapt2_path.resolve()), "dump", "resources", str(snapshot)], MAX_DUMP, 30, directory)
            require(sha(aapt2_path.read_bytes()) == tool_hash, "AUDIO_AAPT2_BINARY_CHANGED")
            mappings = parse_resource_dump(dump.decode("utf-8"), expected_package, expected_sources)
            with zipfile.ZipFile(snapshot) as packaged:
                names = packaged.namelist()
                for filename, mapping in mappings.items():
                    entry = mapping["apkPath"]
                    require(entry in names, "AUDIO_APK_RESOURCE_MISSING")
                    require(packaged.getinfo(entry).file_size == len(expected_sources[filename]), "AUDIO_APK_RESOURCE_SIZE_MISMATCH")
                    data = packaged.read(entry)
                    require(data == expected_sources[filename], "AUDIO_APK_RESOURCE_BYTES_MISMATCH")
                    mapping.update(bytes=len(data), sha256=sha(data))
    except (UnicodeError, zipfile.BadZipFile, KeyError) as error:
        raise AudioResourceError("AUDIO_APK_OR_DUMP_INVALID") from error
    return {"package": expected_package, "apk": {"bytes": len(apk), "sha256": sha(apk)}, "resources": mappings,
            "aapt2": {"version": version, "sha256": tool_hash},
            "resourceDump": {"bytes": len(dump), "sha256": sha(dump)}}
