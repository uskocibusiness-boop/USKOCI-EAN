"""A model of the auth surface of the real app, behind the SAME interface as s03_device.Device (test double, NOT evidence).

It follows src/app/auth.tsx, src/app/oporavak.tsx and the root layout guard, and talks to fakes.FakeProvider the way the app talks to
GoTrue. It exists so that the driver's flow logic, waits, state classification and assertions run offline; whether the REAL app does
this is what only the CI emulator run can show. `bugs` switches on one defect at a time, to show the proof catches it:
  adopts_session      a signup callback creates a session from the fragment tokens
  replaces_session    a signup callback replaces the session of the signed-in account
  ignores_signed_in   the recovery screen works although another account is signed in
  logs_tokens         the callback URL is written to the log
  persists_tokens     the callback URL is written to the app private directory
  shows_tokens        the callback URL is drawn on screen
  os_logs_url         NOT an app defect: the operating system itself writes the launch URI to the system log
"""
from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path
from typing import Any, Optional

import fakes
import s03_core as core
import s03_http as net
from s03_device import Device

BULLETS = '•'
AUTH_SCREENS = ('LOGIN', 'SIGNUP', 'CONFIRM', 'RECOVERY_REQ', 'RECOVERY_SENT')


def _node(text: str, desc: str, cls: str, bounds: tuple[int, int, int, int], *, clickable: bool = False, enabled: bool = True,
          password: bool = False, pkg: str = core.PACKAGE) -> core.Node:
    return core.Node(text=text, desc=desc, cls=cls, rid='', pkg=pkg, clickable=clickable, enabled=enabled, password=password,
                     bounds=bounds, order=0)


class FakeApp(Device):
    def __init__(self, provider: fakes.FakeProvider, labels: core.Labels, secrets: core.SecretSet, clock: fakes.FakeClock,
                 bugs: frozenset = frozenset(), *, run_as: bool = True) -> None:
        super().__init__(adb=None, labels=labels, out_dir=Path(tempfile.mkdtemp(prefix='ex07-fake-')), secrets=secrets, clock=clock,
                         package=core.PACKAGE, env={'EX07_S03_ALLOW_CLEAR': '1', 'GITHUB_ACTIONS': 'true'})
        self.provider = provider
        self.gt = net.GoTrue(net.Http(provider.transport), fakes.API, 'anon')
        self.bugs = set(bugs)
        self.serial = 'emulator-5554'
        self.run_as_ok = run_as
        self.screen_size = (1080, 2400)
        self.session: Optional[dict[str, Any]] = None      # persisted in the app's storage: survives a force-stop
        self.disk: list[tuple[str, bytes]] = []            # what the app wrote to its private directory
        self.log_lines: list[str] = []
        self.system_log_lines: list[str] = []              # lines the OS itself wrote (not the app)
        self.os_text = ''
        self.cleared = 0
        self._nodes: list[core.Node] = []
        self._reset_runtime()

    # ------------------------------------------------------------------ model state
    def _reset_runtime(self) -> None:
        self.running = False
        self.foreground = False
        self.where = 'CLOSED'
        self.fields: dict[str, str] = {}
        self.message: Optional[str] = None
        self.validation: Optional[str] = None
        self.intent_link: Optional[str] = None
        self.recovery: Optional[dict[str, Any]] = None

    def _persist_session(self, body: dict[str, Any]) -> None:
        self.session = {'access_token': body['access_token'], 'refresh_token': body['refresh_token'], 'user': body['user']}
        self.disk = [(p, d) for p, d in self.disk if not p.endswith('AsyncStorage')]
        self.disk.append(('databases/AsyncStorage', json.dumps({'sb-10-auth-token': self.session}).encode()))

    def _log(self, line: str) -> None:
        self.log_lines.append(f'10-02 12:00:00.000  1000  1000 I ReactNativeJS: {line}')

    # ------------------------------------------------------------------ Device surface (overrides)
    def prepare(self, apk: Optional[Path], *, start_logcat: bool = True) -> dict[str, Any]:
        self.info = {'serial': self.serial, 'sdk': '35', 'abi': 'x86_64', 'model': 'fake', 'hardware': 'ranchu', 'uid': 10201,
                     'runAsAvailable': self.run_as_ok, 'screen': [1080, 2400]}
        return self.info

    def grant_notifications(self) -> None:
        pass

    def start_logcat(self) -> None:
        pass

    def stop_logcat(self) -> None:
        pass

    def hide_ime(self) -> None:
        pass

    def shot(self, name: str) -> Optional[str]:
        self.shots.append(name + '.png')
        return name + '.png'

    def force_stop(self) -> None:
        self._reset_runtime()

    def clear_app_data(self) -> None:
        if not core.may_clear_app_data(self.serial, self.package, self.env):
            raise RuntimeError('CLEAR_REFUSED')
        self._reset_runtime()
        self.session = None
        self.disk = []
        self.cleared += 1

    def home(self) -> None:
        self.foreground = False

    def press_back(self) -> None:
        if not self.foreground:
            return
        if self.where.startswith('OPORAVAK'):
            self.where = 'HOME' if self.session else 'LOGIN'
            self.intent_link = None
        elif self.where in AUTH_SCREENS:
            self.where = 'LOGIN'

    def open_link(self, url: str, *, cold: bool) -> None:
        if not url.startswith('uskociapp://'):
            raise ValueError('NOT_AN_APP_LINK')
        if cold:
            self.force_stop()
        self.os_text += ' ' + url
        if 'os_logs_url' in self.bugs:                     # not an app defect: what an OS that logs launch URIs would do
            self.system_log_lines.append('10-02 12:00:00.000   800   900 I wm_create_activity: [0,1,2,x/.MainActivity,android.intent.action.VIEW,NULL,' + url + ']')
        was_running = self.running
        self.running = self.foreground = True
        base, _, fragment = url.partition('#')
        if 'logs_tokens' in self.bugs:
            self._log('link ' + url)
        if 'persists_tokens' in self.bugs and fragment:
            self.disk.append(('files/last-link.txt', url.encode()))
        if base.startswith('uskociapp://oporavak'):
            self._recovery_callback(url)
        elif base.startswith('uskociapp://auth'):
            self._auth_callback(url, was_running)
        self.clock.sleep(1.0)

    def _auth_callback(self, url: str, was_running: bool) -> None:
        info = core.classify_callback(url)
        if self.session:
            if 'replaces_session' in self.bugs and info.kind == 'SESSION_TOKENS':
                values = dict(info.secrets)
                self._persist_session({'access_token': values['access_token'], 'refresh_token': values['refresh_token'],
                                       'user': {'id': 'someone-else', 'email': 'x'}})
            self.where = 'HOME'
            return
        if 'adopts_session' in self.bugs and info.kind == 'SESSION_TOKENS':
            values = dict(info.secrets)
            who = self.gt.get_user(values['access_token']).json()
            self._persist_session({'access_token': values['access_token'], 'refresh_token': values['refresh_token'],
                                   'user': {'id': who.get('id'), 'email': who.get('email')}})
            self.where = 'HOME'
            return
        if was_running and self.where in AUTH_SCREENS:
            return                                  # the same route parameter: the stage on screen is not replayed
        self.where = 'LOGIN'

    def _recovery_callback(self, url: str) -> None:
        self.intent_link = url
        if self.session and 'ignores_signed_in' not in self.bugs:
            self.where = 'OPORAVAK_SIGNED_IN'
            return
        info = core.classify_callback(url, core.RECOVERY_REDIRECT)
        valid = (info.kind == 'SESSION_TOKENS' and info.base_matches and info.callback_type == 'recovery' and not info.tokens_in_query)
        self.recovery = None
        if valid:
            values = dict(info.secrets)
            who = self.gt.get_user(values['access_token'])
            if who.status == 200:
                self.recovery = {'access': values['access_token'], 'email': who.json().get('email')}
        self.where = 'OPORAVAK_FORM' if self.recovery else 'OPORAVAK_INVALID'
        self.fields.pop('Nova lozinka', None)
        self.fields.pop('Potvrdi novu lozinku', None)
        self.validation = None

    # ------------------------------------------------------------------ the screen
    def screen(self, *, retries: int = 6) -> Any:
        nodes = self._build_nodes()
        self._nodes = nodes
        screen = self._screen_of(nodes)
        self.last_screen = screen
        self._check_leaks(screen)
        return screen

    def _build_nodes(self) -> list[core.Node]:
        if not (self.running and self.foreground):
            return [_node('Chrome', '', 'android.widget.TextView', (0, 0, 500, 100), pkg='com.android.launcher3')]
        rows: list[core.Node] = []
        y = [200]

        def box() -> tuple[int, int, int, int]:
            top = y[0]
            y[0] += 120
            return (100, top, 980, top + 100)

        def field(label: str, password: bool = False) -> None:
            text = self.fields.get(label, '')
            rows.append(_node((BULLETS * len(text)) if password else text, label, 'android.widget.EditText', box(), clickable=True, password=password))

        def text(value: str) -> None:
            rows.append(_node(value, '', 'android.widget.TextView', box()))

        def button(label: str) -> None:
            rows.append(_node('', label, 'android.view.ViewGroup', box(), clickable=True))

        w = self.where
        if w == 'LOGIN':
            text('Prijava'); text('Zdravo.'); field('Email'); field('Lozinka', True)
            if self.validation:
                text(self.validation)
            text('Zaboravljena lozinka?'); button('Prijavi se'); text('Napravi nalog')
        elif w == 'SIGNUP':
            text('Registracija'); text('Napravi nalog')
            for label in ('Ime', 'Prezime', 'Grad', 'Email'):
                field(label)
            field('Lozinka', True)
            if self.validation:
                text(self.validation)
            button('Napravi nalog'); text('Već imaš nalog? Prijavi se')
        elif w == 'CONFIRM':
            text('Registracija'); text('Proveri email')
            if self.message:
                text(self.message)
            text('Ako je registracija prihvaćena, potvrdi email preko poruke koju dobiješ.')
            button('Nazad na prijavu'); text('Pošalji ponovo potvrdu'); text('Izmeni email')
            if self.validation:
                text(self.validation)
        elif w == 'RECOVERY_REQ':
            text('Oporavak pristupa'); text('Vrati pristup nalogu.'); field('Email'); button('Pošalji link'); text('Nazad na prijavu')
        elif w == 'RECOVERY_SENT':
            text('Oporavak pristupa'); text('Proveri email'); text('Zahtev za oporavak je prihvaćen.'); button('Nazad na prijavu')
            text('Izmeni email ili ponovi zahtev')
        elif w == 'OPORAVAK_FORM':
            text('Oporavak naloga'); text('Postavi novu lozinku.'); text('Postavi novu lozinku za nalog:')
            text(self.recovery['email'] if self.recovery else '')
            field('Nova lozinka', True); field('Potvrdi novu lozinku', True)
            if self.validation:
                text(self.validation)
            button('Sačuvaj novu lozinku')
        elif w == 'OPORAVAK_SUCCESS':
            text('Oporavak naloga'); text('Lozinka je promenjena.'); button('Prijavi se')
        elif w == 'OPORAVAK_INVALID':
            text('Oporavak naloga'); text('Link je nevažeći ili je istekao. Zatraži novi link.'); button('Zatraži novi link')
            text('Nazad na prijavu')
        elif w == 'OPORAVAK_SIGNED_IN':
            text('Oporavak naloga')
            text('Najpre se odjavi sa otvorenog naloga, pa ponovo otvori link za oporavak.')
            text('Nazad u aplikaciju')
        elif w == 'HOME':
            text('Početna'); text('Zadaci'); text('Dogovori')
        else:
            text('Učitavanje')
        if 'shows_tokens' in self.bugs and self.intent_link:
            text('debug ' + self.intent_link)
        return rows

    # ------------------------------------------------------------------ input
    def _tap_point(self, bounds: tuple[int, int, int, int], nodes: list[core.Node]) -> None:
        node = next(n for n in self._nodes if n.bounds == bounds)
        self._on_tap(node.desc or node.text)

    def set_field(self, label_id: str, value: str) -> None:
        if not re.fullmatch(r'[A-Za-z0-9@._-]+', value):
            raise ValueError('FIELD_VALUE_NOT_SHELL_SAFE')
        _, node = self.find(label_id, timeout=40.0, scroll=True)
        self.fields[node.desc] = value

    def _on_tap(self, label: str) -> None:
        w = self.where
        email, password = self.fields.get('Email', ''), self.fields.get('Lozinka', '')
        if w == 'LOGIN':
            if label == 'Prijavi se':
                resp = self.gt.password_login(email, password)
                if resp.status == 200:
                    self._persist_session(resp.json())
                    self.where = 'HOME'
                else:
                    self.validation = 'Prijava nije uspela. Proveri email i lozinku i pokušaj ponovo.'
            elif label == 'Napravi nalog':
                self.where = 'SIGNUP'
                self.validation = None
            elif label == 'Zaboravljena lozinka?':
                self.where = 'RECOVERY_REQ'
        elif w == 'SIGNUP':
            if label == 'Napravi nalog':
                resp = self.gt.signup(email, password, redirect=core.SIGNUP_REDIRECT, data={'first_name': self.fields.get('Ime', '')})
                if resp.status == 200 and 'access_token' not in resp.json():
                    self.where = 'CONFIRM'
                    self.fields.pop('Lozinka', None)
                    self.message = self.validation = None
                else:
                    self.validation = 'Registracija trenutno nije uspela. Proveri podatke i pokušaj ponovo.'
            elif label.startswith('Već imaš nalog'):
                self.where = 'LOGIN'
        elif w == 'CONFIRM':
            if label == 'Pošalji ponovo potvrdu':
                resp = self.gt.resend(email, core.SIGNUP_REDIRECT)
                self.message = self.validation = None
                if resp.status == 200:
                    self.message = 'Zahtev za novu potvrdu je prihvaćen. Proveri email i neželjenu poštu.'
                elif resp.status == 429:
                    self.validation = 'Previše pokušaja. Sačekaj kratko pa pokušaj ponovo.'
                else:
                    self.validation = 'Novu potvrdu trenutno nije moguće zatražiti. Pokušaj ponovo.'
            elif label == 'Nazad na prijavu':
                self.where = 'LOGIN'
                self.message = self.validation = None
            elif label == 'Izmeni email':
                self.where = 'SIGNUP'
        elif w == 'RECOVERY_REQ':
            if label == 'Pošalji link':
                self.gt.recover(email, redirect=core.RECOVERY_REDIRECT)
                self.where = 'RECOVERY_SENT'
            elif label == 'Nazad na prijavu':
                self.where = 'LOGIN'
        elif w == 'RECOVERY_SENT':
            if label == 'Nazad na prijavu':
                self.where = 'LOGIN'
        elif w == 'OPORAVAK_FORM':
            if label == 'Sačuvaj novu lozinku':
                new, again = self.fields.get('Nova lozinka', ''), self.fields.get('Potvrdi novu lozinku', '')
                if len(new) < 6:
                    self.validation = 'Lozinka mora imati najmanje 6 znakova.'
                elif new != again:
                    self.validation = 'Lozinke se ne poklapaju.'
                else:
                    self.validation = None
                    put = self.gt.put_user(self.recovery['access'], new) if self.recovery else None
                    self.where = 'OPORAVAK_SUCCESS' if put is not None and put.status == 200 else 'OPORAVAK_INVALID'
        elif w == 'OPORAVAK_SUCCESS':
            if label == 'Prijavi se':
                self.where = 'LOGIN'
                self.intent_link = None
                self.recovery = None
                self.fields.pop('Lozinka', None)
        elif w == 'OPORAVAK_INVALID':
            if label == 'Nazad na prijavu':
                self.where = 'LOGIN'
                self.intent_link = None
        elif w == 'OPORAVAK_SIGNED_IN':
            if label == 'Nazad u aplikaciju':
                self.where = 'HOME'
                self.intent_link = None

    # ------------------------------------------------------------------ evidence
    def read_storage(self) -> Optional[dict[str, Any]]:
        if not self.run_as_ok:
            return None
        rows = [('sb-10-auth-token', json.dumps(self.session))] if self.session else []
        return core.parse_auth_storage(rows)

    def scan_app_data(self) -> Optional[dict[str, Any]]:
        if not self.run_as_ok:
            return None
        matches = [{'path': path, 'credential': tag} for path, data in self.disk for tag in self.secrets.find_in_bytes(data)]
        return {'files': len(self.disk), 'bytes': sum(len(d) for _, d in self.disk), 'matches': matches}

    def logcat_scan(self) -> dict[str, Any]:
        app_text = '\n'.join(self.log_lines) or '10-02 12:00:00.000  1000  1000 I Fake: started'
        all_text = app_text + '\n' + '\n'.join(self.system_log_lines)
        return {'app': core.scan_logcat(app_text, self.secrets, self.package),
                'all': core.scan_logcat(all_text, self.secrets, self.package)}

    def os_retention(self) -> dict[str, Any]:
        return {'activities': {'bytes': len(self.os_text), 'credentialsFound': self.secrets.find_in_text(self.os_text)},
                'recents': {'bytes': 0, 'credentialsFound': []}}
