"""Offline tests of the Android layer (s03_device.Device) against a SCRIPTED adb: the commands it issues, what it refuses, how it
reads a uiautomator dump, the app's private storage (a real SQLite file) and a tar stream. No device is ever touched."""
from __future__ import annotations

import io
import json
import sqlite3
import tarfile
import tempfile
import unittest
from pathlib import Path
from typing import Callable, Optional

import fakes
import s03_core as core
import s03_device as dev_mod
from s03_device import Device, RefusedDevice, UiTimeout

HERE = Path(__file__).resolve().parent
LABELS = core.Labels.load(HERE / 'ui_labels.json')
PKG = core.PACKAGE
JWT = 'eyJhbGciOiJIUzI1NiIsImtpZCI6InN5bnRoIn0.eyJzdWIiOiJzeW50aGV0aWMtdXNlci0xIiwic2Vzc2lvbl9pZCI6IjAwMDEifQ.c2lnbmF0dXJlLXN5bnRoZXRpYy0wMDAx'


class FakeProc:
    def __init__(self, data: bytes) -> None:
        self.stdout = io.BytesIO(data)
        self.killed = self.terminated = False

    def kill(self) -> None:
        self.killed = True

    def terminate(self) -> None:
        self.terminated = True

    def wait(self, timeout: Optional[float] = None) -> int:
        return 0


class ScriptedAdb:
    """Records every command and answers through `handler(words) -> (rc, bytes)`; words start with the adb sub-command."""

    def __init__(self, handler: Callable[[tuple[str, ...]], tuple[int, bytes]]) -> None:
        self.handler = handler
        self.calls: list[tuple[str, ...]] = []
        self.serial: Optional[str] = None

    def _ask(self, words: tuple[str, ...]) -> tuple[int, bytes]:
        self.calls.append(words)
        return self.handler(words)

    def run(self, *args, timeout=60, check=True):
        rc, out = self._ask(tuple(args))
        if check and rc != 0:
            raise dev_mod.AdbError(f'ADB_COMMAND_FAILED rc={rc}')
        return rc, out

    def shell(self, *args, timeout=60, check=True):
        return self.run('shell', *args, check=check)[1].decode('utf-8', 'replace')

    def shell_rc(self, *args, timeout=60):
        rc, out = self.run('shell', *args, check=False)
        return rc, out.decode('utf-8', 'replace')

    def exec_out(self, *args, timeout=120, check=True):
        return self.run('exec-out', *args, check=check)[1]

    def popen(self, *args, stdout=None):
        rc, out = self._ask(tuple(args))
        return FakeProc(out)

    def serialno(self):
        return self._ask(('get-serialno',))[1].decode().strip()

    def commands(self, first: str) -> list[tuple[str, ...]]:
        return [c for c in self.calls if c[:1] == (first,)]


def emulator_handler(extra: Optional[Callable[[tuple[str, ...]], Optional[tuple[int, bytes]]]] = None):
    props = {'ro.kernel.qemu': '1', 'ro.hardware': 'ranchu', 'ro.build.version.sdk': '35', 'ro.product.cpu.abi': 'x86_64',
             'ro.product.model': 'sdk_gphone64_x86_64'}

    def handle(words):
        if extra:
            answered = extra(words)
            if answered is not None:
                return answered
        if words == ('get-serialno',):
            return 0, b'emulator-5554\n'
        if words[:2] == ('shell', 'getprop'):
            return 0, (props.get(words[2], '') + '\n').encode()
        if words[:2] == ('shell', 'wm'):
            return 0, b'Physical size: 1080x2400\n'
        if words[:3] == ('shell', 'pm', 'list'):
            return 0, f'package:{PKG} uid:10201\n'.encode()
        if words[:3] == ('shell', 'run-as', PKG):
            return 0, b'uid=10201(u0_a201)\n'
        return 0, b''
    return handle


def make_device(handler, env=None, serial_ok=True):
    secrets = core.SecretSet()
    adb = ScriptedAdb(handler)
    out = Path(tempfile.mkdtemp(prefix='ex07-dev-'))
    device = Device(adb, LABELS, out, secrets, fakes.FakeClock(), env=env if env is not None else {})
    return device, adb, secrets


def xml_for(*nodes, focused_label=None):
    body = ''.join(
        f'<node index="{i}" text="{t}" resource-id="{rid}" class="{cls}" package="{pkg}" content-desc="{desc}" clickable="{str(click).lower()}" '
        f'enabled="true" focused="{str(desc == focused_label).lower()}" focusable="{str(cls == "android.widget.EditText").lower()}" '
        f'password="{str(pw).lower()}" bounds="[{b[0]},{b[1]}][{b[2]},{b[3]}]" />'
        for i, (t, desc, cls, pkg, click, pw, b, rid) in enumerate(nodes))
    return f"<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation=\"0\">{body}</hierarchy>"


def tv(text, bounds=(100, 100, 900, 180), pkg=PKG):
    return (text, '', 'android.widget.TextView', pkg, False, False, bounds, '')


def et(label, text='', bounds=(100, 300, 900, 400), pw=False):
    return (text, label, 'android.widget.EditText', PKG, True, pw, bounds, '')


class GuardTests(unittest.TestCase):
    def test_a_phone_is_refused_before_anything_is_sent_to_it(self):
        def handler(words):
            if words == ('get-serialno',):
                return 0, b'A8QDVB6522001205\n'
            if words[:2] == ('shell', 'getprop'):
                return 0, b'1\n'                       # whatever a device claims about qemu
            return 0, b''
        device, adb, _ = make_device(handler)
        with self.assertRaises(RefusedDevice):
            device.prepare(Path('app.apk'))
        self.assertEqual(adb.commands('install'), [])
        self.assertEqual([c for c in adb.calls if c[:2] == ('shell', 'input')], [])
        self.assertEqual([c for c in adb.calls if 'pm' in c and 'clear' in c], [])

    def test_prepare_on_an_emulator_installs_without_clearing_and_probes_run_as(self):
        device, adb, _ = make_device(emulator_handler(), env={})
        info = device.prepare(Path('app.apk'), start_logcat=False)
        self.assertEqual(adb.commands('install'), [('install', '-r', '-g', 'app.apk')])
        self.assertEqual(info['sdk'], '35')
        self.assertTrue(info['runAsAvailable'])
        self.assertEqual(info['uid'], 10201)
        self.assertEqual(device.screen_size, (1080, 2400))
        self.assertFalse([c for c in adb.calls if 'clear' in c])
        self.assertTrue(any(c[:5] == ('shell', 'service', 'call', 'alarm', '3') for c in adb.calls))   # Europe/Belgrade, best effort

    def test_clear_is_refused_without_the_explicit_flag_and_allowed_with_it(self):
        device, adb, _ = make_device(emulator_handler(), env={'GITHUB_ACTIONS': 'true'})
        device.prepare(None, start_logcat=False)
        with self.assertRaises(RefusedDevice):
            device.clear_app_data()
        self.assertFalse([c for c in adb.calls if c[:3] == ('shell', 'pm', 'clear')])
        device.env['EX07_S03_ALLOW_CLEAR'] = '1'
        device.clear_app_data()
        self.assertEqual([c for c in adb.calls if c[:3] == ('shell', 'pm', 'clear')], [('shell', 'pm', 'clear', PKG)])

    def test_clear_is_refused_for_a_serial_that_is_not_an_emulator(self):
        device, adb, _ = make_device(emulator_handler(), env={'GITHUB_ACTIONS': 'true', 'EX07_S03_ALLOW_CLEAR': '1'})
        device.prepare(None, start_logcat=False)
        device.serial = 'A8QDVB6522001205'
        with self.assertRaises(RefusedDevice):
            device.clear_app_data()

    def test_open_link_quotes_the_url_and_targets_only_this_package(self):
        device, adb, _ = make_device(emulator_handler())
        url = 'uskociapp://oporavak#access_token=SYNTHACCESS0001&refresh_token=SYNTHREFRESH0001&type=recovery'
        device.open_link(url, cold=True)
        words = [c for c in adb.calls if c[:3] == ('shell', 'am', 'start')][0]
        self.assertEqual(words[-1], PKG)
        self.assertIn("'" + url + "'", words)                       # quoted for the device shell: '&' and '#' stay data
        self.assertTrue(any(c == ('shell', 'am', 'force-stop', PKG) for c in adb.calls))
        with self.assertRaises(ValueError):
            device.open_link('https://example.test/x', cold=False)

    def test_home_back_and_force_stop(self):
        device, adb, _ = make_device(emulator_handler())
        device.home()
        device.press_back()
        device.force_stop()
        self.assertIn(('shell', 'input', 'keyevent', 'KEYCODE_HOME'), adb.calls)
        self.assertIn(('shell', 'input', 'keyevent', 'KEYCODE_BACK'), adb.calls)


class ScreenTests(unittest.TestCase):
    def test_a_failed_dump_is_retried_and_never_reads_a_stale_file(self):
        state = {'dumps': 0}

        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                state['dumps'] += 1
                return 0, (b'ERROR: could not get idle state.\n' if state['dumps'] == 1 else b'UI hierarchy dumped to: /sdcard/ex07-window.xml\n')
            if words[:2] == ('shell', 'cat'):
                return 0, xml_for(('', '', 'android.widget.FrameLayout', PKG, False, False, (0, 0, 1080, 2400), ''),
                                  et('Email', 'a@example.test', (100, 300, 900, 400)), et('Lozinka', '•••', (100, 450, 900, 550), pw=True)).encode()
            return None
        device, adb, _ = make_device(emulator_handler(extra))
        device.prepare(None, start_logcat=False)
        screen = device.screen()
        self.assertEqual(screen.state, 'LOGIN_FORM')
        self.assertEqual(state['dumps'], 2)
        self.assertEqual(len(adb.commands('shell')) > 0, True)

    def test_a_dump_that_never_works_is_a_timeout_and_waits_keep_polling(self):
        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'ERROR: could not get idle state.\n'
            return None
        device, _, _ = make_device(emulator_handler(extra))
        with self.assertRaises(UiTimeout):
            device.screen()
        with self.assertRaises(UiTimeout):                   # nothing ever dumped: a wait ends in a timeout, never a fake screen
            device.wait_for_state('LOGIN_FORM', timeout=3)

    def test_a_screen_of_another_app_is_not_the_app(self):
        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'UI hierarchy dumped to: x\n'
            if words[:2] == ('shell', 'cat'):
                return 0, xml_for(tv('Launcher', pkg='com.android.launcher3')).encode()
            return None
        device, _, _ = make_device(emulator_handler(extra))
        screen = device.screen()
        self.assertEqual((screen.state, screen.app_present), ('NOT_APP', False))
        self.assertEqual(screen.foreign, ('com.android.launcher3',))

    def test_a_permission_dialog_is_closed_harmlessly_then_the_app_is_read(self):
        state = {'closed': False}

        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'UI hierarchy dumped to: x\n'
            if words[:2] == ('shell', 'cat'):
                if not state['closed']:
                    return 0, xml_for(('Do not allow', '', 'android.widget.Button', 'com.google.android.permissioncontroller', True, False,
                                       (200, 1500, 800, 1600), 'com.google.android.permissioncontroller:id/permission_deny_button')).encode()
                return 0, xml_for(tv('Zdravo.')).encode()
            if words[:3] == ('shell', 'input', 'touchscreen'):
                state['closed'] = True
                return 0, b''
            return None
        device, adb, _ = make_device(emulator_handler(extra))
        screen = device.screen()
        self.assertTrue(state['closed'])
        self.assertTrue(screen.app_present)
        self.assertIn(('shell', 'input', 'touchscreen', 'swipe', '500', '1550', '500', '1550', '120'), adb.calls)

    def test_a_credential_on_screen_is_recorded_as_a_leak(self):
        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'UI hierarchy dumped to: x\n'
            if words[:2] == ('shell', 'cat'):
                return 0, xml_for(tv('debug ' + JWT)).encode()
            return None
        device, _, secrets = make_device(emulator_handler(extra))
        secrets.add('access_token', JWT)
        device.screen()
        self.assertEqual(len(device.leaks), 1)
        self.assertNotIn(JWT, json.dumps(device.leaks))

    def test_tap_presses_the_centre_above_the_navigation_bar(self):
        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'UI hierarchy dumped to: x\n'
            if words[:2] == ('shell', 'cat'):
                return 0, xml_for(('', 'Prijavi se', 'android.view.ViewGroup', PKG, True, False, (100, 2200, 980, 2400), ''),
                                  ('', '', 'android.view.View', 'com.android.systemui', False, False, (0, 2274, 1080, 2400), 'android:id/navigationBarBackground')).encode()
            return None
        device, adb, _ = make_device(emulator_handler(extra))
        device.prepare(None, start_logcat=False)
        device.tap('login.submit')
        swipe = [c for c in adb.calls if c[:3] == ('shell', 'input', 'touchscreen')][-1]
        x, y = int(swipe[4]), int(swipe[5])
        self.assertEqual(x, 540)
        self.assertTrue(2200 <= y < 2274)

    def test_set_field_reads_the_field_back_and_retries_a_dropped_character(self):
        typed = {'text': '', 'attempts': 0}

        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'UI hierarchy dumped to: x\n'
            if words[:2] == ('shell', 'cat'):
                return 0, xml_for(et('Email', typed['text']), focused_label='Email').encode()
            if words[:3] == ('shell', 'input', 'text'):
                typed['attempts'] += 1
                typed['text'] = words[3][:-1] if typed['attempts'] == 1 else words[3]      # the first try drops the last character
                return 0, b''
            return None
        device, adb, _ = make_device(emulator_handler(extra))
        device.set_field('login.field.email', 'a@example.test')
        self.assertEqual(typed['attempts'], 2)
        self.assertEqual(typed['text'], 'a@example.test')

    def test_set_field_gives_up_loudly_and_refuses_unsafe_values(self):
        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'UI hierarchy dumped to: x\n'
            if words[:2] == ('shell', 'cat'):
                return 0, xml_for(et('Email', 'never-what-was-typed'), focused_label='Email').encode()
            return None
        device, _, _ = make_device(emulator_handler(extra))
        with self.assertRaisesRegex(UiTimeout, 'FIELD_NOT_ACCEPTED'):
            device.set_field('login.field.email', 'a@example.test')
        with self.assertRaises(ValueError):
            device.set_field('login.field.email', 'a b;rm -rf')

    def test_unfocused_or_wrong_field_never_receives_clear_or_text(self):
        for focused in (None, 'Lozinka'):
            with self.subTest(focused=focused):
                def extra(words):
                    if words[:3] == ('shell', 'uiautomator', 'dump'):
                        return 0, b'UI hierarchy dumped to: x\n'
                    if words[:2] == ('shell', 'cat'):
                        return 0, xml_for(et('Email'), et('Lozinka', pw=True), focused_label=focused).encode()
                    return None
                device, adb, _ = make_device(emulator_handler(extra))
                with self.assertRaisesRegex(UiTimeout, 'FIELD_NOT_FOCUSED'):
                    device.set_field('login.field.email', 'a@example.test')
                self.assertFalse(any(c[:3] in [('shell', 'input', 'text'), ('shell', 'input', 'keyevent')] for c in adb.calls))
                self.assertEqual(sum(c[:3] == ('shell', 'input', 'touchscreen') for c in adb.calls), 3)

    def test_delayed_focus_retries_tap_before_typing_and_diagnostics_hold_no_values(self):
        state = {'taps': 0, 'text': JWT}
        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'UI hierarchy dumped to: x\n'
            if words[:2] == ('shell', 'cat'):
                return 0, xml_for(et('Email', state['text']), focused_label='Email' if state['taps'] >= 2 else None).encode()
            if words[:3] == ('shell', 'input', 'touchscreen'):
                state['taps'] += 1
            if words[:3] == ('shell', 'input', 'text'):
                self.assertGreaterEqual(state['taps'], 2)
                state['text'] = words[3]
                return 0, b''
            return None
        device, adb, _ = make_device(emulator_handler(extra))
        device.set_field('login.field.email', 'a@example.test')
        self.assertEqual(state['taps'], 2)
        self.assertEqual(sum(c[:3] == ('shell', 'input', 'text') for c in adb.calls), 1)
        trace = json.dumps(device.input_trace)
        self.assertNotIn(JWT, trace)
        self.assertNotIn('a@example.test', trace)
        self.assertTrue(device.input_trace[-1]['focused'])
        self.assertEqual(device.input_trace[-1]['tapPoint'], (500, 350))
        self.assertEqual(device.input_trace[-1]['candidateCount'], 1)

    def test_failed_input_command_reports_only_exit_code(self):
        def extra(words):
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'UI hierarchy dumped to: x\n'
            if words[:2] == ('shell', 'cat'):
                return 0, xml_for(et('Email'), tv('Prijavi se')).encode()
            if words[:3] == ('shell', 'input', 'touchscreen'):
                return 1, ('sensitive command ' + JWT).encode()
            return None
        device, adb, _ = make_device(emulator_handler(extra))
        with self.assertRaisesRegex(dev_mod.AdbError, '^ADB_COMMAND_FAILED rc=1$'):
            device.tap('login.submit')
        self.assertFalse(any(c[:3] == ('shell', 'input', 'text') for c in adb.calls))

    def test_the_keyboard_is_hidden_only_when_it_is_shown(self):
        shown = {'v': 'mInputShown=false'}

        def extra(words):
            if words[:3] == ('shell', 'dumpsys', 'input_method'):
                return 0, shown['v'].encode()
            return None
        device, adb, _ = make_device(emulator_handler(extra))
        device.hide_ime()
        self.assertNotIn(('shell', 'input', 'keyevent', 'KEYCODE_BACK'), adb.calls)
        shown['v'] = 'mIsInputViewShown=true'
        device.hide_ime()
        self.assertIn(('shell', 'input', 'keyevent', 'KEYCODE_BACK'), adb.calls)


class EvidenceTests(unittest.TestCase):
    def _sqlite_bytes(self, rows, table='Storage'):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'db'
            con = sqlite3.connect(str(path))
            con.execute(f'create table {table} (key text not null primary key, value text)')
            con.executemany(f'insert into {table} values (?, ?)', rows)
            con.commit()
            con.close()
            return path.read_bytes()

    @staticmethod
    def _storage_handler(listing_root: bytes, listing_db: bytes, files: dict):
        def extra(words):
            if words[:4] == ('exec-out', 'run-as', PKG, 'ls'):
                return 0, (listing_root if words[4] == '.' else listing_db)
            if words[:4] == ('exec-out', 'run-as', PKG, 'cat'):
                return 0, files.get(words[4], b'')
            return None
        return extra

    def test_the_session_is_read_from_the_apps_own_database_as_fingerprints(self):
        session = json.dumps({'access_token': JWT, 'refresh_token': 'refresh-abc-123', 'user': {'id': 'user-7'}})
        blob = self._sqlite_bytes([('sb-10-auth-token', session), ('other', 'x')])
        extra = self._storage_handler(b'cache\ndatabases\nfiles\n', b'AsyncStorage\nAsyncStorage-shm\nAsyncStorage-wal\nsomething-else\n',
                                      {'databases/AsyncStorage': blob})
        device, _, _ = make_device(emulator_handler(extra))
        device.prepare(None, start_logcat=False)
        view = device.read_storage()
        self.assertTrue(view['hasSession'])
        self.assertEqual(view['userIds'], ['user-7'])
        self.assertNotIn(JWT, repr(view))

    def test_the_legacy_table_name_is_read_too(self):
        blob = self._sqlite_bytes([('sb-10-auth-token', json.dumps({'user': {'id': 'u'}, 'access_token': 'a' * 20, 'refresh_token': 'r' * 20}))],
                                  table='catalystLocalStorage')
        extra = self._storage_handler(b'databases\n', b'RKStorage\n', {'databases/RKStorage': blob})
        device, _, _ = make_device(emulator_handler(extra))
        device.prepare(None, start_logcat=False)
        self.assertTrue(device.read_storage()['hasSession'])

    def test_an_app_that_has_stored_nothing_yet_is_an_empty_store_not_an_unreadable_one(self):
        device, _, _ = make_device(emulator_handler(self._storage_handler(b'cache\nfiles\n', b'', {})))
        device.prepare(None, start_logcat=False)
        view = device.read_storage()
        self.assertIsNotNone(view)
        self.assertFalse(view['hasSession'])

    def test_a_store_that_cannot_be_read_with_certainty_is_none_never_empty(self):
        # run-as stops answering: the data directory itself cannot be listed
        failing, _, _ = make_device(emulator_handler(lambda w: (1, b'') if w[:3] == ('exec-out', 'run-as', PKG) else None))
        failing.prepare(None, start_logcat=False)
        self.assertIsNone(failing.read_storage())
        # a torn copy of a live database (not SQLite at all): retried, then None - a false "no session" would hide a defect
        torn = self._storage_handler(b'databases\n', b'AsyncStorage\n', {'databases/AsyncStorage': b'this is not a database' * 50})
        device, _, _ = make_device(emulator_handler(torn))
        device.prepare(None, start_logcat=False)
        self.assertIsNone(device.read_storage())

        # a file that cannot be copied
        def broken(words):
            if words[:5] == ('exec-out', 'run-as', PKG, 'ls', '.'):
                return 0, b'databases\n'
            if words[:4] == ('exec-out', 'run-as', PKG, 'ls'):
                return 0, b'AsyncStorage\n'
            if words[:4] == ('exec-out', 'run-as', PKG, 'cat'):
                return 1, b''
            return None
        copy_fail, _, _ = make_device(emulator_handler(broken))
        copy_fail.prepare(None, start_logcat=False)
        self.assertIsNone(copy_fail.read_storage())

    def test_unreadable_storage_is_none_not_empty(self):
        device, _, _ = make_device(emulator_handler(lambda w: (1, b'run-as: package not debuggable') if w[:3] == ('shell', 'run-as', PKG) else None))
        device.prepare(None, start_logcat=False)
        self.assertFalse(device.run_as_ok)
        self.assertIsNone(device.read_storage())
        self.assertIsNone(device.scan_app_data())

    def test_the_whole_private_directory_is_searched_through_tar(self):
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode='w') as tf:
            for name, data in (('databases/AsyncStorage-wal', b'\x00 leak ' + JWT.encode() + b' \x01'), ('cache/x', b'clean')):
                info = tarfile.TarInfo(name)
                info.size = len(data)
                tf.addfile(info, io.BytesIO(data))

        def extra(words):
            if words[:4] == ('exec-out', 'run-as', PKG, 'tar'):
                return 0, buffer.getvalue()
            return None
        device, _, secrets = make_device(emulator_handler(extra))
        secrets.add('access_token', JWT)
        device.prepare(None, start_logcat=False)
        out = device.scan_app_data()
        self.assertEqual([m['path'] for m in out['matches']], ['databases/AsyncStorage-wal'])
        broken, _, s2 = make_device(emulator_handler(lambda w: (0, b'') if w[:4] == ('exec-out', 'run-as', PKG, 'tar') else None))
        broken.prepare(None, start_logcat=False)
        self.assertIsNone(broken.scan_app_data())          # tar missing: unavailable, never a clean bill of health

    def test_the_app_log_and_the_system_log_are_scanned_separately_and_only_tags_are_reported(self):
        device, adb, secrets = make_device(emulator_handler())
        secrets.add('access_token', JWT)
        device.prepare(None, start_logcat=True)
        self.assertTrue(any(c[:1] == ('logcat',) and f'--uid={device.uid}' in c for c in adb.calls))      # a capture of the app uid alone
        device.logcat_path.write_bytes(('10-02 12:00:00.000  1  2 W ReactNativeJS: oops ' + JWT + '\n'
                                        '10-02 12:00:00.500  9  9 I wm_create_activity: [' + JWT + ']\n'
                                        '10-02 12:00:01.000  1  2 I x: ok\n').encode())
        device.app_logcat_path.write_bytes(('10-02 12:00:00.000  1  2 W ReactNativeJS: oops ' + JWT + '\n'
                                            '10-02 12:00:01.000  1  2 I x: ok\n').encode())
        out = device.logcat_scan()
        self.assertEqual((out['app']['matches'], out['app']['tags']), (1, ['ReactNativeJS']))
        self.assertEqual(out['all']['matches'], 2)
        self.assertEqual(sorted(out['all']['tags']), ['ReactNativeJS', 'wm_create_activity'])
        self.assertNotIn(JWT, json.dumps(out))
        device.stop_logcat()

    def test_a_clean_app_log_with_a_noisy_system_log_is_clean_for_the_app(self):
        device, _, secrets = make_device(emulator_handler())
        secrets.add('access_token', JWT)
        device.logcat_path.write_bytes(('10-02 12:00:00.500  9  9 I wm_create_activity: [' + JWT + ']\n').encode())
        device.app_logcat_path.write_bytes(b'10-02 12:00:01.000  1  2 I ReactNativeJS: ok\n')
        out = device.logcat_scan()
        self.assertEqual(out['app']['matches'], 0)
        self.assertEqual(out['all']['matches'], 1)

    def test_no_capture_at_all_is_an_empty_scan_not_a_clean_one(self):
        device, _, _ = make_device(emulator_handler())
        out = device.logcat_scan()
        self.assertEqual((out['app']['lines'], out['all']['lines']), (0, 0))

    def test_os_retention_reports_presence_never_content(self):
        def extra(words):
            if words[:4] == ('shell', 'dumpsys', 'activity', 'activities'):
                return 0, ('ActivityRecord intent={dat=uskociapp://oporavak#access_token=' + JWT + '}').encode()
            return None
        device, _, secrets = make_device(emulator_handler(extra))
        secrets.add('access_token', JWT)
        out = device.os_retention()
        self.assertTrue(out['activities']['credentialsFound'])
        self.assertNotIn(JWT, json.dumps(out))

    def test_screenshots_and_failure_inventory_are_redacted(self):
        def extra(words):
            if words[:3] == ('exec-out', 'screencap', '-p'):
                return 0, b'\x89PNG fake'
            if words[:3] == ('shell', 'uiautomator', 'dump'):
                return 0, b'UI hierarchy dumped to: x\n'
            if words[:2] == ('shell', 'cat'):
                return 0, xml_for(tv('visible ' + JWT)).encode()
            return None
        device, _, secrets = make_device(emulator_handler(extra))
        secrets.add('access_token', JWT)
        self.assertEqual(device.shot('01-x'), '01-x.png')
        self.assertTrue((device.out_dir / '01-x.png').exists())
        words = device.inventory()
        self.assertTrue(words)
        self.assertNotIn(JWT, json.dumps(words))


if __name__ == '__main__':
    unittest.main()
