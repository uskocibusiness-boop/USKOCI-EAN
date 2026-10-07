"""MATCH-V1B offline source proof: generator bytes, SQL / PL/pgSQL grammar, the structure that the runtime proof then exercises.

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
B = ROOT / "supabase/candidates/match-v1b-remote-waves-20261007"
M = ROOT / "supabase/candidates/match-v1-20261007"
subprocess.run([sys.executable, str(B / "build_candidate.py"), "--check"], check=True)


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


manifest = json.loads((B / "manifest.json").read_text(encoding="utf-8"))
mv1_manifest = json.loads((M / "manifest.json").read_text(encoding="utf-8"))

# ---- built against exactly these MATCH-V1 files (a changed MATCH-V1 package must regenerate this one)
for name, digest in manifest["builtAgainst"]["matchV1PackageFiles"].items():
    assert hashlib.sha256((M / name).read_bytes()).hexdigest() == digest, ("MATCH_V1_PACKAGE_CHANGED", name)
mv1_wave = next(f for f in mv1_manifest["functions"] if f["signature"] == "private.dispatch_next_wave(uuid)")
assert manifest["functions"][0]["before_md5"] == mv1_wave["after_md5"]
for pin in manifest["pinnedDependencies"]:
    known = {f["signature"]: f["after_md5"] for f in mv1_manifest["functions"]}
    known.update({f["signature"]: f["body_md5"] for f in mv1_manifest["newFunctions"]})
    known.update({f["signature"]: f["body_md5"] for f in mv1_manifest["unchangedDependencies"]})
    assert known[pin["signature"]] == pin["body_md5"], ("PIN_NOT_FROM_MATCH_V1", pin["signature"])

# ---- every SQL file and every function body parses
checked = 0
SIGNATURE_HEAD = {"private.dispatch_next_wave(uuid)": "nid uuid) returns jsonb"}
texts = {}
for name in ("candidate.sql", "candidate.in-transaction.sql", "revert.sql", "switch-remote-waves-on.sql", "switch-remote-waves-off.sql",
             "preflight.readonly.sql", "postflight.readonly.sql"):
    text = (B / name).read_text(encoding="utf-8")
    texts[name] = text
    assert "\r" not in text and "40001" not in code(text), name
    pglast.parse_sql(text)
    for found in re.finditer(r"\ndo (\$[a-z0-9_]+\$)(.*?)\1;", text, re.S):
        plpgsql("create function f() returns void language plpgsql as $syntax$" + found.group(2) + "$syntax$")
        checked += 1
    for found in re.finditer(r"\n(create function .*?\nas (\$[a-z0-9_]+\$)(.*?)\2;)", text, re.S):
        statement, body = found.group(1), found.group(3)
        pglast.parse_sql(statement)
        if "language plpgsql" in statement.split("\nas ")[0]:
            plpgsql(statement)
        else:
            pglast.parse_sql(body)
        checked += 1
patches = json.loads((B / "patches.json").read_text(encoding="utf-8"))
assert len(patches) == 7
mv1_live = {r["signature"]: r["body"] for r in json.loads((M / "live-functions.json").read_text(encoding="utf-8"))}
mv1_after = dict(mv1_live)
for patch in json.loads((M / "patches.json").read_text(encoding="utf-8")):
    s = patch["signature"]
    mv1_after[s] = mv1_after[s].replace(patch["before"], patch["after"], 1) if mv1_after[s].count(patch["before"]) == 1 else patch["after"]
wave_before = mv1_after["private.dispatch_next_wave(uuid)"]
assert md5(wave_before) == mv1_wave["after_md5"]
wave = wave_before
for patch in patches:
    assert wave.count(patch["before"]) == 1
    wave = wave.replace(patch["before"], patch["after"], 1)
assert md5(wave) == manifest["functions"][0]["after_md5"]
plpgsql("create function f(" + SIGNATURE_HEAD["private.dispatch_next_wave(uuid)"] + " language plpgsql as $syntax$" + wave + "$syntax$")
checked += 1

# ---- the new function bodies, by name
cand = texts["candidate.sql"]


def new_body(name):
    return re.search(r"create function private\." + name + r"\(.*?\nas \$mv1b_body\$(.*?)\$mv1b_body\$;", cand, re.S).group(1)


room, twin, walk, config, remote = (new_body(n) for n in ("worker_notify_room_v1b", "candidate_profile_ids_v1b", "remote_wave_candidates_v1b",
                                                            "dispatch_config_v1b", "dispatch_remote_wave_v1b"))

# ---- the premise of the notify budget (read from the chain, not guessed): every notification_deliveries insert takes a shared advisory lock per recipient until the end of the transaction
closure_sql = (ROOT / "supabase/migrations/20260912130000_clean_pre_v3_account_closure_preparation.sql").read_text(encoding="utf-8")
assert "create trigger pre_v3_closure_delivery before insert on public.notification_deliveries for each row execute function private.closure_guard_delivery();" in closure_sql
assert "if found and private.closure_event_restricted(e) then" in closure_sql
assert "perform pg_advisory_xact_lock_shared(private.closure_account_key(e.recipient_user_id));" in closure_sql, "the lock per recipient the budget protects the lock table from"

# ---- the event the cap counts is the one the live wave emits (names read from the MATCH-V1 wave, not invented)
assert "p_event_type => 'OPPORTUNITY_AVAILABLE'" in wave_before and "case when urg = 'URGENT' then 'HITNO' else 'NORMAL' end" in wave_before
room_code = code(room)
for part in ("e.event_type = 'OPPORTUNITY_AVAILABLE'", "e.urgency = 'NORMAL'", "e.recipient_role = 'WORKER'", "e.recipient_user_id = uid",
             "interval '24 hours'", "limit p_cap", "p_cap is null or"):
    assert part in room_code, ("CAP_COUNT_PART_MISSING", part)
assert "HITNO" not in room_code and "= 'URGENT'" not in room_code, "urgent events are not counted"
assert manifest["eventCounted"]["event_type"] == "OPPORTUNITY_AVAILABLE" and manifest["eventCounted"]["urgency"] == "NORMAL"

# ---- the ladder is untouched: every ladder statement of MATCH-V1 survives, nothing new runs outside the ALL block / the remote branch
for ladder_part in ("sizes := cfg->'waveSizes';", "private.candidate_budget(urg = 'URGENT', greatest(0, remaining - active_coverage), cfg)", "'WAVES_EXHAUSTED'",
                    "(sizes->>(policy_wave_no-1))::integer", "greatest(batch, min_choice)", "make_interval(mins => windowm)",
                    "if not all_mode and active >= target and active_coverage >= remaining then", "if not all_mode and policy_wave_no > jsonb_array_length(sizes) then",
                    "if urg = 'URGENT' and not all_mode then"):
    assert ladder_part in wave_before and ladder_part in wave, ("LADDER_PART_MISSING", ladder_part)
w = code(wave)
assert w.index("if all_mode then\n    begin") < w.index("cfgb := private.dispatch_config_v1b(sw);") < w.index("if remote_on then\n    return private.dispatch_remote_wave_v1b(")
assert w.count("private.dispatch_config_v1b(") == 1 and "daily_cap := case when urg = 'URGENT' then null" in w, "an urgent task ignores the cap"
assert "if delivered >= sw_ceiling and not remote_on then" in w and "from private.candidate_profile_ids_v1b(n.id, candidate_limit, daily_cap)" in w
# the notify budget of one transaction: read once from the checked configuration, a task without a place gets what is left, a task with a place is cut into chunks
for part in ("tx_budget := (cfgb->>'notifyBudget')::integer;", "tx_used := coalesce(nullif(current_setting('v1b.notified', true), '')::integer, 0);",
             "delivered, tx_budget - tx_used);", "if tx_budget - tx_used < 1 then", "'deferred','TRANSACTION_NOTIFY_BUDGET'", "if candidate_limit > tx_budget - tx_used then",
             "candidate_limit := tx_budget - tx_used;", "chunked := true;", "perform set_config('v1b.notified', (tx_used + inserted)::text, true);",
             "if chunked and inserted >= batch then deadline := statement_timestamp(); end if;", "jsonb_build_object('chunk',true,'txNotifyBudget',tx_budget)"):
    assert part in w, ("BUDGET_PART_MISSING", part)
assert w.index("if remote_on then\n    return private.dispatch_remote_wave_v1b(") < w.index("if tx_budget - tx_used < 1 then") < w.index("candidate_limit := tx_budget - tx_used;") \
    < w.index("insert into public.dispatch_rounds"), "the budget is checked before a round is written"
assert wave.index("if all_mode then\n    -- MATCH-V1: every admitted") < wave.index("if tx_budget - tx_used < 1 then"), "the budget only applies in mode ALL: the ladder never reaches it"
assert "private.candidate_profile_ids(" not in w, "the wave reaches MATCH-V1's function only through the twin"
# a task without a place: the same test as the branch of private.candidate_profile_ids
cp = mv1_after["private.candidate_profile_ids(uuid,integer)"]
assert "n.execution_location_mode in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED')\n     and n.approx_geog is not null" in cp
assert "(n.execution_location_mode in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED'))\n                                  and n.approx_geog is not null" in w

# ---- the twin: exactly MATCH-V1's function when there is no cap, the same three branches with the cap otherwise
t = code(twin)
assert "return query select * from private.candidate_profile_ids(nid, p_limit);" in t and t.index("p_cap is null") < t.index("select * into n")
assert t.count("private.worker_notify_room_v1b(c.uid, p_cap) and private.dispatch_cheap_candidate_admitted(n.id, c.pid)") == 3
for branch in ("extensions.ST_DWithin(pref.approximate_geog, task_geog, 300000.0)", "OPERATOR(extensions.<->) task_geog", "(pref.worker_profile_id is null or pref.approximate_geog is null)",
               "order by case when p.id >= n.id then 0 else 1 end, p.id"):
    assert branch in t and branch in code(cp), ("TWIN_BRANCH_DIFFERS", branch)

# ---- the walk: a keyset-chunked ordered index range, delivered workers skipped by a probe, eligibility = prefilter AND detailed matcher
wk = code(walk)
for part in ("chunk constant integer := 500", "order by p.id", "limit chunk", "p.id >= lo and (first_chunk or p.id > lo)", "(phase = 1 or p.id < n.id)",
             "not exists (select 1 from public.opportunity_deliveries od", "od.worker_account_id = p.account_id and od.need_id = n.id and od.need_revision = n.revision",
             "(p_cap is null or private.worker_notify_room_v1b(r.account_id, p_cap))", "private.dispatch_cheap_candidate_admitted(n.id, r.profile_id)",
             "(d->>'dispatchEligible')::boolean", "exit when got < chunk", "if found_n >= p_limit then return; end if;"):
    assert part in wk, ("WALK_PART_MISSING", part)
assert "order by case" not in wk and wk.count("for phase in 1..2 loop") == 1, "no sort of all profiles"

# ---- the config checker: seven knobs, ranges, named error, strict spelling of the two new families
cf = code(config)
assert cf.count("DISPATCH_CONFIG_INVALID") == 9 and "k like 'remote%'" in cf and "k like 'worker%'" in cf
for knob in ("remoteWaves", "remoteWaveSize", "remoteNextWaveSize", "remoteWaveMinutes", "remoteStopAfterResponses", "remoteCeiling", "workerDailyCap", "workerNotifyPerTransaction"):
    assert "'" + knob + "'" in cf or knob in cf, ("KNOB_MISSING", knob)
assert "num < 1 or num > 1000" in cf and "('remoteCeiling', 1, 10000)" in cf and "case when cap >= 1000 then null else cap end" in cf
assert "num < 50 or num > 2000" in cf and "('remoteWaveSize', 1, 2000)" in cf and "('remoteNextWaveSize', 1, 2000)" in cf and "'notifyBudget', budget" in cf
assert "(sw->>'remoteWaveSize')::integer > budget or (sw->>'remoteNextWaveSize')::integer > budget" in cf, "a wave larger than the budget could never be sent"
assert manifest["knobs"]["workerNotifyPerTransaction"]["default"] == 1200 and manifest["knobs"]["remoteWaveSize"]["max"] == 2000
assert manifest["knobs"]["workerDailyCap"]["default"] == 1000 and manifest["knobs"]["remoteCeiling"]["default"] == 10000
assert (manifest["knobs"]["remoteWaveSize"]["default"], manifest["knobs"]["remoteNextWaveSize"]["default"], manifest["knobs"]["remoteWaveMinutes"]["default"],
        manifest["knobs"]["remoteStopAfterResponses"]["default"]) == (300, 1000, 30, 5)

# ---- the remote wave
r = code(remote)
for part in ("'DELIVERY_CEILING_REACHED'", "'REMOTE_RESPONSE_TARGET_REACHED'", "if active >= stop_after and active_coverage >= remaining then",
             "case when delivered = 0 then wave_size else next_size end", "rem_ceiling - delivered",
             "pace_minutes := case when urg = 'URGENT' then least(wave_minutes, windowm) else wave_minutes end;",
             "(2 ^ least(streak - 1, 9))::integer", "(2 ^ least(streak, 9))::integer", "'waiting',true", "private.remote_wave_candidates_v1b(n.id, batch, daily_cap)",
             "'NO_ELIGIBLE_CANDIDATES'", "on conflict do nothing", "p_event_type => 'OPPORTUNITY_AVAILABLE'", "valid_until := least(valid_until, n.urgent_expires_at)"):
    assert part in r, ("REMOTE_WAVE_PART_MISSING", part)
assert r.index("if delivered >= rem_ceiling then") < r.index("if active >= stop_after") < r.index("select r.round_no, r.created_at") < r.index("if tx_left < batch then") \
    < r.index("insert into public.dispatch_rounds"), "ceiling, then stop, then pace, then the budget of the transaction, and no round is written for a refused, waiting or deferred call"
for part in ("'TRANSACTION_NOTIFY_BUDGET'", "'deadlineAt',statement_timestamp()", "perform set_config('v1b.notified', (coalesce(nullif(current_setting('v1b.notified', true), '')::integer, 0) + inserted)::text, true);"):
    assert part in r, ("REMOTE_BUDGET_PART_MISSING", part)
# the delivery and the event are the same statements as the MATCH-V1 wave writes (the remote wave must not change the shape of a notification)
for statement in ("insert into public.opportunity_deliveries(worker_account_id,worker_profile_id,need_id,", "p_title => 'Nova prilika koja može da Vam odgovara',",
                  "p_dedupe_key => 'opp:'||n.id::text||':'||n.revision::text||':'||c.uid::text,"):
    assert statement in wave_before and statement in remote, ("NOTIFICATION_SHAPE_DIFFERS", statement)

# ---- the switch scripts and the revert
for name, expect, target in (("switch-remote-waves-off.sql", "true", "false"), ("switch-remote-waves-on.sql", "false", "true")):
    s = texts[name]
    assert f"is distinct from '{expect}'::jsonb" in s and f"jsonb_set(value,'{{remoteWaves}}','{target}'::jsonb)" in s, name
    assert "create function" not in s.lower() and s.count("update private.marketplace_config") == 1, name
assert "perform private.dispatch_config_v1b(value || jsonb_build_object('remoteWaves', true))" in texts["switch-remote-waves-on.sql"], "a bad knob can never be switched on"
rv = texts["revert.sql"]
assert rv.count("drop function private.") == 5
for knob in ("remoteWaves", "remoteWaveSize", "remoteNextWaveSize", "remoteWaveMinutes", "remoteStopAfterResponses", "remoteCeiling", "workerDailyCap", "workerNotifyPerTransaction"):
    assert f"- '{knob}'" in rv, ("REVERT_DOES_NOT_REMOVE", knob)

# ---- certificate-neutral shape
for name in ("candidate.sql", "revert.sql"):
    low = texts[name].lower()
    for forbidden in ("create trigger", "create table", "alter table", "create policy", "drop policy", "create index", "session_replication_role"):
        assert forbidden not in low, ("CERTIFICATE_NEUTRAL_SHAPE", name, forbidden)
print(f"PASS MATCH-V1B offline: generator exact, {checked} SQL/PLpgSQL units parsed, ladder untouched, cap counts the live event, walk and wave structure hold; runtime proof pending")
