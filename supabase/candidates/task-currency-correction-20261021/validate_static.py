"""Static safety check for the source-only CUR01 SQL sketch.

This is deliberately not a database or PL/pgSQL runtime test.
"""

from pathlib import Path

from pglast import parse_sql


HERE = Path(__file__).resolve().parent
candidate = (HERE / "CUR01_ATOMIC_CORE_ROLLBACK.sql").read_text(encoding="utf-8")
statements = parse_sql(candidate)
normalized = candidate.lower()
assertions = (HERE / "ISOLATED_ASSERTIONS.sql").read_text(encoding="utf-8")
proof_statements = parse_sql(assertions)
matrix = (HERE / "REGRESSION_MATRIX.md").read_text(encoding="utf-8")

assert len(statements) >= 25
assert len(proof_statements) >= 4
assert normalized.count("begin;") == 1
assert normalized.count("rollback;") == 1
assert "commit;" not in normalized
assert "cur01_preexisting_closure_retention_gate_not_ready" in normalized
assert "cur01_forward_rebind_and_isolated_race_proof_required" in normalized
assert "between 1 and 160" not in normalized
assert "private.cur01_price_change_signal" in normalized
assert "private.cur01_explicit_rsd_price_amount" in normalized
signal = normalized.split("create function private.cur01_price_change_signal", 1)[1].split("$f$;", 1)[0]
assert "'(^|[^[:alpha:]])(ukupno|укупно|po[[:space:]]+osobi|по[[:space:]]+особи)([^[:alpha:]]|$)'" in signal
assert "'^[0-9]{1,2}[.!?]?$'" in signal
assert "(ipak|ипак|umesto|уместо|neka[[:space:]]+bude" in signal
price_filter = normalized.split("create function private.cur01_turn_price_filter", 1)[1].split("end $f$;", 1)[0]
assert "count(*) > count(distinct x.value->>'key')" in price_filter
assert "if not v_duplicate_price_keys and v_mode->>'value' = 'my_price'" in price_filter
assert "elsif not v_duplicate_price_keys and v_mode->>'value' = 'offers'" in price_filter
assert "cur01_historical_published_or_closed_price_inventory_required" in normalized
assert "cur01_historical_legacy_price_inventory_required" in normalized
history = normalized.split("do $history$", 1)[1].split("end $history$;", 1)[0]
assert "left join public.needs n on n.id = c.bound_need_id" in history
assert "c.status is distinct from 'open'" in history
assert "n.id is null or n.status is distinct from 'draft'" in history
assert "f.fact_key in ('need.price_mode','need.price_rsd','need.price_basis')" in history
assert "and c.fact_schema_version = 'need_fact_v2'" in history
assert "after_history_quarantine" in assertions.lower()
accept_proof = assertions.lower().split("elsif v_stage='after_accept' then", 1)[1].split("end if;", 1)[0]
assert "v_need_mode is distinct from v_expected_mode" in accept_proof
assert "v_price is distinct from v_expected_new_price" in accept_proof
assert "v_need_basis is distinct from v_expected_basis" in accept_proof
assert "v_price is not null or v_need_basis is not null" in accept_proof
for stage, case in (
    ("AFTER_BASIS_ONLY_CORRECTION", "C15A"),
    ("AFTER_SHORT_AMOUNT_CORRECTION", "C15B"),
    ("AFTER_DUPLICATE_PRICE_PROPOSAL", "C15C"),
):
    assert stage in assertions and case in matrix
assert "C15D" in matrix and "AFTER_BASIS_ONLY_CORRECTION" in matrix
assert "v_people = 1 and v_basis is null" in normalized
assert "v_people is not null and v_people >= 1" in normalized
assert "private.cur01_claim_price_correction" in normalized
assert "private.cur01_turn_price_filter" in normalized
assert "private.cur01_review_price_ready" in normalized
assert "price_unresolved" in normalized
print(
    f"STATIC PARSE ONLY: {len(statements)} candidate SQL statements, "
    f"{len(proof_statements)} assertion statements; rollback-only gate present"
)
