"""Bounded parser/subprocess fixtures; real AAPT2 reproduction is a separate proof."""
import io
from pathlib import Path
import sys
import struct
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

from apk_audio_resources import AudioResourceError, bounded_tool, parse_resource_dump, verify_apk_audio

PACKAGE = "rs.uskoci.preview.qa"
# Captured from official AAPT2 8.12.0-13700139 after optimizing the project's
# three actual originals with --shorten-resource-paths on 2026-11-08.
DUMP = """Binary APK
Package name=rs.uskoci.preview.qa id=7f
  type raw id=01 entryCount=3
    resource 0x7f010000 raw/uskoci_confirm_v1
      () (file) res/F2.wav
    resource 0x7f010001 raw/uskoci_message_v1
      () (file) res/ES.wav
    resource 0x7f010002 raw/uskoci_opportunity_v1
      () (file) res/fp.wav
"""
NAMES = ("uskoci_confirm_v1.wav", "uskoci_message_v1.wav", "uskoci_opportunity_v1.wav")


class ResourceParserTests(unittest.TestCase):
    def parse(self, dump=DUMP):
        return parse_resource_dump(dump, PACKAGE, NAMES)

    def rejected(self, code, dump):
        with self.assertRaisesRegex(AudioResourceError, "^" + code + "$"):
            self.parse(dump)

    def test_observed_shortened_and_original_paths_resolve_by_logical_name(self):
        result = self.parse()
        self.assertEqual(result[NAMES[1]], {"logicalName": "raw/uskoci_message_v1", "resourceId": "0x7f010001", "apkPath": "res/ES.wav"})
        original = DUMP.replace("res/F2.wav", "res/raw/" + NAMES[0]).replace("res/ES.wav", "res/raw/" + NAMES[1]).replace("res/fp.wav", "res/raw/" + NAMES[2])
        self.assertEqual(self.parse(original)[NAMES[1]]["apkPath"], "res/raw/" + NAMES[1])

    def test_missing_wrong_package_or_duplicate_package_rejected(self):
        self.rejected("AUDIO_RESOURCE_SET_MISMATCH", DUMP[:DUMP.index("    resource 0x7f010002")])
        self.rejected("AUDIO_RESOURCE_PACKAGE_MISMATCH", DUMP.replace(PACKAGE, "rs.other.qa"))
        self.rejected("AUDIO_PACKAGE_DUPLICATE", DUMP + "Package name=" + PACKAGE + " id=7f\n")

    def test_duplicate_logical_name_id_and_path_rejected(self):
        self.rejected("AUDIO_RESOURCE_NAME_DUPLICATE", DUMP + "    resource 0x7f010003 raw/uskoci_message_v1\n      () (file) res/other.wav\n")
        self.rejected("AUDIO_RESOURCE_ID_DUPLICATE", DUMP.replace("0x7f010002", "0x7f010001"))
        self.rejected("AUDIO_RESOURCE_ID_DUPLICATE", DUMP + "    resource 0x7f010001 raw/unrelated\n      () (file) res/other.wav\n")
        self.rejected("AUDIO_RESOURCE_PATH_DUPLICATE", DUMP.replace("res/fp.wav", "res/ES.wav"))

    def test_alias_and_config_overrides_are_not_default_direct_files(self):
        self.rejected("AUDIO_RESOURCE_NOT_DEFAULT_DIRECT_FILE", DUMP.replace("() (file) res/ES.wav", "() @raw/uskoci_confirm_v1"))
        self.rejected("AUDIO_RESOURCE_NOT_DEFAULT_DIRECT_FILE", DUMP.replace("() (file) res/ES.wav", "(v26) (file) res/ES.wav"))
        self.rejected("AUDIO_RESOURCE_VALUE_COUNT_INVALID", DUMP.replace("() (file) res/ES.wav", "() (file) res/ES.wav\n      (v26) (file) res/other.wav"))

    def test_paths_cannot_escape_or_ambiguously_name_a_zip_member(self):
        for path in ["../other.wav", "/res/other.wav", "res/../other.wav", "res/./other.wav", "res//other.wav", "res\\other.wav", "res/other.wav%00", "res/other.txt"]:
            with self.subTest(path=path):
                self.rejected("AUDIO_RESOURCE_PATH_INVALID", DUMP.replace("res/ES.wav", path))

    def test_type_package_and_resource_id_scopes_must_agree(self):
        self.rejected("AUDIO_RESOURCE_ID_SCOPE_MISMATCH", DUMP.replace("0x7f010001", "0x7e010001"))
        self.rejected("AUDIO_RESOURCE_ID_SCOPE_MISMATCH", DUMP.replace("0x7f010001", "0x7f020001"))
        self.rejected("AUDIO_RESOURCE_TYPE_MISMATCH", DUMP.replace("type raw", "type drawable"))
        self.rejected("AUDIO_RESOURCE_TYPE_ID_INVALID", DUMP.replace("type raw id=01", "type raw id=00").replace("0x7f01", "0x7f00"))

    def test_one_package_cannot_assign_raw_two_type_ids_or_reuse_its_type_id(self):
        split = DUMP.replace("    resource 0x7f010001", "  type raw id=02 entryCount=2\n    resource 0x7f020001").replace("0x7f010002", "0x7f020002")
        self.rejected("AUDIO_TYPE_NAME_DUPLICATE", split)
        self.rejected("AUDIO_TYPE_ID_DUPLICATE", DUMP + "  type drawable id=01 entryCount=0\n")

    def test_malformed_boundary_cannot_hide_a_duplicate_declaration(self):
        self.rejected("AUDIO_DUMP_STRUCTURE_INVALID", DUMP + "     resource 0x7f010003 raw/uskoci_message_v1\n")
        self.rejected("AUDIO_DUMP_STRUCTURE_INVALID", DUMP + " Package name=" + PACKAGE + " id=7f\n")
        self.rejected("AUDIO_RESOURCE_FLAGS_UNSUPPORTED", DUMP.replace("raw/uskoci_message_v1\n", "raw/uskoci_message_v1 unexpected\n"))

    def test_input_and_line_bounds_fail_closed(self):
        self.rejected("AUDIO_DUMP_LINE_LIMIT", DUMP + "x" * 16385)
        with self.assertRaisesRegex(AudioResourceError, "AUDIO_EXPECTED_NAMES_INVALID"):
            parse_resource_dump(DUMP, PACKAGE, ["../escape.wav"])
        with self.assertRaisesRegex(AudioResourceError, "AUDIO_EXPECTED_NAMES_INVALID"):
            parse_resource_dump(DUMP, PACKAGE, [["not-a-name"]])


class ResourceVerifierTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="uskoci-audio-parser-test-")
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.sources = {name: ("exact original " + name).encode() for name in NAMES}
        self.contents = {"res/F2.wav": self.sources[NAMES[0]], "res/ES.wav": self.sources[NAMES[1]], "res/fp.wav": self.sources[NAMES[2]],
                         "resources.arsc": b"synthetic fixture table", "AndroidManifest.xml": b"synthetic fixture manifest"}
        self.apk = self.directory / "fixture.apk"
        self.tool = self.directory / "fixture-aapt2"
        # Execute a tiny bounded tool fixture. Its output format is captured
        # above from actual AAPT2; this synthetic APK is never native evidence.
        self.tool.write_text("#!" + sys.executable + "\nimport sys,time\n"
                             "if sys.argv[1]=='version': sys.stderr.write('Android Asset Packaging Tool (aapt) 2.20-13700139\\n')\n"
                             "elif sys.argv[1]=='sleep': time.sleep(1)\n"
                             "elif sys.argv[1]=='overflow': sys.stdout.write('x'*5000)\n"
                             "else: sys.stdout.write(" + repr(DUMP) + ")\n")
        self.tool.chmod(0o700)
        self.write_apk()

    def write_apk(self, duplicate=None):
        with zipfile.ZipFile(self.apk, "w") as archive:
            for name, data in self.contents.items():
                archive.writestr(name, data)
            if duplicate:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", UserWarning)
                    archive.writestr(duplicate, self.contents[duplicate])

    def verify(self):
        return verify_apk_audio(self.apk, self.tool, PACKAGE, self.sources)

    def rejected(self, code):
        with self.assertRaisesRegex(AudioResourceError, "^" + code + "$"):
            self.verify()

    def test_exact_bytes_and_tool_version_from_stderr_are_verified(self):
        result = self.verify()
        self.assertEqual(set(result["resources"]), set(NAMES))
        self.assertEqual(result["resources"][NAMES[1]]["bytes"], len(self.sources[NAMES[1]]))
        self.assertEqual(result["aapt2"]["version"], "Android Asset Packaging Tool (aapt) 2.20-13700139")
        self.assertEqual(result["apk"]["bytes"], self.apk.stat().st_size)

    def test_wrong_bytes_cannot_pass_by_copying_original_somewhere_else(self):
        old = self.contents["res/ES.wav"]
        self.contents["res/ES.wav"] = old[:-1] + b"!"
        self.contents["assets/copy.wav"] = old
        self.write_apk()
        self.rejected("AUDIO_APK_RESOURCE_BYTES_MISMATCH")

    def test_size_missing_resource_and_duplicate_zip_are_rejected(self):
        self.contents["res/ES.wav"] += b"x"
        self.write_apk()
        self.rejected("AUDIO_APK_RESOURCE_SIZE_MISMATCH")
        del self.contents["res/ES.wav"]
        self.write_apk()
        self.rejected("AUDIO_APK_RESOURCE_MISSING")
        self.contents["res/ES.wav"] = self.sources[NAMES[1]]
        self.write_apk(duplicate="res/ES.wav")
        self.rejected("AUDIO_APK_ENTRY_COUNT_OR_DUPLICATE")

    def test_unsafe_extra_zip_entry_is_rejected(self):
        self.contents["../outside.txt"] = b"unsafe"
        self.write_apk()
        self.rejected("AUDIO_APK_UNSAFE_PATH")

    def test_declared_resource_table_zip_bomb_is_rejected_before_invoking_aapt2(self):
        raw = bytearray(self.apk.read_bytes())
        end = raw.rfind(b"PK\x05\x06")
        offset = struct.unpack_from("<I", raw, end + 16)[0]
        while raw[offset:offset + 4] == b"PK\x01\x02":
            name_size, extra_size, comment_size = struct.unpack_from("<HHH", raw, offset + 28)
            name = raw[offset + 46:offset + 46 + name_size].decode()
            if name == "resources.arsc":
                struct.pack_into("<I", raw, offset + 24, 32 * 1024 * 1024 + 1)
                break
            offset += 46 + name_size + extra_size + comment_size
        else:
            self.fail("Fixture central directory missing resources.arsc")
        self.apk.write_bytes(raw)
        with patch("apk_audio_resources.bounded_tool") as tool:
            self.rejected("AUDIO_APK_RESOURCE_TABLE_SIZE_LIMIT")
            tool.assert_not_called()

    def test_missing_tool_and_oversized_expected_source_are_rejected(self):
        self.tool.unlink()
        self.rejected("AUDIO_AAPT2_BINARY_INVALID")
        self.sources[NAMES[0]] = b"x" * (65536 + 1)
        self.rejected("AUDIO_SOURCE_SIZE_LIMIT")

    def test_tool_runtime_and_output_are_bounded(self):
        with self.assertRaisesRegex(AudioResourceError, "AUDIO_AAPT2_TIMEOUT"):
            bounded_tool([str(self.tool), "sleep"], 4096, 0.05, self.directory)
        with self.assertRaises(AudioResourceError):
            bounded_tool([str(self.tool), "overflow"], 4096, 5, self.directory)


if __name__ == "__main__":
    unittest.main()
