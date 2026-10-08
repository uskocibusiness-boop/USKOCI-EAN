#!/usr/bin/env python3
"""Real Android W04/W05 recovery after the full N04 and two-account navigation journey."""
import ast
import json
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from task_detail_local_rest import LocalRestOutage, validate_local_targets

validate_local_targets(os.environ)
PACKAGE = os.environ['RU5_DEVICE_PACKAGE']
MAIN_ACTIVITY = f'{PACKAGE}/.MainActivity'
DB_URL = os.environ['RU5_DEVICE_DB_URL']
ARTIFACT_DIR = Path(os.environ['RU5_DEVICE_ARTIFACT_DIR'])
REQUESTER_USER_ID = os.environ['RU5_DEVICE_REQUESTER_USER_ID']
WORKER_USER_ID = os.environ['RU5_DEVICE_WORKER_USER_ID']
NEED_ID = os.environ['RU5_DEVICE_NEED_ID']
NEED_TITLE = os.environ['RU5_DEVICE_NEED_TITLE']
fixture = json.loads((ARTIFACT_DIR / 'navigation-fixture.json').read_text(encoding='utf-8'))
NAV_NEED_ID, NAV_NEED_TITLE = fixture['needId'], fixture['needTitle']
assert fixture['localOnly'] is True and fixture['requesterId'] == REQUESTER_USER_ID
for value in (REQUESTER_USER_ID, WORKER_USER_ID, NEED_ID, NAV_NEED_ID):
    assert re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', value)

# Load only shared real input/observation functions, never another journey's top-level actions.
for filename in ('ru5_android_device_ui_journey.py', 'intent_shell_android_journey.py'):
    source = Path(__file__).with_name(filename)
    definitions = ast.Module(body=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                                  if isinstance(node, ast.FunctionDef)], type_ignores=[])
    exec(compile(definitions, str(source), 'exec'), globals())


def assert_no_application_actions(root):
    # The one action at the foot of a task detail (owner, 8 Oct 2026): "Pošalji ponudu" on a task with no fixed price, "Pošalji prijavu" on one with a fixed price.
    # (Only functions of this file are loaded by test_task_detail_android.py, so the labels are spelled here and not as module constants.)
    for value in labels(root):
        if 'Pošalji ponudu' in value or 'Pošalji prijavu' in value:
            raise AssertionError('Application action remains visible on a non-current/failed detail')


def task_error(name, cached=False):
    root, _ = wait_surface(text='Zadatak trenutno nije moguće učitati.', timeout=45)
    assert_no_application_actions(root)
    assert 'Nazad na Zadatke' in labels(root) and 'Pokušajte ponovo' in labels(root)
    if cached:
        assert NAV_NEED_TITLE in labels(root)
        assert 'Poslednji učitani podaci. Osvežite zadatak pre nastavka.' in labels(root)
    shot(name)


def fresh_task(name, title=None):
    expected = title or NAV_NEED_TITLE
    # Every task of this journey is a disposable OFFERS task (no fixed price), so its detail says "Pošalji ponudu".
    root, _ = wait_surface(desc='Pošalji ponudu', timeout=45)
    assert expected in labels(root) and 'Nazad na Zadatke' in labels(root)
    assert not any('Poslednji učitani podaci' in value for value in labels(root))
    shot(name)


def composer_error(name):
    root, _ = wait_surface(text='Podatke za prijavu trenutno nije moguće učitati.', timeout=45)
    assert_no_application_actions(root)
    assert 'Nazad na zadatak' in labels(root) and 'Pokušajte ponovo' in labels(root)
    shot(name)


print('START PHYSICAL_TASK_DETAIL_RECOVERY inherited_real_worker_session', flush=True)
outage = LocalRestOutage()
assert_shell('worker')
tap(desc='Zadaci', prefer='bottom')
assert_discovery()

# Cold detail read fails through real PostgREST transport; Back remains actionable.
with outage.stopped():
    tap(desc=f'Otvorite priliku {NAV_NEED_TITLE}')
    task_error('W04_cold_read_error')
    tap(desc='Nazad na Zadatke')
    root, _ = wait_surface(text='Zadatke trenutno nije moguće učitati.', timeout=45)
    assert_no_application_actions(root)
    assert_shell('worker')
    shot('W04_error_back_to_discovery')
tap(desc='Pokušajte ponovo')
assert_discovery()
tap(desc=f'Otvorite priliku {NAV_NEED_TITLE}')
fresh_task('W04_recovered_detail')

# A real foreground event revalidates detail; its cache cannot authorize a CTA.
with outage.stopped():
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    time.sleep(1)
    adb('shell', 'am', 'start', '-W', '-n', MAIN_ACTIVITY)
    task_error('W04_cached_transport_error', cached=True)
    tap(desc='Pokušajte ponovo')
    task_error('W04_offline_retry_no_cta', cached=True)
tap(desc='Pokušajte ponovo')
fresh_task('W04_retry_restored')

# W05 is reached via its real W04 control. No form submit is made in this unit.
with outage.stopped():
    tap(desc='Pošalji ponudu')
    composer_error('W05_read_error')
    tap(desc='Nazad na zadatak')
    task_error('W05_error_back_to_detail')
tap(desc='Pokušajte ponovo')
fresh_task('W04_after_composer_back')
with outage.stopped():
    tap(desc='Pošalji ponudu')
    composer_error('W05_second_read_error')
tap(desc='Pokušajte ponovo')
root, _ = wait_surface(desc='Pošalji prijavu', timeout=45)
assert 'Sastavi prijavu' in labels(root) and NAV_NEED_TITLE in labels(root)
shot('W05_retry_recovered_without_submit')
adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
fresh_task('W04_after_composer_recovery')
tap(desc='Nazad na Zadatke')
assert_discovery()
shot('W04_actual_back_control')

# Arm a separate deadline only now, after the existing account-crossflow and recovery.
setup = run('node', str(Path(__file__).with_name('task_detail_deadline_fixture.mjs')))
print(setup.stdout.strip(), flush=True)
deadline_fixture = json.loads((ARTIFACT_DIR / 'task-detail-deadline-fixture.json').read_text(encoding='utf-8'))
deadline_id, deadline_title = deadline_fixture['needId'], deadline_fixture['needTitle']
assert deadline_fixture['localOnly'] is True and deadline_fixture['sourceSha'] == os.environ['GITHUB_SHA']
assert re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', deadline_id)
# Navigate through actual tabs to refresh the discovery read; no route injection.
tap(desc='Prijave', prefer='bottom')
tap(desc='Zadaci', prefer='bottom')
tap(desc=f'Otvorite priliku {deadline_title}', timeout=45)
fresh_task('W04_deadline_before', title=deadline_title)
remaining = float(psql(f"select extract(epoch from response_deadline-statement_timestamp()) from public.needs where id='{deadline_id}'"))
assert remaining > 5, 'Deadline fixture expired before a real actionable detail was observed'
with outage.stopped():
    # Stay focused: REST is unavailable, so only the already-read public deadline can close the CTA.
    root, _ = wait_surface(text='Nove prijave trenutno nisu dostupne za ovaj zadatak.', timeout=85)
    assert deadline_title in labels(root)
    assert_no_application_actions(root)
    server_cutoff = time.monotonic() + 5
    while psql(f"select response_deadline <= statement_timestamp() from public.needs where id='{deadline_id}'") != 't':
        assert time.monotonic() < server_cutoff, 'Device/server clocks disagree at public deadline'
        time.sleep(0.25)
    shot('W04_deadline_expired_without_rest')
tap(desc='Nazad na Zadatke')
assert_discovery()
shot('W04_deadline_back')

for identifier in (NAV_NEED_ID, deadline_id):
    assert psql(f"select count(*) from public.marketplace_responses where need_id='{identifier}'") == '0'
    assert psql(f"select count(*) from public.need_selections where need_id='{identifier}'") == '0'
    assert psql(f"select count(*) from public.agreements where need_id='{identifier}'") == '0'
assert psql(f"select count(*) from public.needs where id='{NAV_NEED_ID}' and status='PUBLISHED'") == '1'
assert psql(f"select count(*) from public.agreements where need_id='{NEED_ID}'") == '1'
assert psql('select count(*) from public.notification_push_attempts') == '0'
assert psql('select count(*) from public.notification_deliveries where read_at is not null') == '0'
assert_gates_unchanged()
print('PASS PHYSICAL_TASK_DETAIL_RECOVERY W04_error_retry_actual_back cached_no_cta '
      'W05_error_retry_back deadline_without_rest exact_container_restored no_submit_no_production', flush=True)
