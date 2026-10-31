"""Rebuild the guarded, disposable-only R07b candidate from captured source.

No live connection or migration is performed. Original CRLF bytes determine
the source guards; output definitions use LF. Historical rows are not rewritten.
"""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'supabase/proofs/privacy/bootstrap/current-application.sql'
TARGET = ROOT / 'supabase/candidates/r07_hourly_pricing.sql'
EXPECTED = {
    'private.assert_application_price_v5': '1f6cd7c39d5fc70d82cfa8653737246c',
    'public.rpc_submit_response': '14c17e882265084cf73456557c6cb3b6',
    'public.rpc_resolve_stale_response_after_need_edit': 'bd4a46fe5badbfc1e2d80312104c6782',
    'public.rpc_select_response': '5556d638e3befbe9739344b57d94d46a',
    'public.rpc_list_need_candidates': '56b4096cdadbd3bb79f80bc231f796ce',
    'public.rpc_list_need_candidates_page': '9661845e4e6dc993fa719ed8783a307c',
    'public.rpc_list_my_applications': '269185cb640969bb1d92cbb7e2474383',
    'public.rpc_list_my_applications_page': '7c8cf2e6f8748705879e4052135b2779',
    'public.rpc_ai_open_need_edit_conversation_v2': '4567c5e4729923c87efc717007b2cfa1',
}


def replace(source, old, new, count=1):
    assert source.count(old) == count, (old, source.count(old), count)
    return source.replace(old, new)


def unit(need):
    return f"(case when {need}.mode='MY_PRICE' and {need}.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end)"


def transform(name, sql):
    if name == 'public.rpc_ai_open_need_edit_conversation_v2':
        return replace(sql, "v_display:=case v_need.price_basis when 'PER_PERSON' then 'Po osobi' else 'Ukupno' end;",
                       "v_display:=case v_need.price_basis when 'HOURLY' then 'Po osobi po satu' when 'PER_PERSON' then 'Po osobi' else 'Ukupno' end;")
    if name == 'private.assert_application_price_v5':
        return replace(sql, "    elsif n.price_basis = 'PER_PERSON' then", """    elsif n.price_basis = 'HOURLY' then
      -- D06: the amount is a rate per person per hour. Headcount and time
      -- remain separate; no estimated duration or team total is fabricated.
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
      end if;
    elsif n.price_basis = 'PER_PERSON' then""")
    if name in ('public.rpc_submit_response', 'public.rpc_resolve_stale_response_after_need_edit'):
        submit = name.endswith('rpc_submit_response')
        need, price, covered = ('n', 'p_price_rsd', 'p_covered_slots') if submit else ('v_need', 'v_price', 'v_covered')
        basis = unit(need)
        sql = replace(sql, f"'pricingMode', {need}.mode,", f"'pricingMode', {need}.mode,\n    'applicationPriceBasis', {basis},", 2 if submit else 1)
        sql = replace(sql, f'price_rsd = {price},', f'price_rsd = {price},\n            price_basis = {basis},')
        sql = replace(sql, 'response_id, version, need_revision, covered_slots, price_rsd,', 'response_id, version, need_revision, covered_slots, price_rsd, price_basis,')
        ver = f'v_resp.id, v_version, n.revision, {covered}, {price},' if submit else f'v_response.id, v_new_version, v_need.revision, {covered}, {price},'
        sql = replace(sql, ver, ver + ' ' + basis + ',')
        if submit:
            sql = replace(sql, 'price_rsd, proposed_start_at, proposed_end_at, scope_note, submitted_at', 'price_rsd, price_basis, proposed_start_at, proposed_end_at, scope_note, submitted_at')
            sql = replace(sql, 'p_covered_slots, p_price_rsd, p_proposed_start_at, p_proposed_end_at,', f'p_covered_slots, p_price_rsd, {basis}, p_proposed_start_at, p_proposed_end_at,')
        else:
            sql = replace(sql, "    if v_action = 'KEEP' then", f"""    if v_action = 'KEEP' then
      -- Equal numbers with different units are different offers. Historical
      -- null is legacy TOTAL, never inferred from the edited Need.
      if coalesce(v_response.price_basis,'TOTAL') is distinct from {basis} then
        raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409';
      end if;""")
            sql = replace(sql, "      'contentHash', v_content_hash,", f"      'contentHash', v_content_hash,\n      'applicationPriceBasis', {basis},")
        return sql
    if name == 'public.rpc_select_response':
        sql = replace(sql, '  perform private.assert_application_price_v5(v_need, v_ver.covered_slots, v_ver.price_rsd);', f"""  perform private.assert_application_price_v5(v_need, v_ver.covered_slots, v_ver.price_rsd);
  -- Select only the reviewed immutable unit. Old receipts replay above this
  -- guard; existing Agreements and versions remain untouched.
  if coalesce(v_ver.price_basis,'TOTAL') is distinct from {unit('v_need')}
     or coalesce(v_resp.price_basis,'TOTAL') is distinct from coalesce(v_ver.price_basis,'TOTAL') then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409';
  end if;""")
        return replace(sql, "    'price_rsd',v_ver.price_rsd,'covered_slots',v_ver.covered_slots,", "    'price_rsd',v_ver.price_rsd,'priceBasis',coalesce(v_ver.price_basis,'TOTAL'),'covered_slots',v_ver.covered_slots,")
    if name.startswith('public.rpc_list_need_candidates'):
        sql = replace(sql, '      v.price_rsd,', '      v.price_rsd,\n      v.price_basis as application_price_basis,')
        return replace(sql, "'priceRsd', c.price_rsd,", "'priceRsd', c.price_rsd,\n         'applicationPriceBasis', coalesce(c.application_price_basis,'TOTAL'),")
    if name == 'public.rpc_list_my_applications':
        sql = replace(sql, '      r.price_rsd,', '      r.price_rsd,\n      r.price_basis as application_price_basis,')
        return replace(sql, "'priceRsd', m.price_rsd,", "'priceRsd', m.price_rsd,\n        'applicationPriceBasis', coalesce(m.application_price_basis,'TOTAL'),")
    if name == 'public.rpc_list_my_applications_page':
        sql = replace(sql, '    select * from private.own_application_rows(v_actor)', """    select o.*, r.price_basis as application_price_basis
    from private.own_application_rows(v_actor) o
    join public.marketplace_responses r on r.id=o.application_id""")
        return replace(sql, "'priceRsd', p.price_rsd,", "'priceRsd', p.price_rsd, 'applicationPriceBasis', coalesce(p.application_price_basis,'TOTAL'),")
    raise AssertionError(name)


def build():
    raw = SOURCE.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == '1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f'
    functions = {}
    for match in re.finditer(rb'CREATE OR REPLACE FUNCTION ([\w.]+)\([^;]*?\bAS (\$\w*\$)(.*?)\2;', raw, re.S):
        name = match[1].decode()
        if name in EXPECTED:
            assert hashlib.md5(match[3]).hexdigest() == EXPECTED[name], name
            assert name not in functions, name
            functions[name] = transform(name, match[0].decode().replace('\r\n', '\n'))
    assert functions.keys() == EXPECTED.keys()
    guards = json.dumps(EXPECTED, sort_keys=True)
    sql = f"""-- Generated by supabase/proofs/ai/generate_hourly_candidate.py.
-- R07b/D06: reviewed amount unit survives application -> selection -> Agreement.
-- DISPOSABLE ONLY; outside migration inventory. Do not activate Edge HOURLY
-- before additive schema, supported client and old-client upgrade gate are ready.
-- No backfill, receipt rewrite, new endpoint, role or privilege is introduced.
DO $r07b$
DECLARE
  expected jsonb := '{guards}'::jsonb;
  entry record;
  prior jsonb;
  after_metadata jsonb;
BEGIN
  IF current_setting('uskoci.r07b.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY' THEN
    RAISE EXCEPTION 'R07B_DISPOSABLE_TARGET_REQUIRED';
  END IF;
  FOR entry IN SELECT key,value FROM jsonb_each_text(expected) LOOP
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=entry.key::regproc) IS DISTINCT FROM entry.value THEN
      RAISE EXCEPTION 'R07B_SOURCE_DRIFT: %',entry.key;
    END IF;
  END LOOP;
  SELECT jsonb_object_agg(e.key,jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,
    'securityDefiner',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile,'returnType',p.prorettype))
    INTO prior FROM jsonb_each_text(expected) e JOIN pg_proc p ON p.oid=e.key::regproc;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('marketplace_responses','marketplace_response_versions') AND column_name='price_basis') THEN
    RAISE EXCEPTION 'R07B_SCHEMA_ALREADY_CHANGED';
  END IF;
  ALTER TABLE public.marketplace_responses ADD COLUMN price_basis text
    CONSTRAINT marketplace_responses_price_basis_check CHECK (price_basis IN ('TOTAL','HOURLY'));
  ALTER TABLE public.marketplace_response_versions ADD COLUMN price_basis text
    CONSTRAINT marketplace_response_versions_price_basis_check CHECK (price_basis IN ('TOTAL','HOURLY'));
"""
    for name in EXPECTED:
        sql += '\n  EXECUTE $definition$\n' + functions[name] + '\n$definition$;\n'
    sql += """
  SELECT jsonb_object_agg(e.key,jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,
    'securityDefiner',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile,'returnType',p.prorettype))
    INTO after_metadata FROM jsonb_each_text(expected) e JOIN pg_proc p ON p.oid=e.key::regproc;
  IF after_metadata IS DISTINCT FROM prior THEN RAISE EXCEPTION 'R07B_FUNCTION_METADATA_CHANGED'; END IF;
END;
$r07b$;
"""
    return sql


if __name__ == '__main__':
    output = build()
    if sys.argv[1:] == ['--check']:
        assert TARGET.read_text(encoding='utf-8') == output, 'R07b candidate does not match its generator'
        print('R07b candidate generation and all source guards match.')
    else:
        assert not sys.argv[1:], 'Only --check is supported'
        TARGET.write_text(output, encoding='utf-8', newline='\n')
        print(f'Generated {TARGET.name}: {len(EXPECTED)} existing functions, 2 nullable columns; no live changes.')
