import React from 'react';
import { Animated } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PotrebaProjekcija, PrilikaProjekcija } from '../../contracts/projections';

let mockReduced = false;
const mockTick = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 361, height: 780, scale: 3, fontScale: 1.15 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/system/haptics', () => ({ tick: (...args: unknown[]) => mockTick(...args) }));
import { ApplicationComposerPresentation, type ApplicationDraft } from '../../ui/v2/ApplicationComposerPresentation';
import { sys } from '../../ui/system/tokens';

/**
 * "Prijava je poslata" (owner's pick of 2026-10-08, "Etiketa odlazi", C): the price tag stands for a moment and then goes up and away
 * (8 dp, fading, 160 ms: leaving is shorter than arriving), a small row "Poslata · iznos" stays in its place, one light tick as it goes; the
 * receipt of what was sent is a panel of rows and the way on stands right under it. Only `transform` and `opacity` move, on the native driver;
 * the words and the amount are final the whole time. Opened again later, or under reduced motion, it is the last frame at once (the tick stays
 * under reduced motion; it does not play for a receipt that was already there).
 */
const need = { id: 'need-1', revizija: 3, naslov: 'Unos ormara', podrucjeTekst: 'Liman 2, Novi Sad', vremeTekst: '26. sep · 10:00–12:00', stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 3, preostalo: 3, popunjeno: 0, udeo: 0 }, rezimCene: 'OFFERS', osnovaCene: null, taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T10:00:00Z' }, uslovi: [] } as unknown as PotrebaProjekcija;
const opportunity = { ...need, primaNovePrijave: true, rokZaPrijaveIso: null } as unknown as PrilikaProjekcija;
const draft: ApplicationDraft = { price: '4500', people: '2', note: 'Dolazimo nas dvojica sa trakama i kombijem.', start: null, end: null };

let tree: ReactTestRenderer;
const element = (patch: Partial<React.ComponentProps<typeof ApplicationComposerPresentation>> = {}) => <ApplicationComposerPresentation need={need} opportunity={opportunity}
  draft={draft} change={jest.fn()} submit={jest.fn()} back={jest.fn()} busy={false} pending={false} uncertain={false} refresh={jest.fn()} error={null}
  confirmed openApplications={jest.fn()} canSubmit {...patch} />;
const text = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
type Timing = { toValue: number; duration: number; delay?: number; useNativeDriver: boolean };
let timing: jest.SpyInstance;
beforeEach(() => { jest.useFakeTimers(); timing = jest.spyOn(Animated, 'timing'); mockTick.mockClear(); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); mockReduced = false; });
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
/** A send that is confirmed while the screen is open: the form is on screen first, then the receipt. */
const sendWhileOpen = async () => {
  await act(async () => { tree = create(element({ confirmed: false })); });
  await act(async () => tree.update(element({ confirmed: true })));
};

it('is the tag, then the small row, then the sentence, the receipt as rows, and the way on under it (no pinned foot)', async () => {
  await sendWhileOpen();
  expect(text()).toBe('Tvoja prijava | Poslata | 4.500 RSD | ukupno | Prijava je poslata. | Ako te izaberu, odmah nastaje Dogovor. | Zadatak | Unos ormara | Ljudi | 2 osobe | Termin | '
    + '26. sep · 10:00–12:00 (po vremenu u Srbiji) | Poruka | Dolazimo nas dvojica sa trakama i kombijem. | Otvori moje prijave | Nazad na zadatak');
  // The tag is the picture of an offer at 96, and the small row has it again at 28, beside the chip of the state.
  expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => `${node.props.kind}:${node.props.size}`)).toEqual(['offers:96', 'offers:28']);
  expect(tree.root.findAll(node => node.props.testID === 'flow-footer')).toHaveLength(0);
  expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Poslata, 4.500 RSD ukupno').length).toBeGreaterThan(0);
  // The tag is decoration: the small row says the state and the amount once.
  expect(tree.root.findAll(node => node.props.accessibilityElementsHidden === true && node.props.importantForAccessibility === 'no-hide-descendants').length).toBeGreaterThan(0);
});

it('says the message as written, and "Bez dodatne poruke." when there is none; and the term the person proposed beside the task\'s own', async () => {
  await act(async () => { tree = create(element({ draft: { ...draft, note: '  ' } })); });
  expect(text()).toContain('Poruka | Bez dodatne poruke.');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(element({ draft: { ...draft, start: '2026-09-26T07:00:00Z', end: '2026-09-26T09:00:00Z' } })); });
  expect(text()).toMatch(/Tvoj predlog · termin zadatka je 26\. sep · 10:00–12:00/);
});

it('lets the tag stand for 400 ms and go in 160 (up 8 dp, fading), brings the row in as it goes, and ticks once when it is gone', async () => {
  await sendWhileOpen();
  const runs = timing.mock.calls.map(call => call[1] as Timing);
  // The tag leaves: after half of an arrival, for an exit, on the native driver; the row rises in over an entrance, a press before the tag is gone.
  expect(runs).toContainEqual(expect.objectContaining({ toValue: 1, duration: sys.motion.exit, delay: sys.motion.arrive.duration / 2, useNativeDriver: true }));
  expect(runs).toContainEqual(expect.objectContaining({ toValue: 1, duration: sys.motion.enter, delay: sys.motion.arrive.duration / 2 + sys.motion.exit - sys.motion.press, useNativeDriver: true }));
  expect(sys.motion.exit).toBeLessThan(sys.motion.enter);
  await advance(sys.motion.arrive.duration / 2 + sys.motion.exit - 1); expect(mockTick).not.toHaveBeenCalled();
  await advance(1); expect(mockTick.mock.calls).toEqual([['light']]);
  await advance(5000); expect(mockTick).toHaveBeenCalledTimes(1);
  // The title is announced: it has just happened.
  expect(tree.root.findAll(node => node.props.children === 'Prijava je poslata.')[0].props.accessibilityRole).toBe('alert');
});

it('is the last frame at once under reduced motion, and keeps its tick (a tick is an outcome, not movement)', async () => {
  mockReduced = true;
  await sendWhileOpen();
  expect(timing).not.toHaveBeenCalled();
  await advance(0); expect(mockTick.mock.calls).toEqual([['light']]);
  expect(text()).toContain('Poslata | 4.500 RSD | ukupno | Prijava je poslata.');
});

it('is the last frame, with no tick, for a receipt that was already there when the screen opened, and is then the screen\'s heading', async () => {
  await act(async () => { tree = create(element()); });
  expect(timing).not.toHaveBeenCalled();
  await advance(5000); expect(mockTick).not.toHaveBeenCalled();
  expect(tree.root.findAll(node => node.props.children === 'Prijava je poslata.')[0].props.accessibilityRole).toBe('header');
});

it('keeps a notice the route set, above the way on, and never loses the way on', async () => {
  await act(async () => { tree = create(element({ error: 'Sačuvana prijava na telefonu se nije mogla pročitati, pa je uklonjena. Proveri svoje prijave.' })); });
  expect(text()).toMatch(/Sačuvana prijava na telefonu.*Otvori moje prijave \| Nazad na zadatak$/);
  const open = jest.fn(), back = jest.fn();
  await act(async () => tree.update(element({ openApplications: open, back })));
  await act(async () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === 'Otvori moje prijave')[0].props.onPress());
  expect(open).toHaveBeenCalledTimes(1);
});
