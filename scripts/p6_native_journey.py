#!/usr/bin/env python3
"""P6 native acceptance journey on the CI-hosted Android emulator against a DISPOSABLE restricted local server.

Real UI input only (uiautomator + adb input). The database is used read-only for postflight facts (the exact
rpc_discovery_v1 requests the app sent, expected counts). Nothing here signs in through a shortcut: the viewer account
is a real local Auth user created by supabase/proofs/discovery/p6_native_fixture.mjs and the app signs in through its
real sheet.

P6N_JOURNEY=probe : record the real UI structure at every step; failures are recorded, never fatal (learn labels/geometry).
P6N_JOURNEY=full  : the acceptance journey; every recorded failure fails the run (the steps still all execute so one
                    run yields the whole evidence).

Server-side evidence: the disposable database logs every statement (workflow step), so the driver reads back the exact
rpc_discovery_v1 request bodies the app sent (mode, filter, scope, cursor, bounds) and compares the UI with them and
with the counts the server itself returns for the same filters (fixture.json `expected`). Nothing is read from the
canonical DEV.
"""
import ast
import datetime
import json
import math
import os
import re
import struct
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

PACKAGE = 'rs.uskoci.dev'
MAIN_ACTIVITY = f'{PACKAGE}/.MainActivity'
MODE = os.environ.get('P6N_JOURNEY', 'probe')
assert MODE in ('probe', 'full')
# A focused run: only the named steps (login always). Empty = the whole journey, which is the only acceptance run.
FOCUS = [s for s in os.environ.get('P6N_STEPS', '').replace(',', ' ').split() if s]
DB_URL = os.environ['RU5_DEVICE_DB_URL']
if urlparse(DB_URL).hostname not in ('localhost', '127.0.0.1'):
    raise RuntimeError('P6 native journey requires the disposable local database')
PASSWORD = os.environ['P6N_PASSWORD']
VIEWER_EMAIL = os.environ['P6N_VIEWER_EMAIL']
TOTAL = int(os.environ['P6N_TOTAL'])
ARTIFACT_DIR = Path(os.environ.get('P6N_ARTIFACT_DIR', 'artifacts/p6-native'))
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
CORE106 = True  # the helpers' "current three-zone shell" wait after login
FIXTURE_PATH = ARTIFACT_DIR / 'fixture.json'
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding='utf-8')) if FIXTURE_PATH.exists() else {}
EXPECTED = FIXTURE.get('expected', {})
def _capture_start():
    """The capture window opens 30 s before the fixture's own PAGE probes, so the probes themselves prove the capture works."""
    observed = (FIXTURE.get('pageProbeCounts') or {}).get('observedAt')
    try:
        from datetime import datetime, timedelta, timezone
        at = datetime.fromisoformat(observed.replace('Z', '+00:00')) if observed else None
        if at is not None:
            return (at.astimezone(timezone.utc) - timedelta(seconds=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception:                                         # noqa: BLE001
        pass
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - 5))


START_ISO = _capture_start()

# Borrow only the FUNCTION definitions of the proven RU5 driver (input pacing, ANR handling, tap/wait, paced typing).
_source = Path(__file__).with_name('ru5_android_device_ui_journey.py')
_defs = ast.Module(body=[n for n in ast.parse(_source.read_text(encoding='utf-8')).body if isinstance(n, ast.FunctionDef)],
                   type_ignores=[])
exec(compile(_defs, str(_source), 'exec'), globals())

REPORT = {'mode': MODE, 'route': os.environ.get('P6N_ROUTE', 'proof'), 'sourceSha': os.environ.get('GITHUB_SHA'), 'steps': [], 'checks': [], 'result': 'FAIL'}
ITEM_DESC = re.compile(r'^Otvori (?:priliku|Zadatak) (P6N (\d{3}) (DENSE|SPARSE|REMOTE|NOPOINT))\b')   # the label continues with the card's spoken facts
# proof: the guarded proof APK (route parameter + compile flag + DEV package); production: an APK compiled with the production
# reader flag, where the ordinary Zadaci tab IS the P6 route and no parameter exists.
ROUTE = os.environ.get('P6N_ROUTE', 'proof')
assert ROUTE in ('proof', 'production')
LIST_URL = 'uskociapp://zadaci?p6Proof=1' if ROUTE == 'proof' else 'uskociapp://zadaci'


def note(kind, **fields):
    line = {'t': round(time.time(), 1), 'kind': kind, **fields}
    print(json.dumps(line, ensure_ascii=False), flush=True)
    return line


# ------------------------------------------------------------------------------------------------ device helpers
_DEVICE = {}


def screen_size():
    if 'size' not in _DEVICE:
        w, h = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').stdout)[-1])
        _DEVICE['size'] = (w, h)
    return _DEVICE['size']


def px_per_dp():
    if 'dp' not in _DEVICE:
        out = adb('shell', 'wm', 'density', check=False).stdout
        nums = re.findall(r'(\d+)', out)
        _DEVICE['dp'] = (int(nums[-1]) / 160.0) if nums else 2.625
    return _DEVICE['dp']


_NAV = {'top': None}


def note_nav(root):
    """The app window's own tree carries the system bar's scrim (android:id/navigationBarBackground): its top is exact."""
    for n in root.iter():
        if n.attrib.get('resource-id', '').startswith('android:id/navigationBarBa'):
            try:
                _NAV['top'] = parse_bounds(n.attrib.get('bounds'))[1]
            except RuntimeError:
                pass
            return


def safe_bottom():
    """Lowest y a finger may safely press: the system navigation bar (48 dp in 3-button mode) can cover the app window's
    bottom edge, and a press inside the bar goes to the bar, never to the app (observed on the entry screen)."""
    if _NAV['top']:
        return _NAV['top'] - 8
    w, h = screen_size()
    return h - int(round(48 * px_per_dp())) - 8


def rid(node):
    return node.attrib.get('resource-id', '')


def label_of(node):
    return (node.attrib.get('text', '') or node.attrib.get('content-desc', '')).strip()


def nodes(root, rid_=None, desc=None, text=None, contains=None, prefix=None, clazz=None):
    out = []
    for n in root.iter():
        a = n.attrib
        if a.get('package') != PACKAGE:
            continue
        if rid_ is not None and a.get('resource-id', '') != rid_:
            continue
        if desc is not None and a.get('content-desc', '') != desc:
            continue
        if text is not None and a.get('text', '') != text:
            continue
        if clazz is not None and a.get('class', '') != clazz:
            continue
        hay = f"{a.get('text', '')} {a.get('content-desc', '')}"
        if contains is not None and contains not in hay:
            continue
        if prefix is not None and not (a.get('content-desc', '').startswith(prefix) or a.get('text', '').startswith(prefix)):
            continue
        out.append(n)
    return out


def dump(retries=5):
    """A UI dump that survives transient uiautomator failures; a verified app/system ANR stays fatal (RU5 helper)."""
    last = None
    for _ in range(retries):
        try:
            root, parent, _ = dump_tree()
            if dismiss_known_system_anr(root, parent):
                continue
            note_nav(root)
            return root, parent
        except Exception as exc:                              # noqa: BLE001
            if getattr(exc, 'native_surface_fatal', False):
                raise
            last = exc
            time.sleep(1.0)
    raise RuntimeError(f'UI dump failed: {type(last).__name__}: {str(last)[:160]}')


def poll(pred, timeout=30, interval=1.0, what='condition'):
    end = time.time() + timeout
    last_exc = None
    while time.time() < end:
        try:
            root, parent, _ = dump_tree()
            if dismiss_known_system_anr(root, parent):
                continue
            note_nav(root)
            value = pred(root, parent)
            if value:
                return value, root, parent
        except Exception as exc:                              # noqa: BLE001
            if getattr(exc, 'native_surface_fatal', False):
                raise
            last_exc = exc
        time.sleep(interval)
    raise RuntimeError(f'timeout ({timeout}s) waiting for {what}' + (f' (last error: {type(last_exc).__name__})' if last_exc else ''))


def press_at(x, y, hold_ms=120):
    adb('shell', 'input', 'touchscreen', 'swipe', str(x), str(y), str(x), str(y), str(hold_ms))
    time.sleep(0.8)


def center_of(node, parent):
    """Middle of the part of a control that is really on screen and above the system navigation bar."""
    target = clickable_for(node, parent)
    target = node if target is None else target
    x1, y1, x2, y2 = parse_bounds(target.attrib.get('bounds'))
    y2 = min(y2, safe_bottom())
    if y2 - y1 < 10:
        raise RuntimeError(f'control not visible enough to press: {label_of(target)!r} bounds={target.attrib.get("bounds")}')
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap_visible(node, parent, hold_ms=120):
    x, y = center_of(node, parent)
    press_at(x, y, hold_ms)


def swipe(x1, y1, x2, y2, ms=600):
    adb('shell', 'input', 'touchscreen', 'swipe', str(x1), str(y1), str(x2), str(y2), str(ms))
    time.sleep(1.0)


def scroll_list(direction='down', fraction=0.5, ms=600, x_fraction=0.9):
    w, h = screen_size()
    span = int(h * fraction)
    x = int(w * x_fraction)       # away from the centred "Mapa" pill
    if direction == 'down':      # finger moves up: content moves up, later items appear
        start = int(h * 0.80)
        swipe(x, start, x, start - span, ms)
    else:
        start = int(h * 0.30)
        swipe(x, start, x, start + span, ms)


def open_deep_link(url):
    r = adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', url, '-p', PACKAGE, check=False)
    note('deep_link', url=url, rc=r.returncode, out=(r.stdout or '')[-160:])
    time.sleep(3)


def back():
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
    time.sleep(2.5)


def is_blank_sheet(root):
    """The failure of journey #5: the sheet's dim is drawn and the "Mapa" pill stands, but the sheet itself (count, cards) is not there."""
    return bool(nodes(root, rid_='discovery-sheet-dim')) and bool(nodes(root, desc='Mapa')) and not count_nodes(root) and not cards(root)


def back_to_list(need_cards=True, need_peek=False, timeout=90, wait_for=None):
    """Android Back from a pushed screen. The P6 Discovery screen is rebuilt from its saved view (placeholder, reads, list),
    so wait for the real list (and cards / Peek; a Peek covers the list, so it has no count line), then give the saved list offset time to be
    restored before measuring. `wait_for(root)` names one more thing that must be back (the card that was opened). Every return is recorded:
    whether the sheet was blank when first looked at, and how long it took."""
    back()
    started, blank = time.time(), {'seen': False}

    def ready(r, p):
        if need_peek:
            return bool(peek_task_title(r))
        if not count_nodes(r):
            blank['seen'] = blank['seen'] or is_blank_sheet(r)
            return False
        if need_cards and not cards(r):
            return False
        return wait_for(r) if wait_for else True
    poll(ready, timeout, what='Discovery list after Back')
    REPORT.setdefault('returns', []).append({'blank': blank['seen'], 's': round(time.time() - started, 1)})
    time.sleep(2.5)
    return dump()


def settled_card(title, timeout=60):
    """A returned list is judged once it has stopped moving: a restore of a deep offset lands in steps on the CI emulator (the native content lags React Native's
    layout), so the card is judged where it holds still for three looks in a row (about 4 s apart in all), else where it was last seen."""
    end, last, holds, seen, root = time.time() + timeout, None, 0, None, None
    while time.time() < end:
        root, _parent = dump()
        card = next((c for c in cards(root) if c['title'] == title), None)
        y = card['bounds'][1] if card else None
        holds = holds + 1 if (y is not None and last is not None and abs(y - last) <= 4) else 0
        if card is not None:
            seen = card
        last = y
        if holds >= 2:
            return root, card, True
        time.sleep(1.5)
    return root, seen, False


def mem_kb():
    out = adb('shell', 'dumpsys', 'meminfo', PACKAGE, check=False).stdout
    m = re.search(r'TOTAL PSS:\s+(\d+)', out) or re.search(r'^\s*TOTAL\s+(\d+)', out, re.M)
    return int(m.group(1)) if m else -1


def app_pid():
    out = adb('shell', 'pidof', PACKAGE, check=False).stdout.strip()
    return out.split()[0] if out else ''


def dismiss_permission_dialogs():
    """System permission prompts are declined (privacy-preserving default); the journey never grants a permission."""
    for _ in range(3):
        root, parent = dump()
        deny = [n for n in root.iter() if n.attrib.get('resource-id') in (
            'com.android.permissioncontroller:id/permission_deny_button',
            'com.android.permissioncontroller:id/permission_deny_and_dont_ask_again_button')]
        if not deny:
            return
        note('PERMISSION_DIALOG_DECLINED')
        tap_node(deny[0], parent)


# ------------------------------------------------------------------------------------------------ UI facts
def ui_inventory(root, limit=160):
    """Compact, bounded description of what is on screen: id / label / clickable / bounds."""
    rows = []
    for n in root.iter():
        if n.attrib.get('package') != PACKAGE:
            continue
        r, t, d = rid(n), n.attrib.get('text', ''), n.attrib.get('content-desc', '')
        if not (r or t or d):
            continue
        rows.append({'id': r, 'text': t[:90], 'desc': d[:120], 'click': n.attrib.get('clickable') == 'true',
                     'sel': n.attrib.get('selected') == 'true', 'bounds': n.attrib.get('bounds', '')})
        if len(rows) >= limit:
            break
    return rows


def snapshot(name):
    """PNG + XML (RU5 shot(), retried) and a compact JSON inventory next to them."""
    dump()          # lets the RU5 helper recover a launcher (Quickstep) ANR dialog before the capture, which would otherwise be fatal
    for attempt in range(3):
        try:
            shot(name)
            break
        except Exception as exc:                              # noqa: BLE001
            if getattr(exc, 'native_surface_fatal', False):
                raise
            if attempt == 2:
                note('SNAPSHOT_FAIL', name=name, error=str(exc)[:160])
            time.sleep(1.0)
    root, _ = dump()
    (ARTIFACT_DIR / f'{name}.inventory.json').write_text(json.dumps(ui_inventory(root), ensure_ascii=False, indent=1), encoding='utf-8')
    return root


def view_probe(name):
    """What the accessibility tree cannot show: the native view hierarchy lines that name a map or an annotation (bounded), so a map pin
    that exists but is not exposed to uiautomator is told apart from one that was never created."""
    try:
        out = adb('shell', 'dumpsys', 'activity', 'top', check=False).stdout or ''
    except Exception:                                         # noqa: BLE001
        return {'error': True}
    keep = [line.strip()[:220] for line in out.splitlines() if re.search(r'Annotation|MapView|maplibre|MLRN|Pill', line, re.I)]
    (ARTIFACT_DIR / f'{name}.views.txt').write_text('\n'.join(keep[:300]), encoding='utf-8')
    summary = {'lines': len(out.splitlines()), 'matched': len(keep), 'annotation': sum(1 for line in keep if re.search('Annotation', line, re.I))}
    REPORT.setdefault('viewProbe', {})[name] = summary
    return summary


def cards(root):
    out = []
    for n in root.iter():
        if n.attrib.get('package') != PACKAGE:
            continue
        m = ITEM_DESC.match(n.attrib.get('content-desc', '') or '')
        if not m:
            continue
        out.append({'title': m.group(1), 'index': int(m.group(2)), 'kind': m.group(3),
                    'bounds': parse_bounds(n.attrib.get('bounds')), 'node': n})
    return sorted(out, key=lambda c: c['bounds'][1])


# ------------------------------------------------------------------------------------------------ map markers (visual)
# The server buckets are drawn on the map's GL surface (a ring or a disc in the brand green #076E4E, with a count or the USKOCI mark), so
# a marker has no accessibility node and its count never reaches uiautomator. The base map draws only pale greens, so the marker is found
# on the screenshot by the brand green and tapped at the middle of what was found. (Bitmap view annotations were tried first and never
# drew on the emulator; see DiscoveryV1ServerMarkerLayer.)
def raw_screen():
    out = subprocess.run(['adb', 'exec-out', 'screencap'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=90).stdout
    w, h, _fmt = struct.unpack('<III', out[:12])
    extra = len(out) - w * h * 4
    offset = extra if extra in (12, 16) else 12          # Android 13+ adds a 4-byte colour-space word to the header
    return w, h, memoryview(out)[offset:offset + w * h * 4]


def map_band(root):
    """The rows of the map no chrome covers: under the quick-filter chips, above the list sheet and above an open card."""
    w, h = screen_size()
    top, bottom = int(h * 0.18), int(h * 0.76)
    chips = nodes(root, desc='Brzi filteri')
    if chips:
        top = parse_bounds(chips[0].attrib.get('bounds'))[3] + 6
    sheet = nodes(root, rid_='discovery-sheet-background')
    if sheet:
        bottom = parse_bounds(sheet[0].attrib.get('bounds'))[1] - 6
    card = nodes(root, prefix='Otvori zadatak: ') + nodes(root, prefix='Pogledaj zadatak ') + nodes(root, prefix='Zatvori pregled')
    if card:
        bottom = min(bottom, min(parse_bounds(n.attrib.get('bounds'))[1] for n in card) - 170)
    return top, max(top + 1, bottom)


def pills(root=None, step_px=3, cell=24, gap=2):
    """Map markers as [{x, y, w, h, samples, merged}] (x, y at the middle of the ring or disc), top to bottom."""
    root = root if root is not None else dump()[0]
    top, bottom = map_band(root)
    w, h, px = raw_screen()
    cells = {}
    for y in range(max(0, top), min(h, bottom), step_px):
        row = y * w * 4
        for x in range(0, w, step_px):
            i = row + x * 4
            if abs(px[i] - 7) <= 30 and abs(px[i + 1] - 110) <= 30 and abs(px[i + 2] - 78) <= 30:
                key = (x // cell, y // cell)
                cells[key] = cells.get(key, 0) + 1
    seen, found = set(), []
    for start in cells:
        if start in seen:
            continue
        stack, members = [start], []
        seen.add(start)
        while stack:
            cx, cy = stack.pop()
            members.append((cx, cy))
            for dx in range(-gap, gap + 1):
                for dy in range(-gap, gap + 1):
                    nb = (cx + dx, cy + dy)
                    if nb in cells and nb not in seen:
                        seen.add(nb)
                        stack.append(nb)
        samples = sum(cells[m] for m in members)
        if samples < 12:
            continue
        xs, ys = [m[0] for m in members], [m[1] for m in members]
        left, right, upper, lower = min(xs) * cell, max(xs) * cell + cell, min(ys) * cell, max(ys) * cell + cell
        found.append({'x': (left + right) // 2, 'y': (upper + lower) // 2, 'w': right - left, 'h': lower - upper, 'samples': samples,
                      'merged': (right - left) > 200 or (lower - upper) > 220})
    found.sort(key=lambda p: (p['y'], p['x']))
    return found


def pill_boxes(ps):
    return [[p['x'], p['y'], p['w'], p['h']] for p in ps][:16]


def pill_signature(ps):
    """Where the pills are, coarse enough that a redraw of the same map compares equal."""
    return sorted((round(p['x'] / 48), round(p['y'] / 48)) for p in ps)


def tap_pill(p):
    press_at(p['x'], p['y'], 140)


def count_nodes(root):
    return nodes(root, rid_='list-count') + nodes(root, rid_='list-count-words')


def count_value(root):
    """The number the list's top line SHOWS: its visible text ("60 zadataka"). The node's content-desc is the spoken sentence, which under a map area or on one
    point starts with a part of it ("30 zadataka na ovom mestu · 30 zadataka bez tačke na mapi"), so it is only the fallback."""
    for n in count_nodes(root):
        for child in n.iter():
            t = child.attrib.get('text', '')
            m = re.match(r'\s*(\d+)\s+zadat', t)
            if m:
                return int(m.group(1)), t
    for n in count_nodes(root):
        label = n.attrib.get('content-desc') or n.attrib.get('text') or ''
        m = re.match(r'\s*(\d+)', label)
        if m:
            return int(m.group(1)), label
        for child in n.iter():
            t = child.attrib.get('text', '')
            m = re.match(r'\s*(\d+)', t)
            if m:
                return int(m.group(1)), t
    return None, ''


def sheet_state(root):
    words = bool(nodes(root, rid_='list-count-words'))
    button = bool(nodes(root, rid_='list-count'))
    return {'full': words and not button, 'button': button, 'mapPill': bool(nodes(root, desc='Mapa'))}


def sheet_top(root):
    """Top edge of the list sheet on screen (its background is in the tree), or None while it is not there."""
    found = nodes(root, rid_='discovery-sheet-background')
    return parse_bounds(found[0].attrib.get('bounds'))[1] if found else None


def is_full(root):
    """The header says "full" AND the sheet really stands in the upper part of the screen (React alone can be ahead of the native sheet)."""
    top = sheet_top(root)
    return sheet_state(root)['full'] and top is not None and top < screen_size()[1] * 0.4


def peek_task_title(root):
    """The Peek's open control is labelled "Otvori zadatak: <title>, <facts...>": the task's title is the part before the first comma."""
    for n in nodes(root, prefix='Otvori zadatak: '):
        title = (n.attrib.get('content-desc') or '')[len('Otvori zadatak: '):].split(',')[0].strip()
        return title or None
    return None


def selected(node):
    return node is not None and (node.attrib.get('selected') == 'true' or node.attrib.get('checked') == 'true')


# ------------------------------------------------------------------------------------------------ server-side evidence
def _container(fragment):
    names = subprocess.run(['docker', 'ps', '--format', '{{.Names}}'], capture_output=True, text=True, timeout=20).stdout.split()
    return next((n for n in names if fragment in n), None)


def _db_container():
    return next((n for n in subprocess.run(['docker', 'ps', '--format', '{{.Names}}'], capture_output=True, text=True, timeout=20).stdout.split()
                 if n.startswith('supabase_db_')), None)


def _docker_logs(name, since=None, timestamps=False):
    cmd = ['docker', 'logs'] + (['--timestamps'] if timestamps else []) + (['--since', since] if since else []) + [name]
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors='replace', timeout=120).stdout or ''


def _bodies_from(text):
    decoder = json.JSONDecoder()
    out = []
    for line in text.splitlines():
        at = line.lower().find('parameters: $')      # PostgreSQL 15+ writes `Parameters:` with a capital P
        if at < 0:
            continue
        for marker in ("$1 = '", "$2 = '"):
            pos = line.find(marker, at)
            start = line.find('{', pos) if pos >= 0 else -1
            if start < 0:
                continue
            try:
                body, _ = decoder.raw_decode(line[start:].replace("''", "'"))
            except ValueError:
                continue
            req = body.get('p_request') if isinstance(body, dict) else None
            if isinstance(req, dict) and req.get('mode') in ('PAGE', 'MAP', 'PLACES', 'EXACT_PUBLIC'):
                out.append(req)
                break
    return out


HARVEST_SECONDS = []
_HARVEST = {'since': None, 'newest': None, 'lines': set(), 'bodies': []}
_DOCKER_STAMP = re.compile(r'^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?Z$')


def harvest():
    started = time.time()
    try:
        return _harvest_uncounted()
    finally:
        HARVEST_SECONDS.append(round(time.time() - started, 1))


def _harvest_uncounted():
    """Every rpc_discovery_v1 request (the parsed p_request body) the disposable database logged since the capture window opened.

    log_statement=all makes each bound PostgREST call appear in a `Parameters: $n = '...'` detail line. Only bodies with a P6
    mode are kept, in log order. The container log is read first; a database that logs to files is read from its log directory."""
    name = _db_container()
    if not name:
        return []
    # Incremental: only the lines since the previous read, so a read takes seconds on a runner whose statement log holds hundreds of thousands of lines (journey #9/#10: median 16 s,
    # up to 75 s per full read). Body-bearing lines are kept once, in log order; a line stamped in the same second as the last one read is met again through the one second of overlap
    # and recognised by its text.
    since = _HARVEST['since'] or START_ISO
    text = _docker_logs(name, since, timestamps=True)
    newest = _HARVEST['newest']
    for line in text.splitlines():
        stamp = line.split(' ', 1)[0]
        m = _DOCKER_STAMP.match(stamp)
        if m:
            key = (m.group(1), (m.group(2) or '').ljust(9, '0'))
            if newest is None or key > newest:
                newest = key
        if 'parameters: $' not in line.lower() or line in _HARVEST['lines']:
            continue
        bodies = _bodies_from(line)
        if bodies:
            _HARVEST['lines'].add(line)
            _HARVEST['bodies'].append(bodies[0])
    if newest is not None:
        _HARVEST['newest'] = newest
        second = datetime.datetime.strptime(newest[0], '%Y-%m-%dT%H:%M:%S') - datetime.timedelta(seconds=1)
        _HARVEST['since'] = second.strftime('%Y-%m-%dT%H:%M:%SZ')
    if _HARVEST['bodies']:
        return list(_HARVEST['bodies'])
    # the container log holds no bodies (yet): a database that logs to files is read from its log directory
    r = subprocess.run(['docker', 'exec', name, 'sh', '-c', 'cat /var/log/postgresql/* 2>/dev/null | tail -n 200000'],
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors='replace', timeout=120)
    return _bodies_from(r.stdout or '')


def log_samples(limit=8):
    """Bounded raw evidence of what the statement log really looks like (for diagnosing a capture that finds nothing)."""
    name = _db_container()
    if not name:
        return {'container': None}
    text = _docker_logs(name, START_ISO)
    lines = text.splitlines()
    hits = [l[:360] for l in lines if 'rpc_discovery_v1' in l][:limit]
    params = [l[:360] for l in lines if 'parameters:' in l.lower()][:limit]
    return {'container': name, 'lines': len(lines), 'rpcLines': hits, 'parameterLines': params}


def gateway_counts():
    """Gateway access-log lines per RPC name (no bodies there): which reader the app really called, and with which status."""
    name = _container('kong')
    if not name:
        return {}
    counts = {}
    for m in re.finditer(r'"POST /rest/v1/rpc/([a-z0-9_]+)[^"]*" (\d{3})', _docker_logs(name, START_ISO)):
        key = f'{m.group(1)}:{m.group(2)}'
        counts[key] = counts.get(key, 0) + 1
    return counts


def function_counts():
    try:
        rows = _admin_psql("select funcname||'='||calls from pg_stat_user_functions where funcname in ('rpc_discovery_v1','rpc_list_open_tasks_v3') order by 1")
        return {k: int(v) for k, v in (r.split('=') for r in rows.splitlines() if '=' in r)}
    except Exception:                                         # noqa: BLE001
        return {}


def reader_calls():
    """Calls of each reader so far, from the largest of the gateway and database counters (either may be unavailable)."""
    gw, st = gateway_counts(), function_counts()
    out = {}
    for name in ('rpc_discovery_v1', 'rpc_list_open_tasks_v3'):
        via_gateway = sum(v for k, v in gw.items() if k.startswith(name + ':'))
        out[name] = max(via_gateway, st.get(name, 0))
    return out


def mark():
    return len(harvest())


def since(m, mode=None):
    return [r for r in harvest()[m:] if mode is None or r.get('mode') == mode]


def brief(req):
    f = req.get('filter') or {}
    scope = req.get('scope')
    return {'mode': req.get('mode'), 'scope': scope.get('kind') if isinstance(scope, dict) else scope,
            'after': bool(req.get('after')), 'limit': req.get('limit'), 'where': f.get('where'), 'text': f.get('text'),
            'place': f.get('place'), 'keys': sorted(req.keys())[:14]}


def wait_requests(fn, timeout=30, what='requests'):
    end = time.time() + timeout
    while time.time() < end:
        v = fn()
        if v:
            return v
        time.sleep(1.0)
    raise RuntimeError(f'timeout ({timeout}s) waiting for {what}')


def _admin_psql(sql):
    """The local stack's `postgres` role is not a superuser; supabase_admin is (same password on the disposable stack)."""
    url = DB_URL.replace('//postgres:', '//supabase_admin:', 1)
    r = subprocess.run(['psql', url, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:200])
    return r.stdout.strip()


def db_function_calls():
    try:
        return int(_admin_psql("select coalesce(sum(calls),0)::bigint from pg_stat_user_functions where funcname='rpc_discovery_v1'") or 0)
    except Exception:                                         # noqa: BLE001
        return -1


# ------------------------------------------------------------------------------------------------ step machinery
def step(name, fn):
    started = time.time()
    checks_before = len(REPORT['checks'])
    try:
        fn()
        ok = all(c['ok'] for c in REPORT['checks'][checks_before:])
        REPORT['steps'].append({'name': name, 'ok': True, 'checksOk': ok, 's': round(time.time() - started, 1)})
        note('STEP_OK', name=name, checksOk=ok)
    except Exception as exc:                                 # noqa: BLE001 - recorded in both modes
        if getattr(exc, 'native_surface_fatal', False):
            REPORT['steps'].append({'name': name, 'ok': False, 'fatal': True, 'error': str(exc)[:600]})
            raise
        REPORT['steps'].append({'name': name, 'ok': False, 'error': f'{type(exc).__name__}: {str(exc)[:600]}'})
        note('STEP_FAIL', name=name, error=f'{type(exc).__name__}: {str(exc)[:300]}')
        try:
            snapshot(f'FAIL_{name}')
        except Exception:                                    # noqa: BLE001
            pass


def check(name, ok, **facts):
    REPORT['checks'].append({'name': name, 'ok': bool(ok), **facts})
    note('CHECK_PASS' if ok else 'CHECK_FAIL', name=name, **facts)
    return bool(ok)


def ensure_list():
    """Bring the app back to the P6 Discovery screen whatever the previous step left behind (never signs in again)."""
    for _ in range(4):
        root, _p = dump()
        if count_nodes(root):
            return root
        back()
    open_deep_link(LIST_URL)
    _, root, _p = poll(lambda r, p: count_nodes(r), 45, what='Discovery list after recovery')
    return root


def ensure_full():
    root = ensure_list()
    if is_full(root):
        return root
    root, parent = dump()
    target = nodes(root, rid_='list-count')
    if not target:
        raise RuntimeError('list-count control not found')
    tap_visible(target[0], parent)
    _, root, _p = poll(lambda r, p: is_full(r), 25, what='list at full height (the sheet standing at the top of the screen)')
    return root


def ensure_peek():
    root = ensure_list()
    st = sheet_state(root)
    if st['mapPill']:
        root, parent = dump()
        tap_visible(nodes(root, desc='Mapa')[0], parent)
        _, root, _p = poll(lambda r, p: not sheet_state(r)['mapPill'] and sheet_state(r)['button'], 20, what='list lowered to its top line')
    return root


def ensure_chips():
    """The quick chips fold away once a full list is scrolled well past them and return at its top."""
    for _ in range(14):
        root, parent = dump()
        if nodes(root, desc='Na daljinu'):
            return root
        scroll_list('up', 0.6)
    raise RuntimeError('quick chips did not come back at the list top')


# ------------------------------------------------------------------------------------------------ steps
def press_entry_pill():
    """Open the login sheet with a real press on the visible part of "Prijavi se"."""
    last = None
    for attempt in range(1, 5):
        found, root, parent = poll(lambda r, p: nodes(r, desc='Prijavi se'), 60 if attempt == 1 else 20, what='"Prijavi se" entry control')
        tap_visible(found[0], parent, hold_ms=160)
        try:
            wait_nodes(timeout=10, minimum=2, save_timeout=False, clazz='android.widget.EditText')
            note('CHECKPOINT', name='AUTH_SHEET_OPEN', attempt=attempt)
            return
        except RuntimeError as exc:
            if getattr(exc, 'native_surface_fatal', False):
                raise
            last = exc
            dump_tree(f'AUTH_entry_attempt_{attempt}_after')
            time.sleep(1.5)
    raise RuntimeError(f'Login sheet did not open after real UI presses: {str(last)[:200]}')


def s_login():
    launch_clean()                   # force-stop, clear the disposable app data, start, wait for "Prijavi se", signed-out asserts
    time.sleep(2)
    dump()
    press_entry_pill()
    root, parent = dump()
    fields = sorted(nodes(root, clazz='android.widget.EditText'), key=lambda n: parse_bounds(n.attrib.get('bounds'))[1])
    if len(fields) != 2 or not nodes(root, text='Email') or not nodes(root, text='Lozinka'):
        raise RuntimeError(f'sign-in sheet is not the expected email/password form: fields={len(fields)}')
    snapshot('P6_00_login_sheet')
    edit_text(0, VIEWER_EMAIL)
    edit_text(1, PASSWORD)
    hide_keyboard()
    # The sheet's submit is the TOPMOST "Prijavi se" (the entry's own pill stays in the tree behind the sheet).
    found, root, parent = poll(lambda r, p: sorted([n for n in nodes(r, desc='Prijavi se') if n.attrib.get('clickable') == 'true'],
                                                   key=lambda n: parse_bounds(n.attrib.get('bounds'))[1]), 30, what='sign-in submit')
    tap_visible(found[0], parent)
    poll(lambda r, p: not nodes(r, rid_='entry-intents') and not nodes(r, rid_='auth-reference-sheet'), 90, what='signed-in surface (entry gone)')
    time.sleep(3)
    dismiss_permission_dialogs()
    snapshot('P6_01_after_login')


def s_ordinary_route():
    """proof APK: the ordinary Zadaci tab must stay on the legacy reader (no rpc_discovery_v1 call may come from it).
    production APK: the same tab IS the P6 reader and must call it with no route parameter at all."""
    before = reader_calls()
    m = mark()
    root, parent = dump()
    tabs = sorted(nodes(root, desc='Zadaci'), key=lambda n: parse_bounds(n.attrib.get('bounds'))[1])
    if tabs:
        tap_visible(tabs[-1], parent)
    else:
        note('TAB_BAR_LABEL_NOT_FOUND', inventory=[i['desc'] or i['text'] for i in ui_inventory(root) if i['click']][:14])
        open_deep_link('uskociapp://zadaci')
    if ROUTE == 'production':
        wait_requests(lambda: reader_calls()['rpc_discovery_v1'] > before['rpc_discovery_v1'], 60, 'the P6 reader called by the ordinary Zadaci tab')
    poll(lambda r, p: count_nodes(r) or nodes(r, contains='Nema zadataka') or nodes(r, contains='nisu učitani'), 60, what='ordinary Zadaci screen')
    time.sleep(4)
    root = snapshot('P6_01b_ordinary_route')
    after = reader_calls()
    p6 = after['rpc_discovery_v1'] - before['rpc_discovery_v1']
    legacy = after['rpc_list_open_tasks_v3'] - before['rpc_list_open_tasks_v3']
    REPORT['routeMark'] = m
    REPORT['routeReaderBefore'] = before
    REPORT['ordinaryRoute'] = {'p6Calls': p6, 'legacyCalls': legacy, 'count': count_value(root)[0], 'gateway': gateway_counts()}
    if ROUTE == 'proof':
        check('ORDINARY_ROUTE_DOES_NOT_CALL_P6_READER', p6 == 0, p6Calls=p6, legacyCalls=legacy, count=count_value(root)[0])
    else:
        check('PRODUCTION_ROUTE_CALLS_P6_READER_WITHOUT_ANY_PARAMETER', p6 >= 1, p6Calls=p6, legacyCalls=legacy, count=count_value(root)[0])


def s_route():
    before = REPORT.get('routeReaderBefore') or reader_calls()
    m = REPORT.get('routeMark', 0) if ROUTE == 'production' else mark()
    if ROUTE == 'proof':
        before = reader_calls()
        open_deep_link(LIST_URL)
    wait_requests(lambda: reader_calls()['rpc_discovery_v1'] > before['rpc_discovery_v1'], 45, 'the P6 reader called by the route')
    _, root, _p = poll(lambda r, p: count_value(r)[0] == TOTAL, 45, what=f'count {TOTAL} from the P6 reader')
    time.sleep(3)
    root = snapshot('P6_02_route_initial')
    view_probe('P6_02_route_initial')
    value, label = count_value(root)
    calls = since(m)
    REPORT['initialCount'] = [value, label]
    REPORT['initialRequests'] = [brief(c) for c in calls[:8]]
    check('P6_READER_CALLED_BY_ROUTE', reader_calls()['rpc_discovery_v1'] > before['rpc_discovery_v1'], before=before, after=reader_calls())
    check('P6_PAGE_BODY_CAPTURED', any(c.get('mode') == 'PAGE' and not c.get('after') for c in calls), captured=len(calls))
    check('COUNT_MATCHES_SERVER_TOTAL', value == TOTAL, ui=value, expected=TOTAL, spoken=label)
    without = FIXTURE.get('pageProbeCounts', {}).get('withoutPoint')
    if without is not None:
        nums = [int(x) for x in re.findall(r'(\d+)', label)]
        # At ALL scope the server reports no point-free section, so the spoken count has no "bez tačke na mapi" part.
        check('WITHOUT_POINT_COUNT_MATCHES_SERVER', (without in nums[1:]) if without else len(nums) == 1, ui=nums, expected=without)
    st = sheet_state(root)
    REPORT['initialSheet'] = st
    ps = pills(root) if not st['full'] else []
    REPORT['initialPills'] = pill_boxes(ps)
    check('MAP_MARKERS_VISIBLE_AT_PEEK', bool(ps) or st['full'], pills=len(ps), boxes=pill_boxes(ps), sheet=st)
    if not st['full']:
        check('P6_MAP_READER_CALLED', any(c.get('mode') == 'MAP' for c in calls), modes=sorted({c.get('mode') for c in calls}))
    check('MAP_LAYER_SHOWS_A_MAP', bool(nodes(root, desc='Umanji mapu')) or bool(nodes(root, contains='Izvori mape')) or st['full'],
          zoom=bool(nodes(root, desc='Umanji mapu')), credits=bool(nodes(root, contains='Izvori mape')))


def s_open_full():
    root = ensure_full()
    root = snapshot('P6_03_full_list')
    cs = cards(root)
    check('FULL_LIST_SHOWS_CARDS', len(cs) >= 3, visible=len(cs), first=[c['title'] for c in cs[:3]])
    check('FULL_STARTS_WITH_NEWEST_TASKS', bool(cs) and cs[0]['index'] <= 3, first=[c['title'] for c in cs[:3]])
    check('FULL_KEEPS_EXACT_COUNT', count_value(root)[0] == TOTAL, ui=count_value(root)[0], expected=TOTAL)
    check('MAP_PILL_OFFERED_AT_FULL', sheet_state(root)['mapPill'])


def s_paging():
    ensure_full()
    m = mark()
    calls_before = reader_calls()['rpc_discovery_v1']
    seen, order, idle, dupes, swipes, indexes, strays = set(), [], 0, [], 0, set(), []
    for swipes in range(1, 131):
        root, _p = dump()
        if not count_nodes(root) and not cards(root) and (nodes(root, contains='Mesto zadatka') or nodes(root, contains='Pošalji ponudu') or nodes(root, contains='Pošalji prijavu')):
            # Journey #10: a slow swipe on the stalled CI emulator arrived as a press and opened the task under the finger; the loop then swiped on that detail for ten minutes.
            # The list's top line stands in every list state and in no detail, so a task's own labels without it name the stray open: come back, go on, and report each one.
            strays.append(swipes)
            note('PAGING_STRAY_OPEN', swipe=swipes)
            ensure_list()
            time.sleep(3.0)                                     # the returned list restores its saved offset
            root, _p = dump()
            idle = 0
        cs = cards(root)
        titles = [c['title'] for c in cs]
        indexes.update(c['index'] for c in cs)
        if len(titles) != len(set(titles)):
            dupes.append(titles)
        fresh = [t for t in titles if t not in seen]
        for t in fresh:
            seen.add(t)
            order.append(t)
        idle = 0 if fresh else idle + 1
        if TOTAL in indexes:
            break
        if idle >= 6:
            # A next page that was asked for (a cursor request reached the server) but is not drawn yet is waited for: on the CI emulator
            # the UI thread can stall for many seconds while Reanimated retries the views the list has just dropped. One that has not been seen asked for
            # yet is waited for too (the statement log is read by the driver, the request is made by the app: at the end of the list they meet within seconds of
            # each other): the end of the list is believed only after 12 idle swipes (about a minute) without a cursor request.
            asked = any(r.get('after') for r in since(m, 'PAGE'))
            if idle >= 40 or (not asked and idle >= 12):
                break
        if idle:
            time.sleep(2.0)                      # the next page may still be on its way
        scroll_list('down', 0.45, ms=800, x_fraction=0.975)   # shorter than the viewport, slow enough that no card is flung past unseen; starts in the gutter right of the cards
    reqs = since(m, 'PAGE')
    cursor = [r for r in reqs if r.get('after')]
    limit = next((r.get('limit') for r in reqs if r.get('limit')), None)          # the app's own page size (the fixture's probes use another one)
    pages = math.ceil(TOTAL / limit) if limit else None
    root, _p = dump()
    calls_after = reader_calls()['rpc_discovery_v1']
    REPORT['paging'] = {'seen': len(seen), 'swipes': swipes, 'strayOpens': strays, 'limit': limit, 'cursorRequests': len(cursor), 'maxIndex': max(indexes) if indexes else None,
                        'readerCalls': calls_after - calls_before, 'requests': [brief(r) for r in reqs[:10]], 'order': order[:6] + ['...'] + order[-4:]}
    check('PAGING_REACHED_THE_LAST_TASK', TOTAL in indexes, maxIndex=max(indexes) if indexes else None, expected=TOTAL)
    check('PAGING_SAW_ALMOST_EVERY_TASK', len(seen) >= TOTAL - 3, seen=len(seen), expected=TOTAL)
    check('NO_DUPLICATE_CARDS_IN_ANY_VIEW', not dupes, duplicates=dupes[:2])
    check('PAGING_CALLED_THE_READER_AGAIN', calls_after - calls_before >= 1, calls=calls_after - calls_before)
    check('NEXT_PAGE_REQUESTED_WITH_CURSOR', bool(cursor) if pages and pages > 1 else True, pages=pages, cursorRequests=len(cursor))
    if pages:
        check('NO_RUNAWAY_PAGE_REQUESTS', len(cursor) <= max(pages, 1) * 2 + len(strays), cursorRequests=len(cursor), pages=pages, strayOpens=len(strays))
    check('LIST_OPENED_NO_TASK_BY_ITSELF_WHILE_PAGING', len(strays) <= 3, strayOpens=strays)
    check('COUNT_STABLE_AFTER_PAGING', count_value(root)[0] == TOTAL, ui=count_value(root)[0], expected=TOTAL)
    snapshot('P6_04_paged_to_end')


def s_detail_and_back():
    ensure_full()
    root, parent = dump()
    cs = cards(root)
    if not cs:
        raise RuntimeError('no card to open')
    pick = cs[min(1, len(cs) - 1)]
    m = mark()
    REPORT['opened'] = {'title': pick['title'], 'y1': pick['bounds'][1]}
    tap_visible(pick['node'], parent)
    _, root, _p = poll(lambda r, p: not count_nodes(r) and any(pick['title'] in label_of(n) for n in r.iter() if n.attrib.get('package') == PACKAGE), 30, what='task detail')
    snapshot('P6_05_detail')
    check('DETAIL_SHOWS_TITLE', True, title=pick['title'])
    back_to_list(wait_for=lambda r: any(c['title'] == pick['title'] for c in cards(r)))
    _r, _c, held = settled_card(pick['title'])
    root = snapshot('P6_06_after_back')
    cs = cards(root)
    same = next((c for c in cs if c['title'] == pick['title']), None)
    check('BACK_RESTORES_SAME_TASK_VISIBLE', same is not None, wanted=pick['title'], visible=[c['title'] for c in cs[:6]], settled=held)
    if same is not None:
        drift = abs(same['bounds'][1] - REPORT['opened']['y1'])
        check('BACK_RESTORES_SCROLL_POSITION', drift <= 60, before_y=REPORT['opened']['y1'], after_y=same['bounds'][1], drift=drift, settled=held)
    check('BACK_KEEPS_FULL_LIST', is_full(root), sheet=sheet_state(root), top=sheet_top(root))
    check('BACK_KEEPS_EXACT_COUNT', count_value(root)[0] == TOTAL, ui=count_value(root)[0])
    REPORT['backRequests'] = [brief(r) for r in since(m)[:6]]


def s_repeat_cycles(n=20):
    ensure_full()
    REPORT['mem'] = [{'tag': 'before_cycles', 'kb': mem_kb(), 'pid': app_pid()}]
    REPORT['cycleTimings'] = []
    m = mark()
    calls_before = db_function_calls()
    for i in range(1, n + 1):
        root, parent = dump()
        cs = cards(root)
        if not cs:
            raise RuntimeError('list empty before cycle')
        pick = cs[min(1, len(cs) - 1)]
        tapped = time.time()
        tap_visible(pick['node'], parent)
        # Tap -> the task's own screen (its title with no list count line), seen through a dump every half second or so.
        try:
            poll(lambda r, p: not count_nodes(r) and any(pick['title'] in label_of(n) for n in r.iter() if n.attrib.get('package') == PACKAGE),
                 45, interval=0.5, what='task detail')
            to_detail = round(time.time() - tapped, 1)
        except RuntimeError:
            to_detail = None
        time.sleep(1.0)
        # The list is judged once the opened card is back and holds still: the CI emulator draws a rebuilt 100-row list seconds late; a return whose card
        # never comes back is a failed cycle with what the list did show, not the end of the run.
        back_started = time.time()
        try:
            root, _p = back_to_list(wait_for=lambda r: any(c['title'] == pick['title'] for c in cards(r)))
        except RuntimeError as exc:
            root, _p = dump()
            REPORT['cycleTimings'].append({'cycle': i, 'tapToDetailS': to_detail, 'backToListS': None})
            check(f'CYCLE_{i:02d}_LIST_RESTORED', False, title=pick['title'], error=str(exc)[:140], visible=[c['title'] for c in cards(root)[:4]],
                  sheet=sheet_state(root))
            continue
        back_to_list_s = round(time.time() - back_started, 1)
        _r, again, held = settled_card(pick['title'])
        root, _p = dump()
        REPORT['cycleTimings'].append({'cycle': i, 'tapToDetailS': to_detail, 'backToListS': back_to_list_s})
        drift = abs(again['bounds'][1] - pick['bounds'][1]) if again else None
        check(f'CYCLE_{i:02d}_LIST_RESTORED', again is not None and is_full(root), title=pick['title'], drift=drift, settled=held)
        if i in (1, 5, n // 2, 15, n):
            REPORT['mem'].append({'tag': f'cycle_{i}', 'kb': mem_kb(), 'pid': app_pid()})
    snapshot('P6_07_after_cycles')
    times = REPORT['cycleTimings']
    got = sorted(t['tapToDetailS'] for t in times if t['tapToDetailS'] is not None)
    back = sorted(t['backToListS'] for t in times if t['backToListS'] is not None)
    REPORT['cycleTimingSummary'] = {'tapToDetailS': {'n': len(got), 'median': got[len(got) // 2] if got else None, 'max': got[-1] if got else None},
                                    'backToListS': {'n': len(back), 'median': back[len(back) // 2] if back else None, 'max': back[-1] if back else None},
                                    'note': 'CI emulator (software rendering, ~10x slower than a phone): a bound on hangs, not a phone measurement'}
    check('TAP_AND_BACK_TIMES_MEASURED_AND_BOUNDED', len(got) == n and len(back) == n and got[-1] < 30 and back[-1] < 60, **REPORT['cycleTimingSummary'])
    reqs = since(m)
    REPORT['cycleRequests'] = len(reqs)
    calls_after = db_function_calls()
    # A return rebuilds the screen: the first page, the map over the saved camera and every further page the list had read (two here).
    check('NO_RUNAWAY_READER_CALLS', len(reqs) <= n * 5, requests=len(reqs), cycles=n,
          dbCallsDelta=(calls_after - calls_before) if calls_before >= 0 and calls_after >= 0 else None)
    pids = {x['pid'] for x in REPORT['mem'] if x['pid']}
    check('APP_PROCESS_SURVIVED_CYCLES', len(pids) == 1, pids=sorted(pids))
    kb = [x['kb'] for x in REPORT['mem'] if x['kb'] > 0]
    if len(kb) >= 2:
        check('NO_OBVIOUS_MEMORY_GROWTH', kb[-1] <= kb[0] * 1.35 + 20000, first_kb=kb[0], last_kb=kb[-1])


def wait_count(expected, timeout=25):
    if expected is None:
        raise RuntimeError('expected count missing from fixture.json')
    return poll(lambda r, p: count_value(r)[0] == expected, timeout, what=f'count {expected}')


def chip(root, label):
    return next(iter(nodes(root, desc=label)), None)


def s_filters():
    ensure_peek()
    ensure_chips()
    root, parent = dump()
    remote, onsite = chip(root, 'Na daljinu'), chip(root, 'Na licu mesta')
    if remote is None or onsite is None:
        raise RuntimeError(f'quick filter chips not visible: clickable={[n["desc"] for n in ui_inventory(root) if n["click"]][:12]}')
    exp_remote, exp_onsite = EXPECTED.get('remote'), EXPECTED.get('onsite')
    m = mark()
    note('FILTER_TAP', at=list(center_of(remote, parent)), chip=remote.attrib.get('bounds'), sheet=sheet_state(root))
    began = time.time()
    tap_visible(remote, parent)
    try:
        _, root, parent = wait_count(exp_remote, 90)         # a slow answer on the CI emulator is recorded with its latency; an answer that never comes still fails
    except RuntimeError:
        REPORT['filtersFailure'] = {'afterTapS': round(time.time() - began, 1), 'requestsSinceTap': [brief(r) for r in since(m)[:8]], 'trace': app_trace_tail(60)}
        snapshot('FAIL_filters_detail')
        raise
    REPORT['filterRemoteAnswerS'] = round(time.time() - began, 1)
    reqs = since(m, 'PAGE')
    check('FILTER_REMOTE_COUNT_EQUALS_SERVER', count_value(root)[0] == exp_remote, ui=count_value(root)[0], expected=exp_remote)
    check('FILTER_REMOTE_SENT_TO_SERVER', any((r.get('filter') or {}).get('where') == 'remote' for r in reqs), requests=[brief(r) for r in reqs[:4]])
    snapshot('P6_10_filter_remote')
    root, parent = dump()
    tap_visible(chip(root, 'Na daljinu'), parent)
    _, root, parent = wait_count(TOTAL)
    check('FILTER_CLEARS_TO_ALL', count_value(root)[0] == TOTAL, ui=count_value(root)[0])
    # Stale fencing: two intents in quick succession. The screen must end on the LAST one, whatever order the answers
    # arrive in (the deterministic staleness injection is covered by the coordinator's own tests; this is the race probe).
    p1, p2 = center_of(chip(root, 'Na daljinu'), parent), center_of(chip(root, 'Na licu mesta'), parent)
    m2 = mark()
    adb('shell', f'input tap {p1[0]} {p1[1]} ; input tap {p2[0]} {p2[1]}')
    time.sleep(1.0)
    _, root, parent = wait_count(exp_onsite, 30)
    time.sleep(3)
    root, parent = dump()
    reqs = since(m2, 'PAGE')
    wheres = [(r.get('filter') or {}).get('where') for r in reqs]
    check('RACE_ENDS_ON_LAST_INTENT', count_value(root)[0] == exp_onsite, ui=count_value(root)[0], expected=exp_onsite, wheres=wheres)
    check('RACE_LAST_REQUEST_IS_LAST_INTENT', bool(wheres) and wheres[-1] == 'onsite', wheres=wheres)
    onsite_now, remote_now = chip(root, 'Na licu mesta'), chip(root, 'Na daljinu')
    check('RACE_SELECTED_CHIP_IS_LAST_INTENT', selected(onsite_now) and not selected(remote_now),
          onsite=selected(onsite_now), remote=selected(remote_now))
    snapshot('P6_11_filter_race')
    tap_visible(onsite_now, parent)
    _, root, _p = wait_count(TOTAL)
    check('FILTERS_CLEARED_AFTER_RACE', count_value(root)[0] == TOTAL, ui=count_value(root)[0])


def relaunch():
    """A cold start of the app process (the sign-in survives): the route rebuilds from nothing, exactly as a first visit."""
    adb('shell', 'am', 'force-stop', PACKAGE, check=False)
    time.sleep(2)
    open_deep_link(LIST_URL)
    _, root, _p = poll(lambda r, p: count_value(r)[0] == TOTAL, 90, what='the list after a cold start')
    time.sleep(6)
    return root


def classify_after_tap():
    root, parent = dump()
    title = peek_task_title(root)
    place = bool(nodes(root, contains='Prikaži sve u listi'))
    return root, parent, ('TASK' if title else 'PLACE' if place else 'NONE'), title


def close_card():
    root, parent = dump()
    close = nodes(root, desc='Zatvori pregled zadatka') or nodes(root, prefix='Zatvori pregled')
    if close:
        tap_visible(close[0], parent)
    else:
        back()
    time.sleep(2)


PIN_TRACE = re.compile(r'\[USKOCI_P6_TRACE\] \["pin","(\d+)/(\d+)"\]')


def app_trace_tail(limit=80):
    """The app's own DEV trace lines (Discovery / P6) from the device log's ring buffer, newest last: bounded evidence at the moment of a failure (JS console only, so the native warning flood cannot fill it)."""
    try:
        out = subprocess.run(['adb', 'logcat', '-d', '-t', '6000', '-s', 'ReactNativeJS:I'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                             text=True, errors='replace', timeout=60).stdout
    except Exception:                                         # noqa: BLE001
        return []
    return [line[:170] for line in out.splitlines() if 'USKOCI_' in line][-limit:]


def pin_trace_since(size):
    """The `pin` timings the app traced (DEV package) after the device log had `size` bytes: [(ms to the halo, ms to the card data), ...]."""
    try:
        with open(ARTIFACT_DIR / 'logcat.txt', 'rb') as fh:
            fh.seek(size)
            text = fh.read().decode('utf-8', 'replace')
    except OSError:
        return []
    return [(int(a), int(b)) for a, b in PIN_TRACE.findall(text)]


def percentile(values, q):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(q * len(ordered)) - 1)] if ordered else None


def close_card_if_open():
    """Closes the Peek when there is one (never sends Back: with no card that would leave the screen)."""
    root, parent = dump()
    close = nodes(root, desc='Zatvori pregled zadatka') or nodes(root, prefix='Zatvori pregled')
    if not close:
        return False
    tap_visible(close[0], parent)
    time.sleep(1.5)
    return True


def time_pin_taps(p, n=30):
    """P6-10: tap -> first feedback -> usable content, n repetitions on one task bucket. The app traces (DEV package) the milliseconds from the touch to the bucket's halo and to
    the card's data; the Peek is closed and the same bucket touched again. For the first three the Peek's geometry is compared before and after it has stood for a moment (a second
    jump would show as a moved card). CI emulator conditions are declared with the numbers: software rendering, about ten times slower than a phone."""
    log = ARTIFACT_DIR / 'logcat.txt'
    size = log.stat().st_size if log.exists() else 0
    close_card_if_open()
    shown, jumps, redetected = 0, [], 0
    for i in range(n):
        tap_pill(p)
        try:
            _v, root, _parent = poll(lambda r, q: peek_task_title(r), 30, interval=0.4, what='the Peek after a repeated pin touch')
        except RuntimeError:
            close_card_if_open()
            # The camera may have moved with an earlier touch: find the bucket again, nearest to where it was.
            again, _pp = dump()
            found = pills(again)
            if found:
                p = min(found, key=lambda q: (q['x'] - p['x']) ** 2 + (q['y'] - p['y']) ** 2)
                redetected += 1
            continue
        shown += 1
        if i < 3:
            first = [parse_bounds(x.attrib.get('bounds')) for x in nodes(root, prefix='Otvori zadatak: ')][:1]
            time.sleep(1.5)
            later, _pp = dump()
            second = [parse_bounds(x.attrib.get('bounds')) for x in nodes(later, prefix='Otvori zadatak: ')][:1]
            jumps.append(max(abs(a - b) for a, b in zip(first[0], second[0])) if first and second else None)
        close_card_if_open()
    time.sleep(3)
    timings = pin_trace_since(size)
    feedback, content = [a for a, _b in timings], [b for _a, b in timings]
    summary = {'touches': n, 'peekShown': shown, 'traced': len(timings), 'bucketFoundAgain': redetected,
               'firstFeedbackMs': {'p50': percentile(feedback, 0.5), 'p95': percentile(feedback, 0.95), 'max': max(feedback, default=None)},
               'usableContentMs': {'p50': percentile(content, 0.5), 'p95': percentile(content, 0.95), 'max': max(content, default=None)},
               'peekMovedPxAfterAppearing': jumps,
               'conditions': 'CI x86_64 emulator, software rendering (about 10x slower than a phone), disposable local server; JS-side clock: touch handled -> halo committed -> card data committed'}
    REPORT['pinTiming'] = summary
    check('PIN_TIMING_MEASURED', len(timings) >= max(3, int(n * 0.9)) and shown >= max(3, int(n * 0.9)), **summary)
    # Hang detectors for the CI emulator, not the phone budgets of the plan (those are read on the local emulator against DEV).
    check('PIN_FIRST_FEEDBACK_BOUNDED', bool(feedback) and percentile(feedback, 0.95) <= 3000, p95=percentile(feedback, 0.95), max=max(feedback, default=None))
    check('PIN_USABLE_CONTENT_BOUNDED', bool(content) and percentile(content, 0.95) <= 8000, p95=percentile(content, 0.95), max=max(content, default=None))
    measured = [j for j in jumps if j is not None]
    check('PEEK_DOES_NOT_MOVE_AFTER_IT_APPEARS', len(measured) >= 2 and max(measured) <= 4, movedPx=jumps)
    # The flow that follows expects the Peek open, as it was before the timing.
    tap_pill(p)
    poll(lambda r, q: peek_task_title(r), 30, interval=0.5, what='the Peek re-opened after the timing')


def verify_task_peek(root, parent, title, m):
    reqs = since(m)
    check('TASK_MARKER_OPENS_PEEK', bool(title) and any(r.get('mode') == 'EXACT_PUBLIC' for r in reqs), title=title,
          modes=sorted({r.get('mode') for r in reqs}))
    REPORT['taskMarkerRequests'] = [brief(r) for r in reqs[:6]]
    snapshot('P6_15_task_peek')
    before = pill_signature(pills(root))
    tap_visible(nodes(root, prefix='Otvori zadatak: ')[0], parent)
    poll(lambda r, p: not count_nodes(r) and any((title or '@@') in label_of(n) for n in r.iter() if n.attrib.get('package') == PACKAGE), 30,
         what='task detail from Peek')
    snapshot('P6_16_detail_from_peek')
    back_to_list(need_cards=False, need_peek=True)
    root = snapshot('P6_17_after_back_peek')
    check('BACK_RESTORES_PEEK_SAME_TASK', peek_task_title(root) == title, wanted=title, got=peek_task_title(root))
    now = pill_signature(pills(root))
    same = len(now) == len(before) and all(abs(a[0] - b[0]) <= 1 and abs(a[1] - b[1]) <= 1 for a, b in zip(now, before))
    check('BACK_RESTORES_MAP_VIEWPORT_AND_PINS', same, before=len(before), after=len(now))


def verify_place_peek(root, parent, m):
    dense_expected = EXPECTED.get('dense', 30)
    rows = nodes(root, prefix='Pogledaj zadatak ')
    reqs = since(m)
    check('PLACE_PEEK_SHOWS_ROWS', len(rows) >= 1, rows=len(rows))
    check('PLACE_TAP_READS_POINT_MEMBERS', any(r.get('mode') == 'PAGE' and brief(r)['scope'] == 'POINT_MEMBERS' for r in reqs),
          requests=[brief(r) for r in reqs[:6]])
    snapshot('P6_12_place_peek')
    m2 = mark()
    point_list_expected = EXPECTED.get('pointList', dense_expected + 30)
    tap_visible(nodes(root, contains='Prikaži sve u listi')[0], parent)
    _, root, parent = wait_count(point_list_expected, 40)
    check('POINT_MEMBERS_LIST_COUNT_MATCHES_SERVER', count_value(root)[0] == point_list_expected, ui=count_value(root)[0], expected=point_list_expected,
          note="the point list: the point's tasks first, then every task without a public point")
    check('POINT_SCOPE_SENT_TO_SERVER', any(brief(r)['scope'] == 'POINT_LIST' for r in since(m2, 'PAGE')),
          requests=[brief(r) for r in since(m2)[:5]])
    snapshot('P6_13_point_members')
    clear = nodes(root, desc='Prikaži sve zadatke') or nodes(root, rid_='clear-where')
    if not clear:
        raise RuntimeError('clear-where control not visible')
    tap_visible(clear[0], parent)
    _, root, _p = wait_count(TOTAL, 25)
    check('POINT_SCOPE_CLEARS_TO_ALL', count_value(root)[0] == TOTAL, ui=count_value(root)[0])


def s_map_pins():
    """Cold start, country-scale pills, a cluster opened by the camera, then every pill tapped until a task and a place have been seen."""
    relaunch()
    root = ensure_peek()
    root = snapshot('P6_10_cold_map')
    view_probe('P6_10_cold_map')
    ps = pills(root)
    REPORT['coldPills'] = pill_boxes(ps)
    check('COLD_START_MAP_SHOWS_PILLS', len(ps) >= 1, pills=len(ps), boxes=pill_boxes(ps))
    if not ps:
        raise RuntimeError('no map pill on the cold-start map')
    # At country scale every pill is a cluster. Novi Sad (the dense place and five single tasks) is the second from the north.
    target = ps[1] if len(ps) > 1 else ps[0]
    before = pill_signature(ps)
    m = mark()
    tap_pill(target)
    time.sleep(7)
    root, parent = dump()
    after = pills(root)
    reads = since(m)
    check('CLUSTER_TAP_MOVES_THE_CAMERA', pill_signature(after) != before, before=len(ps), after=len(after), boxes=pill_boxes(after))
    check('CLUSTER_TAP_READS_LIST_AND_MAP_FOR_THE_AREA',
          any(r.get('mode') == 'MAP' for r in reads) and any(r.get('mode') == 'PAGE' and brief(r)['scope'] == 'AREA' for r in reads),
          requests=[brief(r) for r in reads[:6]])
    snapshot('P6_11_cluster_opened')
    view_probe('P6_11_cluster_opened')
    tried, taps, seen = [], [], {'TASK': False, 'PLACE': False}
    for _attempt in range(10):
        root, parent = dump()
        candidates = [p for p in pills(root) if not any(abs(p['x'] - t['x']) < 40 and abs(p['y'] - t['y']) < 40 for t in tried)]
        if not candidates:
            break
        p = candidates[0]
        tried.append(p)
        m = mark()
        tap_pill(p)
        time.sleep(5)
        root, parent, kind, title = classify_after_tap()
        taps.append({'at': [p['x'], p['y']], 'kind': kind, 'title': title, 'pillsAfter': len(pills(root))})
        if kind == 'TASK' and not seen['TASK']:
            seen['TASK'] = True
            verify_task_peek(root, parent, title, m)
            try:
                time_pin_taps(p, 30)
            except RuntimeError as exc:                    # a failed timing is a failed check; the flow that follows still gets its Peek back
                check('PIN_TIMING_STEP_COMPLETED', False, error=str(exc)[:160])
                close_card_if_open()
                tap_pill(p)
                poll(lambda r, q: peek_task_title(r), 30, interval=0.5, what='the Peek after a failed timing')
        elif kind == 'PLACE' and not seen['PLACE']:
            seen['PLACE'] = True
            verify_place_peek(root, parent, m)
        elif kind == 'NONE':
            tried.clear()                     # the camera moved: the pills are others now
        if all(seen.values()):
            break
        if kind != 'NONE':
            close_card()
    REPORT['pillTaps'] = taps
    check('PILL_TAPS_REACHED_A_TASK_PEEK', seen['TASK'], taps=taps[-6:])
    check('PILL_TAPS_REACHED_A_PLACE_PEEK', seen['PLACE'], taps=taps[-6:])


def s_search_places():
    ensure_peek()
    root, parent = dump()
    bar = nodes(root, prefix='Pretraži zadatke')
    if not bar:
        raise RuntimeError('search bar not found')
    m = mark()
    tap_visible(bar[0], parent)
    poll(lambda r, p: nodes(r, clazz='android.widget.EditText'), 20, what='search field')
    time.sleep(2)
    opened = since(m, 'PLACES')
    snapshot('P6_20_search_open')
    check('SEARCH_OPEN_LOADS_PLACE_FACETS', bool(opened), places=len(opened))
    edit_text(0, 'Liman')
    time.sleep(4)
    typed = since(m, 'PLACES')
    # The server is asked with the words as typed for the count (filter.text) and normalised for the places (prefix).
    sent = since(m)
    check('SEARCH_TEXT_SENT_TO_SERVER', any('liman' in json.dumps(r, ensure_ascii=False).lower() for r in sent), requests=[brief(r) for r in typed[-3:]])
    # Opening the panel and typing five letters is a handful of previews. Hundreds is the panel asking again after every answer (found: 330 reads).
    check('SEARCH_DRAFT_PREVIEW_DOES_NOT_LOOP', len(sent) <= 30, requests=len(sent), modes={k: sum(1 for r in sent if r.get('mode') == k) for k in ('PAGE', 'PLACES')})
    root, parent = dump()
    snapshot('P6_21_search_typed')
    dense_expected = EXPECTED.get('dense', 30)

    def suggestions(r):
        return [n for n in r.iter() if n.attrib.get('package') == PACKAGE and re.match(r'^Liman\b.*zadat', n.attrib.get('content-desc', '') or '')]

    sug = suggestions(root)
    check('SEARCH_SUGGESTS_DENSE_PLACE_WITH_COUNT', bool(sug), suggestions=[n.attrib.get('content-desc') for n in nodes(root, prefix='Liman')][:3])
    if not sug:
        raise RuntimeError('no place suggestion for Liman')
    check('SUGGESTION_COUNT_EQUALS_SERVER', str(dense_expected) in (sug[0].attrib.get('content-desc') or ''), suggestion=sug[0].attrib.get('content-desc'), expected=dense_expected)
    hide_keyboard()
    root, parent = dump()
    sug = suggestions(root)
    tap_visible(sug[0], parent)
    time.sleep(2)
    root, parent = dump()
    show = sorted([n for n in root.iter() if n.attrib.get('package') == PACKAGE and (n.attrib.get('content-desc', '') or n.attrib.get('text', '')).startswith('Prikaži')
                   and n.attrib.get('clickable') == 'true'], key=lambda n: parse_bounds(n.attrib.get('bounds'))[1])
    if not show:
        raise RuntimeError('search "Prikaži" action not found')
    snapshot('P6_22_search_place_chosen')
    # The apply action names the count the server gave for this draft; press it once that has stopped changing.
    stable = None
    for _ in range(10):
        root, parent = dump()
        label = next((n.attrib.get('content-desc') or n.attrib.get('text') or '' for n in root.iter()
                      if n.attrib.get('package') == PACKAGE and n.attrib.get('clickable') == 'true'
                      and (n.attrib.get('content-desc', '') or n.attrib.get('text', '')).startswith('Prikaži')), '')
        if label and label == stable:
            break
        stable = label
        time.sleep(1.5)
    show = sorted([n for n in root.iter() if n.attrib.get('package') == PACKAGE and (n.attrib.get('content-desc', '') or n.attrib.get('text', '')).startswith('Prikaži')
                   and n.attrib.get('clickable') == 'true'], key=lambda n: parse_bounds(n.attrib.get('bounds'))[1])
    if not show:
        raise RuntimeError('search "Prikaži" action not found')
    settled = len(since(m))
    time.sleep(3)
    check('SEARCH_PREVIEW_IS_QUIET_BEFORE_APPLY', len(since(m)) == settled, before=settled, after=len(since(m)))
    tap_visible(show[-1], parent)
    _, root, parent = wait_count(dense_expected, 30)
    check('SEARCH_PLACE_RESULT_COUNT_EQUALS_SERVER', count_value(root)[0] == dense_expected, ui=count_value(root)[0], expected=dense_expected)
    # The place's marker arrives with the MAP read for it (the buckets are emptied while it is read).
    end, applied = time.time() + 25, []
    while time.time() < end:
        time.sleep(2)
        applied = pills()
        if applied:
            break
    root = snapshot('P6_23_search_applied')
    check('SEARCH_PLACE_SHOWS_ITS_PILL_ON_THE_MAP', len(applied) >= 1, pills=len(applied), boxes=pill_boxes(applied))
    if not applied:
        # A diagnosis, not an excuse: is the marker only hidden behind the list? Lower the list to its top line and look again.
        top = sheet_top(root)
        REPORT['searchNoPill'] = {'sheetTop': top, 'state': sheet_state(root)}
        if top:
            swipe(540, top + 40, 540, 2050, 500)
            time.sleep(4)
            REPORT['searchNoPill']['pillsAfterLowering'] = len(pills())
            snapshot('P6_24_search_sheet_lowered')
    clear = nodes(root, desc='Prikaži sve zadatke') or nodes(root, rid_='clear-where')
    if clear:
        tap_visible(clear[0], parent)
        wait_count(TOTAL, 25)


def capture_self_test():
    """The fixture's own three PAGE probes (any / remote / onsite) ran after statement logging was switched on: they must be
    readable back, otherwise every body-based check below is meaningless and the raw log shape is recorded instead."""
    bodies = harvest()
    wheres = sorted({(r.get('filter') or {}).get('where') for r in bodies if r.get('mode') == 'PAGE'} - {None})
    ok = {'any', 'remote', 'onsite'} <= set(wheres)
    REPORT['captureSelfTest'] = {'bodies': len(bodies), 'wheres': wheres, 'start': START_ISO}
    if not ok:
        REPORT['logSamples'] = log_samples()
    check('STATEMENT_LOG_CAPTURES_REQUEST_BODIES', ok, bodies=len(bodies), wheres=wheres)


def map_area_of(req):
    """The map area a request asked for: MAP's bounds, or the bounds of an AREA-scoped PAGE."""
    scope = req.get('scope')
    found = req.get('bounds') if req.get('mode') == 'MAP' else (scope.get('bounds') if isinstance(scope, dict) and scope.get('kind') == 'AREA' else None)
    return found if isinstance(found, list) and len(found) == 4 else None


def map_reads():
    return [r for r in harvest() if r.get('mode') == 'MAP' and map_area_of(r)]


def wait_new_map_area(seen, timeout=30, min_polls=4):
    """The MAP read a settled camera move asks for: the newest one once more than `seen` MAP reads exist.

    Every poll reads the whole statement log, which on the CI runner can take longer than the timeout (journey #9: one read took over 30 s, ended the wait before a second look,
    and every later gesture check then compared with the read of the gesture before it), so a wait always looks `min_polls` times."""
    end = time.time() + timeout
    polls = 0
    while polls < min_polls or time.time() < end:
        maps = map_reads()
        polls += 1
        if len(maps) > seen:
            return map_area_of(maps[-1]), len(maps)
        time.sleep(1.5)
    return None, seen


def area_width(area):
    return abs(area[2] - area[0]) if area else None


def s_map_gestures():
    """P6-11: a real pan and the zoom buttons on the map (a pinch cannot be sent through adb). Each settled move reads the MAP for the new area, the person's own move also reads
    the list for it, and the screen keeps its top line and shows no error."""
    root = ensure_peek()
    snapshot('P6_30_before_gestures')
    w, _h = screen_size()
    top, bottom = map_band(root)
    y = (top + bottom) // 2
    seen = len(map_reads())
    maps = map_reads()
    base = map_area_of(maps[-1]) if maps else None
    m = mark()
    swipe(int(w * 0.78), y, int(w * 0.28), y - 60, 700)
    panned, seen = wait_new_map_area(seen)
    reads = since(m)
    snapshot('P6_31_after_pan')
    check('PAN_READS_THE_MAP_FOR_THE_NEW_AREA', panned is not None and panned != base, before=base, after=panned)
    check('PAN_READS_THE_LIST_FOR_THE_AREA', any(r.get('mode') == 'PAGE' and brief(r)['scope'] == 'AREA' for r in reads), requests=[brief(r) for r in reads[:6]])
    root, _p = dump()
    check('PAN_KEEPS_THE_TOP_LINE_AND_SHOWS_NO_ERROR', bool(count_nodes(root)) and not nodes(root, contains='nisu dostupni'), sheet=sheet_state(root))
    previous = panned
    for label, wanted in (('Umanji mapu', 'wider'), ('Uvećaj mapu', 'narrower')):
        root, parent = dump()
        button = nodes(root, desc=label)
        if not button:
            raise RuntimeError(f'zoom control "{label}" not found')
        tap_visible(button[0], parent)
        after, seen = wait_new_map_area(seen)
        snapshot('P6_32_' + ('zoom_out' if wanted == 'wider' else 'zoom_in'))
        ratio = (area_width(after) / area_width(previous)) if after and previous and area_width(previous) else None
        check('ZOOM_' + ('OUT_WIDENS' if wanted == 'wider' else 'IN_NARROWS') + '_THE_MAP_READ',
              ratio is not None and (ratio > 1.4 if wanted == 'wider' else ratio < 0.75), before=previous, after=after, widthRatio=ratio)
        previous = after or previous
        root, _p = dump()
        check('ZOOM_KEEPS_THE_TOP_LINE_AND_SHOWS_NO_ERROR_' + wanted.upper(), bool(count_nodes(root)) and not nodes(root, contains='nisu dostupni'),
              sheet=sheet_state(root))


def s_final():
    root, _p = dump()
    snapshot('P6_99_final')
    REPORT['finalMemKb'] = mem_kb()
    REPORT['finalPid'] = app_pid()
    check('APP_STILL_RUNNING_AT_END', bool(REPORT['finalPid']), pid=REPORT['finalPid'])
    reqs = harvest()
    modes = {}
    for r in reqs:
        modes[r.get('mode')] = modes.get(r.get('mode'), 0) + 1
    REPORT['requestModes'] = modes
    REPORT['requestLog'] = [brief(r) for r in reqs[:150]]
    REPORT['readerCalls'] = reader_calls()
    REPORT['gateway'] = gateway_counts()
    seconds = sorted(HARVEST_SECONDS)
    REPORT['logReadSeconds'] = {'n': len(seconds), 'median': seconds[len(seconds) // 2] if seconds else None, 'max': seconds[-1] if seconds else None}
    if not reqs and 'logSamples' not in REPORT:
        REPORT['logSamples'] = log_samples()
    check('SERVER_REQUEST_LOG_AVAILABLE', bool(reqs), total=len(reqs), modes=modes)
    # Every return to the list showed the sheet (a blank first look is recorded, not fatal: the sheet heals itself), and none took longer than this.
    returns = REPORT.get('returns', [])
    check('EVERY_RETURN_SHOWED_THE_SHEET', bool(returns) and all(x['s'] <= 45 for x in returns), returns=len(returns),
          blankAtFirstLook=sum(1 for x in returns if x['blank']), slowest=max((x['s'] for x in returns), default=None))


def main():
    note('START', mode=MODE, route=ROUTE, total=TOTAL, expected=EXPECTED)
    try:
        capture_self_test()
    except Exception as exc:                       # noqa: BLE001
        note('CAPTURE_SELF_TEST_ERROR', error=str(exc)[:200])
    if FOCUS:
        REPORT['focused'] = FOCUS
    for name, fn in (('login', s_login), ('ordinary_route', s_ordinary_route), ('route', s_route), ('open_full', s_open_full),
                     ('paging', s_paging), ('detail_back', s_detail_and_back), ('cycles', s_repeat_cycles),
                     ('filters', s_filters), ('map_pins', s_map_pins),
                     ('search_places', s_search_places), ('map_gestures', s_map_gestures), ('final', s_final)):
        if FOCUS and name != 'login' and name not in FOCUS:
            continue
        step(name, fn)
        if name == 'login' and not REPORT['steps'][-1]['ok']:
            break                                  # nothing else can run signed out
        if name == 'login' or (name == 'ordinary_route' and ROUTE == 'proof'):
            continue                               # the next step opens the list itself (a proof-route recovery would spoil the ordinary-route check)
        try:
            ensure_list()
        except Exception as exc:                   # noqa: BLE001
            if getattr(exc, 'native_surface_fatal', False):
                raise
            note('RECOVERY_FAIL', after=name, error=str(exc)[:200])
    REPORT['result'] = 'PASS' if REPORT['steps'] and all(s['ok'] and s.get('checksOk', True) for s in REPORT['steps']) and all(c['ok'] for c in REPORT['checks']) else 'FAIL'
    (ARTIFACT_DIR / 'p6-native-report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f"{REPORT['result']} P6_NATIVE_JOURNEY mode={MODE}", flush=True)
    return 0 if (REPORT['result'] == 'PASS' or MODE == 'probe') else 1


if __name__ == '__main__':
    # The journey clears the app's data (launch_clean) on the attached device: it runs only as a script, and only in CI unless the caller says otherwise
    # (an import of this module once ran it on a local emulator and wiped a signed-in session).
    if os.environ.get('GITHUB_ACTIONS') != 'true' and os.environ.get('P6N_ALLOW_LOCAL_CLEAR') != '1':
        print('REFUSED: the P6 native journey clears the app data of the attached device; run it in CI, or set P6N_ALLOW_LOCAL_CLEAR=1 for a disposable emulator', flush=True)
        sys.exit(3)
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except BaseException as exc:                              # noqa: BLE001 - always leave a report behind
        REPORT['result'] = 'FAIL'
        REPORT['error'] = f'{type(exc).__name__}: {str(exc)[:800]}'
        (ARTIFACT_DIR / 'p6-native-report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'FAIL P6_NATIVE_JOURNEY {REPORT["error"]}', flush=True)
        sys.exit(1)
