import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ComponentProps } from 'react';
import { BackHandler } from 'react-native';
import type { ConfirmedLocationPoint, LocationSlot, NeedLocationReview } from '../../contracts/location';
import { pointsMissing } from '../../lib/location';
import { ConversationPointAsk } from '../../ui/location/ConversationPointAsk';
import { LocationPointEditor } from '../../ui/location/LocationPointEditor';
import { LocationMapPreview } from '../../ui/location/LocationMapPreview';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';

/**
 * The conversation asks for the map point, and the ask saves only a fully confirmed set.
 *
 * `need.resolved_location` is the one fact publishing cannot do without and the AI may neither
 * be required nor permitted to produce, so before this the only bridge was a long form that
 * three real drafts never completed. These tests pin the two things that make the new route
 * trustworthy: the ask appears exactly when a point is missing, and every point becomes durable
 * only after that point has been explicitly confirmed by hand.
 */

const CONVERSATION = '22222222-2222-4222-8222-222222222222';
let mockFocused = true;
let mockSession = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(
  () => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
const route = { mode: 'POINT_TO_POINT' as const, start: { city: 'Novi Sad', area: 'Lenke Dunđerski' },
  end: { city: 'Petrovaradin', area: 'Petrovaradinska tvrđava' } };

describe('pointsMissing', () => {
  it('counts the points a topology requires and the ones already confirmed', () => {
    expect(pointsMissing(route, null)).toEqual({ done: 0, total: 2 });
    expect(pointsMissing(route, { points: [{ slot: 'start' }] })).toEqual({ done: 1, total: 2 });
    expect(pointsMissing(route, { points: [{ slot: 'start' }, { slot: 'end' }] })).toEqual({ done: 2, total: 2 });
  });

  it('asks for nothing when the work is remote', () => {
    expect(pointsMissing({ mode: 'REMOTE' }, null)).toEqual({ done: 0, total: 0 });
  });

  it('counts a stationary task as one point', () => {
    expect(pointsMissing({ mode: 'STATIONARY', start: { city: 'Novi Sad' } }, null)).toEqual({ done: 0, total: 1 });
  });

  it('counts every stop on a multi-stop route', () => {
    const geography = { mode: 'MULTI_STOP', start: { city: 'A' }, waypoints: [{ city: 'B' }, { city: 'C' }], end: { city: 'D' } };
    expect(pointsMissing(geography, null)).toEqual({ done: 0, total: 4 });
  });

  it('ignores a confirmed point for a slot the topology no longer has', () => {
    // A route that lost its destination must not look finished because an old end point survives.
    expect(pointsMissing({ mode: 'STATIONARY', start: { city: 'Novi Sad' } },
      { points: [{ slot: 'end' }] })).toEqual({ done: 0, total: 1 });
  });

  it('survives junk instead of a topology or a point set', () => {
    expect(pointsMissing(null, null)).toEqual({ done: 0, total: 0 });
    expect(pointsMissing('Novi Sad', 7)).toEqual({ done: 0, total: 0 });
    expect(pointsMissing(route, { points: 'nope' })).toEqual({ done: 0, total: 2 });
    expect(pointsMissing(route, { points: [null, 3, { slot: 'start' }] })).toEqual({ done: 1, total: 2 });
  });
});

const mockRead = jest.fn(), mockSave = jest.fn();
jest.mock('../locationClientService', () => ({
  needLocationClientService: { read: (...args: unknown[]) => mockRead(...args), save: (...args: unknown[]) => mockSave(...args) },
}));
const resolverDouble = { search: jest.fn(), reverse: jest.fn(), cancel: jest.fn() };
const mockProductionResolver = jest.fn(() => resolverDouble);
jest.mock('../productionLocationResolver', () => ({
  createProductionLocationResolver: () => mockProductionResolver(),
}));
// The point editor reaches the native map; this suite is about the ask, not the map.
jest.mock('../../ui/location/LocationPointEditor', () => ({
  LocationPointEditor: () => null,
}));
jest.mock('../../ui/location/LocationMapPreview', () => ({ LocationMapPreview: () => null }));
// The harness cannot load reanimated, which Press pulls in. Same explicit mocks the other
// screen suites in this directory use.
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));

const review = (points: ConfirmedLocationPoint[] = []): NeedLocationReview => ({
  accountId: '11111111-1111-4111-8111-111111111111', conversationId: CONVERSATION,
  editable: true, confirmed: false, revision: 'a'.repeat(64),
  value: { taskCountryCode: 'RS', geography: route, exactAddress: 'Lenke Dunđerski 11, Novi Sad',
    accessNotes: null, ...(points.length ? { resolvedLocation: { version: 1, points,
      binding: { taskCountryCode: 'RS', geography: route, exactAddress: 'Lenke Dunđerski 11, Novi Sad' } } } : {}) },
});
const point = (slot: LocationSlot): ConfirmedLocationPoint => ({
  slot, latitudeE6: 45_255_000, longitudeE6: 19_845_000, origin: { kind: 'MANUAL_PIN' },
});

describe('the conversation point ask', () => {
  let tree: ReactTestRenderer | undefined;
  beforeEach(() => {
    mockRead.mockReset(); mockSave.mockReset();
    mockFocused = true; mockSession = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
    mockRead.mockResolvedValue({ ok: true, podatak: review() });
    mockSave.mockImplementation(async (command: any) => {
      const points = command.value.resolvedLocation?.points ?? [];
      const revision = (mockSave.mock.calls.length <= 1 ? 'b' : 'c').repeat(64);
      return { ok: true, podatak: { saved: true, idempotentReplay: false,
        review: { ...review(points), confirmed: true, revision, value: command.value } } };
    });
  });
  afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; jest.restoreAllMocks(); });

  const mount = async (onSaved = jest.fn(), onClose = jest.fn(), options: Pick<ComponentProps<typeof ConversationPointAsk>,
    'disabled' | 'onEditingChange' | 'onCloseRequestReady' | 'startEditing'> = {}) => {
    await act(async () => { tree = create(<ConversationPointAsk conversationId={CONVERSATION} onSaved={onSaved} onClose={onClose} {...options} />); });
    return { onSaved, onClose };
  };
  const editor = () => tree!.root.findByType(LocationPointEditor);
  // The confirmed place is one compact line now (owner, 2026-10-07); tapping it is the explicit edit entry.
  const line = () => tree!.root.findByProps({ testID: 'confirmed-place-line' });
  const edit = async () => { await act(async () => line().props.onPress()); };
  type Node = ReturnType<typeof line>;
  const flat = (node: Node): string => node.children.map(child => typeof child === 'string' ? child : flat(child)).join('');
  /** The line's sentences as they read, one per point. */
  const sentences = () => line().findAll(node => String(node.type) === 'T' && node.props.tone === 'muted'
    && node.children.some(child => typeof child !== 'string')).map(flat);
  const slots = () => tree!.root.findAll(node => node.props.accessibilityRole === 'radio');
  const choose = async (label: string) => { await act(async () => {
    slots().find(node => node.props.accessibilityLabel.startsWith(`${label},`))!.props.onPress();
  }); };
  const press = async (label: string) => { await act(async () => tree!.root.findByProps({ label }).props.onPress()); };
  const answer = async (testID: 'confirm-sheet-confirm' | 'confirm-sheet-cancel') => { await act(async () => {
    tree!.root.findByType(ConfirmSheet).findByProps({ testID }).props.onPress();
  }); };

  // Owner, phone test 2026-10-07: the docked "Mesto je potvrđeno / <whole provider label> / Mapa / Izmeni" block got in the
  // way. A saved place is one compact line; its map opens through the edit, never as a second preview beside the thread.
  it('shows a saved route as one compact line in route order, with no map preview, loss warning or write', async () => {
    const start = { ...point('start'), address: 'Sačuvano polazište' };
    const end = { ...point('end'), latitudeE6: 45_250_111, address: 'Sačuvano odredište' };
    mockRead.mockResolvedValue({ ok: true, podatak: review([end, start]) });
    const onEditingChange = jest.fn();
    const { onClose } = await mount(undefined, undefined, { onEditingChange });
    expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(0);
    expect(tree!.root.findAllByType(LocationMapPreview)).toHaveLength(0);
    expect(sentences()).toEqual(['Potvrđeno polazište: Sačuvano polazište', 'Potvrđeno odredište: Sačuvano odredište']);
    expect(line().props).toMatchObject({ accessibilityRole: 'button',
      accessibilityLabel: 'Potvrđeno polazište: Sačuvano polazište. Potvrđeno odredište: Sačuvano odredište' });
    expect(tree!.root.findAllByProps({ label: 'Mapa' })).toHaveLength(0);
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
    expect(onClose).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
    expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('shows a saved work point as "Potvrđeno mesto" without route semantics', async () => {
    const value = review([point('start')]).value;
    const geography = { mode: 'STATIONARY' as const, start: { city: 'Novi Sad' } };
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review(), value: { ...value, geography,
      resolvedLocation: { ...value.resolvedLocation!, binding: { ...value.resolvedLocation!.binding, geography } } } } });
    await mount();
    expect(tree!.root.findAllByType(LocationMapPreview)).toHaveLength(0);
    // A hand-placed pin without an address has no street to show: it is said to be a point on the map, nothing invented.
    expect(sentences()).toEqual(['Potvrđeno mesto: tačka na mapi']);
    expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(0);
  });

  it('opens the editor at once when asked to change a saved place, and a clean close writes nothing', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start'), point('end')]) });
    const onEditingChange = jest.fn();
    const { onClose } = await mount(undefined, undefined, { onEditingChange, startEditing: true });
    expect(tree!.root.findAllByProps({ testID: 'confirmed-place-line' })).toHaveLength(0);
    expect(editor().props.point).toEqual(point('start'));
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    await press('Zatvori');
    expect(onClose).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
    expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('says a saved place can no longer be changed here instead of opening an editor for it', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review([point('start'), point('end')]), editable: false } });
    const { onClose } = await mount(undefined, undefined, { startEditing: true });
    expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(0);
    expect(tree!.root.findAllByProps({ testID: 'confirmed-place-line' })).toHaveLength(0);
    await press('Zatvori'); expect(onClose).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
  });

  it('a saved conversation keeps its confirmed line but offers no edit', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review([point('start'), point('end')]), editable: false } });
    await mount();
    expect(line().props.onPress).toBeUndefined(); expect(line().props.accessibilityRole).toBeUndefined();
    expect(flat(line())).not.toContain('Izmeni');
  });

  it('does not present a full set bound to a different geography as saved', async () => {
    const prior = review([point('start'), point('end')]);
    mockRead.mockResolvedValue({ ok: true, podatak: { ...prior, value: { ...prior.value,
      geography: { ...route, end: { city: 'Beograd' } } } } });
    await mount();
    expect(tree!.root.findAllByType(LocationMapPreview)).toHaveLength(0);
    expect(editor().props.point).toBeUndefined(); expect(editor().props.slot).toBe('start');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('reopens a saved route only explicitly and clean closing keeps its saved baseline', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start'), point('end')]) });
    const onEditingChange = jest.fn();
    const { onClose } = await mount(undefined, undefined, { onEditingChange });
    await edit();
    expect(editor().props.point).toEqual(point('start'));
    expect(tree!.root.findAllByType(LocationMapPreview)).toHaveLength(0);
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    await press('Zatvori');
    expect(onClose).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
    expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('closes the competing-write gate synchronously when an explicit saved-point edit is admitted', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start'), point('end')]) });
    let editingNow = false;
    await mount(undefined, undefined, { onEditingChange: editing => { editingNow = editing; } });
    expect(editingNow).toBe(false);
    const begin = line().props.onPress;
    await act(async () => {
      begin();
      // A retained parent send/review callback can run here, before React's effects.
      expect(editingNow).toBe(true);
    });
  });

  it('warns about an unconfirmed saved-point edit without claiming saved points will be lost', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start'), point('end')]) });
    const { onClose } = await mount();
    await edit();
    await act(async () => editor().props.onInvalidate());
    await press('Zatvori');
    expect(tree!.root.findByType(ConfirmSheet).props).toMatchObject({ title: 'Izmena tačke nije potvrđena',
      message: 'Ako sad izađeš, nepotvrđena izmena se odbacuje. Sačuvane tačke ostaju.' });
    await answer('confirm-sheet-cancel');
    expect(onClose).not.toHaveBeenCalled(); expect(editor().props.point).toEqual(point('start'));
    await press('Zatvori'); await answer('confirm-sheet-confirm');
    expect(onClose).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
  });

  it('warns before dropping the first unconfirmed point even when no points were confirmed', async () => {
    const { onClose } = await mount();
    await act(async () => editor().props.onInvalidate());
    await press('Kasnije');
    expect(tree!.root.findByType(ConfirmSheet).props).toMatchObject({ title: 'Izmena tačke nije potvrđena',
      message: 'Ako sad izađeš, nepotvrđena izmena se odbacuje.' });
    expect(onClose).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
  });

  it('discarding a pending edit restores a clean saved baseline and does not create a second loss warning', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start'), point('end')]) });
    const { onClose } = await mount();
    await edit(); await act(async () => editor().props.onInvalidate());
    await choose('Odredište'); await answer('confirm-sheet-confirm'); await choose('Polazište');
    expect(editor().props.point).toEqual(point('start'));
    await press('Zatvori');
    expect(onClose).toHaveBeenCalledTimes(1); expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('distinguishes a loaded partial baseline from a new edit on the active next point', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start')]) });
    const { onClose } = await mount();
    expect(editor().props.slot).toBe('end');
    await press('Kasnije');
    expect(onClose).toHaveBeenCalledTimes(1); expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    // A fresh visit owns its own baseline; merely loading the saved start did not make it dirty.
    await act(async () => tree!.unmount()); tree = undefined;
    await mount();
    expect(editor().props.slot).toBe('end');
    await act(async () => editor().props.onInvalidate());
    await press('Kasnije');
    expect(tree!.root.findByType(ConfirmSheet).props).toMatchObject({ title: 'Izmena tačke nije potvrđena',
      message: 'Ako sad izađeš, nepotvrđena izmena se odbacuje. Sačuvane tačke ostaju.' });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('returns an explicitly changed full set to its receipt line and uses the new revision on a later edit', async () => {
    const initial = review([point('start'), point('end')]);
    const moved = { ...point('start'), latitudeE6: 45_260_000, address: 'Nova potvrđena tačka' };
    const receipt = { ...review([moved, point('end')]), confirmed: true, revision: 'b'.repeat(64) };
    mockRead.mockResolvedValue({ ok: true, podatak: initial });
    mockSave.mockResolvedValue({ ok: true, podatak: { saved: true, idempotentReplay: false, review: receipt } });
    const onEditingChange = jest.fn(); const { onSaved } = await mount(undefined, undefined, { onEditingChange });
    await edit(); await act(async () => editor().props.onInvalidate());
    expect(mockSave).not.toHaveBeenCalled();
    await act(async () => editor().props.onConfirm(moved));
    expect(mockSave).toHaveBeenCalledTimes(1); expect(onSaved).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].expectedRevision).toBe(initial.revision);
    expect(tree!.root.findAllByType(LocationMapPreview)).toHaveLength(0);
    // The receipt's own points, said once; a pin the person placed by hand is acknowledged as the new place.
    expect(sentences()).toEqual(['U redu, polazište je sada: Nova potvrđena tačka.', 'Potvrđeno odredište: tačka na mapi']);
    expect(line().props.accessibilityLiveRegion).toBe('polite');
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
    await edit();
    expect(editor().props.point).toEqual(moved);
    await act(async () => editor().props.onConfirm(moved));
    expect(mockSave.mock.calls[1][0].expectedRevision).toBe(receipt.revision);
  });

  it('does not read or auto-locate while disabled and starts the first read when enabled', async () => {
    const callbacks = await mount(undefined, undefined, { disabled: true });
    expect(mockRead).not.toHaveBeenCalled(); expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(0);
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} disabled={false} />));
    expect(mockRead).toHaveBeenCalledTimes(1); expect(editor().props.autoLocate).toBe(true);
  });

  it('retires a read disabled in flight and rereads when enabled', async () => {
    let settle!: (value: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(resolve => { settle = resolve; }));
    const callbacks = await mount();
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} disabled />));
    await act(async () => settle({ ok: true, podatak: review([point('start'), point('end')]) }));
    expect(tree!.root.findAllByType(LocationMapPreview)).toHaveLength(0);
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} />));
    expect(mockRead).toHaveBeenCalledTimes(2); expect(editor().props.slot).toBe('start');
  });

  it('freezes active edits and rejects retained confirm and close callbacks across disabled ABA', async () => {
    const onEditingChange = jest.fn(); const callbacks = await mount(undefined, undefined, { onEditingChange });
    await act(async () => editor().props.onConfirm(point('start')));
    const oldConfirm = editor().props.onConfirm, oldClose = tree!.root.findByProps({ label: 'Kasnije' }).props.onPress;
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} disabled onEditingChange={onEditingChange} />));
    expect(editor().props.disabled).toBe(true); expect(editor().props.autoLocate).toBe(false);
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
    await act(async () => { oldConfirm(point('end')); oldClose(); });
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} onEditingChange={onEditingChange} />));
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    await act(async () => { oldConfirm(point('end')); oldClose(); });
    expect(mockSave).toHaveBeenCalledTimes(1); expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalledTimes(1); expect(editor().props.slot).toBe('end');
  });

  it('removes navigation while disabled and rejects a retained edit entry', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start'), point('end')]) });
    const callbacks = await mount();
    const oldEdit = line().props.onPress;
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} disabled />));
    expect(tree!.root.findAllByType(LocationMapPreview)).toHaveLength(0);
    expect(line().props.onPress).toBeUndefined();
    await act(async () => oldEdit());
    expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it.each(['account', 'ABA'] as const)('rejects a saved preview edit entry after %s changes', async reason => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start'), point('end')]) });
    const callbacks = await mount();
    const oldEdit = line().props.onPress;
    mockSession = { user: { id: reason === 'ABA' ? mockSession.user.id : '33333333-3333-4333-8333-333333333333' }, accountRevision: 3 };
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review([point('start'), point('end')]), accountId: mockSession.user.id } });
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} />));
    await act(async () => oldEdit());
    expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(0); expect(mockSave).not.toHaveBeenCalled();
  });

  it('keeps read-only, country-missing and summary states outside the manual-decision interlock', async () => {
    const onEditingChange = jest.fn();
    mockRead.mockResolvedValueOnce({ ok: true, podatak: { ...review(), editable: false } });
    await mount(undefined, undefined, { onEditingChange });
    expect(onEditingChange.mock.calls.every(([value]) => value === false)).toBe(true);
    await act(async () => tree!.unmount()); tree = undefined; onEditingChange.mockClear();
    mockRead.mockResolvedValueOnce({ ok: true, podatak: { ...review(), value: { ...review().value, taskCountryCode: null } } });
    await mount(undefined, undefined, { onEditingChange });
    expect(onEditingChange.mock.calls.every(([value]) => value === false)).toBe(true);
    expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(0);
  });

  it('reports editing transitions without callback-identity toggles and releases the parent on unmount', async () => {
    const first = jest.fn(), latest = jest.fn();
    const callbacks = await mount(undefined, undefined, { onEditingChange: first });
    expect(first).toHaveBeenLastCalledWith(true);
    const calls = first.mock.calls.length;
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} onEditingChange={latest} />));
    expect(first).toHaveBeenCalledTimes(calls); expect(latest).not.toHaveBeenCalled();
    await act(async () => tree!.unmount()); tree = undefined;
    expect(latest).toHaveBeenLastCalledWith(false);
  });

  it('routes both header and Android Back through the pending-edit question and retires handlers on disable', async () => {
    const remove = jest.fn();
    const add = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
    const onCloseRequestReady = jest.fn();
    const callbacks = await mount(undefined, undefined, { onCloseRequestReady });
    const request = onCloseRequestReady.mock.calls.at(-1)![0] as () => void;
    const hardwareBack = add.mock.calls.at(-1)![1];
    await act(async () => editor().props.onInvalidate());
    await act(async () => request());
    expect(tree!.root.findByType(ConfirmSheet).props.title).toBe('Izmena tačke nije potvrđena');
    await answer('confirm-sheet-cancel');
    await act(async () => { expect(hardwareBack({ type: 'hardwareBackPress', timeStamp: 1 })).toBe(true); });
    expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(1); expect(callbacks.onClose).not.toHaveBeenCalled();
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} disabled onCloseRequestReady={onCloseRequestReady} />));
    expect(remove).toHaveBeenCalled(); expect(onCloseRequestReady).toHaveBeenLastCalledWith(null);
    await act(async () => { request(); expect(hardwareBack({ type: 'hardwareBackPress', timeStamp: 2 })).toBe(false); });
    expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(callbacks.onClose).not.toHaveBeenCalled();
  });

  it('shows one route point at a time and advances naturally through the conversation', async () => {
    await mount();
    expect(slots()).toHaveLength(0);
    expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(1);
    expect(editor().props.slot).toBe('start');
    expect(editor().props.initialQuery).toBe('Lenke Dunđerski 11, Novi Sad');
    await act(async () => editor().props.onConfirm(point('start')));
    expect(editor().props.slot).toBe('end');
    expect(editor().props.initialQuery).toBe('Petrovaradinska tvrđava, Petrovaradin');
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].value.resolvedLocation.points).toEqual([point('start')]);
  });

  it('opens the compact work-place editor without a redundant single-slot selector', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review(), value: { ...review().value,
      geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } } } } });
    await mount();
    expect(slots()).toHaveLength(0);
    expect(editor().props.presentation).toBe('conversation');
    expect(editor().props.title).toBe('Mesto zadatka');
    expect(editor().props.slot).toBe('start'); expect(mockSave).not.toHaveBeenCalled();
  });

  it('seeds label-only places and advances through waypoints one at a time', async () => {
    const geography = { mode: 'MULTI_STOP' as const, start: { label: 'Glavna stanica' },
      waypoints: [{ label: 'Botanička bašta' }, { label: 'Park', area: 'Park', city: 'Novi Sad' }], end: { label: 'Muzej' } };
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review(), value: { ...review().value, geography, exactAddress: null } } });
    await mount();
    expect(slots()).toHaveLength(0);
    expect(editor().props.initialQuery).toBe('Glavna stanica');
    await act(async () => editor().props.onConfirm(point('start')));
    expect(editor().props.initialQuery).toBe('Botanička bašta');
    await act(async () => editor().props.onConfirm(point('waypoints/0')));
    expect(editor().props.initialQuery).toBe('Park, Novi Sad');
    await act(async () => editor().props.onConfirm(point('waypoints/1')));
    expect(editor().props.initialQuery).toBe('Muzej');
    expect(mockSave).toHaveBeenCalledTimes(3);
  });

  it('keeps a confirmed start while the conversation advances to the destination', async () => {
    await mount();
    const moved = { ...point('start'), latitudeE6: 45_260_000 };
    await act(async () => editor().props.onConfirm(moved));
    expect(slots()).toHaveLength(0);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].value.resolvedLocation.points).toEqual([moved]);
    expect(editor().props.slot).toBe('end');
    await act(async () => editor().props.onConfirm(point('end')));
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1][0].value.resolvedLocation.points).toEqual([moved, point('end')]);
    expect(mockSave.mock.calls[1][0].expectedRevision).toBe('b'.repeat(64));
  });

  it('asks before switching away from an unconfirmed edit on an explicitly reopened saved route', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start'), point('end')]) });
    await mount();
    await edit();
    await act(async () => editor().props.onInvalidate());
    await choose('Odredište');
    expect(editor().props.slot).toBe('start'); expect(mockSave).not.toHaveBeenCalled();
    await act(async () => tree!.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress());
    expect(editor().props.slot).toBe('start');
    await choose('Odredište');
    await act(async () => tree!.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
    expect(editor().props.slot).toBe('end'); expect(mockSave).not.toHaveBeenCalled();
    await choose('Polazište');
    expect(editor().props.point).toEqual(point('start'));
    expect(slots()[0].props.accessibilityLabel).toContain('Potvrđeno');
  });

  it('keeps multi-stop slot order while showing only the active stop', async () => {
    const stops = { mode: 'MULTI_STOP' as const, start: { city: 'A' }, waypoints: [{ city: 'B' }, { city: 'C' }], end: { city: 'D' } };
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review(), value: { ...review().value, geography: stops, exactAddress: null } } });
    await mount();
    expect(slots()).toHaveLength(0);
    expect(editor().props.slot).toBe('start'); expect(editor().props.initialQuery).toBe('A');
    await act(async () => editor().props.onConfirm(point('start')));
    expect(editor().props.slot).toBe('waypoints/0'); expect(editor().props.initialQuery).toBe('B');
    await act(async () => editor().props.onConfirm(point('waypoints/0')));
    expect(editor().props.slot).toBe('waypoints/1'); expect(editor().props.initialQuery).toBe('C');
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it('rejects an older slot callback and repeated final confirmation while a save is in flight', async () => {
    let settle!: (value: unknown) => void;
    mockSave.mockReturnValueOnce(new Promise(resolve => { settle = resolve; }));
    await mount(); const old = editor().props.onConfirm;
    await act(async () => editor().props.onConfirm(point('start')));
    expect(editor().props.slot).toBe('end'); expect(editor().props.point).toBeUndefined();
    await act(async () => old(point('start')));
    expect(editor().props.slot).toBe('end');
    await act(async () => editor().props.onConfirm(point('end')));
    const final = editor().props.onConfirm;
    await act(async () => { final(point('start')); final(point('start')); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => settle({ ok: true, podatak: { saved: true, idempotentReplay: false, review: review([point('start'), point('end')]) } }));
  });

  it.each(['blur', 'blur-refocus', 'ABA'] as const)('rejects retained map confirmation after %s', async reason => {
    const callbacks = await mount(); const old = editor().props.onConfirm;
    if (reason !== 'ABA') mockFocused = false;
    else mockSession = { user: { id: mockSession.user.id }, accountRevision: 3 };
    await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} />));
    if (reason === 'blur-refocus') {
      mockFocused = true;
      await act(async () => tree!.update(<ConversationPointAsk conversationId={CONVERSATION} {...callbacks} />));
    }
    await act(async () => old(point('start')));
    expect(mockSave).not.toHaveBeenCalled();
    if (reason === 'ABA') expect(editor().props.point).toBeUndefined();
  });

  it('reads the location review for its own conversation', async () => {
    await mount();
    expect(mockRead).toHaveBeenCalledWith(CONVERSATION);
  });

  it('uses the exact spoken address only when it safely matches the active route point', async () => {
    await mount();
    expect(editor().props.slot).toBe('start');
    expect(editor().props.initialQuery).toBe('Lenke Dunđerski 11, Novi Sad');
    expect(editor().props.autoLocate).toBe(true);
  });

  it('hands the editor a resolver that can actually reach the search endpoint', async () => {
    // Without one the editor builds an unconfigured resolver, which answers
    // PROVIDER_ACTIVATION_BLOCKED without a request: the seeded lookup never leaves the device,
    // no pin is placed, and the map opens on half the world. That is what shipped in
    // pkg022-b9231a3 and what this pins closed.
    await mount();
    expect(mockProductionResolver).toHaveBeenCalled();
    expect(editor().props.resolver).toBe(resolverDouble);
  });

  it.each(['Pavla Jurišića Šturma 22', 'Pavla Jurišića Šturma 22, Beograd'])
  ('keeps a route private exact address out of the pickup seed and deduplicates that slot locality for %s', async exactAddress => {
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review(), value: { ...review().value,
      exactAddress, geography: { ...route,
        start: { label: 'Centar', area: 'Centar', city: 'Novi Sad' } } } } });
    await mount();
    expect(editor().props.initialQuery).toBe('Centar, Novi Sad');
    await act(async () => editor().props.onConfirm(point('start')));
    expect(editor().props.initialQuery).toBe('Petrovaradinska tvrđava, Petrovaradin');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('returns to the composer immediately after a durable confirmed start', async () => {
    const { onClose } = await mount();
    await act(async () => editor().props.onConfirm(point('start')));
    expect(editor().props.slot).toBe('end');
    expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => editor().props.onCorrectInConversation());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('persists the confirmed start immediately while keeping publication location incomplete', async () => {
    const { onSaved } = await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].value.resolvedLocation.points).toEqual([point('start')]);
    expect(onSaved).toHaveBeenCalledTimes(1);
    // The second slot is now the one being asked for, seeded from its own public place.
    expect(editor().props.slot).toBe('end');
    expect(editor().props.initialQuery).toBe('Petrovaradinska tvrđava, Petrovaradin');
  });

  it('persists each route point with revision fencing and completes on the final point', async () => {
    const { onSaved } = await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    await act(async () => { editor().props.onConfirm(point('end')); });
    expect(mockSave).toHaveBeenCalledTimes(2);
    const first = mockSave.mock.calls[0][0], second = mockSave.mock.calls[1][0];
    expect(first).toMatchObject({ conversationId: CONVERSATION, expectedRevision: 'a'.repeat(64), confirmed: true });
    expect(first.value.resolvedLocation.points.map((item: ConfirmedLocationPoint) => item.slot)).toEqual(['start']);
    expect(second.expectedRevision).toBe('b'.repeat(64));
    expect(second.value.resolvedLocation.points.map((item: ConfirmedLocationPoint) => item.slot)).toEqual(['start', 'end']);
    expect(second.value.resolvedLocation.binding).toEqual({ taskCountryCode: 'RS', geography: route,
      exactAddress: 'Lenke Dunđerski 11, Novi Sad' });
    expect(onSaved).toHaveBeenCalledTimes(2);
  });

  it('starts from the point already confirmed and asks only for the rest', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start')]) });
    await mount();
    expect(editor().props.slot).toBe('end');
    await act(async () => { editor().props.onConfirm(point('end')); });
    expect(mockSave.mock.calls[0][0].value.resolvedLocation.points).toHaveLength(2);
  });

  it('does not offer the map for a conversation that can no longer be edited', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review(), editable: false } });
    await mount();
    expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('reports a failed point save immediately instead of claiming the place was kept', async () => {
    mockSave.mockResolvedValue({ ok: false, kod: 'NEED_LOCATION_SAVE_UNCONFIRMED', poruka: 'Server nije potvrdio mesto.' });
    const { onSaved } = await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    expect(onSaved).not.toHaveBeenCalled();
    const text = tree!.root.findAll(node => String(node.type) === 'T')
      .flatMap(node => node.children.filter((child): child is string => typeof child === 'string')).join(' ');
    expect(text).toContain('Server nije potvrdio mesto.');
  });

  it('after a failed save the same points can be sent again, and a reload asks before it replaces them', async () => {
    // Review of 2026-09-23: the failed state had no "Sačuvaj ponovo" (the review was dropped), and its "Pokušaj ponovo"
    // re-read the server over the pins the person had just placed.
    mockSave.mockResolvedValueOnce({ ok: false, kod: 'NEED_LOCATION_SAVE_UNCONFIRMED', poruka: 'Server nije potvrdio mesto.' });
    // The question is an in-app ConfirmSheet now (it was Alert.alert); the test answers it with its own buttons.
    const answer = async (testID: 'confirm-sheet-confirm' | 'confirm-sheet-cancel') => {
      await act(async () => { tree!.root.findByType(ConfirmSheet).findByProps({ testID }).props.onPress(); }); };
    await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    const reads = mockRead.mock.calls.length;
    await act(async () => { tree!.root.findByProps({ label: 'Učitaj sačuvano mesto' }).props.onPress(); });
    expect(tree!.root.findByType(ConfirmSheet).props).toMatchObject({ title: 'Učitaj sačuvano mesto?', confirmLabel: 'Učitaj', cancelLabel: 'Odustani', tone: 'danger',
      // One voice without grammatical gender (owner rule): no "koje si potvrdio". Round 2c (verifier vs, should 3): the
      // sentence used to say the unsaved points replace the saved place; the reload does the opposite.
      message: 'Poslednje sačuvano mesto zameniće potvrđene tačke koje još nisu sačuvane.' });
    expect(mockRead).toHaveBeenCalledTimes(reads);
    await answer('confirm-sheet-cancel');
    expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(mockRead).toHaveBeenCalledTimes(reads);
    await act(async () => { tree!.root.findByProps({ label: 'Sačuvaj ponovo' }).props.onPress(); });
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1][0].value.resolvedLocation.points).toEqual(mockSave.mock.calls[0][0].value.resolvedLocation.points);
  });

  it('a confirmed reload replaces the unsaved points only after it is confirmed', async () => {
    mockSave.mockResolvedValueOnce({ ok: false, kod: 'NEED_LOCATION_SAVE_UNCONFIRMED', poruka: 'Server nije potvrdio mesto.' });
    await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    const reads = mockRead.mock.calls.length;
    await act(async () => { tree!.root.findByProps({ label: 'Učitaj sačuvano mesto' }).props.onPress(); });
    const confirmReload = tree!.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress;
    await act(async () => { confirmReload(); confirmReload(); });
    expect(mockRead).toHaveBeenCalledTimes(reads + 1); expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('leaves cleanly after a confirmed partial route because that point is already durable', async () => {
    const { onClose } = await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => { tree!.root.findByProps({ label: 'Kasnije' }).props.onPress(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('keeps several partial route confirmations durable before the final destination', async () => {
    const stops = { mode: 'MULTI_STOP' as const, start: { city: 'Novi Sad' }, waypoints: [{ city: 'Sremski Karlovci' }], end: { city: 'Beočin' } };
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review(), value: { ...review().value, geography: stops } } });
    await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    expect(editor().props.slot).toBe('waypoints/0');
    await act(async () => { editor().props.onConfirm({ ...point('start'), slot: 'waypoints/0' }); });
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1][0].value.resolvedLocation.points.map((item: ConfirmedLocationPoint) => item.slot)).toEqual(['start', 'waypoints/0']);
    await act(async () => { tree!.root.findByProps({ label: 'Kasnije' }).props.onPress(); });
    expect(tree!.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });
});
