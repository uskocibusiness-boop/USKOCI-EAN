import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockStored = new Map<string, string>();
let mockRead: (key: string) => Promise<string | null>;
let mockWrite: (key: string, value: string) => Promise<void>;
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (key: string) => mockRead(key), setItem: (key: string, value: string) => mockWrite(key, value) } }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return key === 'View' ? 'View' : Reflect.get(target, key); } }); });
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import { HOW_IT_WORKS_KEY, HOW_IT_WORKS_STEPS, HowItWorks, forgetHiddenHowItWorks, useHowItWorks } from '../HowItWorks';

/**
 * "Kako radi" (design proposal N4): drawn only after the device's receipt has answered, hidden for good with one touch, and the
 * hide holds even when the device cannot write. The receipt is cosmetic: it never blocks the screen and holds no account data.
 */
let tree: ReactTestRenderer | undefined;
const rows = () => tree!.root.findAll(node => String(node.type) === 'View' && node.props.testID === 'how-it-works');
const hide = () => tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Sakrij')[0];
const mount = async (element: React.ReactElement = <HowItWorks stacked={false} />) => { await act(async () => { tree = create(element); }); };
const never = () => new Promise<never>(() => {});

beforeEach(() => {
  jest.useFakeTimers(); mockStored.clear(); forgetHiddenHowItWorks();
  mockRead = async key => mockStored.get(key) ?? null;
  mockWrite = async (key, value) => { mockStored.set(key, value); };
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; jest.useRealTimers(); });

it('says its three steps in the order of a task\'s life, in the proposal\'s own words', async () => {
  expect(HOW_IT_WORKS_STEPS.map(step => [step.title, step.note])).toEqual([
    ['Objavi ili nađi', 'Zadatak'], ['Dogovorite se', 'Prijava i poruke'], ['Oceni', 'Posle završetka']]);
  expect(HOW_IT_WORKS_STEPS.map(step => step.art)).toEqual(['publish', 'agreements', 'star']);
});

it('is drawn once the device has answered that it was not hidden', async () => {
  await mount();
  expect(rows()).toHaveLength(1);
});

it('is not drawn while the device has not answered, and then not at all if it answers "hidden"', async () => {
  let answer!: (value: string | null) => void;
  mockRead = () => new Promise(resolve => { answer = resolve; });
  await mount();
  expect(rows()).toHaveLength(0);
  await act(async () => { answer('1'); });
  expect(rows()).toHaveLength(0);
});

it('does not hold the screen up for a device that does not answer: it is drawn after half a second', async () => {
  mockRead = never;
  await mount();
  expect(rows()).toHaveLength(0);
  await act(async () => { jest.advanceTimersByTime(499); });
  expect(rows()).toHaveLength(0);
  await act(async () => { jest.advanceTimersByTime(2); });
  expect(rows()).toHaveLength(1);
});

it('hides again when a slow device finally says it was hidden, and ignores a late "not hidden"', async () => {
  let answer!: (value: string | null) => void;
  mockRead = () => new Promise(resolve => { answer = resolve; });
  await mount();
  await act(async () => { jest.advanceTimersByTime(600); });
  expect(rows()).toHaveLength(1);
  await act(async () => { answer('1'); });
  expect(rows()).toHaveLength(0);
  await act(async () => tree!.unmount());
  mockRead = () => new Promise(resolve => { answer = resolve; });
  forgetHiddenHowItWorks();
  await mount();
  await act(async () => { jest.advanceTimersByTime(600); });
  await act(async () => { answer(null); });
  expect(rows()).toHaveLength(1);
});

it('is hidden with one touch, written once, and never comes back on this device', async () => {
  const written: [string, string][] = [];
  mockWrite = async (key, value) => { written.push([key, value]); mockStored.set(key, value); };
  await mount();
  await act(async () => hide().props.onPress());
  expect(rows()).toHaveLength(0);
  expect(written).toEqual([[HOW_IT_WORKS_KEY, '1']]);
  // A new open, as on the next launch.
  forgetHiddenHowItWorks();
  await act(async () => tree!.unmount()); await mount();
  expect(rows()).toHaveLength(0);
  expect(HOW_IT_WORKS_KEY).toBe('uskoci.home.how-it-works-hidden.v1');
});

it.each([
  ['a write that is refused', () => { mockWrite = async () => { throw new Error('storage offline'); }; }],
  ['a write that throws at once', () => { mockWrite = (() => { throw new Error('native module missing'); }) as never; }],
])('still hides, for as long as the app runs, with %s', async (_name, arrange) => {
  arrange();
  await mount();
  await act(async () => hide().props.onPress());
  expect(rows()).toHaveLength(0);
  // Opened again in the same run: still hidden, and nothing was read to decide it.
  const read = jest.fn(async () => null); mockRead = read;
  await act(async () => tree!.unmount()); await mount();
  expect(rows()).toHaveLength(0); expect(read).not.toHaveBeenCalled();
});

it.each([
  ['a read that is refused', () => { mockRead = async () => { throw new Error('storage offline'); }; }],
  ['a read that throws at once', () => { mockRead = (() => { throw new Error('native module missing'); }) as never; }],
])('is drawn when the device cannot be read (%s): an unreadable receipt is no reason to withhold it', async (_name, arrange) => {
  arrange();
  await mount();
  expect(rows()).toHaveLength(1);
});

it('lays the steps out in a row, or in a column when there is no room, and "Sakrij" stays a 44 dp button either way', async () => {
  for (const stacked of [false, true]) {
    await mount(<HowItWorks stacked={stacked} />);
    const steps = tree!.root.findAll(node => String(node.type) === 'View' && String(node.props.accessibilityLabel).startsWith('1. Objavi ili nađi'));
    expect(steps).toHaveLength(1);
    const flat = Object.assign({}, ...[steps[0].props.style].flat(3).filter(Boolean));
    expect(flat.flexDirection).toBe(stacked ? 'column' : 'row');
    const style = Object.assign({}, ...[hide().props.style].flat(3).filter(Boolean));
    expect(style.minHeight).toBeGreaterThanOrEqual(44); expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(hide().props.accessibilityRole).toBe('button'); expect(hide().props.accessibilityHint).toBe('Red se više ne prikazuje.');
    await act(async () => tree!.unmount());
  }
});

it('the hook alone: visible only after a "not hidden" answer, and a hide is final', async () => {
  const seen: boolean[] = [];
  let hideNow: () => void = () => {};
  function Probe() { const state = useHowItWorks(); seen.push(state.visible); hideNow = state.hide; return null; }
  await mount(<Probe />);
  expect(seen[0]).toBe(false); expect(seen.at(-1)).toBe(true);
  await act(async () => hideNow());
  expect(seen.at(-1)).toBe(false);
  expect(mockStored.get(HOW_IT_WORKS_KEY)).toBe('1');
});
