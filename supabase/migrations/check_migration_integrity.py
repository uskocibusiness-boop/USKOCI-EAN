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


def fail(message: str) -> None:
    print(f"FAIL migration_integrity: {message}", file=sys.stderr)
    raise SystemExit(1)


def check_later_participant_contract(filename: str, sql: str) -> None:
    remaining = sql.lower()
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
        if item.get("live_recorded_md5") != live["joined_md5"] or item.get("live_recorded_sha256") != live["joined_sha256"]:
            fail(f"physical suffix recorded hash mismatch: {name}")
        exact = item["raw_md5"] == live["joined_md5"] and item["raw_sha256"] == live["joined_sha256"]
        if exact != (classification == "APPLIED_EXACT_LEDGER_BYTES"):
            fail(f"physical suffix exact-byte claim is false: {name}")
    return names


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
        evidence_path = (ROOT.parent.parent / suffix["evidence"]).resolve()
        if not evidence_path.is_relative_to(ROOT.parent.parent.resolve()):
            fail("physical suffix evidence escaped repository")
        suffix_names = check_physical_suffix(suffix, manifest_map, json.loads(evidence_path.read_text(encoding="utf-8")))
    # Oct-26 forward work has independently observed live ledger revisions,
    # but differently named physical files and different recorded SQL bytes.
    # Preserve the Oct-18 snapshot unchanged; check the new evidence separately.
    oct26_section = metadata.get("physical_suffix_reconciliation_20261026")
    oct26_suffix_names = []
    if oct26_section:
        oct26_evidence_path = (ROOT.parent.parent / oct26_section["evidence"]).resolve()
        if not oct26_evidence_path.is_relative_to(ROOT.parent.parent.resolve()):
            fail("Oct-26 suffix evidence escaped repository")
        oct26_suffix_names = check_physical_suffix(
            oct26_section, manifest_map,
            json.loads(oct26_evidence_path.read_text(encoding="utf-8")),
        )
        applied_oct26 = [
            item for item in oct26_section.get("entries", [])
            if item.get("classification") == "APPLIED_RECORDED_BYTES_DIFFER"
        ]
        if len(oct26_suffix_names) != 3 or len(applied_oct26) != 3:
            fail("Oct-26 reconciliation requires exactly three applied records")
        if suffix_names and oct26_suffix_names[0] <= suffix_names[-1]:
            fail("Oct-26 reconciliation is not strictly after earlier physical suffix")
    if history_names + pending_names + suffix_names + oct26_suffix_names != disk_names:
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
        "191500=RECORDED_STATEMENT_RECONSTRUCTION "
        "exact_byte_mirror=false "
        "participant_contract=PASS"
    )


if __name__ == "__main__":
    main()
