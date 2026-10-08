import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
// A Dogovor's person bar reads photographs; the sections under test do not.
jest.mock('../../media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));

import { Disclosure } from '../Disclosure';
import { AgreementSection } from '../../v2/AgreementPresentation';
import { sys } from '../tokens';

/**
 * One "open in place" row (master design plan, 2026-09-24). Its state is spoken, its caret turns on a real change only,
 * and the second row the detail screens had (`AgreementSection`) is this one row now. (The other, `DisclosureRow` of `system/Detail`, had no user
 * outside this file and went with that file in the UI/UX pass of 2026-10-08, F8b: its test draws `Disclosure` itself, with the same two props.)
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const row = (label: string) => tree.root.findAll(node => typeof node.type !== 'string' && node.props.accessibilityLabel === label
  && node.props.accessibilityRole === 'button')[0];
const surface = (label: string) => tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityLabel === label)[0];
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children).filter(child => typeof child === 'string');
const tap = (label: string) => act(async () => row(label).props.onPress());
const caret = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'disclosure-caret')[0];
const rotation = () => (flat(caret()).transform as { rotate: string }[])[0].rotate;

it('opens and closes in place, speaks its state and is at least 56 px high', async () => {
  await render(<Disclosure label="Kontakt" hint="Podeli svoj broj kada ti odgovara"><Text>telefon</Text></Disclosure>);
  expect(row('Kontakt').props.accessibilityState).toEqual({ expanded: false });
  expect(flat(surface('Kontakt')).minHeight).toBeGreaterThanOrEqual(56);
  expect(texts()).toEqual(['Kontakt', 'Podeli svoj broj kada ti odgovara']);
  await tap('Kontakt');
  expect(row('Kontakt').props.accessibilityState).toEqual({ expanded: true });
  expect(texts()).toContain('telefon');
  await tap('Kontakt');
  expect(texts()).not.toContain('telefon');
});

it('follows the caller when it owns the state, and tells it what the press asks for', async () => {
  const onToggle = jest.fn();
  await render(<Disclosure label="Uslovi" expanded={false} onToggle={onToggle}><Text>uslovi</Text></Disclosure>);
  await tap('Uslovi');
  expect(onToggle).toHaveBeenCalledWith(true);
  expect(texts()).not.toContain('uslovi');
  await act(async () => tree.update(<Disclosure label="Uslovi" expanded onToggle={onToggle}><Text>uslovi</Text></Disclosure>));
  expect(texts()).toContain('uslovi');
  await tap('Uslovi');
  expect(onToggle).toHaveBeenLastCalledWith(false);
});

it('turns its caret over in 180 ms on a real change, and at once under reduced motion', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  await render(<Disclosure label="Tok Dogovora"><Text>događaji</Text></Disclosure>);
  expect(rotation()).toBe('0deg');
  timing.mockClear();
  await tap('Tok Dogovora');
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 180, useNativeDriver: true }));
  await act(async () => tree.unmount());
  mockReduced = true; timing.mockClear();
  await render(<Disclosure label="Tok Dogovora"><Text>događaji</Text></Disclosure>);
  await tap('Tok Dogovora');
  expect(timing).not.toHaveBeenCalled();
  expect(rotation()).toBe('180deg');
});

it('speaks its hint with the label, since the hint is a fact about what the row holds', async () => {
  await render(<Disclosure label="Kontakt" hint="Tvoj broj je podeljen"><Text>broj</Text></Disclosure>);
  expect(row('Kontakt').props.accessibilityHint).toBe('Tvoj broj je podeljen');
  await act(async () => tree.unmount());
  await render(<Disclosure label="Uslovi"><Text>uslovi</Text></Disclosure>);
  expect(row('Uslovi').props.accessibilityHint).toBeUndefined();
});

it('lines what it opens up under the label when the row has a picture', async () => {
  await render(<Disclosure label="Lokacija i pristup" art="lock" defaultExpanded><Text>tačna adresa</Text></Disclosure>);
  const body = tree.root.findAllByType(Text).find(node => node.props.children === 'tačna adresa')!.parent!;
  // Updated 2026-09-24: the gap after the 32 px art column moved from 14 onto the sys.space scale (md, 12).
  expect(flat(body).paddingLeft).toBe(32 + sys.space.md);
});

it('keeps its spacing on the sys.space scale; a list inside a card is inset by the card\'s own padding', async () => {
  await render(<Disclosure label="Opis" inset defaultExpanded><Text>opis</Text></Disclosure>);
  const scale = new Set<number>(Object.values(sys.space));
  const surfaceStyle = flat(surface('Opis'));
  expect(surfaceStyle).toMatchObject({ paddingHorizontal: sys.space.lg, paddingVertical: sys.space.md });
  expect(scale.has(surfaceStyle.gap as number)).toBe(true);
  const body = tree.root.findAllByType(Text).find(node => node.props.children === 'opis')!.parent!;
  expect(flat(body)).toMatchObject({ paddingHorizontal: sys.space.lg, paddingBottom: sys.space.base, gap: sys.space.md });
});

it('draws a list of its rows in a plain column, with the hairline between rows but not above the first (`divider`, `inset`)', async () => {
  const toggle = jest.fn();
  // (`DisclosureGroup`, the card these rows once stood in, had no user and is gone; a plain column holds them.)
  await render(<View>
    <Disclosure label="Opis" hint="Šta treba uraditi" expanded={false} onToggle={toggle} divider={false} inset><Text>opis</Text></Disclosure>
    <Disclosure label="Uslovi" expanded onToggle={toggle} divider inset><Text>uslovi</Text></Disclosure>
  </View>);
  expect(tree.root.findAllByType(Disclosure)).toHaveLength(2);
  const [first, second] = tree.root.findAllByType(Disclosure);
  expect(first.props).toMatchObject({ label: 'Opis', hint: 'Šta treba uraditi', expanded: false, divider: false, inset: true });
  expect(second.props).toMatchObject({ label: 'Uslovi', expanded: true, divider: true });
  expect(row('Uslovi').props.accessibilityState).toEqual({ expanded: true });
  expect(texts()).toContain('uslovi'); expect(texts()).not.toContain('opis');
  await tap('Opis');
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(flat(second.children[0] as ReactTestInstance)).toMatchObject({ borderTopWidth: 1, borderTopColor: sys.color.line });
  expect(flat(first.children[0] as ReactTestInstance).borderTopWidth).toBeUndefined();
});

it('draws the Dogovor\'s AgreementSection through it: closed until pressed, and with no line above it (sections are separated by space, UI pass 2026-10-08)', async () => {
  await render(<AgreementSection art="phone" label="Kontakt" summary="Tvoj broj je podeljen"><Text>broj</Text></AgreementSection>);
  expect(tree.root.findByType(Disclosure).props).toMatchObject({ label: 'Kontakt', hint: 'Tvoj broj je podeljen', art: 'phone' });
  expect(tree.root.findByType(Disclosure).props.divider).toBeFalsy();
  expect(row('Kontakt').props.accessibilityState).toEqual({ expanded: false });
  expect(texts()).not.toContain('broj');
  await tap('Kontakt');
  expect(texts()).toContain('broj');
});
