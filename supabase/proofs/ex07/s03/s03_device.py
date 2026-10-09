"""EX-07 S03 - the Android side: adb, uiautomator and the app's private storage, on a DISPOSABLE EMULATOR only.

Hazards this module is built around (docs/implementation/qa-robot/README.md section 3, memory uskoci-p6-native-journey):
  * It never imports a journey driver. It is self-contained, and `pm clear` is refused unless the device is an emulator,
    the package is this proof's own, the run is in CI and EX07_S03_ALLOW_CLEAR=1.
  * It refuses any device that is not an emulator: a physical phone is somebody's own and is never driven.
  * adb output is never printed or kept: an OS launch line can carry a callback credential.
  * Several nodes carry the same words (the entry screen stays in the tree behind the auth sheet): the topmost clickable wins.
"""
from __future__ import annotations

import dataclasses
import io
import os
import re
import shlex
import sqlite3
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable, Optional

import s03_core as core
import s03_http as net


class AdbError(RuntimeError):
    """An adb command failed. Never carries command output."""


class UiTimeout(RuntimeError):
    pass


class RefusedDevice(RuntimeError):
    pass


class Adb:
    def __init__(self, serial: Optional[str] = None) -> None:
        self.serial = serial

    def _base(self) -> list[str]:
        return ['adb'] + (['-s', self.serial] if self.serial else [])

    def run(self, *args: str, timeout: float = 60, check: bool = True) -> tuple[int, bytes]:
        try:
            proc = subprocess.run(self._base() + list(args), capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            raise AdbError('ADB_TIMEOUT') from None
        if check and proc.returncode != 0:
            raise AdbError(f'ADB_COMMAND_FAILED rc={proc.returncode}')
        return proc.returncode, proc.stdout

    def shell(self, *args: str, timeout: float = 60, check: bool = True) -> str:
        return self.run('shell', *args, timeout=timeout, check=check)[1].decode('utf-8', 'replace')

    def shell_rc(self, *args: str, timeout: float = 60) -> tuple[int, str]:
        rc, out = self.run('shell', *args, timeout=timeout, check=False)
        return rc, out.decode('utf-8', 'replace')

    def exec_out(self, *args: str, timeout: float = 120, check: bool = True) -> bytes:
        return self.run('exec-out', *args, timeout=timeout, check=check)[1]

    def popen(self, *args: str, stdout: Any = subprocess.PIPE) -> subprocess.Popen:
        return subprocess.Popen(self._base() + list(args), stdout=stdout, stderr=subprocess.DEVNULL)

    def serialno(self) -> str:
        return self.run('get-serialno', timeout=30)[1].decode('utf-8', 'replace').strip()


@dataclasses.dataclass
class Screen:
    nodes: list[core.Node]
    state: str
    app_present: bool
    foreign: tuple[str, ...] = ()

    def has_text(self, text: str, match: str = 'contains') -> bool:
        return any(core.node_matches(n, text, match) for n in self.nodes)

    def texts(self, limit: int = 60) -> list[str]:
        return core.visible_texts(self.nodes, limit)


class Device:
    def __init__(self, adb: Adb, labels: core.Labels, out_dir: Path, secrets: core.SecretSet, clock: Optional[net.Clock] = None,
                 package: str = core.PACKAGE, env: Optional[dict[str, str]] = None) -> None:
        self.adb, self.labels, self.out_dir, self.secrets = adb, labels, out_dir, secrets
        self.clock = clock or net.Clock()
        self.package = package
        self.env = dict(os.environ if env is None else env)
        self.serial = ''
        self.screen_size: Optional[tuple[int, int]] = None
        self.uid: Optional[int] = None
        self.run_as_ok = False
        self.info: dict[str, Any] = {}
        self.leaks: list[dict[str, Any]] = []
        self.shots: list[str] = []
        self.last_screen: Optional[Screen] = None
        self.input_trace: list[dict[str, Any]] = []
        self._log_proc: Optional[subprocess.Popen] = None
        self._log_file: Any = None
        self._app_log_proc: Optional[subprocess.Popen] = None
        self._app_log_file: Any = None
        self.logcat_path = out_dir / 'logcat.private.txt'          # never uploaded: it is the thing the proof searches
        self.app_logcat_path = out_dir / 'logcat-app.private.txt'  # the same, only what the app uid wrote
        out_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ setup and guards
    def prepare(self, apk: Optional[Path], *, start_logcat: bool = True) -> dict[str, Any]:
        self.serial = self.adb.serialno()
        props = {key: self.adb.shell('getprop', key, check=False).strip()
                 for key in ('ro.kernel.qemu', 'ro.boot.qemu', 'ro.hardware', 'ro.boot.hardware', 'ro.build.version.sdk',
                             'ro.product.cpu.abi', 'ro.product.model')}
        if not core.is_emulator(self.serial, props):
            raise RefusedDevice('NOT_AN_EMULATOR: this proof drives only a disposable emulator, never a phone')
        self.adb.serial = self.serial
        if apk is not None:
            self.adb.run('install', '-r', '-g', str(apk), timeout=240)
        for key in ('window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'):
            self.adb.shell('settings', 'put', 'global', key, '0', check=False)
        self.adb.shell('input', 'keyevent', 'KEYCODE_WAKEUP', check=False)
        self.adb.shell('wm', 'dismiss-keyguard', check=False)
        self.adb.shell('service', 'call', 'alarm', '3', 's16', 'Europe/Belgrade', check=False)   # same zone as the QA emulator
        self.grant_notifications()
        self.screen_size = core.parse_wm_size(self.adb.shell('wm', 'size', check=False))
        self.uid = core.parse_package_uid(self.adb.shell('pm', 'list', 'packages', '-U', self.package, check=False), self.package)
        self.run_as_ok = self.adb.shell_rc('run-as', self.package, 'id')[0] == 0
        if start_logcat:
            self.start_logcat()
        self.info = {'serial': self.serial, 'sdk': props['ro.build.version.sdk'], 'abi': props['ro.product.cpu.abi'],
                     'model': props['ro.product.model'], 'hardware': props['ro.hardware'], 'uid': self.uid,
                     'runAsAvailable': self.run_as_ok, 'screen': list(self.screen_size) if self.screen_size else None}
        return self.info

    def grant_notifications(self) -> None:
        self.adb.shell('pm', 'grant', self.package, 'android.permission.POST_NOTIFICATIONS', check=False)

    # ------------------------------------------------------------------ app control
    def open_link(self, url: str, *, cold: bool) -> None:
        if not url.startswith('uskociapp://'):
            raise ValueError('NOT_AN_APP_LINK')
        if cold:
            self.force_stop()
        # The link carries credentials: it goes to the OS, never to a log. Output is discarded.
        self.adb.shell('am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', shlex.quote(url), self.package, check=False, timeout=90)
        self.clock.sleep(1.0)

    def home(self) -> None:
        self.adb.shell('input', 'keyevent', 'KEYCODE_HOME', check=False)
        self.clock.sleep(0.8)

    def press_back(self) -> None:
        self.adb.shell('input', 'keyevent', 'KEYCODE_BACK', check=False)
        self.clock.sleep(0.6)

    def force_stop(self) -> None:
        self.adb.shell('am', 'force-stop', self.package, check=False)
        self.clock.sleep(0.5)

    def clear_app_data(self) -> None:
        if not core.may_clear_app_data(self.serial, self.package, self.env):
            raise RefusedDevice('CLEAR_REFUSED: pm clear needs an emulator, this proof package, CI and EX07_S03_ALLOW_CLEAR=1')
        self.adb.shell('pm', 'clear', self.package, check=False)
        self.grant_notifications()
        self.clock.sleep(1.0)

    # ------------------------------------------------------------------ screen
    def screen(self, *, retries: int = 6) -> Screen:
        last: Optional[Exception] = None
        for _ in range(retries):
            try:
                said = self.adb.shell('uiautomator', 'dump', '/sdcard/ex07-window.xml', check=False, timeout=40)
                if 'dumped to' not in said:           # a failed dump leaves the previous file behind: never read that
                    raise AdbError('UI_DUMP_NOT_WRITTEN')
                nodes = core.parse_ui_dump(self.adb.shell('cat', '/sdcard/ex07-window.xml', timeout=30))
            except Exception as error:                # a dump can fail mid-transition: retry
                last = error
                self.clock.sleep(0.5)
                continue
            button = core.find_system_dialog_button(nodes)
            if button is not None and button.bounds:
                self._tap_point(button.bounds, nodes)
                self.clock.sleep(0.8)
                continue
            screen = self._screen_of(nodes)
            self.last_screen = screen
            self._check_leaks(screen)
            return screen
        raise UiTimeout('UI_DUMP_FAILED ' + (type(last).__name__ if last else ''))

    def _screen_of(self, nodes: list[core.Node]) -> Screen:
        present = any(n.pkg == self.package for n in nodes)
        foreign = tuple(sorted({n.pkg for n in nodes if n.pkg and n.pkg != self.package and n.pkg != 'com.android.systemui'}))
        state = core.classify_screen([n for n in nodes if n.pkg == self.package], self.labels) if present else 'NOT_APP'
        return Screen(nodes, state, present, foreign)

    def _check_leaks(self, screen: Screen) -> None:
        found = core.scan_nodes_for_leaks([n for n in screen.nodes if n.pkg == self.package], self.secrets,
                                          ('otp_expired', 'access_denied', 'Email link is invalid or has expired'))
        if found:
            self.leaks.append({'state': screen.state, 'what': found})

    def _try_screen(self) -> Optional[Screen]:
        """A screen, or None while uiautomator cannot get an idle UI (a spinner keeps it busy): waits keep polling."""
        try:
            return self.screen()
        except UiTimeout:
            return None

    def wait_for_state(self, *states: str, timeout: float = 45.0) -> Screen:
        return self.wait_until(lambda s: s.state in states, timeout)

    def wait_until(self, predicate: Callable[[Screen], bool], timeout: float = 30.0) -> Screen:
        deadline = self.clock.now() + timeout
        last: Optional[Screen] = None
        while True:
            screen = self._try_screen()
            if screen is not None:
                last = screen
            if (screen is not None and predicate(screen)) or self.clock.now() >= deadline:
                if last is None:
                    raise UiTimeout('UI_NEVER_DUMPED')
                return last
            self.clock.sleep(0.8)

    def wait_for_label(self, label_id: str, timeout: float = 30.0) -> bool:
        screen = self.wait_until(lambda s: self.labels.has(s.nodes, label_id), timeout)
        return self.labels.has(screen.nodes, label_id)

    def has_label(self, label_id: str) -> bool:
        return self.labels.has(self.screen().nodes, label_id)

    # ------------------------------------------------------------------ input
    def _tap_point(self, bounds: tuple[int, int, int, int], nodes: list[core.Node]) -> None:
        size = self.screen_size or (1080, 2400)
        x, y = core.tap_point(bounds, size, core.navigation_bar_top(nodes))
        self.adb.shell('input', 'touchscreen', 'swipe', str(x), str(y), str(x), str(y), '120')
        self.clock.sleep(0.4)

    def _scroll(self, attempt: int) -> None:
        width, height = self.screen_size or (1080, 2400)
        lower, upper = int(height * 0.7), int(height * 0.35)
        start, end = (lower, upper) if attempt % 3 != 2 else (upper, lower)      # mostly down, now and then back up
        self.adb.shell('input', 'swipe', str(width // 2), str(start), str(width // 2), str(end), '350')
        self.clock.sleep(0.5)

    def find(self, label_id: str, *, timeout: float = 30.0, scroll: bool = False) -> tuple[Screen, core.Node]:
        row = self.labels.row(label_id)
        started = self.clock.now()
        attempt = 0
        screen: Optional[Screen] = None
        while self.clock.now() - started < timeout:
            seen = self._try_screen()
            if seen is None:
                self.clock.sleep(0.6)
                continue
            screen = seen
            node = core.find_target([n for n in screen.nodes if n.pkg == self.package], row['text'], match=row['match'],
                                    field=(row['kind'] == 'field'), screen=self.screen_size)
            if node is not None:
                return screen, node
            if scroll and self.clock.now() - started > 3.0:
                self._scroll(attempt)
                attempt += 1
            else:
                self.clock.sleep(0.6)
        raise UiTimeout(f'UI_ELEMENT_NOT_REACHED {label_id} state={screen.state if screen else "?"}')

    def tap(self, label_id: str, *, timeout: float = 30.0, scroll: bool = True) -> None:
        screen, node = self.find(label_id, timeout=timeout, scroll=scroll)
        assert node.bounds is not None
        self._note_target(label_id, 'tap', screen, node)
        self._tap_point(node.bounds, screen.nodes)

    def _note_target(self, label_id: str, phase: str, screen: Screen, node: core.Node) -> None:
        # Never persist text, descriptions, resource ids, URLs, or the value being typed. Only a catalog label and geometry.
        row = self.labels.row(label_id)
        size = self.screen_size or (1080, 2400)
        nav_top = core.navigation_bar_top(screen.nodes)
        self.input_trace.append({'label': label_id, 'phase': phase, 'screen': screen.state,
            'bounds': node.bounds, 'tapPoint': core.tap_point(node.bounds, size, nav_top) if node.bounds else None,
            'screenSize': size, 'navigationBarTop': nav_top, 'isInput': node.cls == 'android.widget.EditText',
            'clickable': node.clickable, 'enabled': node.enabled, 'focused': node.focused, 'focusable': node.focusable,
            'candidateCount': sum(n.pkg == self.package and core.node_matches(n, row['text'], row['match'],
                field=row['kind'] == 'field') for n in screen.nodes)})
        self.input_trace = self.input_trace[-32:]

    def _focus_field(self, label_id: str) -> core.Node:
        row = self.labels.row(label_id)
        if row['kind'] != 'field':
            raise ValueError('TARGET_IS_NOT_FIELD')
        for _attempt in range(3):
            screen, node = self.find(label_id, timeout=15.0, scroll=True)
            assert node.bounds is not None
            self._note_target(label_id, 'focus-tap', screen, node)
            self._tap_point(node.bounds, screen.nodes)
            deadline = self.clock.now() + 3.0
            while self.clock.now() < deadline:
                seen = self._try_screen()
                if seen is not None:
                    target = core.find_target([n for n in seen.nodes if n.pkg == self.package], row['text'],
                                              match=row['match'], field=True, screen=self.screen_size)
                    if target is not None:
                        self._note_target(label_id, 'focus-readback', seen, target)
                        if target.focused:
                            return target
                self.clock.sleep(0.3)
        raise UiTimeout('FIELD_NOT_FOCUSED ' + label_id)

    def ime_shown(self) -> Optional[bool]:
        return core.parse_ime_shown(self.adb.shell('dumpsys', 'input_method', check=False, timeout=30))

    def hide_ime(self) -> None:
        if self.ime_shown() is True:
            self.adb.shell('input', 'keyevent', 'KEYCODE_BACK')
            self.clock.sleep(0.5)

    def set_field(self, label_id: str, value: str) -> None:
        if not re.fullmatch(r'[A-Za-z0-9@._-]+', value):
            raise ValueError('FIELD_VALUE_NOT_SHELL_SAFE')
        for _attempt in range(3):
            node = self._focus_field(label_id)
            # Clear what the field already holds (the entered e-mail survives a trip between forms), then type.
            self.adb.shell('input', 'keyevent', 'KEYCODE_MOVE_END')
            count = min(80, len(node.text) + 3)
            self.adb.shell('input', 'keyevent', *(['KEYCODE_DEL'] * count))
            self.adb.shell('input', 'text', value)
            self.clock.sleep(0.3)
            self.hide_ime()
            try:
                _, again = self.find(label_id, timeout=15.0)
            except UiTimeout:
                continue
            # A dropped character (a slow emulator) would silently turn into a wrong credential: read the field back.
            if again.password:
                if again.text == '' or len(again.text) == len(value):
                    return
            elif again.text == value:
                return
        raise UiTimeout('FIELD_NOT_ACCEPTED ' + label_id)

    # ------------------------------------------------------------------ evidence
    def shot(self, name: str) -> Optional[str]:
        try:
            data = self.adb.exec_out('screencap', '-p', timeout=60)
        except AdbError:
            return None
        path = self.out_dir / f'{name}.png'
        path.write_bytes(data)
        self.shots.append(path.name)
        return path.name

    def inventory(self) -> list[str]:
        """The visible words of the current screen, credentials redacted, for a failure report."""
        try:
            return [self.secrets.redact(t) for t in self.screen().texts(40)]
        except Exception:
            return []

    # logcat -----------------------------------------------------------
    # Two captures. APP: only what the app's own uid wrote (the thing assertion E13 is about). ALL: every buffer, including the
    # operating system's own lines (its activity-launch events): reported, never mixed into the app's verdict.
    def start_logcat(self) -> None:
        self.adb.run('logcat', '-b', 'all', '-c', check=False, timeout=30)
        self._log_file = open(self.logcat_path, 'wb')
        self._log_proc = self.adb.popen('logcat', '-v', 'threadtime', '-b', 'all', stdout=self._log_file)
        if self.uid is not None:
            self._app_log_file = open(self.app_logcat_path, 'wb')
            self._app_log_proc = self.adb.popen('logcat', '-v', 'threadtime', '-b', 'all', f'--uid={self.uid}', stdout=self._app_log_file)

    def stop_logcat(self) -> None:
        for proc_name, file_name in (('_log_proc', '_log_file'), ('_app_log_proc', '_app_log_file')):
            proc = getattr(self, proc_name)
            if proc is not None:
                proc.terminate()
                try:
                    proc.wait(timeout=10)
                except Exception:
                    proc.kill()
                setattr(self, proc_name, None)
            handle = getattr(self, file_name)
            if handle is not None:
                handle.close()
                setattr(self, file_name, None)

    def _scan_log(self, path: Path, handle: Any) -> dict[str, Any]:
        if handle is not None:
            handle.flush()
        if not path.exists():
            return {'lines': 0, 'matches': 0, 'tags': [], 'credentials': [], 'fatalLines': 0, 'anrLines': 0}
        return core.scan_logcat(path.read_bytes().decode('utf-8', 'replace'), self.secrets, self.package)

    def logcat_scan(self) -> dict[str, Any]:
        """{'app': what the app uid logged, 'all': every buffer}: tags and counts only, never message text."""
        return {'app': self._scan_log(self.app_logcat_path, self._app_log_file), 'all': self._scan_log(self.logcat_path, self._log_file)}

    # private storage -------------------------------------------------
    def _run_as(self, *args: str, timeout: float = 60) -> tuple[int, bytes]:
        return self.adb.run('exec-out', 'run-as', self.package, *args, timeout=timeout, check=False)

    def read_storage(self) -> Optional[dict[str, Any]]:
        """The app's Supabase session as the app itself stored it (fingerprints only).
        None whenever the files cannot be read with certainty: an unreadable store is never reported as an empty one."""
        if not self.run_as_ok:
            return None
        for _attempt in range(3):                       # the app may be writing: a copy of a live database can be torn
            try:
                rc_root, root = self._run_as('ls', '.')
                if rc_root != 0:
                    return None
                if 'databases' not in root.decode('utf-8', 'replace').split():
                    return core.parse_auth_storage([])  # the app has not stored anything yet
                rc_db, listing = self._run_as('ls', 'databases')
                if rc_db != 0:
                    return None
                names = [n for n in listing.decode('utf-8', 'replace').split() if n.startswith(('AsyncStorage', 'RKStorage'))]
                rows: list[tuple[str, Optional[str]]] = []
                with tempfile.TemporaryDirectory() as tmp:
                    for name in names:
                        rc, data = self._run_as('cat', f'databases/{name}')
                        if rc != 0:
                            raise AdbError('STORAGE_COPY_FAILED')
                        (Path(tmp) / name).write_bytes(data)
                    for name in names:
                        if not name.endswith(('-wal', '-shm', '-journal')):
                            rows.extend(_sqlite_rows(Path(tmp) / name))
                return core.parse_auth_storage(rows)
            except (AdbError, sqlite3.Error):
                self.clock.sleep(0.8)
        return None

    def scan_app_data(self) -> Optional[dict[str, Any]]:
        """Search every file of the app's private directory for callback credentials. None when it cannot be read."""
        if not self.run_as_ok:
            return None
        proc = self.adb.popen('exec-out', 'run-as', self.package, 'tar', '-cf', '-', '.')
        try:
            return core.scan_tar_stream(proc.stdout, self.secrets)
        except Exception:
            return None
        finally:
            try:
                proc.kill()
            except Exception:
                pass

    def os_retention(self) -> dict[str, Any]:
        """Does the operating system itself keep the callback URL in its activity records? (observation only)"""
        found: dict[str, Any] = {}
        for name, args in (('activities', ('dumpsys', 'activity', 'activities')), ('recents', ('dumpsys', 'activity', 'recents'))):
            text = self.adb.shell(*args, check=False, timeout=60)
            found[name] = {'bytes': len(text), 'credentialsFound': self.secrets.find_in_text(text)}
        return found


def _sqlite_rows(path: Path) -> list[tuple[str, Optional[str]]]:
    rows: list[tuple[str, Optional[str]]] = []
    try:
        con = sqlite3.connect(str(path))
        try:
            tables = {r[0] for r in con.execute("select name from sqlite_master where type='table'")}
            for table in ('Storage', 'catalystLocalStorage'):
                if table in tables:
                    rows.extend((str(k), v) for k, v in con.execute(f'select key, value from {table}'))
        finally:
            con.close()
    except sqlite3.Error:
        raise
    return rows
