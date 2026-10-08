#!/usr/bin/env python3
"""Current W03 native composer/readback/human review on exact local SQL106.
Actual Auth, client, handler and SQL; synthetic model, hosted gateway unproven.
Reuses PR59 physical input/visibility helpers, without unrelated old journeys.
"""
import ast
from datetime import datetime
from decimal import Decimal
import json
import math
import os
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo


def load_shared_helpers():
    source = Path(__file__).with_name('ru5_android_device_ui_journey.py')
    definitions = ast.Module(body=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                                  if isinstance(node, ast.FunctionDef)], type_ignores=[])
    exec(compile(definitions, str(source), 'exec'), globals())
    source = Path(__file__).with_name('intent_shell_android_journey.py')
    allowed = {'screen_size', 'labels', 'assert_shell_tree', 'assert_shell'}
    definitions = ast.Module(body=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                                  if isinstance(node, ast.FunctionDef) and node.name in allowed], type_ignores=[])
    exec(compile(definitions, str(source), 'exec'), globals())


def inside(bounds, container):
    return (container[0] <= bounds[0] < bounds[2] <= container[2]
            and container[1] <= bounds[1] < bounds[3] <= container[3])


def visible_node(node, parent, width, height):
    if not node.attrib.get('bounds'):
        return False
    bounds = parse_bounds(node.attrib.get('bounds'))
    if not inside(bounds, (0, 0, width, height)):
        return False
    ancestor = parent.get(node)
    while ancestor is not None:
        if ancestor.attrib.get('scrollable') == 'true' and not inside(bounds, parse_bounds(ancestor.attrib.get('bounds'))):
            return False
        ancestor = parent.get(ancestor)
    return True


def assert_button(root, parent, label, enabled):
    nodes = [node for node in root.iter() if node.attrib.get('content-desc') == label]
    if len(nodes) != 1:
        raise AssertionError(f'Expected one actual labelled control: {label}')
    node = nodes[0]
    if node.attrib.get('enabled') != str(enabled).lower():
        raise AssertionError(f'Actual control enabled state differs: {label}')
    if enabled and clickable_for(node, parent) is None:
        raise AssertionError(f'Enabled control is not actionable: {label}')
    return node


def anchor_criteria(anchor):
    # Conversation heading belongs to its scroll content. The real input stays
    # visible below it, so scrolling never depends on an offscreen heading.
    if anchor == 'Novi zadatak':
        return {'desc': 'Poruka za AI'}
    return {'desc': 'Prijavi se'} if anchor == 'Auth entry' else {'text': anchor}


def clean_surface(anchor):
    root, parent = wait_surface(timeout=60, **anchor_criteria(anchor))
    # A real app ANR is a failure. Only the existing helper may recover the
    # explicitly known launcher/System UI starvation dialog.
    if any("isn't responding" in value or 'ne reaguje' in value for value in labels(root)):
        raise AssertionError('ANR visible on required app surface')
    return root, parent


def scroll_once(root, direction, distance=None):
    choices = [parse_bounds(n.attrib.get('bounds')) for n in root.iter()
               if n.attrib.get('scrollable') == 'true']
    if not choices:
        raise AssertionError('Required content not visible and no actual scroll surface exists')
    x1, y1, x2, y2 = max(choices, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    if x2 <= x1 or y2 - y1 < 100:
        raise AssertionError('Invalid physical scroll bounds')
    x, high, low = (x1 + x2) // 2, y1 + (y2 - y1) // 5, y2 - (y2 - y1) // 5
    maps = [parse_bounds(n.attrib.get('bounds')) for n in root.iter()
            if matches(n, desc='Mapa predložene lokacije') and n.attrib.get('bounds')]
    if maps:
        # A swipe beginning on MapLibre pans its camera instead of the form.
        # Use the observed outer gutter; never change the neutral map camera.
        assert len(maps) == 1, 'Ambiguous map while scrolling the location form'
        left, _, right, _ = maps[0]
        gaps = [(x1, min(left, x2)), (max(right, x1), x2)]
        start_x, end_x = max(gaps, key=lambda gap: gap[1] - gap[0])
        assert end_x > start_x, 'No observed outer scroll gutter beside the map'
        x = (start_x + end_x) // 2
        assert x1 < x < x2 and (x < left or x > right)
    start, end = (low, high) if direction == 'down' else (high, low)
    if distance is not None:
        assert distance > 0
        amount = min(round(distance), low - high)
        assert amount > 0
        end = start - amount if direction == 'down' else start + amount
    adb('shell', 'input', 'touchscreen', 'swipe', str(x), str(start), str(x), str(end), '450')
    time.sleep(0.5)


def complete_fact_row(node, parent, width, height):
    """Android can clip a button to 28px while its text bounds are inverted."""
    if not visible_node(node, parent, width, height):
        return False
    texts = [child for child in node.iter() if child.attrib.get('text')]
    return bool(texts) and all(visible_node(child, parent, width, height)
                               and inside(parse_bounds(child.attrib.get('bounds')), parse_bounds(node.attrib.get('bounds')))
                               for child in texts)


def seek(anchor, *, text=None, desc=None, direction='down', attempts=28, enabled=None, complete_row=False):
    """Scroll only the observed real surface; return the same asserted XML tree."""
    for _ in range(attempts):
        root, parent = clean_surface(anchor)
        candidates = [n for n in root.iter() if matches(n, text=text, desc=desc)]
        visible = complete_fact_row if complete_row else visible_node
        found = [n for n in candidates if visible(n, parent, *screen_size())]
        if found:
            if len(found) != 1:
                raise AssertionError(f'Ambiguous visible content text={text} desc={desc}')
            if enabled is not None and found[0].attrib.get('enabled') != str(enabled).lower():
                # DB acknowledgment may precede the subsequent real UI read.
                # Wait on this same control, without scrolling or tapping it.
                time.sleep(0.5)
                continue
            return root, parent, found[0]
        observed_direction = direction
        if len(candidates) == 1 and candidates[0].attrib.get('bounds'):
            node = candidates[0]
            bounds = parse_bounds(node.attrib.get('bounds'))
            if complete_row:
                clipped_text = [child for child in node.iter() if child.attrib.get('text')
                                and not visible_node(child, parent, *screen_size())]
                if clipped_text:
                    bounds = parse_bounds(clipped_text[0].attrib.get('bounds'))
            ancestor = parent.get(node)
            while ancestor is not None:
                if ancestor.attrib.get('scrollable') == 'true':
                    clip = parse_bounds(ancestor.attrib.get('bounds'))
                    # Android may report inverted bounds for a clipped node.
                    # Run34125911445 retained Review's bottom position after
                    # Back: People was [353,307][655,269], above clip y=307.
                    if bounds[3] <= clip[1] or bounds[1] < clip[1]:
                        observed_direction = 'up'
                    elif bounds[1] >= clip[3] or bounds[3] > clip[3]:
                        observed_direction = 'down'
                    break
                ancestor = parent.get(ancestor)
        scroll_once(root, observed_direction)
    raise AssertionError(f'Required content did not become visible text={text} desc={desc}')


def press_in_review(label, *, direction='down'):
    if label in ('Potvrdite', 'Izmenite', 'Sačuvaj ispravku'):
        raise AssertionError('Fact action requires an explicit observed row binding')
    root, parent, node = seek('Proverite Zadatak', desc=label, direction=direction, enabled=True)
    assert_button(root, parent, label, True)
    tap_node(node, parent, hold_ms=120)


def capture(name, anchor):
    clean_surface(anchor)
    shot(name)
    # Validate the exact saved XML as well, not a later unrecorded dump.
    root = ET.parse(ARTIFACT_DIR / f'{name}.xml').getroot()
    if not any(matches(node, **anchor_criteria(anchor)) for node in root.iter()):
        raise AssertionError('Captured original XML is not the required app surface')
    if any("isn't responding" in value or 'ne reaguje' in value for value in labels(root)):
        raise AssertionError('Captured original contains ANR')
    return root, {child: p for p in root.iter() for child in p}


def local_query(query):
    try:
        result = subprocess.run(['psql', DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], input=query,
                                text=True, capture_output=True, check=True, timeout=30)
        return result.stdout.strip()
    except (subprocess.SubprocessError, OSError):
        raise RuntimeError('AI_REVIEW_LOCAL_READ_FAILED') from None


def fixture_command(mode, label=None):
    env = dict(os.environ)
    if label:
        assert re.fullmatch(r'[A-Z][A-Z0-9_]{0,70}', label)
        env['AI_REVIEW_OBSERVATION'] = label
    result = subprocess.run(['node', 'scripts/ai_review_fixture.mjs', mode], env=env,
                            text=True, capture_output=True, timeout=90)
    print(result.stdout, end='', flush=True)
    if result.returncode:
        raise RuntimeError(f'Guarded local fixture {mode} failed; no credential-bearing subprocess output logged')
    if label:
        return json.loads((ARTIFACT_DIR / f'AI_STATE_{label}.json').read_text(encoding='utf-8'))


def owned_state_digest():
    # Available even while REST is stopped. No service mutations or HTTP mocks.
    return local_query(f"""select md5(jsonb_build_object(
      'facts',(select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]'::jsonb) from public.ai_structured_facts f where conversation_id='{CONVERSATION_ID}'),
      'needs',(select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]'::jsonb) from public.needs n where requester_account_id='{ACCOUNT_ID}'),
      'receipts',(select coalesce(jsonb_agg(to_jsonb(c) order by client_request_id),'[]'::jsonb) from private.need_draft_save_commands c where account_id='{ACCOUNT_ID}')
    )::text)""")


def wait_confirmed(key, count, timeout=60):
    deadline = time.monotonic() + timeout
    assert re.fullmatch(r'need\.[a-z_]+', key)
    while time.monotonic() < deadline:
        actual = local_query(f"select count(*) from public.ai_structured_facts where conversation_id='{CONVERSATION_ID}' and superseded_at is null and status='CONFIRMED'")
        target = local_query(f"select count(*) from public.ai_structured_facts where conversation_id='{CONVERSATION_ID}' and fact_key='{key}' and superseded_at is null and status='CONFIRMED'")
        if actual == str(count) and target == '1':
            return
        time.sleep(0.5)
    raise AssertionError(f'Actual owner confirmation missing key={key}, expected total={count}')


def assert_correction(state):
    people = [f for f in state['facts'] if f['fact_key'] == 'need.people_needed']
    assert len(people) == 2, 'Exactly one supersession is required'
    old = [f for f in people if f['superseded_at'] is not None]
    live = [f for f in people if f['superseded_at'] is None]
    assert len(old) == len(live) == 1
    assert old[0]['fact_value'] == 2 and old[0]['source'] == 'AI_INFERENCE'
    assert old[0]['superseded_by'] == live[0]['id']
    assert type(live[0]['fact_value']) is int and live[0]['fact_value'] == 3
    assert live[0]['source'] == 'EXPLICIT_USER_ANSWER' and live[0]['status'] == 'CONFIRMED'
    assert live[0]['confirmed_by_user_id'] == state['accountId'] and live[0]['confirmed_at']


def assert_saved(state, fixture):
    assert state['accountId'] == fixture['accountId'] and state['conversationId'] == fixture['conversationId']
    assert len(state['needs']) == len(state['receipts']) == 1, 'UI save must create one DRAFT and one receipt'
    need, receipt = state['needs'][0], state['receipts'][0]
    values = {p['key']: p['value'] for p in fixture['proposals']}
    assert need['id'] == state['review']['boundNeedId'] == receipt['need_id']
    assert receipt['conversation_id'] == fixture['conversationId']
    assert need['requester_account_id'] == fixture['accountId'] and need['requester_profile_id'] == fixture['profileId']
    assert need['status'] == 'DRAFT' and need['mode'] == 'OFFERS' and need['requester_price_rsd'] is None
    assert need['title'] == values['need.title'] and need['description'] == values['need.description']
    assert need['category'] == values['need.category'] and need['required_slots'] == 3
    assert need['schedule_kind'] == 'FIXED_WINDOW' and need['required_vehicles'] == ['Kombi']
    assert need['public_topology']['mode'] == values['need.task_geography']['mode']
    assert need['public_topology']['start'] == values['need.task_geography']['start']
    assert need['public_topology']['end'] == values['need.task_geography']['end']
    assert need['task_country_code'] == 'RS'
    for column in ('starts_at', 'ends_at'):
        assert datetime.fromisoformat(need[column].replace('Z', '+00:00')) == datetime.fromisoformat(values[f'need.{column}'].replace('Z', '+00:00'))
    current = [f for f in state['facts'] if f['superseded_at'] is None]
    assert len(current) == (12 if fixture.get('marketplace') else 11) and all(f['status'] == 'CONFIRMED' and f['confirmed_by_user_id'] == fixture['accountId'] and f['confirmed_at'] for f in current)
    assert_correction(state)
    return need


def assert_schedule_label(value, start, end):
    # Independent semantic oracle, accepting Intl's legitimate CET/CEST/GMT
    # abbreviation while requiring BOTH actual full dates and local times.
    compact = re.sub(r'\s+', '', value)
    assert '–' in compact, 'Both schedule endpoints must be shown'
    endpoints = compact.split('–')
    assert len(endpoints) == 2
    for rendered, source in zip(endpoints, (start, end)):
        instant = datetime.fromisoformat(source.replace('Z', '+00:00')).astimezone(ZoneInfo('Europe/Belgrade'))
        date = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})\.', rendered)
        clock = re.search(r'(\d{1,2}):(\d{2})(?::\d{2})?', rendered)
        assert date and tuple(map(int, date.groups())) == (instant.day, instant.month, instant.year)
        assert clock and tuple(map(int, clock.groups())) == (instant.hour, instant.minute)
        offset = int(instant.utcoffset().total_seconds() // 3600)
        assert any(re.search(re.escape(zone) + r'(?![0-9A-Za-z])', rendered)
                   for zone in (instant.tzname(), f'GMT+{offset}', f'UTC+{offset}')), 'Visible timezone required'


def scroll_owner(node, parent):
    while node is not None:
        if node.attrib.get('scrollable') == 'true':
            return node
        node = parent.get(node)
    return None


def fact_action_owner(root, parent, action):
    """RN flattens rows; bind the action to its preceding header in this scroll.

    This uses the observed accessibility order, never a title text guess or a
    screen-wide generic confirmation. Crossing the next header changes owner.
    """
    container = scroll_owner(action, parent)
    if container is None:
        raise AssertionError('Fact action is outside the actual review scroll')
    header = None
    for node in container.iter():
        if node is action:
            if header is None:
                raise AssertionError('Fact action has no observed preceding row')
            return header
        if node.attrib.get('content-desc', '').startswith('Pregledajte: ') and scroll_owner(node, parent) is container:
            header = node
    raise AssertionError('Fact action is not in its observed scroll')


def stable_fact_target(label, action=None, *, direction='down', attempts=8):
    """Two consecutive fresh XML observations must agree before physical input."""
    previous = None
    row_label = f'Pregledajte: {label}'
    for _ in range(attempts):
        root, parent, node = seek('Proverite Zadatak', desc=action or row_label, direction=direction,
                                  enabled=True, complete_row=action is None)
        header = fact_action_owner(root, parent, node) if action else node
        if header.attrib.get('content-desc') != row_label:
            raise AssertionError(f'Wrong expanded fact for {action}: expected {row_label}, observed {header.attrib.get("content-desc")}')
        # The full header must be visible when opening a row. Its expanded
        # actions may need further scrolling (especially the correction form),
        # so bind those to this same XML's exact header even if it is now clipped.
        # Only the actual button about to receive input must remain fully visible.
        assert_button(root, parent, action or row_label, True)
        target = clickable_for(node, parent)
        if target is not node or not visible_node(target, parent, *screen_size()):
            raise AssertionError('Fact input must use its actual visible clickable control')
        signature = (header.attrib.get('bounds'), node.attrib.get('bounds'),
                     tuple((child.attrib.get('text'), child.attrib.get('bounds')) for child in header.iter() if child.attrib.get('text')))
        if signature == previous:
            return root, parent, node
        previous = signature
    raise AssertionError(f'Fact control never became stable: {label} / {action}')


def expanded_fact(root, parent):
    actions = [node for node in root.iter() if node.attrib.get('content-desc') in
               ('Potvrdite', 'Izmenite', 'Izmenite mesto', 'Izmenite u razgovoru', 'Sačuvaj ispravku')]
    owners = {fact_action_owner(root, parent, node).attrib.get('content-desc') for node in actions}
    if len(owners) > 1:
        raise AssertionError('Several different review facts expose actions')
    return next(iter(owners), None)


def open_fact(label, *, direction='down'):
    for _ in range(3):
        root, parent, node = stable_fact_target(label, direction=direction)
        if expanded_fact(root, parent) == f'Pregledajte: {label}':
            return
        tap_node(node, parent, hold_ms=120)
        # Expansion itself is harmless. If a moving row opened another fact,
        # observe it and retry the exact intended header; never press its action.
        for _ in range(4):
            root, parent = clean_surface('Proverite Zadatak')
            opened = expanded_fact(root, parent)
            if opened == f'Pregledajte: {label}':
                return
            if opened is not None:
                break
    raise AssertionError(f'Intended fact did not expand: {label}')


def press_fact_action(label, action):
    root, parent, node = stable_fact_target(label, action)
    # The returned control and owner belong to this last fresh stable XML.
    tap_node(node, parent, hold_ms=120)


def wait_pending_review():
    wait_visible(desc='Poruka za AI', timeout=60)
    seek('Novi zadatak', text='0 potvrđeno · 11 za pregled', direction='up')


def open_review():
    root, parent, node = seek('Novi zadatak', desc='Pregledajte nacrt', enabled=True)
    assert_button(root, parent, 'Pregledajte nacrt', True)
    tap_node(node, parent, hold_ms=120)


def return_to_saved_conversation(need_title):
    # Detail Back returns to its actual R07 parent. A saved review remains a
    # read-only route; its explicit Back owns the next hop to the conversation.
    tap(desc='Nazad', prefer='top')
    root, parent = clean_surface('Proverite Zadatak')
    assert 'Zadatak je već sačuvan' in labels(root) and need_title in labels(root)
    assert not any(n.attrib.get('content-desc') == 'Sačuvajte nacrt' for n in root.iter())
    control = assert_button(root, parent, 'Nazad u razgovor', True)
    assert visible_node(control, parent, *screen_size())
    tap_node(control, parent, hold_ms=120)
    wait_visible(desc='Poruka za AI')


def assert_requester_list():
    root, parent = clean_surface('Zadaci')
    owned = assert_button(root, parent, 'Moji', True)
    assert owned.attrib.get('selected') == 'true', 'Current owned List must be selected'
    assert 'Ono što ti je potrebno' in labels(root)
    assert_shell_tree(root, parent, *screen_size(), ('Zadaci', 'Novi Zadatak', 'Dogovori'))
    return root, parent


# The way to the drafts. The older list has the tab "Nacrti" (a button, `selected` once it is open). Since "Papir na stolu" (the owner's pick of 2026-10-08)
# "Moji zadaci" has the quiet row "Nacrti, 2 nacrta" under its groups ("Nacrti" alone while a filter is on): no tab and no `selected`; it opens the drafts in the
# same screen, under a bar that says "Nacrti", and the row is gone then.
DRAFTS_WAY = re.compile(r'Nacrti(?:, \d+ nacrt(?:a)?)?')


def drafts_way(root, parent):
    nodes = [node for node in root.iter() if DRAFTS_WAY.fullmatch(node.attrib.get('content-desc', ''))]
    if len(nodes) != 1:
        raise AssertionError('Expected one actual way to the drafts: the tab or the row Nacrti')
    node = nodes[0]
    if node.attrib.get('enabled') != 'true' or clickable_for(node, parent) is None:
        raise AssertionError('Enabled control is not actionable: Nacrti')
    return node


def reveal_saved_draft(need_title):
    # Active deliberately excludes DRAFT. Open the real drafts, never infer
    # absence or replace its filter/business model for the proof. Either look of
    # the list: the older one (the "Moji" button is selected under the title
    # "Zadaci") or the one with its own bar "Moji zadaci". Returns the criteria
    # that find the saved draft's card, in the words of the look that was met.
    root, parent, _ = dump_tree()
    older = any(node.attrib.get('content-desc') == 'Moji' for node in root.iter())
    root, parent = assert_requester_list() if older else clean_surface('Moji zadaci')
    way = drafts_way(root, parent)
    assert visible_node(way, parent, *screen_size())
    tap_node(way, parent, hold_ms=120)
    card = {'desc': f'Otvorite Zadatak {need_title}'} if older else {'contains': f'Otvori zadatak {need_title}'}
    wait_visible(timeout=60, **card)
    if older:
        root, parent = assert_requester_list()
        assert assert_button(root, parent, 'Nacrti', True).attrib.get('selected') == 'true'
    else:
        # The bar says where the drafts are, and the row that led there is gone.
        root, parent = clean_surface('Nacrti')
        assert not any(DRAFTS_WAY.fullmatch(node.attrib.get('content-desc', '')) for node in root.iter()), 'The row Nacrti must be gone from the open drafts'
    return card


def initial_world_touch(bounds, density):
    # Actual renderer starts at [0,0], zoom1,512 logical pixel world tiles.
    # This computes a physical touch only; the real SDK supplies all saved E6.
    # https://maplibre.org/maplibre-native/docs/book/design/coordinate-system.html
    assert 1 <= density <= 5
    x1, y1, x2, y2 = bounds
    world = 1024 * density
    latitude, longitude = 45.25, 19.835
    x = round((x1 + x2) / 2 + longitude / 360 * world)
    y = round((y1 + y2) / 2 - math.asinh(math.tan(math.radians(latitude))) / (2 * math.pi) * world)
    assert x1 + 8 < x < x2 - 8 and y1 + 8 < y < y2 - 8, 'Novi Sad touch must fit the actual neutral map'
    return x, y


def full_map_surface(density, attempts=12):
    # ResolvedPinMap's source-bound frame is 320dp. Android reports a clipped
    # accessibility rectangle, so mere containment is not its camera viewport.
    assert 1 <= density <= 5
    expected_height = 320 * density
    previous = None
    for _ in range(attempts):
        root, parent, node = seek('Mesto Zadatka', desc='Mapa predložene lokacije')
        bounds = parse_bounds(node.attrib['bounds'])
        width, height = screen_size()
        ancestor = parent.get(node)
        clips = [(0, 0, width, height)]
        while ancestor is not None:
            if ancestor.attrib.get('scrollable') == 'true':
                clips.append(parse_bounds(ancestor.attrib.get('bounds')))
            ancestor = parent.get(ancestor)
        assert len(clips) > 1, 'Actual location form scroll viewport required'
        clip = (max(b[0] for b in clips), max(b[1] for b in clips),
                min(b[2] for b in clips), min(b[3] for b in clips))
        assert clip[3] - clip[1] > expected_height, 'Full map cannot fit the observed form viewport'
        if inside(bounds, clip) and abs(bounds[3] - bounds[1] - expected_height) <= 2:
            if bounds == previous:
                return root, parent, node
            previous = bounds
            continue
        previous = None
        assert bounds[3] - bounds[1] < expected_height + 2, 'Observed map differs from its bound native frame'
        if bounds[3] >= clip[3] - 2:
            delta = bounds[1] + expected_height / 2 - (clip[1] + clip[3]) / 2
            assert delta > 0
            scroll_once(root, 'down', distance=delta)
        elif bounds[1] <= clip[1] + 2:
            delta = (clip[1] + clip[3]) / 2 - (bounds[3] - expected_height / 2)
            assert delta > 0
            scroll_once(root, 'up', distance=delta)
        else:
            raise AssertionError('Map frame is incomplete without an observed clipping edge')
    raise AssertionError('Full map frame did not become stable before physical input')


def native_pin_coordinates(label):
    # This normal native accessibility status is rendered from the actual SDK
    # selection. An Android annotation child bitmap is not an accessibility node.
    match = re.fullmatch(r'Predložena tačka na mapi\. Geografska širina (-?\d{1,2}\.\d{6}); geografska dužina (-?\d{1,3}\.\d{6})\.', label)
    assert match, 'Expected one complete precise native coordinate status'
    point = {'latitudeE6': int(Decimal(match[1]) * 1_000_000), 'longitudeE6': int(Decimal(match[2]) * 1_000_000)}
    assert abs(point['latitudeE6']) <= 90_000_000 and abs(point['longitudeE6']) <= 180_000_000, 'Actual native coordinates must be globally valid'
    return point


def inside_novi_sad(point):
    return 45_200_000 < point['latitudeE6'] < 45_300_000 and 19_750_000 < point['longitudeE6'] < 19_900_000


def projected_native_point(point):
    return (point['longitudeE6'] / 1e6 / 360,
            -math.asinh(math.tan(math.radians(point['latitudeE6'] / 1e6))) / (2 * math.pi))


def native_region_distance(point):
    target = {'latitudeE6': min(45_295_000,max(45_205_000,point['latitudeE6'])),
              'longitudeE6': min(19_895_000,max(19_755_000,point['longitudeE6']))}
    destination = projected_native_point(target)
    return math.dist(projected_native_point(point),destination), destination


def refine_native_pin(density, point, node):
    # Zoom1 gives only ~0.134 degrees per physical px at this device density.
    # Its first touch is navigation, not an exact point ready for confirmation.
    # Admit only its bounded quantization error, then use actual zoom15 state.
    expected = projected_native_point({'latitudeE6':45_250_000,'longitudeE6':19_835_000})
    initial = projected_native_point(point)
    assert max(abs(a-b) for a,b in zip(initial,expected)) * 1024 * density <= 2, 'Initial SDK point is inconsistent with the neutral overview touch'
    world = 512 * (2 ** 15) * density  # Actual centered camera status binds zoom15.
    for attempt in range(12):
        if inside_novi_sad(point):
            return point, node
        current = projected_native_point(point)
        distance, destination = native_region_distance(point)
        bounds = parse_bounds(node.attrib['bounds'])
        left, top, right, bottom = bounds
        center = ((left+right)/2, (top+bottom)/2)
        # A physical touch inside the observed map moves the selection; the
        # actual SDK supplies the next coordinates and camera idle receipt.
        x = round(min(right-(right-left)*.1,max(left+(right-left)*.1,center[0]+(destination[0]-current[0])*world)))
        y = round(min(bottom-(bottom-top)*.1,max(top+(bottom-top)*.1,center[1]+(destination[1]-current[1])*world)))
        assert left < x < right and top < y < bottom
        adb('shell','input','tap',str(x),str(y))
        next_point, next_node = observed_native_pin(density,different_from=point)
        assert native_region_distance(next_point)[0] < distance, 'Physical correction did not advance toward the same interior box'
        point, node = next_point, next_node
        print(f'CHECKPOINT NATIVE_MAP_CORRECTION step={attempt+1}',flush=True)
    assert inside_novi_sad(point), 'Bounded physical corrections did not reach Novi Sad'
    return point, node


def observed_native_pin(density, *, different_from=None, attempts=12):
    previous = None
    for _ in range(attempts):
        root, parent, node = full_map_surface(density)
        statuses = [n for n in root.iter() if n.attrib.get('content-desc', '').startswith(('Predložena tačka na mapi', 'Približna tačka na mapi'))]
        assert len(statuses) <= 1, 'Ambiguous native selected coordinate status'
        if not statuses:
            previous = None
            continue
        status = statuses[0]
        point = native_pin_coordinates(status.attrib['content-desc'])
        idle = [n for n in root.iter() if matches(n, text='Mapa je centrirana na izabranu tačku.')]
        assert len(idle) <= 1, 'Ambiguous native camera status'
        if point == different_from or not idle:
            previous = None
            continue
        if not all(visible_node(n, parent, *screen_size()) for n in (status, idle[0])):
            # The form and the camera are different scroll surfaces. Reveal the
            # observed status via the outer form gutter, then recheck full map.
            seek('Mesto Zadatka', text='Mapa je centrirana na izabranu tačku.')
            previous = None
            continue
        signature = (point['latitudeE6'], point['longitudeE6'], parse_bounds(node.attrib['bounds']))
        if signature == previous:
            return point, node
        previous = signature
    raise AssertionError('Actual precise point and native centered camera did not become stable')


def drag_native_marker(scale, before):
    """Drag the actual native overlay hit target, then read native coordinates."""
    previous = None
    for _ in range(12):
        root, parent, map_node = full_map_surface(scale)
        markers = [n for n in root.iter() if matches(n, desc='Oznaka izabrane tačke na mapi')]
        assert len(markers) <= 1, 'Ambiguous native marker hit target'
        status = [n for n in root.iter() if n.attrib.get('content-desc', '').startswith('Predložena tačka na mapi.')]
        if len(markers) != 1 or len(status) != 1 or not visible_node(markers[0], parent, *screen_size()):
            continue
        marker, bounds = markers[0], parse_bounds(map_node.attrib['bounds'])
        hit = parse_bounds(marker.attrib['bounds'])
        if not inside(hit, bounds) or abs(hit[2] - hit[0] - 44 * scale) > 2 or abs(hit[3] - hit[1] - 48 * scale) > 2:
            continue
        if native_pin_coordinates(status[0].attrib['content-desc']) != before:
            raise AssertionError('Native selected point changed before marker drag')
        if not any(matches(n, text='Mapa je centrirana na izabranu tačku.') and visible_node(n, parent, *screen_size()) for n in root.iter()):
            continue
        current = (hit, bounds)
        if current == previous:
            break
        previous = current
    else:
        raise AssertionError('Actual full native marker hit target did not become stable')
    x, y = (hit[0] + hit[2]) // 2, (hit[1] + hit[3]) // 2
    # Half the observed marker width is a short real drag toward the interior.
    # No geographic value is supplied to the app: the SDK determines the result.
    dx = (hit[2] - hit[0]) // 2 * (1 if before['longitudeE6'] < 19_825_000 else -1)
    assert bounds[0] < x + dx < bounds[2] and bounds[1] < y < bounds[3]
    adb('shell', 'input', 'touchscreen', 'swipe', str(x), str(y), str(x + dx), str(y), '600')
    point, map_node = observed_native_pin(scale, different_from=before)
    assert inside_novi_sad(point), 'Actual dragged point must remain in Novi Sad'
    capture('MARKETPLACE_pin_start_dragged', 'Mesto Zadatka')
    print('CHECKPOINT NATIVE_MARKER_DRAG_CONFIRMED', flush=True)
    return point, map_node


def physical_manual_point(title, *, offset=False):
    anchor = 'Mesto Zadatka'
    density = adb('shell', 'wm', 'density').stdout
    values = re.findall(r'(?:Physical|Override) density:\s*(\d+)', density)
    assert values, 'Actual Android display density required'
    scale = int(values[-1]) / 160
    root, parent, node = full_map_surface(scale)
    assert not any(n.attrib.get('content-desc', '').startswith(('Predložena tačka na mapi', 'Približna tačka na mapi')) for n in root.iter()), 'New slot must start without a selected pin'
    # Readiness is an observed native state, never a fixed sleep or SDK call.
    deadline = time.monotonic() + 25
    while any(matches(n, desc='Učitavanje mape') for n in root.iter()) and time.monotonic() < deadline:
        root, parent, node = full_map_surface(scale)
    assert not any(matches(n, desc='Učitavanje mape') or matches(n, text='Mapa nije učitana.') for n in root.iter())
    x, y = initial_world_touch(parse_bounds(node.attrib['bounds']), scale)
    adb('shell', 'input', 'tap', str(x), str(y))
    point, node = observed_native_pin(scale)
    point, node = refine_native_pin(scale, point, node)
    assert inside_novi_sad(point), 'Actual final point must be in Novi Sad before marker gesture'
    if not offset:
        point, node = drag_native_marker(scale, point)
    if offset:
        # A fresh end slot initially shares the same overview. After the actual
        # selected-pin camera jump, physically choose a distinct nearby stop.
        bounds = parse_bounds(node.attrib['bounds'])
        x, y = (bounds[0] + bounds[2]) // 2 + 60, (bounds[1] + bounds[3]) // 2 + 50
        assert bounds[0] < x < bounds[2] and bounds[1] < y < bounds[3]
        adb('shell', 'input', 'tap', str(x), str(y))
        point, node = observed_native_pin(scale, different_from=point)
    assert inside_novi_sad(point), 'Actual final point must be in Novi Sad before confirmation'
    captured, captured_parent = capture(f'MARKETPLACE_pin_{"end" if offset else "start"}_proposed', anchor)
    captured_status = [n for n in captured.iter() if n.attrib.get('content-desc', '').startswith('Predložena tačka na mapi')]
    assert len(captured_status) == 1 and visible_node(captured_status[0], captured_parent, *screen_size())
    assert native_pin_coordinates(captured_status[0].attrib['content-desc']) == point, 'Captured native coordinates must match the point being confirmed'
    assert any(matches(n, text='Mapa je centrirana na izabranu tačku.') and visible_node(n, captured_parent, *screen_size()) for n in captured.iter())
    root, parent, button = seek(anchor, desc=f'Potvrdi tačku: {title}', enabled=True)
    tap_node(button, parent, hold_ms=120)
    seek(anchor, text='Tačka je potvrđena u ovom obrascu.')
    capture(f'MARKETPLACE_pin_{"end" if offset else "start"}_confirmed', anchor)
    return point


def assert_saved_native_points(state, observed_start, observed_end):
    assert observed_start != observed_end, 'Physical route stops must be distinct'
    resolved = [f for f in state['facts'] if f['fact_key'] == 'need.resolved_location' and f['superseded_at'] is None]
    assert len(resolved) == 1 and resolved[0]['status'] == 'CONFIRMED' and resolved[0]['source'] == 'EXPLICIT_USER_ANSWER'
    assert [p['slot'] for p in resolved[0]['fact_value']['points']] == ['start', 'end']
    for point, observed in zip(resolved[0]['fact_value']['points'], (observed_start, observed_end)):
        assert point['origin'] == {'kind': 'MANUAL_PIN'}
        assert 45_200_000 < point['latitudeE6'] < 45_300_000 and 19_750_000 < point['longitudeE6'] < 19_900_000
        assert {key: point[key] for key in ('latitudeE6', 'longitudeE6')} == observed, 'Saved point must equal the actual native selected coordinates'


def select_native_destination():
    # Android appends LocationChoice's current accessibilityValue to its label.
    # Bind the confirmed start, so clipped selector bounds guide the real scroll.
    root, parent, node = seek('Mesto Zadatka', desc='Tačka koju uređujete, Polazište · potvrđeno', direction='up', enabled=True)
    tap_node(node, parent, hold_ms=120)
    tap(desc='Odredište')
    seek('Mesto Zadatka', text='Odredište na mapi', enabled=True)


def physical_location_review():
    press_in_review('Mesto Zadatka', direction='up')
    wait_visible(text='Mesto Zadatka')
    observed_start = physical_manual_point('Polazište')
    select_native_destination()
    observed_end = physical_manual_point('Odredište', offset=True)
    assert observed_start != observed_end, 'Physical route stops must be distinct'
    root, parent, checkbox = seek('Mesto Zadatka', desc='Potvrđujem unetu lokaciju', enabled=True)
    assert checkbox.attrib.get('checked') != 'true'
    tap_node(checkbox, parent, hold_ms=120)
    root, parent, button = seek('Mesto Zadatka', desc='Potvrdi i sačuvaj mesto', enabled=True)
    tap_node(button, parent, hold_ms=120)
    wait_visible(text='Lokacija je sačuvana u pregledu Zadatka.', timeout=60)
    state = fixture_command('observe', 'MANUAL_POINTS_CONFIRMED')
    assert_saved_native_points(state, observed_start, observed_end)
    capture('MARKETPLACE_location_saved', 'Mesto Zadatka')
    tap(desc='Vrati se na pregled')
    wait_confirmed('need.resolved_location', 12)


def marketplace_continue(fixture, need):
    fixture_command('prepare-marketplace')
    # Current user is the second account's empty Nova. Use actual tab/logout
    # controls and the current signed-out Auth form before returning to owner.
    tap(desc='Zadaci', prefer='bottom'); core_profile(); tap(desc='Odjavite se')
    wait_visible(desc='Prijavite se', timeout=60); assert_signed_out_surface(form_open=True)
    login(fixture['email'], form_open=True); card = reveal_saved_draft(need['title'])
    tap(**card)
    wait_visible(desc='Proveri za objavu'); capture('MARKETPLACE_draft_ready_for_evaluation', 'Zadatak')
    tap(desc='Proveri za objavu'); wait_visible(desc='Objavi Zadatak', timeout=60)
    before = fixture_command('observe', 'B06_ALLOW_BEFORE_PUBLISH')
    assert before['needs'][0]['id'] == need['id'] and before['needs'][0]['status'] == 'DRAFT'
    assert local_query(f"select count(*) from private.need_publication_decisions where need_id='{need['id']}' and outcome='ALLOW' and decision_source='PUBLICATION_EVALUATOR_V1'") == '1'
    assert local_query(f"select count(*) from private.need_publish_commands where need_id='{need['id']}'") == '0'
    capture('MARKETPLACE_b06_allow_not_published', 'Zadatak')
    tap(desc='Objavi Zadatak'); wait_visible(text='Objavi Zadatak?')
    # Android Alert affirmative is separate from the sticky page action.
    nodes, parent = wait_nodes(clazz='android.widget.Button', text='OBJAVI ZADATAK')
    assert len(nodes) == 1; tap_node(nodes[0], parent, hold_ms=120)
    wait_visible(text='Server je potvrdio objavu. Prikazujemo ponovo učitano stanje Zadatka.', timeout=60)
    capture('MARKETPLACE_b07_explicit_published', 'Zadatak')
    fixture_command('bind-marketplace')
    core = json.loads((ARTIFACT_DIR / 'core-fixture.json').read_text(encoding='utf-8'))
    env = {**os.environ, 'RU5_DEVICE_CORE106': '1', 'RU5_DEVICE_REQUESTER_EMAIL': fixture['email'],
           'RU5_DEVICE_WORKER_EMAIL': fixture['other']['email'], 'RU5_DEVICE_REQUESTER_USER_ID': fixture['accountId'],
           'RU5_DEVICE_WORKER_USER_ID': fixture['other']['accountId'], 'RU5_DEVICE_NEED_ID': need['id'], 'RU5_DEVICE_NEED_TITLE': need['title']}
    def step(command):
        subprocess.run(command, env=env, check=True, timeout=1500)
    step(['python3', '-B', 'scripts/ru5_android_device_ui_journey.py'])
    selection = json.loads((ARTIFACT_DIR / 'core-selection.json').read_text(encoding='utf-8'))
    assert selection['needId'] == core['needId'] == need['id'] and selection['publicationProof'] is True
    env['N04_AGREEMENT_ID'] = selection['agreementId']
    step(['node', 'supabase/proofs/notifications/d03_chat_device_fixture.mjs'])
    step(['python3', '-B', 'scripts/d03_chat_android_journey.py'])
    chat = json.loads((ARTIFACT_DIR / 'd03-physical-chat-report.json').read_text(encoding='utf-8'))
    assert chat['result'] == 'PASS' and chat['sameAgreementId'] == selection['agreementId']
    assert chat['nativeWorkerDone'] and chat['nativeRequesterComplete'] and chat['publicationProof']
    (ARTIFACT_DIR / 'marketplace-vertical-report.json').write_text(json.dumps({
        'result': 'PASS', 'sourceSha': os.environ['GITHUB_SHA'], 'localOnly': True, 'historyCount': 108, 'needId': need['id'],
        'conversationId': CONVERSATION_ID, 'agreementId': selection['agreementId'], 'requiredSlots': 3,
        'actualNativeAi': True, 'actualNativePins': True, 'actualB06': True, 'actualB07': True,
        'actualNativeApplySelect': True, 'actualNativeMessages': True, 'actualNativeCompletion': True,
        'providerProof': False, 'gatewayProof': False, 'productionPolicyActivation': False, 'reviewsProven': False,
        'reviewBoundary': 'NOT_IMPLEMENTED_OWNER_F144_PENDING'}, indent=2) + '\n', encoding='utf-8')
    print('PASS MARKETPLACE_VERTICAL_PHYSICAL same_AI_Need real_pins_B06_B07_Apply_Select_Agreement_Chat_Completion reviewsProven=false', flush=True)


def main():
    if __package__:
        from .ai_review_local_rest import LocalRestOutage, validate_local_targets
    else:
        from ai_review_local_rest import LocalRestOutage, validate_local_targets
    validate_local_targets(os.environ)
    assert os.environ['RU5_DEVICE_ARTIFACT_DIR'] == 'artifacts/ai-review-device'
    assert re.fullmatch(r'[a-f0-9]{40}', os.environ['GITHUB_SHA'])
    global PACKAGE, MAIN_ACTIVITY, PASSWORD, DB_URL, ARTIFACT_DIR, ACCOUNT_ID, CONVERSATION_ID
    PACKAGE, DB_URL = os.environ['RU5_DEVICE_PACKAGE'], os.environ['RU5_DEVICE_DB_URL']
    MAIN_ACTIVITY, PASSWORD = f'{PACKAGE}/.MainActivity', os.environ['RU5_DEVICE_PASSWORD']
    ARTIFACT_DIR = Path(os.environ['RU5_DEVICE_ARTIFACT_DIR'])
    load_shared_helpers()
    globals()['psql'] = local_query
    fixture = json.loads((ARTIFACT_DIR / 'ai-review-fixture.json').read_text(encoding='utf-8'))
    marketplace = os.environ.get('AI_REVIEW_SCOPE') == 'marketplace'
    ACCOUNT_ID = fixture['accountId']
    assert fixture['sourceSha'] == os.environ['GITHUB_SHA'] and fixture['localOnly'] is True and fixture['providerProof'] is False
    assert re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', ACCOUNT_ID)
    assert ACCOUNT_ID not in (os.environ['RU5_DEVICE_REQUESTER_USER_ID'], os.environ['RU5_DEVICE_WORKER_USER_ID'])
    print(f'START AI_REVIEW_PHYSICAL exact{108 if marketplace else 106} actual_client_handler_auth_sql synthetic_model', flush=True)
    launch_clean()
    capture('AI_entry_real_native', 'Auth entry')
    login(fixture['email'])
    assert_requester_list()
    capture('AI_owner_empty', 'Još nemate Zadatak')
    tap(desc='Novi Zadatak', prefer='bottom')
    wait_visible(desc='Poruka za AI')
    capture('AI_owned_conversation_open', 'Novi zadatak')
    assert local_query(f"select count(*) from public.ai_conversations where account_id='{ACCOUNT_ID}'") == '1'
    CONVERSATION_ID = local_query(f"select id from public.ai_conversations where account_id='{ACCOUNT_ID}'")
    assert re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', CONVERSATION_ID)
    edit_text(0, fixture['input'])
    capture('AI_composer_keyboard', 'Novi zadatak')
    hide_keyboard()
    root, parent = clean_surface('Novi zadatak')
    control = assert_button(root, parent, 'Pošalji poruku', True)
    x1, y1, x2, y2 = parse_bounds(control.attrib['bounds'])
    for _ in range(2):
        adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
    # The local adapter drops only the first SUCCEEDED HTTP response AFTER SQL
    # commit. An actual owned readback recovers it without another send.
    wait_visible(desc='Proverite ishod', timeout=60)
    root, parent = capture('AI_send_unknown_after_commit', 'Novi zadatak')
    assert_button(root, parent, 'Ponovi istu poruku', False)
    state = fixture_command('observe', 'TURN_COMMITTED_UI_UNKNOWN')
    assert len(state['turns']) == 1 and state['turns'][0]['state'] == 'SUCCEEDED'
    assert len(state['facts']) == 11 and not state['needs'] and not state['receipts']
    tap(desc='Proverite ishod')
    wait_pending_review()
    capture('AI_pending_proposals', 'Novi zadatak')
    open_review()
    root, parent = capture('AI_review_pending_top', 'Proverite Zadatak')
    assert_button(root, parent, 'Sačuvajte nacrt', False)
    tap(desc='Nazad u razgovor', prefer='top')
    wait_pending_review()
    capture('AI_review_back_same_conversation', 'Novi zadatak')
    assert local_query(f"select status from public.ai_conversations where id='{CONVERSATION_ID}'") == 'OPEN'
    assert local_query(f"select count(*) from public.ai_conversations where account_id='{ACCOUNT_ID}'") == '1'
    open_review()
    open_fact('Ljudi')
    press_fact_action('Ljudi', 'Izmenite')
    seek('Proverite Zadatak', desc='Nova vrednost: Ljudi')
    fields, _ = wait_nodes(desc='Nova vrednost: Ljudi')
    assert len(fields) == 1 and entered_value_matches(fields[0], '2'), 'Correction must start from typed value, not misleading model displayValue=99'
    edit_text(0, '3')
    hide_keyboard()
    capture('AI_people_correction_input', 'Proverite Zadatak')
    press_fact_action('Ljudi', 'Sačuvaj ispravku')
    wait_confirmed('need.people_needed', 1)
    assert_correction(fixture_command('observe', 'PEOPLE_CORRECTED'))
    capture('AI_people_corrected', 'Proverite Zadatak')
    sequence = [('Naslov', 'title'), ('Opis', 'description'), ('Kategorija', 'category'),
                ('Cena', 'price_mode'), ('Termin', 'schedule_kind'), ('Početak', 'starts_at'),
                ('Kraj', 'ends_at'), ('Država zadatka', 'task_country_code'), ('Lokacija', 'task_geography')]
    for index, (label, key) in enumerate(sequence, start=2):
        open_fact(label, direction='up' if index == 2 else 'down')
        if key == 'task_geography':
            root, _ = clean_surface('Proverite Zadatak')
            assert any('Novi Sad · Centar' in value and 'Novi Sad · Liman' in value for value in labels(root)), 'Expanded location must show both typed public endpoints'
        press_fact_action(label, 'Potvrdite')
        wait_confirmed(f'need.{key}', index)
    state = fixture_command('observe', 'OPTIONAL_VEHICLE_PENDING')
    assert state['review']['canSaveDraft'] is True and state['review']['safety'] == 'ALLOW'
    assert [f['key'] for f in state['review']['facts'] if f['status'] != 'CONFIRMED'] == ['need.required_vehicles']
    assert not state['needs'] and not state['receipts']
    root, parent = capture('AI_optional_vehicle_blocks_save', 'Proverite Zadatak')
    assert_button(root, parent, 'Sačuvajte nacrt', False)
    open_fact('Vozilo', direction='up')
    stable_fact_target('Vozilo', 'Potvrdite')
    unchanged = owned_state_digest()
    with LocalRestOutage().stopped():
        press_fact_action('Vozilo', 'Potvrdite')
        wait_visible(desc='Učitajte pregled ponovo', timeout=60)
        root, parent = capture('AI_offline_confirmation_readback', 'Proverite Zadatak')
        assert_button(root, parent, 'Sačuvajte nacrt', False)
        assert owned_state_digest() == unchanged
    tap(desc='Učitajte pregled ponovo')
    # Fresh read remounts the collapsed review at its top. Find the optional
    # row below it; confirmation remains a separate physical user action.
    open_fact('Vozilo', direction='down')
    capture('AI_restored_explicit_confirmation', 'Proverite Zadatak')
    press_fact_action('Vozilo', 'Potvrdite')
    wait_confirmed('need.required_vehicles', 11)
    if marketplace:
        physical_location_review()
    ready = fixture_command('observe', 'READY')
    assert all(f['status'] == 'CONFIRMED' for f in ready['review']['facts'])
    root, parent = capture('AI_ready_human_confirmed', 'Proverite Zadatak')
    control = assert_button(root, parent, 'Sačuvajte nacrt', True)
    x1, y1, x2, y2 = parse_bounds(control.attrib['bounds'])
    for _ in range(2):
        adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
    detail_anchor = 'Zadatak'
    wait_visible(text=detail_anchor, timeout=60)
    saved = fixture_command('observe', 'SAVED')
    fixture = json.loads((ARTIFACT_DIR / 'ai-review-fixture.json').read_text(encoding='utf-8'))
    need = assert_saved(saved, fixture)
    root, parent = capture('AI_saved_draft_detail', detail_anchor)
    assert need['title'] in labels(root) and 'Privatan nacrt' in labels(root)
    return_to_saved_conversation(need['title'])
    capture('AI_saved_conversation_readonly', 'Novi zadatak')
    root, parent = clean_surface('Novi zadatak')
    assert_button(root, parent, 'Pošalji poruku', False)
    tap(desc='Nazad', prefer='top')
    reveal_saved_draft(need['title'])
    capture('AI_saved_in_tasks', 'Zadaci')
    core_profile()
    tap(desc='Odjavite se')
    wait_visible(desc='Prijavite se', timeout=60)
    assert_signed_out_surface(form_open=True)
    login(fixture['other']['email'], form_open=True)
    assert_requester_list()
    root, parent = capture('AI_other_account_empty', 'Još nemate Zadatak')
    assert need['title'] not in labels(root)
    tap(desc='Novi Zadatak', prefer='bottom')
    wait_visible(desc='Poruka za AI')
    root, parent = capture('AI_other_account_new_conversation', 'Novi zadatak')
    assert need['title'] not in labels(root)
    assert local_query(f"select count(*) from public.ai_conversations where account_id='{fixture['other']['accountId']}'") == '1'
    final = fixture_command('observe', 'FINAL')
    assert assert_saved(final, fixture)['id'] == need['id'] and final['receipts'] == saved['receipts']
    fixture_command('verify')
    print(f'PASS AI_REVIEW_PHYSICAL exact{108 if marketplace else 106} real_native_auth_client_handler_sql synthetic_provider '
          'unknown_readback_no_turn_replay correction optional_confirmation double_save_one_draft other_account_isolated '
          'gatewayProof=false providerProof=false publicationProof=false downstreamTaskDetailV2Parity=false', flush=True)
    if marketplace:
        marketplace_continue(fixture, need)


if __name__ == '__main__':
    main()
