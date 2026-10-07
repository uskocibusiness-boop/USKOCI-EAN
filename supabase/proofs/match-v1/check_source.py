"""MATCH-V1 + DISCOVERY-ZAMENE offline source proof: generator bytes, SQL / PL/pgSQL grammar, rule boundaries.

No database connection; runtime acceptance comes only from the disposable proofs (runtime.proof.mjs, load.proof.mjs).
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys

import pglast
from pglast.parser import parse_plpgsql_json

ROOT = Path(__file__).resolve().parents[3]
M = ROOT / "supabase/candidates/match-v1-20261007"
D = ROOT / "supabase/candidates/discovery-zamene-20261007"
Z = ROOT / "supabase/candidates/zone-perf-20261007"
for gen in (Z / "build_candidate.py", M / "build_candidate.py", D / "build_candidate.py"):
    subprocess.run([sys.executable, str(gen), "--check"], check=True)


def md5(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def code(text):
    """Executable text only: the comments may name what was removed."""
    return re.sub(r"--[^\n]*", "", text)


def plpgsql(fn_ddl):
    """Parse a plpgsql CREATE FUNCTION; product composite types in DECLARE become record (no catalog offline)."""
    start = fn_ddl.find("declare")
    end = fn_ddl.find("\nbegin", start)
    if start >= 0 and end > start:
        dec = re.sub(r"\b(?:public|private|extensions)\.[a-z_][a-z_0-9]*(?:%rowtype)?\b", "record", fn_ddl[start:end], flags=re.I)
        fn_ddl = fn_ddl[:start] + dec + fn_ddl[end:]
    parse_plpgsql_json(fn_ddl)


def bodies_after(directory):
    rows = json.loads((directory / "live-functions.json").read_text(encoding="utf-8"))
    after = {r["signature"]: r["body"] for r in rows}
    for p in json.loads((directory / "patches.json").read_text(encoding="utf-8")):
        if after[p["signature"]].count(p["before"]) == 1:
            after[p["signature"]] = after[p["signature"]].replace(p["before"], p["after"], 1)
        else:
            assert after[p["signature"]] == p["before"], ("PATCH_NOT_REPLAYABLE", p["signature"])
            after[p["signature"]] = p["after"]
    return after


# parameters / result of every plpgsql body that is replaced (the SQL bodies start with "select")
SIGNATURE_HEAD = {
    "private.dispatch_next_wave(uuid)": "nid uuid) returns jsonb",
    "private.dispatch_tick(integer,timestamp with time zone)": "p_batch integer, p_at timestamptz) returns jsonb",
    "private.candidate_profile_ids(uuid,integer)": "nid uuid, p_limit integer) returns table(worker_profile_id uuid)",
    "public.rpc_discovery_v1(jsonb)": "p_request jsonb) returns jsonb",
}
DEFAULT_HEAD = "nid uuid, pid uuid) returns jsonb"

checked = 0
for directory in (Z, M, D):
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    after = bodies_after(directory)
    for f in manifest["functions"]:
        body = after[f["signature"]]
        assert md5(body) == f["after_md5"], ("AFTER_MD5", f["signature"])
        assert "40001" not in body, ("B24_PT409_RULE", f["signature"])
        if code(body).lstrip().startswith("select"):
            pglast.parse_sql(body)
        else:
            plpgsql("create function f(" + SIGNATURE_HEAD.get(f["signature"], DEFAULT_HEAD) + " language plpgsql as $syntax$" + body + "$syntax$")
        checked += 1
    for name in ("candidate.sql", "revert.sql", "preflight.readonly.sql", "postflight.readonly.sql") + (("candidate.in-transaction.sql",) if directory in (M, Z) else ()) \
            + (("switch-ladder-on.sql", "switch-ladder-off.sql") if directory == M else ()):
        text = (directory / name).read_text(encoding="utf-8")
        assert "\r" not in text
        pglast.parse_sql(text)
        for found in re.finditer(r"\ndo (\$[a-z0-9_]+\$)(.*?)\1;", text, re.S):
            plpgsql("create function f() returns void language plpgsql as $syntax$" + found.group(2) + "$syntax$")
            checked += 1
        # every function the candidate CREATES, whole statement: header, language, volatility and body
        for found in re.finditer(r"\n(create function .*?\nas (\$[a-z0-9_]+\$)(.*?)\2;)", text, re.S):
            statement, body = found.group(1), found.group(3)
            assert "40001" not in body
            pglast.parse_sql(statement)
            if "language plpgsql" in statement.split("\nas ")[0]:
                plpgsql(statement)
            else:
                pglast.parse_sql(body)
            checked += 1

m_after = bodies_after(M)
MATCH = "private.match_detail_without_calendar(uuid,uuid)"
CHEAP = "private.dispatch_cheap_candidate_admitted(uuid,uuid)"
cand = (M / "candidate.sql").read_text(encoding="utf-8")


def new_body(name):
    return re.search(r"create function private\." + name + r"\(.*?\nas \$mv1_body\$(.*?)\$mv1_body\$;", cand, re.S).group(1)


fit, tier, requeue = new_body("worker_need_fit_v1"), new_body("worker_need_time_tier_v1"), new_body("requeue_changed_worker_profiles_v1")

# --- "Odgovara mi" is kind of work + area + time: no tool, vehicle, experience or fee condition anywhere in the rule
for body in [code(b) for b in [m_after[MATCH], m_after[CHEAP], fit, tier]]:
    for gone in ("required_tools", "required_vehicles", "minimum_experience_years", "years_experience", "minimum_fee_rsd",
                 "p.tools", "p.vehicles", "RESOURCES_MATCH", "MISSING_REQUIRED_TOOL", "MISSING_REQUIRED_VEHICLE",
                 "INSUFFICIENT_EXPERIENCE", "BELOW_MINIMUM_FEE", "CURRENT_AVAILABILITY_PAUSED"):
        assert gone not in body, ("NOT_A_CONDITION_ANY_MORE", gone)
for kept in ("OWN_NEED", "ACCOUNT_OR_PROFILE_RESTRICTED", "IDENTITY_VERIFICATION_NOT_ADMITTED", "PROFILE_EXCLUSION",
             "SERVICE_NOT_IN_WORK_PROFILE", "OUTSIDE_AVAILABILITY", "OUTSIDE_PREFERRED_RADIUS", "PROACTIVE_NOTIFICATIONS_PAUSED",
             "'responseAllowed', cardinality(hard) = 0", "'dispatchEligible', cardinality(hard) = 0 and cardinality(disp) = 0"):
    assert kept in m_after[MATCH], ("HARD_EXCEPTION_KEPT", kept)
assert "OTHER_WORLD" in fit and "private.accounts_same_world" in fit and "PROFILE_EXCLUSION" in fit
assert "private.worker_need_fit_v1(nid,pid,false)" in m_after[MATCH]
assert "private.worker_need_match_v1(n.id, p.id)" in m_after[CHEAP], "the rule must get row columns, never bare parameters (one-time filter)"
assert "coalesce((s.detail->>'timeTier')::integer, 9)" in m_after["private.dispatch_next_wave(uuid)"]
assert "private.requeue_changed_worker_profiles_v1(p_at)" in m_after["private.dispatch_tick(integer,timestamp with time zone)"]
assert "coalesce(cardinality(p.exclusions),0) > 0" in m_after[MATCH]

# --- speed boundaries (root cause of the stalled load proof): cheapest check first, first refusal, nothing scanned per pair
ordered = [fit.index(marker) for marker in (
    "if p.profile_status<>'ACTIVE'", "radius:=private.effective_radius_km", "private.lower_arr(p.skills) && private.lower_arr(n.required_skills)",
    "private.accounts_same_world", "private.work_kinds_v5(p.skills)", "cardinality(p.exclusions),0)>0", "private.worker_need_time_tier_v1(nid,pid)")]
assert ordered == sorted(ordered), "worker_need_fit_v1 must test status, area, shared word, world, kinds, exclusions, time in that order"
assert fit.count("p_first_refusal and") >= 5
tier_code = code(tier)
assert tier_code.index("return 1;") < tier_code.index("availability_timezone_valid(tz)"), "'bilo kad' must not read or validate a zone"
# --- the shared zone helper belongs to ZONE-PERF alone; MATCH-V1 only calls it and accepts both of its known bodies
TZ = "private.availability_timezone_valid(text)"
m_manifest = json.loads((M / "manifest.json").read_text(encoding="utf-8"))
z_manifest = json.loads((Z / "manifest.json").read_text(encoding="utf-8"))
assert TZ not in [f["signature"] for f in m_manifest["functions"]], "MATCH-V1 must not change the zone helper"
dep = [d for d in m_manifest["unchangedDependencies"] if d["signature"] == TZ]
assert len(dep) == 1 and dep[0]["body_md5"] == z_manifest["functions"][0]["before_md5"] and dep[0]["alsoAcceptedAfterZonePerf"] == z_manifest["functions"][0]["after_md5"]
z_live = {r["signature"]: r["body"] for r in json.loads((Z / "live-functions.json").read_text(encoding="utf-8"))}
m_live = {r["signature"]: r["body"] for r in json.loads((M / "live-functions.json").read_text(encoding="utf-8"))}
assert z_live[TZ] == m_live[TZ], "both packages pin the same live helper"
tz = code(bodies_after(Z)[TZ])
old_expression = code(z_live[TZ]).strip().removeprefix("select").strip().removesuffix(";").strip()
assert "when value in ('Europe/Belgrade','UTC') then true" in tz and tz.index("'Europe/Belgrade'") < tz.index("pg_timezone_names"), "fast path must precede the catalog"
assert tz.count("pg_timezone_names") == 1 and "availability_timezone_valid" not in tz and "set_config" not in tz and "current_setting" not in tz
assert "length(value)<=100" in old_expression and "when value is null or length(value)>100 then false" in tz, "NULL and length rules"
for rule in ("(value='UTC' or position('/' in value)>0)", "value not like 'posix/%'", "value not like 'right/%'", "z.name=value"):
    assert rule in old_expression and rule in tz, ("TRUTH_TABLE_RULE_MISSING", rule)
assert z_manifest["fastPathNames"] == ["Europe/Belgrade", "UTC"] and len(z_manifest["truthTableProbes"]) == 27
z_candidate = (Z / "candidate.sql").read_text(encoding="utf-8")
assert z_candidate.count("'Europe/Paris'") == 1 and "x" * 101 in z_candidate
cand_ids = m_after["private.candidate_profile_ids(uuid,integer)"]
assert cand_ids.count("p.profile_status = 'ACTIVE'") == 2 and cand_ids.count("where p.kind = 'WORKER'") == 2
rq = code(requeue)
assert "limit 100" in rq and "afterAccount" in rq and "(p.updated_at,p.account_id)>(after_at,after_acc)" in rq
assert rq.index("offset 0") < rq.index("private.accounts_same_world"), "the world check must run only after the cheap conditions (OFFSET 0 fence)"

# --- dispatch policy (owner 2026-10-07): ONE wave to every admitted worker by default, the ladder kept whole and switched by ONE row
WAVE_SIG, TICK_SIG = "private.dispatch_next_wave(uuid)", "private.dispatch_tick(integer,timestamp with time zone)"
wave = m_after[WAVE_SIG]
wave_code = code(wave)
# the ladder is still all there: every statement of the ladder path survives, only guarded or made conditional
for ladder_part in ("sizes := cfg->'waveSizes';", "private.candidate_budget(urg = 'URGENT', greatest(0, remaining - active_coverage), cfg)", "'WAVES_EXHAUSTED'",
                    "'RESPONSE_TARGET_AND_COVERAGE_REACHED'", "(sizes->>(policy_wave_no-1))::integer", "greatest(batch, min_choice)", "make_interval(mins => windowm)"):
    assert ladder_part in wave_code, ("LADDER_PART_MISSING", ladder_part)
for guarded in ("if not all_mode and active >= target and active_coverage >= remaining then", "if not all_mode and policy_wave_no > jsonb_array_length(sizes) then",
                "if urg = 'URGENT' and not all_mode then"):
    assert guarded in wave_code, ("LADDER_STEP_NOT_GUARDED", guarded)
# mode ALL: no 40-worker cap, no waiting windows between groups, no stop after N responses; a ceiling per revision; long validity
assert "candidate_limit := sw_ceiling - delivered;" in wave_code and "batch := case when all_mode then candidate_limit else" in wave_code
assert wave_code.index("DELIVERY_CEILING_REACHED") < wave_code.index("insert into public.dispatch_rounds"), "the ceiling must refuse before a round is written"
assert "sw->>'mode' = 'ALL'" in wave_code and "not in ('ALL','LADDER')" in wave_code and "sw is not null" in wave_code, "no row means the ladder; a bad row is a configuration error"
assert wave_code.count("'DISPATCH_CONFIG_INVALID'") >= 5 and "sw_ceiling > 10000" in wave_code and "sw_valid > 10080" in wave_code
assert "valid_until := deadline;" in wave_code and "'READY', valid_until)" in wave_code and "p_expires_at => valid_until" in wave_code, "the ladder keeps its window as validity"
assert "least(valid_until, n.urgent_expires_at)" in wave_code
allowed_sources = {"FIXED", "ADAPTIVE_FLOOR", "ADAPTIVE_COMPUTED", "ADAPTIVE_CAPPED"}   # dispatch_rounds_budget_source_check on DEV
assert set(re.findall(r"budget_source := '([A-Z_]+)'", wave_code)) <= allowed_sources and "budget_source := 'FIXED'" in wave_code
assert "'authoritative', true)\n    || case when all_mode then" in wave and "40001" not in wave
tick_code = code(m_after[TICK_SIG])
assert "'deferred',deferred" in tick_code and "processed > 0 and clock_timestamp() - tick_started > make_interval(secs => tick_budget)" in tick_code and "locked_until = null" in tick_code
assert "least(greatest(coalesce(tick_budget, 40), 0.001), 100)" in tick_code and tick_code.index("tick_budget := least") < tick_code.index("for r in select unnest(claimed)")
assert "all_mode or not (coalesce(s.last_status,'')='SENT'" in rq and "key='match_v1_dispatch'" in rq, "mode ALL has no wave window to wait for"
m_manifest_dispatch = m_manifest["dispatchSwitch"]
assert m_manifest_dispatch["default"] == {"mode": "ALL", "ceiling": 500, "validMinutes": 1440, "tickBudgetSeconds": 40, "owner": "MATCH-V1 2026-10-07"}
assert "values('match_v1_dispatch',jsonb_build_object('mode','ALL','ceiling',500,'validMinutes',1440,'tickBudgetSeconds',40" in cand
assert "delete from private.marketplace_config where key in ('match_v1_profile_requeue','match_v1_dispatch');" in (M / "revert.sql").read_text(encoding="utf-8")
for switch_name, expect, target in (("switch-ladder-on.sql", "ALL", "LADDER"), ("switch-ladder-off.sql", "LADDER", "ALL")):
    switch_text = (M / switch_name).read_text(encoding="utf-8")
    assert f"is distinct from '{expect}'" in switch_text and ("jsonb_set(value,'{mode}','\"" + target + "\"'::jsonb)") in switch_text, switch_name
    assert "create function" not in switch_text.lower() and "match_v1_dispatch" in switch_text and switch_text.count("update private.marketplace_config") == 1, switch_name

d_after = bodies_after(D)["public.rpc_discovery_v1(jsonb)"]
assert d_after.count("public.discovery_for_me_v1(") == 2 and "P6_FOR_ME_PROFILE_REQUIRED" in d_after
# the rule is the LAST condition of each WHERE list it joins, behind the conservative distance pre-test
for alias, closing in (("n", "\n  ), place_wanted"), ("b", "\n ), qualified")):
    pre = "fm_lat is null or fm_lng is null or " + alias + ".execution_location_mode='REMOTE' or " + alias + ".approximate_lat is null or " + alias + ".approximate_lng is null"
    rule = "and (not for_me or public.discovery_for_me_v1(" + alias + ".id))"
    assert d_after.index(pre) < d_after.index(rule) < d_after.index(closing, d_after.index(rule)), ("RULE_NOT_LAST", alias)
assert "fm_radius+0.01" in d_after and "for_me_doc->>'state'" in d_after
assert "returns jsonb" in (D / "candidate.sql").read_text(encoding="utf-8").split("create function public.discovery_for_me_state_v1()")[1].split("as $dz_body$")[0]

for text in (cand, (D / "candidate.sql").read_text(encoding="utf-8"), z_candidate):
    low = text.lower()
    for forbidden in ("create trigger", "create table", "alter table", "create policy", "drop policy", "create index", "session_replication_role"):
        assert forbidden not in low, ("CERTIFICATE_NEUTRAL_SHAPE", forbidden)
print(f"PASS ZONE-PERF + MATCH-V1 + DISCOVERY-ZAMENE offline: generators exact, {checked} SQL/PLpgSQL units parsed, rule and speed boundaries hold; runtime proof pending")
