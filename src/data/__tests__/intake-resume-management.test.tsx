import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID = '11111111-1111-4111-8111-111111111111';
let mockSession = { user: { id: ACCOUNT }, accountRevision: 1 }, mockFocused = true, mockAppState = 'active';
const mockListeners = new Set<(state: string) => void>();
const mockApi = { listOpenIntakes: jest.fn(), abandonConversation: jest.fn() }, mockLifecycle = jest.fn();
jest.mock('../index', () => ({ get aiNeedV2Izvor() { return mockApi; } }));
jest.mock('../aiOpenIntakes', () => ({ OPEN_INTAKE_PAGE_SIZE: 20, readIntakeLifecycle: (...args: unknown[]) => mockLifecycle(...args) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'View') return 'View';
    if (key === 'AppState') return {
      get currentState() { return mockAppState; }, addEventListener: (_: string, callback: (state: string) => void) => {
        mockListeners.add(callback); return { remove: () => mockListeners.delete(callback) };
      },
    };
    return Reflect.get(target, key);
  } });
});
jest.mock('../../ui/product/ProductSheet', () => ({ ProductSheet: ({ children, onClose, ...props }: any) =>
  require('react').createElement('Sheet', { ...props, onClose }, children(onClose)) }));
jest.mock('../../ui/system/ConfirmSheet', () => ({ useConfirmSheet: () => {
  const React = require('react'), [request, setRequest] = React.useState(null);
  return { ask: setRequest, sheet: request ? React.createElement('Confirm', { ...request, cancel: () => { request.onCancel?.(); setRequest(null); } }) : null };
} }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'Art' }));
jest.mock('../../ui/system/ListRow', () => ({ ListRow: 'Row' }));
jest.mock('../../ui/system/ScreenChrome', () => ({ ChromeIconButton: 'Icon' }));
jest.mock('../../ui/system/Section', () => ({ Section: ({ children }: any) => require('react').createElement('Section', null, children) }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { IntakeResume } from '../../ui/home/IntakeResume';

const item = () => ({ id: ID, createdAt: '2026-10-20T10:00:00.123456Z', title: 'Izrada 3D figurica' });
const page = () => ({ rows: [item()], next: null });
const life = (status = 'OPEN', boundNeedId: string | null = null) => ({ id: ID, status, boundNeedId });
const success = () => ({ ok: true, podatak: { conversationId: ID, status: 'ABANDONED', authoritative: true, idempotentReplay: false } });
const defer = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let tree: ReactTestRenderer;
const onOpen = jest.fn();
const render = async () => act(async () => { tree = create(<IntakeResume onOpen={onOpen} />); });
const refresh = async () => act(async () => { tree.update(<IntakeResume onOpen={onOpen} />); });
const action = (label: string) => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === label)!;
const removeIcon = () => tree.root.findAllByType('Icon' as React.ElementType)
  .find(node => node.props.label === 'Napusti razgovor: Izrada 3D figurica');
const rows = () => tree.root.findAllByType('Row' as React.ElementType);
const words = () => tree.root.findAllByType('T' as React.ElementType).map(node => node.props.children).join(' ');
const manage = async () => act(async () => action('Upravljaj započetim razgovorima').props.onPress());
const askRemove = async () => { await act(async () => removeIcon()!.props.onPress()); return tree.root.findByType('Confirm' as React.ElementType).props; };
beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: ACCOUNT }, accountRevision: 1 }; mockFocused = true; mockAppState = 'active';
  mockApi.listOpenIntakes.mockResolvedValue(page()); mockApi.abandonConversation.mockResolvedValue(success()); mockLifecycle.mockResolvedValue(life());
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('uses the public title for direct resume and keeps management reachable even for one conversation', async () => {
  await render(); expect(rows()[0].props.title).toBe('Izrada 3D figurica');
  await act(async () => rows()[0].props.onPress()); expect(onOpen).toHaveBeenCalledWith(ID);
  await manage(); expect(rows().filter(row => row.props.title === 'Izrada 3D figurica')).toHaveLength(2);
  expect(removeIcon()).toBeDefined(); expect(mockApi.abandonConversation).not.toHaveBeenCalled();
});
it('visibly distinguishes resumable drafts from history and names the non-permanent leave action', async () => {
  await render(); await manage();
  const resume = rows().filter(row => row.props.accessibilityLabel?.startsWith('Nastavi razgovor:')).at(-1)!;
  const remove = removeIcon()!;
  expect(resume.props.arrow).toBe(false);
  expect(words()).toContain('Ovde su samo razgovori koje možeš da nastaviš. Napuštanjem nestaju iz ove liste, ali se ne brišu trajno.');
  expect(remove.props).toMatchObject({ glyph: 'close', tone: 'danger', quiet: true, caption: 'Napusti',
    hint: 'Otvara potvrdu. Razgovor se ne briše trajno.' });
  expect(resume.parent).not.toBe(remove);
  expect(remove.parent).not.toBe(resume);
  await act(async () => resume.props.onPress());
  expect(onOpen).toHaveBeenCalledWith(ID);
  expect(mockApi.abandonConversation).not.toHaveBeenCalled();
});
it('requires clear confirmation, writes once, verifies abandonment, then refreshes without opening the conversation', async () => {
  await render(); await manage(); const question = await askRemove();
  expect(question).toMatchObject({ title: 'Napustiti razgovor?', confirmLabel: 'Napusti razgovor' });
  expect(question.message).toContain('ne brišu trajno'); expect(question.message).toContain('Izrada 3D figurica');
  expect(mockLifecycle).not.toHaveBeenCalled(); expect(mockApi.abandonConversation).not.toHaveBeenCalled();
  mockLifecycle.mockResolvedValueOnce(life()).mockResolvedValueOnce(life('ABANDONED'));
  mockApi.listOpenIntakes.mockResolvedValue({ rows: [], next: null });
  await act(async () => { void question.onConfirm(); void question.onConfirm(); });
  expect(mockApi.abandonConversation.mock.calls).toEqual([[ID]]); expect(mockLifecycle.mock.calls).toEqual([[ID], [ID]]);
  expect(mockApi.listOpenIntakes).toHaveBeenCalledTimes(3); expect(rows()).toHaveLength(0); expect(onOpen).not.toHaveBeenCalled();
});
it('canceling confirmation makes no read or write', async () => {
  await render(); await manage(); await askRemove();
  await act(async () => tree.root.findByType('Confirm' as React.ElementType).props.cancel());
  expect(mockApi.abandonConversation).not.toHaveBeenCalled(); expect(mockLifecycle).not.toHaveBeenCalled();
});
it('keeps an unknown outcome across closing the list, then checks the same ID without replaying the write', async () => {
  mockApi.abandonConversation.mockResolvedValue({ ok: false, kod: 'AI_CONVERSATION_ABANDON_UNCONFIRMED' });
  await render(); await manage(); const oldRemove = removeIcon()!.props.onPress, question = await askRemove();
  await act(async () => question.onConfirm());
  expect(words()).toContain('Ishod napuštanja nije potvrđen'); expect(removeIcon()).toBeUndefined();
  await act(async () => { oldRemove(); void question.onConfirm(); }); expect(mockApi.abandonConversation).toHaveBeenCalledTimes(1);
  await act(async () => tree.root.findByType('Sheet' as React.ElementType).props.onClose());
  await act(async () => rows()[0].props.onPress()); expect(onOpen).not.toHaveBeenCalled();
  expect(action('Proveri stanje razgovora')).toBeDefined();
  mockLifecycle.mockResolvedValue(life('ABANDONED')); mockApi.listOpenIntakes.mockResolvedValue({ rows: [], next: null });
  await act(async () => action('Proveri stanje razgovora').props.onPress());
  expect(mockApi.abandonConversation).toHaveBeenCalledTimes(1); expect(rows()).toHaveLength(0);
});
it('a fresh OPEN read restores choice, but never retries the previous write', async () => {
  mockApi.abandonConversation.mockResolvedValue({ ok: false, kod: 'CONVERSATION_NOT_ABANDONABLE' });
  await render(); await manage(); const question = await askRemove(); await act(async () => question.onConfirm());
  await act(async () => action('Proveri stanje razgovora').props.onPress());
  await act(async () => question.onConfirm());
  expect(removeIcon()).toBeDefined(); expect(mockApi.abandonConversation).toHaveBeenCalledTimes(1);
});
it('keeps a confirmed OPEN conversation reachable when a refreshed list has not returned its row', async () => {
  mockApi.abandonConversation.mockResolvedValue({ ok: false, kod: 'AI_CONVERSATION_ABANDON_UNCONFIRMED' });
  await render(); await manage(); const question = await askRemove();
  await act(async () => question.onConfirm());
  await act(async () => tree.root.findByType('Sheet' as React.ElementType).props.onClose());
  mockApi.listOpenIntakes.mockRejectedValue(new Error('offline'));
  await act(async () => { mockAppState = 'background'; for (const fn of mockListeners) fn('background'); });
  await act(async () => { mockAppState = 'active'; for (const fn of mockListeners) fn('active'); });
  await act(async () => rows()[0].props.onPress());
  mockLifecycle.mockResolvedValue(life('OPEN'));
  await act(async () => action('Proveri stanje razgovora').props.onPress());
  await act(async () => tree.root.findByType('Sheet' as React.ElementType).props.onClose());
  expect(rows()[0].props.title).toBe('Izrada 3D figurica');
  expect(rows()[0].props.subtitle).toContain('lista trenutno nije dostupna');
  await act(async () => rows()[0].props.onPress());
  expect(onOpen).toHaveBeenCalledWith(ID);
  expect(mockApi.abandonConversation).toHaveBeenCalledTimes(1);
});
it.each(['ABANDONED', 'COMPLETED'])('does not write when the confirmation preflight finds %s', async status => {
  await render(); await manage(); const question = await askRemove();
  mockLifecycle.mockResolvedValue(life(status)); mockApi.listOpenIntakes.mockResolvedValue({ rows: [], next: null });
  await act(async () => question.onConfirm()); expect(mockApi.abandonConversation).not.toHaveBeenCalled(); expect(rows()).toHaveLength(0);
});
it('does not abandon an OPEN conversation that has become bound', async () => {
  await render(); await manage(); const question = await askRemove(); mockLifecycle.mockResolvedValue(life('OPEN', OTHER));
  mockApi.listOpenIntakes.mockResolvedValue({ rows: [], next: null });
  await act(async () => question.onConfirm()); expect(mockApi.abandonConversation).not.toHaveBeenCalled();
});
it('does not remove the row on a successful write receipt when the lifecycle readback fails', async () => {
  await render(); await manage(); const question = await askRemove();
  mockLifecycle.mockResolvedValueOnce(life()).mockRejectedValueOnce(new Error('offline'));
  await act(async () => question.onConfirm());
  expect(action('Proveri stanje razgovora')).toBeDefined(); expect(words()).not.toContain('Razgovor je napušten.');
  expect(mockApi.listOpenIntakes).toHaveBeenCalledTimes(1);
});
it.each(['blur', 'background', 'account'])('retires a pending preflight on %s before it can write', async reason => {
  await render(); await manage(); const question = await askRemove(), held = defer<ReturnType<typeof life>>(); mockLifecycle.mockReturnValueOnce(held.promise);
  await act(async () => { void question.onConfirm(); });
  await act(async () => {
    if (reason === 'blur') mockFocused = false;
    if (reason === 'background') { mockAppState = 'background'; for (const fn of mockListeners) fn('background'); }
    if (reason === 'account') mockSession = { user: { id: OTHER }, accountRevision: 2 };
    tree.update(<IntakeResume onOpen={onOpen} />);
  });
  await act(async () => held.resolve(life())); expect(mockApi.abandonConversation).not.toHaveBeenCalled();
  expect(onOpen).not.toHaveBeenCalled();
});
it('retains unknown removal after background/refocus even if the ordinary OPEN list no longer contains it', async () => {
  const held = defer<ReturnType<typeof success>>(); mockApi.abandonConversation.mockReturnValueOnce(held.promise);
  await render(); await manage(); const question = await askRemove(); await act(async () => { void question.onConfirm(); });
  await act(async () => { mockAppState = 'background'; for (const fn of mockListeners) fn('background'); });
  expect(rows()).toHaveLength(0); await act(async () => held.resolve(success()));
  mockApi.listOpenIntakes.mockResolvedValue({ rows: [], next: null });
  await act(async () => { mockAppState = 'active'; for (const fn of mockListeners) fn('active'); });
  await act(async () => rows()[0].props.onPress());
  expect(action('Proveri stanje razgovora')).toBeDefined(); expect(mockApi.abandonConversation).toHaveBeenCalledTimes(1);
  expect(mockLifecycle).toHaveBeenCalledTimes(1); expect(onOpen).not.toHaveBeenCalled();
});
