"""Keep participant mutation guards strict for the reviewed 143/146 reads."""
import contextlib
import copy
import io
import json
import unittest
from pathlib import Path

from check_migration_integrity import check_later_participant_contract, check_physical_suffix, load_catalog_evidence


class ParticipantContractTests(unittest.TestCase):
    support = "20260913045824_clean_v5_support_case_authority.sql"
    erasure = "20260913081147_clean_v5_event_bound_account_erasure.sql"
    read = "select rls_private.need_participant_can_read(n.id) from public.needs n;"

    def rejected(self, filename, sql):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_later_participant_contract(filename, sql)

    def test_one_explicit_support_read_does_not_replace_authority(self):
        check_later_participant_contract(self.support, self.read)

    def test_exact_146_source_copy_fence_retains_participant_authority(self):
        sql = Path(__file__).with_name(self.erasure).read_text(encoding="utf-8")
        self.assertIn("create function private.closure_support_source_fence_v5", sql)
        self.assertEqual(sql.count("rls_private.need_participant_can_read(n.id)"), 1)
        check_later_participant_contract(self.erasure, sql)

    def test_146_exception_rejects_mutations_extra_and_changed_reads(self):
        for change in (
            "drop policy needs_participant_read on public.needs;",
            "drop function rls_private.need_participant_can_read(uuid);",
            "create or replace function rls_private.need_participant_can_read(uuid) returns boolean;",
            "alter function rls_private.need_participant_can_read(uuid) security invoker;",
            self.read,
        ):
            with self.subTest(change=change):
                self.rejected(self.erasure, self.read + change)
        self.rejected(self.erasure, "select true;")
        self.rejected(self.erasure, self.read.replace("n.id", "other.id"))

    def test_additional_reference_is_not_a_blanket_exception_for_143(self):
        for change in (
            "drop policy needs_participant_read on public.needs;",
            "drop function rls_private.need_participant_can_read(uuid);",
            "create or replace function rls_private.need_participant_can_read(uuid) returns boolean;",
            "alter function rls_private.need_participant_can_read(uuid) security invoker;",
            self.read,
        ):
            with self.subTest(change=change):
                self.rejected(self.support, self.read + change)

    def test_other_migration_still_requires_explicit_contract_review(self):
        self.rejected("20260914000000_future.sql", self.read)

    def test_removed_or_changed_support_dependency_fails_closed(self):
        self.rejected(self.support, "select true;")
        self.rejected(self.support, self.read.replace("n.id", "other.id"))

    def test_unrelated_later_migration_is_allowed(self):
        check_later_participant_contract("20260914000000_future.sql", "select 1;")


class PhysicalSuffixTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        self.section = json.loads((root / "MIGRATION_PROVENANCE.json").read_text())["physical_suffix_readmission_20261018"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0]) for line in (root / "MD5_MANIFEST.txt").read_text().splitlines())

    def rejects(self, section):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_physical_suffix(section, self.manifest, self.evidence)

    def mutate(self, classification, key, value):
        section = copy.deepcopy(self.section)
        item = next(row for row in section["entries"] if row["classification"] == classification)
        item[key] = value
        self.rejects(section)

    def test_current_inventory_keeps_all_three_truth_classes(self):
        verified = check_physical_suffix(self.section, self.manifest, self.evidence)
        self.assertTrue(verified)
        self.assertEqual(set(verified), {row["file"] for row in self.section["entries"]})
        self.assertEqual({row["classification"] for row in self.section["entries"]},
                         {"APPLIED_EXACT_LEDGER_BYTES", "APPLIED_RECORDED_BYTES_DIFFER", "SOURCE_ONLY_LIVE_BINDING_UNPROVEN"})

    def test_raw_checksum_and_sha_cannot_be_relabelled(self):
        for key in ("raw_md5", "raw_sha256", "raw_bytes"):
            with self.subTest(key=key):
                self.mutate("APPLIED_EXACT_LEDGER_BYTES", key, "invalid")

    def test_unproven_binding_cannot_claim_application(self):
        self.mutate("SOURCE_ONLY_LIVE_BINDING_UNPROVEN", "live_applied", True)

    def test_recorded_difference_cannot_claim_byte_equality(self):
        self.mutate("APPLIED_RECORDED_BYTES_DIFFER", "classification", "APPLIED_EXACT_LEDGER_BYTES")

    def test_wrong_project_live_version_or_recorded_hash_fails(self):
        section = copy.deepcopy(self.section)
        section["project"] = "wrong-project"
        self.rejects(section)
        for key in ("live_version", "live_name", "live_recorded_md5", "live_recorded_sha256"):
            with self.subTest(key=key):
                self.mutate("APPLIED_EXACT_LEDGER_BYTES", key, "invalid")

    def test_duplicate_unsorted_or_unknown_entries_fail(self):
        section = copy.deepcopy(self.section)
        section["entries"].reverse()
        self.rejects(section)
        section = copy.deepcopy(self.section)
        section["entries"].append(copy.deepcopy(section["entries"][-1]))
        self.rejects(section)
        self.mutate("APPLIED_EXACT_LEDGER_BYTES", "classification", "ASSUMED_SAFE")


class Oct26ReconciliationTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        metadata = json.loads((root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))
        self.section = metadata["physical_suffix_reconciliation_20261026"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def test_frozen_ledger_mapping_is_not_conflated_with_git_source_bytes(self):
        verified = check_physical_suffix(self.section, self.manifest, self.evidence)
        self.assertEqual(len(verified), 3)
        applied = [row for row in self.section["entries"] if row["classification"] == "APPLIED_RECORDED_BYTES_DIFFER"]
        self.assertEqual(len(applied), 3)
        for row in applied:
            self.assertTrue(row["live_applied"])
            self.assertNotEqual(row["version"], row["live_version"])
            self.assertNotEqual(row["raw_sha256"], row["live_recorded_sha256"])

    def test_false_exact_byte_claim_or_wrong_ledger_hash_fails_closed(self):
        for mutation in ("classification", "live_recorded_sha256", "raw_md5"):
            with self.subTest(mutation=mutation):
                section = copy.deepcopy(self.section)
                if mutation == "classification":
                    section["entries"][0][mutation] = "APPLIED_EXACT_LEDGER_BYTES"
                else:
                    section["entries"][0][mutation] = "INVALID"
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                    check_physical_suffix(section, self.manifest, self.evidence)


class ArchivedCatalogEvidenceTests(unittest.TestCase):
    def setUp(self):
        metadata = json.loads(Path(__file__).with_name("MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))
        self.sections = [metadata[key] for key in (
            "physical_suffix_readmission_20261018", "physical_suffix_reconciliation_20261026",
            "physical_suffix_reconciliation_20261107", "forward_readmission_20261107")]

    def test_missing_or_unrecognized_archived_evidence_fails_closed(self):
        for original in self.sections:
            for key, value in (("catalog_evidence", None), ("evidence", "invented-receipt.json")):
                with self.subTest(key=key):
                    section = copy.deepcopy(original)
                    section[key] = value
                    with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                        load_catalog_evidence(section)

    def test_frozen_source_identity_project_and_recorded_hashes_cannot_be_changed(self):
        for original in self.sections:
            for key in ("source_git_commit", "source_file_sha256", "project", "joined_sha256", "joined_md5", "version", "name"):
                with self.subTest(key=key):
                    section = copy.deepcopy(original)
                    evidence = section["catalog_evidence"]
                    if key in ("source_git_commit", "source_file_sha256", "project"):
                        evidence[key] = "changed"
                    else:
                        evidence["liveMigrationCatalogHashes"][0][key] = "changed"
                    with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                        load_catalog_evidence(section)


class Nov7ReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).parent
        metadata = json.loads((self.root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))
        self.section = metadata["physical_suffix_reconciliation_20261107"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (self.root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def rejects(self, section):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_physical_suffix(section, self.manifest, self.evidence)

    def test_r07a_readmission_is_exact_existing_source_and_ledger(self):
        verified = check_physical_suffix(self.section, self.manifest, self.evidence)
        self.assertEqual(len(verified), 7)
        classes = [row["classification"] for row in self.section["entries"]]
        self.assertEqual(classes.count("APPLIED_EXACT_LEDGER_BYTES"), 1)
        self.assertEqual(classes.count("APPLIED_RECORDED_BYTES_DIFFER"), 4)
        self.assertEqual(classes.count("SOURCE_ONLY_LIVE_BINDING_UNPROVEN"), 2)
        row = next(row for row in self.section["entries"] if row["classification"] == "APPLIED_EXACT_LEDGER_BYTES")
        self.assertEqual(row["live_version"], "20261106235737")
        self.assertEqual(row["version"], row["live_version"])
        self.assertEqual((self.root / row["file"]).read_bytes(),
                         (self.root.parent.parent / "scripts/sql/r07a_currency_invalidation_20261107.sql").read_bytes())

    def test_empty_taxonomy_marker_cannot_prove_application(self):
        section = copy.deepcopy(self.section)
        row = section["entries"][0]
        row.update(live_version="20261105150000", live_name=None,
                   live_recorded_md5=None, live_recorded_sha256=None)
        self.rejects(section)

    def test_different_bytes_and_unproven_files_cannot_claim_exact_application(self):
        for original in self.section["entries"]:
            if original["classification"] == "APPLIED_EXACT_LEDGER_BYTES":
                continue
            with self.subTest(file=original["file"]):
                section = copy.deepcopy(self.section)
                row = next(row for row in section["entries"] if row["file"] == original["file"])
                row["classification"] = "APPLIED_EXACT_LEDGER_BYTES"
                row["live_applied"] = True
                self.rejects(section)

    def test_unproven_file_cannot_smuggle_recorded_hash(self):
        section = copy.deepcopy(self.section)
        row = next(row for row in section["entries"] if row["classification"] == "SOURCE_ONLY_LIVE_BINDING_UNPROVEN")
        row["live_recorded_sha256"] = "0" * 64
        self.rejects(section)


class Nov7ForwardReadmissionTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).parent
        metadata = json.loads((self.root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))
        self.section = metadata["forward_readmission_20261107"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (self.root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def test_all_three_reviewed_candidates_match_exact_applied_ledger_bytes(self):
        verified = check_physical_suffix(self.section, self.manifest, self.evidence)
        self.assertEqual(len(verified), 3)
        for row in self.section["entries"]:
            with self.subTest(file=row["file"]):
                self.assertEqual(row["classification"], "APPLIED_EXACT_LEDGER_BYTES")
                self.assertEqual(row["version"], row["live_version"])
                self.assertEqual((self.root / row["file"]).read_bytes(),
                                 (self.root.parent.parent / row["source"]).read_bytes())

    def test_swapped_migration_identity_or_digest_fails_closed(self):
        for key in ("live_version", "live_name", "live_recorded_md5", "live_recorded_sha256", "raw_md5", "raw_sha256"):
            with self.subTest(key=key):
                section = copy.deepcopy(self.section)
                section["entries"][0][key] = section["entries"][1][key]
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                    check_physical_suffix(section, self.manifest, self.evidence)


if __name__ == "__main__":
    unittest.main()
