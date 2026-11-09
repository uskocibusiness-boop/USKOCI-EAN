"""Keep participant mutation guards strict for the reviewed 143/146 reads."""
import contextlib
import copy
import io
import hashlib
import json
import unittest
from unittest import mock
from pathlib import Path

from check_migration_integrity import check_later_participant_contract, check_physical_suffix, load_catalog_evidence, check_r13_push_wake_provenance, check_r09_activation_provenance, check_r09_applicant_provenance, check_post_qa92_readmission, check_worker_shared_reuse_provenance
from check_migration_integrity import check_worker_draft_activation_provenance, check_worker_application_areas_provenance


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
            "physical_suffix_reconciliation_20261107", "forward_readmission_20261107",
            "forward_readmission_20261107_r08", "forward_readmission_20261107_r01",
            "forward_readmission_20261107_r08_reviews", "forward_readmission_20261107_r05",
            "forward_execution_20261107_continuation", "forward_execution_20261107_recovery_export",
            "forward_execution_20261107_now_pause", "forward_execution_20261107_now_schedule_fit_pause")]

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


class R08ForwardReadmissionTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).parent
        metadata = json.loads((self.root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))
        self.section = metadata["forward_readmission_20261107_r08"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (self.root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def test_r08_uses_exact_observed_ledger_identity_and_source_bytes(self):
        self.assertEqual(len(check_physical_suffix(self.section, self.manifest, self.evidence)), 1)
        row = self.section["entries"][0]
        self.assertEqual(row["version"], "20261107113611")
        self.assertEqual(row["version"], row["live_version"])
        self.assertEqual((self.root / row["file"]).read_bytes(),
                         (self.root.parent.parent / row["source"]).read_bytes())

    def test_r08_wrong_ledger_or_relabelled_source_digest_is_rejected(self):
        for key in ("live_version", "live_name", "live_recorded_sha256", "raw_md5", "raw_bytes"):
            with self.subTest(key=key):
                section = copy.deepcopy(self.section)
                section["entries"][0][key] = "INVALID"
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                    check_physical_suffix(section, self.manifest, self.evidence)


class R01ProjectionReadmissionTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).parent
        metadata = json.loads((self.root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))
        self.section = metadata["forward_readmission_20261107_r01"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (self.root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())
        self.row = self.section["entries"][0]
        self.sql = (self.root / self.row["file"]).read_text(encoding="utf-8")

    def test_exact_grant_projection_matches_ledger_and_keeps_participant_fences_read_only(self):
        self.assertEqual(len(check_physical_suffix(self.section, self.manifest, self.evidence)), 1)
        self.assertEqual(self.row["version"], "20261107114458")
        self.assertEqual((self.root / self.row["file"]).read_bytes(),
                         (self.root.parent.parent / self.row["source"]).read_bytes())
        check_later_participant_contract(self.row["file"], self.sql)

    def test_added_or_altered_participant_mutations_cannot_use_projection_exception(self):
        for mutation in (
            self.sql + "\ndrop policy needs_participant_read on public.needs;",
            self.sql + "\nalter function rls_private.need_participant_can_read(uuid) security invoker;",
            self.sql.replace("rls_private.need_participant_can_read(uuid)", "public.unreviewed_reader(uuid)"),
        ):
            with self.subTest(mutation=mutation[-80:]), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                check_later_participant_contract(self.row["file"], mutation)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_later_participant_contract("20261107114459_unreviewed.sql", self.sql)

    def test_relabelled_ledger_or_private_scope_digest_is_rejected(self):
        for key in ("live_version", "live_name", "live_recorded_sha256", "raw_md5", "raw_bytes"):
            with self.subTest(key=key):
                section = copy.deepcopy(self.section)
                section["entries"][0][key] = "INVALID"
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                    check_physical_suffix(section, self.manifest, self.evidence)


class R05DiscoveryReadmissionTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).parent
        metadata = json.loads((self.root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))
        self.section = metadata["forward_readmission_20261107_r05"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (self.root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())
        self.row = self.section["entries"][0]
        self.sql = (self.root / self.row["file"]).read_text(encoding="utf-8")

    def test_exact_discovery_body_matches_ledger_and_keeps_participant_fences_read_only(self):
        self.assertEqual(len(check_physical_suffix(self.section, self.manifest, self.evidence)), 1)
        self.assertEqual(self.row["version"], "20261107121943")
        self.assertEqual((self.root / self.row["file"]).read_bytes(),
                         (self.root.parent.parent / self.row["source"]).read_bytes())
        check_later_participant_contract(self.row["file"], self.sql)

    def test_mutations_or_relabelled_files_cannot_use_discovery_exception(self):
        for mutation in (
            self.sql + "\ndrop policy needs_participant_read on public.needs;",
            self.sql + "\nalter function rls_private.need_participant_can_read(uuid) security invoker;",
            self.sql.replace("needs_participant_read", "unreviewed_participant_read"),
        ):
            with self.subTest(mutation=mutation[-80:]), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                check_later_participant_contract(self.row["file"], mutation)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_later_participant_contract("20261107121944_unreviewed.sql", self.sql)

    def test_changed_ledger_identity_or_source_digest_is_rejected(self):
        for key in ("live_version", "live_name", "live_recorded_sha256", "raw_md5", "raw_bytes"):
            with self.subTest(key=key):
                section = copy.deepcopy(self.section)
                section["entries"][0][key] = "INVALID"
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                    check_physical_suffix(section, self.manifest, self.evidence)


class Nov7ContinuationTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).parent
        self.section = json.loads((self.root / "MIGRATION_PROVENANCE.json").read_text())["forward_execution_20261107_continuation"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (self.root / "MD5_MANIFEST.txt").read_text().splitlines())

    def test_both_forward_files_are_exact_candidates_at_observed_ledger_versions(self):
        names = check_physical_suffix(self.section, self.manifest, self.evidence)
        self.assertEqual(names, ["20261107152928_r06_budget_accounting_20261107.sql",
                                 "20261107153455_r07_selection_recovery_20261107.sql"])
        for row in self.section["entries"]:
            self.assertEqual(row["version"], row["live_version"])
            self.assertEqual((self.root / row["file"]).read_bytes(),
                             (self.root.parent.parent / row["source"]).read_bytes())

    def test_changed_ledger_identity_or_bytes_cannot_keep_a_live_claim(self):
        for index in range(2):
            for key in ("live_version", "live_name", "live_recorded_sha256", "raw_md5", "raw_bytes"):
                with self.subTest(index=index, key=key):
                    section = copy.deepcopy(self.section)
                    section["entries"][index][key] = "INVALID"
                    with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                        check_physical_suffix(section, self.manifest, self.evidence)


class Nov7RecoveryExportTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).parent
        self.section = json.loads((self.root / "MIGRATION_PROVENANCE.json").read_text())["forward_execution_20261107_recovery_export"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (self.root / "MD5_MANIFEST.txt").read_text().splitlines())

    def test_both_forward_files_match_the_applied_ledger_and_reviewed_candidates(self):
        self.assertEqual(check_physical_suffix(self.section, self.manifest, self.evidence), [
            "20261107165358_r08_cancellation_reason_readback_20261107.sql",
            "20261107165752_r10_work_areas_projection_20261107.sql",
        ])
        for row in self.section["entries"]:
            self.assertEqual(row["version"], row["live_version"])
            self.assertEqual((self.root / row["file"]).read_bytes(),
                             (self.root.parent.parent / row["source"]).read_bytes())

    def test_changed_live_identity_or_bytes_cannot_retain_a_confirmed_claim(self):
        for index in range(2):
            for key in ("live_version", "live_name", "live_recorded_sha256", "raw_md5", "raw_bytes"):
                with self.subTest(index=index, key=key):
                    section = copy.deepcopy(self.section)
                    section["entries"][index][key] = "INVALID"
                    with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                        check_physical_suffix(section, self.manifest, self.evidence)


class Nov8LateReadmissionTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        self.section = json.loads((root / "MIGRATION_PROVENANCE.json").read_text())["late_readmission_20261108"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (root / "MD5_MANIFEST.txt").read_text().splitlines())

    def test_all_three_recovered_records_match_existing_ledger_bytes(self):
        self.assertEqual(len(check_physical_suffix(self.section, self.manifest, self.evidence)), 3)
        self.assertEqual([row["live_version"] for row in self.section["entries"]],
                         ["20261107232758", "20261107234426", "20261107235123"])

    def test_modified_witness_or_false_live_binding_is_rejected(self):
        changed = copy.deepcopy(self.section)
        changed["catalog_evidence"]["liveMigrationCatalogHashes"][0]["joined_md5"] = "0" * 32
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            load_catalog_evidence(changed)
        changed = copy.deepcopy(self.section)
        changed["entries"][0]["live_version"] = "20261108001000"
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_physical_suffix(changed, self.manifest, self.evidence)


class Nov8CapacityReadersTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).parent
        self.section = json.loads((self.root / "MIGRATION_PROVENANCE.json").read_text())["forward_execution_20261108_capacity_readers"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (self.root / "MD5_MANIFEST.txt").read_text().splitlines())

    def test_all_four_live_migrations_are_the_exact_executed_test_candidates(self):
        self.assertEqual(len(check_physical_suffix(self.section, self.manifest, self.evidence)), 4)
        self.assertEqual([row["live_version"] for row in self.section["entries"]],
                         ["20261108012341", "20261108012344", "20261108012644", "20261108012842"])
        for row in self.section["entries"]:
            self.assertEqual((self.root / row["file"]).read_bytes(),
                             (self.root.parent.parent / row["source"]).read_bytes())

    def test_fabricated_binding_or_changed_witness_cannot_claim_dev_acceptance(self):
        for index in range(4):
            for key in ("live_version", "live_name", "live_recorded_sha256", "raw_md5", "raw_bytes"):
                with self.subTest(index=index, key=key):
                    changed = copy.deepcopy(self.section)
                    changed["entries"][index][key] = "INVALID"
                    with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                        check_physical_suffix(changed, self.manifest, self.evidence)
        changed = copy.deepcopy(self.section)
        changed["catalog_evidence"]["liveMigrationCatalogHashes"][0]["joined_sha256"] = "0" * 64
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            load_catalog_evidence(changed)


class Nov8Capacity2Tests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).parent
        self.section = json.loads((self.root / "MIGRATION_PROVENANCE.json").read_text())["forward_execution_20261108_capacity2"]
        self.evidence = load_catalog_evidence(self.section)
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0])
                             for line in (self.root / "MD5_MANIFEST.txt").read_text().splitlines())

    def test_discovery_and_quarantine_bind_exact_applied_bytes(self):
        self.assertEqual(check_physical_suffix(self.section, self.manifest, self.evidence), [
            "20261108095246_r02_discovery_schedule_20261108.sql",
            "20261108100023_r12_quarantine_unverified_legal_20261108.sql",
        ])
        for row in self.section["entries"]:
            self.assertEqual(row["version"], row["live_version"])
            self.assertEqual((self.root / row["file"]).read_bytes(),
                             (self.root.parent.parent / row["source"]).read_bytes())

    def test_modified_live_receipt_and_fabricated_dev_claim_are_rejected(self):
        for index in range(2):
            for key in ("live_version", "live_name", "live_recorded_sha256", "raw_md5", "raw_bytes"):
                with self.subTest(index=index, key=key):
                    changed = copy.deepcopy(self.section)
                    changed["entries"][index][key] = "INVALID"
                    with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                        check_physical_suffix(changed, self.manifest, self.evidence)
        changed = copy.deepcopy(self.section)
        changed["catalog_evidence"]["liveMigrationCatalogHashes"][1]["joined_sha256"] = "0" * 64
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            load_catalog_evidence(changed)



class R13PushWakeProvenanceTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        self.section = json.loads((root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))["forward_execution_20261108_r13_push_wake"]
        self.manifest = dict(line.split("  ")[::-1] for line in (root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def test_one_exact_dev_ledger_statement_and_no_provider_claim(self):
        self.assertEqual(check_r13_push_wake_provenance(self.section, self.manifest), self.section["file"])
        self.assertFalse(self.section["verified_http_push_delivery"])
        self.assertFalse(self.section["capacity_300k_proven"])
        self.assertEqual(self.section["release"], "NO-GO")

    def test_provenance_mutations_are_rejected(self):
        for name, bad_value in (("source_sha256", "0" * 64), ("postimage_wake_md5", "0" * 32),
                                ("recorded_statement_count", 2), ("dev_applied", False),
                                ("verified_http_push_delivery", True)):
            with self.subTest(name=name), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                changed = copy.deepcopy(self.section)
                changed[name] = bad_value
                check_r13_push_wake_provenance(changed, self.manifest)

    def test_manifest_and_presence_cannot_be_waived(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_r13_push_wake_provenance(None, self.manifest)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_r13_push_wake_provenance(self.section, {**self.manifest, self.section["file"]: "0" * 32})


class R09ActivationProvenanceTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        self.section = json.loads((root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))["forward_execution_20261108_r09_activation"]
        self.manifest = dict(line.split("  ")[::-1] for line in (root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def test_exact_applied_ledger_and_controlled_rollout_witness(self):
        self.assertEqual(check_r09_activation_provenance(self.section, self.manifest), self.section["file"])
        self.assertEqual(self.section["existing_admitted_pairs_before"], 0)
        self.assertEqual(self.section["preserved_profile_documents_updated_at_ai_hashes"], 24)
        self.assertFalse(self.section["r13_cooperative_activated"])
        self.assertFalse(self.section["verified_android_delivery"])

    def test_fabricated_version_hash_or_delivery_claim_is_rejected(self):
        for name, bad in (("version", "20261108210405"), ("source_sha256", "0" * 64),
                          ("recorded_statement_count", 2), ("evidence_sha256", "0" * 64),
                          ("existing_admitted_pairs_before", 1), ("dev_applied", False),
                          ("cron_changed", True), ("verified_android_delivery", True)):
            with self.subTest(name=name), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                changed = {**self.section, name: bad}
                check_r09_activation_provenance(changed, self.manifest)

    def test_missing_section_and_manifest_mismatch_are_rejected(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_r09_activation_provenance(None, self.manifest)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_r09_activation_provenance(self.section, {**self.manifest, self.section["file"]: "0" * 32})

    def test_changed_source_or_server_witness_bytes_are_rejected(self):
        original = Path.read_bytes
        for suffix in (self.section["file"], self.section["evidence"]):
            def tampered(path, _suffix=suffix):
                raw = original(path)
                return raw + b"\n" if path.as_posix().endswith(_suffix) else raw
            with self.subTest(suffix=suffix), mock.patch.object(Path, "read_bytes", tampered):
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                    check_r09_activation_provenance(self.section, self.manifest)


class R09ApplicantProvenanceTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        self.section = json.loads((root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))["forward_execution_20261108_r09_applicant"]
        self.manifest = dict(line.split("  ")[::-1] for line in (root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def test_actual_ledger_and_suppression_witness_are_bound(self):
        self.assertEqual(check_r09_applicant_provenance(self.section, self.manifest), self.section["file"])
        self.assertEqual(self.section["changed_owner_bodies"], 2)
        self.assertEqual(self.section["preserved_owner_metadata"], 9)
        self.assertFalse(self.section["verified_android_delivery"])

    def test_fabricated_version_hash_or_live_claim_is_rejected(self):
        for name, bad in (("version", "20261108222330"), ("source_sha256", "0" * 64),
                          ("recorded_statement_count", 2), ("evidence_sha256", "0" * 64),
                          ("changed_owner_bodies", 3), ("dev_applied", False),
                          ("cron_changed", True), ("verified_android_delivery", True)):
            with self.subTest(name=name), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                check_r09_applicant_provenance({**self.section, name: bad}, self.manifest)

    def test_missing_section_and_manifest_mismatch_are_rejected(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_r09_applicant_provenance(None, self.manifest)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_r09_applicant_provenance(self.section, {**self.manifest, self.section["file"]: "0" * 32})

    def test_changed_source_or_witness_bytes_are_rejected(self):
        original = Path.read_bytes
        for suffix in (self.section["file"], self.section["evidence"]):
            def tampered(path, _suffix=suffix):
                raw = original(path)
                return raw + b"\n" if path.as_posix().endswith(_suffix) else raw
            with self.subTest(suffix=suffix), mock.patch.object(Path, "read_bytes", tampered):
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                    check_r09_applicant_provenance(self.section, self.manifest)


class WorkerSharedReuseProvenanceTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        self.section = json.loads((root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))["forward_execution_20261109_worker_shared_reuse"]
        self.manifest = dict(line.split("  ")[::-1] for line in (root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def rejects(self, section, manifest=None):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_worker_shared_reuse_provenance(section, self.manifest if manifest is None else manifest)

    def test_actual_ledger_and_bounded_dev_postimage_are_bound(self):
        self.assertEqual(check_worker_shared_reuse_provenance(self.section, self.manifest), self.section["file"])
        self.assertEqual(self.section["version"], "20261109133503")
        self.assertEqual(self.section["preserved_owner_metadata"], 11)
        self.assertEqual(self.section["changed_owner_bodies"], 3)
        self.assertFalse(self.section["source_ready"])
        self.assertFalse(self.section["verified_android"])

    def test_fabricated_ledger_identity_hash_or_scope_is_rejected(self):
        for key, value in (("version", "20261109133504"), ("name", "unverified_worker_change"),
                           ("source_sha256", "0" * 64), ("source_bytes", 71653),
                           ("recorded_statement_count", 2), ("recorded_statement_md5", "0" * 32),
                           ("dev_migration_count_after", 370), ("dev_applied", False),
                           ("preserved_owner_metadata", 10), ("preserved_relation_metadata", 10),
                           ("changed_owner_bodies", 4)):
            with self.subTest(key=key):
                self.rejects({**self.section, key: value})

    def test_unearned_closure_auth_native_or_push_claims_are_rejected(self):
        for key, value in (("source_ready", True), ("closure_recertified", True),
                           ("verified_auth_save", True), ("verified_android", True),
                           ("verified_push_delivery", True), ("release", "GO"),
                           ("stored_closure_certificates_unchanged", False),
                           ("post_source_digest", "0" * 64), ("post_erasure_digest", "0" * 64)):
            with self.subTest(key=key):
                self.rejects({**self.section, key: value})

    def test_missing_section_manifest_or_witness_is_rejected(self):
        self.rejects(None)
        self.rejects(self.section, {})
        with mock.patch.object(Path, "is_file", return_value=False):
            self.rejects(self.section)

    def test_modified_sql_cannot_pass_by_rehashing_manifest_and_provenance(self):
        original = Path.read_bytes
        filename = self.section["file"]
        altered = original(Path(__file__).with_name(filename)) + b"\n-- unreviewed mutation\n"
        md5 = hashlib.md5(altered).hexdigest()
        sha256 = hashlib.sha256(altered).hexdigest()
        rebound = {**self.section, "source_md5": md5, "recorded_statement_md5": md5,
                   "source_sha256": sha256, "recorded_statement_sha256": sha256,
                   "source_bytes": len(altered)}
        def tampered(path):
            return altered if path.name == filename else original(path)
        with mock.patch.object(Path, "read_bytes", tampered):
            self.rejects(self.section)
            self.rejects(rebound, {**self.manifest, filename: md5})

    def test_modified_dev_witness_cannot_pass_by_rebinding_its_hash(self):
        original = Path.read_bytes
        witness = self.section["evidence"]
        path = Path(__file__).resolve().parents[2] / witness
        altered = original(path) + b"\n"
        rebound = {**self.section, "evidence_sha256": hashlib.sha256(altered).hexdigest()}
        def tampered(item):
            return altered if item.as_posix().endswith(witness) else original(item)
        with mock.patch.object(Path, "read_bytes", tampered):
            self.rejects(self.section)
            self.rejects(rebound)


class WorkerDraftActivationProvenanceTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        self.section = json.loads((root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))["forward_execution_20261109_worker_draft_activation"]
        self.manifest = dict(line.split("  ")[::-1] for line in (root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def rejects(self, section, manifest=None):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_worker_draft_activation_provenance(section, self.manifest if manifest is None else manifest)

    def test_exact_deployment_scope_is_pinned(self):
        self.assertEqual(check_worker_draft_activation_provenance(self.section, self.manifest), self.section["file"])
        self.assertEqual(self.section["version"], "20261109143049")
        self.assertEqual(self.section["preserved_owner_metadata"], 33)
        self.assertEqual(self.section["preserved_relation_metadata"], 14)
        self.assertFalse(self.section["verified_android"])

    def test_fabricated_ledger_identity_or_scope_is_rejected(self):
        for key, value in (("version", "20261109143050"), ("name", "unverified_activation"),
                           ("source_sha256", "0" * 64), ("source_bytes", 94894),
                           ("recorded_statement_count", 2), ("recorded_statement_md5", "0" * 32),
                           ("dev_migration_count_after", 371), ("dev_applied", False),
                           ("preserved_owner_metadata", 32), ("preserved_relation_metadata", 13),
                           ("changed_owner_bodies", 4)):
            with self.subTest(key=key):
                self.rejects({**self.section, key: value})

    def test_deployment_does_not_invent_closure_auth_android_or_push_acceptance(self):
        for key, value in (("source_ready", True), ("closure_recertified", True),
                           ("verified_auth_save", True), ("verified_android", True),
                           ("verified_push_delivery", True), ("release", "GO"),
                           ("stored_closure_certificates_unchanged", False),
                           ("post_source_digest", "0" * 64), ("post_erasure_digest", "0" * 64)):
            with self.subTest(key=key):
                self.rejects({**self.section, key: value})

    def test_missing_provenance_manifest_or_witness_is_rejected(self):
        self.rejects(None)
        self.rejects(self.section, {})
        with mock.patch.object(Path, "is_file", return_value=False):
            self.rejects(self.section)

    def test_rehashing_modified_sql_does_not_reauthorize_it(self):
        original = Path.read_bytes
        filename = self.section["file"]
        altered = original(Path(__file__).with_name(filename)) + b"\n-- unreviewed mutation\n"
        md5, sha = hashlib.md5(altered).hexdigest(), hashlib.sha256(altered).hexdigest()
        rebound = {**self.section, "source_md5": md5, "recorded_statement_md5": md5,
                   "source_sha256": sha, "recorded_statement_sha256": sha, "source_bytes": len(altered)}
        with mock.patch.object(Path, "read_bytes", lambda p: altered if p.name == filename else original(p)):
            self.rejects(self.section)
            self.rejects(rebound, {**self.manifest, filename: md5})

    def test_rehashing_modified_dev_witness_does_not_reauthorize_it(self):
        original = Path.read_bytes
        witness = self.section["evidence"]
        altered = original(Path(__file__).resolve().parents[2] / witness) + b"\n"
        rebound = {**self.section, "evidence_sha256": hashlib.sha256(altered).hexdigest()}
        with mock.patch.object(Path, "read_bytes", lambda p: altered if p.as_posix().endswith(witness) else original(p)):
            self.rejects(self.section)
            self.rejects(rebound)


class WorkerApplicationAreasProvenanceTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        self.section = json.loads((root / "MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))["forward_execution_20261109_worker_application_areas"]
        self.manifest = dict(line.split("  ")[::-1] for line in (root / "MD5_MANIFEST.txt").read_text(encoding="utf-8").splitlines())

    def rejects(self, section, manifest=None):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_worker_application_areas_provenance(section, self.manifest if manifest is None else manifest)

    def test_exact_deployment_scope_is_pinned(self):
        self.assertEqual(check_worker_application_areas_provenance(self.section, self.manifest), self.section["file"])
        self.assertEqual(self.section["version"], '20261109165413')
        self.assertEqual(self.section["preserved_owner_metadata"], 9)
        self.assertEqual(self.section["preserved_relation_metadata"], 13)
        self.assertFalse(self.section["verified_android"])

    def test_fabricated_ledger_identity_or_scope_is_rejected(self):
        for key, value in (("version", '20261109165414'), ("name", "unverified_application"),
                           ("source_sha256", "0" * 64), ("source_bytes", 95197),
                           ("recorded_statement_count", 2), ("recorded_statement_md5", "0" * 32),
                           ("dev_migration_count_after", 372), ("dev_applied", False),
                           ("preserved_owner_metadata", 8), ("preserved_relation_metadata", 12),
                           ("changed_owner_bodies", 4), ("source_commit", "0" * 40),
                           ("ci_run", 1), ("ci_conclusion", "FAILURE")):
            with self.subTest(key=key):
                self.rejects({**self.section, key: value})

    def test_deployment_does_not_invent_closure_auth_android_or_push_acceptance(self):
        for key, value in (("source_ready", True), ("closure_recertified", True),
                           ("verified_auth_save", True), ("verified_android", True),
                           ("verified_push_delivery", True), ("release", "GO"),
                           ("stored_closure_certificates_unchanged", False),
                           ("post_source_digest", "0" * 64), ("post_erasure_digest", "0" * 64)):
            with self.subTest(key=key):
                self.rejects({**self.section, key: value})

    def test_missing_provenance_manifest_or_witness_is_rejected(self):
        self.rejects(None)
        self.rejects(self.section, {})
        with mock.patch.object(Path, "is_file", return_value=False):
            self.rejects(self.section)

    def test_rehashing_modified_sql_does_not_reauthorize_it(self):
        original = Path.read_bytes
        filename = self.section["file"]
        altered = original(Path(__file__).with_name(filename)) + b"\n-- unreviewed mutation\n"
        md5, sha = hashlib.md5(altered).hexdigest(), hashlib.sha256(altered).hexdigest()
        rebound = {**self.section, "source_md5": md5, "recorded_statement_md5": md5,
                   "source_sha256": sha, "recorded_statement_sha256": sha, "source_bytes": len(altered)}
        with mock.patch.object(Path, "read_bytes", lambda p: altered if p.name == filename else original(p)):
            self.rejects(self.section)
            self.rejects(rebound, {**self.manifest, filename: md5})

    def test_rehashing_modified_dev_witness_does_not_reauthorize_it(self):
        original = Path.read_bytes
        witness = self.section["evidence"]
        altered = original(Path(__file__).resolve().parents[2] / witness) + b"\n"
        rebound = {**self.section, "evidence_sha256": hashlib.sha256(altered).hexdigest()}
        with mock.patch.object(Path, "read_bytes", lambda p: altered if p.as_posix().endswith(witness) else original(p)):
            self.rejects(self.section)
            self.rejects(rebound)

    def test_participant_references_are_only_frozen_before_after_metadata(self):
        sql = Path(__file__).with_name(self.section["file"]).read_text(encoding="utf-8")
        blocks = sql.split("$environment$")
        self.assertEqual(len(blocks), 5)
        for snapshot in blocks[1::2]:
            needs = next(r for r in json.loads(snapshot)["relations"] if r["name"] == "public.needs")
            participant = next(p for p in needs["policies"] if p["name"] == "needs_participant_read")
            self.assertEqual(participant["using"], "rls_private.need_participant_can_read(id)")
        executable = "".join(blocks[::2])
        self.assertNotIn("needs_participant_read", executable)
        self.assertNotIn("need_participant_can_read", executable)
        check_later_participant_contract(self.section["file"], sql)

    def test_participant_exception_rejects_added_ddl_and_modified_snapshot(self):
        filename = self.section["file"]
        sql = Path(__file__).with_name(filename).read_text(encoding="utf-8")
        for altered in (
            sql + "\ndrop policy needs_participant_read on public.needs;",
            sql + "\ndrop function rls_private.need_participant_can_read(uuid);",
            sql.replace("rls_private.need_participant_can_read(id)", "true"),
            sql + "\n-- changed byte\n",
        ):
            with self.subTest(change=altered[-90:]):
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                    check_later_participant_contract(filename, altered)

    def test_participant_exception_does_not_follow_a_renamed_file(self):
        sql = Path(__file__).with_name(self.section["file"]).read_text(encoding="utf-8")
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_later_participant_contract("20261109165414_other_operation.sql", sql)


class PostQA92ReadmissionTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parent
        self.section = json.loads((root / "MIGRATION_PROVENANCE.json").read_text())["readonly_readmission_20261109_post_qa92"]
        self.manifest = dict((line.split("  ")[1], line.split("  ")[0]) for line in (root / "MD5_MANIFEST.txt").read_text().splitlines())

    def rejects(self, section, manifest=None):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_post_qa92_readmission(section, self.manifest if manifest is None else manifest)

    def test_exact_ledger_bytes_are_readmitted_without_new_application(self):
        self.assertEqual(check_post_qa92_readmission(self.section, self.manifest),
                         [row["file"] for row in self.section["entries"]])
        self.assertFalse(self.section["applied_by_this_source_change"])

    def test_missing_or_invented_application_section_fails(self):
        self.rejects(None)
        for key, value in (("purpose", "DEV_APPLIED"), ("applied_by_this_source_change", True)):
            self.rejects({**self.section, key: value})

    def test_missing_duplicate_and_reordered_records_fail(self):
        for entries in (self.section["entries"][:-1], self.section["entries"] + self.section["entries"][-1:],
                        list(reversed(self.section["entries"]))):
            self.rejects({**self.section, "entries": entries})

    def test_relabelled_versions_and_unproven_classes_fail(self):
        for index in range(3):
            for key, value in (("version", "20261109000000"), ("live_applied", False),
                               ("classification", "SOURCE_ONLY_LIVE_BINDING_UNPROVEN")):
                section = copy.deepcopy(self.section)
                section["entries"][index][key] = value
                self.rejects(section)

    def test_rebound_catalog_cannot_change_immutable_live_evidence(self):
        for index in range(3):
            section = copy.deepcopy(self.section)
            section["catalog_evidence"]["liveMigrationCatalogHashes"][index]["joined_sha256"] = "0" * 64
            self.rejects(section)

    def test_wrong_project_or_missing_manifest_fails(self):
        self.rejects({**self.section, "project": "unverified-project"})
        self.rejects(self.section, {})

    def test_sql_mutation_cannot_pass_by_rehashing_its_source_metadata(self):
        original = Path.read_bytes
        for index in range(3):
            section = copy.deepcopy(self.section)
            entry = section["entries"][index]
            filename = entry["file"]
            altered = original(Path(__file__).with_name(filename)) + b"\n"
            entry.update(raw_md5=hashlib.md5(altered).hexdigest(), raw_sha256=hashlib.sha256(altered).hexdigest(), raw_bytes=len(altered))
            manifest = {**self.manifest, filename: entry["raw_md5"]}
            def tampered(path, chosen=filename, data=altered):
                return data if path.name == chosen else original(path)
            with self.subTest(file=filename), mock.patch.object(Path, "read_bytes", tampered):
                self.rejects(section, manifest)

    def test_changed_recorded_hash_fails_even_when_file_is_untouched(self):
        for index in range(3):
            section = copy.deepcopy(self.section)
            section["entries"][index]["live_recorded_md5"] = "0" * 32
            self.rejects(section)


if __name__ == "__main__":
    unittest.main()
