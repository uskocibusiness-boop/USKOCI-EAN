#!/usr/bin/env python3
"""Verify canonical migration bytes, provenance metadata, and history/file parity."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "MD5_MANIFEST.txt"
PROVENANCE = ROOT / "MIGRATION_PROVENANCE.json"
NAME_RE = re.compile(r"^(\d{14})_([a-z0-9_]+)\.sql$")
LINE_RE = re.compile(r"^([0-9a-f]{32})  (\d{14}_[a-z0-9_]+\.sql)$")
PARTICIPANT_CONTRACT_FILE = (
    "20260831114338_clean_pre_p4_participant_rls_authenticated_proof.sql"
)
R01_PROJECTION_FILE = "20261107114458_r01_needs_projection_20261107.sql"
R01_PROJECTION_SHA256 = "f79cebd5df556a4f8c107c5696702cd42bbd3d9d38b003cd6c3487d561cc5fa3"
R05_DISCOVERY_FILE = "20261107121943_r05_discovery_contract_20261107.sql"
R05_DISCOVERY_SHA256 = "086f8f269d2c2bd67ff3037dcc41b7f38e0e1eaf34648639f82b4aec1bf9cc5d"
CONTINUATION_FILES = [
    "20261107152928_r06_budget_accounting_20261107.sql",
    "20261107153455_r07_selection_recovery_20261107.sql",
]
RECOVERY_EXPORT_FILES = [
    "20261107165358_r08_cancellation_reason_readback_20261107.sql",
    "20261107165752_r10_work_areas_projection_20261107.sql",
]
WORKER_NOW_PAUSE_FILES = ["20261107221346_worker_now_paused_20261107.sql"]
WORKER_NOW_SCHEDULE_FIT_FILES = ["20261107222231_worker_now_schedule_fit_paused_20261107.sql"]


# Frozen catalog facts extracted from archived receipts and dated read-only captures.
# Pin their canonical JSON bytes independently of the editable provenance entries.
CATALOG_EVIDENCE_SHA256 = {
    'inline:dev_readonly_catalog_20261109_post_qa92': '7a128d1df67c4532f6b476566fbef97bfae77f6654bf69e86766d3f203c1d1cf',
    'inline:dev_forward_catalog_20261108_capacity2': '41387cccbd1ec5518d151621de0b98209c0c213a6c2743a81f873341e5621803',
    'inline:dev_forward_catalog_20261108_capacity_readers': '95d75d56271bb33678d4ac5f53a6eeee576651576ca2d94f072726f6cda9179c',
    'inline:dev_forward_catalog_20261108_push_capacity': '2e7a2294e0f6f54dad9f364a2686be58d642db95c469e7e5c694617697a163fd',
    'inline:dev_late_catalog_20261108': 'bab1887819c835dece2e96c4063dcf3722c6427fadbeaa636f2e39513151cd6e',
    'supabase/operations/dev-alpha/ledger/20261021_server_package.receipt.json':
        '32dff9bd11e449edf4709a20422b6d19705250fa40d7edbf2957d4d339791dd5',
    'supabase/operations/dev-alpha/ledger/20261026_ai_contract_migrations.readonly.json':
        '4f72a19944bcafe7ad9edc7b5299a5a522ab01479cbc8d1e0ae4718d91b63b01',
    'inline:dev_migration_catalog_20261107_before_r07b':
        'a2517c93add2a51c60cbabaff4b5d1e1f6b06761fa5c16a15da7933a814a15d9',
    'inline:dev_forward_catalog_20261107_r06_r07b':
        '103649b3ed1ab2dff35af33aa149627584dfe9364d757d19c8e5b247835b41bb',
    'inline:dev_forward_catalog_20261107_r08':
        'c40d2a8e12bdf57d3b9f96c8bbd7fb07619f364c49d987b67846ff740964612b',
    'inline:dev_forward_catalog_20261107_r01':
        '91c94209bc3e79c7b6a5e670de3aae3270d9aec753e926268d0c1f8604d161fe',
    'inline:dev_forward_catalog_20261107_r08_reviews':
        '742adf3ee6c68c7358c5070e3d78e6a9a225a38f8274e506d69ef1dc82a8548f',
    'inline:dev_forward_catalog_20261107_r05':
        '7aaaf62031b73f0eaa1ce85758503164989aedc4ca67c9f7dda0317cbdbd6e80',
    'inline:dev_forward_catalog_20261107_continuation':
        '8307cbcb788b3dde1024803b150986450562674673853dc6da093a8b5e33dd99',
    'inline:dev_forward_catalog_20261107_recovery_export':
        'bcaa5500439d81ff1c5f05573719081afcf133b2d2e59fba5ba1300ea0e0e425',
    'inline:dev_forward_catalog_20261107_worker_now_pause':
        'eba98ebf85150636dae3ce0fcc16d59ff82b0b36cf4a23189300d4b840798bab',
    'inline:dev_forward_catalog_20261107_now_schedule_fit':
        '3b7096f76b5e1ec21e31ebcfd3e17c7a57d63e76cfd91dd6d502a74a7b5fbbe2',
}

R13_PUSH_WAKE_FILE = "20261108154914_r13_coalesce_push_wake_20261108.sql"
R13_PUSH_WAKE_MD5 = "25ad3acc139c8fb0d2d5c5d4fa117901"
R13_PUSH_WAKE_SHA256 = "4f78f892cfc16ec130fb4dcc3a1b0f0ca37bda44f99b11ad0e8ed5d32599de03"
R13_PUSH_WAKE_BYTES = 4724
R09_ACTIVATION_FILE = "20261108211133_r09_worker_activation_clock_20261108.sql"
R09_ACTIVATION_MD5 = "ff622b61d13aba1744b02dcde70c622a"
R09_ACTIVATION_SHA256 = "5770bd040522c5f3bccb4c4d997787d32e494cb645fa456b09818ee4139ebb3c"
R09_ACTIVATION_BYTES = 16708
R09_ACTIVATION_PROOF = "docs/plan/proofs/r09-activation-clock-dev-20261108.json"
R09_ACTIVATION_PROOF_SHA256 = "d34f03b015e9ac510c76ef5ad9f282c2682e6f371fd11adcaed0266c837763d0"
R09_APPLICANT_FILE = "20261108222329_r09_applicant_suppression_20261108.sql"
R09_APPLICANT_MD5 = "9d6ae5f019f8cb36fc7e600eb7cba447"
R09_APPLICANT_SHA256 = "18bcc433a36dec266fd4199debad5bbc9337996b9cba46e34b5b26bf97383acf"
R09_APPLICANT_BYTES = 5874
R09_APPLICANT_PROOF = "docs/plan/proofs/r09-applicant-suppression-dev-20261108.json"
R09_APPLICANT_PROOF_SHA256 = "607b8c613e3fd2f26d439b63870c8e3720060689624882e03b0328e7e55d44c2"


def fail(message: str) -> None:
    print(f"FAIL migration_integrity: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_catalog_evidence(section: dict) -> dict:
    """Read the narrow, immutable archived catalog witness kept with provenance."""
    expected = CATALOG_EVIDENCE_SHA256.get(section.get("evidence"))
    evidence = section.get("catalog_evidence")
    if expected is None or not isinstance(evidence, dict):
        fail("missing or unrecognized archived catalog evidence")
    canonical = json.dumps(evidence, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    if hashlib.sha256(canonical).hexdigest() != expected:
        fail("archived catalog evidence differs from its pinned immutable snapshot")
    return evidence


def check_later_participant_contract(filename: str, sql: str) -> None:
    remaining = sql.lower()
    if filename == R01_PROJECTION_FILE:
        # This exact applied grant-only body names the existing participant
        # policy/helper solely in immutable pre/postimage guards. It does not
        # replace either. A changed byte, appended mutation or different file
        # must receive a new explicit contract review, never this exception.
        if hashlib.sha256(sql.encode("utf-8")).hexdigest() != R01_PROJECTION_SHA256:
            fail("R01 participant read-only fence differs from reviewed ledger bytes")
        return
    if filename == R05_DISCOVERY_FILE:
        # This exact discovery body only names the existing participant policy
        # in immutable needs pre/postimage guards. No RLS/helper replacement is
        # permitted by this byte-specific exception or by a relabelled file.
        if hashlib.sha256(sql.encode("utf-8")).hexdigest() != R05_DISCOVERY_SHA256:
            fail("R05 participant read-only fence differs from reviewed ledger bytes")
        return
    if filename in (
        "20260913045824_clean_v5_support_case_authority.sql",
        "20260913081147_clean_v5_event_bound_account_erasure.sql",
    ):
        # Support evidence and its AF22 source-copy fence each reuse the existing
        # participant visibility predicate once in their reviewed migration.
        # Permit this one read dependency, not a replacement policy/function or
        # any additional reference. Applied participant authority stays intact.
        call = "rls_private.need_participant_can_read(n.id)"
        if remaining.count(call) != 1:
            fail(f"support participant read dependency changed: {filename}")
        remaining = remaining.replace(call, "", 1)
    if "needs_participant_read" in remaining or "need_participant_can_read" in remaining:
        fail(
            "participant RLS contract is superseded without updating its "
            f"integrity assertion: {filename}"
        )


def check_physical_suffix(section: dict, manifest_map: dict, evidence: dict) -> list[str]:
    """Admit raw files, not semantic equivalence or an invented live application."""
    entries = section.get("entries", [])
    names = [item["file"] for item in entries]
    if names != sorted(set(names)):
        fail("physical suffix names are not unique and sorted")
    if section.get("project") != evidence.get("project"):
        fail("physical suffix project differs from catalog evidence")
    catalog = {item["version"]: item for item in evidence.get("liveMigrationCatalogHashes", [])}
    for item in entries:
        name = item["file"]
        if item.get("raw_md5") != manifest_map.get(name):
            fail(f"physical suffix checksum mismatch: {name}")
        raw = (ROOT / name).read_bytes()
        if item.get("raw_sha256") != hashlib.sha256(raw).hexdigest() or item.get("raw_bytes") != len(raw):
            fail(f"physical suffix SHA256/size mismatch: {name}")
        classification = item.get("classification")
        if classification == "SOURCE_ONLY_LIVE_BINDING_UNPROVEN":
            if item.get("live_applied") is not None or any(key.startswith("live_recorded_") for key in item):
                fail(f"unproven source claims live application: {name}")
            continue
        if classification not in ("APPLIED_EXACT_LEDGER_BYTES", "APPLIED_RECORDED_BYTES_DIFFER"):
            fail(f"unknown physical suffix classification: {name}")
        live = catalog.get(item.get("live_version"))
        if not live or item.get("live_applied") is not True or item.get("live_name") != live["name"]:
            fail(f"physical suffix live binding missing: {name}")
        if not re.fullmatch(r"[0-9a-f]{32}", live.get("joined_md5") or "") or not re.fullmatch(r"[0-9a-f]{64}", live.get("joined_sha256") or ""):
            fail(f"physical suffix live binding has no recorded SQL bytes: {name}")
        if item.get("live_recorded_md5") != live["joined_md5"] or item.get("live_recorded_sha256") != live["joined_sha256"]:
            fail(f"physical suffix recorded hash mismatch: {name}")
        exact = item["raw_md5"] == live["joined_md5"] and item["raw_sha256"] == live["joined_sha256"]
        if exact != (classification == "APPLIED_EXACT_LEDGER_BYTES"):
            fail(f"physical suffix exact-byte claim is false: {name}")
    return names



def check_r13_push_wake_provenance(section: dict, manifest_map: dict) -> str:
    """Pin one already-applied DEV SQL ledger statement; never infer transport delivery."""
    raw = (ROOT / R13_PUSH_WAKE_FILE).read_bytes()
    md5 = hashlib.md5(raw).hexdigest()
    sha256 = hashlib.sha256(raw).hexdigest()
    expected = {
        "project": "leqcwgzvjsxugfgzdmth",
        "file": R13_PUSH_WAKE_FILE,
        "version": "20261108154914",
        "name": "r13_coalesce_push_wake_20261108",
        "classification": "APPLIED_EXACT_LEDGER_BYTES",
        "source_md5": R13_PUSH_WAKE_MD5,
        "source_sha256": R13_PUSH_WAKE_SHA256,
        "source_bytes": R13_PUSH_WAKE_BYTES,
        "recorded_statement_md5": R13_PUSH_WAKE_MD5,
        "recorded_statement_sha256": R13_PUSH_WAKE_SHA256,
        "recorded_statement_count": 1,
        "preimage_wake_md5": "c0374f79d5275adada913537549e6bae",
        "postimage_wake_md5": "e00bb01c0c20392ab004f39154cf1bf7",
        "preimage_trigger_md5": "368b2fa3a66d885edbbd4ed946f644e1",
        "dev_applied": True,
        "dev_migration_count_after": 363,
        "verified_http_push_delivery": False,
        "capacity_300k_proven": False,
        "release": "NO-GO",
    }
    if not isinstance(section, dict) or any(section.get(k) != v for k, v in expected.items()):
        fail("R13 coalesced push-wake provenance differs from verified DEV ledger")
    if len(raw) != R13_PUSH_WAKE_BYTES or md5 != R13_PUSH_WAKE_MD5 or sha256 != R13_PUSH_WAKE_SHA256:
        fail("R13 coalesced push-wake canonical source bytes differ from DEV ledger")
    if manifest_map.get(R13_PUSH_WAKE_FILE) != md5:
        fail("R13 coalesced push-wake manifest differs from DEV ledger")
    return R13_PUSH_WAKE_FILE


def check_r09_activation_provenance(section: dict, manifest_map: dict) -> str:
    """Bind the controlled DEV rollout to its exact ledger and readback witness."""
    expected = {
        "project": "leqcwgzvjsxugfgzdmth",
        "file": R09_ACTIVATION_FILE,
        "version": "20261108211133",
        "name": "r09_worker_activation_clock_20261108",
        "classification": "APPLIED_EXACT_LEDGER_BYTES",
        "source_md5": R09_ACTIVATION_MD5,
        "source_sha256": R09_ACTIVATION_SHA256,
        "source_bytes": R09_ACTIVATION_BYTES,
        "recorded_statement_md5": R09_ACTIVATION_MD5,
        "recorded_statement_sha256": R09_ACTIVATION_SHA256,
        "recorded_statement_count": 1,
        "evidence": R09_ACTIVATION_PROOF,
        "evidence_sha256": R09_ACTIVATION_PROOF_SHA256,
        "dev_applied": True,
        "dev_migration_count_before": 363,
        "dev_migration_count_after": 364,
        "existing_admitted_pairs_before": 0,
        "preserved_profile_documents_updated_at_ai_hashes": 24,
        "preserved_owner_metadata": 25,
        "cron_changed": False,
        "r13_cooperative_activated": False,
        "verified_android_delivery": False,
        "capacity_300k_proven": False,
        "release": "NO-GO",
    }
    if not isinstance(section, dict) or any(section.get(k) != v for k, v in expected.items()):
        fail("R09 activation provenance differs from verified controlled DEV rollout")
    raw = (ROOT / R09_ACTIVATION_FILE).read_bytes()
    if (len(raw) != R09_ACTIVATION_BYTES
            or hashlib.md5(raw).hexdigest() != R09_ACTIVATION_MD5
            or hashlib.sha256(raw).hexdigest() != R09_ACTIVATION_SHA256):
        fail("R09 activation canonical source bytes differ from DEV ledger")
    if manifest_map.get(R09_ACTIVATION_FILE) != R09_ACTIVATION_MD5:
        fail("R09 activation manifest differs from DEV ledger")
    witness = ROOT.parent.parent / R09_ACTIVATION_PROOF
    if (not witness.is_file()
            or hashlib.sha256(witness.read_bytes()).hexdigest() != R09_ACTIVATION_PROOF_SHA256):
        fail("R09 activation DEV readback differs from its pinned immutable witness")
    return R09_ACTIVATION_FILE


def check_r09_applicant_provenance(section: dict, manifest_map: dict) -> str:
    """Bind the two existing suppression owners to the actual DEV ledger."""
    expected = {
        "classification": "APPLIED_EXACT_LEDGER_BYTES",
        "project": "leqcwgzvjsxugfgzdmth",
        "file": R09_APPLICANT_FILE,
        "version": "20261108222329",
        "name": "r09_applicant_suppression_20261108",
        "source_md5": R09_APPLICANT_MD5,
        "source_sha256": R09_APPLICANT_SHA256,
        "source_bytes": R09_APPLICANT_BYTES,
        "recorded_statement_md5": R09_APPLICANT_MD5,
        "recorded_statement_sha256": R09_APPLICANT_SHA256,
        "recorded_statement_count": 1,
        "evidence": R09_APPLICANT_PROOF,
        "evidence_sha256": R09_APPLICANT_PROOF_SHA256,
        "dev_applied": True,
        "dev_migration_count_before": 364,
        "dev_migration_count_after": 365,
        "preserved_owner_metadata": 9,
        "changed_owner_bodies": 2,
        "cron_changed": False,
        "verified_android_delivery": False,
        "capacity_300k_proven": False,
        "release": "NO-GO",
    }
    if not isinstance(section, dict) or any(section.get(k) != v for k, v in expected.items()):
        fail("R09 applicant provenance differs from verified DEV rollout")
    raw = (ROOT / R09_APPLICANT_FILE).read_bytes()
    if (len(raw) != R09_APPLICANT_BYTES
            or hashlib.md5(raw).hexdigest() != R09_APPLICANT_MD5
            or hashlib.sha256(raw).hexdigest() != R09_APPLICANT_SHA256):
        fail("R09 applicant canonical source bytes differ from DEV ledger")
    if manifest_map.get(R09_APPLICANT_FILE) != R09_APPLICANT_MD5:
        fail("R09 applicant manifest differs from DEV ledger")
    witness = ROOT.parent.parent / R09_APPLICANT_PROOF
    if (not witness.is_file()
            or hashlib.sha256(witness.read_bytes()).hexdigest() != R09_APPLICANT_PROOF_SHA256):
        fail("R09 applicant DEV readback differs from pinned witness")
    return R09_APPLICANT_FILE


def check_post_qa92_readmission(section: dict, manifest_map: dict) -> list[str]:
    """Readmit three recorded DEV statements without replaying or reclassifying history."""
    expected_files = [
        "20261108225909_r10_owned_usage_projection_post_r09_20261108.sql",
        "20261108230350_home_agreements_summary_20261108.sql",
        "20261108230512_r13_hosted_transaction_probe_20261108.sql",
    ]
    if (not isinstance(section, dict)
            or section.get("purpose") != "CANONICAL_SOURCE_READMISSION_ONLY"
            or section.get("applied_by_this_source_change") is not False):
        fail("post-QA92 readmission must be source-only reconciliation, not a new DEV application")
    entries = section.get("entries", [])
    if (not isinstance(entries, list)
            or any(not isinstance(item, dict) for item in entries)
            or [item.get("file") for item in entries] != expected_files
            or any(item.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
                   or item.get("version") != item.get("live_version") for item in entries)):
        fail("post-QA92 readmission requires exactly three existing ledger-version records")
    return check_physical_suffix(section, manifest_map, load_catalog_evidence(section))


def main() -> None:
    manifest_entries: list[tuple[str, str]] = []
    seen_names: set[str] = set()
    seen_versions: set[str] = set()

    for line_number, line in enumerate(MANIFEST.read_text(encoding="utf-8").splitlines(), 1):
        match = LINE_RE.fullmatch(line)
        if not match:
            fail(f"invalid manifest line {line_number}: {line!r}")
        checksum, filename = match.groups()
        version_match = NAME_RE.fullmatch(filename)
        assert version_match is not None
        version = version_match.group(1)
        if filename in seen_names:
            fail(f"duplicate manifest filename: {filename}")
        if version in seen_versions:
            fail(f"duplicate migration version: {version}")
        seen_names.add(filename)
        seen_versions.add(version)
        manifest_entries.append((checksum, filename))

    manifest_names = [filename for _, filename in manifest_entries]
    if manifest_names != sorted(manifest_names):
        fail("manifest filenames are not sorted")

    disk_names = sorted(
        path.name for path in ROOT.iterdir()
        if path.is_file() and NAME_RE.fullmatch(path.name)
    )
    if manifest_names != disk_names:
        missing = sorted(set(manifest_names) - set(disk_names))
        extra = sorted(set(disk_names) - set(manifest_names))
        fail(f"manifest/file mismatch missing={missing} extra={extra}")

    manifest_map = {filename: checksum for checksum, filename in manifest_entries}
    for filename in disk_names:
        raw = (ROOT / filename).read_bytes()
        if b"\r" in raw:
            fail(f"CR byte found; LF-only contract violated: {filename}")
        actual = hashlib.md5(raw).hexdigest()
        if actual != manifest_map[filename]:
            fail(
                f"raw MD5 mismatch {filename}: "
                f"expected={manifest_map[filename]} actual={actual}"
            )

    metadata = json.loads(PROVENANCE.read_text(encoding="utf-8"))
    contract = metadata.get("checksum_contract", {})
    if contract.get("scope") != "raw physical migration file bytes":
        fail("provenance checksum scope is not raw physical bytes")

    history = metadata.get("live_history_snapshot", {})
    history_entries = history.get("entries", [])
    history_names = [
        item.get("file", f"{item['version']}_{item['name']}.sql")
        for item in history_entries
    ]
    if history.get("migration_count") != len(history_entries):
        fail("live history count does not match entry count")
    last = history.get("last", {})
    if not history_entries or (
        last.get("version") != history_entries[-1].get("version")
        or last.get("name") != history_entries[-1].get("name")
    ):
        fail("live history last entry is inconsistent")

    pending = metadata.get("pending_forward_migrations", [])
    pending_names = [
        f"{item['version']}_{item['name']}.sql" for item in pending
    ]
    suffix = metadata.get("physical_suffix_readmission_20261018")
    suffix_names = []
    if suffix:
        suffix_names = check_physical_suffix(suffix, manifest_map, load_catalog_evidence(suffix))
    # Oct-26 forward work has independently observed live ledger revisions,
    # but differently named physical files and different recorded SQL bytes.
    # Preserve the Oct-18 snapshot unchanged; check the new evidence separately.
    oct26_section = metadata.get("physical_suffix_reconciliation_20261026")
    oct26_suffix_names = []
    if oct26_section:
        oct26_suffix_names = check_physical_suffix(
            oct26_section, manifest_map, load_catalog_evidence(oct26_section),
        )
        applied_oct26 = [
            item for item in oct26_section.get("entries", [])
            if item.get("classification") == "APPLIED_RECORDED_BYTES_DIFFER"
        ]
        if len(oct26_suffix_names) != 3 or len(applied_oct26) != 3:
            fail("Oct-26 reconciliation requires exactly three applied records")
        if suffix_names and oct26_suffix_names[0] <= suffix_names[-1]:
            fail("Oct-26 reconciliation is not strictly after earlier physical suffix")
    # November source/ledger reconciliation has its own frozen witness. The
    # empty taxonomy ledger marker is not an applied SQL byte record. R07a is
    # an exact readmission at its already-applied version, never a new replay.
    nov7_section = metadata.get("physical_suffix_reconciliation_20261107")
    nov7_suffix_names = []
    if nov7_section:
        nov7_suffix_names = check_physical_suffix(
            nov7_section, manifest_map, load_catalog_evidence(nov7_section),
        )
        nov7_classes = [item.get("classification") for item in nov7_section.get("entries", [])]
        if len(nov7_suffix_names) != 7 or nov7_classes.count("APPLIED_EXACT_LEDGER_BYTES") != 1 or nov7_classes.count("APPLIED_RECORDED_BYTES_DIFFER") != 4 or nov7_classes.count("SOURCE_ONLY_LIVE_BINDING_UNPROVEN") != 2:
            fail("Nov-7 reconciliation requires one exact, four differing, and two unproven records")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names
        if earlier_names and nov7_suffix_names[0] <= earlier_names[-1]:
            fail("Nov-7 reconciliation is not strictly after earlier physical suffix")
    forward7_section = metadata.get("forward_readmission_20261107")
    forward7_names = []
    if forward7_section:
        forward7_names = check_physical_suffix(
            forward7_section, manifest_map, load_catalog_evidence(forward7_section),
        )
        if len(forward7_names) != 3 or any(
            item.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or item.get("version") != item.get("live_version")
            for item in forward7_section.get("entries", [])
        ):
            fail("Nov-7 forward readmission requires three exact ledger-version records")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names
        if earlier_names and forward7_names[0] <= earlier_names[-1]:
            fail("Nov-7 forward readmission is not strictly after reconciled suffix")
    r08_section = metadata.get("forward_readmission_20261107_r08")
    r08_names = []
    if r08_section:
        r08_names = check_physical_suffix(
            r08_section, manifest_map, load_catalog_evidence(r08_section),
        )
        if len(r08_names) != 1 or any(
            item.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or item.get("version") != item.get("live_version")
            for item in r08_section.get("entries", [])
        ):
            fail("R08 forward readmission requires one exact ledger-version record")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names + forward7_names
        if earlier_names and r08_names[0] <= earlier_names[-1]:
            fail("R08 readmission is not strictly after the previous forward records")
    r01_section = metadata.get("forward_readmission_20261107_r01")
    r01_names = []
    if r01_section:
        r01_names = check_physical_suffix(
            r01_section, manifest_map, load_catalog_evidence(r01_section),
        )
        if len(r01_names) != 1 or r01_names[0] != R01_PROJECTION_FILE or any(
            item.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or item.get("version") != item.get("live_version")
            for item in r01_section.get("entries", [])
        ):
            fail("R01 forward readmission requires the exact reviewed ledger-version record")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names + forward7_names + r08_names
        if earlier_names and r01_names[0] <= earlier_names[-1]:
            fail("R01 readmission is not strictly after the previous forward records")
    r08_reviews_section = metadata.get("forward_readmission_20261107_r08_reviews")
    r08_reviews_names = []
    if r08_reviews_section:
        r08_reviews_names = check_physical_suffix(
            r08_reviews_section, manifest_map, load_catalog_evidence(r08_reviews_section),
        )
        if len(r08_reviews_names) != 1 or any(
            item.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or item.get("version") != item.get("live_version")
            for item in r08_reviews_section.get("entries", [])
        ):
            fail("R08 review readmission requires one exact ledger-version record")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names + forward7_names + r08_names + r01_names
        if earlier_names and r08_reviews_names[0] <= earlier_names[-1]:
            fail("R08 review readmission is not strictly after the previous forward records")
    r05_section = metadata.get("forward_readmission_20261107_r05")
    r05_names = []
    if r05_section:
        r05_names = check_physical_suffix(
            r05_section, manifest_map, load_catalog_evidence(r05_section),
        )
        if len(r05_names) != 1 or r05_names[0] != R05_DISCOVERY_FILE or any(
            item.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or item.get("version") != item.get("live_version")
            for item in r05_section.get("entries", [])
        ):
            fail("R05 readmission requires the exact reviewed ledger-version record")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names + forward7_names + r08_names + r01_names + r08_reviews_names
        if earlier_names and r05_names[0] <= earlier_names[-1]:
            fail("R05 readmission is not strictly after the previous forward records")
    continuation_section = metadata.get("forward_execution_20261107_continuation")
    continuation_names = []
    if continuation_section:
        continuation_names = check_physical_suffix(
            continuation_section, manifest_map, load_catalog_evidence(continuation_section),
        )
        if continuation_names != CONTINUATION_FILES or any(
            item.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or item.get("version") != item.get("live_version")
            for item in continuation_section.get("entries", [])
        ):
            fail("Nov-7 continuation requires the two exact reviewed ledger-version records")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names + forward7_names + r08_names + r01_names + r08_reviews_names + r05_names
        if earlier_names and continuation_names[0] <= earlier_names[-1]:
            fail("Nov-7 continuation is not strictly after the previous forward records")
    recovery_export_section = metadata.get("forward_execution_20261107_recovery_export")
    recovery_export_names = []
    if recovery_export_section:
        recovery_export_names = check_physical_suffix(
            recovery_export_section, manifest_map, load_catalog_evidence(recovery_export_section),
        )
        if recovery_export_names != RECOVERY_EXPORT_FILES or any(
            item.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or item.get("version") != item.get("live_version")
            for item in recovery_export_section.get("entries", [])
        ):
            fail("Nov-7 recovery/export requires the two exact reviewed ledger-version records")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names + forward7_names + r08_names + r01_names + r08_reviews_names + r05_names + continuation_names
        if earlier_names and recovery_export_names[0] <= earlier_names[-1]:
            fail("Nov-7 recovery/export is not strictly after the previous forward records")
    now_pause_section = metadata.get("forward_execution_20261107_now_pause")
    now_pause_names = []
    if now_pause_section:
        now_pause_names = check_physical_suffix(
            now_pause_section, manifest_map, load_catalog_evidence(now_pause_section),
        )
        if now_pause_names != WORKER_NOW_PAUSE_FILES or any(
            row.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or row.get("version") != row.get("live_version")
            for row in now_pause_section.get("entries", [])
        ):
            fail("Nov-7 worker now pause requires one exact ledger-version record")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names + forward7_names + r08_names + r01_names + r08_reviews_names + r05_names + continuation_names + recovery_export_names
        if earlier_names and now_pause_names[0] <= earlier_names[-1]:
            fail("Nov-7 worker now pause does not follow previous migrations")
    schedule_pause_section = metadata.get("forward_execution_20261107_now_schedule_fit_pause")
    schedule_pause_names = []
    if schedule_pause_section:
        schedule_pause_names = check_physical_suffix(
            schedule_pause_section, manifest_map, load_catalog_evidence(schedule_pause_section),
        )
        if schedule_pause_names != WORKER_NOW_SCHEDULE_FIT_FILES or any(
            row.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or row.get("version") != row.get("live_version")
            for row in schedule_pause_section.get("entries", [])
        ):
            fail("Nov-7 worker schedule-fit pause requires exact ledger-version record")
        earlier_names = history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names + forward7_names + r08_names + r01_names + r08_reviews_names + r05_names + continuation_names + recovery_export_names + now_pause_names
        if earlier_names and schedule_pause_names[0] <= earlier_names[-1]:
            fail("Nov-7 worker schedule-fit pause does not follow previous migrations")
    late_section = metadata.get("late_readmission_20261108")
    late_names = []
    if late_section:
        late_names = check_physical_suffix(late_section, manifest_map, load_catalog_evidence(late_section))
        expected_late = ['20261107232758_r11_auto_location_grant_on_agreement_20261108.sql', '20261107234426_r12_publish_initial_legal_bundle_and_processors.sql', '20261107235123_r12_update_legal_hashes_apple_and_availability.sql']
        if late_names != expected_late or any(
            row.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or row.get("version") != row.get("live_version")
            for row in late_section.get("entries", [])
        ):
            fail("Nov-8 historical readmission requires three exact existing ledger-version records")
        if schedule_pause_names and late_names[0] <= schedule_pause_names[-1]:
            fail("Nov-8 historical readmission must follow schedule-fit evidence")
    push_section = metadata.get("forward_execution_20261108_push_capacity")
    push_names = []
    if push_section:
        push_names = check_physical_suffix(push_section, manifest_map, load_catalog_evidence(push_section))
        if push_names != ["20261108010233_r09_push_capacity_20261108.sql"] or any(
            row.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or row.get("version") != row.get("live_version")
            for row in push_section.get("entries", [])
        ):
            fail("Nov-8 bounded push requires exact applied ledger bytes")
        if late_names and push_names[0] <= late_names[-1]:
            fail("Nov-8 bounded push must follow the reconciled history")
    capacity_section = metadata.get("forward_execution_20261108_capacity_readers")
    capacity_names = []
    if capacity_section:
        capacity_names = check_physical_suffix(capacity_section, manifest_map, load_catalog_evidence(capacity_section))
        expected_capacity = ['20261108012341_r09_agreement_groups_20261108.sql', '20261108012344_r09_public_profiles_batch_20261108.sql', '20261108012644_p0_discovery_materialization_20261108.sql', '20261108012842_p0_dispatch_saved_areas_20261108.sql']
        if capacity_names != expected_capacity or any(
            row.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or row.get("version") != row.get("live_version")
            for row in capacity_section.get("entries", [])
        ):
            fail("Nov-8 capacity readers require four exact applied ledger records")
        if push_names and capacity_names[0] <= push_names[-1]:
            fail("Nov-8 capacity readers must follow the push forward migration")
    capacity2_section = metadata.get("forward_execution_20261108_capacity2")
    capacity2_names = []
    if capacity2_section:
        capacity2_names = check_physical_suffix(capacity2_section, manifest_map, load_catalog_evidence(capacity2_section))
        expected_capacity2 = ['20261108095246_r02_discovery_schedule_20261108.sql', '20261108100023_r12_quarantine_unverified_legal_20261108.sql']
        if capacity2_names != expected_capacity2 or any(
            row.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or row.get("version") != row.get("live_version")
            for row in capacity2_section.get("entries", [])
        ):
            fail("Nov-8 capacity2 requires both exact applied ledger records")
        if capacity_names and capacity2_names[0] <= capacity_names[-1]:
            fail("Nov-8 capacity2 must follow the previous reader migrations")
    v11_section = metadata.get("forward_execution_20261108_v11_quarantine")
    v11_names = []
    if v11_section:
        v11_file = "20261108140731_r12_quarantine_unverified_legal_v11_20261108.sql"
        v11_names = [v11_file]
        raw = (ROOT / v11_file).read_bytes()
        if (v11_section.get("file") != v11_file
            or v11_section.get("project") != "leqcwgzvjsxugfgzdmth"
            or v11_section.get("version") != "20261108140731"
            or v11_section.get("name") != "r12_quarantine_unverified_legal_v11_20261108"
            or v11_section.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or len(raw) != 3843
            or hashlib.md5(raw).hexdigest() != "f0755b5b6abda1eaa5b0183c4f21d1e9"
            or hashlib.sha256(raw).hexdigest() != "d594faa98fda7fab36dbfe6ad3e7cb6f2cfdeddbacd74664fbb068ee4362a000"
            or v11_section.get("source_md5") != "f0755b5b6abda1eaa5b0183c4f21d1e9"
            or v11_section.get("source_sha256") != "d594faa98fda7fab36dbfe6ad3e7cb6f2cfdeddbacd74664fbb068ee4362a000"
            or v11_section.get("recorded_statement_md5") != "f0755b5b6abda1eaa5b0183c4f21d1e9"
            or v11_section.get("recorded_statement_sha256") != "d594faa98fda7fab36dbfe6ad3e7cb6f2cfdeddbacd74664fbb068ee4362a000"
            or v11_section.get("recorded_statement_count") != 1
            or manifest_map.get(v11_file) != "f0755b5b6abda1eaa5b0183c4f21d1e9"):
            fail("R12 v1.1 quarantine does not match independently read back DEV ledger bytes")
        if capacity2_names and v11_file <= capacity2_names[-1]:
            fail("R12 v1.1 quarantine must follow capacity2 migrations")

    r13_section = metadata.get("forward_execution_20261108_r13_short_publish")
    r13_names = []
    if r13_section:
        r13_file = "20261108141444_r13_short_publication_transaction_20261108.sql"
        r13_names = [r13_file]
        raw = (ROOT / r13_file).read_bytes()
        if (r13_section.get("file") != r13_file
            or r13_section.get("project") != "leqcwgzvjsxugfgzdmth"
            or r13_section.get("version") != "20261108141444"
            or r13_section.get("name") != "r13_short_publication_transaction_20261108"
            or r13_section.get("classification") != "APPLIED_EXACT_LEDGER_BYTES"
            or len(raw) != 2788
            or hashlib.md5(raw).hexdigest() != "7eaf49a11df6136354a058a3a87a2af4"
            or hashlib.sha256(raw).hexdigest() != "3918dd516201c46025e82a11a373c9269acded6439ff0437453e7e573d7b6635"
            or r13_section.get("source_md5") != "7eaf49a11df6136354a058a3a87a2af4"
            or r13_section.get("source_sha256") != "3918dd516201c46025e82a11a373c9269acded6439ff0437453e7e573d7b6635"
            or r13_section.get("recorded_statement_md5") != "7eaf49a11df6136354a058a3a87a2af4"
            or r13_section.get("recorded_statement_sha256") != "3918dd516201c46025e82a11a373c9269acded6439ff0437453e7e573d7b6635"
            or r13_section.get("recorded_statement_count") != 1
            or manifest_map.get(r13_file) != "7eaf49a11df6136354a058a3a87a2af4"):
            fail("R13 short-publication is not the exact recorded DEV ledger")
        if v11_names and r13_file <= v11_names[-1]:
            fail("R13 short-publication must follow R12 quarantine")

    push_wake_section = metadata.get("forward_execution_20261108_r13_push_wake")
    push_wake_file = check_r13_push_wake_provenance(push_wake_section, manifest_map)
    push_wake_names = [push_wake_file]
    if r13_names and push_wake_file <= r13_names[-1]:
        fail("R13 coalesced wake must follow short-publication ledger version")

    activation_file = check_r09_activation_provenance(
        metadata.get("forward_execution_20261108_r09_activation"), manifest_map
    )
    activation_names = [activation_file]
    if activation_file <= push_wake_file:
        fail("R09 activation must follow the coalesced wake ledger version")

    applicant_file = check_r09_applicant_provenance(
        metadata.get("forward_execution_20261108_r09_applicant"), manifest_map
    )
    applicant_names = [applicant_file]
    if applicant_file <= activation_file:
        fail("R09 applicant suppression must follow the activation ledger version")

    post_qa92_names = check_post_qa92_readmission(
        metadata.get("readonly_readmission_20261109_post_qa92"), manifest_map
    )
    if post_qa92_names[0] <= applicant_file:
        fail("post-QA92 readmission must follow the R09 applicant ledger version")

    if history_names + pending_names + suffix_names + oct26_suffix_names + nov7_suffix_names + forward7_names + r08_names + r01_names + r08_reviews_names + r05_names + continuation_names + recovery_export_names + now_pause_names + schedule_pause_names + late_names + push_names + capacity_names + capacity2_names + v11_names + r13_names + push_wake_names + activation_names + applicant_names + post_qa92_names != disk_names:
        fail(
            "frozen history/replay plus current physical suffix do not exactly match "
            "canonical migration files"
        )
    for item, filename in zip(pending, pending_names):
        if item.get("classification") != "PENDING_FORWARD_MIGRATION":
            fail(f"invalid pending migration classification: {filename}")
        if item.get("file") != filename:
            fail(f"pending migration filename mismatch: {filename}")
        if item.get("raw_md5") != manifest_map.get(filename):
            fail(f"pending migration checksum mismatch: {filename}")
        if item.get("live_applied") is not False:
            fail(f"pending migration incorrectly claims live apply: {filename}")
        if item.get("predecessor_live_migration_count") != history.get("migration_count"):
            fail(f"pending migration predecessor count mismatch: {filename}")
        if item.get("predecessor_live_head") != history["last"]["version"]:
            fail(f"pending migration predecessor head mismatch: {filename}")

    reconstructions = metadata.get("reconstructions", [])
    if len(reconstructions) != 1:
        fail("expected exactly one recorded-statement reconstruction")
    reconstruction = reconstructions[0]
    if reconstruction.get("classification") != "RECORDED_STATEMENT_RECONSTRUCTION":
        fail("191500 classification is not recorded-statement reconstruction")
    if reconstruction.get("exact_byte_mirror") is not False:
        fail("191500 must not claim exact-byte mirror")
    reconstruction_file = reconstruction["file"]
    if reconstruction.get("canonical_reconstruction_raw_md5") != manifest_map.get(reconstruction_file):
        fail("191500 reconstruction checksum does not match raw manifest")
    if reconstruction.get("legacy_manifest_md5") == manifest_map.get(reconstruction_file):
        fail("191500 legacy checksum was incorrectly promoted to canonical raw checksum")
    if len(reconstruction.get("recorded_statement_md5", [])) != 7:
        fail("191500 recorded statement evidence is incomplete")

    closure = metadata.get("forward_closure", {})
    closure_file = closure.get("file")
    if closure.get("raw_md5") != manifest_map.get(closure_file):
        fail("forward closure checksum does not match raw manifest")
    if closure_file not in history_names:
        fail("forward closure is absent from the live history snapshot")
    if history_names.index(closure_file) <= history_names.index(reconstruction_file):
        fail("forward closure does not follow the 191500 reconstruction")

    forward_repairs = metadata.get("forward_repairs", [])
    for repair in forward_repairs:
        repair_file = repair.get("file")
        if repair.get("classification") != "FORWARD_REPAIR":
            fail(f"invalid forward repair classification: {repair_file}")
        if repair_file not in history_names:
            fail(f"forward repair is absent from live history: {repair_file}")
        if repair.get("raw_md5") != manifest_map.get(repair_file):
            fail(f"forward repair checksum does not match raw manifest: {repair_file}")

    participant_contract = (ROOT / PARTICIPANT_CONTRACT_FILE).read_text(
        encoding="utf-8"
    )
    participant_requirements = (
        "create schema if not exists rls_private authorization postgres;",
        "revoke all on schema rls_private from public, anon, authenticated;",
        "grant usage on schema rls_private to authenticated;",
        "function rls_private.need_participant_can_read(p_need_id uuid)",
        "a.need_id = p_need_id",
        "a.worker_account_id = auth.uid()",
        "a.status in ('CONFIRMED', 'COMPLETED')",
        "s.need_id = p_need_id",
        "s.worker_account_id = auth.uid()",
        "s.status = 'SELECTED'",
        "grant execute on function rls_private.need_participant_can_read(uuid)\n"
        "  to authenticated;",
        "using (rls_private.need_participant_can_read(public.needs.id));",
        "drop function public.fn_need_participant_can_read(uuid);",
        "agreements_need_worker_participant_idx",
        "need_selections_need_worker_selected_idx",
        "set local role authenticated;",
        "participant worker expected 1 row",
        "requester expected 1 owned row",
        "unrelated subject saw % ACTIVE rows",
        "discovery expected %, got %",
        "reset role;",
    )
    for requirement in participant_requirements:
        if requirement not in participant_contract:
            fail(f"participant RLS contract missing: {requirement!r}")

    participant_index = history_names.index(PARTICIPANT_CONTRACT_FILE)
    for later_file in disk_names[participant_index + 1:]:
        check_later_participant_contract(later_file, (ROOT / later_file).read_text(encoding="utf-8"))

    print(
        "PASS migration_integrity "
        f"files={len(disk_names)} "
        f"live_snapshot={len(history_entries)} "
        f"pending={len(pending_names)} "
        f"physical_suffix={len(suffix_names)} "
        f"oct26_suffix={len(oct26_suffix_names)} "
        f"nov7_suffix={len(nov7_suffix_names)} "
        f"r13_push_wake={len(push_wake_names)} "
        f"r09_activation={len(activation_names)} "
        f"r09_applicant={len(applicant_names)} "
        f"post_qa92_readmission={len(post_qa92_names)} "
        f"nov7_forward={len(forward7_names)} "
        f"r08_forward={len(r08_names)} "
        f"r01_forward={len(r01_names)} "
        f"r08_reviews_forward={len(r08_reviews_names)} "
        f"r05_forward={len(r05_names)} "
        f"continuation_forward={len(continuation_names)} "
        f"recovery_export_forward={len(recovery_export_names)} "
        "191500=RECORDED_STATEMENT_RECONSTRUCTION "
        "exact_byte_mirror=false "
        "participant_contract=PASS"
    )


if __name__ == "__main__":
    main()
