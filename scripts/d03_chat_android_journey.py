#!/usr/bin/env python3
"""Actual two-party Android chat, duplicate taps, local outage/retry and terminal Back.

All message sends, account changes and completion are real UI actions. Database
access below is SELECT-only; the separate admitted fixture applies exact local DDL.
"""
import ast
import json
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from d03_chat_local_rest import LocalRestOutage, validate_local_targets
from d03_chat_outbox_observer import read_scoped_outbox
from d03_chat_keyboard_bounds import observe_ime_frame, assert_composer_above_ime

validate_local_targets(os.environ)
CORE106=os.environ.get('RU5_DEVICE_CORE106')=='1'
PACKAGE=os.environ['RU5_DEVICE_PACKAGE']
MAIN_ACTIVITY=f'{PACKAGE}/.MainActivity'
PASSWORD=os.environ['RU5_DEVICE_PASSWORD']
DB_URL=os.environ['RU5_DEVICE_DB_URL']
ARTIFACT_DIR=Path(os.environ['RU5_DEVICE_ARTIFACT_DIR'])
WORKER_USER_ID=os.environ['RU5_DEVICE_WORKER_USER_ID']
REQUESTER_USER_ID=os.environ['RU5_DEVICE_REQUESTER_USER_ID']
NEED_ID=os.environ['RU5_DEVICE_NEED_ID']
NEED_TITLE=os.environ['RU5_DEVICE_NEED_TITLE']
AGREEMENT_ID=os.environ['N04_AGREEMENT_ID']
for identifier in (WORKER_USER_ID,REQUESTER_USER_ID,NEED_ID,AGREEMENT_ID):
    assert re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',identifier)
boundary=json.loads((ARTIFACT_DIR/'d03-native-db-boundary.json').read_text(encoding='utf-8'))
assert boundary['result']=='PASS' and boundary['localOnly']
if CORE106:
    expected_history=108 if os.environ.get('AI_REVIEW_SCOPE')=='marketplace' else 106
    assert boundary['fullCanonicalHistoryReplay'] and boundary['nativeBoundary']==f'EXACT{expected_history}_UI_CREATED_CORE_AGREEMENT' and boundary['historyAfter']['count']==expected_history
    assert boundary['publicationProof'] is (os.environ.get('AI_REVIEW_SCOPE')=='marketplace')
    if os.environ.get('AI_REVIEW_SCOPE')=='marketplace':
        assert boundary['coreSelection']['needId']==NEED_ID and boundary['coreSelection']['terms']['covered_slots']==3
        assert boundary['successorAdmission']['history_count']==108 and boundary['successorAdmission']['source_sha']==os.environ['GITHUB_SHA']
else:
    assert not boundary['fullCanonicalHistoryReplay']
assert boundary['agreementId']==AGREEMENT_ID and boundary['sourceSha']==os.environ['GITHUB_SHA']
for filename in ('ru5_android_device_ui_journey.py','intent_shell_android_journey.py'):
    source=Path(__file__).with_name(filename)
    definitions=ast.Module(body=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                                if isinstance(node,ast.FunctionDef)],type_ignores=[])
    exec(compile(definitions,str(source),'exec'),globals())

suffix=os.environ['GITHUB_RUN_ID']
assert suffix.isdigit()
WORKER_BODY=f'D03Worker_{suffix}'
REQUESTER_BODY=f'D03Requester_{suffix}'
OFFLINE_BODY=f'D03Offline_{suffix}'
report={'sourceSha':os.environ['GITHUB_SHA'],'runId':suffix,'localOnly':True,'liveAccess':False,
        'providerCalled':False,'nativeStableKeyObserved':False,'checks':[]}


def q(value):return "'"+str(value).replace("'","''")+"'"


def rows(query):
    return json.loads(psql(f"select coalesce(json_agg(x),'[]'::json) from ({query}) x"))


def message_rows(body):
    return rows(f"select id,sender_account_id,client_message_id,body,read_at from public.agreement_messages where agreement_id='{AGREEMENT_ID}' and body={q(body)}")


def wait_message(body,actor):
    deadline=time.monotonic()+45
    while time.monotonic()<deadline:
        result=message_rows(body)
        if result:
            assert len(result)==1 and result[0]['sender_account_id']==actor
            assert re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}',result[0]['client_message_id'] or '')
            assert result[0]['read_at'] is None
            message=result[0]
            assert psql(f"select count(*) from public.user_activity_events where event_type='MESSAGE_RECEIVED' and payload->>'message_id'={q(message['id'])}")=='1'
            return message
        time.sleep(.3)
    raise AssertionError('Physical send did not persist exactly one message/event')


def no_fake_receipts(root):
    for label in labels(root):
        assert label not in ('Pročitano','Dostavljeno','Viđeno','✓✓'), 'Unbacked read/delivery receipt is visible'


def visible_control(root,**criteria):
    width,height=screen_size()
    return [node for node in root.iter() if matches(node,**criteria)
            and (lambda b:0<=b[0]<b[2]<=width and 0<=b[1]<b[3]<=height)(parse_bounds(node.attrib.get('bounds')))]


def scroll_to(maximum=12,**criteria):
    for _ in range(maximum):
        root,parent,_=dump_tree()
        if visible_control(root,**criteria):return root,parent
        width,height=screen_size()
        adb('shell','input','swipe',str(width//2),str(height*3//5),str(width//2),str(height*3//10),'350')
        time.sleep(.5)
    raise AssertionError('Physical chat/overview control did not become visible')


def open_chat():
    tap(desc='Dogovori',prefer='bottom')
    tap(desc=f'Otvorite Dogovor {NEED_TITLE}')
    wait_visible(text=NEED_TITLE)
    tap(desc='Poruke')
    wait_visible(desc='Napišite poruku')
    wait_visible(text='Razgovor o ovom Dogovoru. Povucite naniže za nove poruke.' if core_mode() else 'Poruke vide učesnici ovog Dogovora. Povucite naniže za nove poruke.')


def assert_body_once(body):
    root,_=scroll_to(text=body)
    assert len(visible_control(root,text=body))==1, 'Pending and persisted copies are both visible'
    no_fake_receipts(root)
    return root


def prepare_body(body,keyboard_evidence=False):
    wait_visible(desc='Napišite poruku')
    edit_text(0,body)
    if keyboard_evidence:
        root,_=wait_surface(desc='Napišite poruku')
        width,height=screen_size()
        field=visible_control(root,desc='Napišite poruku')
        button=visible_control(root,desc='Pošalji poruku')
        assert len(field)==1 and len(button)==1 and field[0].attrib.get('focused')=='true'
        ime=adb('shell','dumpsys','input_method').stdout
        observed={'input':parse_bounds(field[0].attrib['bounds']),'send':parse_bounds(button[0].attrib['bounds']),
                  'screen':[width,height],'imeShown':bool(re.search(r'(?:mInputShown|mIsInputViewShown|isInputViewShown)=true',ime)),
                  'imeTop':None}
        report['keyboardComposer']=observed
        shot('D03_worker_composer_keyboard')
        # XML can omit the IME window. Require actual WindowManager geometry;
        # never fall back to screen bounds or record a whole window dump.
        observed.update(observe_ime_frame(adb('shell','dumpsys','window').stdout,width,height))
        assert_composer_above_ime(observed)
        checkpoint('PHYSICAL_KEYBOARD_COMPOSER_VISIBLE')
    hide_keyboard()
    root,_=wait_surface(desc='Pošalji poruku')
    assert any(node.attrib.get('text')==body for node in ordered_edit_fields(root))


def rapid_send():
    root,parent=wait_surface(desc='Pošalji poruku')
    targets=[clickable_for(node,parent) for node in root.iter() if matches(node,desc='Pošalji poruku')]
    targets=[node for node in targets if node is not None]
    assert len(targets)==1
    x1,y1,x2,y2=parse_bounds(targets[0].attrib['bounds']);x,y=(x1+x2)//2,(y1+y2)//2
    started=time.monotonic()
    # Two real touchscreen inputs at the same observed control, no helper delay.
    adb('shell','input','tap',str(x),str(y))
    adb('shell','input','tap',str(x),str(y))
    report['rapidTaps']={'count':2,'elapsedMs':round((time.monotonic()-started)*1000)}


def switch_account(email,from_intent,to_worker=False):
    tap(desc='Nazad')
    assert_shell(from_intent)
    core_profile() if core_mode() else tap(desc='Radni profil' if from_intent=='worker' else 'Profil',prefer='top')
    tap(desc='Odjavite se')
    wait_visible(desc='Prijavite se',timeout=60)
    assert_signed_out_surface(form_open=True)
    # Same installation/storage. No app clear or credential/session injection.
    login(email,form_open=True)
    assert_shell('requester')
    if to_worker:switch_to_worker_workspace();assert_shell('worker')
    open_chat()


def return_to_completed_agreement_list():
    tap(desc='Nazad')
    assert_shell('requester')
    # Current V2 defaults to active collaborations. Completion belongs in the
    # real history filter; the original legacy fixture retains its old list.
    if CORE106:
        tap(desc='Istorija')
    wait_visible(desc=f'Otvorite Dogovor {NEED_TITLE}')
    shot('D03_terminal_back')


def scoped_pending(body):
    observed=read_scoped_outbox(WORKER_USER_ID,AGREEMENT_ID,PACKAGE)
    if observed is None:return None
    entries=[entry for entry in observed['entries'] if entry['command'].get('body')==body]
    assert len(entries)==1, 'The exact scoped outbox row does not preserve the pending intent'
    assert entries[0]['persisted'] is True
    return entries[0]


def wait_scoped_ack(body,message_id):
    deadline=time.monotonic()+20
    while time.monotonic()<deadline:
        entry=scoped_pending(body)
        if entry is not None and entry.get('state')=='confirmed' and entry.get('messageId')==message_id:return entry
        time.sleep(.3)
    raise AssertionError('Scoped native persisted acknowledgment did not converge after server commit')


def checkpoint(name):
    report['checks'].append({'name':name,'result':'PASS'})
    print(f'CHECKPOINT D03_{name}',flush=True)


try:
    print('START PHYSICAL_D03_CHAT_RECOVERY inherited_real_worker_session',flush=True)
    assert_shell('worker')
    open_chat()
    wait_visible(text='Još nema poruka.')
    assert psql(f"select count(*) from public.agreement_messages where agreement_id='{AGREEMENT_ID}'" if CORE106 else 'select count(*) from public.agreement_messages')=='0'
    prepare_body(WORKER_BODY,keyboard_evidence=True);rapid_send()
    worker_message=wait_message(WORKER_BODY,WORKER_USER_ID)
    time.sleep(1);assert message_rows(WORKER_BODY)==[worker_message]
    assert_body_once(WORKER_BODY);shot('D03_worker_sent_once')
    checkpoint('RAPID_TAPS_ONE_MESSAGE_ONE_EVENT')

    switch_account(os.environ['RU5_DEVICE_REQUESTER_EMAIL'],'worker')
    assert_body_once(WORKER_BODY);shot('D03_requester_received')
    prepare_body(REQUESTER_BODY);tap(desc='Pošalji poruku')
    requester_message=wait_message(REQUESTER_BODY,REQUESTER_USER_ID)
    assert_body_once(REQUESTER_BODY);shot('D03_requester_reply')
    switch_account(os.environ['RU5_DEVICE_WORKER_EMAIL'],'requester',to_worker=True)
    assert_body_once(WORKER_BODY);assert_body_once(REQUESTER_BODY);shot('D03_worker_both_sides')
    checkpoint('BOTH_REAL_PARTICIPANTS_READ_COUNTERPART_MESSAGES')

    prepare_body(OFFLINE_BODY)
    outage=LocalRestOutage()
    with outage.stopped():
        tap(desc='Pošalji poruku')
        root,_=scroll_to(desc=f'Ponovi slanje poruke {OFFLINE_BODY}')
        assert 'Slanje nije potvrđeno' in labels(root) or 'Nije poslato' in labels(root)
        assert OFFLINE_BODY in labels(root)
        assert message_rows(OFFLINE_BODY)==[]
        before_retry=scoped_pending(OFFLINE_BODY)
        if before_retry is not None:
            assert before_retry['state'] in ('unknown','failed')
        shot('D03_offline_unknown')
    checkpoint('ACTUAL_LOCAL_REST_OUTAGE_PRESERVES_UNACKNOWLEDGED_BODY')
    tap(desc=f'Ponovi slanje poruke {OFFLINE_BODY}')
    offline_message=wait_message(OFFLINE_BODY,WORKER_USER_ID)
    assert_body_once(OFFLINE_BODY)
    if before_retry is not None:
        after_retry=wait_scoped_ack(OFFLINE_BODY,offline_message['id'])
        assert before_retry['command']==after_retry['command']
        assert before_retry['command']['clientMessageId']==offline_message['client_message_id']
        assert after_retry['messageId']==offline_message['id'] and after_retry['state']=='confirmed'
        assert after_retry['attempt']>before_retry['attempt']
        report['nativeStableKeyObserved']=True
        report['nativeRetryIdentity']={'clientMessageId':offline_message['client_message_id'],'messageId':offline_message['id'],
                                      'beforeAttempt':before_retry['attempt'],'afterAttempt':after_retry['attempt']}
    else:
        report['nativeStableKeyLimitation']='Scoped emulator sqlite3 observer unavailable; body retention and one message/event are physical, immutable key is separately proven in backend/model tests.'
        print('LIMITATION D03_NATIVE_STABLE_KEY scoped_sqlite_observer_unavailable no_expanded_storage_access',flush=True)
    shot('D03_retry_confirmed')

    # Actual pull-to-refresh reuses the authoritative read projection. It may not
    # create another message, event, command or a duplicate visible bubble.
    width,height=screen_size()
    adb('shell','input','swipe',str(width//2),str(height*3//10),str(width//2),str(height*7//10),'450')
    time.sleep(2)
    assert_body_once(OFFLINE_BODY)
    assert message_rows(OFFLINE_BODY)==[offline_message]
    shot('D03_refresh_single_copy')
    checkpoint('MANUAL_RETRY_AND_REFRESH_ONE_ACKNOWLEDGED_ROW')

    if CORE106:
        # The worker's step is "Zadatak je gotov" with its review sheet (since the UI waves of Oct 2026), not the old "Završio sam".
        tap(desc='Pregled');scroll_to(desc='Zadatak je gotov');tap(desc='Zadatak je gotov');tap(desc='Da, zadatak je gotov')
        until=time.monotonic()+40
        while psql(f"select state from public.agreement_execution where agreement_id='{AGREEMENT_ID}'")!='AWAITING_REQUESTER':
            if time.monotonic()>until:raise AssertionError('Native worker completion did not persist')
            time.sleep(.3)
        assert psql(f"select status from public.agreements where id='{AGREEMENT_ID}'")=='CONFIRMED'
        wait_visible(text='Čeka se potvrda druge strane');shot('CORE_worker_done');checkpoint('WORKER_MARKED_DONE_REAL_UI')
        tap(desc='Poruke')
    switch_account(os.environ['RU5_DEVICE_REQUESTER_EMAIL'],'worker')
    for body in (WORKER_BODY,REQUESTER_BODY,OFFLINE_BODY):assert_body_once(body)
    shot('D03_requester_all_messages')
    checkpoint('REQUESTER_READS_THE_RETRIED_WORKER_MESSAGE')
    tap(desc='Pregled')
    scroll_to(desc='Potvrdi završetak')
    tap(desc='Potvrdi završetak')
    tap(desc='Da, potvrdi završetak')
    deadline=time.monotonic()+40
    while psql(f"select status from public.agreements where id='{AGREEMENT_ID}'")!='COMPLETED':
        if time.monotonic()>deadline:raise AssertionError('Real requester completion did not persist')
        time.sleep(.3)
    tap(desc='Poruke')
    root,_=wait_surface(text='Dogovor je zatvoren; poruke su samo za čitanje.')
    controls=[node for node in root.iter() if matches(node,desc='Pošalji poruku')]
    assert len(controls)==1 and controls[0].attrib.get('enabled')=='false'
    inputs=[node for node in root.iter() if matches(node,desc='Napišite poruku')]
    assert len(inputs)==1 and inputs[0].attrib.get('enabled')=='false'
    no_fake_receipts(root);shot('D03_terminal_read_only')
    return_to_completed_agreement_list()
    checkpoint('TERMINAL_COMPOSER_READ_ONLY_BACK_TO_AGREEMENTS')

    expected=[worker_message,requester_message,offline_message]
    for item in expected:
        assert message_rows(item['body'])==[item]
        assert psql(f"select count(*) from public.user_activity_events where event_type='MESSAGE_RECEIVED' and payload->>'message_id'={q(item['id'])}")=='1'
    assert psql(f"select count(*) from public.agreement_messages where agreement_id='{AGREEMENT_ID}'" if CORE106 else 'select count(*) from public.agreement_messages')=='3'
    assert int(psql("select count(*) from public.user_activity_events where event_type='MESSAGE_RECEIVED'"))==(boundary['messageEventsBefore']+3 if CORE106 else 3)
    assert psql(f"select count(*) from public.agreement_messages where agreement_id='{AGREEMENT_ID}' and read_at is not null" if CORE106 else 'select count(*) from public.agreement_messages where read_at is not null')=='0'
    assert psql('select count(*) from public.notification_deliveries where read_at is not null')=='0'
    assert psql('select count(*) from public.notification_push_attempts')=='0'
    assert_gates_unchanged()
    if CORE106:
        assert psql(f"select state from public.agreement_execution where agreement_id='{AGREEMENT_ID}'")=='COMPLETED'
        report.update({'historyCount':core_history_required(),'sameAgreementId':AGREEMENT_ID,'nativeWorkerDone':True,'nativeRequesterComplete':True,'publicationProof':boundary['publicationProof'],'productionPolicyActivation':False})
    report['messages']=expected
    report['result']='PASS'
    print('PASS PHYSICAL_D03_CHAT_RECOVERY two_real_participants rapid_taps offline_body manual_retry terminal_back three_messages_three_events no_fake_receipts no_provider',flush=True)
except Exception:
    report['result']='FAIL'
    raise
finally:
    (ARTIFACT_DIR/'d03-physical-chat-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
