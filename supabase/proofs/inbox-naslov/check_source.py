"""INBOX-NASLOV offline source proof: generator bytes, SQL / PL/pgSQL grammar, package boundaries, the shape of the new read.

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
G = ROOT / "supabase/candidates/inbox-naslov-20261008"
subprocess.run([sys.executable, str(G / "build_candidate.py"), "--check"], check=True)


def md5(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def code(text):
    return re.sub(r"--[^\n]*", "", text)


manifest = json.loads((G / "manifest.json").read_text(encoding="utf-8"))
live = {r["signature"]: r["body"] for r in json.loads((G / "live-functions.json").read_text(encoding="utf-8"))}
INBOX = "public.rpc_list_inbox(text,integer,timestamp with time zone,uuid)"
f = manifest["functions"][0]
before = live[INBOX]
assert md5(before) == f["before_md5"] == "b7928c5040ff715ea2af15e1f745c285"
after = before
for p in json.loads((G / "patches.json").read_text(encoding="utf-8")):
    assert after.count(p["before"]) == 1, ("PATCH_NOT_REPLAYABLE", p["before"][:60])
    after = after.replace(p["before"], p["after"], 1)
assert md5(after) == f["after_md5"]

checked = 0
header = ("create function public.rpc_list_inbox(p_role text default null, p_limit integer default 30, p_before_at timestamptz default null, "
          "p_before_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $syntax$")
for body in (before, after):
    parse_plpgsql_json(header + body + "$syntax$;")
    checked += 1
for name in ("candidate.sql", "candidate.in-transaction.sql", "revert.sql", "preflight.readonly.sql", "postflight.readonly.sql"):
    text = (G / name).read_text(encoding="utf-8")
    assert "\r" not in text and text.isascii(), ("ASCII_LF", name)
    assert text.replace("p.prosrc like '%40001%'", "").count("40001") == 0, ("B24_PT409_RULE", name)
    pglast.parse_sql(text)
    for found in re.finditer(r"\ndo (\$[a-z0-9_]+\$)(.*?)\1;", text, re.S):
        parse_plpgsql_json("create function f() returns void language plpgsql as $syntax$" + found.group(2) + "$syntax$")
        checked += 1
    low = code(text).lower()
    for forbidden in ("create trigger", "create table public", "create table private", "alter table", "create policy", "drop policy", "create index",
                      "drop index", "session_replication_role", "create extension", "grant ", "revoke ", "drop function", "create function",
                      "alter function", "insert into", "update public", "update private", "delete from", "truncate"):
        assert forbidden not in low, ("FUNCTION_BODY_ONLY", name, forbidden)
    if name.endswith(".readonly.sql"):
        assert code(text).strip().lower().startswith("select jsonb_build_object(") and "do $" not in low and "execute " not in low, ("READ_ONLY", name)
cand = (G / "candidate.sql").read_text(encoding="utf-8")
in_tx = (G / "candidate.in-transaction.sql").read_text(encoding="utf-8")
rev = (G / "revert.sql").read_text(encoding="utf-8")
assert cand.startswith("-- INBOX-NASLOV CANDIDATE") and "\nbegin;\n" in cand and cand.endswith("commit;\n")
assert "\nbegin;\n" not in in_tx and "commit;" not in in_tx and in_tx == cand.replace("\nbegin;\n", "\n", 1)[:-len("commit;\n")]
assert rev.startswith("-- INBOX-NASLOV EXACT REVERT") and "\nbegin;\n" in rev and rev.endswith("commit;\n")
# the only temporary object is the certificate snapshot, dropped at commit
assert cand.count("create temporary table ib_certificate on commit drop as") == 1 == rev.count("create temporary table ib_certificate on commit drop as")
# order of the guards: a repeated or partial application first, then the predecessor, the dependency, the columns, the erasure markers and a ready
# certificate; then the payload, the definition and the postimage; at the end the reader, the dependency again and the certificate unchanged and ready
order = ["INBOX_NASLOV_ALREADY_OR_PARTIALLY_APPLIED", "INBOX_NASLOV_PREDECESSOR_DRIFT", "INBOX_NASLOV_DEPENDENCY_DRIFT:", "INBOX_NASLOV_SCHEMA_DRIFT",
         "INBOX_NASLOV_ERASURE_MARKER_DRIFT", "INBOX_NASLOV_CERTIFICATE_NOT_READY'", "INBOX_NASLOV_MISSING_FUNCTION", "INBOX_NASLOV_PREIMAGE_DRIFT",
         "INBOX_NASLOV_PAYLOAD_DRIFT", "INBOX_NASLOV_DEFINITION_DRIFT", "INBOX_NASLOV_BODY_ANCHOR_DRIFT", "INBOX_NASLOV_POSTIMAGE_OR_METADATA_DRIFT",
         "INBOX_NASLOV_READER_DRIFT", "INBOX_NASLOV_DEPENDENCY_DRIFT_AFTER", "INBOX_NASLOV_CERTIFICATE_MOVED", "INBOX_NASLOV_CERTIFICATE_NOT_READY_AFTER"]
assert [cand.index(x) for x in order] == sorted(cand.index(x) for x in order), "GUARD_ORDER"
assert all(cand.count("raise exception '" + x.rstrip(":'")) >= 1 for x in order)


def outside_payload(text):
    """The file without the body literal it installs (the body keeps its own errors: AUTH_REQUIRED 28000, INVALID_* 22023)."""
    i = text.index("new_body text:=")
    j = text.index(";\nbegin\n o:=to_regprocedure(", i)
    return text[:i] + text[j:]


for text in (cand, (G / "revert.sql").read_text(encoding="utf-8")):
    rest = outside_payload(text)
    raised = re.findall(r"raise exception '", rest)
    assert raised and len(re.findall(r"raise exception '[A-Z_]+[^']*'[^;]*using errcode='55000'", rest)) == len(raised), "EVERY_REFUSAL_IS_55000"
rorder = ["INBOX_NASLOV_REVERT_PREIMAGE_DRIFT", "INBOX_NASLOV_REVERT_CERTIFICATE_NOT_READY'", "INBOX_NASLOV_REVERT_PAYLOAD_DRIFT",
          "INBOX_NASLOV_REVERT_DEFINITION_DRIFT", "INBOX_NASLOV_REVERT_POSTIMAGE_OR_METADATA_DRIFT", "INBOX_NASLOV_REVERT_INCOMPLETE",
          "INBOX_NASLOV_REVERT_CERTIFICATE_MOVED", "INBOX_NASLOV_REVERT_CERTIFICATE_NOT_READY_AFTER"]
assert [rev.index(x) for x in rorder] == sorted(rev.index(x) for x in rorder), "REVERT_GUARD_ORDER"


def literal(text, start_marker):
    """The body text an apply or revert file installs: its new_body expression (dollar-quoted runs joined with chr(n)), evaluated here."""
    expr = text[text.index("new_body text:=", text.index(start_marker)) + len("new_body text:="):]
    value, rest = "", expr
    while True:
        m = re.match(r"\$ib_body\$(.*?)\$ib_body\$", rest, re.S)
        if m:
            value += m.group(1)
            rest = rest[m.end():]
        else:
            m = re.match(r"chr\((\d+)\)", rest)
            assert m, ("UNREADABLE_LITERAL", rest[:40])
            value += chr(int(m.group(1)))
            rest = rest[m.end():]
        if rest.startswith("||"):
            rest = rest[2:]
            continue
        assert rest.startswith(";\nbegin\n"), ("LITERAL_END", rest[:40])
        return value


assert literal(cand, "do $ib_replace$") == after and md5(literal(cand, "do $ib_replace$")) == f["after_md5"]
assert literal(rev, "do $ib_replace$") == before and md5(literal(rev, "do $ib_replace$")) == f["before_md5"]
assert literal(in_tx, "do $ib_replace$") == after

# --- the new read: what changed and what did not
assert after.count("'taskTitle',t.task_title") == 1 and "taskTitle" not in before
assert before.split("  select coalesce(jsonb_agg(")[0] == after.split("  select coalesce(jsonb_agg(")[0], "guards and the unread count unchanged"
tail = lambda body: body[body.index("  return jsonb_build_object('items'"):]
assert tail(before) == tail(after), "the response object unchanged"
lateral = after[after.index("  left join lateral (\n    select x.title as task_title"):after.index("  ) t on true;")]
lat = code(lateral)
assert lat.count("public.needs n") == 3 and lat.count("union all") == 2 and "limit 1" in lat
assert "q.entity_type='NEED' and n.id=q.entity_id" in lat and "q.entity_type='RESPONSE' and r.id=q.entity_id" in lat and "q.entity_type='AGREEMENT' and a.id=q.entity_id" in lat
assert "n.requester_account_id=v_uid or q.event_type='OPPORTUNITY_AVAILABLE'" in lat
assert "exists(select 1 from public.marketplace_responses mine where mine.need_id=n.id and mine.worker_account_id=v_uid)" in lat
assert "(r.worker_account_id=v_uid or n.requester_account_id=v_uid)" in lat and "v_uid in (a.requester_account_id,a.worker_account_id)" in lat
assert "where x.category<>'OBRISANO' and x.title<>'Obrisan zadatak'" in lat
# only the title leaves the lookup: no address, description, place, price or person
for column in ("approximate_", "description", "exact_address", "price", "display_name", "payload", "requester_profile_id", "worker_profile_id"):
    assert column not in lat, ("TITLE_ONLY", column)
assert sorted(re.findall(r"select (.*?) from", lat)) == sorted(["x.title as task_title", "n.title,n.category", "1", "n.title,n.category", "n.title,n.category"])
# the markers the read uses are the ones the erasure program writes (manifest), and the order/page/limit of the events is untouched
assert manifest["erasureMarkers"]["title"] == "Obrisan zadatak" and manifest["erasureMarkers"]["category"] == "OBRISANO"
assert "order by e.created_at desc,e.id desc limit p_limit+1" in after and after.count("limit p_limit+1") == 1
print(f"PASS INBOX-NASLOV offline: generator exact, {checked} SQL/PLpgSQL units parsed, guard order and 55000 refusals, payload literals equal the "
      f"manifest bodies ({f['before_md5']} -> {f['after_md5']}), title-only read; runtime proof pending")
