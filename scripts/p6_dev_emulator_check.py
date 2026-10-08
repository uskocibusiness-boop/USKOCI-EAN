#!/usr/bin/env python3
"""P6 read-only check of an installed DEV build on a LOCAL Android device (the physical HONOR phone first, the AVD second), against the canonical DEV backend.

It only looks and taps: open the Zadaci tab, read the list (count and card titles), time repeated touches on one map bucket from the app's own DEV trace
(`[USKOCI_P6_TRACE] ["pin","<ms to halo>/<ms to card data>"]`), open a task and come back N times (return time and memory after each), and count what the device log
says about ANR, crashes, slow frames and Reanimated's dead-tag retries. It never types, never sends, never changes an account and never uninstalls or clears data.
Evidence goes to a directory of JSON and PNG files. The CI native journey (scripts/p6_native_journey.py) is the disposable-server counterpart.

The device is chosen explicitly (scripts/qa_device.py): --serial, QA_SERIAL / ANDROID_SERIAL, or --device physical|emulator|auto (auto = the one physical phone, else the one emulator).
On a physical phone nothing is cleared or changed: the UI tree comes out over stdout (no file on the phone), the app's log is streamed to a local file (no `logcat -c` / `-G`, only the
app's own uid is kept), the app process is restarted only with --restart (a force-stop: data and the signed-in session stay) and the input is taps, swipes and Back. Numbers from a phone
and from an emulator are never mixed: report.json says which device produced them (label, kind, profile, the installed APK's version and SHA-256) and the frame statistics are per phase.

  python scripts/p6_dev_emulator_check.py --out DIR [--serial S | --device physical] [--label TEXT] [--reader p6|legacy] [--restart] [--route URL]
                                          [--expect-count 7] [--baseline titles.json] [--taps 30] [--cycles 20] [--video]
"""
import argparse
import json
import math
import re
import struct
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import qa_device                                                    # noqa: E402 - the shared device choice / profile / log helpers

PACKAGE = 'rs.uskoci.dev'
sys.stdout.reconfigure(encoding='utf-8', errors='replace')          # task titles carry Serbian letters; a Windows console defaults to cp1252
ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--serial', default=None, help='adb serial of the device (QA_SERIAL / ANDROID_SERIAL also work); without it --device decides')
ap.add_argument('--device', choices=('auto', 'physical', 'emulator'), default='auto', help='auto: the one physical phone, else the one emulator')
ap.add_argument('--package', default=PACKAGE)
ap.add_argument('--label', default=None, help='what this run is called in its report, e.g. "PHYSICAL HONOR / candidate 42371918"')
ap.add_argument('--reader', choices=('p6', 'legacy'), default='p6', help='legacy: the build still reads Zadaci through the old readers (no P6 trace lines): P6-only checks are skipped, not failed')
ap.add_argument('--restart', action='store_true', help='force-stop and relaunch the app (a cold start; the process dies, no data is cleared and the session stays)')
ap.add_argument('--search', default=None, help='ASCII word to type into the search panel: the first place suggestion is chosen, applied and cleared again (a typed query: nothing is sent or written, but the remembered search view changes for a while and is restored)')
ap.add_argument('--visible-return', type=int, default=0, help='N repeats of: open a task, press Back, and watch the SCREEN (a burst of screenshots, no UI tree) until the list is back: the time the person sees')
ap.add_argument('--filters', action='store_true', help='toggle the quick filters "Na daljinu" and "Sa iznosom" and back (never "Moja lokacija": it asks for the location permission)')
ap.add_argument('--expect-apk-sha256', default=None, help='the SHA-256 of the APK that was installed: the run fails at once if the device reports another one')
ap.add_argument('--route', default=None, help='open this deep link instead of the launcher activity (e.g. uskociapp://zadaci?p6Proof=1 on a proof build)')
ap.add_argument('--expect-count', type=int, default=None)
ap.add_argument('--baseline', default=None, help='JSON written by --write-baseline on the previous build (or a list of card labels): every task title must be listed again')
ap.add_argument('--write-baseline', default=None, help='write the count and every task title of the list (all of it, scrolled) to this JSON file')
ap.add_argument('--taps', type=int, default=30)
ap.add_argument('--cycles', type=int, default=20)
ap.add_argument('--video', action='store_true')
ap.add_argument('--quiet-pins', action='store_true', help='EX-03: the pin timing without a single UI dump while a card is open (an accessibility dump walks the views of the app on its UI thread and can itself make a slow frame): tap, wait, read the frame ring, Back; the touch count is confirmed from the trace')
ap.add_argument('--only-pins', action='store_true', help='launch and run the pin timing step alone')
ap.add_argument('--focused', action='store_true', help='the short physical measurement (owner, 2026-09-30, a 6-minute window on a quiet database): cold start, pin timing (--taps), FULL->detail->Back cycles (--cycles), health and the runbook verdict; no pan/zoom, flings, search or filters')
ap.add_argument('--only-flows', action='store_true', help='launch, read the list, then run only the flows asked for (--filters, --search, --visible-return) and stop')
ap.add_argument('--only-list', action='store_true', help='launch, read (and with --write-baseline record) the list, and stop')
ap.add_argument('--smoke', action='store_true', help='only look at the app the way an older client uses it (Home, Zadaci, Moji zadaci with a task and back, Moje prijave, Dogovori) and report any error text')
ARGS = ap.parse_args()
OUT = Path(ARGS.out)
OUT.mkdir(parents=True, exist_ok=True)
PACKAGE = ARGS.package
DEV = qa_device.Device(qa_device.pick(serial=ARGS.serial, prefer=ARGS.device))
ADB = DEV.prefix
W, H = DEV.screen_size() or (1080, 2424)                            # gestures are fractions of the real screen: the phone (1264 x 2728) and the AVD (1080 x 2424) differ
REPORT = {'label': ARGS.label or f'{DEV.kind.upper()} {DEV.serial}', 'serial': DEV.serial, 'kind': DEV.kind, 'package': PACKAGE, 'reader': ARGS.reader, 'checks': [], 'result': 'FAIL'}
ITEM = re.compile(r'^Otvori (?:priliku|Zadatak|zadatak)[: ]+(.*)$')
PIN = re.compile(r'\[USKOCI_P6_TRACE\] \["pin","(\d+)/(\d+)"\]')
LOG = None              # qa_device.LogStream: the app's log streamed to a local file for the whole run (nothing is cleared on the device); steps read it by byte offset
PROFILE = {}            # qa_device.Device.profile(): which device and which build produced the numbers
PHASE_GFX = {}          # frame statistics per phase (the counters are reset at the start of each phase)
RESTORED = re.compile(r'^(\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}).*\[USKOCI_P6_TRACE\] \["restored","\d+/\d+"\]', re.M)
# EX-03 (warm return): the trace line of a return that showed the kept picture instead of reading PAGE and MAP again (age in seconds / rows). A build without it never logs it.
WARM = re.compile(r'\[USKOCI_P6_TRACE\] \["warm","(\d+)/(\d+)"\]')


def log(*parts):
    print(time.strftime('%H:%M:%S'), *parts, flush=True)


def adb(*args, timeout=120):
    return subprocess.run(ADB + list(args), capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout).stdout


class ForegroundLost(RuntimeError):
    pass


GUARDED = {'inputs': 0}


def guard():
    """No input is ever sent to a screen the app under test does not have: on a phone that is somebody's own, another app (or the launcher, or the lock screen) can come to the front
    at any moment, and a blind tap, swipe or Back would then land in it. The run ends at once; nothing is captured of the foreign screen (only its package name is recorded)."""
    front = DEV.foreground()
    if not front or front[0] != PACKAGE:
        REPORT['foregroundLost'] = {'front': front[0] if front else None, 'afterInputs': GUARDED['inputs'], 'at': time.strftime('%H:%M:%S')}
        raise ForegroundLost(f'{front[0] if front else "no app"} has the screen, not {PACKAGE}: no further input is sent')
    GUARDED['inputs'] += 1


def send_input(*args):
    guard()
    return adb('shell', 'input', *args)


def check(name, ok, **detail):
    REPORT['checks'].append({'name': name, 'ok': bool(ok), **detail})
    log('PASS' if ok else 'FAIL', name, json.dumps(detail, ensure_ascii=False)[:300])


def skip(name, why):
    """A check that does not apply to this build (e.g. a P6 trace on the legacy reader): recorded, never counted as a pass or a failure."""
    REPORT['checks'].append({'name': name, 'ok': None, 'skipped': why})
    log('SKIP', name, why)


def passed():
    return all(c['ok'] is not False for c in REPORT['checks'])


def dump():
    """The UI tree (it comes out over stdout: no file is written on the device); a dump that fails is tried again."""
    for _ in range(4):
        try:
            return ET.fromstring(DEV.uia_dump())
        except (ValueError, ET.ParseError):
            time.sleep(0.8)
    raise RuntimeError('uiautomator gave no UI tree four times in a row')


def attrs(root):
    return [n.attrib for n in root.iter('node') if n.attrib.get('package') == PACKAGE]


def bounds(raw):
    return tuple(int(v) for v in re.findall(r'-?\d+', raw or ''))


def by_desc(root, prefix=None, exact=None, contains=None):
    out = []
    for a in attrs(root):
        d = a.get('content-desc', '') or ''
        if (prefix and d.startswith(prefix)) or (exact and d == exact) or (contains and contains in d):
            out.append(a)
    return out


def by_id(root, rid):
    return [a for a in attrs(root) if (a.get('resource-id') or '').endswith(rid)]


def cards(root):
    found = []
    for a in attrs(root):
        m = ITEM.match(a.get('content-desc', '') or '')
        if m:
            found.append({'label': a['content-desc'], 'title': m.group(1).split(',')[0].strip(), 'b': bounds(a.get('bounds'))})
    return sorted(found, key=lambda c: c['b'][1])


def count_shown(root):
    """The number the list's top line shows (its visible text, e.g. "7 zadataka")."""
    for a in attrs(root):
        m = re.match(r'\s*(\d+)\s+zadat', a.get('text', '') or '')
        if m:
            return int(m.group(1))
        if re.match(r'\s*Nema zadataka\s*$', a.get('text', '') or ''):
            return 0                                             # the empty list's own line
    return None


def tap(x, y, hold_ms=120):
    send_input('touchscreen', 'swipe', str(x), str(y), str(x), str(y), str(hold_ms))


def swipe(x1, y1, x2, y2, ms):
    """A drag between two points given as fractions of the screen."""
    send_input('touchscreen', 'swipe', str(int(W * x1)), str(int(H * y1)), str(int(W * x2)), str(int(H * y2)), str(ms))


def visible_tap_point(root, b):
    """A point on the card with bounds `b` that is really visible (inside the list sheet, above the tab bar) and not under another clickable control: the floating "Mapa" pill, for one, covers
    the middle of the lowest card on the phone. The title area (upper left) is tried first. Falls back to the centre of the visible part."""
    x1, y1, x2, y2 = b
    sheet = by_id(root, 'discovery-sheet-background')
    top = max(y1, (bounds(sheet[0]['bounds'])[1] + int(H * 0.17)) if sheet else y1)
    bottom = min(y2, bounds(sheet[0]['bounds'])[3] if sheet else y2, int(H * 0.87)) - 12
    if bottom - top < 30:
        return (x1 + x2) // 2, (y1 + y2) // 2
    others = [bounds(a['bounds']) for a in attrs(root) if a.get('clickable') == 'true' and bounds(a['bounds']) != tuple(b)
              and not (bounds(a['bounds'])[0] <= x1 and bounds(a['bounds'])[1] <= y1 and bounds(a['bounds'])[2] >= x2 and bounds(a['bounds'])[3] >= y2)]
    for fy in (0.12, 0.25, 0.5, 0.75):
        for fx in (0.2, 0.5, 0.8):
            x, y = x1 + int((x2 - x1) * fx), top + int((bottom - top) * fy)
            if not any(o[0] <= x <= o[2] and o[1] <= y <= o[3] for o in others):
                return x, y
    return (x1 + x2) // 2, (top + bottom) // 2


def visible_fraction(root, b):
    sheet = by_id(root, 'discovery-sheet-background')
    top = max(b[1], bounds(sheet[0]['bounds'])[1] if sheet else b[1])
    bottom = min(b[3], bounds(sheet[0]['bounds'])[3] if sheet else b[3], int(H * 0.87))
    return max(0, bottom - top) / max(1, b[3] - b[1])


def tap_node(a):
    x1, y1, x2, y2 = bounds(a.get('bounds'))
    tap((x1 + x2) // 2, (y1 + y2) // 2)


def back():
    send_input('keyevent', 'KEYCODE_BACK')


def poll(pred, timeout=30, interval=0.4):
    end = time.time() + timeout
    while time.time() < end:
        root = dump()
        value = pred(root)
        if value:
            return value, root
        time.sleep(interval)
    return None, None


def screen():
    raw = subprocess.run(ADB + ['exec-out', 'screencap'], capture_output=True, timeout=90).stdout
    w, h, _fmt = struct.unpack('<III', raw[:12])
    extra = len(raw) - w * h * 4
    offset = extra if extra in (12, 16) else 12
    return w, h, memoryview(raw)[offset:offset + w * h * 4]


def png(name):
    data = subprocess.run(ADB + ['exec-out', 'screencap', '-p'], capture_output=True, timeout=90).stdout
    (OUT / f'{name}.png').write_bytes(data)


def pins(root, step=3, cell=24, gap=2):
    """Map markers found by the brand green (#076E4E) on the screenshot, in the rows no chrome covers: [{x, y, w, h}]."""
    w, h, px = screen()
    top, bottom = int(h * 0.18), int(h * 0.76)
    chips = by_desc(root, exact='Brzi filteri')
    if chips:
        top = bounds(chips[0]['bounds'])[3] + 6
    sheet = by_id(root, 'discovery-sheet-background')
    if sheet:
        bottom = bounds(sheet[0]['bounds'])[1] - 6
    card = by_desc(root, prefix='Otvori zadatak: ') + by_desc(root, prefix='Pogledaj zadatak ') + by_desc(root, prefix='Zatvori pregled')
    if card:
        bottom = min(bottom, min(bounds(a['bounds'])[1] for a in card) - 170)
    cells = {}
    for y in range(max(0, top), min(h, max(top + 1, bottom)), step):
        row = y * w * 4
        for x in range(0, w, step):
            i = row + x * 4
            if px[i + 1] - px[i] >= 40 and px[i + 1] - px[i + 2] >= 12 and px[i] <= 70 and 80 <= px[i + 1] <= 140:
                cells[(x // cell, y // cell)] = cells.get((x // cell, y // cell), 0) + 1
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
        n = sum(cells[m] for m in members)
        if n < 12:
            continue
        xs, ys = [m[0] for m in members], [m[1] for m in members]
        left, right, upper, lower = min(xs) * cell, max(xs) * cell + cell, min(ys) * cell, max(ys) * cell + cell
        found.append({'x': (left + right) // 2, 'y': (upper + lower) // 2, 'w': right - left, 'h': lower - upper, 'n': n})
    return sorted(found, key=lambda p: (p['y'], p['x']))


def percentile(values, q):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(q * len(ordered)) - 1)] if ordered else None


def pss_kb():
    out = adb('shell', 'dumpsys', 'meminfo', PACKAGE)
    m = re.search(r'TOTAL PSS:\s+(\d+)', out) or re.search(r'^\s*TOTAL\s+(\d+)', out, re.M)
    return int(m.group(1)) if m else -1


def pid():
    out = adb('shell', 'pidof', PACKAGE).strip()
    return out.split()[0] if out else ''


def stamp(text):
    """'MM-DD HH:MM:SS.mmm' (device local time, as the device log prints it) -> seconds within the year-less calendar, good for differences of a few seconds."""
    m = re.match(r'(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)\.(\d{3})', text)
    month, day, hh, mm, ss, ms = (int(x) for x in m.groups())
    return (((month * 31 + day) * 24 + hh) * 60 + mm) * 60 + ss + ms / 1000


def timed_back():
    """Android Back, stamped with the device's own clock just before the key is injected (the same clock the device log uses)."""
    guard()
    out = adb('shell', 'date "+%m-%d %H:%M:%S.%N"; input keyevent KEYCODE_BACK').strip().splitlines()
    return stamp(out[0][:18]) if out else None


def restored_after(at, mark, wait_s=15):
    """Seconds from `at` to the P6 screen's own `restored` line (its reads are in and the screen was committed), None on the legacy build. `mark` is the log offset taken before the Back."""
    end = time.time() + wait_s
    while at is not None and time.time() < end:
        text = LOG.since(mark)
        later = [stamp(t) for t in RESTORED.findall(text) if stamp(t) >= at]
        if later:
            return round(min(later) - at, 3)
        time.sleep(0.7)
    return None


def peek_title(root):
    for a in by_desc(root, prefix='Otvori zadatak: '):
        return a['content-desc'][len('Otvori zadatak: '):].split(',')[0].strip()
    return None


def close_peek():
    root = dump()
    close = by_desc(root, exact='Zatvori pregled zadatka') or by_desc(root, prefix='Zatvori pregled')
    if not close:
        return False
    tap_node(close[0])
    time.sleep(1.2)
    return True


# ---------------------------------------------------------------------------------------------------------------- steps
def launch(restart=False):
    """Bring the app to the front. The process is restarted (a force-stop: nothing is cleared, the session stays) only when the caller asks for it AND the run was given --restart."""
    if restart and ARGS.restart:
        adb('shell', 'am', 'force-stop', PACKAGE)
        time.sleep(1.0)
    if ARGS.route:
        adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', "'" + ARGS.route + "'", PACKAGE)
    else:
        adb('shell', 'am', 'start', '-n', f'{PACKAGE}/.MainActivity')
    time.sleep(6)
    front = DEV.foreground()
    if not front or front[0] != PACKAGE:
        raise ForegroundLost(f'{front[0] if front else "no app"} has the screen after the launch, not {PACKAGE} (a locked or dark screen?): no input is sent')
    end = time.time() + 90
    while time.time() < end:
        root = dump()
        # The Zadaci screen is up when its list line, a card or its map is on screen (the app reopens on the view it was left in).
        if by_id(root, 'list-count-words') or by_id(root, 'list-count') or cards(root) or by_desc(root, prefix='Mapa'):
            return root
        for a in attrs(root):
            if (a.get('content-desc') == 'Zadaci' or a.get('text') == 'Zadaci') and a.get('clickable') == 'true':
                tap_node(a)
                break
        time.sleep(2)
    raise RuntimeError('the Zadaci screen did not appear')


def ensure_full_list():
    """The list at full height: the top line's own button opens it (the count line is a button while the sheet is low)."""
    root = dump()
    for _ in range(3):
        button = by_id(root, 'list-count')
        if not button and by_id(root, 'list-count-words'):
            return root                                             # the count is plain words (not a button) only while the sheet stands full
        if button:
            tap_node(button[0])
            got, root = poll(lambda r: by_id(r, 'list-count-words') and cards(r), 25, 0.5)
            if got:
                return root
        root = dump()
    return root


def collect_titles(root, max_swipes=14):
    """Every task title in the list: the list is scrolled from its top a screen at a time until nothing new appears (a title can repeat: tasks are told apart by their whole label)."""
    labels = {}
    down, idle = 0, 0
    for _ in range(max_swipes):
        fresh = 0
        for c in cards(root):
            if c['label'] not in labels:
                labels[c['label']] = c['title']
                fresh += 1
        if fresh == 0 and labels:
            idle += 1
            if idle >= 2:                                          # a swipe can land while the sheet still settles: one more try before the end of the list is believed
                break
        else:
            idle = 0
        swipe(0.5, 0.722, 0.5, 0.351, 450)
        down += 1
        time.sleep(1.6)
        root = dump()
    for _ in range(down):                                          # back up only as far as it went down: a drag beyond the top would pull the sheet down and pan the map
        swipe(0.5, 0.351, 0.5, 0.722, 450)
        time.sleep(1.0)
    return sorted(labels.values()), ensure_full_list()


def read_list():
    root = reset_view()                                             # the whole list: an area left on the map by an earlier visit would change what is counted
    for _ in range(8):
        if count_shown(root) is not None and cards(root):
            break
        time.sleep(1.5)
        root = dump()
    shown_count = count_shown(root)
    png('01_list')
    titles, root = collect_titles(root)
    REPORT['list'] = {'count': shown_count, 'titles': titles}
    if ARGS.expect_count is not None:
        check('LIST_COUNT_MATCHES_EXPECTED', shown_count == ARGS.expect_count, shown=shown_count, expected=ARGS.expect_count)
    # Cards are told apart by their whole accessible label: tasks with the same title and facts are one label, so the cards read are a lower bound of the count line.
    check('LIST_SHOWS_CARDS_AND_A_COUNT', shown_count is not None and len(titles) >= 1 and len(titles) <= shown_count, cards=len(titles), count=shown_count,
          note='identical labels collapse; the count line is the truth')
    if ARGS.write_baseline:
        Path(ARGS.write_baseline).write_text(json.dumps({'count': shown_count, 'titles': titles}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    if ARGS.baseline:
        base = json.loads(Path(ARGS.baseline).read_text(encoding='utf-8'))
        base_titles = sorted(base['titles']) if isinstance(base, dict) else sorted(ITEM.match(x).group(1).split(',')[0].strip() for x in base if ITEM.match(x))
        listed = list(titles)
        missing = []
        for t in base_titles:                                       # a multiset test: every earlier title is listed again (the list may hold more)
            if t in listed:
                listed.remove(t)
            else:
                missing.append(t)
        check('LIST_KEEPS_EVERY_TITLE_OF_THE_BASELINE', not missing, missing=missing, baseline=len(base_titles), now=len(titles))
    return root


def to_map(root):
    for _ in range(3):
        if by_id(root, 'list-count') and not cards(root):
            return root                                             # the list stands at its top line: the map is in front
        pill = [a for a in by_desc(root, exact='Mapa') if a.get('class') == 'android.widget.Button'] or by_desc(root, exact='Mapa')
        if not pill:
            return root
        tap_node(pill[0])
        time.sleep(3)
        root = dump()
    return root


def time_pins():
    if ARGS.reader != 'p6':
        skip('PIN_TIMING_MEASURED', 'legacy reader: the build has no P6 trace lines')
        skip('PEEK_DOES_NOT_MOVE_AFTER_IT_APPEARS', 'legacy reader: the build has no P6 trace lines')
        return
    root = to_map(dump())
    for _ in range(4):
        if pins(root):
            break
        # The map has no + and - buttons any more (the owner's phone of 8 Oct 2026) and a pinch cannot be sent through adb: the camera looks around with a drag until a bucket is in view.
        top, bottom = map_rows(root)
        send_input('touchscreen', 'swipe', str(int(W * 0.30)), str((top + bottom) // 2), str(int(W * 0.75)), str((top + bottom) // 2), '600')
        time.sleep(4)
        root = dump()
    png('02_map')
    sheet = by_id(root, 'discovery-sheet-background')
    log('map state: sheet', bounds(sheet[0]['bounds']) if sheet else None, 'cards', len(cards(root)), 'list-count button', bool(by_id(root, 'list-count')))
    tried = []
    target = None
    for _ in range(12):
        root = dump()
        seen = pins(root)
        found = sorted((p for p in seen if not any(abs(p['x'] - t['x']) < 40 and abs(p['y'] - t['y']) < 40 for t in tried)), key=lambda p: p['n'])   # single markers (rings) before clusters (solid discs)
        log('markers on screen', len(seen), 'not yet tried', len(found))
        if not found:
            break
        p = found[0]
        tried.append(p)
        tap(p['x'], p['y'], 140)
        time.sleep(3)
        root = dump()
        if peek_title(root):
            target = p
            break
        if by_desc(root, contains='Prikaži sve u listi'):
            close_peek()
        else:
            tried.clear()
    if target is None:
        check('MAP_HAS_A_TASK_BUCKET_TO_TIME', False, tried=len(tried))
        return
    png('03_peek')
    close_peek()
    m = LOG.mark()
    gfx_reset()
    shown, moved = 0, []
    slow_frames, seen_vsyncs = [], set()
    for i in range(ARGS.taps):
        if ARGS.quiet_pins:
            tap(target['x'], target['y'], 140)
            time.sleep(2.2)
            for frame in framestats_slow(seen_vsyncs):
                slow_frames.append({'tap': i + 1, **frame})
            back()                                                     # Android Back closes the card
            time.sleep(1.4)
            shown += 1
            continue
        tap(target['x'], target['y'], 140)
        root, _ = None, None
        got, root = poll(lambda r: peek_title(r), 20, 0.3)
        if not got:
            close_peek()
            continue
        shown += 1
        time.sleep(1.6)                                                # EX-03: the card's first frame (about 1.1 s in the quiet-database BEFORE run) is over; what it was made of is in the frame ring
        for frame in framestats_slow(seen_vsyncs):
            slow_frames.append({'tap': i + 1, **frame})
        if i < 3:
            time.sleep(1.0)                                            # the card slides in first: it is judged once it has come to rest
            settled = dump()
            first = [bounds(a['bounds']) for a in by_desc(settled, prefix='Otvori zadatak: ')][:1]
            time.sleep(1.2)
            later = dump()
            second = [bounds(a['bounds']) for a in by_desc(later, prefix='Otvori zadatak: ')][:1]
            moved.append(max(abs(a - b) for a, b in zip(first[0], second[0])) if first and second else None)
        close_peek()
    time.sleep(2)
    text = LOG.since(m)
    PHASE_GFX['pins'] = gfx_read('pins')
    pairs = [(int(a), int(b)) for a, b in PIN.findall(text)]
    fb, content = [a for a, _ in pairs], [b for _, b in pairs]
    summary = {'touches': ARGS.taps, 'peekShown': shown, 'traced': len(pairs),
               'firstFeedbackMs': {'p50': percentile(fb, .5), 'p95': percentile(fb, .95), 'max': max(fb, default=None)},
               'usableContentMs': {'p50': percentile(content, .5), 'p95': percentile(content, .95), 'max': max(content, default=None)},
               'peekMovedPxAfterAppearing': moved, 'slowFramesOver500ms': slow_frames,
               'conditions': f'{REPORT["label"]}: {DEV.kind} {PROFILE.get("model", "")} against the canonical DEV backend; JS-side clock: touch handled -> halo committed -> card data committed'}
    REPORT['pinTiming'] = summary
    check('PIN_TIMING_MEASURED', len(pairs) >= max(3, int(ARGS.taps * .9)), **summary)
    measured = [m for m in moved if m is not None]
    if ARGS.quiet_pins:
        skip('PEEK_DOES_NOT_MOVE_AFTER_IT_APPEARS', 'quiet pins: no UI dump while a card is open, so its place is not read')
    else:
        check('PEEK_DOES_NOT_MOVE_AFTER_IT_APPEARS', len(measured) >= 2 and max(measured) <= 4, movedPx=moved)


SETTLED = re.compile(r'\[USKOCI_P6_TRACE\] \["settled","(OWN_CLUSTER|OWN_MOVE|QUIET_MOVE)"\]')


def map_rows(root):
    """The rows of the map no chrome covers (under the quick chips, above the list sheet): the band a drag can start in."""
    _w, h, _px = screen()
    top, bottom = int(h * 0.18), int(h * 0.76)
    chips = by_desc(root, exact='Brzi filteri')
    if chips:
        top = bounds(chips[0]['bounds'])[3] + 6
    sheet = by_id(root, 'discovery-sheet-background')
    if sheet:
        bottom = bounds(sheet[0]['bounds'])[1] - 6
    return top, max(top + 1, bottom)


def gestures():
    """P6-11 pan and zoom on the real map (a pinch cannot be sent through adb, and the map has no zoom buttons any more): a drag and a double tap (zooms in) settle to the reader's own
    trace line, and the screen keeps its list line and shows no error."""
    root = to_map(dump())
    png('04_before_gestures')
    top, bottom = map_rows(root)
    y = (top + bottom) // 2
    steps = [('PAN', lambda: send_input('touchscreen', 'swipe', str(int(W * 0.76)), str(y), str(int(W * 0.28)), str(y - int(H * 0.025)), '700')),
             # both taps in one shell command, so they land inside the double-tap window
             ('DOUBLE_TAP_ZOOM_IN', lambda: adb('shell', f'input tap {int(W * 0.5)} {y}; input tap {int(W * 0.5)} {y}'))]
    gfx_reset()
    for name, act in steps:
        m = LOG.mark()
        act()
        time.sleep(6)
        text = LOG.since(m)
        settled = SETTLED.findall(text)
        root = dump()
        png('05_after_' + name.lower())
        if ARGS.reader == 'p6':
            check(f'{name}_SETTLES_TO_A_READ', bool(settled), settled=settled)
        else:
            skip(f'{name}_SETTLES_TO_A_READ', 'legacy reader: the build has no P6 trace lines')
        check(f'{name}_KEEPS_THE_TOP_LINE_AND_SHOWS_NO_ERROR', bool(by_id(root, 'list-count') or by_id(root, 'list-count-words'))
              and not by_desc(root, contains='nisu dostupni') and not [a for a in attrs(root) if 'nisu dostupni' in (a.get('text') or '')])
    PHASE_GFX['gestures'] = gfx_read('gestures')
    # The map's area is the person's own move and is remembered with the view: take it away, so the next phase starts from the whole list.
    clear = by_id(dump(), 'clear-where')
    if clear:
        tap_node(clear[0])
        time.sleep(4)


def cycles():
    root = reset_view()
    if not cards(root):
        root = dump()
    mem = [{'tag': 'before', 'kb': pss_kb(), 'pid': pid()}]
    returns, restored, ok_all = [], [], True
    gfx_reset()
    cycles_mark = LOG.mark()
    for i in range(1, ARGS.cycles + 1):
        root = dump()
        cs = cards(root)
        if not cs:
            check(f'CYCLE_{i:02d}_HAS_CARDS', False)
            ok_all = False
            break
        pick = cs[1] if len(cs) > 1 and visible_fraction(root, cs[1]['b']) >= 0.5 else cs[0]      # the second card when at least half of it can be seen, else the first
        target = visible_tap_point(root, pick['b'])
        tap(*target)
        detail, _ = poll(lambda r: not by_id(r, 'list-count-words') and not by_id(r, 'list-count') and any(pick['title'] in (a.get('content-desc', '') + a.get('text', '')) for a in attrs(r)), 20, 0.3)
        if not detail:
            errors_now = error_text(dump())
            if errors_now:                                         # the detail screen IS open and shows its own error state: record it, and Back leaves it
                png(f'cycle_{i:02d}_detail_read_failed')
                REPORT.setdefault('detailReadErrors', []).append({'cycle': i, 'title': pick['title'], 'texts': errors_now[:3], 'at': time.strftime('%H:%M:%S')})
                check(f'CYCLE_{i:02d}_DETAIL_READ_FAILED', False, title=pick['title'], texts=errors_now[:3])
                ok_all = False
                back()
                poll(lambda r: cards(r), 30, 0.5)
                reset_view()
                continue
            # a Back now would leave the Zadaci screen: record the moment and put the list back instead
            png(f'cycle_{i:02d}_detail_did_not_open')
            check(f'CYCLE_{i:02d}_DETAIL_OPENED', False, title=pick['title'], tapped=list(target), card=list(pick['b']))
            ok_all = False
            reset_view()
            continue
        time.sleep(0.8)
        started = time.time()
        mark = LOG.mark()
        pressed = timed_back()
        got, root = poll(lambda r: any(c['title'] == pick['title'] for c in cards(r)), 30, 0.25)
        returns.append(round(time.time() - started, 2) if got else None)
        restored.append(restored_after(pressed, mark) if got and ARGS.reader == 'p6' else None)
        ok_all = ok_all and bool(detail) and bool(got)
        if i in (1, 5, ARGS.cycles // 2, 15, ARGS.cycles):
            mem.append({'tag': f'cycle_{i}', 'kb': pss_kb(), 'pid': pid()})
    PHASE_GFX['cycles'] = gfx_read('cycles')
    time.sleep(10)
    mem.append({'tag': 'final_after_idle', 'kb': pss_kb(), 'pid': pid()})
    done = [r for r in returns if r is not None]
    js = [r for r in restored if r is not None]
    REPORT['cycles'] = {'n': ARGS.cycles, 'returnsS': returns, 'restoredAfterBackS': restored, 'mem': mem,
                        'returnP50S': percentile(done, .5), 'returnP95S': percentile(done, .95), 'returnMaxS': max(done, default=None),
                        'restoredP50S': percentile(js, .5), 'restoredP95S': percentile(js, .95), 'restoredMaxS': max(js, default=None),
                        'warmReturns': len(WARM.findall(LOG.since(cycles_mark))),
                        'note': 'returnsS: Back -> cards seen by a UI dump (includes the dump itself); restoredAfterBackS: Back -> the screen\'s own restored trace line (device clock)'}
    check('EVERY_CYCLE_OPENED_AND_RETURNED', ok_all and len(done) == ARGS.cycles, returns=len(done))
    pids = {m['pid'] for m in mem if m['pid']}
    check('APP_PROCESS_SURVIVED_CYCLES', len(pids) == 1, pids=sorted(pids))
    kb = {m['tag']: m['kb'] for m in mem if m['kb'] > 0}
    warm = kb.get('cycle_5') or kb.get('cycle_1')
    if warm and kb.get('final_after_idle'):
        # Baseline (cold), the warmed-up level after five cycles, the peak and the level after ten idle seconds: growth is judged from the warmed-up level.
        check('NO_MEMORY_ACCUMULATION_OVER_THE_CYCLES', kb['final_after_idle'] <= warm * 1.15 + 10000, baseline_kb=kb.get('before'), warm_kb=warm,
              peak_kb=max(kb.values()), final_kb=kb['final_after_idle'])


def frame_signature(px, w, h):
    """A coarse luminance grid of the list area of a raw RGBA frame (about 1,300 samples): cheap enough to compare a few frames per second."""
    sig = []
    for y in range(int(h * 0.25), int(h * 0.85), 40):
        row = y * w * 4
        for x in range(20, w, 48):
            i = row + x * 4
            sig.append((px[i] * 3 + px[i + 1] * 6 + px[i + 2]) // 10)
    return sig


def sig_distance(a, b):
    return sum(abs(p - q) for p, q in zip(a, b)) / max(1, len(a))


def visible_return():
    """Back -> the list is back on the SCREEN. The accessibility tree is not used while it is measured (its dump waits for the UI to settle and would delay the answer): after the Back a burst of
    screenshots is compared with the picture of the same list before the task was opened; the answer is the first frame that matches it (and the next one still does), counted from just
    before the key is injected on the same clock. A frame is taken about every 0.3 s, and the screenshot itself is a little behind the display, so the number is an upper bound with about that resolution."""
    out = []
    root = reset_view()
    w, h, px = screen()
    ref = frame_signature(px, w, h)
    for i in range(1, ARGS.visible_return + 1):
        cs = cards(root)
        if not cs:
            check(f'VISIBLE_RETURN_{i:02d}_HAS_CARDS', False)
            break
        pick = cs[1] if len(cs) > 1 and visible_fraction(root, cs[1]['b']) >= 0.5 else cs[0]
        tap(*visible_tap_point(root, pick['b']))
        detail, _ = poll(lambda r: not by_id(r, 'list-count-words') and not by_id(r, 'list-count') and any(pick['title'] in (a.get('content-desc', '') + a.get('text', '')) for a in attrs(r)), 20, 0.3)
        if not detail:
            out.append({'i': i, 'openedDetail': False})
            reset_view()
            continue
        time.sleep(1.0)
        w, h, px = screen()
        away = sig_distance(frame_signature(px, w, h), ref)              # how far the detail screen is from the list
        guard()
        t0 = time.time()
        adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        frames = []
        while time.time() - t0 < 6.0:
            w, h, px = screen()
            frames.append((round(time.time() - t0, 3), round(sig_distance(frame_signature(px, w, h), ref), 2)))
        near = max(3.0, away * 0.2)
        seen = next((t for k, (t, dist) in enumerate(frames[:-1]) if dist <= near and frames[k + 1][1] <= near), None)
        out.append({'i': i, 'openedDetail': True, 'awayDistance': round(away, 2), 'visibleAfterS': seen, 'frames': len(frames), 'firstFramesS': [f[0] for f in frames[:3]]})
        time.sleep(1.5)
        root = dump()
        if not cards(root):
            root = reset_view()
    REPORT['visibleReturn'] = out
    seen = [o['visibleAfterS'] for o in out if o.get('visibleAfterS') is not None]
    REPORT['visibleReturnSummary'] = {'n': len(seen), 'p50S': percentile(seen, .5), 'p95S': percentile(seen, .95), 'maxS': max(seen, default=None)}
    check('VISIBLE_RETURN_MEASURED', len(seen) >= max(3, int(ARGS.visible_return * 0.8)), **REPORT['visibleReturnSummary'])


def poll_or_now(pred, timeout=30, interval=0.4):
    """Like poll(), but a timeout returns (None, the tree as it is now) so that the caller can look at the screen it is on."""
    got, root = poll(pred, timeout, interval)
    return (got, root) if got else (None, dump())


def ime_visible():
    return 'mInputShown=true' in adb('shell', 'dumpsys input_method | grep -m1 mInputShown', timeout=30)


def hide_keyboard():
    if ime_visible():
        send_input('keyevent', 'KEYCODE_BACK')            # the first Back only closes the keyboard
        time.sleep(1.0)


def focused_edit(root):
    return next((a for a in attrs(root) if a.get('class') == 'android.widget.EditText' and a.get('focused') == 'true'), None)


def type_text(text):
    """Letters and digits into the focused text field of the app under test (the guard has already checked who has the screen): nothing is typed unless a field of the app is focused."""
    assert re.fullmatch(r'[A-Za-z0-9]+', text), 'ASCII letters and digits only (adb input text)'
    root = dump()
    if not focused_edit(root):
        fields = [a for a in attrs(root) if a.get('class') == 'android.widget.EditText']
        if not fields:
            raise RuntimeError('no text field to type into')
        tap_node(fields[0])
        time.sleep(1.0)
        if not focused_edit(dump()):
            raise RuntimeError('the text field did not take focus')
    send_input('text', text)


def first_int(text):
    m = re.search(r'\d+', text or '')
    return int(m.group(0)) if m else None


def search_flow():
    """The search as a person uses it (the approved plan of 8 Oct 2026, U4): it fills the screen, the field "Šta tražiš" on top and "Gde" under it. Read the places and their counts, choose the first (a place is the end of the search: it applies at once) and check the list says the same count; then type one word, read what the green action promises, apply it, and put the search back to what it was."""
    word = ARGS.search
    root = reset_view()
    bar = by_desc(root, prefix='Pretraži zadatke')
    if not bar:
        check('SEARCH_BAR_FOUND', False)
        return
    before_label, before_count = bar[0].get('content-desc'), count_shown(root)
    m = LOG.mark()
    t0 = time.time()
    tap_node(bar[0])
    got, root = poll_or_now(lambda r: [a for a in attrs(r) if a.get('class') == 'android.widget.EditText'], 20, 0.5)
    check('SEARCH_OPENS_WITH_A_TEXT_FIELD', bool(got), openedS=round(time.time() - t0, 2))
    png('20_search_open')
    REPORT['search'] = {'word': word, 'barBefore': before_label, 'countBefore': before_count}
    if not got:
        return
    hide_keyboard()
    root = dump()
    # the places: rows that say their count ("Novi Sad, 23 zadatka"); "Svi zadaci" and "Na daljinu" are the first two rows and not places
    suggestions = [a for a in attrs(root) if a.get('clickable') == 'true' and re.search(r', \d+ zadat', a.get('content-desc') or '')
                   and not (a.get('content-desc') or '').startswith(('Svi zadaci', 'Na daljinu', 'Pretraži', 'Prikaži', 'Skorašnje'))]
    labels = [a.get('content-desc') for a in suggestions][:6]
    REPORT['search']['suggestions'] = labels
    check('SEARCH_OFFERS_A_PLACE_WITH_A_COUNT', bool(suggestions), suggestions=labels)
    png('21_search_places')
    if suggestions:
        t1 = time.time()
        tap_node(suggestions[0])
        got, root = poll_or_now(lambda r: (by_id(r, 'list-count-words') or by_id(r, 'list-count')) and not [a for a in attrs(r) if a.get('class') == 'android.widget.EditText'], 30, 0.5)
        applied = count_shown(root) if got else None
        REPORT['search']['appliedS'] = round(time.time() - t1, 2)
        REPORT['search']['countApplied'] = applied
        png('22_search_place_applied')
        check('SEARCH_COUNT_MATCHES_THE_PLACE_ROW', applied is not None and applied == first_int(re.sub(r'^[^,]*,\s*', '', labels[0]).split(',')[-1]), place=labels[0], list=applied)
    # the pill's own x takes the place away; then the same search is opened again for one word
    if by_id(dump(), 'clear-where'):
        tap_node(by_id(dump(), 'clear-where')[0])
        time.sleep(3)
    root = reset_view()
    bar = by_desc(root, prefix='Pretraži zadatke')
    if bar:
        tap_node(bar[0])
        got, root = poll_or_now(lambda r: [a for a in attrs(r) if a.get('class') == 'android.widget.EditText'], 20, 0.5)
        if got:
            type_text(word)
            time.sleep(3)
            hide_keyboard()
            root = dump()
            png('23_search_word_typed')
            show = sorted([a for a in attrs(root) if a.get('clickable') == 'true' and ((a.get('content-desc') or a.get('text') or '').startswith('Prikaži'))], key=lambda a: bounds(a['bounds'])[1])
            promise = (show[0].get('content-desc') or show[0].get('text')) if show else None
            REPORT['search']['wordApplyLabel'] = promise
            if show:
                t2 = time.time()
                tap_node(show[0])
                got, root = poll_or_now(lambda r: (by_id(r, 'list-count-words') or by_id(r, 'list-count')) and not [a for a in attrs(r) if a.get('class') == 'android.widget.EditText'], 30, 0.5)
                counted = count_shown(root) if got else None
                REPORT['search']['wordAppliedS'] = round(time.time() - t2, 2)
                REPORT['search']['wordCountApplied'] = counted
                png('24_search_word_applied')
                check('SEARCH_WORD_COUNT_MATCHES_THE_ACTION', counted is not None and counted == first_int(promise), action=promise, list=counted)
    REPORT['search']['logLinesSince'] = LOG.since(m).count('USKOCI_P6_TRACE')
    # put the search back: the pill's own clear button, then the whole list
    if by_id(dump(), 'clear-where'):
        tap_node(by_id(dump(), 'clear-where')[0])
        time.sleep(3)
    root = reset_view()
    bar = by_desc(root, prefix='Pretraži zadatke')
    after_label = bar[0].get('content-desc') if bar else None
    REPORT['search']['barAfter'], REPORT['search']['countAfter'] = after_label, count_shown(root)
    check('SEARCH_RESTORED_TO_THE_STATE_BEFORE', after_label == before_label and count_shown(root) == before_count, before=before_label, after=after_label, countBefore=before_count, countAfter=count_shown(root))


def filters_flow():
    """The quick capsules that need no permission: remote work and the stated amount, each toggled on and off again where the tasks have it; the count shown and the time it took to change."""
    root = reset_view()
    base = count_shown(root)
    out = {'countBefore': base, 'chips': {}}
    REPORT['filters'] = out
    for chip in ('Na daljinu', 'Sa iznosom'):
        node = by_desc(root, exact=chip)
        if not node:
            out['chips'][chip] = {'found': False}
            continue
        t0 = time.time()
        tap_node(node[0])
        got, root = poll_or_now(lambda r: count_shown(r) is not None and count_shown(r) != base, 20, 0.4)
        changed = round(time.time() - t0, 2) if got else None
        counted = count_shown(root)
        png('30_filter_' + ('remote' if 'daljinu' in chip else 'amount'))
        node = by_desc(root, exact=chip)
        if node:
            tap_node(node[0])                                       # the chip is a toggle: off again
        time.sleep(3)
        root = reset_view()
        out['chips'][chip] = {'found': True, 'countOn': counted, 'changedAfterS': changed, 'countBackAfterOff': count_shown(root)}
    found = [c for c in out['chips'].values() if c.get('found')]
    check('FILTERS_TOGGLE_AND_RETURN_TO_THE_WHOLE_LIST', bool(found) and all(c.get('countBackAfterOff') == base for c in found), chips=out['chips'], base=base)


def gfx_reset():
    """Zero the app's frame counters (a diagnostic counter of the system's frame statistics: nothing of the app or the device changes) so that the next read is ONE phase."""
    adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, 'reset')


def gfx_read(name):
    """The app's frame statistics since the last reset (frames, janky share, the frame-time percentiles and the system's own slow-frame counters), raw text kept in gfxinfo_<name>.txt."""
    text = adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, timeout=90)
    (OUT / f'gfxinfo_{name}.txt').write_text(text, encoding='utf-8')

    def num(pattern):
        m = re.search(pattern, text)
        return int(m.group(1)) if m else None
    janky = re.search(r'Janky frames:\s+(\d+) \(([\d.]+)%\)', text)
    return {'frames': num(r'Total frames rendered:\s+(\d+)'), 'janky': int(janky.group(1)) if janky else None, 'jankyPercent': float(janky.group(2)) if janky else None,
            'p50ms': num(r'50th percentile:\s+(\d+)ms'), 'p90ms': num(r'90th percentile:\s+(\d+)ms'), 'p95ms': num(r'95th percentile:\s+(\d+)ms'), 'p99ms': num(r'99th percentile:\s+(\d+)ms'),
            'missedVsync': num(r'Number Missed Vsync:\s+(\d+)'), 'highInputLatency': num(r'Number High input latency:\s+(\d+)'), 'slowUiThread': num(r'Number Slow UI thread:\s+(\d+)'),
            'slowBitmapUploads': num(r'Number Slow bitmap uploads:\s+(\d+)'), 'slowIssueDraw': num(r'Number Slow issue draw commands:\s+(\d+)'),
            'deadlineMissed': num(r'Number Frame deadline missed:\s+(\d+)')}


def framestats_slow(seen, min_ms=500):
    """EX-03: the slow frames in the app's frame ring (`dumpsys gfxinfo <pkg> framestats`, the last ~120 frames), each with its time split over the pipeline phases in ms: what waited before
    the frame started, input and animation callbacks (where React Native mounts native views), measure/layout, display-list recording, sync (bitmap uploads), the render thread's draw and
    the swap. `seen` holds the IntendedVsync values already taken, so a frame that is still in the ring at the next read is not counted twice."""
    text = adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, 'framestats', timeout=90)
    lines = text.splitlines()
    if '---PROFILEDATA---' not in lines:
        return []
    start = lines.index('---PROFILEDATA---')
    header = lines[start + 1].rstrip(',').split(',')
    col = {name: i for i, name in enumerate(header)}
    need = ('IntendedVsync', 'Vsync', 'HandleInputStart', 'AnimationStart', 'PerformTraversalsStart', 'DrawStart', 'SyncQueued', 'SyncStart', 'IssueDrawCommandsStart', 'SwapBuffers', 'FrameCompleted')
    if any(n not in col for n in need):
        return []
    out = []
    for raw in lines[start + 2:]:
        if raw.startswith('---PROFILEDATA---'):
            break
        parts = raw.rstrip(',').split(',')
        if len(parts) < len(header) or not parts[col['IntendedVsync']].lstrip('-').isdigit():
            continue
        v = {n: int(parts[col[n]]) for n in need}
        total = (v['FrameCompleted'] - v['IntendedVsync']) / 1e6
        if total < min_ms or v['IntendedVsync'] in seen:
            continue
        seen.add(v['IntendedVsync'])
        ms = lambda a, b: round((v[b] - v[a]) / 1e6)
        out.append({'totalMs': round(total), 'waitedBeforeStartMs': ms('IntendedVsync', 'Vsync'), 'inputMs': ms('HandleInputStart', 'AnimationStart'), 'animationMs': ms('AnimationStart', 'PerformTraversalsStart'),
                    'layoutMs': ms('PerformTraversalsStart', 'DrawStart'), 'recordMs': ms('DrawStart', 'SyncQueued'), 'syncMs': ms('SyncStart', 'IssueDrawCommandsStart'),
                    'renderMs': ms('IssueDrawCommandsStart', 'SwapBuffers'), 'swapMs': ms('SwapBuffers', 'FrameCompleted')})
    return out


def exit_info():
    """The system's own record of how this app's processes ended since the run began (`dumpsys activity exit-info`): ANR and crash reasons are counted, the raw text is kept."""
    raw = adb('shell', 'dumpsys', 'activity', 'exit-info', PACKAGE, timeout=90)
    (OUT / 'exit-info.txt').write_text(raw, encoding='utf-8')
    since = REPORT.get('startedDeviceTime') or ''
    counts = {'anr': 0, 'crash': 0, 'other': 0, 'records': 0}
    for block in re.split(r'\n\s*ApplicationExitInfo #\d+:', raw)[1:]:
        at = re.search(r'timestamp=(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)', block)
        if since and at and at.group(1) < since:
            continue
        counts['records'] += 1
        reason = re.search(r'reason=\d+ \(([A-Z _]+)\)', block)
        name = reason.group(1) if reason else ''
        counts['anr' if name == 'ANR' else 'crash' if name.startswith('CRASH') else 'other'] += 1
    return counts


def reset_view():
    """The whole list at full height: a map area chosen by a drag is view state and is taken away with the app's own button (`clear-where`), then the sheet is raised."""
    if by_id(dump(), 'clear-where'):
        tap_node(by_id(dump(), 'clear-where')[0])
        time.sleep(4)
    return ensure_full_list()


def list_top_in_view(root):
    words, sheet = by_id(root, 'list-count-words'), by_id(root, 'discovery-sheet-background')
    return bool(words and sheet and bounds(words[0]['bounds'])[1] <= bounds(sheet[0]['bounds'])[1] + int(H * 0.06))


def scroll_feel():
    """How the list feels under the finger, in frames: fast flings down the full list, then controlled drags back up that stop as soon as the top is in view (a drag past the top
    would pull the sheet down and the next drag would pan the MAP, changing the area filter), the frame statistics of exactly that phase, and the display's refresh rate while the
    finger moves (a phone lowers it when idle). The screen is put back to the whole list afterwards."""
    ensure_full_list()
    gfx_reset()
    rates = []
    for i in range(3):
        swipe(0.5, 0.80, 0.5, 0.30, 260)
        if i == 0:
            rates.append(qa_device.refresh_rate(adb('shell', 'dumpsys', 'display', timeout=90))[0])
        time.sleep(1.4)
    back_up = 0
    for _ in range(6):
        if list_top_in_view(dump()):
            break
        swipe(0.5, 0.35, 0.5, 0.60, 450)
        back_up += 1
        time.sleep(1.2)
    time.sleep(1.5)
    PHASE_GFX['scroll'] = gfx_read('scroll')
    root = dump()
    REPORT['scroll'] = {'flings': 3, 'dragsBackUp': back_up, 'refreshHzDuringInput': rates}
    check('LIST_SURVIVES_FLINGS_WITH_ITS_TOP_LINE', bool(by_id(root, 'list-count') or by_id(root, 'list-count-words')) and not error_text(root), errors=error_text(root)[:3])
    reset_view()


def verdict():
    """The runbook's initial engineering targets, RECORDED next to the measured values (never relaxed, and never a pass or fail of this script): touch feedback p95 <= 100 ms, loaded
    pin -> card p95 <= 200 ms (excluding a separate network read), warm return p95 <= 350 ms. The card time measured here includes the exact read over the network: an upper bound."""
    pin, cyc = REPORT.get('pinTiming'), REPORT.get('cycles')
    out = {}
    if pin and pin['firstFeedbackMs']['p95'] is not None:
        out['feedbackP95Ms'] = {'target': 100, 'measured': pin['firstFeedbackMs']['p95'], 'met': pin['firstFeedbackMs']['p95'] <= 100}
        out['pinToCardWithExactReadP95Ms'] = {'target': 200, 'measured': pin['usableContentMs']['p95'], 'met': pin['usableContentMs']['p95'] <= 200,
                                              'note': 'includes the exact read over the network; the runbook target excludes a separate network read, so this is an upper bound'}
    if cyc and cyc.get('restoredP95S') is not None:
        out['warmReturnP95Ms'] = {'target': 350, 'measured': round(cyc['restoredP95S'] * 1000), 'met': cyc['restoredP95S'] * 1000 <= 350}
    REPORT['runbookTargets'] = out
    REPORT['runbookTargetsNote'] = (f"{REPORT['label']} ({DEV.kind}): the runbook states these targets for the agreed reference phone; an emulator's numbers never certify a phone, "
                                    'and a phone number is only as good as the build that produced it (report.device.app)')


def health():
    text = LOG.since(0)
    system = '\n'.join(line for line in LOG.since(0, system=True).splitlines() if PACKAGE in line)      # ActivityManager / crash lines about THIS package only
    exits = exit_info()
    davey = [int(m) for m in re.findall(r'Davey! duration=(\d+)ms', text)]
    counts = {'anr': len(re.findall(r'ANR in ' + re.escape(PACKAGE), system)),
              'fatal': len(re.findall(r'FATAL EXCEPTION', text)),
              'died': len(re.findall(r'Process ' + re.escape(PACKAGE) + ' \\(pid \\d+\\) has died', system)),
              'exitInfoAnr': exits['anr'], 'exitInfoCrash': exits['crash'],
              'daveyOver700ms': sum(1 for d in davey if d >= 700), 'daveyMaxMs': max(davey, default=0),
              'reanimatedDeadTagLines': len(re.findall(r'synchronouslyUpdateUIProps failed', text)),
              'p6ReadFailed': len(re.findall(r'\[USKOCI_P6_TRACE\] \["(?:read-failed|restore-failed)"', text)),
              'viewToBitmapErrors': len(re.findall(r'viewToBitmap', text))}
    REPORT['health'] = counts
    check('NO_ANR_OR_CRASH', counts['anr'] == 0 and counts['fatal'] == 0 and counts['died'] == 0 and counts['exitInfoAnr'] == 0 and counts['exitInfoCrash'] == 0, **counts)
    check('NO_P6_READ_FAILURE_IN_THE_LOG', counts['p6ReadFailed'] == 0, count=counts['p6ReadFailed'])
    (OUT / 'logcat-tail.txt').write_text('\n'.join(text.splitlines()[-4000:]), encoding='utf-8')
    (OUT / 'logcat-p6.txt').write_text('\n'.join(l for l in text.splitlines() if 'USKOCI_P6_TRACE' in l or 'USKOCI_DISCOVERY_TRACE' in l), encoding='utf-8')
    REPORT['gfxPhases'] = PHASE_GFX
    frames = sum(p['frames'] or 0 for p in PHASE_GFX.values())
    janky = sum(p['janky'] or 0 for p in PHASE_GFX.values())
    REPORT['gfx'] = {'frames': frames, 'janky': janky, 'jankyPercent': round(100 * janky / frames, 1) if frames else None,
                     'note': 'summed over the measured phases (the counters are reset at the start of each phase)'}
    REPORT['exitInfo'] = exits


class Recording:
    """A screen recording of one phase (the device's recorder stops after 170 s, so a long phase shows its first minutes): pulled to OUT/video_<name>.mp4."""
    def __init__(self, name):
        self.name, self.proc = name, None

    def __enter__(self):
        if ARGS.video:
            self.proc = subprocess.Popen(ADB + ['shell', 'screenrecord', '--time-limit', '170', '--bit-rate', '3000000', '--size', f'{W // 2}x{H // 2}', f'/sdcard/p6chk_{self.name}.mp4'],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1.5)
        return self

    def __exit__(self, *_exc):
        if self.proc is not None:
            adb('shell', 'pkill', '-2', 'screenrecord')
            time.sleep(2.5)
            subprocess.run(ADB + ['pull', f'/sdcard/p6chk_{self.name}.mp4', str(OUT / f'video_{self.name}.mp4')], capture_output=True)
            adb('shell', 'rm', '-f', f'/sdcard/p6chk_{self.name}.mp4')
        return False


ERROR_WORDS = ('nisu dostupni', 'nije dostupn', 'pokušaj ponovo', 'greška', 'nije uspelo', 'nešto nije u redu', 'došlo je do problema')


def error_text(root):
    found = []
    for a in attrs(root):
        for value in (a.get('text'), a.get('content-desc')):
            if value and any(word in value.lower() for word in ERROR_WORDS):
                found.append(value[:90])
    return found


def press_tab(name):
    """A tab of the bottom navigation. On Zadaci the navigation is away while the list rests at its top line and comes back with the half height (the owner's phone, 8 Oct 2026),
    so a tab that is not on screen is looked for again after the list has been raised by its own handle."""
    for attempt in range(2):
        root = dump()
        for a in attrs(root):
            if (a.get('content-desc') == name or a.get('text') == name) and a.get('clickable') == 'true' and int(H * 0.82) < bounds(a['bounds'])[1] < H:
                tap_node(a)
                return True
        handle = by_id(root, 'list-count')
        if attempt or not handle:
            break
        tap_node(handle[0])
        time.sleep(1.2)
    return False


def press_row(word):
    root = dump()
    for a in attrs(root):
        label = (a.get('content-desc') or '') + ' ' + (a.get('text') or '')
        if word in label and a.get('clickable') == 'true':
            tap_node(a)
            return True
    swipe(0.5, 0.70, 0.5, 0.371, 400)
    time.sleep(1.2)
    for a in attrs(dump()):
        label = (a.get('content-desc') or '') + ' ' + (a.get('text') or '')
        if word in label and a.get('clickable') == 'true':
            tap_node(a)
            return True
    return False


def smoke():
    """An older client's reads (Home, the task list and detail, my applications, agreements) after a database change: nothing may show an error."""
    launch(restart=True)
    time.sleep(4)
    steps = [('HOME', lambda: press_tab('Početna')), ('ZADACI_TAB', lambda: press_tab('Zadaci')), ('DOGOVORI_TAB', lambda: press_tab('Dogovori'))]
    for name, act in steps:
        ok = act()
        time.sleep(7)
        root = dump()
        png('10_smoke_' + name.lower())
        check(f'SMOKE_{name}_OPENS_WITHOUT_AN_ERROR', ok and not error_text(root), reached=ok, errors=error_text(root)[:3])
    press_tab('Početna')
    time.sleep(6)
    for word, name in (('Moji zadaci', 'MOJI_ZADACI'), ('Moje prijave', 'MOJE_PRIJAVE')):
        press_tab('Početna')
        time.sleep(4)
        ok = press_row(word)
        time.sleep(7)
        root = dump()
        png('11_smoke_' + name.lower())
        errors = error_text(root)
        check(f'SMOKE_{name}_OPENS_WITHOUT_AN_ERROR', ok and not errors, reached=ok, errors=errors[:3])
        if name == 'MOJI_ZADACI' and ok:
            card = [a for a in attrs(root) if (a.get('content-desc') or '').startswith('Otvori') and a.get('clickable') == 'true']
            if card:
                tap_node(card[0])
                time.sleep(7)
                detail = dump()
                png('12_smoke_task_detail')
                check('SMOKE_TASK_DETAIL_OPENS_WITHOUT_AN_ERROR', not error_text(detail), errors=error_text(detail)[:3])
                back()
                time.sleep(3)
        back()
        time.sleep(3)


def main():
    global LOG, PROFILE
    try:
        PROFILE = DEV.profile(PACKAGE)
        REPORT['device'] = PROFILE
        REPORT['startedDeviceTime'] = DEV.now_iso()
        REPORT['startedUtc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        app = PROFILE.get('app') or {}
        log('device', DEV.serial, DEV.kind, PROFILE.get('manufacturer'), PROFILE.get('model'), 'android', PROFILE.get('android'), PROFILE.get('abi'), PROFILE.get('screenPx'),
            'app', app.get('versionName'), app.get('versionCode'), (app.get('apkSha256') or '')[:16])
        if not app.get('installed'):
            raise RuntimeError(f'{PACKAGE} is not installed on {DEV.serial}')
        if ARGS.expect_apk_sha256:
            check('INSTALLED_APK_IS_THE_BUILT_ARTIFACT', (app.get('apkSha256') or '') == ARGS.expect_apk_sha256.lower(), installed=app.get('apkSha256'), expected=ARGS.expect_apk_sha256.lower())
            if not passed():
                raise RuntimeError('the installed APK is not the one that was built')
        LOG = qa_device.LogStream(DEV, OUT / 'device-log-app.txt', uid=app.get('uid')).start()
        if ARGS.smoke:
            smoke()
            REPORT['result'] = 'PASS' if passed() else 'FAIL'
            return
        launch(restart=True)
        if ARGS.only_pins:
            time_pins()
            REPORT['result'] = 'PASS' if passed() else 'FAIL'
            return
        read_list()
        if ARGS.only_list:
            REPORT['result'] = 'PASS' if passed() else 'FAIL'
            return
        if ARGS.only_flows:
            if ARGS.visible_return:
                visible_return()
            if ARGS.filters:
                filters_flow()
            if ARGS.search:
                search_flow()
            traced = LOG.since(0).count('USKOCI_P6_TRACE')
            REPORT['readerObserved'], REPORT['p6TraceLines'] = ('P6' if traced else 'LEGACY'), traced
            REPORT['result'] = 'PASS' if passed() else 'FAIL'
            return
        with Recording('pins'):
            time_pins()
        if not ARGS.focused:
            gestures()
            if ARGS.restart:
                adb('shell', 'am', 'force-stop', PACKAGE)
                launch()
        read_list()
        if ARGS.focused and ARGS.visible_return:
            visible_return()                                           # EX-03: the return as the screen shows it (a screenshot burst, no UI dump), the pixel measure the JS clock is not
        if not ARGS.focused:
            scroll_feel()
            if ARGS.visible_return:
                visible_return()
            if ARGS.filters:
                filters_flow()
            if ARGS.search:
                search_flow()
        with Recording('cycles'):
            cycles()
        health()
        verdict()
        traced = LOG.since(0).count('USKOCI_P6_TRACE')
        REPORT['readerObserved'] = 'P6' if traced else 'LEGACY'
        REPORT['p6TraceLines'] = traced
        check('P6_READER_IS_RUNNING' if ARGS.reader == 'p6' else 'LEGACY_READER_IS_RUNNING', (traced > 0) == (ARGS.reader == 'p6'), p6TraceLines=traced)
        REPORT['result'] = 'PASS' if passed() else 'FAIL'
    except BaseException as exc:                                          # noqa: BLE001 - always leave a report behind
        REPORT['error'] = f'{type(exc).__name__}: {str(exc)[:400]}'
        REPORT['result'] = 'FAIL'
        raise
    finally:
        try:
            REPORT['guardedInputs'] = GUARDED['inputs']
            REPORT['deviceEnd'] = {'battery': DEV.battery(), 'thermal': DEV.thermal(), 'deviceTime': DEV.now_iso()}
        except Exception:                                                 # noqa: BLE001 - a device that went away must not hide the report
            pass
        if LOG is not None:
            LOG.stop()
        (OUT / 'report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        log('RESULT', REPORT['result'])

if __name__ == '__main__':
    main()
    sys.exit(0 if REPORT['result'] == 'PASS' else 1)
