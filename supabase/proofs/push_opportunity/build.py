"""Build a rollback-only behavioral candidate. This is NOT a promotion/certificate package."""
import json,hashlib,re
from pathlib import Path
p=Path(__file__).parent
b=json.loads((p/'baseline.json').read_text(encoding='utf-8'))
admit=next(f for f in b['functions'] if 'admit_push_' in f['signature'])
begin=next(f for f in b['functions'] if 'rpc_begin_' in f['signature'])
def replace(s,old,new):
    assert s.count(old)==1,(old[:100],s.count(old))
    return s.replace(old,new)
def ready(meta):
    return """exists (
    select 1 from public.user_activity_events oe
    join public.opportunity_deliveries op on op.id=(META->>'opportunityId')::uuid
    join public.app_profiles wp on wp.id=op.worker_profile_id
    join public.needs n on n.id=op.need_id
    where oe.id=d.event_id and oe.event_type='OPPORTUNITY_AVAILABLE'
      and oe.entity_type='NEED' and oe.entity_id=n.id and oe.entity_version=n.revision
      and oe.recipient_user_id=d.recipient_user_id and oe.recipient_role='WORKER'
      and d.recipient_role='WORKER' and d.expires_at>clock_timestamp()
      and op.worker_account_id=d.recipient_user_id
      and op.worker_profile_id=(META->>'workerProfileId')::uuid
      and op.need_id=(META->>'needId')::uuid
      and op.need_revision::text=META->>'needRevision'
      and op.need_revision=n.revision and op.status='READY'
      and op.expires_at>clock_timestamp()
      and wp.account_id=d.recipient_user_id and wp.kind='WORKER' and wp.profile_status='ACTIVE'
      and private.accounts_same_world(n.requester_account_id,wp.account_id)
      and n.status in ('PUBLISHED','SELECTION') and n.published_at is not null
      and n.remaining_search_closed_at is null
      and private.need_search_time_admitted_v1(n.id,clock_timestamp())
      and n.required_slots>(select coalesce(sum(ns.covered_slots),0)
        from public.need_selections ns where ns.need_id=n.id and ns.status='SELECTED')
      and (private.match_detail(n.id,wp.id)->>'dispatchEligible')::boolean is true
  )""".replace('META',meta)

a=admit['definition']
a=replace(a,'a public.notification_push_attempts%rowtype; meta jsonb;',
          'a public.notification_push_attempts%rowtype; v_event public.user_activity_events%rowtype; v_op public.opportunity_deliveries%rowtype; meta jsonb;')
meta=re.search(r" meta:=jsonb_build_object\('schema'.*?'receiptDeadline',p_receipt_deadline\);",a,re.S).group()
a=replace(a,meta+'\n','')
a=replace(a,' select * into d from public.notification_deliveries where id=p_delivery_id for update;',
 """ -- New admissions follow the same Need-before-delivery order as cancellation.
 -- Existing admission replay does not depend on current opportunity availability.
 perform 1 from public.needs n join public.user_activity_events e on e.entity_id=n.id
  where e.id=p_event_id and e.event_type='OPPORTUNITY_AVAILABLE' and e.entity_type='NEED'
    and not exists(select 1 from public.notification_push_attempts where id=p_admission_id)
  for update of n;
 select * into d from public.notification_deliveries where id=p_delivery_id for update;""")
expanded=meta.replace("'eventType','MESSAGE_RECEIVED'","'eventType',v_event.event_type")
event_read="""
 select * into v_event from public.user_activity_events
 where id=p_event_id and recipient_user_id=p_recipient_user_id and recipient_role=p_recipient_role
   and event_type in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE');
 if not found then raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
METADATA
 if v_event.event_type='OPPORTUNITY_AVAILABLE' then
  if v_event.entity_type<>'NEED' or v_event.recipient_role<>'WORKER' then
   raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
  -- The natural emitter's unique (account,need,revision) row freezes the exact profile and opportunity.
  select * into v_op from public.opportunity_deliveries
  where worker_account_id=p_recipient_user_id and need_id=v_event.entity_id and need_revision=v_event.entity_version;
  if not found then raise exception 'PUSH_OPPORTUNITY_UNAVAILABLE' using errcode='PT409'; end if;
  meta:=meta||jsonb_build_object('opportunityId',v_op.id,'workerProfileId',v_op.worker_profile_id,
    'needId',v_op.need_id,'needRevision',v_op.need_revision);
 end if;
""".replace('METADATA',expanded)
replay_meta=meta.replace("'eventType','MESSAGE_RECEIVED'","'eventType',a.single_target_admission->>'eventType'")
a=replace(a,' if found then\n  if a.delivery_id<>p_delivery_id',
          ' if found then\n'+replay_meta+'\n  if a.delivery_id<>p_delivery_id')
a=replace(a,'a.single_target_admission is distinct from meta',
          "(a.single_target_admission - ARRAY['opportunityId','workerProfileId','needId','needRevision']) is distinct from meta")
a=replace(a,"  return jsonb_build_object('kind','EXISTING','admissionId',a.id,'state',a.transport_state);\n end if;",
          "  return jsonb_build_object('kind','EXISTING','admissionId',a.id,'state',a.transport_state);\n end if;"+event_read)
a=replace(a,"and e.event_type='MESSAGE_RECEIVED')","and e.event_type in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE'))")
a=replace(a,' why:=private.push_suppression(d);',
          " if v_event.event_type='OPPORTUNITY_AVAILABLE' and not "+ready('meta')+" then\n  raise exception 'PUSH_OPPORTUNITY_UNAVAILABLE' using errcode='PT409'; end if;\n why:=private.push_suppression(d);")
s=begin['definition']
s=replace(s,"  perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||dev.expo_push_token,0));",
 """  perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||dev.expo_push_token,0));
  -- Cancellation and selection lock Need before delivery. Keep token first,
  -- then take the exact admitted Need before delivery/attempt, never the inverse.
  -- The readiness predicate below runs again after all potentially waiting locks.
  perform 1 from public.needs n join public.notification_push_attempts t
    on t.single_target_admission->>'eventType'='OPPORTUNITY_AVAILABLE'
    and n.id=(t.single_target_admission->>'needId')::uuid
    where t.id=p_attempt_id for update of n;""")
s=replace(s,"and e.event_type='MESSAGE_RECEIVED')",
 "and e.event_type in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE')\n         and e.event_type=a.single_target_admission->>'eventType')")
s=replace(s,'  why:=coalesce(why,private.push_suppression(d));',
 "  if why is null and a.single_target_admission->>'eventType'='OPPORTUNITY_AVAILABLE'\n     and not "+ready('a.single_target_admission')+" then\n    why:='PUSH_OPPORTUNITY_UNAVAILABLE';\n  end if;\n  why:=coalesce(why,private.push_suppression(d));")
s=replace(s,"  update public.notification_push_attempts\n  set transport_state='SEND_STARTED',send_count=send_count+1",
 """  -- The matcher may take time. Recheck deadlines in a later PL/pgSQL statement,
  -- not as an SQL AND whose evaluation order could precede the expensive work.
  if a.single_target_admission->>'eventType'='OPPORTUNITY_AVAILABLE' and (
    (a.lease_until>clock_timestamp()) is not true
    or ((a.single_target_admission->>'expiresAt')::timestamptz>clock_timestamp()) is not true
    or (d.expires_at>clock_timestamp()) is not true
    or not exists(select 1 from public.opportunity_deliveries final_op
      where final_op.id=(a.single_target_admission->>'opportunityId')::uuid
        and final_op.expires_at>clock_timestamp())
    or private.need_search_time_admitted_v1((a.single_target_admission->>'needId')::uuid,clock_timestamp()) is not true
  ) then
    update public.notification_push_attempts
    set transport_state='SUPPRESSED',outcome='FATAL',error_code='PUSH_OPPORTUNITY_EXPIRED',lease_id=null,lease_until=null
    where id=a.id;
    return jsonb_build_object('kind','SUPPRESSED');
  end if;
  update public.notification_push_attempts
  set transport_state='SEND_STARTED',send_count=send_count+1""")
shape=b['shape']
extra="ARRAY['opportunityId'::text,'workerProfileId'::text,'needId'::text,'needRevision'::text]"
allowed=re.search(r'\(single_target_admission - ARRAY\[.*?\]\)',shape).group()
shape=replace(shape,allowed,allowed[:-1]+' || '+extra+')')
# Parenthesize the allowed-key concatenation: subtraction applies to the whole array.
shape=shape.replace('(single_target_admission - ARRAY[','(single_target_admission - (ARRAY[')
shape=shape.replace("'needRevision'::text]) = '{}'::jsonb)","'needRevision'::text])) = '{}'::jsonb)")
valid="""((single_target_admission->>'eventType') in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE') AND
 (case when single_target_admission->>'eventType'='MESSAGE_RECEIVED'
  then not(single_target_admission ?| EXTRA)
  else single_target_admission ?& EXTRA
    and single_target_admission->>'recipientRole'='WORKER'
    and jsonb_typeof(single_target_admission->'opportunityId')='string'
    and single_target_admission->>'opportunityId' ~ 'UUID'
    and jsonb_typeof(single_target_admission->'workerProfileId')='string'
    and single_target_admission->>'workerProfileId' ~ 'UUID'
    and jsonb_typeof(single_target_admission->'needId')='string'
    and single_target_admission->>'needId' ~ 'UUID'
    and jsonb_typeof(single_target_admission->'needRevision')='number'
    and single_target_admission->>'needRevision' ~ '^[1-9][0-9]*$'
  end))""".replace('EXTRA',extra).replace('UUID','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
shape=replace(shape,"((single_target_admission ->> 'eventType'::text) = 'MESSAGE_RECEIVED'::text)",valid)
defs=[a,s]
sql='-- NOT PROMOTABLE: behavioral candidate only; exact live certificate application is not included.\n-- This file always rolls back. It never admits an event or calls a provider.\nbegin;\nset local statement_timeout=\'20s\';\nset local lock_timeout=\'3s\';\n'
for f in [admit,begin]:
    sql+="do $pin$ begin if (select md5(prosrc) from pg_proc where oid='"+f['signature']+"'::regprocedure) is distinct from '"+f['bodyMd5']+"' then raise exception 'PREDECESSOR_CHANGED';end if;end $pin$;\n"
sql+=';\n'.join(defs)+';\nALTER TABLE public.notification_push_attempts DROP CONSTRAINT push_single_target_shape_v1;\nALTER TABLE public.notification_push_attempts ADD CONSTRAINT push_single_target_shape_v1 '+shape+';\nrollback;\n'
(p/'candidate.rollback.sql').write_bytes(sql.encode('utf-8'))
manifest={'state':'CANDIDATE_ONLY_NOT_PROMOTABLE','baselineSha256':hashlib.sha256((p/'baseline.json').read_bytes()).hexdigest(),
 'candidateSha256':hashlib.sha256(sql.encode()).hexdigest(),'sourceBodyMd5':{f['signature']:f['bodyMd5'] for f in [admit,begin]},
 'candidateBodyMd5':{f['signature']:hashlib.md5(re.search(r'AS \$function\$(.*?)\$function\$',d,re.S).group(1).encode()).hexdigest() for f,d in zip([admit,begin],defs)},
 'limits':['Two existing functions and one CHECK; no grants, schedules, flags, profile or events changed.','Full closure digest changes; exact recertification and post-admission rollback policy are not part of this behavioral candidate.','No provider or physical delivery proof.']}
(p/'manifest.json').write_bytes((json.dumps(manifest,indent=2)+'\n').encode())
print(json.dumps(manifest))
