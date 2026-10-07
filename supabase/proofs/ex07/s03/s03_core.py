"""EX-07 S03 - the pure logic of the auth-callback proof (no I/O: no adb, no network, no clock).

Import-safe and unit-tested offline (test_s03_core.py). The two runners only add I/O around these functions:
  s03_provider_proof.py  disposable GoTrue + Mailpit over HTTP (no app, no device)
  s03_android_proof.py   the same provider plus an Android emulator running the real app

Honesty contract (AGENTS 3.2): every report says what it IS (DISPOSABLE evidence) and what it is NOT (the hosted
provider, the owner's mailbox, a physical handset, iOS). A credential is never printed, logged or written to a report:
the proof keeps callback credentials only in memory, to go and look for them (SecretSet).
"""
from __future__ import annotations

import dataclasses
import hashlib
import html
import json
import re
import tarfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Callable, Iterable, Optional
from urllib.parse import parse_qs, parse_qsl, urlsplit

SLICE = 'EX07-S03'
LABEL = 'DISPOSABLE EMULATOR evidence'
LABEL_DETAIL = ('disposable GoTrue + Mailpit + Android emulator in CI; NOT the hosted provider, NOT the owner mailbox, '
                'NOT a physical handset, NOT iOS; CI-emulator numbers are never phone numbers')

# The two redirects the app really sends (src/data/authSignupRedirect.ts, src/data/passwordRecoveryLink.ts) and the
# provider settings the harness stack is started with (ex07_s03_env.sh). test_s03_contracts.py ties both to the source.
SIGNUP_REDIRECT = 'uskociapp://auth?form=login'
RECOVERY_REDIRECT = 'uskociapp://oporavak'
SITE_URL = 'http://127.0.0.1:4173'
OTP_EXPIRY_SECONDS = 60
MAX_FREQUENCY_SECONDS = 10
PACKAGE = 'rs.uskoci.ex07s03proof'

# ------------------------------------------------------------------------------------------------ assertion catalog
# id, level (HTTP = disposable GoTrue + Mailpit; EMULATOR = the real app on an emulator), kind, title.
# An 'assertion' passes or fails; an 'observation' records what the provider/OS does so that a human can judge it.
CATALOG: list[dict[str, str]] = [
    {'id': 'P01', 'level': 'HTTP', 'kind': 'assertion', 'title': 'Provider settings require email confirmation with email and signup on (the fields the app availability projection reads)'},
    {'id': 'P02', 'level': 'HTTP', 'kind': 'assertion', 'title': 'Signup with the allowlisted confirmation redirect returns no session and an unconfirmed user'},
    {'id': 'P03', 'level': 'HTTP', 'kind': 'assertion', 'title': 'The confirmation message reaches Mailpit exactly once; its link is a provider verify link of type signup with redirect_to exactly uskociapp://auth?form=login'},
    {'id': 'P04', 'level': 'HTTP', 'kind': 'assertion', 'title': 'Password sign-in is refused before confirmation (email_not_confirmed) and issues no session'},
    {'id': 'P05', 'level': 'HTTP', 'kind': 'assertion', 'title': 'The confirmation link redirects to the allowlisted destination with the session tokens in the URL fragment only; the account becomes confirmed and signs in as the same user id'},
    {'id': 'P06', 'level': 'HTTP', 'kind': 'assertion', 'title': 'A used confirmation link is refused: error redirect, no tokens'},
    {'id': 'P07', 'level': 'HTTP', 'kind': 'assertion', 'title': 'A wrong (tampered) confirmation token is refused: error redirect, no tokens, the account stays unconfirmed'},
    {'id': 'P08', 'level': 'HTTP', 'kind': 'assertion', 'title': 'An expired confirmation link is refused: error redirect, no tokens, the account stays unconfirmed'},
    {'id': 'P09', 'level': 'HTTP', 'kind': 'assertion', 'title': 'Resend is rate-limited by the configured frequency (429, no message) and an accepted resend produces a new message with a new token'},
    {'id': 'P09b', 'level': 'HTTP', 'kind': 'observation', 'title': 'Whether a resend supersedes the older confirmation link'},
    {'id': 'P10', 'level': 'HTTP', 'kind': 'assertion', 'title': 'Both allowlisted redirects appear verbatim in provider links; a foreign redirect_to never appears as the link destination'},
    {'id': 'P10b', 'level': 'HTTP', 'kind': 'observation', 'title': 'What the provider does with near-miss redirect variants of the allowlisted URLs'},
    {'id': 'P11', 'level': 'HTTP', 'kind': 'assertion', 'title': 'The recovery link redirects to uskociapp://oporavak with type=recovery tokens in the fragment only (the shape the app parser requires)'},
    {'id': 'P12', 'level': 'HTTP', 'kind': 'assertion', 'title': 'Used, wrong and expired recovery links are refused (error redirect, no tokens) and change no password'},
    {'id': 'P13', 'level': 'HTTP', 'kind': 'assertion', 'title': 'Recovery tokens identify exactly their own account; the password change affects only that account (old rejected, new accepted, another account untouched)'},
    {'id': 'P14', 'level': 'HTTP', 'kind': 'observation', 'title': 'Session invalidation rule after a recovery password change (other sessions; the recovery session itself)'},
    {'id': 'P15', 'level': 'HTTP', 'kind': 'assertion', 'title': 'A signup token cannot act as a recovery token and a recovery token cannot confirm a signup (type mismatch refused)'},
    {'id': 'E01', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'Fresh install, cold uskociapp://auth?form=login opens the LOGIN form'},
    {'id': 'E02', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'UI sign-up shows the confirmation stage without a session; the message in Mailpit carries the redirect the app really sent (exactly the allowlisted one)'},
    {'id': 'E03', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'In-app sign-in before confirmation is refused and stores no session'},
    {'id': 'E04', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'UI resend says the request was accepted (never delivered), produces a second message; a repeat inside the frequency window shows the rate-limit copy and sends nothing'},
    {'id': 'E05', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'Warm confirmation callback (app in background): app returns to the Auth surface, adopts no session, shows no token; Back to login and sign-in then work'},
    {'id': 'E06', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'Cold confirmation callback opens the LOGIN form (not a session); nothing is stored; the confirmed account then signs in'},
    {'id': 'E07', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'Used, expired and wrong-token confirmation callbacks open the LOGIN form with no session adopted and no provider text or token on screen'},
    {'id': 'E08', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'A confirmation callback of ANOTHER account opened while someone is signed in leaves that session untouched and adopts nothing'},
    {'id': 'E09', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'Recovery in the UI: the form shows the callback account, a mismatch writes nothing, the save changes only that account'},
    {'id': 'E10', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'A recovery callback opened while ANOTHER account is signed in is refused (no form), changes no password and leaves the session untouched; the same callback applied at the provider would have worked (positive control)'},
    {'id': 'E11', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'An OLD (already used) recovery callback replayed while another account is signed in is refused and changes nobody'},
    {'id': 'E12', 'level': 'EMULATOR', 'kind': 'observation', 'title': 'What the app shows when a used recovery callback is replayed while signed out'},
    {'id': 'E13', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'No callback token appears in the logcat lines written by the app (app-uid capture) during the whole run'},
    {'id': 'E14', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'No callback token is persisted in the app private storage (databases, files, shared_prefs, cache)'},
    {'id': 'E15', 'level': 'EMULATOR', 'kind': 'assertion', 'title': 'No callback token or provider text from a callback is visible on any screen the driver read'},
    {'id': 'E16', 'level': 'EMULATOR', 'kind': 'observation', 'title': 'Whether the operating system itself keeps the callback URL: in its activity records and in the system log lines (not written by the app)'},
]
CATALOG_BY_ID = {c['id']: c for c in CATALOG}

STATUS_RANK = {'PASS': 0, 'OBSERVATION': 0, 'NOT_RUN': 1, 'UNAVAILABLE': 2, 'ERROR': 3, 'FAIL': 4}


# ------------------------------------------------------------------------------------------------ secrets
_WORD = frozenset('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-')
_WORD_BYTES = frozenset(c.encode() for c in _WORD)
_JWT = re.compile(r'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}')
_PARAM = re.compile(r'(?i)\b(access_token|refresh_token|token_hash|code_verifier)=[^&\s"\'#]+')
_FRAGMENT = re.compile(r'(://[^\s"\'#]*)#[^\s"\']+')
_VERIFY_TOKEN = re.compile(r'(?i)([?&]token=)[A-Za-z0-9_-]{8,}')


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()[:10]


class SecretSet:
    """Credentials the proof has seen (callback tokens). Used only to look for them; never serialised."""

    def __init__(self) -> None:
        self._needles: dict[str, tuple[str, str]] = {}   # needle -> (label, fingerprint of the whole credential)

    def add(self, label: str, value: Optional[str]) -> None:
        if not value or len(value) < 10:
            return
        fp = fingerprint(value)
        parts = value.split('.')
        if len(parts) == 3 and value.startswith('eyJ'):
            # The JWT header is identical for every token of the project: never a needle (false positives).
            candidates = [value] + [p for p in parts[1:] if len(p) >= 16]
        else:
            candidates = [value]
        for needle in candidates:
            self._needles.setdefault(needle, (label, fp))

    def add_callback(self, info: 'CallbackInfo') -> None:
        for label, value in info.secrets:
            self.add(label, value)

    def __len__(self) -> int:
        return len({fp for _, fp in self._needles.values()})

    def labels(self) -> dict[str, str]:
        return {f'{label}:{fp}': fp for label, fp in self._needles.values()}

    def find_in_text(self, text: str) -> list[str]:
        found: list[str] = []
        for needle, (label, fp) in self._needles.items():
            if needle in text and _bounded_text(text, needle):
                tag = f'{label}:{fp}'
                if tag not in found:
                    found.append(tag)
        return found

    def find_in_bytes(self, data: bytes) -> list[str]:
        found: list[str] = []
        for needle, (label, fp) in self._needles.items():
            raw = needle.encode('utf-8')
            if raw in data and _bounded_bytes(data, raw):
                tag = f'{label}:{fp}'
                if tag not in found:
                    found.append(tag)
        return found

    def redact(self, text: str) -> str:
        for needle, (label, fp) in sorted(self._needles.items(), key=lambda item: -len(item[0])):
            text = text.replace(needle, f'[secret:{label}:{fp}]')
        return redact_generic(text)


def _bounded_text(hay: str, needle: str) -> bool:
    start = 0
    while True:
        i = hay.find(needle, start)
        if i < 0:
            return False
        before = hay[i - 1] if i > 0 else ''
        j = i + len(needle)
        after = hay[j] if j < len(hay) else ''
        if before not in _WORD and after not in _WORD:
            return True
        start = i + 1


def _bounded_bytes(hay: bytes, needle: bytes) -> bool:
    start = 0
    while True:
        i = hay.find(needle, start)
        if i < 0:
            return False
        before = hay[i - 1:i] if i > 0 else b''
        j = i + len(needle)
        after = hay[j:j + 1]
        if before not in _WORD_BYTES and after not in _WORD_BYTES:
            return True
        start = i + 1


def redact_generic(text: str) -> str:
    """Pattern redaction for credentials the SecretSet does not know (provider tokens, fragments, JWT-shaped text)."""
    text = _JWT.sub('[jwt]', text)
    text = _PARAM.sub(lambda m: f'{m.group(1)}=[redacted]', text)
    text = _VERIFY_TOKEN.sub(lambda m: f'{m.group(1)}[redacted]', text)
    text = _FRAGMENT.sub(lambda m: f'{m.group(1)}#[fragment-redacted]', text)
    return text


def sanitize_exception(error: BaseException, secrets: Optional[SecretSet] = None, limit: int = 240) -> str:
    text = f'{type(error).__name__}: {error}'
    text = secrets.redact(text) if secrets else redact_generic(text)
    return text[:limit]


# ------------------------------------------------------------------------------------------------ links and callbacks
@dataclasses.dataclass(frozen=True)
class VerifyLink:
    """A link from a provider message. `url` carries a one-time token: it is used, never printed."""
    url: str
    kind: str                 # signup | recovery | other
    redirect_to: Optional[str]
    token_length: int
    host: str
    port: Optional[int]
    path: str

    def public(self) -> dict[str, Any]:
        return {'kind': self.kind, 'redirectTo': self.redirect_to, 'tokenLength': self.token_length,
                'host': self.host, 'port': self.port, 'path': self.path}


def parse_verify_link(url: str) -> Optional[VerifyLink]:
    parts = urlsplit(url)
    if parts.path != '/auth/v1/verify' or not parts.hostname:
        return None
    params = parse_qs(parts.query, keep_blank_values=True)
    kind = (params.get('type') or [''])[0]
    token = (params.get('token') or params.get('token_hash') or [''])[0]
    return VerifyLink(url=url, kind=kind if kind in ('signup', 'recovery') else 'other',
                      redirect_to=(params.get('redirect_to') or [None])[0], token_length=len(token),
                      host=parts.hostname, port=parts.port, path=parts.path)


_HREF = re.compile(r'''href\s*=\s*["']([^"']+)["']''', re.IGNORECASE)
_BARE_URL = re.compile(r'https?://[^\s<>"\']+')


def extract_urls(message: dict[str, Any]) -> list[str]:
    """Every http(s) URL in a Mailpit message detail (HTML hrefs first, then the plain text part)."""
    urls: list[str] = []
    for raw in _HREF.findall(message.get('HTML') or ''):
        url = html.unescape(raw)
        if url not in urls:
            urls.append(url)
    for raw in _BARE_URL.findall(html.unescape(message.get('Text') or '')):
        url = raw.rstrip('.,);')
        if url not in urls:
            urls.append(url)
    return urls


def verify_links(message: dict[str, Any]) -> list[VerifyLink]:
    return [link for link in (parse_verify_link(u) for u in extract_urls(message)) if link]


def tamper_token(url: str) -> str:
    """The same link with its token changed in one character (a wrong token of the right length)."""
    parts = urlsplit(url)
    pairs = parse_qsl(parts.query, keep_blank_values=True)
    out: list[tuple[str, str]] = []
    changed = False
    for key, value in pairs:
        if key in ('token', 'token_hash') and value and not changed:
            value = value[:-1] + ('A' if value[-1] != 'A' else 'B')
            changed = True
        out.append((key, value))
    if not changed:
        raise ValueError('LINK_HAS_NO_TOKEN')
    return _with_query(url, out)


def swap_link_type(url: str, new_type: str) -> str:
    parts = urlsplit(url)
    pairs = [(k, new_type if k == 'type' else v) for k, v in parse_qsl(parts.query, keep_blank_values=True)]
    return _with_query(url, pairs)


def _with_query(url: str, pairs: list[tuple[str, str]]) -> str:
    from urllib.parse import urlencode, urlunsplit
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(pairs, safe=':/'), parts.fragment))


@dataclasses.dataclass(frozen=True)
class CallbackInfo:
    kind: str                         # SESSION_TOKENS | PROVIDER_ERROR | NO_FRAGMENT | MALFORMED
    base: str                         # the URL without its fragment
    base_matches: bool
    fragment_keys: tuple[str, ...]
    callback_type: Optional[str]
    error: Optional[str]
    error_code: Optional[str]
    error_description: Optional[str]
    tokens_in_query: bool
    duplicate_keys: bool
    secrets: tuple[tuple[str, str], ...] = dataclasses.field(default=(), repr=False)

    def public(self) -> dict[str, Any]:
        return {'kind': self.kind, 'baseMatches': self.base_matches, 'fragmentKeys': list(self.fragment_keys),
                'type': self.callback_type, 'error': self.error, 'errorCode': self.error_code,
                'errorDescription': self.error_description, 'tokensInQuery': self.tokens_in_query,
                'duplicateKeys': self.duplicate_keys,
                'credentialFingerprints': {label: fingerprint(value) for label, value in self.secrets}}


def classify_callback(url: str, expected_base: Optional[str] = None) -> CallbackInfo:
    base, sep, frag = url.partition('#')
    pairs = parse_qsl(frag, keep_blank_values=True) if sep else []
    keys = [k for k, _ in pairs]
    values = dict(pairs)
    duplicate = len(keys) != len(set(keys))
    query = parse_qs(urlsplit(base).query, keep_blank_values=True)
    tokens_in_query = any(k in query for k in ('access_token', 'refresh_token', 'token', 'token_hash', 'code'))
    has_error = 'error' in values or 'error_code' in values
    has_pair = bool(values.get('access_token')) and bool(values.get('refresh_token'))
    if has_error:
        kind = 'PROVIDER_ERROR'
    elif duplicate:
        kind = 'MALFORMED'
    elif has_pair:
        kind = 'SESSION_TOKENS'
    elif not pairs:
        kind = 'NO_FRAGMENT'
    else:
        kind = 'MALFORMED'
    secrets: list[tuple[str, str]] = []
    if kind == 'SESSION_TOKENS':
        secrets = [('access_token', values['access_token']), ('refresh_token', values['refresh_token'])]
    elif values.get('access_token'):
        secrets = [('access_token', values['access_token'])]
    return CallbackInfo(kind=kind, base=base, base_matches=(expected_base is None or base == expected_base),
                        fragment_keys=tuple(sorted(set(keys))), callback_type=values.get('type'),
                        error=values.get('error'), error_code=values.get('error_code'),
                        error_description=values.get('error_description'), tokens_in_query=tokens_in_query,
                        duplicate_keys=duplicate, secrets=tuple(secrets))


def evaluate_redirect_to(observed: Optional[str], requested: str, allowed: Iterable[str], site_url: str = SITE_URL) -> str:
    """How the provider treated a requested redirect: EXACT | SITE_URL | FOREIGN_ECHO | ABSENT | OTHER."""
    allowed_set = set(allowed)
    if observed is None or observed == '':
        return 'ABSENT'
    if observed == requested:
        return 'EXACT' if requested in allowed_set else 'FOREIGN_ECHO'
    if observed.rstrip('/') == site_url.rstrip('/'):
        return 'SITE_URL'
    return 'OTHER'


def gotrue_error(body: Any) -> tuple[str, str]:
    """(error_code, message) of a GoTrue JSON error body, tolerant of the old and the new shape."""
    if not isinstance(body, dict):
        return ('', '')
    code = body.get('error_code') or body.get('code') or body.get('error') or ''
    msg = body.get('msg') or body.get('message') or body.get('error_description') or ''
    return (str(code), str(msg))


# ------------------------------------------------------------------------------------------------ Mailpit
def message_ids(listing: dict[str, Any]) -> list[str]:
    return [item['ID'] for item in listing.get('messages', []) if item.get('ID')]


def messages_to(listing: dict[str, Any], email: str) -> list[dict[str, Any]]:
    wanted = email.lower()
    out = [item for item in listing.get('messages', [])
           if any((r.get('Address') or '').lower() == wanted for r in item.get('To', []))]
    return sorted(out, key=lambda item: item.get('Created') or '', reverse=True)


# ------------------------------------------------------------------------------------------------ screen and storage
@dataclasses.dataclass(frozen=True)
class Node:
    text: str
    desc: str
    cls: str
    rid: str
    pkg: str
    clickable: bool
    enabled: bool
    password: bool
    bounds: Optional[tuple[int, int, int, int]]
    order: int


_BOUNDS = re.compile(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]')


def norm(text: Optional[str]) -> str:
    return ' '.join((text or '').split())


def parse_bounds(raw: Optional[str]) -> Optional[tuple[int, int, int, int]]:
    m = _BOUNDS.fullmatch(raw or '')
    if not m:
        return None
    x1, y1, x2, y2 = (int(g) for g in m.groups())
    return (x1, y1, x2, y2) if x2 > x1 and y2 > y1 else None


def parse_ui_dump(xml_text: str) -> list[Node]:
    """uiautomator XML -> nodes in document order (later = drawn on top)."""
    start = xml_text.find('<?xml')
    end = xml_text.rfind('</hierarchy>')
    body = xml_text[start if start >= 0 else 0:(end + len('</hierarchy>')) if end >= 0 else None]
    # uiautomator never writes a DTD. Refusing one closes the entity-expansion and external-entity holes of the stdlib
    # parser without a new dependency (the dump comes from a disposable emulator, but the refusal costs nothing).
    if '<!DOCTYPE' in body or '<!ENTITY' in body:
        raise ValueError('UI_DUMP_HAS_DTD')
    root = ET.fromstring(body)
    nodes: list[Node] = []
    for i, el in enumerate(root.iter('node')):
        nodes.append(Node(text=norm(el.get('text')), desc=norm(el.get('content-desc')), cls=el.get('class') or '',
                          rid=el.get('resource-id') or '', pkg=el.get('package') or '',
                          clickable=el.get('clickable') == 'true', enabled=el.get('enabled') != 'false',
                          password=el.get('password') == 'true', bounds=parse_bounds(el.get('bounds')), order=i))
    return nodes


class Labels:
    """The words in ui_labels.json: id -> (text, match, kind)."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = {row['id']: row for row in rows}
        if len(self._rows) != len(rows):
            raise ValueError('DUPLICATE_LABEL_ID')

    @classmethod
    def load(cls, path: Path) -> 'Labels':
        return cls(json.loads(path.read_text(encoding='utf-8'))['labels'])

    def ids(self) -> list[str]:
        return list(self._rows)

    def row(self, label_id: str) -> dict[str, Any]:
        return self._rows[label_id]

    def text(self, label_id: str) -> str:
        return self._rows[label_id]['text']

    def matches(self, node: Node, label_id: str) -> bool:
        row = self._rows[label_id]
        return node_matches(node, row['text'], row['match'], field=(row['kind'] == 'field'))

    def has(self, nodes: Iterable[Node], label_id: str) -> bool:
        return any(self.matches(n, label_id) for n in nodes)


def node_matches(node: Node, text: str, match: str = 'exact', *, field: bool = False) -> bool:
    is_input = node.cls == 'android.widget.EditText'
    if field != is_input:      # a button or a text is never an input, and an input is only ever asked for as a field
        return False
    wanted = norm(text)
    if not wanted:
        return False
    # An EditText shows what was typed in `text`; its accessibilityLabel is `desc`. Others show their words in either.
    values = [node.desc] if field else [node.text, node.desc]
    if match == 'contains':
        return any(wanted in v for v in values if v)
    return any(v == wanted for v in values)


def find_target(nodes: list[Node], text: str, *, match: str = 'exact', field: bool = False,
                screen: Optional[tuple[int, int]] = None) -> Optional[Node]:
    """The node to act on: enabled, on screen, and the TOPMOST one (last in document order = drawn last = in front).
    The entry screen stays in the tree behind the auth sheet with the same words, so the first match would be the wrong one.
    A button's label text and its pressable carry the same words; either is a fine place to press."""
    hits = [n for n in nodes if n.enabled and n.bounds and node_matches(n, text, match, field=field)
            and (screen is None or _visible(n.bounds, screen))]
    return hits[-1] if hits else None


def _visible(bounds: tuple[int, int, int, int], screen: tuple[int, int]) -> bool:
    x1, y1, x2, y2 = bounds
    return x2 > 0 and y2 > 0 and x1 < screen[0] and y1 < screen[1]


def navigation_bar_top(nodes: Iterable[Node]) -> Optional[int]:
    tops = [n.bounds[1] for n in nodes if n.rid == 'android:id/navigationBarBackground' and n.bounds]
    return min(tops) if tops else None


def tap_point(bounds: tuple[int, int, int, int], screen: tuple[int, int], nav_top: Optional[int] = None) -> tuple[int, int]:
    """Centre of the part of the node that is really on screen and above the navigation bar."""
    x1, y1, x2, y2 = bounds
    x1, y1 = max(x1, 0), max(y1, 0)
    x2 = min(x2, screen[0] - 1)
    y2 = min(y2, (nav_top if nav_top else screen[1]) - 2)
    if x2 <= x1 or y2 <= y1:
        raise ValueError('NODE_NOT_ON_SCREEN')
    return ((x1 + x2) // 2, (y1 + y2) // 2)


def parse_wm_size(text: str) -> Optional[tuple[int, int]]:
    found = re.findall(r'(\d+)x(\d+)', text or '')
    return (int(found[-1][0]), int(found[-1][1])) if found else None


def parse_ime_shown(dumpsys: str) -> Optional[bool]:
    values = re.findall(r'\b(?:mInputShown|mIsInputViewShown|isInputViewShown)=(true|false)', dumpsys or '')
    if not values:
        return None
    return any(v == 'true' for v in values)


def visible_texts(nodes: Iterable[Node], limit: int = 60) -> list[str]:
    out: list[str] = []
    for n in nodes:
        for v in (n.text, n.desc):
            if v and v not in out and not n.password:
                out.append(v)
    return out[:limit]


def classify_screen(nodes: list[Node], labels: Labels) -> str:
    """The auth surface the screen shows. OTHER = something else is in front (the signed-in shell, an error, a splash)."""
    has = lambda label_id: labels.has(nodes, label_id)  # noqa: E731
    if has('oporavak.signed_in'):
        return 'OPORAVAK_SIGNED_IN'
    if has('oporavak.field.new') and has('oporavak.field.confirm'):
        return 'OPORAVAK_FORM'
    if has('oporavak.success'):
        return 'OPORAVAK_SUCCESS'
    if has('oporavak.invalid'):
        return 'OPORAVAK_INVALID'
    if has('oporavak.verifying'):
        return 'OPORAVAK_VERIFYING'
    if has('signup.field.first') and has('signup.field.last'):
        return 'SIGNUP_FORM'
    if has('recovery.sent.again'):
        return 'RECOVERY_SENT'
    if has('confirm.edit_email') or has('confirm.resend'):
        return 'CONFIRMATION_STAGE'
    if has('recovery.request.submit') and has('login.field.email'):
        return 'RECOVERY_REQUEST'
    if has('login.field.email') and has('login.field.password'):
        return 'LOGIN_FORM'
    return 'OTHER'


SYSTEM_DIALOG_BUTTONS = ('permission_deny_button', 'permission_deny_and_dont_ask_again_button', 'aerr_wait')


def find_system_dialog_button(nodes: Iterable[Node]) -> Optional[Node]:
    """A system dialog in front of the app (a runtime-permission prompt, an ANR) and the button that closes it harmlessly."""
    for n in nodes:
        if n.enabled and n.bounds and any(n.rid.endswith(':id/' + suffix) or n.rid.endswith('/' + suffix) for suffix in SYSTEM_DIALOG_BUTTONS):
            return n
    return None


AUTH_SURFACE_STATES = frozenset({'LOGIN_FORM', 'SIGNUP_FORM', 'CONFIRMATION_STAGE', 'RECOVERY_REQUEST', 'RECOVERY_SENT'})


@dataclasses.dataclass(frozen=True)
class SessionView:
    key: str
    user_id: Optional[str]
    access_fp: Optional[str]
    refresh_fp: Optional[str]


def parse_auth_storage(rows: Iterable[tuple[str, Optional[str]]]) -> dict[str, Any]:
    """AsyncStorage rows -> what the app holds about a Supabase session. Only fingerprints leave this function."""
    sessions: list[SessionView] = []
    total = 0
    for key, value in rows:
        total += 1
        if not re.fullmatch(r'sb-.+-auth-token', key or ''):
            continue
        try:
            data = json.loads(value or 'null')
        except ValueError:
            data = None
        if not isinstance(data, dict):
            sessions.append(SessionView(key, None, None, None))
            continue
        user = data.get('user') if isinstance(data.get('user'), dict) else {}
        access, refresh = data.get('access_token'), data.get('refresh_token')
        sessions.append(SessionView(key, user.get('id'), fingerprint(access) if access else None,
                                    fingerprint(refresh) if refresh else None))
    return {'rows': total, 'sessions': sessions,
            'hasSession': any(s.user_id for s in sessions),
            'userIds': sorted({s.user_id for s in sessions if s.user_id})}


# ------------------------------------------------------------------------------------------------ scanning
_LOGCAT = re.compile(r'^\d{2}-\d{2}\s+[\d:.]+\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+(\S.*?)\s*:\s')


def scan_logcat(text: str, secrets: SecretSet, package: str = PACKAGE) -> dict[str, Any]:
    """Look for callback credentials in a logcat dump. Returns tags and counts, never message text."""
    lines = 0
    matches: list[dict[str, str]] = []
    fatal = anr = 0
    for line in text.splitlines():
        lines += 1
        if 'FATAL EXCEPTION' in line or ('AndroidRuntime' in line and 'Process: ' + package in line):
            fatal += 1
        if 'ANR in ' + package in line:
            anr += 1
        hit = secrets.find_in_text(line)
        if hit:
            m = _LOGCAT.match(line)
            for tag in hit:
                matches.append({'credential': tag, 'tag': (m.group(4) if m else '?'), 'pid': (m.group(1) if m else '?')})
    tags = sorted({m['tag'] for m in matches})
    return {'lines': lines, 'matches': len(matches), 'tags': tags, 'credentials': sorted({m['credential'] for m in matches}),
            'fatalLines': fatal, 'anrLines': anr}


def scan_tar_stream(fileobj: Any, secrets: SecretSet, max_member: int = 256 * 1024 * 1024) -> dict[str, Any]:
    """Look for callback credentials in every file of a tar stream (the app private directory)."""
    files = total = 0
    matches: list[dict[str, str]] = []
    with tarfile.open(fileobj=fileobj, mode='r|') as tf:
        for member in tf:
            if not member.isfile():
                continue
            files += 1
            handle = tf.extractfile(member)
            if handle is None:
                continue
            data = handle.read(max_member)
            total += len(data)
            for tag in secrets.find_in_bytes(data):
                matches.append({'path': member.name, 'credential': tag})
    return {'files': files, 'bytes': total, 'matches': matches}


def scan_nodes_for_leaks(nodes: Iterable[Node], secrets: SecretSet, provider_phrases: Iterable[str] = ()) -> list[str]:
    """Credentials or provider error text visible on a screen (what a person could read or screenshot)."""
    texts = [v for n in nodes for v in (n.text, n.desc) if v]
    blob = '\n'.join(texts)
    found = list(secrets.find_in_text(blob))
    for phrase in provider_phrases:
        if phrase and phrase.lower() in blob.lower():
            found.append('provider-text:' + phrase)
    if re.search(r'access_token|refresh_token|error_code=', blob):
        found.append('token-parameter-text')
    return found


# ------------------------------------------------------------------------------------------------ device guards
def is_emulator(serial: str, props: dict[str, str]) -> bool:
    """The only device this proof may drive. A physical phone is somebody's own."""
    if not (serial or '').startswith('emulator-'):
        return False
    return (props.get('ro.kernel.qemu') == '1' or props.get('ro.boot.qemu') == '1'
            or props.get('ro.hardware') in ('ranchu', 'goldfish') or props.get('ro.boot.hardware') in ('ranchu', 'goldfish'))


def may_clear_app_data(serial: str, package: str, env: dict[str, str]) -> bool:
    """`pm clear` is destructive. Allowed only for THIS proof package, on an emulator, in CI, with the explicit flag."""
    return (package == PACKAGE and (serial or '').startswith('emulator-')
            and env.get('EX07_S03_ALLOW_CLEAR') == '1' and env.get('GITHUB_ACTIONS') == 'true')


def parse_package_uid(text: str, package: str = PACKAGE) -> Optional[int]:
    m = re.search(r'package:' + re.escape(package) + r'\s+uid:(\d+)', text or '')
    return int(m.group(1)) if m else None


# ------------------------------------------------------------------------------------------------ reports
class Report:
    """Collects results by catalog id. A harness exception is ERROR (never a finding); a false check is FAIL."""

    def __init__(self, level: str, meta: Optional[dict[str, Any]] = None, secrets: Optional[SecretSet] = None) -> None:
        self.level = level
        self.meta = dict(meta or {})
        self.secrets = secrets
        self.results: dict[str, dict[str, Any]] = {}
        self.timeline: list[dict[str, Any]] = []
        self.notes: list[str] = []

    def _clean(self, text: str) -> str:
        return self.secrets.redact(text) if self.secrets else redact_generic(text)

    def record(self, check_id: str, status: str, detail: str = '', /, **observed: Any) -> None:
        if check_id not in CATALOG_BY_ID:
            raise KeyError('UNKNOWN_CHECK ' + check_id)
        if status not in STATUS_RANK:
            raise ValueError('UNKNOWN_STATUS ' + status)
        if CATALOG_BY_ID[check_id]['kind'] == 'observation' and status in ('PASS', 'FAIL'):
            status = 'OBSERVATION'
        entry = {'id': check_id, 'status': status, 'detail': self._clean(detail)[:600], 'observed': _plain(observed)}
        old = self.results.get(check_id)
        if old is not None:
            worse = STATUS_RANK[entry['status']] > STATUS_RANK[old['status']]
            merged_detail = '; '.join(d for d in (old['detail'], entry['detail']) if d)[:900]
            merged_observed = {**old['observed'], **entry['observed']}
            entry = {'id': check_id, 'status': entry['status'] if worse else old['status'], 'detail': merged_detail,
                     'observed': merged_observed}
        self.results[check_id] = entry

    def expect(self, check_id: str, ok: bool, detail: str = '', /, **observed: Any) -> bool:
        self.record(check_id, 'PASS' if ok else 'FAIL', detail, **observed)
        return ok

    def observe(self, check_id: str, detail: str = '', /, **observed: Any) -> None:
        self.record(check_id, 'OBSERVATION', detail, **observed)

    def not_run(self, check_id: str, reason: str) -> None:
        self.record(check_id, 'NOT_RUN', reason)

    def unavailable(self, check_id: str, reason: str) -> None:
        self.record(check_id, 'UNAVAILABLE', reason)

    def error(self, check_id: str, error: BaseException) -> None:
        self.record(check_id, 'ERROR', sanitize_exception(error, self.secrets))

    def step(self, name: str, **info: Any) -> None:
        self.timeline.append({'step': name, **_plain(info)})

    def finalize(self) -> dict[str, Any]:
        rows: list[dict[str, Any]] = []
        for check in CATALOG:
            if check['level'] != self.level:
                continue
            row = self.results.get(check['id']) or {'id': check['id'], 'status': 'NOT_RUN', 'detail': 'not recorded', 'observed': {}}
            rows.append({**row, 'title': check['title'], 'kind': check['kind'], 'where': where_of(check['level'])})
        counts = {s: sum(1 for r in rows if r['status'] == s) for s in STATUS_RANK}
        return {'level': self.level, 'result': overall_result(counts), 'counts': counts, 'assertions': rows,
                'timeline': self.timeline, 'notes': self.notes, **self.meta}


def where_of(level: str) -> str:
    return {'HTTP': 'HTTP-level (disposable GoTrue + Mailpit)', 'EMULATOR': 'emulator (real app on a disposable Android emulator)'}.get(level, level)


def overall_result(counts: dict[str, int]) -> str:
    if counts.get('FAIL', 0):
        return 'FINDINGS'
    if counts.get('ERROR', 0):
        return 'HARNESS_BROKEN'
    if counts.get('NOT_RUN', 0) or counts.get('UNAVAILABLE', 0):
        return 'PARTIAL'
    return 'PASS'


def _plain(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_plain(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def result_line(report: dict[str, Any]) -> str:
    c = report.get('counts', {})
    return ('RESULT {level} {result} pass={p} fail={f} error={e} not_run={n} unavailable={u} observations={o} head={head} run={run} label="{label}"'
            .format(level=report.get('level'), result=report.get('result'), p=c.get('PASS', 0), f=c.get('FAIL', 0), e=c.get('ERROR', 0),
                    n=c.get('NOT_RUN', 0), u=c.get('UNAVAILABLE', 0), o=c.get('OBSERVATION', 0),
                    head=(report.get('source') or {}).get('head', '?'), run=(report.get('source') or {}).get('runId', '?'), label=LABEL))


_PRECEDENCE = ['FINDINGS', 'HARNESS_BROKEN', 'PARTIAL', 'PASS']


def merge_evidence(reports: dict[str, Optional[dict[str, Any]]], source: dict[str, Any],
                   skipped: Iterable[str] = ()) -> dict[str, Any]:
    """One evidence document from the per-level reports. A missing report (its job died) is HARNESS_BROKEN, never PASS.
    A level in `skipped` was left out on purpose (the dispatch scope): its checks are NOT_RUN and the result at most PARTIAL."""
    parts: list[dict[str, Any]] = []
    results: list[str] = []
    assertions: list[dict[str, Any]] = []
    skipped_levels = set(skipped)
    for level in ('HTTP', 'EMULATOR'):
        rep = reports.get(level)
        if rep is None and level in skipped_levels:
            results.append('PARTIAL')
            parts.append({'level': level, 'result': 'PARTIAL', 'reason': 'job skipped by the dispatch scope'})
            assertions.extend({'id': c['id'], 'status': 'NOT_RUN', 'detail': 'job skipped by the dispatch scope', 'title': c['title'],
                               'kind': c['kind'], 'where': where_of(level), 'observed': {}} for c in CATALOG if c['level'] == level)
            continue
        if rep is None:
            results.append('HARNESS_BROKEN')
            parts.append({'level': level, 'result': 'HARNESS_BROKEN', 'reason': 'no report was written by that job'})
            assertions.extend({'id': c['id'], 'status': 'NOT_RUN', 'detail': 'job produced no report', 'title': c['title'],
                               'kind': c['kind'], 'where': where_of(level), 'observed': {}} for c in CATALOG if c['level'] == level)
            continue
        results.append(rep['result'])
        parts.append({'level': level, 'result': rep['result'], 'counts': rep.get('counts')})
        assertions.extend(rep['assertions'])
    overall = next(r for r in _PRECEDENCE if r in results)
    counts = {s: sum(1 for a in assertions if a['status'] == s) for s in STATUS_RANK}
    return {
        'schemaVersion': 1, 'slice': SLICE, 'label': LABEL, 'labelDetail': LABEL_DETAIL, 'source': source,
        'result': overall, 'counts': counts, 'levels': parts, 'assertions': assertions,
        'claims': {
            'disposableGoTrueAndMailpit': any(r is not None for r in reports.values()),
            'androidEmulator': reports.get('EMULATOR') is not None,
            'realProvider': False, 'hostedAuthDashboardAllowlistChecked': False, 'externalSmtpDelivered': False,
            'ownerMailbox': False, 'physicalHandset': False, 'iOS': False, 'universalOrAppLinks': False,
            'devProjectAccessed': False, 'productionAccessed': False, 'mockAuthResponses': False,
            'directSqlFixtureWrites': False, 'marketplaceMigrationsReplayed': False,
        },
        'notEvidenceFor': ['the hosted Supabase Auth project (Site URL, redirect allowlist, SMTP sender, templates)',
                           'real e-mail delivery to a real mailbox', 'a physical Android handset', 'iOS',
                           'the production EAS profile', 'CI-emulator timings as phone timings'],
    }


def worst_result(results: Iterable[str]) -> str:
    present = set(results)
    return next((r for r in _PRECEDENCE if r in present), 'PASS')


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


Check = Callable[..., Any]
