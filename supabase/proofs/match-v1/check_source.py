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
for gen in (M / "build_candidate.py", D / "build_candidate.py"):
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
for directory in (M, D):
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
    for name in ("candidate.sql", "revert.sql", "preflight.readonly.sql", "postflight.readonly.sql") + (("candidate.in-transaction.sql",) if directory == M else ()):
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
tz = code(m_after["private.availability_timezone_valid(text)"])
assert "value in ('Europe/Belgrade','UTC') then true" in tz and "pg_timezone_names" in tz and tz.index("'Europe/Belgrade'") < tz.index("pg_timezone_names")
assert "availability_timezone_valid" not in tz
cand_ids = m_after["private.candidate_profile_ids(uuid,integer)"]
assert cand_ids.count("p.profile_status = 'ACTIVE'") == 2 and cand_ids.count("where p.kind = 'WORKER'") == 2
rq = code(requeue)
assert "limit 100" in rq and "afterAccount" in rq and "(p.updated_at,p.account_id)>(after_at,after_acc)" in rq

d_after = bodies_after(D)["public.rpc_discovery_v1(jsonb)"]
assert d_after.count("public.discovery_for_me_v1(") == 2 and "P6_FOR_ME_PROFILE_REQUIRED" in d_after
# the rule is the last condition of each WHERE list it joins
assert d_after.index(",0))>=people)\n    and (not for_me or public.discovery_for_me_v1(n.id))\n  ), place_wanted") > 0
assert d_after.index("),query_text)>0)\n   and (not for_me or public.discovery_for_me_v1(b.id))\n ), qualified") > 0

for text in (cand, (D / "candidate.sql").read_text(encoding="utf-8")):
    low = text.lower()
    for forbidden in ("create trigger", "create table", "alter table", "create policy", "drop policy", "create index", "session_replication_role"):
        assert forbidden not in low, ("CERTIFICATE_NEUTRAL_SHAPE", forbidden)
print(f"PASS MATCH-V1 + DISCOVERY-ZAMENE offline: generators exact, {checked} SQL/PLpgSQL units parsed, rule and speed boundaries hold; runtime proof pending")
