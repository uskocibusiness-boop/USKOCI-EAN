"""DISCOVERY-GRAD offline source proof: generator bytes, SQL / PL/pgSQL grammar, the fold oracle, package boundaries.

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
G = ROOT / "supabase/candidates/discovery-grad-20261008"
D = ROOT / "supabase/candidates/discovery-zamene-20261007"
subprocess.run([sys.executable, str(G / "build_candidate.py"), "--check"], check=True)
subprocess.run([sys.executable, str(D / "build_candidate.py"), "--check"], check=True)


def md5(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def code(text):
    return re.sub(r"--[^\n]*", "", text)


manifest = json.loads((G / "manifest.json").read_text(encoding="utf-8"))
live = {r["signature"]: r["body"] for r in json.loads((G / "live-functions.json").read_text(encoding="utf-8"))}
READER = "public.rpc_discovery_v1(jsonb)"
# the pinned DEV body is exactly what DISCOVERY-ZAMENE produced (its generator output, md5 read on DEV 2026-10-08)
dz = json.loads((D / "manifest.json").read_text(encoding="utf-8"))
assert dz["functions"][0]["after_md5"] == manifest["functions"][0]["before_md5"] == md5(live[READER]) == "dc69802e3ba209232a8be095f60e9c9f"
after = live[READER]
for p in json.loads((G / "patches.json").read_text(encoding="utf-8")):
    assert after.count(p["before"]) == 1, ("PATCH_NOT_REPLAYABLE", p["before"][:60])
    after = after.replace(p["before"], p["after"], 1)
assert md5(after) == manifest["functions"][0]["after_md5"]

checked = 0
parse_plpgsql_json("create function f(p_request jsonb) returns jsonb language plpgsql as $syntax$" + after + "$syntax$")
checked += 1
for name in ("candidate.sql", "candidate.in-transaction.sql", "revert.sql", "preflight.readonly.sql", "postflight.readonly.sql"):
    text = (G / name).read_text(encoding="utf-8")
    assert "\r" not in text and text.isascii(), ("ASCII_LF", name)
    assert text.replace("p.prosrc like '%40001%'", "").count("40001") == 0, ("B24_PT409_RULE", name)
    pglast.parse_sql(text)
    for found in re.finditer(r"\ndo (\$[a-z0-9_]+\$)(.*?)\1;", text, re.S):
        parse_plpgsql_json("create function f() returns void language plpgsql as $syntax$" + found.group(2) + "$syntax$")
        checked += 1
    for found in re.finditer(r"\n(create function .*?\nas (\$[a-z0-9_]+\$)(.*?)\2;)", text, re.S):
        statement, body = found.group(1), found.group(3)
        pglast.parse_sql(statement)
        pglast.parse_sql(body)
        checked += 1
    low = text.lower()
    for forbidden in ("create trigger", "create table", "alter table", "create policy", "drop policy", "create index", "session_replication_role",
                      "create extension", "unaccent", "security definer", "alter function", "grant execute on function public.rpc_discovery_v1"):
        assert forbidden not in low, ("CERTIFICATE_NEUTRAL_SHAPE", name, forbidden)
cand = (G / "candidate.sql").read_text(encoding="utf-8")
assert cand.startswith("-- DISCOVERY-GRAD CANDIDATE") and "\nbegin;\n" in cand and cand.endswith("commit;\n")
in_tx = (G / "candidate.in-transaction.sql").read_text(encoding="utf-8")
assert "\nbegin;\n" not in in_tx and "commit;" not in in_tx and in_tx.replace("-- DISCOVERY-GRAD CANDIDATE", "") == cand.replace("\nbegin;\n", "\n").replace("commit;\n", "").replace("-- DISCOVERY-GRAD CANDIDATE", "")
assert cand.count("create function") == 1 and "drop function" not in cand
rev = (G / "revert.sql").read_text(encoding="utf-8")
assert rev.count("drop function public.discovery_fold_v1(text);") == 1 and "create function" not in rev
# order of the guards: a repeated application is named before any pin; the certificate is checked first and last
assert cand.index("DISCOVERY_GRAD_CERTIFICATE_NOT_READY'") < cand.index("DISCOVERY_GRAD_ALREADY_OR_PARTIALLY_APPLIED") < cand.index("DISCOVERY_GRAD_PREDECESSOR_DRIFT") \
    < cand.index("DISCOVERY_GRAD_DEPENDENCY_DRIFT") < cand.index("create function") < cand.index("DISCOVERY_GRAD_FOLD_TRUTH_TABLE") < cand.index("DISCOVERY_GRAD_CERTIFICATE_MOVED")

# --- the fold: the SQL body is the letter table of the manifest, and the truth table agrees with an independent Python oracle
fold_body = re.search(r"create function public\.discovery_fold_v1\(value text\).*?\nas \$dg_body\$(.*?)\$dg_body\$;", cand, re.S).group(1)
assert md5(fold_body) == manifest["newFunctions"][0]["body_md5"]
fold = manifest["fold"]
two = {int(k[2:], 16): v for k, v in fold["twoLetters"].items()}
one = {int(k[2:], 16): v for k, v in fold["oneLetter"].items()}
for code_point, latin in two.items():
    assert f"chr({code_point}),'{latin}')" in fold_body
src = re.search(r"\n    ((?:chr\(\d+\)\|\|)*chr\(\d+\)),\n    '([a-z]+)'\);", fold_body)
assert [int(x) for x in re.findall(r"chr\((\d+)\)", src.group(1))] == list(one) and src.group(2) == "".join(one.values())
assert "lower(value collate pg_catalog.\"sr-Latn-RS-x-icu\")" in fold_body and "unaccent" not in fold_body and "regexp" not in fold_body


def oracle(value):
    if value is None:
        return None
    s = value.lower()
    for c, latin in two.items():
        s = s.replace(chr(c), latin)
    return "".join(one.get(ord(ch), ch) for ch in s)


for row in manifest["foldTruthTable"]:
    assert oracle(row["input"]) == row["expected"], row
# every Serbian letter, both alphabets, both cases: plain ASCII after the fold; nothing outside the table changes but for case
latin = "abcčćddžđefghijklljmnnjoprsštuvzž"
cyrillic = "абвгдђежзијклљмнњопрстћуфхцчџш"
for alphabet in (latin, latin.upper(), cyrillic, cyrillic.upper()):
    assert oracle(alphabet).isascii(), alphabet
assert oracle("Đorđe") == oracle("Djordje") == oracle("ЂОРЂЕ") == "djordje" and oracle("Čačak") == oracle("CACAK") == "cacak"
assert oracle("Ödön, Zürich") == "ödön, zürich" and oracle("  a  ") == "  a  "
# monotone: a per-letter map (each letter -> one or two letters, never removed), so a substring before is a substring after
assert all(len(v) >= 1 for v in list(one.values()) + list(two.values()))

# --- the reader boundaries
assert "public.discovery_fold_v1(coalesce(n.title,''))" in after and "fold_text)=0" in after
assert after.count("public.discovery_for_me_v1(") == 2, "DISCOVERY-ZAMENE kept"
assert "public.p6_discovery_key(b.area_text) not in ('na daljinu','lokacija nije navedena')" in after, "remote and no-place never match a place"
assert "b.execution_location_mode is distinct from 'REMOTE'" in after
shared = after[after.index(" ), shared as materialized ("):after.index(" ), qualified as materialized (")]
assert "fold_place" in shared and "fold_text" in shared and "lower(" not in code(shared), "the place and word checks go through the fold only"
places_block = after[after.index("  ), facet_keys as materialized ("):after.index("  ), facet_page as materialized (")]
assert "distinct on(fold_key)" in places_block and "group by fold_key" in places_block and "public.p6_discovery_key(p.shown) as key" in places_block
assert "place_level='CITY'" in places_block and "public.p6_discovery_unquote(approximate_city)" in places_block
# the city of a task is computed by the SAME expression in PLACES (grouping) and in PAGE/MAP (the filter): a city row lists what the filter finds
city_places = "coalesce(public.p6_discovery_unquote(approximate_city),\n     nullif(public.p6_discovery_trim(substring(area_text from '[^,]*$')),''),area_text)"
city_filter = "coalesce(public.p6_discovery_unquote(b.approximate_city),\n        nullif(public.p6_discovery_trim(substring(b.area_text from '[^,]*$')),''),b.area_text)"
assert city_places in places_block and city_filter in shared
assert re.sub(r"\s+", " ", city_places) == re.sub(r"\s+", " ", city_filter.replace("b.", ""))
# filterKey: f is built exactly as before; only PLACES with groupBy CITY adds to the key
f_before = live[READER][live[READER].index(" f:=jsonb_build_object('text',query_text"):live[READER].index(" -- PLACES binds its prefix/area too")]
f_after = after[after.index(" f:=jsonb_build_object('text',query_text"):after.index(" -- PLACES binds its prefix/area too")]
assert f_before == f_after
assert "||case when place_level='CITY' then '{\"groupBy\":\"CITY\"}'::jsonb else '{}'::jsonb end" in after
# shown texts and keys: the response objects are built by the same expressions as before (no new response field)
for kept in ("'items',coalesce((select jsonb_agg(jsonb_build_object('key',key,'text',text,'count',count)", "'approximateCity',nullif(btrim(s.approximate_city),'')",
             "'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,\n    'everywhere'"):
    assert kept in after and kept in live[READER], kept
print(f"PASS DISCOVERY-GRAD offline: generators exact, {checked} SQL/PLpgSQL units parsed, fold oracle {len(manifest['foldTruthTable'])} probes, reader boundaries hold; runtime proof pending")
