"""Derive the narrow R07/R10 price export correction from captured current source.

No network/database access. Two existing export bodies only; the policy,
certificate, schema and privileges remain unchanged and unadmitted.
"""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
PREIMAGE = HERE / 'r07-price-export-current.json'
TARGET = ROOT / 'supabase/candidates/r07_price_export_current.sql'


def digest(value, algorithm='sha256'):
    return hashlib.new(algorithm, value.encode() if isinstance(value, str) else value).hexdigest()


def quote(value):
    return "'" + value.replace("'", "''") + "'"


def body(definition):
    match = re.search(r'\bAS (\$\w*\$)(.*?)\1;', definition, re.S)
    assert match, 'R07_EXPORT_BODY_REQUIRED'
    return match[2]


def definition(entry):
    raw = (ROOT / entry['source']['path']).read_bytes()
    assert digest(raw) == entry['source']['sha256'], entry['name'] + ': source file drift'
    pattern = r'CREATE OR REPLACE FUNCTION ' + re.escape(entry['name']) + r'\([^;]*?\bAS (\$\w*\$)(.*?)\1;'
    matches = [m[0] for m in re.finditer(pattern, raw.decode().replace('\r\n', '\n'), re.S)
               if digest(m[2], 'md5') == entry['body_md5']]
    assert len(matches) == 1, entry['name'] + ': exact captured body required'
    return matches[0]


def replace_once(text, old, new):
    assert text.count(old) == 1, 'R07_EXPORT_EXPECTED_SINGLE_PREDECESSOR: ' + old[:90]
    return text.replace(old, new, 1)


def transform(name, original):
    if name == 'private.data_export_snapshot':
        response = "'needRevision',t.submitted_against_need_revision,'priceRsd',t.price_rsd,"
        response_versions = """'needRevision',t.submitted_against_need_revision,'priceRsd',t.price_rsd,
 'priceBasis',coalesce(t.price_basis,'TOTAL'),'currentVersion',t.current_version,
 'versions',coalesce((select jsonb_agg(jsonb_build_object(
  'version',v.version,'needRevision',v.need_revision,'priceRsd',v.price_rsd,
  'priceBasis',coalesce(v.price_basis,'TOTAL'),'coveredSlots',v.covered_slots,'createdAt',v.created_at)
  order by v.version) from public.marketplace_response_versions v where v.response_id=t.id),'[]'::jsonb),"""
        original = replace_once(original, response, response_versions)
        agreement = "'currentVersion',t.current_version,'createdAt',t.created_at) as value from public.agreements t"
        agreement_versions = """'currentVersion',t.current_version,'createdAt',t.created_at,
 'versions',coalesce((select jsonb_agg(jsonb_build_object(
  'version',v.version,'status',v.status,'supersedesVersion',v.supersedes_version,'createdAt',v.created_at,
  'priceRsd',private.data_export_scalar_v5(v.terms->'price_rsd','number'),
  'priceBasis',case
    when jsonb_typeof(v.terms) is distinct from 'object' then 'null'::jsonb
    when v.terms->'priceBasis' is null or v.terms->'priceBasis'='null'::jsonb then to_jsonb('TOTAL'::text)
    when v.terms->'priceBasis' in ('"TOTAL"'::jsonb,'"HOURLY"'::jsonb) then v.terms->'priceBasis'
    else 'null'::jsonb end,
  'coveredSlots',private.data_export_scalar_v5(v.terms->'covered_slots','number'))
  order by v.version) from public.agreement_versions v where v.agreement_id=t.id),'[]'::jsonb)) as value from public.agreements t"""
        return replace_once(original, agreement, agreement_versions)
    assert name == 'private.data_export_dataset_catalog'
    # Preserve every other dataset and the existing 73-dataset admission contract.
    pattern = r"select '(\[.*?\])'::jsonb"
    match = re.search(pattern, original, re.S)
    assert match, 'R07_EXPORT_CATALOG_LITERAL_REQUIRED'
    catalog = json.loads(match[1].replace("''", "'"))
    additions = {'responses': ['priceBasis', 'currentVersion', 'versions'], 'agreements': ['versions']}
    seen = set()
    for entry in catalog:
        if entry['key'] in additions:
            assert entry['key'] not in seen
            seen.add(entry['key'])
            assert not set(entry['fields']).intersection(additions[entry['key']])
            entry['fields'] = sorted(entry['fields'] + additions[entry['key']])
    assert seen == set(additions)
    return original[:match.start(1)] + json.dumps(catalog, ensure_ascii=False).replace("'", "''") + original[match.end(1):]


def derive():
    capture = json.loads(PREIMAGE.read_text())
    assert capture['project_ref'] == 'leqcwgzvjsxugfgzdmth'
    assert capture['status'] == 'LOCAL_ONLY_NOT_DEPLOYED'
    before, after = {}, {}
    for entry in capture['functions']:
        name = entry['name']
        original = definition(entry)
        changed = transform(name, original)
        assert changed != original and name not in before
        before[name] = {**entry, 'definition': original}
        after[name] = {**entry, 'definition': changed, 'body_md5': digest(body(changed), 'md5')}
    assert len(before) == 2
    dependencies = {f['name']: {**f, 'definition': definition(f)} for f in capture['unchanged_dependencies']}
    return {'capture': capture, 'before': before, 'after': after, 'dependencies': dependencies}


def expected(functions):
    return {name: {k: v for k, v in f.items() if k not in ('name', 'source', 'definition')} for name, f in functions.items()}


CATALOG = """SELECT jsonb_object_agg(e.key,jsonb_build_object(
 'signature',p.oid::regprocedure::text,'body_md5',md5(p.prosrc),
 'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
 'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'result',pg_get_function_result(p.oid)))
 FROM jsonb_each(expected) e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature')"""


def generate():
    data = derive()
    before = expected({**data['before'], **data['dependencies']})
    after = expected({**data['after'], **data['dependencies']})
    schema = '\n'.join(f"""IF NOT EXISTS(SELECT 1 FROM pg_attribute a
 WHERE a.attrelid=to_regclass({quote(c['relation'])}) AND a.attname={quote(c['column_name'])}
 AND format_type(a.atttypid,a.atttypmod)={quote(c['type'])}
 AND a.attnotnull IS NOT DISTINCT FROM {str(c['not_null']).lower()} AND NOT a.attisdropped)
 THEN RAISE EXCEPTION 'R07_EXPORT_SCHEMA_DRIFT: %',{quote(c['relation'] + '.' + c['column_name'])}; END IF;"""
                      for c in data['capture']['read_columns'])
    definitions = '\n'.join('EXECUTE $price_export_definition$\n' + f['definition'] + '\n$price_export_definition$;'
                            for f in data['after'].values())
    assert '$price_export_definition$' not in ''.join(f['definition'] for f in data['after'].values())
    return f"""-- Generated by supabase/proofs/legal/build_price_export_candidate.py.
-- R07/R10 LOCAL_ONLY: two existing export bodies; not a DEV migration/package.
-- Saved units and immutable pricing history, never today's edited task unit.
-- No raw terms, proposed terms, privileges, rows, certificate or readiness edits.
DO $price_export$
DECLARE
 expected jsonb := {quote(json.dumps(before, ensure_ascii=False, separators=(',', ':')))}::jsonb;
 observed jsonb; prior_attributes jsonb; after_attributes jsonb;
 prior_path text := current_setting('search_path');
BEGIN
 IF current_setting('uskoci.r07_export.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
    OR current_user <> 'postgres' THEN RAISE EXCEPTION 'R07_EXPORT_DISPOSABLE_REQUIRED'; END IF;
 PERFORM set_config('search_path','pg_catalog',true);
 SELECT ({CATALOG}) INTO observed;
 IF observed IS DISTINCT FROM expected THEN RAISE EXCEPTION 'R07_EXPORT_SOURCE_OR_ACL_DRIFT'; END IF;
 {schema}
 SELECT jsonb_object_agg(p.oid::text,to_jsonb(p)-'prosrc') INTO prior_attributes
 FROM jsonb_each(expected) e JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
 {definitions}
 expected := {quote(json.dumps(after, ensure_ascii=False, separators=(',', ':')))}::jsonb;
 SELECT ({CATALOG}) INTO observed;
 IF observed IS DISTINCT FROM expected THEN RAISE EXCEPTION 'R07_EXPORT_POSTIMAGE_MISMATCH'; END IF;
 SELECT jsonb_object_agg(p.oid::text,to_jsonb(p)-'prosrc') INTO after_attributes
 FROM jsonb_each(expected) e JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
 IF after_attributes IS DISTINCT FROM prior_attributes THEN RAISE EXCEPTION 'R07_EXPORT_METADATA_CHANGED'; END IF;
 PERFORM set_config('search_path',prior_path,true);
END;
$price_export$;
"""


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--json']:
        print(json.dumps(derive(), ensure_ascii=False))
    elif args == ['--check']:
        assert TARGET.read_text() == generate(), 'R07_EXPORT_GENERATED_SOURCE_DRIFT'
        print('R07_EXPORT_SOURCE_PASS: 2 existing export bodies; no deployment or certificate admission')
    else:
        assert not args, 'Only --check or --json is supported'
        TARGET.write_text(generate(), encoding='utf-8', newline='\n')
        print('Generated LOCAL_ONLY price export candidate; no database connection')
