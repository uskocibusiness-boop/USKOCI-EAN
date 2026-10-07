"""DISCOVERY-GRAD generator: the place filter of rpc_discovery_v1 finds the task's CITY, and words and places are found
without regard to Serbian letters and case (owner decision d14, "DA", 2026-10-07).

One new IMMUTABLE helper, public.discovery_fold_v1(text), and anchored edits of ONE body, public.rpc_discovery_v1(jsonb),
on top of its DEV body (the DISCOVERY-ZAMENE postimage, pinned). Never connects to a database. Every SQL file is pure
ASCII (non-ASCII letters are written as chr(n)), so no transport can rewrite an escape. `--check` compares the generated
bytes with the files.
"""
from pathlib import Path
import argparse
import difflib
import hashlib
import json

HERE = Path(__file__).resolve().parent
rows = json.loads((HERE / "live-functions.json").read_text(encoding="utf-8"))
live = {r["signature"]: r["body"] for r in rows}


def md5(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


for r in rows:
    assert "\r" not in r["body"] and md5(r["body"]) == r["body_md5"], r["signature"]

READER = "public.rpc_discovery_v1(jsonb)"
FOLD = "public.discovery_fold_v1(text)"
assert list(live) == [READER]
assert md5(live[READER]) == "dc69802e3ba209232a8be095f60e9c9f", "the DEV body read on 2026-10-08 (DISCOVERY-ZAMENE postimage)"
after = {READER: live[READER]}
edits = []


def change(old, new):
    body = after[READER]
    assert body.count(old) == 1, ("ANCHOR_DRIFT", old[:90])
    after[READER] = body.replace(old, new, 1)
    edits.append({"signature": READER, "before": old, "after": new})


# ---------------------------------------------------------------- the reader
change(" prefix_text text; facet_area jsonb; before_count bigint; before_text text; before_key text;\n",
       " prefix_text text; facet_area jsonb; before_count bigint; before_text text; before_key text;\n"
       " fold_text text; fold_place text; fold_prefix text; place_level text:='AREA';\n")
change("  if r-array['mode','filter','anchor','prefix','facetArea','limit','after']<>'{}'\n"
       "    or not(r?&array['mode','filter','anchor','prefix','facetArea','limit','after'])\n",
       "  if r-array['mode','filter','anchor','prefix','facetArea','limit','after','groupBy']<>'{}'\n"
       "    or not(r?&array['mode','filter','anchor','prefix','facetArea','limit','after'])\n"
       "    or (r?'groupBy' and (jsonb_typeof(r->'groupBy') is distinct from 'string' or r->>'groupBy' not in ('AREA','CITY')))\n")
change("  prefix_text:=public.p6_discovery_key(r->>'prefix'); f:=r->'filter'; page_limit:=(r->>'limit')::integer;\n",
       "  prefix_text:=public.p6_discovery_key(r->>'prefix'); f:=r->'filter'; page_limit:=(r->>'limit')::integer;\n"
       "  -- DISCOVERY-GRAD (owner 2026-10-07): the optional groupBy CITY lists cities instead of place texts; absent or AREA is the list of before.\n"
       "  place_level:=coalesce(r->>'groupBy','AREA'); fold_prefix:=public.discovery_fold_v1(prefix_text);\n")
change(" f:=jsonb_build_object('text',query_text,'price',price,'where',location_mode,'places',people,'when',when_mode,\n",
       " -- DISCOVERY-GRAD (owner 2026-10-07): words and places are FOUND through discovery_fold_v1 (Serbian letters and case do not\n"
       " -- matter); what the request binds (filterKey, anchors, cursors) and every text that is shown stay exactly as before.\n"
       " fold_text:=public.discovery_fold_v1(query_text); fold_place:=public.discovery_fold_v1(locality);\n"
       " f:=jsonb_build_object('text',query_text,'price',price,'where',location_mode,'places',people,'when',when_mode,\n")
change(" filter_key:=md5(case when request_mode='PLACES' then jsonb_build_object('filter',f,'prefix',prefix_text,'facetArea',facet_area)::text else f::text end);\n",
       " filter_key:=md5(case when request_mode='PLACES' then (jsonb_build_object('filter',f,'prefix',prefix_text,'facetArea',facet_area)\n"
       "   ||case when place_level='CITY' then '{\"groupBy\":\"CITY\"}'::jsonb else '{}'::jsonb end)::text else f::text end);\n")
# PLACES (the dedicated block; the PLACES arm of the general statement below is unreachable since P6 places cost v1 and stays as it is)
change("  ), facet_keys as materialized (\n"
       "   select public.p6_discovery_key(area_text) as key,area_text as text,raw_count,id,published_at\n"
       "   from facet_raw\n"
       "  ), facet_members as materialized (\n"
       "   select * from facet_keys\n"
       "   where key not in ('na daljinu','lokacija nije navedena')\n"
       "    and (prefix_text='' or strpos(key,prefix_text)>0)\n"
       "  ), facet_representatives as materialized (\n"
       "   select distinct on(key) key,text from facet_members order by key,published_at desc,id desc\n"
       "  ), facet_counts as materialized (\n"
       "   select key,sum(raw_count)::bigint as count from facet_members group by key\n"
       "  ), facets as materialized (\n"
       "   select c.key,r.text,c.count from facet_counts c join facet_representatives r using(key)\n"
       "  ), facet_page as materialized (\n",
       "  ), facet_keys as materialized (\n"
       "   -- DISCOVERY-GRAD: a row is a place text (AREA, as before) or, with groupBy CITY, the task's city: approximate_city, and\n"
       "   -- for a task that names no city the last part of its place text after a comma. The key stays p6_discovery_key(text).\n"
       "   select public.p6_discovery_key(p.shown) as key,p.shown as text,public.p6_discovery_key(area_text) as area_key,raw_count,id,published_at\n"
       "   from facet_raw cross join lateral (select case when place_level='CITY' then coalesce(public.p6_discovery_unquote(approximate_city),\n"
       "     nullif(public.p6_discovery_trim(substring(area_text from '[^,]*$')),''),area_text) else area_text end as shown) p\n"
       "  ), facet_members as materialized (\n"
       "   -- One row per place as people find it: texts that differ only by Serbian letters or case are one place (discovery_fold_v1).\n"
       "   select k.key,k.text,k.raw_count,k.id,k.published_at,public.discovery_fold_v1(k.key) as fold_key from facet_keys k\n"
       "   where k.area_key not in ('na daljinu','lokacija nije navedena')\n"
       "    and (prefix_text='' or strpos(public.discovery_fold_v1(k.key),fold_prefix)>0)\n"
       "  ), facet_representatives as materialized (\n"
       "   select distinct on(fold_key) fold_key,key,text from facet_members order by fold_key,published_at desc,id desc\n"
       "  ), facet_counts as materialized (\n"
       "   select fold_key,sum(raw_count)::bigint as count from facet_members group by fold_key\n"
       "  ), facets as materialized (\n"
       "   select r.key,r.text,c.count from facet_counts c join facet_representatives r using(fold_key)\n"
       "  ), facet_page as materialized (\n")
# PAGE, MAP, EXACT_PUBLIC. The place text of a task (area_text) is computed per row only for words (one fold per task over title,
# place text and needs: the fold costs more than the place text, so no title-first pass); the place filter is decided ONCE per
# distinct (area, city) text of the rows base already read (place_keys), behind two OFFSET 0 fences.
change("   case when request_mode='PLACES' or locality is not null\n"
       "     or query_text<>'' and strpos(lower(coalesce(n.title,'') collate pg_catalog.\"sr-Latn-RS-x-icu\"),query_text)=0\n",
       "   case when request_mode='PLACES'\n"
       "     or query_text<>''\n")
change(" ), shared as materialized (\n",
       " ), place_keys as materialized (\n"
       "  -- DISCOVERY-GRAD (owner 2026-10-07): a place is the task's whole place text OR its city (approximate_city; for a task that\n"
       "  -- names no city, the last part of its place text after a comma), both compared through discovery_fold_v1. Decided once per\n"
       "  -- distinct (area, city) text of the rows base read (never once per task, never a second read of the tasks); a task then only\n"
       "  -- looks up its key (length-prefixed, so no two texts share one). OFFSET 0 fences: the test would otherwise be pushed below the\n"
       "  -- GROUP BY (it reads only grouping columns) and the place text repeated per use. A remote task and a task without a place text\n"
       "  -- never match a place; a task without a point but with a city does. Both columns are NOT NULL (default ''); coalesce only guards.\n"
       "  select length(p.place_area)::text||':'||p.place_area||p.place_city as place_key from (\n"
       "    select coalesce(b.approximate_area,'') as place_area,coalesce(b.approximate_city,'') as place_city from base b\n"
       "    where locality is not null and b.execution_location_mode is distinct from 'REMOTE' group by 1,2 offset 0) p\n"
       "   cross join lateral (select public.p6_discovery_area(p.place_area,p.place_city,false) as label offset 0) l\n"
       "  where public.p6_discovery_key(l.label) not in ('na daljinu','lokacija nije navedena')\n"
       "   and (public.discovery_fold_v1(public.p6_discovery_key(l.label))=fold_place\n"
       "    or public.discovery_fold_v1(public.p6_discovery_key(coalesce(public.p6_discovery_unquote(p.place_city),\n"
       "      nullif(public.p6_discovery_trim(substring(l.label from '[^,]*$')),''),l.label)))=fold_place)\n"
       " ), shared as materialized (\n")
change("   and (locality is null or b.execution_location_mode is distinct from 'REMOTE' and public.p6_discovery_key(b.area_text)=locality\n"
       "     and public.p6_discovery_key(b.area_text) not in ('na daljinu','lokacija nije navedena'))\n"
       "   and (query_text='' or strpos(lower(coalesce(b.title,'') collate pg_catalog.\"sr-Latn-RS-x-icu\"),query_text)>0\n"
       "    or strpos(lower((coalesce(b.title,'')||' '||b.area_text||' '||array_to_string(coalesce(b.required_skills,'{}')||coalesce(b.required_tools,'{}')||coalesce(b.required_vehicles,'{}'),' ')) collate pg_catalog.\"sr-Latn-RS-x-icu\"),query_text)>0)\n",
       "   -- DISCOVERY-GRAD: the place (its key among place_keys) and the words, found in the title, the place text and the needed\n"
       "   -- skills, tools and vehicles through discovery_fold_v1, one fold per task (the title is the start of that text).\n"
       "   and (locality is null or b.execution_location_mode is distinct from 'REMOTE'\n"
       "     and length(coalesce(b.approximate_area,''))::text||':'||coalesce(b.approximate_area,'')||coalesce(b.approximate_city,'') in (select place_key from place_keys))\n"
       "   and (query_text='' or strpos(public.discovery_fold_v1(coalesce(b.title,'')||' '||b.area_text||' '||array_to_string(coalesce(b.required_skills,'{}')||coalesce(b.required_tools,'{}')||coalesce(b.required_vehicles,'{}'),' ')),fold_text)>0)\n")
NEW_READER = after[READER]
assert "40001" not in NEW_READER and NEW_READER.isascii() and "$dg_body$" not in NEW_READER and "$function$" not in NEW_READER
# the unreachable PLACES arm of the general statement (below the dedicated PLACES block that returns first) keeps its old text
assert "lower(coalesce(n.title" not in NEW_READER and "lower(coalesce(b.title" not in NEW_READER
assert live[READER].count("strpos(key,prefix_text)") == 2 and NEW_READER.count("strpos(key,prefix_text)") == 1
# what the reader must keep: the DISCOVERY-ZAMENE switch, the shapes, the refusals
for kept in ("public.discovery_for_me_v1(n.id)", "public.discovery_for_me_v1(b.id)", "P6_FOR_ME_PROFILE_REQUIRED", "'filterKey',filter_key",
             "P6_PLACE_LABEL_TOO_LONG", "P6_MAP_BOUND_FAILED", "jsonb_build_object('key',key,'text',text,'count',count)"):
    assert kept in NEW_READER, ("KEPT", kept)

# ---------------------------------------------------------------- the fold
# Serbian Latin and Serbian Cyrillic, lower case (the helper lowers first, with the Serbian ICU collation). Five letters
# become TWO Latin letters; the others map one to one. Python oracle below; the SQL body names every letter by chr(n).
FOLD_PAIRS = [(0x0111, "dj"), (0x0452, "dj"), (0x0459, "lj"), (0x045A, "nj"), (0x045F, "dz")]
FOLD_ONE = [(0x010D, "c"), (0x0107, "c"), (0x0161, "s"), (0x017E, "z"),
            (0x0430, "a"), (0x0431, "b"), (0x0432, "v"), (0x0433, "g"), (0x0434, "d"), (0x0435, "e"), (0x0436, "z"), (0x0437, "z"),
            (0x0438, "i"), (0x0458, "j"), (0x043A, "k"), (0x043B, "l"), (0x043C, "m"), (0x043D, "n"), (0x043E, "o"), (0x043F, "p"),
            (0x0440, "r"), (0x0441, "s"), (0x0442, "t"), (0x045B, "c"), (0x0443, "u"), (0x0444, "f"), (0x0445, "h"), (0x0446, "c"),
            (0x0447, "c"), (0x0448, "s")]
assert len({c for c, _ in FOLD_PAIRS + FOLD_ONE}) == len(FOLD_PAIRS) + len(FOLD_ONE) == 35
CYRILLIC_LOWER = "абвгдђежзијклљмнњопрстћуфхцчџш"
assert len(CYRILLIC_LOWER) == 30 and {ord(c) for c in CYRILLIC_LOWER} <= {c for c, _ in FOLD_PAIRS + FOLD_ONE}


def oracle(value):
    """The fold, independently of SQL: lower case, then the letter table."""
    if value is None:
        return None
    s = value.lower()
    for code, latin in FOLD_PAIRS:
        s = s.replace(chr(code), latin)
    return "".join(dict((chr(c), t) for c, t in FOLD_ONE).get(ch, ch) for ch in s)


def chrs(codes):
    return "||".join("chr(%d)" % c for c in codes)


FOLD_FROM = chrs([c for c, _ in FOLD_ONE])
FOLD_TO = "'" + "".join(t for _, t in FOLD_ONE) + "'"
REPLACED = "lower(value collate pg_catalog.\"sr-Latn-RS-x-icu\")"
for code, latin in FOLD_PAIRS:
    REPLACED = "replace(" + REPLACED + ",chr(%d),'%s')" % (code, latin)
# PL/pgSQL on purpose: the body is ONE simple expression, which PL/pgSQL evaluates without starting the executor; a SQL function
# that cannot be inlined (it has SET search_path) runs the executor on every call (measured in CI: about 8.5 us per call).
FOLD_BODY = ("\n"
             "begin\n"
             "  -- DISCOVERY-GRAD (owner 2026-10-07): the one fold that FINDING words and places uses, never what is shown or stored.\n"
             "  -- Lower case (Serbian ICU), then Serbian Latin and Serbian Cyrillic letters to plain Latin, letter by letter: c with caron\n"
             "  -- and c with acute -> c, s with caron -> s, z with caron -> z, d with stroke -> dj (so the dj spelling and the d-with-stroke\n"
             "  -- spelling are one word), Cyrillic dje -> dj, lje -> lj, nje -> nj, dzhe -> dz, tshe -> c and every other Serbian Cyrillic\n"
             "  -- letter to its Latin letter. Every other character stays as it is: the fold maps letters and never removes one, so a\n"
             "  -- text that contained a word before still contains it afterwards.\n"
             "  return translate(" + REPLACED + ",\n"
             "    " + FOLD_FROM + ",\n"
             "    " + FOLD_TO + ");\n"
             "end\n")
assert FOLD_BODY.isascii() and "40001" not in FOLD_BODY
FOLD_HEAD = ("create function public.discovery_fold_v1(value text)\n returns text\n language plpgsql\n immutable\n"
             " set search_path to 'pg_catalog'\nas ")
ACL = "{postgres=X/postgres,authenticated=X/postgres}"

# The truth table checked inside the apply (and in the postflight): inputs written with chr(n), outputs plain ASCII.
PROBES = ["Čačak", "ČAČAK", "Đorđe", "Djordje", "Ђорђе", "čistim", "Novi Sad",
          "Нови Сад", "Šabac", "Žabalj", "Ćuprija", "Ћуприја",
          "Љубовија", "Његош", "Џеп", "Džep", "  X  ",
          "ABC-123", CYRILLIC_LOWER, CYRILLIC_LOWER.upper(), "abcčćddžđefghijklljmnnjoprsštuvzž", "", None,
          "Niš", "Inđija", "ššš"]
assert len(PROBES) == len(set(PROBES)) == 26


def sql_text(value):
    if value is None:
        return "null::text"
    if value == "":
        return "''::text"
    parts, run = [], ""
    for ch in value:
        if ord(ch) < 128 and ch != "'":
            run += ch
        else:
            if run:
                parts.append("'" + run + "'")
                run = ""
            parts.append("chr(%d)" % ord(ch))
    if run:
        parts.append("'" + run + "'")
    return "(" + "||".join(parts) + ")"


EXPECTED = [oracle(p) for p in PROBES]
assert EXPECTED[0] == "cacak" and EXPECTED[2] == EXPECTED[3] == EXPECTED[4] == "djordje" and EXPECTED[7] == "novi sad"
assert EXPECTED[18] == "abvgddjezzijklljmnnjoprstcufhccdzs" and EXPECTED[19] == EXPECTED[18] and EXPECTED[22] is None
assert all(e is None or e.isascii() for e in EXPECTED)
PROBE_VALUES = ",\n".join("  (" + sql_text(p) + "," + ("null::text" if e is None else "'" + e + "'") + ")" for p, e in zip(PROBES, EXPECTED))
TRUTH = ("select count(*) from (values\n" + PROBE_VALUES + ") t(input,expected)\n"
         "  where public.discovery_fold_v1(t.input) is distinct from t.expected")

# ---------------------------------------------------------------- pins
# What the new body calls and relies on (DEV md5, read-only 2026-10-08). The reader's own predecessor is pinned separately.
DEPENDENCIES = [
    ("public.p6_discovery_key(text)", "ebfe1252f1798d89bbffb35b6eef6167"),
    ("public.p6_discovery_trim(text)", "40109e93b620146aa8d536907d28c91b"),
    ("public.p6_discovery_unquote(text)", "35706ddc2125e8cacf74ee370f82ff2f"),
    ("public.p6_discovery_area(text,text,boolean)", "041441c14c18230a8da05a97c53ab350"),
    ("public.discovery_for_me_state_v1()", "bd4dcf16863e7564a5d82ac22aca1418"),
    ("public.discovery_for_me_v1(uuid)", "60c104139cebbccfa16a570fc3386c0c"),
]
COLLATION = "sr-Latn-RS-x-icu"


def quote(s):
    return "'" + s.replace("'", "''") + "'"


def dollar(s, tag="dg_body"):
    assert "$" + tag + "$" not in s
    return "$" + tag + "$" + s + "$" + tag + "$"


CERT_READY = """ if private.closure_source_digest_v5() is null or private.closure_erasure_program_digest_v5() is null
  or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
  or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
  or private.retention_ai_source_ready() is distinct from true
 then raise exception '%s' using errcode='55000'; end if;
"""


def pins(label, pairs):
    return (" for r in select * from (values\n" + ",\n".join("  (" + quote(s) + "," + quote(m) + ")" for s, m in pairs)
            + ") pins(signature,body_md5) loop\n"
              "  if (select md5(p.prosrc) from pg_proc p where p.oid=to_regprocedure(r.signature)) is distinct from r.body_md5\n"
              "  then raise exception '" + label + ": %',r.signature using errcode='55000'; end if;\n end loop;\n")


def replace(source, target, label):
    return ("do $dg_replace$\ndeclare o oid; body text; def text; meta jsonb; comment_before text; new_body text:=" + dollar(target) + ";\nbegin\n"
            " o:=to_regprocedure(" + quote(READER) + ");\n"
            " if o is null then raise exception '" + label + "_MISSING_FUNCTION' using errcode='55000'; end if;\n"
            " select p.prosrc,to_jsonb(p)-'prosrc',obj_description(p.oid,'pg_proc') into strict body,meta,comment_before from pg_proc p where p.oid=o;\n"
            " if md5(body) is distinct from " + quote(md5(source)) + " then raise exception '" + label + "_PREIMAGE_DRIFT' using errcode='55000'; end if;\n"
            " if md5(new_body) is distinct from " + quote(md5(target)) + " then raise exception '" + label + "_PAYLOAD_DRIFT' using errcode='55000'; end if;\n"
            " def:=pg_get_functiondef(o);\n"
            " if (length(def)-length(replace(def,body,'')))/length(body)<>1 then raise exception '" + label + "_BODY_ANCHOR_DRIFT' using errcode='55000'; end if;\n"
            " execute replace(def,body,new_body);\n"
            " if (select p.prosrc from pg_proc p where p.oid=o) is distinct from new_body\n"
            "  or (select to_jsonb(p)-'prosrc' from pg_proc p where p.oid=o) is distinct from meta\n"
            "  or obj_description(o,'pg_proc') is distinct from comment_before\n"
            " then raise exception '" + label + "_POSTIMAGE_OR_METADATA_DRIFT' using errcode='55000'; end if;\n"
            "end\n$dg_replace$;\n")


def fold_check(label):
    return (" if (select count(*) from pg_proc p where p.oid=to_regprocedure(" + quote(FOLD) + ") and md5(p.prosrc)=" + quote(md5(FOLD_BODY)) + "\n"
            "     and not p.prosecdef and p.provolatile='i' and p.proowner='postgres'::regrole\n"
            "     and p.prolang=(select oid from pg_language where lanname='plpgsql') and p.prorettype='text'::regtype\n"
            "     and p.proconfig=array['search_path=pg_catalog'] and p.proacl::text=" + quote(ACL) + ")<>1\n"
            " then raise exception '" + label + "' using errcode='55000'; end if;\n")


CERT_TABLE = ("create temporary table dg_certificate on commit drop as\n"
              " select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program;\n")


def cert_moved(label):
    return (" if private.closure_source_digest_v5() is distinct from (select digest from dg_certificate)\n"
            "  or private.closure_erasure_program_digest_v5() is distinct from (select program from dg_certificate)\n"
            " then raise exception '" + label + "' using errcode='55000'; end if;\n")


HEADER = ("-- DISCOVERY-GRAD {d}: SOURCE ONLY. NOT APPLIED. Canonical DEV only on the owner's exact word \"PRIMENI DISCOVERY-GRAD\",\n"
          "-- and only on top of DISCOVERY-ZAMENE (the reader's DEV body dc69802e is pinned).\n"
          "-- Owner decision d14 (2026-10-07): the place filter finds the task's city, and words and places are found without regard to\n"
          "-- Serbian letters and case. One new IMMUTABLE helper (public.discovery_fold_v1) + one function body; no table, column,\n"
          "-- trigger, policy or grant change on an existing object; closure certificate asserted unchanged; no retried errcode (B24).\n"
          "-- Pure ASCII: every non-ASCII letter is chr(n). Generated by build_candidate.py; do not edit.\n")


def candidate(transaction=True):
    s = HEADER.format(d="CANDIDATE")
    if transaction:
        s += "begin;\n"
    s += "set local lock_timeout='5s';\nset local statement_timeout='120s';\nset local search_path=pg_catalog;\n"
    s += "do $dg_pre$\ndeclare r record;\nbegin\n" + CERT_READY % "DISCOVERY_GRAD_CERTIFICATE_NOT_READY"
    # A repeated or partial application is named first, before any predecessor pin can report drift.
    s += (" if to_regprocedure(" + quote(FOLD) + ") is not null\n"
          "  or exists(select 1 from pg_proc p where p.pronamespace in ('public'::regnamespace,'private'::regnamespace) and p.proname='discovery_fold_v1')\n"
          "  or (select md5(prosrc) from pg_proc where oid=to_regprocedure(" + quote(READER) + "))=" + quote(md5(NEW_READER)) + "\n"
          " then raise exception 'DISCOVERY_GRAD_ALREADY_OR_PARTIALLY_APPLIED' using errcode='55000'; end if;\n")
    s += pins("DISCOVERY_GRAD_PREDECESSOR_DRIFT", [(READER, md5(live[READER]))])
    s += pins("DISCOVERY_GRAD_DEPENDENCY_DRIFT", DEPENDENCIES)
    s += (" if not exists(select 1 from pg_collation where collname=" + quote(COLLATION) + " and collprovider='i')\n"
          " then raise exception 'DISCOVERY_GRAD_COLLATION_MISSING' using errcode='55000'; end if;\n")
    s += "end\n$dg_pre$;\n"
    s += CERT_TABLE
    s += FOLD_HEAD + dollar(FOLD_BODY) + ";\n"
    s += f"revoke all on function {FOLD} from public, anon, authenticated, service_role;\n"
    s += f"grant execute on function {FOLD} to authenticated;\n"
    s += replace(live[READER], NEW_READER, "DISCOVERY_GRAD")
    s += "do $dg_post$\nbegin\n" + fold_check("DISCOVERY_GRAD_HELPER_DRIFT")
    s += " if (" + TRUTH + ")<>0\n then raise exception 'DISCOVERY_GRAD_FOLD_TRUTH_TABLE' using errcode='55000'; end if;\n"
    s += (" if (select md5(prosrc) from pg_proc where oid=to_regprocedure(" + quote(READER) + ")) is distinct from " + quote(md5(NEW_READER)) + "\n"
          "  or (select proacl::text from pg_proc where oid=to_regprocedure(" + quote(READER) + ")) is distinct from " + quote(ACL) + "\n"
          " then raise exception 'DISCOVERY_GRAD_READER_DRIFT' using errcode='55000'; end if;\n")
    s += cert_moved("DISCOVERY_GRAD_CERTIFICATE_MOVED")
    s += CERT_READY % "DISCOVERY_GRAD_CERTIFICATE_NOT_READY_AFTER" + "end\n$dg_post$;\n"
    if transaction:
        s += "commit;\n"
    return s


def revert():
    s = HEADER.format(d="EXACT REVERT") + "-- Restores the DISCOVERY-ZAMENE body of rpc_discovery_v1 (DEV dc69802e) and drops the fold helper. Code rollback only.\n"
    s += "begin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\nset local search_path=pg_catalog;\n"
    s += "do $dg_revert_pre$\nbegin\n" + CERT_READY % "DISCOVERY_GRAD_REVERT_CERTIFICATE_NOT_READY"
    s += (" if (select md5(prosrc) from pg_proc where oid=to_regprocedure(" + quote(READER) + ")) is distinct from " + quote(md5(NEW_READER)) + "\n"
          " then raise exception 'DISCOVERY_GRAD_REVERT_PREIMAGE_DRIFT' using errcode='55000'; end if;\n")
    s += fold_check("DISCOVERY_GRAD_REVERT_HELPER_DRIFT")
    # Nothing else may have started to call the helper since (a later package would break silently).
    s += (" if exists(select 1 from pg_proc p where p.oid<>to_regprocedure(" + quote(READER) + ") and p.oid<>to_regprocedure(" + quote(FOLD) + ")\n"
          "   and p.prosrc like '%discovery_fold_v1%')\n"
          " then raise exception 'DISCOVERY_GRAD_REVERT_HELPER_IN_USE' using errcode='55000'; end if;\n")
    s += "end\n$dg_revert_pre$;\n"
    s += CERT_TABLE
    s += replace(NEW_READER, live[READER], "DISCOVERY_GRAD_REVERT")
    s += f"drop function {FOLD};\n"
    s += "do $dg_revert_post$\nbegin\n"
    s += (" if to_regprocedure(" + quote(FOLD) + ") is not null\n"
          "  or (select md5(prosrc) from pg_proc where oid=to_regprocedure(" + quote(READER) + ")) is distinct from " + quote(md5(live[READER])) + "\n"
          "  or (select proacl::text from pg_proc where oid=to_regprocedure(" + quote(READER) + ")) is distinct from " + quote(ACL) + "\n"
          " then raise exception 'DISCOVERY_GRAD_REVERT_INCOMPLETE' using errcode='55000'; end if;\n")
    s += cert_moved("DISCOVERY_GRAD_REVERT_CERTIFICATE_MOVED")
    s += CERT_READY % "DISCOVERY_GRAD_REVERT_CERTIFICATE_NOT_READY_AFTER" + "end\n$dg_revert_post$;\ncommit;\n"
    return s


def dependency_flags():
    return (" 'dependencies',(select bool_and(md5(p.prosrc) is not distinct from x.body_md5) from (values\n"
            + ",\n".join("  (" + quote(s) + "," + quote(m) + ")" for s, m in DEPENDENCIES) +
            ") x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature)),\n")


CERT_FLAGS = (" 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)\n"
              "   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)\n"
              "   and private.retention_ai_source_ready(),\n"
              " 'closureDigest',private.closure_source_digest_v5(),\n"
              " 'erasureProgramDigest',private.closure_erasure_program_digest_v5()\n")

PREFLIGHT = ("-- DISCOVERY-GRAD read-only preflight for canonical DEV leqcwgzvjsxugfgzdmth. No write. Expected: every flag true,\n"
             "-- certificate 3a785d42... / 2027655d... (the values of 2026-10-08), the retried-literal count 0 (B24).\n"
             "select jsonb_build_object(\n"
             " 'ledger',(select count(*) from supabase_migrations.schema_migrations),\n"
             " 'latestVersion',(select max(version) from supabase_migrations.schema_migrations),\n"
             " 'readerIsDiscoveryZamene',(select md5(prosrc) from pg_proc where oid=to_regprocedure(" + quote(READER) + "))=" + quote(md5(live[READER])) + ",\n"
             " 'readerAcl',(select proacl::text from pg_proc where oid=to_regprocedure(" + quote(READER) + ")),\n"
             + dependency_flags() +
             " 'helperAbsent',to_regprocedure(" + quote(FOLD) + ") is null,\n"
             " 'collationReady',exists(select 1 from pg_collation where collname=" + quote(COLLATION) + " and collprovider='i'),\n"
             " 'retriedLiteralFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%40001%'),\n"
             " 'openTasks',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null and remaining_search_closed_at is null),\n"
             " 'openTasksWithoutCityButAreaWithComma',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null\n"
             "   and nullif(btrim(coalesce(approximate_city,'')),'') is null and strpos(coalesce(approximate_area,''),',')>0),\n"
             + CERT_FLAGS +
             ") as discovery_grad_preflight;\n")

POSTFLIGHT = ("-- DISCOVERY-GRAD read-only postflight. No write. Expected: every flag true, foldTruthTableMismatches 0, the certificate equal to the preflight.\n"
              "select jsonb_build_object(\n"
              " 'readerAfter',(select md5(prosrc) from pg_proc where oid=to_regprocedure(" + quote(READER) + "))=" + quote(md5(NEW_READER)) + ",\n"
              " 'readerAcl',(select proacl::text from pg_proc where oid=to_regprocedure(" + quote(READER) + ")),\n"
              " 'helper',(select md5(p.prosrc)=" + quote(md5(FOLD_BODY)) + " and p.provolatile='i' and not p.prosecdef and p.proacl::text=" + quote(ACL) + "\n"
              "   and p.proconfig=array['search_path=pg_catalog'] from pg_proc p where p.oid=to_regprocedure(" + quote(FOLD) + ")),\n"
              " 'foldTruthTableMismatches',(" + TRUTH + "),\n"
              + dependency_flags() +
              " 'retriedLiteralFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%40001%'),\n"
              + CERT_FLAGS +
              ") as discovery_grad_postflight;\n")

files = {
    "candidate.sql": candidate(),
    "candidate.in-transaction.sql": candidate(transaction=False),
    "revert.sql": revert(),
    "preflight.readonly.sql": PREFLIGHT,
    "postflight.readonly.sql": POSTFLIGHT,
    "body.diff": "".join(difflib.unified_diff(live[READER].splitlines(True), NEW_READER.splitlines(True),
                                              fromfile=READER + " BEFORE (DEV, DISCOVERY-ZAMENE)", tofile=READER + " AFTER (DISCOVERY-GRAD)")),
    "patches.json": json.dumps(edits, indent=2, ensure_ascii=False) + "\n",
}
for name, content in files.items():
    if name.endswith(".sql"):
        assert content.isascii() and "\r" not in content, ("ASCII_ONLY", name)
        # the read-only checks count the literal on the server; nothing that is applied carries it
        assert content.replace("p.prosrc like '%40001%'", "").count("40001") == 0, ("B24_PT409_RULE", name)
manifest = {
    "id": "DISCOVERY-GRAD", "status": "SOURCE_ONLY_NOT_APPLIED", "target": "leqcwgzvjsxugfgzdmth",
    "requiresOwnerWord": "PRIMENI DISCOVERY-GRAD", "requiresApplied": "DISCOVERY-ZAMENE (and through it MATCH-V1)",
    "devStateReadAt": "2026-10-08", "devLedger": 232, "devLatestVersion": "20261007204555",
    "devClosureDigest": "3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23",
    "devErasureProgramDigest": "2027655db33bc06d302376a09756f4b25962db20c25a31dabcc56354571a176f",
    "certificateMoves": False,
    "closureRoster": "closure_source_digest_v5 hashes a fixed list of 99 function signatures plus the schema digest and the erasure program digest; "
                     "rpc_discovery_v1 is not in it (DISCOVERY-ZAMENE replaced the same body with the certificate unchanged) and a new non-trigger function is not hashed. "
                     "The apply and the revert assert both digests unchanged.",
    "functions": [{"signature": READER, "before_md5": md5(live[READER]), "after_md5": md5(NEW_READER),
                   "language": "plpgsql", "volatility": "STABLE", "securityDefiner": False, "config": ["search_path=pg_catalog"], "acl": ACL}],
    "newFunctions": [{"signature": FOLD, "body_md5": md5(FOLD_BODY), "language": "plpgsql", "volatility": "IMMUTABLE", "securityDefiner": False,
                      "config": ["search_path=pg_catalog"], "acl": ACL}],
    "dependencyPins": [{"signature": s, "body_md5": m} for s, m in DEPENDENCIES],
    "collation": COLLATION,
    "fold": {"name": "SR_FOLD_V1", "lower": "lower(value collate \"sr-Latn-RS-x-icu\")",
             "twoLetters": {"U+%04X" % c: t for c, t in FOLD_PAIRS}, "oneLetter": {"U+%04X" % c: t for c, t in FOLD_ONE}},
    "foldTruthTable": [{"input": p, "expected": e} for p, e in zip(PROBES, EXPECTED)],
    "request": {"newKeys": {"PLACES.groupBy": ["AREA", "CITY"]}, "filterKeyChangesOnlyFor": "PLACES with groupBy CITY"},
    "artifact_sha256": {k: sha(v) for k, v in files.items()},
}
files["manifest.json"] = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
for name, content in files.items():
    path = HERE / name
    if args.check:
        assert path.read_bytes() == content.encode("utf-8"), ("GENERATED_FILE_DRIFT", name)
    else:
        path.write_bytes(content.encode("utf-8"))
print("PASS DISCOVERY-GRAD 1 body replacement (" + str(len(edits)) + " anchored edits), 1 helper, " + str(len(DEPENDENCIES)) + " dependency pins, "
      + str(len(PROBES)) + " fold probes; " + ("generated files checked" if args.check else "files generated"))
