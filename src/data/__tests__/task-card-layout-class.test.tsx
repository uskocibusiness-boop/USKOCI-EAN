import { readFileSync } from 'fs';
import { join } from 'path';
import { INTER_BOLD_ADVANCE, textWidth } from '../../ui/v2/cardHeadFit';
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { MojaPrijavaProjekcija, NeedDetailProjection } from '../../contracts/projections';
import type { MarketplaceItem } from '../marketplaceView';
import { layoutClassFor } from '../../ui/system/textScale';
/** Current visual composition: full-width titles; value/capacity and offers stack for larger text.
 * Keep facts, commands and accessible descriptions across window sizes. Historical title/price adjacency
 * no longer describes TaskCard. The font-table guard remains because the calendar steps
 * still use textWidth for their geometry.
 * Native8d22 evidence at361dp/115%/130% is recorded separately; these are structural safeguards only.
 */
let mockScale = 1, mockWidth = 411;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockScale });
    return key === 'View' ? 'View' : Reflect.get(target, key);
  } });
});
jest.mock('react-native-reanimated', () => {
  const base = jest.requireActual('../../../__mocks__/react-native-reanimated.js'), React = require('react');
  return { ...base, ReduceMotion: { System: 'system' },
    useSharedValue: (value: number) => {
      const ref = React.useRef(null);
      if (!ref.current) { const box = { value, get: () => box.value, set: (next: number) => { box.value = next; } }; ref.current = box; }
      return ref.current;
    },
    useAnimatedStyle: (factory: () => object) => factory() };
});
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('../../ui/system/Glyph', () => ({ Glyph: 'Glyph' }));
jest.mock('phosphor-react-native', () => ({ CaretRight: 'CaretRight', CaretDown: 'CaretDown', Lightning: 'Lightning' }));
import { TaskCard } from '../../ui/v2/TaskCard';
import { ApplicationCard } from '../../ui/v2/ApplicationFace';
import { PrijavaPriceText } from '../../ui/v2/PrijavaCard';

const needs = (patch: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection['zahtevi'] => ({ vestine: [], alati: [], vozila: [], dozvole: [],
  bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false, ...patch });
const detail = (zahtevi: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection =>
  ({ kategorija: 'Krečenje', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: needs(zahtevi) });
/** A stranger's task, the kind the Zadaci list is made of: a person, an amount, a place, a time, a vehicle. */
const task = (patch: Record<string, unknown> = {}): MarketplaceItem => ({ id: 'need-1', naslov: 'Farbanje dnevne sobe', podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: '24. sep · 17:00', statusTekst: 'Otvoren', uslovi: ['Krečenje'], pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: null, narucilacProfilId: 'profile-1', narucilacIme: 'Nikola Petrović', narucilacOcena: '4,8', narucilacBrojOcena: 12,
  rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' },
  detalji: detail({ vozila: ['Kombi'] }), urgency: { level: 'HITNO', expiresAt: '2099-01-01T00:00:00Z' }, ...patch }) as MarketplaceItem;
/** My own task with applications waiting: no person, a note or a waiting line, the count at the end. */
const mine = (patch: Record<string, unknown> = {}): MarketplaceItem => ({ id: 'mine-1', revizija: 1, naslov: 'Montaža dve police', opis: '', stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: '25. sep · 10:00', podrucjeTekst: 'Grbavica, Novi Sad', uslovi: ['Montaža'],
  brojPrijava: 4, brojPrijavaZaIzbor: 3, rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  detalji: detail(), ...patch }) as MarketplaceItem;
const application = (patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({ prijavaId: 'a1', potrebaId: 'n1', potrebaRevizija: 3,
  prijavaRevizija: 3, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: 'Unos ormara', opis: '', cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' },
  pokrivaMesta: 2, napomena: 'Donosim trake.', podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '20. sep · 10:00–11:00', dogovorId: null,
  promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch });
const handlers = () => ({ onTask: jest.fn(), onAgreement: jest.fn(), onWithdraw: jest.fn(), onReview: jest.fn() });

let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => act(async () => { tree = create(element); });
const T_ = 'T' as React.ElementType, VIEW = 'View' as React.ElementType, PRESS = 'Press' as React.ElementType;
const textNode = (value: string) => tree.root.find(node => node.type === T_ && node.props.children === value);
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const presses = () => tree.root.findAll(node => node.type === PRESS);
const spoken = () => presses().map(node => [node.props.accessibilityLabel, node.props.accessibilityValue?.text ?? null, node.props.accessibilityHint ?? null]);
const offerRow = () => tree.root.findByType(PrijavaPriceText).findAllByType(VIEW)[0];
beforeEach(() => { mockScale = 1; mockWidth = 411; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

/** A window and a text scale: what a phone is to the layout. */
const WINDOWS: readonly [width: number, scale: number][] = [
  [411, 1], [411, 1.15], [390, 1], [390, 1.15], [361.14, 1], [361.14, 1.15],
  [340, 1], [340, 1.15], [339.9, 1], [320, 1],
  [411, 1.3], [361.14, 1.3], [361.14, 1.2999999523], [340, 1.3], [320, 1.3], [320, 2],
];

describe('readable layout at demanding screen and text sizes', () => {
  it('gives narrow screens and enlarged text a stacked reading layout', () => {
    expect(layoutClassFor(320, 2).stacked).toBe(true);
  });
});

describe('the task card retains readable facts across screen and text sizes', () => {
  it.each(WINDOWS)('width %s dp, text scale %s: title and publisher remain readable', async (width, scale) => {
    mockWidth = width; mockScale = scale;
    await render(<TaskCard item={task({ naslov: 'Montaža police' })} onOpen={jest.fn()} />);
    expect(textNode('Montaža police').props.numberOfLines).toBeUndefined();
    expect(textNode('Nikola Petrović')).toBeDefined();
    expect(textNode('Treba 2 osobe')).toBeDefined();
  });

  it.each(WINDOWS)('my own task met in discovery, width %s dp, text scale %s: capacity stays a fact without an empty publisher footer', async (width, scale) => {
    mockWidth = width; mockScale = scale;
    await render(<TaskCard item={mine({ brojPrijavaZaIzbor: 0 })} onOpen={jest.fn()} />);
    expect(tree.root.findAll(node => node.type === VIEW && node.props.testID === 'task-face-foot')).toHaveLength(0);
    expect(tree.root.findAll(node => node.type === VIEW && node.props.testID === 'task-face-capacity')).toHaveLength(1);
    expect(textNode('2.000 RSD')).toBeTruthy();
  });

  it('long titles and amounts remain complete when price mode changes', async () => {
    mockWidth = 361.14; mockScale = 1.15;
    const longTitle = 'Prevoz i prenos 4 torbe sa Petrovaradina do centra Novog Sada';
    await render(<TaskCard item={task({ naslov: longTitle })} onOpen={jest.fn()} />);
    expect(textNode(longTitle).props.numberOfLines).toBeUndefined();
    await act(async () => tree.update(<TaskCard item={task({ rezimCene: 'OFFERS' })} onOpen={jest.fn()} />));
    expect(textNode('Tražim ponude')).toBeDefined();
    await act(async () => tree.update(<TaskCard item={task({ ponudjenaCena: { iznos: 1250000, valuta: 'RSD', prikaz: '1.250.000 RSD' } })} onOpen={jest.fn()} />));
    expect(textNode('1.250.000 RSD').props.numberOfLines).toBeUndefined();
  });
});

describe('my application retains its offer across screen and text sizes', () => {
  it.each(WINDOWS)('width %s dp, text scale %s: title and offer remain complete', async (width, scale) => {
    mockWidth = width; mockScale = scale;
    await render(<ApplicationCard row={application()} {...handlers()} />);
    const amount = textNode('4.500 RSD');
    expect(amount.props.numberOfLines).toBeUndefined();
    expect(textNode('ukupno')).toBeDefined();
    expect(textNode('Unos ormara').props.numberOfLines).toBeUndefined();
  });

  it('the gallery can request the large reading layout on a roomy phone', async () => {
    mockWidth = 411; mockScale = 1;
    await render(<ApplicationCard row={application()} large {...handlers()} />);
    expect(style(offerRow()).flexDirection).toBe('column');
    expect(textNode('4.500 RSD').props.numberOfLines).toBeUndefined();
  });
});

describe('what a screen reader hears does not depend on the layout', () => {
  // The count of people is said in words, and only when the task needs more than one ("0/1" meant nothing: the owner's phone of 8 Oct 2026).
  const HEARD_TASK = 'HITNO, Budžet 5.500 RSD ukupno, Liman, Novi Sad, 24. sep · 17:00, Potrebno vozilo: Kombi, Treba 2 osobe, Nikola Petrović, ocena 4,8, 12 ocena';
  const HEARD_MINE = 'Budžet 2.000 RSD po osobi, Grbavica, Novi Sad, 25. sep · 10:00, Treba 2 osobe';
  const HEARD_APPLICATION = 'Poslata, 20. sep · 10:00–11:00, ponuda 4.500 RSD ukupno, 2 osobe, tvoja poruka: Donosim trake.';

  it.each(WINDOWS)('width %s dp, text scale %s: the command name and every word are the same sentence', async (width, scale) => {
    mockWidth = width; mockScale = scale;
    // The task card says all of it as its own label: the command name, then every fact (one press, no value apart).
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(spoken()).toEqual([[`Otvori zadatak Farbanje dnevne sobe. ${HEARD_TASK}`, null, null]]);
    await act(async () => tree.update(<TaskCard item={mine()} onOpen={jest.fn()} />));
    expect(spoken()).toEqual([[`Otvori zadatak Montaža dve police. ${HEARD_MINE}`, null, null]]);
    await act(async () => tree.update(<ApplicationCard row={application()} {...handlers()} />));
    expect(spoken()).toEqual([['Otvori zadatak: Unos ormara', HEARD_APPLICATION, null], ['Povuci prijavu: Unos ormara', null, 'Pre povlačenja te pitamo da potvrdiš.']]);
  });
});

test.each(WINDOWS)('long monetary values retain the complete amount and basis at%sdp/%s', async (width, scale) => {
  mockWidth=width; mockScale=scale;
  await render(<TaskCard item={task({ ponudjenaCena: { iznos: 1250000, valuta: 'RSD', prikaz: '1.250.000 RSD' } })} onOpen={jest.fn()} />);
  expect(textNode('1.250.000 RSD').props.numberOfLines).toBeUndefined();
  expect(textNode('ukupno')).toBeTruthy();
  await act(async () => tree.update(<ApplicationCard row={application({ cena: { iznos: 999999, valuta: 'RSD', prikaz: '999.999 RSD' } })} {...handlers()} />));
  expect(textNode('999.999 RSD').props.numberOfLines).toBeUndefined();
  expect(textNode('ukupno')).toBeTruthy();
  expect(style(offerRow()).flexWrap).toBe('wrap');
});

// Preserve the independent bundled-font guard of textWidth (ownTaskTabs, its first user, was retired on 8 Oct 2026 with the phase groups of Moji zadaci). This is arithmetic, not native pixel-fit proof.
type Face = { upm: number; advance: (character: string) => number };
const font = (file: string): Face => {
  const bytes = readFileSync(join(__dirname, '../../../assets/fonts/inter', file));
  const tables: Record<string, number> = {};
  for (let table = 0; table < bytes.readUInt16BE(4); table++) tables[bytes.toString('latin1', 12 + table * 16, 16 + table * 16)] = bytes.readUInt32BE(20 + table * 16);
  const upm = bytes.readUInt16BE(tables.head + 18), metrics = bytes.readUInt16BE(tables.hhea + 34);
  const advanceOf = (glyph: number) => bytes.readUInt16BE(tables.hmtx + 4 * Math.min(glyph, metrics - 1));
  let format12 = -1, format4 = -1;
  for (let sub = 0; sub < bytes.readUInt16BE(tables.cmap + 2); sub++) {
    const at = tables.cmap + bytes.readUInt32BE(tables.cmap + 8 + 8 * sub), format = bytes.readUInt16BE(at);
    if (format === 12) format12 = at; else if (format === 4 && format4 < 0) format4 = at;
  }
  const glyphOf = (code: number): number => {
    if (format12 >= 0) {
      for (let group = 0; group < bytes.readUInt32BE(format12 + 12); group++) {
        const at = format12 + 16 + 12 * group, first = bytes.readUInt32BE(at);
        if (code >= first && code <= bytes.readUInt32BE(at + 4)) return bytes.readUInt32BE(at + 8) + code - first;
      }
      return 0;
    }
    const segments = bytes.readUInt16BE(format4 + 6) / 2, ends = format4 + 14, starts = ends + 2 * segments + 2, deltas = starts + 2 * segments, ranges = deltas + 2 * segments;
    for (let segment = 0; segment < segments; segment++) {
      if (code > bytes.readUInt16BE(ends + 2 * segment)) continue;
      const start = bytes.readUInt16BE(starts + 2 * segment);
      if (code < start) return 0;
      const range = bytes.readUInt16BE(ranges + 2 * segment), delta = bytes.readInt16BE(deltas + 2 * segment);
      if (range === 0) return (code + delta) & 0xffff;
      const glyph = bytes.readUInt16BE(ranges + 2 * segment + range + 2 * (code - start));
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
  return { upm, advance: character => advanceOf(glyphOf(character.codePointAt(0)!)) };
};
const BOLD = font('Inter-Bold.ttf');
/** The width of `text` in dp at `size` sp and `scale`, with every digit as wide as the widest. */
const widthDp = (face: Face, text: string, size: number, scale: number) => {
  const widest = Math.max(...[...'0123456789'].map(face.advance));
  return [...text].reduce((sum, character) => sum + (/\d/.test(character) ? widest : face.advance(character)), 0) / face.upm * size * scale;
};

const titleWidth = (text: string, size: number, scale: number) => [...text].reduce((sum, character) => sum + BOLD.advance(character), 0) / BOLD.upm * size * scale;
  it('knows the width of every glyph it measures: the table is the bundled font, not a copy that drifted', () => {
    for (const [character, units] of Object.entries(INTER_BOLD_ADVANCE)) {
      expect([character, Math.abs(Math.round(BOLD.advance(character) / BOLD.upm * 1000) - units) <= 1]).toEqual([character, true]);
    }
    // And it has every letter of the Serbian Latin alphabet in both cases, the digits and the space.
    for (const character of 'abcdefghijklmnoprstuvzčćšđžABCDEFGHIJKLMNOPRSTUVZČĆŠĐŽ0123456789 ') expect([character, character in INTER_BOLD_ADVANCE]).toEqual([character, true]);
    // The estimate measures like the reader above, apart from the digits of a price (tabular: all as wide as the widest).
    expect(textWidth('Farbanje dnevne sobe', 20)).toBeCloseTo(titleWidth('Farbanje dnevne sobe', 20, 1), 0);
    expect(textWidth('5.500 RSD', 20, true)).toBeCloseTo(widthDp(BOLD, '5.500 RSD', 20, 1), 0);
    // A glyph that is not in the table is taken as wide as the widest, never as nothing.
    expect(textWidth('ß', 20)).toBeGreaterThanOrEqual(textWidth('W', 20));
  });
