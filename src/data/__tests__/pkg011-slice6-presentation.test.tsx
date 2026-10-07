import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction, sys } from '../../ui/system/tokens';
// The one primary action is the Press whose own surface is the brand surface (last style wins, as in React Native).
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import { SettingsAction, SettingsFooter, SettingsGroup, SettingsInfo, SettingsIntro, SettingsPanel, SettingsPersonRow, SettingsRow, SettingsScreen,
  SettingsSwitchRow, SettingsText } from '../../ui/settings/SettingsPresentation';
import { Glyph } from '../../ui/system/Glyph';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('a settings screen has a spoken header, rows with label, hint and chevron, panels and exactly one brand action', async () => {
  const back = jest.fn(), open = jest.fn(), primary = jest.fn();
  await act(async () => { tree = create(<SettingsScreen title="Privatnost i podaci" onBack={back} footer={<SettingsAction label="Zatvori nalog" onPress={primary} />}>
    <SettingsIntro kicker="Tvoji podaci" title="Šta je javno, šta ostaje tvoje">Kratko objašnjenje.</SettingsIntro>
    <SettingsGroup title="Nalog i podaci">
      <SettingsRow label="Izvoz podataka" detail="Zahtev i preuzimanje svoje kopije." onPress={open} />
      <SettingsRow label="Blokirani korisnici" detail="Tvoja blokiranja." onPress={open} last />
    </SettingsGroup>
    <SettingsPanel><SettingsText variant="heading">Rokovi čuvanja</SettingsText><SettingsInfo title="Poruke">Čuvaju se 12 meseci.</SettingsInfo></SettingsPanel>
    <SettingsAction label="Osveži" kind="secondary" onPress={open} />
  </SettingsScreen>); });
  const copy = texts();
  expect(copy).toContain('Privatnost i podaci'); expect(copy).not.toContain('Tvoji podaci'); expect(copy).toContain('Nalog i podaci'); expect(copy).toContain('Čuvaju se 12 meseci.');
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.accessibilityRole === 'header' && node.children.includes('Privatnost i podaci'))).toBe(true);
  const row = byLabel('Izvoz podataka'); expect(row.props.accessibilityRole).toBe('button'); expect(row.props.accessibilityHint).toBe('Zahtev i preuzimanje svoje kopije.');
  await act(async () => row.props.onPress()); expect(open).toHaveBeenCalledTimes(1);
  expect(brand()).toEqual(['Zatvori nalog']);
  await act(async () => byLabel('Nazad').props.onPress()); expect(back).toHaveBeenCalledTimes(1);
  expect(copy).not.toMatch(/[A-ZŠĐČĆŽ]{4,}/);
});

// Step 11a (2026-09-24): one rhythm and the missing pieces of the settings family.
const flat = (style: unknown) => require('react-native').StyleSheet.flatten(style) ?? {};
test('a switch row is one focus stop spoken as a switch, the drawn switch green on white and hidden from the reader', async () => {
  const change = jest.fn();
  await act(async () => { tree = create(<SettingsGroup title="Tihi sati" footer="Važi za ovaj telefon.">
    <SettingsSwitchRow label="Uključi tihe sate" help="Telefon ćuti u tom periodu." value onChange={change} />
    <SettingsSwitchRow label="Hitno može" help="Samo hitno." value={false} disabled reason="Prvo sačuvaj." onChange={change} last />
  </SettingsGroup>); });
  const on = byLabel('Uključi tihe sate');
  expect(on.props.accessibilityRole).toBe('switch');
  expect(on.props.accessibilityState).toEqual({ checked: true, disabled: false });
  expect(flat(on.props.style).minHeight).toBe(56);
  await act(async () => on.props.onPress()); expect(change).toHaveBeenCalledWith(false);
  const drawn = on.findByProps({ importantForAccessibility: 'no-hide-descendants' });
  expect(drawn.props.accessibilityElementsHidden).toBe(true);
  const toggle = drawn.findByProps({ value: true });
  expect(toggle.props).toMatchObject({ trackColor: { false: sys.color.lineStrong, true: sys.color.green }, thumbColor: sys.color.surface });
  const off = byLabel('Hitno može');
  expect(off.props.accessibilityState).toEqual({ checked: false, disabled: true });
  expect(off.props.accessibilityHint).toBe('Samo hitno. Prvo sačuvaj.');
  expect(texts()).toContain('Prvo sačuvaj.'); expect(texts()).toContain('Važi za ovaj telefon.');
  // The group name is a quiet header, not a tracked capital label.
  const title = tree.root.findAllByType('T' as React.ElementType).find(node => node.children.includes('Tihi sati'))!;
  expect(title.props.accessibilityRole).toBe('header'); expect(title.props.variant).toBe('meta');
});
test('a person row has two focus stops side by side: the person, and the action', async () => {
  const open = jest.fn(), unblock = jest.fn();
  await act(async () => { tree = create(<SettingsPersonRow name="Marko Marković" initials="MM" onOpen={open} openHint="Otvara privatnu prijavu."
    action={{ label: 'Odblokiraj', accessibilityLabel: 'Odblokiraj, Marko Marković', onPress: unblock }} last />); });
  const person = byLabel('Marko Marković'), action = byLabel('Odblokiraj, Marko Marković');
  expect(person.props.accessibilityHint).toBe('Otvara privatnu prijavu.');
  expect(person.findAll(node => node === action)).toHaveLength(0); expect(action.findAll(node => node === person)).toHaveLength(0);
  await act(async () => person.props.onPress()); expect(open).toHaveBeenCalledTimes(1); expect(unblock).not.toHaveBeenCalled();
  await act(async () => action.props.onPress()); expect(unblock).toHaveBeenCalledTimes(1);
  expect(flat(action.props.style).minHeight).toBeGreaterThanOrEqual(48);
});
test('rows are 56 dp at least, a destructive row speaks in the danger colour, and a disabled row is muted, never faded', async () => {
  await act(async () => { tree = create(<SettingsGroup>
    <SettingsRow label="Pravila" onPress={() => {}} compact />
    <SettingsRow label="Nedostupno" onPress={() => {}} disabled />
    <SettingsRow label="Zatvori nalog" onPress={() => {}} tone="danger" last />
  </SettingsGroup>); });
  for (const label of ['Pravila', 'Nedostupno', 'Zatvori nalog']) {
    const style = flat(byLabel(label).props.style);
    expect(style.minHeight).toBe(56); expect(style.opacity).toBeUndefined();
  }
  const colorOf = (label: string) => flat(tree.root.findAllByType('T' as React.ElementType).find(node => node.children.includes(label))!.props.style).color;
  expect(colorOf('Zatvori nalog')).toBe(sys.color.danger);
  expect(colorOf('Nedostupno')).toBe(sys.color.muted);
  expect(colorOf('Pravila')).toBe(sys.color.ink);
});
// Round-5 review (2026-09-24): a disabled row's picture is muted with its words, as V2Action mutes its icon; a live row
// keeps its colours.
test('a disabled row draws its picture in the muted set, a live row in colour', async () => {
  const { FactArt } = require('../../ui/system/FactArt') as typeof import('../../ui/system/FactArt');
  await act(async () => { tree = create(<SettingsGroup>
    <SettingsRow label="Obaveštenja" icon={<FactArt kind="bell" size={26} />} onPress={() => {}} />
    <SettingsRow label="Zauzeto" icon={<FactArt kind="bell" size={26} />} onPress={() => {}} disabled last />
  </SettingsGroup>); });
  const art = (label: string) => byLabel(label).findAll(node => typeof node.type !== 'string' && node.props.kind === 'bell', { deep: false })[0].props;
  expect(art('Obaveštenja').muted).toBeFalsy();
  expect(art('Zauzeto').muted).toBe(true);
});
test('the person part of a person row ends in the chevron; the action has none', async () => {
  await act(async () => { tree = create(<SettingsPersonRow name="Marko Marković" initials="MM" onOpen={() => {}}
    action={{ label: 'Odblokiraj', accessibilityLabel: 'Odblokiraj, Marko Marković', onPress: () => {} }} last />); });
  expect(byLabel('Marko Marković').findAllByType('CaretRight' as React.ElementType)).toHaveLength(1);
  expect(byLabel('Odblokiraj, Marko Marković').findAllByType('CaretRight' as React.ElementType)).toHaveLength(0);
});
// Round 5c (2026-09-24): beside the name, the chevron sat mid-row and pointed at the bordered button. The action now stands
// under the name at every text size, so the chevron ends the person's line.
test('the action of a person row stands under the name at the usual text size, not beside the chevron', async () => {
  await act(async () => { tree = create(<SettingsPersonRow name="Marko Marković" initials="MM" onOpen={() => {}}
    action={{ label: 'Odblokiraj', accessibilityLabel: 'Odblokiraj, Marko Marković', onPress: () => {} }} last />); });
  const person = byLabel('Marko Marković');
  const row = person.parent!;
  expect(row.type).toBe('View');
  // The row is a column: the person's line, then the action's line.
  expect(flat(row.props.style).flexDirection).toBeUndefined();
  const lines = row.children as unknown as { type: unknown }[];
  expect(lines[0]).toBe(person); expect(lines[1].type).toBe('View');
  // The chevron is the last thing on the person's line: the system's one glyph, asked for by its name (UI/UX pass 2026-10-07).
  const line = person.children as unknown as { type: unknown; props: { name?: string; tone?: string } }[];
  expect(line[line.length - 1].type).toBe(Glyph); expect(line[line.length - 1].props).toMatchObject({ name: 'caret-right', tone: 'muted' });
});
test('the footer band is reusable and keeps its test id; a screen can name where its arrow goes', async () => {
  const back = jest.fn();
  await act(async () => { tree = create(<SettingsScreen title="Podešavanja obaveštenja" backLabel="Nazad na profil" onBack={back}>{null}</SettingsScreen>); });
  await act(async () => byLabel('Nazad na profil').props.onPress()); expect(back).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<SettingsFooter><SettingsAction label="Sačuvaj" onPress={() => {}} /></SettingsFooter>); });
  expect(tree.root.findAll(node => node.props.testID === 'settings-primary-footer' && typeof node.type === 'string')).toHaveLength(1);
  expect(brand()).toEqual(['Sačuvaj']);
});
