import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Pušački test rute `dizajn-var-V3`: svaka scena grupe V3 se crta bez pada, i u zaustavljenom kadru; izdanje za prodavnicu ne pokazuje
 * ništa; nijedna scena ne učitava klijent podataka. Današnji ekrani („sada“) imaju svoje testove, pa ih ovde zamenjuju dvojnici gde vuku
 * sloj podataka (razgovor, nacrt); ostalo je pravo.
 */
let mockPackage: string | undefined = 'rs.uskoci.app.dev';
let mockParams: { scene?: string | string[]; t?: string | string[] } = {};
const mockRouter = { back: jest.fn(), setParams: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-image', () => ({ Image: 'NativeImage' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', G: 'G', Path: 'Path', Rect: 'Rect', Circle: 'Circle', Ellipse: 'Ellipse',
  Defs: 'Defs', ClipPath: 'ClipPath', Image: 'SvgImage', Use: 'Use', LinearGradient: 'LinearGradient', RadialGradient: 'RadialGradient', Stop: 'Stop' }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : String(key) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../../aiFirst/VoiceComposer', () => ({ VoiceComposer: 'VoiceComposer', VoiceNotice: 'VoiceNotice', VoiceMode: 'VoiceMode', HOLD_HINT: 'Drži mikrofon dok govoriš, pa pusti da pošalješ.' }));
jest.mock('../../../aiFirst/AiConversationShell', () => ({ AiConversationShell: 'AiConversationShell' }));
jest.mock('../../../v2/IntakePresentation', () => ({ DraftCard: 'DraftCard', TASK_OPENINGS: ['Treba mi pomoć oko selidbe u subotu, 2 osobe, Novi Sad.'] }));
jest.mock('../../../../data/supabaseClient', () => { throw new Error('Varijante V3 ne smeju da učitaju klijent podataka.'); });

import Ruta from '../../../../app/dizajn-var-V3';
import { SCENE } from '../scena';

let tree: ReactTestRenderer;
const originalDev = __DEV__;
const runtime = globalThis as unknown as { __DEV__: boolean };
const render = async () => { await act(async () => { tree = create(<Ruta />); }); };
const text = () => tree.root.findAll(node => typeof node.type === 'string' && node.type === 'Text' || (typeof node.type !== 'string' && (node.type as { displayName?: string }).displayName === 'Text'))
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');

beforeEach(() => { jest.clearAllMocks(); runtime.__DEV__ = true; mockPackage = 'rs.uskoci.app.dev'; mockParams = {}; });
afterEach(async () => { await act(async () => tree?.unmount()); runtime.__DEV__ = originalDev; });

it('izdanje za prodavnicu ne pokazuje ništa, ma koja scena bila tražena', async () => {
  runtime.__DEV__ = false; mockPackage = 'rs.uskoci.app';
  mockParams = { scene: 'dogovoreno-A' };
  await render();
  expect(text()).toBe('Nije dostupno.');
});

it('bez parametra crta spisak svih scena po ekranu', async () => {
  await render();
  const shown = text();
  for (const scene of SCENE) expect(shown).toContain(scene.naziv);
  expect(shown).toContain('Trenutak „Dogovoreno!“');
});

it('svaka od tri varijante postoji za svaki ekran, uz „sada“', () => {
  for (const ekran of ['kandidati', 'dogovoreno', 'razgovor', 'nacrt', 'objavljeno', 'prijava']) {
    for (const varijanta of ['sada', 'A', 'B', 'C']) expect(SCENE.some(scene => scene.id === `${ekran}-${varijanta}`)).toBe(true);
  }
});

it.each(SCENE.map(scene => [scene.id, scene] as const))('scena %s se crta bez pada i bez poziva navigacije', async (_id, scene) => {
  mockParams = { scene: scene.id };
  await render();
  // Današnji razgovor je dvojnik (njegov omotač vuče sloj podataka i ima svoje testove): tada stoji on, inače reči scene.
  const shell = tree.root.findAll(node => typeof node.type === 'string' && node.type === 'AiConversationShell');
  expect(text().length > 0 || shell.length === 1).toBe(true);
  expect(text()).not.toBe('Nije dostupno.');
  for (const navigate of [mockRouter.push, mockRouter.replace, mockRouter.back]) expect(navigate).not.toHaveBeenCalled();
});

it.each(SCENE.filter(scene => scene.kadrovi).flatMap(scene => scene.kadrovi!.map(t => [scene.id, t] as const)))('kadar %s pri t = %d ms se crta', async (id, t) => {
  mockParams = { scene: id, t: String(t) };
  await render();
  expect(text()).toContain(`t = ${t} ms`);
});

it('nijedan tekst varijanti ne govori „posao“ ni unutrašnje nazive strana', () => {
  const { readFileSync, readdirSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');
  const dir = join(__dirname, '..');
  for (const name of readdirSync(dir).filter((file: string) => /\.tsx?$/.test(file))) {
    const code = readFileSync(join(dir, name), 'utf8').split('\n').filter((line: string) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
    expect([name, /['"„][^'"“]*\bposao\b/i.test(code)]).toEqual([name, false]);
  }
});
