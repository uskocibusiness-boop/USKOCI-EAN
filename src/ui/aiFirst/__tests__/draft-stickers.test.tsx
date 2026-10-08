import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

let mockReduced = false;
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, fontScale: 1, scale: 3 });
    return ['View', 'ScrollView', 'KeyboardAvoidingView', 'TextInput', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
// The entrance every row asks for is RECORDED (its length, its delay and the place it starts from), so what lands, and from where, can be read back.
type Entrance = { duration: number; delay: number; initial?: Record<string, unknown> };
const mockEntrances: Entrance[] = [];
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  FadeIn: { duration: (duration: number) => ({ duration }) },
  FadeInDown: { duration: (duration: number) => {
    const record: Entrance = { duration, delay: 0 }; mockEntrances.push(record);
    const chain: Record<string, unknown> = { delay: (delay: number) => { record.delay = delay; return chain; }, easing: () => chain,
      withInitialValues: (initial: Record<string, unknown>) => { record.initial = initial; return chain; } };
    return chain;
  } },
  Easing: { bezier: () => (value: number) => value },
  useReducedMotion: () => false, useSharedValue: (value: number) => ({ value, get: () => value, set: (next: number) => { value = next; } }), cancelAnimation: jest.fn(),
  useAnimatedStyle: () => ({}), withDelay: (_d: number, value: unknown) => value, withRepeat: (value: unknown) => value, withTiming: (value: number) => value }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeArea' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'GESTURE_SYNTHETIC' }));
import { DraftCard, draftStickers } from '../../v2/IntakePresentation';
import type { Summary } from '../../v2/draftSummary';
import { useAppear, type AppearList } from '../../system/Appear';
import { sys } from '../../system/tokens';

/**
 * "Sličice slete u nacrt" (owner's pick of 2026-10-08, A): a fact the assistant has understood is a picture that LANDS in the draft, once, from above,
 * WITH its words beside it (the owner's phone, 8 Oct 2026: four pictures with no text said nothing); a fact it has not understood is not drawn (unknown
 * stays quiet); a draft that was already there is simply there; nothing moves under reduced motion; and the words of a fact are never animated, only
 * the container of its picture. The facts stand in the order of the task's own page: what it pays, where, when, how many (and how many is a fact only
 * when it is more than one).
 */
const FULL: Summary = { title: 'Prenos ormana', zone: 'Novi Sad · Liman', schedule: 'Sutra', people: '2 osobe', value: { kind: 'amount', amount: '5.000 RSD', basis: 'ukupno' } };
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockEntrances.length = 0; mockReduced = false; });

/** The conversation's memory of what has landed, kept by something that lives as long as it does (the presentation), as it is in the app. */
let memory: AppearList;
function Harness({ summary, began = 'empty', ready = false, expanded = false }: { summary: Summary; began?: 'empty' | 'full'; ready?: boolean; expanded?: boolean }) {
  memory = useAppear();
  memory.settle(draftStickers(summary), undefined, { afterLoading: began === 'empty' });
  return <DraftCard summary={summary} stillNeeded={ready ? null : 'Opis'} open busy={false} compact={false} canReview onReview={jest.fn()} note={null}
    reviewAtEnd={ready} appear={memory} />;
}
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const strip = () => tree.root.findAllByProps({ testID: 'intake-draft-stickers' }).filter(node => typeof node.type === 'string');
const stickerKinds = () => strip().flatMap(node => node.findAll(child => child.type === ('FactArt' as unknown as React.ElementType)).map(child => child.props.kind));
const stickerWords = () => strip().flatMap(node => node.findAll(child => child.type === ('T' as unknown as React.ElementType)).map(child => child.props.children));
const head = () => tree.root.findByProps({ testID: 'intake-draft-head' });
const actions = () => tree.root.findAllByType('Action' as unknown as React.ElementType);
const quietReview = () => tree.root.findAllByProps({ testID: 'intake-draft-review' }).filter(node => typeof node.type === 'string');
const detailKinds = () => tree.root.findAllByProps({ testID: 'intake-draft-details' }).filter(node => typeof node.type === 'string')
  .flatMap(node => node.findAll(child => child.type === ('FactArt' as unknown as React.ElementType)).map(child => child.props.kind));
const text = () => tree.root.findAll(node => node.type === ('T' as unknown as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const rise = (entrance: Entrance) => (entrance.initial as { translateY?: number } | undefined)?.translateY;

describe('which pictures a draft has', () => {
  it('has one for each fact that was understood, in one order (what it pays, where, when, how many), and none for what was not', () => {
    expect(draftStickers(FULL)).toEqual(['value', 'zone', 'schedule', 'people']);
    expect(draftStickers({ title: null, zone: '', value: null, people: null })).toEqual([]);
    expect(draftStickers({ title: 'x', zone: '', schedule: 'Sutra', value: { kind: 'offers' }, people: null })).toEqual(['value', 'schedule']);
  });

  it('counts people as a fact only when there are more than one: one person says nothing, and the number is not a "0/2"', () => {
    expect(draftStickers({ title: 'x', zone: '', value: null, people: '1 osoba', peopleCount: 1 })).toEqual([]);
    expect(draftStickers({ title: 'x', zone: '', value: null, people: '1 osoba' })).toEqual([]);
    expect(draftStickers({ title: 'x', zone: '', value: null, people: '3 osobe', peopleCount: 3 })).toEqual(['people']);
    expect(draftStickers({ title: 'x', zone: '', value: null, people: '3 osobe' })).toEqual(['people']);
  });
});

describe('the card while the draft is made: one wrapping line of pictures with their words under the title', () => {
  it('draws the picture of every understood fact with its words: a price tag for an amount or the offers tag for "Tražim ponude", a pin or the remote mark, a calendar and people', async () => {
    await render(<Harness summary={FULL} />);
    expect(stickerKinds()).toEqual(['money', 'pin', 'calendar', 'users']);
    // The words stand beside every picture: four pictures with no text said nothing (the owner's phone, 8 Oct 2026).
    expect(stickerWords()).toEqual(['5.000 RSD ukupno', 'Novi Sad · Liman', 'Sutra', 'Treba 2 osobe']);
    await act(async () => tree.unmount());
    await render(<Harness summary={{ ...FULL, zone: 'Na daljinu', value: { kind: 'offers' } }} />);
    expect(stickerKinds()).toEqual(['offers', 'remote', 'calendar', 'users']);
    expect(stickerWords()).toEqual(['Tražim ponude', 'Na daljinu', 'Sutra', 'Treba 2 osobe']);
  });

  it('draws nothing for a fact that is not there: unknown stays quiet, and a draft without a single fact has no row', async () => {
    await render(<Harness summary={{ title: 'Prenos ormana', zone: '', schedule: 'Sutra', value: null, people: null }} />);
    expect(stickerKinds()).toEqual(['calendar']);
    await act(async () => tree.update(<Harness summary={{ title: 'Prenos ormana', zone: '', value: null, people: null }} />));
    expect(strip()).toHaveLength(0);
  });

  it('wraps by whole facts and never cuts a word: a long amount keeps all its words and may shrink, not overflow', async () => {
    await render(<Harness summary={{ ...FULL, value: { kind: 'amount', amount: '100.000.000 RSD', basis: 'ukupno' } }} />);
    const line = StyleSheet.flatten(strip()[0].props.style);
    expect(line).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    const words = strip()[0].findAll(node => node.type === ('T' as unknown as React.ElementType)).find(node => node.props.children === '100.000.000 RSD ukupno')!;
    expect(words.props.numberOfLines).toBeUndefined(); expect(StyleSheet.flatten(words.props.style)).toMatchObject({ flexShrink: 1 });
    expect(StyleSheet.flatten(words.parent!.props.style)).toMatchObject({ flexShrink: 1, maxWidth: '100%' });
  });

  it('is decoration: the card says its facts in words once, as one sentence with the name, so the pictures and their words are not stops of their own', async () => {
    await render(<Harness summary={FULL} />);
    expect(strip()[0].props).toMatchObject({ accessible: false, importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true });
    expect(head().props.accessible).toBe(true);
    // No "Nacrt" and no "Izmena" over the name: the chrome's title already says where the person is.
    expect(head().props.accessibilityLabel).toBe('Prenos ormana, 5.000 RSD ukupno, Novi Sad · Liman, Sutra, Treba 2 osobe');
    expect(text()).not.toMatch(/\bNacrt\b|Izmena|Spremno za pregled/);
  });

  it('says it is a change when it is one, to a screen reader only', async () => {
    await act(async () => { tree = create(<DraftCard summary={FULL} stillNeeded="Opis" open busy={false} compact={false} canReview onReview={jest.fn()} note={null} editing />); });
    expect(head().props.accessibilityLabel.startsWith('Izmena zadatka, Prenos ormana')).toBe(true);
    expect(text()).not.toContain('Izmena');
  });

  it('gives the room to a question about the place: only the name and the note stand, and the review waits', async () => {
    await act(async () => { tree = create(<DraftCard summary={FULL} stillNeeded="tačka na mapi" open busy={false} compact={false} canReview={false} onReview={jest.fn()}
      note="Proveri detalje pre objave." locationEditing />); });
    expect(strip()).toHaveLength(0); expect(quietReview()).toHaveLength(0); expect(actions()).toHaveLength(0);
    expect(head().props.accessibilityLabel).toBe('Prenos ormana');
    expect(text()).toContain('Proveri detalje pre objave.'); expect(text()).not.toContain('Još treba');
  });

  it('lands the pictures of a conversation that began empty, from above and one after another, and never again', async () => {
    await render(<Harness summary={{ title: null, zone: '', value: null, people: null }} />);
    expect(mockEntrances).toHaveLength(0);
    // The assistant understands where, when and how many: they arrive while the person watches.
    await act(async () => tree.update(<Harness summary={{ title: 'Prenos', zone: 'Novi Sad', schedule: 'Sutra', people: '2 osobe', value: null }} />));
    expect(mockEntrances).toHaveLength(3);
    expect(mockEntrances.map(rise)).toEqual([-sys.space.sm, -sys.space.sm, -sys.space.sm]);
    expect(mockEntrances.map(entrance => entrance.delay)).toEqual([0, sys.motion.stagger, 2 * sys.motion.stagger]);
    expect(mockEntrances.every(entrance => entrance.duration === sys.motion.enter)).toBe(true);
    // The same facts read again are silent, and only the one that is new lands.
    await act(async () => tree.update(<Harness summary={{ title: 'Prenos', zone: 'Novi Sad', schedule: 'Sutra', people: '2 osobe', value: null }} />));
    expect(mockEntrances).toHaveLength(3);
    await act(async () => tree.update(<Harness summary={FULL} />));
    expect(mockEntrances).toHaveLength(4);
    expect(stickerKinds()).toEqual(['money', 'pin', 'calendar', 'users']);
  });

  it('is silent for a draft that was already there when the screen opened, and lands only what comes after', async () => {
    await render(<Harness summary={FULL} began="full" />);
    expect(mockEntrances).toHaveLength(0);
    await act(async () => tree.update(<Harness summary={{ ...FULL, schedule: 'Petak' }} began="full" />));
    expect(mockEntrances).toHaveLength(0);          // a fact that changed its words is the same picture, in the same place
    await act(async () => tree.unmount());
    await render(<Harness summary={{ title: 'Prenos', zone: 'Novi Sad', schedule: undefined, people: null, value: null }} began="full" />);
    await act(async () => tree.update(<Harness summary={{ title: 'Prenos', zone: 'Novi Sad', schedule: 'Sutra', people: null, value: null }} began="full" />));
    expect(mockEntrances).toHaveLength(1);
  });

  it('moves nothing under reduced motion, and moves nothing for a card that keeps no memory', async () => {
    mockReduced = true;
    await render(<Harness summary={{ title: null, zone: '', value: null, people: null }} />);
    await act(async () => tree.update(<Harness summary={FULL} />));
    expect(mockEntrances).toHaveLength(0);
    expect(stickerKinds()).toEqual(['money', 'pin', 'calendar', 'users']);
    await act(async () => tree.unmount());
    mockReduced = false;
    await render(<DraftCard summary={FULL} stillNeeded="Opis" open busy={false} compact={false} canReview onReview={jest.fn()} note={null} />);
    expect(mockEntrances).toHaveLength(0);
    expect(stickerKinds()).toEqual(['money', 'pin', 'calendar', 'users']);
  });
});

describe('the ready card and the card of a conversation that is over: each fact a row of its picture and its words', () => {
  it('draws the pictures at 28 in rows when the draft is ready, with the pictures that landed while it was made not landing again', async () => {
    await render(<Harness summary={{ title: 'Prenos', zone: 'Novi Sad', schedule: 'Sutra', people: '2 osobe', value: null }} />);
    expect(mockEntrances).toHaveLength(3);
    await act(async () => tree.update(<Harness summary={{ title: 'Prenos', zone: 'Novi Sad', schedule: 'Sutra', people: '2 osobe', value: null }} ready />));
    // Ready: the facts are rows (the picture and the words), the row of pictures is gone, and the same facts do not land a second time.
    expect(strip()).toHaveLength(0);
    expect(detailKinds()).toEqual(['pin', 'calendar', 'users']);
    expect(tree.root.findAllByProps({ testID: 'intake-draft-details' }).filter(node => typeof node.type === 'string')[0]
      .findAll(node => node.type === ('FactArt' as unknown as React.ElementType)).every(node => node.props.size === 28)).toBe(true);
    expect(mockEntrances).toHaveLength(3);
    const words = tree.root.findAllByProps({ testID: 'intake-draft-details' }).filter(node => typeof node.type === 'string')[0]
      .findAll(node => node.type === ('T' as unknown as React.ElementType)).map(node => node.props.children);
    expect(words).toEqual(['Novi Sad', 'Sutra', 'Treba 2 osobe']);
    // Each row is read by itself, so the name does not read the facts a second time.
    expect(head().props.accessibilityLabel).toBe('Prenos');
  });

  it('lands the rows of a draft that becomes ready all at once, in order, when none of them has been seen yet', async () => {
    await render(<Harness summary={{ title: null, zone: '', value: null, people: null }} ready />);
    await act(async () => tree.update(<Harness summary={FULL} ready />));
    expect(detailKinds()).toEqual(['money', 'pin', 'calendar', 'users']);
    expect(mockEntrances.map(rise)).toEqual([-sys.space.sm, -sys.space.sm, -sys.space.sm, -sys.space.sm]);
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'intake-draft-details' }).props.style).gap).toBe(sys.space.sm);
  });

  it('has ONE green action when it is ready, with the review\'s own name, and no second quiet one beside it', async () => {
    await render(<Harness summary={FULL} ready />);
    expect(quietReview()).toHaveLength(0);
    expect(actions().map(action => action.props.label)).toEqual(['Pregledaj zadatak']);
    await act(async () => tree.unmount());
    await act(async () => { tree = create(<DraftCard summary={FULL} stillNeeded={null} open busy={false} compact={false} canReview onReview={jest.fn()} note={null}
      reviewAtEnd editing reviewLabel="Pregledaj izmene" />); });
    expect(actions().map(action => action.props.label)).toEqual(['Pregledaj izmene']);
  });

  it('has a quiet way to the review while something is missing, as high as a finger, disabled until it is allowed', async () => {
    const review = jest.fn();
    await act(async () => { tree = create(<DraftCard summary={FULL} stillNeeded="Opis" open busy={false} compact={false} canReview={false} onReview={review} note={null} />); });
    expect(actions()).toHaveLength(0); expect(text()).toContain('Još treba: Opis');
    const press = quietReview()[0];
    expect(press.props).toMatchObject({ accessibilityLabel: 'Pregledaj zadatak', disabled: true });
    expect(StyleSheet.flatten(press.props.style).minHeight).toBeGreaterThanOrEqual(48);
    await act(async () => press.props.onPress()); expect(review).not.toHaveBeenCalled();
    await act(async () => tree.update(<DraftCard summary={FULL} stillNeeded="Opis" open busy={false} compact={false} canReview onReview={review} note={null} />));
    await act(async () => quietReview()[0].props.onPress()); expect(review).toHaveBeenCalledTimes(1);
  });

  it('is the final summary of a conversation that is over: the facts as rows and no review of its own (the screen\'s one green action stands where the field was)', async () => {
    await act(async () => { tree = create(<DraftCard summary={FULL} stillNeeded={null} open={false} busy={false} compact={false} canReview onReview={jest.fn()} note={null} ended />); });
    expect(detailKinds()).toEqual(['money', 'pin', 'calendar', 'users']); expect(strip()).toHaveLength(0);
    expect(quietReview()).toHaveLength(0); expect(actions()).toHaveLength(0);
    expect(text()).not.toContain('Još treba');
  });
});
