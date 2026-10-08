#!/usr/bin/env python3
import os
import ast
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

CORE106 = os.environ.get('RU5_DEVICE_CORE106') == '1'
PACKAGE = os.environ.get('RU5_DEVICE_PACKAGE', 'rs.uskoci.ru5proof')
MAIN_ACTIVITY = f'{PACKAGE}/.MainActivity'
WORKER_EMAIL = os.environ['RU5_DEVICE_WORKER_EMAIL']
REQUESTER_EMAIL = os.environ['RU5_DEVICE_REQUESTER_EMAIL']
PASSWORD = os.environ['RU5_DEVICE_PASSWORD']
NEED_TITLE = os.environ['RU5_DEVICE_NEED_TITLE']
DB_URL = os.environ['RU5_DEVICE_DB_URL']
NEED_ID = os.environ['RU5_DEVICE_NEED_ID']
WORKER_USER_ID = os.environ['RU5_DEVICE_WORKER_USER_ID']
REQUESTER_USER_ID = os.environ['RU5_DEVICE_REQUESTER_USER_ID']
ARTIFACT_DIR = Path(os.environ.get('RU5_DEVICE_ARTIFACT_DIR', 'artifacts/ru5-device-ui'))
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def run(*args, check=True, text=True, capture_output=True):
    return subprocess.run(args, check=check, text=text, capture_output=capture_output)


def adb(*args, check=True):
    return run('adb', *args, check=check)


def psql(sql):
    result = run('psql', DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql)
    return result.stdout.strip()


def dump_tree(save_name=None):
    adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
    xml_text = adb('shell', 'cat', '/sdcard/window.xml').stdout
    if save_name:
        (ARTIFACT_DIR / f'{save_name}.xml').write_text(xml_text, encoding='utf-8')
    root = ET.fromstring(xml_text)
    parent = {child: p for p in root.iter() for child in p}
    dump_tree.last_observation = (root, xml_text)
    return root, parent, xml_text


def parse_bounds(raw):
    m = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', raw or '')
    if not m:
        raise RuntimeError(f'Invalid bounds: {raw!r}')
    x1, y1, x2, y2 = map(int, m.groups())
    return x1, y1, x2, y2


def clickable_for(node, parent):
    cur = node
    while cur is not None:
        if cur.attrib.get('clickable') == 'true' and cur.attrib.get('enabled', 'true') == 'true':
            return cur
        cur = parent.get(cur)
    return None


def matches(node, *, text=None, desc=None, contains=None, clazz=None):
    if text is not None and node.attrib.get('text') != text:
        return False
    if desc is not None and node.attrib.get('content-desc') != desc:
        return False
    if contains is not None:
        hay = f"{node.attrib.get('text', '')} {node.attrib.get('content-desc', '')}"
        if contains not in hay:
            return False
    if clazz is not None and node.attrib.get('class') != clazz:
        return False
    return True


def tap_node(node, parent, hold_ms=0):
    target = clickable_for(node, parent)
    if target is None:
        raise RuntimeError(
            f"Node is visible but not actionable: text={node.attrib.get('text')!r} "
            f"desc={node.attrib.get('content-desc')!r} bounds={node.attrib.get('bounds')!r}"
        )
    x1, y1, x2, y2 = parse_bounds(target.attrib.get('bounds'))
    x = (x1 + x2) // 2
    y = (y1 + y2) // 2
    if hold_ms > 0:
        # A short same-coordinate touchscreen swipe produces a real down/hold/up
        # gesture. This is closer to a human press than an instantaneous shell
        # tap and is more reliable for RN Pressability on a loaded CI emulator.
        adb(
            'shell', 'input', 'touchscreen', 'swipe',
            str(x), str(y), str(x), str(y), str(hold_ms),
        )
    else:
        adb('shell', 'input', 'tap', str(x), str(y))
    time.sleep(0.8)


def native_surface_failure(reason):
    # Function-only AST loaders share this marker without needing a new class.
    error = RuntimeError(reason)
    error.native_surface_fatal = True
    raise error


def has_native_anr(root):
    return any(n.attrib.get('resource-id') in ('android:id/aerr_close', 'android:id/aerr_wait')
               or (n.attrib.get('resource-id') == 'android:id/alertTitle'
                   and ("isn't responding" in n.attrib.get('text', '')
                        or 'ne reaguje' in n.attrib.get('text', ''))) for n in root.iter())


def system_dialog_adb(*args, text=True, deadline=None):
    remaining = 5 if deadline is None else min(5, deadline - time.monotonic())
    if remaining <= 0:
        native_surface_failure('Quickstep recovery deadline exceeded')
    return subprocess.run(['adb', *args], check=True, capture_output=True, text=text, timeout=remaining)


def current_focus_name(windows):
    matches = re.findall(r'^\s*mCurrentFocus=Window\{[^{}\r\n]*\bu\d+ ([^{}\r\n]+)\}\s*$', windows, re.M)
    return matches[0].strip() if len(matches) == 1 else None


def retain_anr_diagnostic(root, windows):
    index = len(list(ARTIFACT_DIR.glob('SYSTEM_ANR_*.xml'))) + 1
    stem = ARTIFACT_DIR / f'SYSTEM_ANR_{index:03d}'
    observed_root, raw = getattr(dump_tree, 'last_observation', (None, None))
    # Preserve the actual raw hierarchy that triggered the rejection.
    if observed_root is not root:
        raw = ET.tostring(root, encoding='unicode')
    stem.with_suffix('.xml').write_text(raw, encoding='utf-8')
    stem.with_suffix('.windows.txt').write_text(windows, encoding='utf-8')
    stem.with_suffix('.png').write_bytes(system_dialog_adb('exec-out', 'screencap', '-p', text=False).stdout)
    return stem.name


def dismiss_known_system_anr(root, parent):
    """One verified Quickstep close; app, unknown or recurring ANRs are fatal."""
    if not has_native_anr(root):
        return False
    try:
        windows = system_dialog_adb('shell', 'dumpsys', 'window', 'displays').stdout
        diagnostic = retain_anr_diagnostic(root, windows)
        titles = [n for n in root.iter() if n.attrib.get('resource-id') == 'android:id/alertTitle']
        close = [n for n in root.iter() if n.attrib.get('resource-id') == 'android:id/aerr_close']
        wait = [n for n in root.iter() if n.attrib.get('resource-id') == 'android:id/aerr_wait']
        if (len(titles) != 1 or titles[0].attrib.get('package') != 'android'
                or titles[0].attrib.get('text') not in ("Quickstep isn't responding", 'Quickstep ne reaguje')
                or current_focus_name(windows) != 'Application Not Responding: com.android.launcher3'
                or len(close) != 1 or len(wait) != 1
                or close[0].attrib.get('text') not in ('Close app', 'Zatvori aplikaciju')
                or any(n.attrib.get('package') != 'android' or n.attrib.get('clickable') != 'true'
                       or n.attrib.get('enabled') != 'true' for n in close + wait)):
            native_surface_failure('App or unrecognized ANR; original diagnostic retained')
        marker = ARTIFACT_DIR / 'SYSTEM_QUICKSTEP_RECOVERY_USED.json'
        if marker.exists():
            native_surface_failure('Repeated Quickstep ANR; no second recovery')
        pid = system_dialog_adb('shell', 'pidof', PACKAGE).stdout.strip()
        if not re.fullmatch(r'[1-9][0-9]*', pid):
            native_surface_failure('USKOCI process unavailable before Quickstep recovery')
        # This persists across the separate RU5/chat Python phases of one run.
        with marker.open('x', encoding='utf-8') as handle:
            json.dump({'diagnostic': diagnostic, 'appPid': pid, 'verified': False}, handle)
        x1, y1, x2, y2 = parse_bounds(close[0].attrib.get('bounds'))
        if x1 >= x2 or y1 >= y2:
            native_surface_failure('Invalid Quickstep close bounds')
        system_dialog_adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            time.sleep(0.5)
            system_dialog_adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml', deadline=deadline)
            xml = system_dialog_adb('shell', 'cat', '/sdcard/window.xml', deadline=deadline).stdout
            fresh = ET.fromstring(xml)
            focus = system_dialog_adb('shell', 'dumpsys', 'window', 'displays', deadline=deadline).stdout
            if system_dialog_adb('shell', 'pidof', PACKAGE, deadline=deadline).stdout.strip() != pid:
                native_surface_failure('USKOCI process changed during Quickstep recovery')
            if has_native_anr(fresh):
                dump_tree.last_observation = (fresh, xml)
                retain_anr_diagnostic(fresh, focus)
                native_surface_failure('ANR remains after the single Quickstep close')
            if (current_focus_name(focus) in (MAIN_ACTIVITY, f'{PACKAGE}/{PACKAGE}.MainActivity')
                    and any(n.attrib.get('package') == PACKAGE for n in fresh.iter())):
                marker.write_text(json.dumps({'diagnostic': diagnostic, 'appPid': pid, 'verified': True}), encoding='utf-8')
                print('RECOVERED exact_quickstep_close unchanged_app_pid focused_app no_anr', flush=True)
                return True
        native_surface_failure('App focus not restored after Quickstep close')
    except Exception as exc:
        if getattr(exc, 'native_surface_fatal', False):
            raise
        native_surface_failure('Quickstep diagnostic or bounded recovery failed')


def find_nodes(**criteria):
    root, parent, _ = dump_tree()
    nodes = [n for n in root.iter() if matches(n, **criteria)]
    return nodes, parent


def wait_nodes(timeout=40, minimum=1, save_timeout=True, **criteria):
    end = time.time() + timeout
    last = []
    while time.time() < end:
        try:
            root, parent, _ = dump_tree()
            if dismiss_known_system_anr(root, parent):
                continue
            nodes = [n for n in root.iter() if matches(n, **criteria)]
            last = nodes
            if len(nodes) >= minimum:
                return nodes, parent
        except Exception as exc:
            if getattr(exc, 'native_surface_fatal', False):
                raise
            print(f'WAIT_RETRY criteria={criteria} error={type(exc).__name__}:{exc}', flush=True)
        time.sleep(1)

    root, _, xml = dump_tree('timeout' if save_timeout else None)
    visible = [
        (n.attrib.get('text'), n.attrib.get('content-desc'), n.attrib.get('class'))
        for n in root.iter()
        if n.attrib.get('text') or n.attrib.get('content-desc')
    ]
    raise RuntimeError(
        f'Timeout criteria={criteria} minimum={minimum}; last={len(last)} '
        f'visible={visible[-80:]} xml_tail={xml[-1000:]}'
    )


def tap(prefer='bottom', timeout=40, hold_ms=0, **criteria):
    end = time.time() + timeout
    last_visible = 0
    raised = False
    while time.time() < end:
        try:
            root, parent, _ = dump_tree()
            if dismiss_known_system_anr(root, parent):
                continue
            nodes = [n for n in root.iter() if matches(n, **criteria)]
            last_visible = len(nodes)
            unique = {}
            for node in nodes:
                target = clickable_for(node, parent)
                if target is not None:
                    unique[target.attrib.get('bounds', str(id(target)))] = (target, parent)
            options = list(unique.values())
            if not options and not raised and prefer == 'bottom' and (criteria.get('desc') or criteria.get('text')) in ('Početna', 'Zadaci', 'Dogovori', 'Prijave', 'Profil'):
                # On Zadaci the bottom navigation is away while the list rests at its top line and comes back with the half height (the owner's phone, 8 Oct 2026):
                # a tab asked for while the list is low raises the list by its own handle first, once.
                handle = [n for n in root.iter() if n.attrib.get('resource-id') == 'list-count' and clickable_for(n, parent) is not None]
                if handle:
                    raised = True
                    tap_node(handle[0], parent)
                    time.sleep(1.2)
                    continue
            if options:
                options.sort(
                    key=lambda item: parse_bounds(item[0].attrib.get('bounds'))[1],
                    reverse=(prefer == 'bottom'),
                )
                tap_node(options[0][0], options[0][1], hold_ms=hold_ms)
                return
        except Exception as exc:
            if getattr(exc, 'native_surface_fatal', False):
                raise
            print(f'TAP_RETRY criteria={criteria} error={type(exc).__name__}:{exc}', flush=True)
        time.sleep(0.5)

    root, _, xml = dump_tree('tap_timeout')
    visible = [
        (n.attrib.get('text'), n.attrib.get('content-desc'), n.attrib.get('class'),
         n.attrib.get('clickable'), n.attrib.get('enabled'))
        for n in root.iter()
        if n.attrib.get('text') or n.attrib.get('content-desc')
    ]
    raise RuntimeError(
        f'Timeout waiting for actionable control criteria={criteria}; '
        f'visible_matches={last_visible} visible={visible[-80:]} xml_tail={xml[-1000:]}'
    )


def wait_visible(timeout=40, **criteria):
    wait_nodes(timeout=timeout, **criteria)


def wait_surface(timeout=40, **criteria):
    # Assert against the same complete XML tree in which the required real
    # control was observed. A second raw dump can instead sample a new launcher
    # ANR overlay after wait_nodes has safely waited for the app surface.
    nodes, parent = wait_nodes(timeout=timeout, **criteria)
    root = nodes[0]
    while root in parent:
        root = parent[root]
    return root, parent


def ordered_edit_fields(root):
    nodes = [node for node in root.iter() if node.attrib.get('class') == 'android.widget.EditText']
    return sorted(nodes, key=lambda node: parse_bounds(node.attrib.get('bounds'))[1])


def entered_value_matches(node, value):
    observed = node.attrib.get('text', '')
    if node.attrib.get('password') == 'true':
        # Android deliberately masks passwords. Never expose/toggle the secret;
        # the subsequent real Auth request remains the credential authority.
        return bool(observed) and len(observed) == len(value)
    return observed == value


def current_edit_field(index):
    root, parent, _ = dump_tree()
    if dismiss_known_system_anr(root, parent):
        return None, parent
    nodes = ordered_edit_fields(root)
    return (nodes[index] if len(nodes) > index else None), parent


def type_paced_fixture_text(value, deadline):
    # These are transport-safe characters in our generated disposable fixture,
    # not application input policy. One real key event at a time gives controlled
    # React Native TextInput a chance to process each native onChange event.
    allowed = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@._- '
    if not value or any(character not in allowed for character in value):
        raise ValueError('Unsupported synthetic fixture keyboard input')
    for character in value:
        if time.monotonic() >= deadline:
            raise RuntimeError('Physical keyboard input deadline exceeded')
        if character == ' ':
            adb('shell', 'input', 'keyevent', 'KEYCODE_SPACE')
        else:
            adb('shell', 'input', 'text', character)
        time.sleep(0.15)


def edit_text(index, value, timeout=180):
    if index < 0 or not isinstance(value, str) or not value:
        raise ValueError('A non-empty value and non-negative field index are required')
    deadline = time.monotonic() + timeout
    attempt = 0
    last_error = 'field unavailable'
    while time.monotonic() < deadline:
        attempt += 1
        try:
            field, parent = current_edit_field(index)
            if field is None:
                time.sleep(1)
                continue
            tap_node(field, parent, hold_ms=160)
            field, _ = current_edit_field(index)
            if field is None or field.attrib.get('focused') != 'true':
                last_error = 'native focus not confirmed'
                print(f'RETRY UI_TEXT_FOCUS field={index} attempt={attempt}', flush=True)
                time.sleep(1)
                continue

            # Real keyboard select-all/delete makes a retry replace, not append.
            # No accessibility setText, Auth injection, or business RPC fallback.
            adb('shell', 'input', 'keyboard', 'keycombination', '-t', '100',
                'KEYCODE_CTRL_LEFT', 'KEYCODE_A')
            time.sleep(0.2)
            adb('shell', 'input', 'keyevent', 'KEYCODE_DEL')
            type_paced_fixture_text(value, deadline)
            time.sleep(0.8)
            field, _ = current_edit_field(index)
            if field is not None and entered_value_matches(field, value):
                # Log progress only, never credential content or derived metadata.
                print(f'CHECKPOINT UI_TEXT_ENTERED field={index} attempt={attempt}', flush=True)
                return
            last_error = 'native readback mismatch'
            print(f'RETRY UI_TEXT_READBACK field={index} attempt={attempt}', flush=True)
        except (RuntimeError, subprocess.CalledProcessError, ET.ParseError) as exc:
            if getattr(exc, 'native_surface_fatal', False):
                raise
            # Do not include subprocess arguments: one may contain a password.
            last_error = type(exc).__name__
            print(f'RETRY UI_TEXT_INPUT field={index} attempt={attempt} error={last_error}', flush=True)
        time.sleep(1)

    dump_tree(f'input_{index}_timeout')
    raise RuntimeError(f'Could not verify real UI input field={index}: {last_error}')


def hide_keyboard():
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK', check=False)
    time.sleep(0.5)


def shot(name):
    png = subprocess.run(['adb', 'exec-out', 'screencap', '-p'], check=True, capture_output=True).stdout
    (ARTIFACT_DIR / f'{name}.png').write_bytes(png)
    root, _, _ = dump_tree(name)
    if has_native_anr(root):
        native_surface_failure('ANR visible in captured checkpoint; original PNG/XML retained')
    print(f'EVIDENCE {name}', flush=True)


def assert_no_private_tabs(root, height):
    private_destinations = {'Zadaci', 'Novi', 'Novi Zadatak', 'Prijave', 'Dogovori', 'Profil', 'Početna'}
    for node in root.iter():
        names = {node.attrib.get('text', ''), node.attrib.get('content-desc', '')}
        if names.intersection(private_destinations) and parse_bounds(node.attrib.get('bounds'))[1] >= height * 0.75:
            raise AssertionError('Private bottom destination visible on signed-out Auth screen')


def assert_signed_out_surface(form_open=False):
    # Called only after observing the actual Auth entry control, never as a
    # substitute for login visibility or as a route/auth bypass.
    control = 'Prijavite se' if form_open else 'Prijavi se'
    root, _ = wait_surface(desc=control)
    if not any(node.attrib.get('content-desc') == control for node in root.iter()):
        raise AssertionError('Signed-out Auth entry is not visible')
    if form_open:
        fields = [node for node in root.iter() if node.attrib.get('class') == 'android.widget.EditText']
        if len(fields) != 2 or {node.attrib.get('content-desc') for node in fields} != {'Email', 'Lozinka'}:
            raise AssertionError('Signed-out password form is incomplete')
    height = int(re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').stdout)[-1][1])
    assert_no_private_tabs(root, height)
    print('CHECKPOINT SIGNED_OUT_AUTH_NO_PRIVATE_TABS', flush=True)
    return root


def launch_clean():
    adb('shell', 'am', 'force-stop', PACKAGE, check=False)
    adb('shell', 'pm', 'clear', PACKAGE, check=False)
    time.sleep(1)

    # Recover a launcher dialog only after our process exists, so recovery can
    # prove it did not kill/restart the app. wait_visible performs that check.
    started = adb('shell', 'am', 'start', '-W', '-n', MAIN_ACTIVITY, check=False)
    print(
        f'APP_START returncode={started.returncode} stdout={started.stdout[-500:]} stderr={started.stderr[-500:]}',
        flush=True,
    )
    time.sleep(2)
    wait_visible(timeout=90, desc='Prijavi se')
    assert_signed_out_surface()


def open_login_sheet():
    # The real CTA becomes enabled slightly before the JS-driven reference-entry
    # animation finishes. Let the production entry settle, then use a short real
    # touchscreen press on that same CTA. No auth/navigation shortcut is used.
    time.sleep(1.5)
    last_error = None
    for attempt in range(1, 4):
        tap(
            desc='Prijavi se',
            prefer='top',
            timeout=90 if attempt == 1 else 15,
            hold_ms=160,
        )
        try:
            nodes, parent = wait_nodes(
                timeout=8,
                minimum=2,
                save_timeout=False,
                clazz='android.widget.EditText',
            )
            print(f'CHECKPOINT AUTH_SHEET_OPEN attempt={attempt}', flush=True)
            return nodes, parent
        except RuntimeError as exc:
            if getattr(exc, 'native_surface_fatal', False):
                raise
            last_error = exc
            dump_tree(f'AUTH_entry_attempt_{attempt}_after')
            print(f'RETRY AUTH_ENTRY_PRESS attempt={attempt}', flush=True)
            time.sleep(1)
    raise RuntimeError(f'Login sheet did not open after real UI presses: {last_error}')


def login(email, form_open=False):
    if form_open:
        assert_signed_out_surface(form_open=True)
    else:
        open_login_sheet()
    edit_text(0, email)
    edit_text(1, PASSWORD)
    hide_keyboard()
    tap(text='Prijavite se', prefer='bottom', timeout=30)
    # Current three-zone shell; login is still through the real Auth sheet.
    # W03 native scope identifies the current List presentation independently
    # from the core/SQL history boundary. Legacy journeys retain their anchor.
    current_ai = os.environ.get('AI_REVIEW_SCOPE') in ('intake', 'marketplace')
    wait_visible(desc='Zadaci', timeout=60) if core_mode() or current_ai else wait_visible(text='MENI TREBA', timeout=60)


def switch_to_worker_workspace():
    core_profile() if core_mode() else tap(desc='Profil', prefer='top')
    wait_visible(desc='Pređite na JA MOGU')
    tap(desc='Pređite na JA MOGU')
    wait_visible(desc='Prijave', timeout=45) if core_mode() else wait_visible(text='JA MOGU', timeout=45)


def dismiss_ok(timeout=15):
    try:
        tap(text='OK', prefer='bottom', timeout=timeout)
    except Exception as exc:
        if getattr(exc, 'native_surface_fatal', False):
            raise
        try:
            tap(text='U redu', prefer='bottom', timeout=3)
        except Exception as exc:
            if getattr(exc, 'native_surface_fatal', False):
                raise
            pass


def assert_worker_submit():
    row = psql(f"""
select r.id::text || '|' || r.status || '|' || r.price_rsd::text || '|' || r.covered_slots::text
from public.marketplace_responses r
join public.app_profiles p on p.id=r.worker_profile_id
where r.need_id='{NEED_ID}'::uuid and p.account_id='{WORKER_USER_ID}'::uuid;
""")
    if not row:
        raise AssertionError('W05 UI did not create Application')
    parts = row.split('|')
    slots = core_fixture()['requiredSlots'] if os.environ.get('AI_REVIEW_SCOPE') == 'marketplace' else 1
    if parts[1] not in ('SUBMITTED', 'VIEWED', 'SHORTLISTED') or parts[2] != '3000' or parts[3] != str(slots):
        raise AssertionError(f'Unexpected W05 Application: {row}')
    print(f'CHECKPOINT W05_RESPONSE_CREATED response={parts[0]} state={parts[1]}', flush=True)
    return parts[0]


def assert_final_selection(response_id):
    slots = core_fixture()['requiredSlots'] if os.environ.get('AI_REVIEW_SCOPE') == 'marketplace' else 1
    row = psql(f"""
select a.id::text || '|' || a.requester_account_id::text || '|' || a.worker_account_id::text || '|' || a.selected_response_id::text
from public.agreements a
where a.need_id='{NEED_ID}'::uuid;
""")
    if not row:
        raise AssertionError('R05 UI did not create Agreement')
    agreement_id, requester_id, worker_id, selected_response = row.split('|')
    if requester_id != REQUESTER_USER_ID or worker_id != WORKER_USER_ID or selected_response != response_id:
        raise AssertionError(f'Agreement binding mismatch: {row}')
    activation = psql(f"""
select count(*)::text
from private.connection_activations a
where a.agreement_id='{agreement_id}'::uuid
  and a.requester_account_id='{REQUESTER_USER_ID}'::uuid
  and a.beneficiary_account_id='{REQUESTER_USER_ID}'::uuid
  and a.worker_account_id='{WORKER_USER_ID}'::uuid
  and a.activation_reason='SELECTION'
  and a.units={slots}
  and a.platform_cost_rsd=0
  and a.state='SATISFIED'
  and a.policy_key='REQUESTER_SELECTION_V1'
  and a.policy_version=1;
""")
    if activation != '1':
        raise AssertionError('P0D03 zero-RSD Requester activation mismatch')
    print(
        f'CHECKPOINT AGREEMENT_CREATED agreement={agreement_id} '
        'policy=REQUESTER_SELECTION_V1 beneficiary=REQUESTER reason=SELECTION '
        'charge=PROMOTIONAL_FREE basis=HEADCOUNT platform_cost_rsd=0',
        flush=True,
    )
    return agreement_id


def assert_gates_unchanged():
    if core_mode():
        assert_core_gates(); return
    checks = {
        'publication_policy_bundles': 'select count(*) from private.publication_policy_bundles;',
        'publication_decisions': 'select count(*) from private.need_publication_decisions;',
        'preselection_questions': 'select count(*) from private.preselection_qa_questions;',
        'preselection_answers': 'select count(*) from private.preselection_qa_answer_versions;',
        'preselection_policy': 'select count(*) from private.preselection_qa_policy_decisions;',
        'preselection_materiality': 'select count(*) from private.preselection_qa_materiality_decisions;',
        'preselection_commands': 'select count(*) from private.preselection_qa_commands;',
        'fastest_needs': "select count(*) from public.needs where mode='FASTEST';",
        'autofill_selections': "select count(*) from public.need_selections where selection_mode='AUTO_FILL';",
    }
    observed = {name: psql(sql) for name, sql in checks.items()}
    bad = {name: value for name, value in observed.items() if value != '0'}
    if bad:
        raise AssertionError(f'Gated/retired inventory changed: {bad}')
    print(f'CHECKPOINT GATES_UNCHANGED {observed}', flush=True)



def core_mode():
    return globals().get('CORE106', False)


def core_profile():
    # Use the actual current surface's public profile button, not navigation injection.
    root, parent, _ = dump_tree()
    for label in ('Moj profil', 'Radni profil', 'Profil'):
        nodes = [n for n in root.iter() if matches(n, desc=label) and clickable_for(n,parent) is not None]
        if nodes:
            tap(desc=label, prefer='top'); return
    raise AssertionError('No observed current profile control')


def core_switch_account(email, worker=False):
    # Agreement Back may return the saved Need detail after selection replaced
    # its route. Reach the actual list tab before using its profile control.
    tap(desc='Zadaci',prefer='bottom'); core_profile()
    tap(desc='Odjavite se'); wait_visible(desc='Prijavite se',timeout=60)
    assert_signed_out_surface(form_open=True); login(email,form_open=True)
    if worker: switch_to_worker_workspace()


def core_fixture():
    fixture=json.loads((ARTIFACT_DIR/'core-fixture.json').read_text(encoding='utf-8'))
    assert fixture['result']=='PASS' and fixture['sourceSha']==os.environ['GITHUB_SHA'] and fixture['localOnly']
    assert fixture['needId']==NEED_ID and fixture['requesterId']==REQUESTER_USER_ID and fixture['workerId']==WORKER_USER_ID
    assert fixture['productionPolicyActivation'] is False
    if os.environ.get('AI_REVIEW_SCOPE') == 'marketplace':
        from hashlib import sha256
        original=(ARTIFACT_DIR/'marketplace-publication.json').read_bytes()
        publication=json.loads(original)
        assert sha256(original).hexdigest()==fixture['publicationSha256']
        assert publication['result']=='PASS' and publication['sourceSha']==os.environ['GITHUB_SHA'] and publication['localOnly']
        assert publication['needId']==NEED_ID and publication['requesterId']==REQUESTER_USER_ID and publication['workerId']==WORKER_USER_ID
        assert all(publication[k] is True for k in ('actualNativePins','actualB06','actualB07','publicationProof','privateLocationHiddenFromWorker'))
        assert publication['providerProof'] is False and publication['productionPolicyActivation'] is False
        assert publication['historyCount']==108 and publication['nativeBoundary']==core_native_admission()
        assert fixture['publicationProof'] is True and fixture['aiProof'] is True and fixture['requiredSlots']==3
        assert fixture['syntheticFixturePrecondition'] is False
        assert fixture['nativeHistoryRequired']==108
    else:
        assert fixture['publicationProof'] is False
    return fixture


def core_history_required():
    return 108 if os.environ.get('AI_REVIEW_SCOPE')=='marketplace' else 106


def core_native_admission():
    original_path=ARTIFACT_DIR/'ai-review-admission.json' if os.environ.get('AI_REVIEW_SCOPE')=='marketplace' else Path('artifacts/ai-review-device/ai-review-admission.json')
    original=json.loads(original_path.read_text(encoding='utf-8'))
    assert original['sourceSha']==os.environ['GITHUB_SHA'] and original['historyCount']==106 and original['localOnly']
    if os.environ.get('AI_REVIEW_SCOPE')!='marketplace':
        return original
    report=json.loads((ARTIFACT_DIR/'native-successors-admission.json').read_text(encoding='utf-8'))
    assert report['result']=='PASS' and report['unit']=='NATIVE_MARKETPLACE_SOURCE108'
    assert report['source_sha']==os.environ['GITHUB_SHA'] and report['source_migration_count']==report['history_count']==108
    assert report['original_history_count']==106
    assert all(report[k] is True for k in ('localOnly','original_history_preserved','business_and_policy_rows_preserved'))
    assert all(report[k] is False for k in ('live_access','live_promotion','provider_called','policy_activated','transport_enabled','concurrency_proven'))
    assert re.fullmatch('[a-f0-9]{64}',report['history_sha256']) and len(report['applied_successors'])==2 and report['input_sha256']
    return report


def assert_core_gates():
    fixture=core_fixture()
    tables={'publication':'private.publication_policy_bundles','decisions':'private.need_publication_decisions',
            'retention':'private.retention_policy_sets','markets':'private.location_market_configs'}
    for key,table in tables.items():
        actual=psql(f"select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from {table} x")
        assert actual==fixture['baseline'][key], 'Admitted core registry/decision baseline changed'
    for table in ('preselection_qa_questions','preselection_qa_answer_versions','preselection_qa_policy_decisions','preselection_qa_materiality_decisions','preselection_qa_commands'):
        assert psql(f'select count(*) from private.{table}')=='0'
    assert psql("select count(*) from public.needs where mode='FASTEST'")=='0'
    assert psql("select count(*) from public.need_selections where selection_mode='AUTO_FILL'")=='0'
    assert psql('select count(*) from supabase_migrations.schema_migrations')==str(core_history_required())
    print(f'CHECKPOINT GATES_UNCHANGED exact{core_history_required()} admitted_registry_baseline production_policy_activation=false',flush=True)


def core_map_preview():
    fixture=core_fixture()
    wait_visible(desc='Pretraži zadatke'); edit_text(0,fixture['searchToken']); hide_keyboard()
    wait_visible(desc=f'Otvorite priliku {NEED_TITLE}'); shot('CORE_list_filtered')
    tap(desc='Mapa'); wait_visible(desc='Pretraži ovu oblast',timeout=60); shot('CORE_map_ready')
    root,parent=wait_surface(desc='Mapa približnih lokacija Zadatka')
    nodes=[n for n in root.iter() if matches(n,desc='Mapa približnih lokacija Zadatka')]
    assert len(nodes)==1, 'One observed actual native map required'
    x1,y1,x2,y2=parse_bounds(nodes[0].attrib['bounds']);assert x2-x1>100 and y2-y1>100
    # A single existing public point is camera-fitted by production code. Touch
    # observed native map centre; no SDK selection/viewport injection.
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
    wait_visible(desc='Otvori detalj Zadatka',timeout=30);wait_visible(text=NEED_TITLE);shot('CORE_map_selected')
    tap(desc='Otvori detalj Zadatka');wait_visible(desc='Pošalji ponudu',timeout=45)


def core_selection_receipt(response_id,agreement_id):
    fixture=core_fixture()
    raw=psql(f"""select jsonb_build_object('agreementId',a.id,'needId',a.need_id,'responseId',a.selected_response_id,
      'requesterId',a.requester_account_id,'workerId',a.worker_account_id,'needRevision',v.need_revision,
      'responseVersion',v.version,'responseHash',v.content_hash,'agreementHash',av.content_hash,
      'terms',av.terms,'commandHash',c.response_content_hash,'commandVersion',c.response_version,
      'commandNeedRevision',c.need_revision,'activationHash',ca.response_content_hash,
      'activationVersion',ca.response_version,'activationNeedRevision',ca.need_revision)
    from public.agreements a join public.marketplace_responses r on r.id=a.selected_response_id
    join public.marketplace_response_versions v on v.response_id=r.id and v.version=r.current_version
    join public.agreement_versions av on av.agreement_id=a.id and av.version=a.current_version
    join private.selection_commands c on c.agreement_id=a.id
    join private.connection_activations ca on ca.agreement_id=a.id
    where a.id='{agreement_id}' and a.need_id='{NEED_ID}'""")
    data=json.loads(raw);assert data['responseId']==response_id
    assert data['requesterId']==REQUESTER_USER_ID and data['workerId']==WORKER_USER_ID
    assert data['needRevision']==data['commandNeedRevision']==data['activationNeedRevision']==fixture['needRevision']
    assert data['responseVersion']==data['commandVersion']==data['activationVersion']
    assert data['responseHash']==data['agreementHash']==data['commandHash']==data['activationHash']
    terms=data['terms'];assert terms['price_rsd']==3000 and terms['covered_slots']==fixture.get('requiredSlots',1) and terms['schedule_source']=='NEED_FIXED_WINDOW'
    assert psql(f"select ({repr(terms['proposed_start_at'])}::timestamptz='{fixture['startAt']}'::timestamptz and {repr(terms['proposed_end_at'])}::timestamptz='{fixture['endAt']}'::timestamptz)::text")=='true'
    for query in [f"select count(*) from private.response_submit_commands where response_id='{response_id}'",
                  f"select count(*) from private.response_application_snapshots where response_id='{response_id}'",
                  f"select count(*) from private.selection_commands where agreement_id='{agreement_id}'",
                  f"select count(*) from public.agreements where need_id='{NEED_ID}'"]:
        assert psql(query)=='1'
    report={'result':'PASS','sourceSha':os.environ['GITHUB_SHA'],'localOnly':True,'historyCount':core_history_required(),
            'actualNativeApply':True,'actualNativeSelect':True,'actualNativeMapSelection':True,
            'publicationProof':fixture['publicationProof'],'productionPolicyActivation':False,'providerProof':False,**data}
    (ARTIFACT_DIR/'core-selection.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    return data


def core_application_success_surface(root, parent):
    # The confirmed receipt's notice lives at the end of the real form's
    # ScrollView. Its sticky navigation button is not evidence of this notice.
    assert any(n.attrib.get('package') == PACKAGE and n.attrib.get('text') == 'Tvoja prijava'
               for n in root.iter()), 'Application form changed while seeking its success notice'
    scrolls = [n for n in root.iter() if n.attrib.get('package') == PACKAGE
               and n.attrib.get('class') == 'android.widget.ScrollView'
               and n.attrib.get('scrollable') == 'true']
    assert len(scrolls) == 1, 'Expected one observed application form scroll viewport'
    scroll = scrolls[0]
    left, top, right, bottom = parse_bounds(scroll.attrib.get('bounds'))
    assert right > left and bottom - top > 100, 'Invalid application form scroll viewport'
    for node in scroll.iter():
        if node.attrib.get('package') != PACKAGE or node.attrib.get('text') != 'Prijava je poslata.':
            continue
        x1, y1, x2, y2 = parse_bounds(node.attrib.get('bounds'))
        if x2 <= x1 or y2 <= y1 or node.attrib.get('visible-to-user') == 'false':
            continue
        visible = True
        ancestor = parent.get(node)
        while ancestor is not None:
            if ancestor.attrib.get('bounds'):
                ax1, ay1, ax2, ay2 = parse_bounds(ancestor.attrib['bounds'])
                if not (ax1 <= x1 < x2 <= ax2 and ay1 <= y1 < y2 <= ay2):
                    visible = False
                    break
            ancestor = parent.get(ancestor)
        if visible:
            return scroll, True
    return scroll, False


def core_capture_application_success(timeout=40):
    deadline = time.monotonic() + timeout
    swipes = 0
    while time.monotonic() < deadline:
        root, parent, _ = dump_tree()
        if dismiss_known_system_anr(root, parent):
            continue
        scroll, visible = core_application_success_surface(root, parent)
        if visible:
            shot('W05_worker_application_success')
            # Validate the actual saved checkpoint tree, not the earlier match.
            captured, _ = dump_tree.last_observation
            captured_parent = {child: p for p in captured.iter() for child in p}
            assert core_application_success_surface(captured, captured_parent)[1], \
                'Success notice disappeared or became clipped in captured checkpoint'
            return
        if swipes < 8:
            x1, y1, x2, y2 = parse_bounds(scroll.attrib['bounds'])
            x = (x1 + x2) // 2
            height = y2 - y1
            adb('shell', 'input', 'swipe', str(x), str(y1 + height * 4 // 5),
                str(x), str(y1 + height // 4), '400')
            swipes += 1
        time.sleep(1)
    raise RuntimeError('Application success notice not visibly observed after bounded physical scrolling')


def core_open_selected_agreement():
    tap(desc='Prijave',prefer='bottom');wait_visible(text=NEED_TITLE)
    wait_visible(text='Izabrana');shot('W06_worker_selected_state')
    tap(desc=f'Otvori Dogovor: {NEED_TITLE}');wait_visible(text=NEED_TITLE)
    shot('DOGOVOR_worker_opened');tap(desc='Nazad')


def core_journey():
    from d03_chat_local_rest import validate_local_targets
    validate_local_targets(os.environ)
    if os.environ.get('AI_REVIEW_SCOPE')=='marketplace':
        subprocess.run(['node','scripts/ci/owned-intake-proof.mjs','admit108'],check=True,timeout=60)
    core_native_admission();fixture=core_fixture()
    assert_core_gates()
    assert psql(f"select count(*) from public.marketplace_responses where need_id='{NEED_ID}'")=='0'
    print('START CORE_NATIVE_TWO_ACCOUNT',flush=True)
    launch_clean();login(WORKER_EMAIL);shot('AUTH_worker_authenticated');switch_to_worker_workspace()
    tap(desc='Zadaci',prefer='bottom');wait_visible(desc=f'Otvorite priliku {NEED_TITLE}',timeout=45)
    shot('W03_worker_opportunity_list');core_map_preview();shot('W04_worker_need_detail')
    tap(desc='Pošalji ponudu');wait_visible(text='Tvoja prijava');wait_visible(desc='Cena za ponuđeni obim (RSD)')
    edit_text(0,'3000');hide_keyboard()
    if os.environ.get('AI_REVIEW_SCOPE')=='marketplace':
        root,parent=wait_surface(desc='Ljudi')
        inputs=[n for n in root.iter() if n.attrib.get('class')=='android.widget.EditText']
        people=[n for n in inputs if n.attrib.get('content-desc')=='Ljudi']
        assert len(people)==1, 'Actual people field required for preserved3-slot Need'
        edit_text(inputs.index(people[0]),str(fixture['requiredSlots']));hide_keyboard()
    shot('W05_worker_application_draft');tap(desc='Pošalji ovu Prijavu')
    core_capture_application_success();tap(desc='Otvori moje prijave')
    wait_visible(text=NEED_TITLE);wait_visible(text='Poslata');shot('W06_worker_own_application');response_id=assert_worker_submit()
    core_switch_account(REQUESTER_EMAIL);shot('AUTH_requester_authenticated');tap(desc='Zadaci',prefer='bottom')
    wait_visible(desc=f'Otvorite Zadatak {NEED_TITLE}');tap(desc=f'Otvorite Zadatak {NEED_TITLE}')
    wait_visible(desc='Otvori prijave, ukupno 1');shot('CORE_requester_need_detail');tap(desc='Otvori prijave, ukupno 1')
    worker_name=psql(f"select display_name from public.app_profiles where kind='WORKER' and account_id='{WORKER_USER_ID}'")
    wait_visible(desc=f'Pogledaj ponudu: {worker_name}');shot('CORE_candidate_list');tap(desc=f'Pogledaj ponudu: {worker_name}')
    wait_visible(desc='Pregledaj povezivanje');shot('R05_requester_candidate_selection');tap(desc='Pregledaj povezivanje')
    wait_visible(desc='Izaberi ovu Prijavu');shot('CORE_selection_review');tap(desc='Izaberi ovu Prijavu')
    wait_visible(text='Dogovor je sklopljen.');shot('R05_requester_selection_success')
    agreement_id=assert_final_selection(response_id);core_selection_receipt(response_id,agreement_id)
    tap(desc='Otvori Dogovor');wait_visible(text=NEED_TITLE);shot('AGREEMENT_created');tap(desc='Nazad')
    core_switch_account(WORKER_EMAIL,worker=True);shot('AUTH_worker_reauthenticated')
    core_open_selected_agreement()
    assert_core_gates();print('PASS CORE_NATIVE_APPLY_SELECT_MAP same_agreement two_real_auth_accounts',flush=True)


if CORE106:
    core_journey()
    raise SystemExit(0)

print('START RU5_PHYSICAL_ANDROID_DEVICE_UI_JOURNEY', flush=True)

launch_clean()
login(WORKER_EMAIL)
shot('AUTH_worker_authenticated')
switch_to_worker_workspace()
tap(desc='Zadaci', prefer='bottom')
wait_visible(desc=f'Otvorite priliku {NEED_TITLE}', timeout=45)
shot('W03_worker_opportunity_list')
tap(desc=f'Otvorite priliku {NEED_TITLE}')
# The one action at the foot of a task detail (owner, 8 Oct 2026): "Pošalji ponudu" on a task with no fixed price (this journey publishes an OFFERS task), "Pošalji prijavu" on one with a fixed price.
wait_visible(desc='Pošalji ponudu', timeout=45)
shot('W04_worker_need_detail')
tap(desc='Pošalji ponudu')
wait_visible(text='Sastavi prijavu', timeout=45)
wait_nodes(timeout=30, minimum=1, clazz='android.widget.EditText')
edit_text(0, '3000')
hide_keyboard()
shot('W05_worker_application_draft')
tap(desc='Pošalji prijavu', timeout=30)
wait_visible(contains='Prijava je uspešno podneta', timeout=45)
shot('W05_worker_application_success')
dismiss_ok()
wait_visible(text=NEED_TITLE, timeout=45)
wait_visible(text='Poslata', timeout=45)
shot('W06_worker_own_application')
response_id = assert_worker_submit()

launch_clean()
login(REQUESTER_EMAIL)
shot('AUTH_requester_authenticated')
tap(desc='Zadaci', prefer='bottom')
wait_visible(desc=f'Otvorite Zadatak {NEED_TITLE}', timeout=45)
tap(desc=f'Otvorite Zadatak {NEED_TITLE}')
wait_visible(contains='Otvori prijave, ukupno 1', timeout=45)
tap(contains='Otvori prijave, ukupno 1')
wait_visible(text='Prijave (1)', timeout=45)
wait_visible(desc='Izaberi', timeout=45)
shot('R05_requester_candidate_selection')
tap(desc='Izaberi')
wait_visible(contains='Dogovor je uspešno sklopljen', timeout=45)
shot('R05_requester_selection_success')
dismiss_ok()
agreement_id = assert_final_selection(response_id)
shot('AGREEMENT_created')

launch_clean()
login(WORKER_EMAIL)
shot('AUTH_worker_reauthenticated')
switch_to_worker_workspace()
tap(text='Prijave', prefer='bottom')
wait_visible(text=NEED_TITLE, timeout=45)
wait_visible(text='Izabrani ste', timeout=45)
wait_visible(desc='Otvorite Dogovor', timeout=45)
shot('W06_worker_selected_state')
tap(desc='Otvorite Dogovor')
wait_visible(text='Dogovor', timeout=45)
wait_visible(text=NEED_TITLE, timeout=45)
shot('DOGOVOR_worker_opened')

assert_gates_unchanged()

print(
    f'PASS RU5_PHYSICAL_ANDROID_DEVICE_UI_JOURNEY W03 W04 W05 W06 R05 '
    f'two_real_auth_identities agreement={agreement_id} P0D03_0_RSD '
    'worker_selected_and_dogovor_opened bounded_note_not_claimed disposable_local_only',
    flush=True,
)
