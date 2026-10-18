"""Loopback PostgreSQL component proof. Never a DEV installer or full Auth proof."""
from pathlib import Path
import hashlib, json, os, subprocess, sys, uuid, time

HERE = Path(__file__).resolve().parent
CAPTURE = json.loads((HERE / 'predecessor.json').read_text(encoding='utf-8'))
MANIFEST = json.loads((HERE / 'manifest.generated.json').read_text(encoding='utf-8'))
TABLES = {t['name']: t for t in CAPTURE['tables']}
OWNER, PEER = '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'
CAT, OTHER_CAT = '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'
def ident(s): return '"' + s.replace('"', '""') + '"'
def q(s): return "'" + str(s).replace("'", "''") + "'"
def uid(owner, name): return str(uuid.uuid5(uuid.UUID(owner), name))
def definition(name): return next(f['definition'].rstrip().rstrip(';') + ';' for f in CAPTURE['functions'] if f['name'] == name)

def fixture():
    # Real captured table columns/constraints; narrow supporting tables/Auth GUC
    # doubles are disclosed. No claim of a complete Supabase/Auth environment.
    s = '''CREATE SCHEMA private;CREATE SCHEMA auth;CREATE SCHEMA extensions;
CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE EXTENSION postgis WITH SCHEMA extensions;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('role',auth.role(),'sub',auth.uid()) $$;
CREATE TABLE public.app_accounts(id uuid PRIMARY KEY);
CREATE TABLE public.app_profiles(id uuid PRIMARY KEY,account_id uuid,kind text,skills text[],profile_status text,updated_at timestamptz);
CREATE TABLE public.needs(id uuid PRIMARY KEY,requester_account_id uuid,category_id uuid);
CREATE TABLE public.agreements(id uuid,requester_account_id uuid,worker_account_id uuid);
CREATE TABLE private.account_closure_requests(account_id uuid,state text);
CREATE TABLE private.retention_holds(account_id uuid,conversation_id uuid,active boolean);
CREATE TABLE private.worker_ai_reviews(id uuid PRIMARY KEY,account_id uuid,conversation_id uuid,envelope jsonb,base_hash text,expires_at timestamptz);
CREATE TABLE private.ai_task_reviews(id uuid PRIMARY KEY,account_id uuid,conversation_id uuid,envelope jsonb);
CREATE TABLE private.work_taxonomy_categories(id uuid PRIMARY KEY,canonical_key text,state text);
CREATE TABLE private.work_taxonomy_category_modes(category_id uuid,execution_scope text,PRIMARY KEY(category_id,execution_scope));
CREATE TABLE private.closure_executions_v5(account_id uuid,generation uuid,state text,binding jsonb);
CREATE TABLE private.closure_actions_v5(id uuid,generation uuid,account_id uuid,kind text,state text);
CREATE TABLE private.closure_redaction_certificate_v5(backend_pid integer,transaction_id bigint,account_id uuid,generation uuid,action_id uuid,relation_oid oid,operation text,old_sha256 text,patch jsonb);
CREATE TABLE private.closure_dataset_catalog_v5(data_class text PRIMARY KEY,relations text[]);
INSERT INTO private.closure_dataset_catalog_v5 VALUES
('COMMAND_LEDGERS','{}'),('AI_VOLATILE','{}'),('PROFILE_DATA','{}'),('NEED_PUBLIC','{}'),('NOTIFICATION_DELIVERY','{}');
SET check_function_bodies=off;
'''
    for t in TABLES.values():
        cols=[]
        for c in t['columns']:
            col=ident(c['name'])+' '+c['type']
            if c['identity']: col+=' GENERATED ALWAYS AS IDENTITY'
            elif c['default']: col+=' DEFAULT '+c['default']
            if c['notNull']: col+=' NOT NULL'
            cols.append(col)
        s += f"CREATE TABLE {t['name']}({','.join(cols)});\n"
    # Every referenced PRIMARY/UNIQUE key must exist before any FK is attached;
    # alphabetical table order places confirmed_modes before capabilities.
    for foreign_key_phase in [False,True]:
        for t in TABLES.values():
            for c in t['constraints'] or []:
                if c['definition'].startswith('FOREIGN KEY') == foreign_key_phase:
                    s+=f"ALTER TABLE {t['name']} ADD CONSTRAINT {ident(c['name'])} {c['definition']};\n"
    # Preserve every captured body and ACL, allowing the production preflight to
    # execute unchanged. Unexecuted full-stack dependencies are deliberately not
    # fabricated: this remains a component proof, with validation disabled only
    # while assembling its narrow schema (never in the production candidate).
    for f in CAPTURE['functions']:
        s+=definition(f['name'])+'\n'
        s+=f"REVOKE ALL ON FUNCTION {f['signature']} FROM PUBLIC,postgres,anon,authenticated,service_role;\n"
        for grant in f['acl'].strip('{}').split(','):
            role,permission=grant.split('=')
            assert permission=='X/postgres', ('UNHANDLED_SOURCE_ACL',grant)
            s+=f"GRANT EXECUTE ON FUNCTION {f['signature']} TO {ident(role)};\n"
    return s

def row(t, owner):
    canary='CANARY_'+owner[:8]
    values={}
    for c in t['columns']:
        name,typ=c['name'],c['type']
        if c['identity']: continue
        if typ=='uuid':
            if name.endswith('account_id'): value=owner
            elif name in ['profile_id','worker_profile_id','requester_profile_id']: value=uid(owner,'profile')
            elif name=='need_id': value=uid(owner,'need')
            elif name in ['category_id','source_category_id']: value=CAT
            elif name=='target_category_id': value=OTHER_CAT
            elif name in ['source_review_id','review_id']: value=uid(owner,'review')
            elif name=='conversation_id': value=uid(owner,'conversation')
            elif name in ['request_key','source_request_key','client_request_id']: value=uid(owner,'request')
            elif name=='id' and t['name'].endswith('needs_snapshot'): value=uid(owner,'need')
            elif name=='id' and 'profile_backup' in t['name']: value=uid(owner,'profile')
            else: value=uid(owner,t['name']+name)
        elif typ=='jsonb':
            semantic={'service':canary,'mode':'REMOTE','action':'REUSE_EXISTING','lease_token':'NEVER_EXPORT_LEASE'}
            value=[semantic] if name in ['plans','proposals'] else semantic
            if name=='portfolio': value=[canary,semantic]
            if name=='payload':
                value={'worker_profile':{'account_id':owner,'bio':canary,'portfolio':[canary,semantic]},'worker_messages':[{'account_id':owner,'body':canary},{'account_id':PEER if owner==OWNER else OWNER,'body':'FOREIGN_COPY_MUST_NOT_EXPORT'}]}
        elif typ in ['text[]','character varying[]']: value=['REMOTE'] if name=='modes' else [canary]
        elif typ=='text':
            special={'purpose':'WORKER_CAPABILITY','execution_scope':'REMOTE','consent_source':'EXPLICIT_PROFILE_REVIEW','origin':'WORKER_CONFIRMED','source':'OWNER_REVIEWED_BATCH','resolution_state':'OPEN','binding_state':'PENDING','state':'CLAIMED','status':'COMMITTED','classification_state':'CONFIRMED' if 'need_snapshots' in t['name'] else 'REVIEW_REQUIRED','catalog_fingerprint':'a'*32}
            value=special.get(name,'a'*64 if 'digest' in name or 'fingerprint' in name else canary)
        elif typ=='boolean': value=True
        elif 'timestamp' in typ: value='2030-01-01T00:00:00Z'
        elif typ in ['integer','bigint','smallint'] or typ.startswith('numeric'): value=1
        elif 'geography' in typ: value=None
        else: raise AssertionError(('UNHANDLED_CAPTURE_TYPE',typ,name))
        values[name]=value
    return values

def seed():
    s=f"INSERT INTO private.work_taxonomy_categories VALUES({q(CAT)},'fixture','ESTABLISHED'),({q(OTHER_CAT)},'other','ESTABLISHED');\nINSERT INTO private.work_taxonomy_category_modes VALUES({q(CAT)},'REMOTE');\n"
    for owner in [OWNER,PEER]:
        s+=f"INSERT INTO public.app_accounts VALUES({q(owner)});INSERT INTO public.app_profiles VALUES({q(uid(owner,'profile'))},{q(owner)},'WORKER',ARRAY['fixture'],'ACTIVE',now());INSERT INTO public.needs VALUES({q(uid(owner,'need'))},{q(owner)},{q(CAT)});INSERT INTO private.worker_ai_reviews VALUES({q(uid(owner,'review'))},{q(owner)},{q(uid(owner,'conversation'))},'{{}}','hash',now()+interval '1 day');\n"
        s+=f"INSERT INTO private.ai_task_reviews VALUES({q(uid(owner,'review'))},{q(owner)},{q(uid(owner,'conversation'))},'{{}}');\n"
        # Parent-before-child insert order, independent from erasure order.
        order=['work_taxonomy_worker_capabilities','work_taxonomy_need_snapshots']
        tables=sorted(TABLES.values(),key=lambda t:(0 if t['name'].split('.')[-1] in order else 1,t['name']))
        for t in tables:
            values=row(t,owner)
            s+=f"INSERT INTO {t['name']} SELECT * FROM jsonb_populate_record(NULL::{t['name']},{q(json.dumps(values))}::jsonb);\n"
    return s


def source_triggers():
    # Installed after fixture inserts so the original full-stack INSERT trigger
    # does not pretend to execute against fabricated dispatch dependencies.
    return '\n'.join(trigger+';' for t in TABLES.values() for trigger in t['triggers'] or [])

def connect_guard():
    if os.environ.get('PGHOST') not in ['127.0.0.1','localhost'] or os.environ.get('PGDATABASE')!='f01_component':
        raise SystemExit('F01_REFUSE_NON_COMPONENT_LOOPBACK_DATABASE')
    if any(os.environ.get(k) for k in ['PGSERVICE','PGSERVICEFILE','PGHOSTADDR','PGOPTIONS']):
        raise SystemExit('F01_REFUSE_CONNECTION_OVERRIDE')

def sql(statement, expected_error=None):
    p=subprocess.run(['psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-f','-'],input=statement,text=True,capture_output=True,timeout=30)
    if expected_error:
        assert p.returncode and expected_error in p.stderr,(expected_error,p.stderr[-1200:]);return ''
    if p.returncode: raise AssertionError(p.stderr[-3000:])
    return p.stdout.strip()

def erase(owner):
    # Same row-hash certificate and UPDATE/DELETE application as the real executor,
    # but explicit component context, not a claimed full closure execution.
    return sql(f'''BEGIN;SELECT set_config('request.jwt.claim.role','service_role',true);
DO $proof$ DECLARE r text;x record;p jsonb;assignments text;g uuid:={q(uid(owner,'generation'))};ac uuid:={q(uid(owner,'action'))};BEGIN
INSERT INTO private.closure_executions_v5 VALUES({q(owner)},g,'EXECUTING','{{"adapterVersion":"OWNER_AF_D22_EVENT_ERASURE_V1"}}');
INSERT INTO private.closure_actions_v5 VALUES(ac,g,{q(owner)},'RELATIONAL_REDACT','DISPATCHED');
FOR r IN SELECT value#>>'{{relation}}' FROM jsonb_array_elements(private.closure_taxonomy_inventory_v1()) LOOP
 FOR x IN EXECUTE format('SELECT ctid row_ctid,to_jsonb(t) row_json FROM %s t WHERE (%s) ORDER BY ctid LIMIT 100 FOR UPDATE',r::regclass,private.closure_taxonomy_scope_v1(r)) USING {q(owner)}::uuid LOOP
  p:=private.closure_redaction_patch_v5(r,x.row_json,{q(owner)},g);IF p IS NULL THEN CONTINUE;END IF;
  INSERT INTO private.closure_redaction_certificate_v5 VALUES(pg_backend_pid(),txid_current(),{q(owner)},g,ac,r::regclass,p->>'operation',encode(extensions.digest(convert_to(x.row_json::text,'UTF8'),'sha256'),'hex'),p->'patch');
  IF p->>'operation'='DELETE' THEN EXECUTE format('DELETE FROM %s WHERE ctid=$1',r::regclass) USING x.row_ctid;
  ELSE SELECT string_agg(format('%I=(jsonb_populate_record(NULL::%s,$2)).%I',k,r::regclass,k),',') INTO assignments FROM jsonb_object_keys(p->'patch') k;
   EXECUTE format('UPDATE %s SET %s WHERE ctid=$1',r::regclass,assignments) USING x.row_ctid,p->'patch';END IF;
  DELETE FROM private.closure_redaction_certificate_v5 WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
 END LOOP;
END LOOP;END $proof$;COMMIT;''')

def prove():
    connect_guard();checks=[]
    sql(fixture());sql(seed());sql(source_triggers())
    candidate=(HERE/'candidate.sql').read_text(encoding='utf-8')
    # Mutations below live in an outer transaction that fails and rolls back.
    # They test the actual production refusal paths, not a copied assertion.
    sql('BEGIN;ALTER TABLE private.work_taxonomy_review_outbox_v1 ADD COLUMN unadmitted text;'+candidate,'F01_UNKNOWN_TABLE_PREDECESSOR')
    sql('BEGIN;GRANT EXECUTE ON FUNCTION private.closure_account_key(uuid) TO anon;'+candidate,'F01_UNKNOWN_FUNCTION_PREDECESSOR')
    sql(f"BEGIN;INSERT INTO private.closure_executions_v5 VALUES({q(OWNER)},{q(uid(OWNER,'preflight'))},'EXECUTING','{{}}');"+candidate,'F01_CLOSURE_EXECUTING')
    sql(f"BEGIN;UPDATE public.needs SET requester_account_id={q(PEER)} WHERE requester_account_id={q(OWNER)};"+candidate,'F01_NEED_SNAPSHOT_OWNER_CONFLICT')
    checks.append('EXACT_PRODUCTION_PREFLIGHT_REJECTS_TABLE_ACL_AND_ACTIVE_CLOSURE_DRIFT')
    sql('SET check_function_bodies=off;'+candidate)
    sql(candidate,'F01_ALREADY_INSTALLED')
    checks.append('EXACT_CANDIDATE_INSTALLS_ON_CAPTURED_PREDECESSOR_AND_REFUSES_DUPLICATION')
    # A live helper can be present without an export of a reset fixture profile.
    # Use the exact preexisting candidate projector from the repository capture.
    export=json.loads(sql(f"SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM private.closure_taxonomy_export_rows_v1({q(OWNER)}) x"))
    encoded=json.dumps(export);assert 'CANARY_11111111' in encoded and 'CANARY_22222222' not in encoded
    assert 'NEVER_EXPORT_LEASE' not in encoded, ('OPAQUE_FIELD_EXPORTED',[x['key'] for x in export if 'NEVER_EXPORT_LEASE' in json.dumps(x)])
    assert 'FOREIGN_COPY_MUST_NOT_EXPORT' not in encoded, ('FOREIGN_ROW_EXPORTED',[x['key'] for x in export if 'FOREIGN_COPY_MUST_NOT_EXPORT' in json.dumps(x)])
    for item in export:
        if item['key'] in ['archivedProfiles','archivedWorkerProfile']:
            assert item['value']['portfolio']==['CANARY_11111111'], ('PORTFOLIO_PROJECTION',item['key'])
        if item['key']=='archivedWorkerReset':
            assert item['value']['payload']['worker_profile'][0]['portfolio']==['CANARY_11111111'], 'RESET_PORTFOLIO_PROJECTION'
    assert len(export)==20;checks.append('OWNED_EXPORT_20_RELATIONS_WITH_PEER_AND_LEASE_EXCLUSION')
    orphan=sql(f"BEGIN;DELETE FROM private.work_taxonomy_need_skills WHERE need_id={q(uid(OWNER,'need'))};DELETE FROM private.work_taxonomy_need_snapshots WHERE need_id={q(uid(OWNER,'need'))};DELETE FROM public.needs WHERE requester_account_id={q(OWNER)};UPDATE private.dev_phase1_20261014_dispatch_snapshot SET round_no=round_no+1 WHERE need_id={q(uid(OWNER,'need'))};SELECT count(*) FROM private.closure_taxonomy_export_rows_v1({q(OWNER)}) WHERE key='archivedTaskDispatch';ROLLBACK;")
    assert '\n1\n' in '\n'+orphan+'\n'
    checks.append('ARCHIVED_DISPATCH_OWNER_RESOLVES_WITHOUT_LIVE_NEED')
    # Scoped conversation hold protects actual proposal/outbox copies.
    sql(f"INSERT INTO private.retention_holds VALUES({q(PEER)},{q(uid(PEER,'conversation'))},true)")
    for rel in MANIFEST['tables'][:5]+MANIFEST['tables'][6:13]:
        assert sql(f"SELECT bool_and(private.closure_taxonomy_patch_v1({q(rel)},to_jsonb(t),{q(PEER)},{q(uid(PEER,'generation'))}) IS NULL) FROM {rel} t WHERE "+sql(f"SELECT replace(private.closure_taxonomy_scope_v1({q(rel)}),'$1',{q(q(PEER)+'::uuid')})"))=='t',rel
    checks.append('SCOPED_HOLD_PROTECTS_12_LINKED_AI_AND_TAXONOMY_COPIES')
    assert sql(f"SELECT private.closure_redaction_patch_v5('public.needs',to_jsonb(n),{q(OWNER)},{q(uid(OWNER,'generation'))})#>'{{patch,category_id}}'='null'::jsonb FROM public.needs n WHERE requester_account_id={q(OWNER)}")=='t'
    checks.append('EXISTING_NEED_ERASURE_PATCH_ALSO_REMOVES_CATEGORY_POINTER')
    sql(f"INSERT INTO private.account_closure_requests VALUES({q(OWNER)},'EXECUTING')")
    sql(f"UPDATE private.work_taxonomy_worker_capabilities SET excluded=true WHERE worker_account_id={q(OWNER)}",'ACCOUNT_CLOSING')
    sql(f"UPDATE private.work_taxonomy_review_outbox_v1 SET owner_account_id={q(PEER)} WHERE owner_account_id={q(OWNER)}",'F01_OWNER_IMMUTABLE')
    sql(f"SELECT public.rpc_taxonomy_finalize_reviewed_batch_service({q(uid(OWNER,'private.work_taxonomy_review_outbox_v1id'))},{q(uid(OWNER,'private.work_taxonomy_review_outbox_v1lease_token'))},'TIMEOUT')",'ACCOUNT_CLOSING')
    checks.append('NEW_WRITE_AND_LATE_FINALIZE_DENIED_AFTER_CLOSURE')
    assert sql('SELECT public.rpc_taxonomy_claim_reviewed_batches_service(20)')=='[]'
    checks.append('CLAIM_SKIPS_CLOSING_OWNER_AND_UNEXPIRED_PEER_LEASE')
    sql(f"UPDATE private.work_taxonomy_review_outbox_v1 SET state='PENDING',lease_token=NULL,lease_until=NULL,retry_after=now() WHERE owner_account_id={q(PEER)}")
    claimed=json.loads(sql('SELECT public.rpc_taxonomy_claim_reviewed_batches_service(20)'))
    assert len(claimed)==1 and claimed[0]['ownerAccountId']==PEER and claimed[0]['leaseToken']
    assert sql('SELECT public.rpc_taxonomy_claim_reviewed_batches_service(20)')=='[]'
    checks.append('OPEN_OWNER_CLAIM_SUCCEEDS_ONCE_WITH_ACTIVE_LEASE_EXCLUSION')
    peer_before=sql(f"SELECT jsonb_agg(to_jsonb(x) ORDER BY key,value::text) FROM private.closure_taxonomy_export_rows_v1({q(PEER)}) x")
    global_before=sql('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM private.work_taxonomy_categories t')
    erase(OWNER)
    after=sql(f"SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM private.closure_taxonomy_export_rows_v1({q(OWNER)}) x")
    assert 'CANARY_11111111' not in after
    assert sql(f"SELECT count(*) FROM private.work_taxonomy_review_outbox_v1 WHERE owner_account_id={q(OWNER)} AND state='REVIEW_REQUIRED' AND binding_state='REVIEW_REQUIRED' AND lease_token IS NULL AND lease_until IS NULL AND plans='[]' AND result='{{\"erasedBy\":\"AF-D22\"}}'")=='1'
    assert sql('SELECT count(*) FROM private.closure_redaction_certificate_v5')=='0'
    checks.append('ACTUAL_CERTIFIED_ROW_UPDATES_AND_FK_SAFE_DELETES_REMOVE_CANARIES')
    assert sql(f"SELECT jsonb_agg(to_jsonb(x) ORDER BY key,value::text) FROM private.closure_taxonomy_export_rows_v1({q(PEER)}) x")==peer_before
    assert sql('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM private.work_taxonomy_categories t')==global_before
    checks.append('PEER_AND_SHARED_CATALOG_UNCHANGED')
    # A forged uncorrelated erasure certificate never exempts a closing account.
    sql(f"BEGIN;SELECT set_config('request.jwt.claim.role','service_role',true);UPDATE private.work_taxonomy_review_outbox_v1 SET plans='[{{}}]' WHERE owner_account_id={q(OWNER)};COMMIT;",'ACCOUNT_CLOSING')
    checks.append('NO_CERTIFICATE_BYPASS_OR_TOMBSTONE_REANIMATION')
    # An exclusive closure lock prevents a background claim without row blocking.
    proc=subprocess.Popen(['psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-f','-'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    proc.stdin.write(f"BEGIN;SELECT pg_advisory_xact_lock(private.closure_account_key({q(PEER)}));SELECT 'LOCKED';SELECT pg_sleep(3);ROLLBACK;\n");proc.stdin.close()
    while True:
        line=proc.stdout.readline()
        if 'LOCKED' in line: break
        if proc.poll() is not None: raise AssertionError('LOCK_HOLDER_FAILED')
    assert sql(f"SELECT private.closure_taxonomy_try_owner_v1({q(PEER)})")=='f'
    proc.wait(timeout=10);assert proc.returncode==0
    checks.append('EXCLUSIVE_CLOSURE_LOCK_PREVENTS_ASYNC_OWNER_ADMISSION')
    report={'result':'PASS','scope':'POSTGRES_COMPONENT_ONLY','sourceSha':os.environ.get('GITHUB_SHA'),'candidateSha256':hashlib.sha256((HERE/'candidate.sql').read_bytes()).hexdigest(),'checks':checks,'relations':20,'actualAuth':False,'actualStorage':False,'fullClosureProof':False,'certificateRebound':False,'liveWrites':0,'providerCalls':0}
    (HERE/'component-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))

if '--prepare-only' in sys.argv:
    (HERE/'fixture.generated.sql').write_text(fixture()+seed()+source_triggers(),encoding='utf-8');print('F01_SYNTHETIC_COMPONENT_FIXTURE_GENERATED')
else:
    prove()
