from pathlib import Path
import hashlib, json, re

root = Path(__file__).resolve().parent
repo = next((p for p in root.parents if (p/'package.json').is_file() and (p/'supabase/functions/uskoci-push-transport/index.ts').is_file()),
 Path(r'C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN/.claude/worktrees/uskoci-kompletan-audit-2e715e'))
# This historical generator patches a predecessor. Refuse before writing any proof output
# once canonical contains the applied feature; keep the frozen promotion evidence intact.
if 'const targeted =' in (repo/'supabase/functions/uskoci-push-transport/index.ts').read_text(encoding='utf-8'):
    raise SystemExit('Historical generator: single-target is already integrated. Run existing proof tests; do not regenerate the frozen promotion bundle.')
baseline = json.loads((root / 'baseline.json').read_text(encoding='utf-8'))
definitions = {r['signature']: r['definition'] for r in baseline['definitions']}
def replace_once(text, old, new):
    if text.count(old) != 1: raise ValueError(('anchor count', text.count(old), old))
    return text.replace(old, new)

claim = definitions['rpc_claim_push_transport(text)']
claim = replace_once(claim, "where x.channel='PUSH' and\n", "where x.channel='PUSH' and not exists(select 1 from public.notification_push_attempts admitted where admitted.delivery_id=x.id and admitted.single_target_admission is not null) and\n")
begin = definitions['rpc_begin_push_send(uuid,uuid)']
begin = replace_once(begin, '  why:=private.push_suppression(d);', '''  if a.single_target_admission is not null then
    if a.single_target_claimed_at is null or a.send_count<>0
       or ((a.single_target_admission->>'expiresAt')::timestamptz>clock_timestamp()) is not true
       or a.device_id::text is distinct from a.single_target_admission->>'deviceId'
       or a.device_revision::text is distinct from a.single_target_admission->>'deviceRevision'
       or dev.bound_session_id::text is distinct from a.single_target_admission->>'boundSessionId'
       or d.event_id::text is distinct from a.single_target_admission->>'eventId'
       or d.recipient_user_id::text is distinct from a.single_target_admission->>'recipientAccountId'
       or d.recipient_role is distinct from a.single_target_admission->>'recipientRole'
       or not exists(select 1 from public.user_activity_events e where e.id=d.event_id and e.event_type='MESSAGE_RECEIVED')
    then why:='SINGLE_TARGET_EXPIRED_OR_CHANGED'; end if;
  end if;
  why:=coalesce(why,private.push_suppression(d));''')
complete = definitions['rpc_complete_push_transport(uuid,uuid,text,text)']
complete = replace_once(complete, ' update public.notification_push_attempts set transport_state=next_state,', ''' -- A one-shot admission never regains send permission, including known provider throttles.
 if a.single_target_admission is not null and next_state='RETRYABLE' then next_state:='FINAL'; end if;
 update public.notification_push_attempts set transport_state=next_state,''')

keys = ['schema','authorizationId','recipientAccountId','recipientRole','eventId','eventType','deviceId','deviceRevision','boundSessionId','expiresAt','receiptDeadline']
key_sql = 'array[' + ','.join("'"+k+"'" for k in keys) + ']'
conditions = ["jsonb_typeof(single_target_admission)='object'",f'single_target_admission ?& {key_sql}',f"single_target_admission - {key_sql} = '{{}}'::jsonb", "single_target_admission->>'schema'='PUSH_SINGLE_TARGET_V1'", "single_target_admission->>'eventType'='MESSAGE_RECEIVED'", "single_target_admission->>'recipientRole' in ('REQUESTER','WORKER')"]
for key in ['authorizationId','recipientAccountId','eventId','deviceId','boundSessionId']:
    conditions.append(f"jsonb_typeof(single_target_admission->'{key}')='string' and single_target_admission->>'{key}' ~ '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$'")
conditions.append("jsonb_typeof(single_target_admission->'deviceRevision')='number' and single_target_admission->>'deviceRevision' ~ '^[0-9]+$'")
for key in ['expiresAt','receiptDeadline']:
    conditions.append(f"jsonb_typeof(single_target_admission->'{key}')='string' and isfinite((single_target_admission->>'{key}')::timestamptz)")
ddl = '''alter table public.notification_push_attempts
 add column single_target_admission jsonb,
 add column single_target_claimed_at timestamptz,
 add column single_target_authorization_id uuid,
 add constraint push_single_target_shape_v1 check (single_target_admission is null or coalesce(
 ''' + '\n and '.join('('+c+')' for c in conditions) + ''',false)),
 add constraint push_single_target_claim_shape_v1 check(single_target_claimed_at is null or single_target_admission is not null),
 add constraint push_single_target_authorization_v1 unique(single_target_authorization_id),
 add constraint push_single_target_authorization_shape_v1 check (
   (single_target_admission is null and single_target_authorization_id is null)
   or (single_target_admission is not null and single_target_authorization_id is not null
    and single_target_authorization_id::text=single_target_admission->>'authorizationId'));
'''
pin_rows = [(r['signature'],r['md5']) for r in baseline['functions']] + [(r['signature'],r['md5']) for r in baseline['closure']]
pins = ',\n'.join("('"+s+"','"+h+"')" for s,h in pin_rows)
header = '''-- DISPOSABLE IMPLEMENTATION CANDIDATE ONLY. Not a DEV migration or complete recertification package.
-- No admission, delivery, provider call or registration is created by installation.
begin;
do $guard$
declare r record;
begin
 if current_user<>'postgres' or current_setting('uskoci.single_target_disposable',true) is distinct from 'SINGLE_TARGET_V1'
 then raise exception 'DISPOSABLE_PROOF_CONTEXT_REQUIRED'; end if;
 if exists(select 1 from pg_attribute where attrelid='public.notification_push_attempts'::regclass and attname in ('single_target_admission','single_target_claimed_at','single_target_authorization_id') and not attisdropped)
 then raise exception 'SINGLE_TARGET_ALREADY_INSTALLED'; end if;
 for r in select * from (values
''' + pins + ''') pins(signature,expected_md5) loop
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.expected_md5
  then raise exception 'SINGLE_TARGET_PREDECESSOR_DRIFT: %',r.signature; end if;
 end loop;
end $guard$;
'''
implementation = header + ddl + '\n' + '\n'.join(x.rstrip().rstrip(';')+';' for x in [claim,begin,complete]) + '\n' + (root/'new-functions.sql').read_text(encoding='utf-8') + '\ncommit;\n'
(root/'install.disposable.sql').write_text(implementation, encoding='utf-8', newline='\n')

# Exact pre-admission restore. Once an admitted attempt exists, containment is revoke/default-off;
# do not delete forensic rows to manufacture rollback or another send opportunity.
changed_definitions = [claim,begin,complete]
new_source = (root/'new-functions.sql').read_text(encoding='utf-8')
revert_pins = []
for signature, definition in zip(['public.rpc_claim_push_transport(text)','public.rpc_begin_push_send(uuid,uuid)','public.rpc_complete_push_transport(uuid,uuid,text,text)'], changed_definitions):
    body = re.search(r'AS (\$[A-Za-z_]*\$)(.*?)\1',definition,re.S|re.I).group(2)
    revert_pins.append((signature,hashlib.md5(body.encode()).hexdigest()))
new_signatures = ['private.admit_push_single_target_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)','public.rpc_claim_push_single_target(uuid)','public.rpc_claim_push_single_target_receipt(uuid)','private.revoke_push_single_target_v1(uuid)']
new_bodies = re.findall(r'as \$body\$(.*?)\$body\$',new_source,re.S|re.I)
if len(new_bodies)!=4: raise ValueError('new function count')
for signature,body in zip(new_signatures,new_bodies): revert_pins.append((signature,hashlib.md5(body.encode()).hexdigest()))
revert_pin_sql = ',\n'.join("('"+s+"','"+h+"')" for s,h in revert_pins)
revert = '''-- DISPOSABLE REVERT ONLY, BEFORE ANY ADMITTED ATTEMPT EXISTS.
begin;
do $guard$ declare r record; begin
 if current_user<>'postgres' or current_setting('uskoci.single_target_disposable',true) is distinct from 'SINGLE_TARGET_V1'
 then raise exception 'DISPOSABLE_PROOF_CONTEXT_REQUIRED'; end if;
 for r in select * from (values
''' + revert_pin_sql + ''') pins(signature,expected_md5) loop
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.expected_md5
  then raise exception 'SINGLE_TARGET_REVERT_DRIFT: %',r.signature; end if;
 end loop;
 if exists(select 1 from public.notification_push_attempts where single_target_admission is not null)
 then raise exception 'ADMITTED_ATTEMPTS_PREVENT_SCHEMA_REVERT'; end if;
end $guard$;
drop function private.revoke_push_single_target_v1(uuid);
drop function public.rpc_claim_push_single_target_receipt(uuid);
drop function public.rpc_claim_push_single_target(uuid);
drop function private.admit_push_single_target_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz);
''' + '\n'.join(x.rstrip().rstrip(';')+';' for x in definitions.values()) + '''
alter table public.notification_push_attempts drop constraint push_single_target_shape_v1, drop constraint push_single_target_claim_shape_v1,
 drop constraint push_single_target_authorization_v1, drop constraint push_single_target_authorization_shape_v1,
 drop column single_target_admission, drop column single_target_claimed_at, drop column single_target_authorization_id;
commit;
'''
(root/'revert.disposable.sql').write_text(revert, encoding='utf-8', newline='\n')

edge_path = Path('supabase/functions/uskoci-push-transport/index.ts')
edge_raw = (repo/edge_path).read_bytes()
edge = edge_raw.decode('utf-8').replace('\r\n','\n')
edge = replace_once(edge, "if (!row(input) || !only(input, ['action']) || !['tick', 'probe'].includes(String(input.action))) return json({ code: 'INVALID_REQUEST' }, 400);", """if (!row(input)) return json({ code: 'INVALID_REQUEST' }, 400);
  const targeted = input.action === 'single_target' || input.action === 'single_target_receipt';
  if (targeted ? (!only(input, ['action', 'admissionId']) || !uuid(input.admissionId))
   : (!only(input, ['action']) || !['tick', 'probe'].includes(String(input.action)))) return json({ code: 'INVALID_REQUEST' }, 400);
  if (targeted && Deno.env.get('EXPO_PUSH_SINGLE_TARGET_ENABLED') !== 'true') return json({ kind: 'DISABLED' });""")
edge = replace_once(edge, "'rpc_record_push_readiness', args: Row", "'rpc_record_push_readiness' | 'rpc_claim_push_single_target' | 'rpc_claim_push_single_target_receipt', args: Row")
edge = replace_once(edge, "reportFailure = () => observe('TICK_FAILED');", "// Targeted actions never record a global tick observation.\n  if (!targeted) reportFailure = () => observe('TICK_FAILED');")
edge = replace_once(edge, "async function once(kind: 'SEND' | 'RECEIPT') {\n   const claim = await rpc('rpc_claim_push_transport', { p_kind: kind });", """async function once(kind: 'SEND' | 'RECEIPT', admissionId?: string) {
   const claim = admissionId
    ? await rpc(kind === 'SEND' ? 'rpc_claim_push_single_target' : 'rpc_claim_push_single_target_receipt', { p_admission_id: admissionId })
    : await rpc('rpc_claim_push_transport', { p_kind: kind });""")
edge = replace_once(edge, "  const receipt = await once('RECEIPT'); const send = await once('SEND');", """  // Exactly one selected lane. Never fall through to global receipt/send scans.
  if (targeted) {
   const state = await once(input.action === 'single_target' ? 'SEND' : 'RECEIPT', input.admissionId as string);
   return json({ kind: 'SINGLE_TARGET_COMPLETED', state });
  }
  const receipt = await once('RECEIPT'); const send = await once('SEND');""")
target = root / edge_path
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(edge,encoding='utf-8',newline='\n')
manifest = {'status':'DISPOSABLE_SOURCE_CANDIDATE_NOT_EXECUTED_NOT_DEV_READY','baselineReadUtc':'2026-10-02T22:42Z','newFunctionBodyMd5':dict(revert_pins),'canonicalEdgeRawSha256':hashlib.sha256(edge_raw).hexdigest(),'canonicalEdgeLfSha256':hashlib.sha256(edge_raw.replace(b'\r\n',b'\n')).hexdigest(),'sourceFiles':{}}
for p in [root/'baseline.json',root/'new-functions.sql',root/'install.disposable.sql',root/'revert.disposable.sql',target]:
    manifest['sourceFiles'][p.relative_to(root).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()
(root/'MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,indent=2))
