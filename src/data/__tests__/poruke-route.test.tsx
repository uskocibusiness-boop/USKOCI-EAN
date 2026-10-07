import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ConversationInboxItem } from '../../contracts/conversationInbox';
const ACCOUNT = '10000000-0000-4000-8000-000000000001';
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
let mockBuilt = true;
let mockAppState = 'active';
let mockCanOpen = true;
let mockState: Record<string, unknown>;
const mockModel = { canOpen: jest.fn(() => mockCanOpen), refresh: jest.fn(), more: jest.fn() };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { get currentState() { return mockAppState; }, addEventListener: () => ({ remove: () => {} }) };
    if (key === 'FlatList') return (p: any) => require('react').createElement('List', p, p.ListHeaderComponent,
      p.data.length ? p.data.map((item: any) => require('react').createElement('Row', { key: p.keyExtractor(item) }, p.renderItem({ item }))) : p.ListEmptyComponent, p.ListFooterComponent);
    return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../conversationInboxGate', () => ({ conversationInboxBuilt: () => mockBuilt }));
jest.mock('../../hooks/useConversationInbox', () => ({ useConversationInbox: () => ({ state: mockState, model: mockModel }) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: ACCOUNT }, accountRevision: 0 }), sesijaSada: () => ({ user: { id: ACCOUNT }, accountRevision: 0 }) }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/system/ScreenHeader', () => ({ ScreenHeader: 'ScreenHeader' }));
jest.mock('../../ui/system/ActualUserAvatar', () => ({ ActualUserAvatar: 'ActualUserAvatar' }));
jest.mock('../../ui/system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../ui/system/StateView', () => ({ StateView: 'StateView' }));
jest.mock('../../ui/system/ConversationArt', () => ({ ConversationArt: 'ConversationArt' }));
import Poruke from '../../app/(app)/poruke';

/**
 * The Poruke tab's route (team T3c): a tap on a row opens THAT conversation, never the list of Dogovori. A private conversation opens
 * the Poruke tab of its Dogovor; a group opens the group. Opening is fenced the way it always was: one tap makes one navigation, a
 * model that does not admit the row, a backgrounded app and a retired account open nothing.
 */
const personal = { kind: 'AGREEMENT', id: '20000000-0000-4000-8000-000000000001', routeAgreementId: '20000000-0000-4000-8000-000000000001',
  task: { id: '90000000-0000-4000-8000-000000000001', title: 'Sastavljanje IKEA ormara' }, counterpart: { profileId: '80000000-0000-4000-8000-000000000001', displayName: 'Jovana' },
  lastMessage: { id: '70000000-0000-4000-8000-000000000001', createdAt: new Date().toISOString(), mine: false, kind: 'TEXT', preview: 'Gotovo.' }, unreadMessageCount: null } as ConversationInboxItem;
const shared = { kind: 'GROUP', id: '30000000-0000-4000-8000-000000000001', routeAgreementId: '20000000-0000-4000-8000-000000000002',
  task: { id: '90000000-0000-4000-8000-000000000002', title: 'Selidba garsonjere u Zemunu' }, counterpart: null,
  lastMessage: { id: '70000000-0000-4000-8000-000000000002', createdAt: new Date().toISOString(), mine: false, kind: 'TEXT', preview: 'Kamion stiže u 18:30' }, unreadMessageCount: 2 } as ConversationInboxItem;
let tree: ReactTestRenderer;
const rows = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'button');
const render = async () => { await act(async () => { tree = create(<Poruke />); }); };
beforeEach(() => {
  jest.clearAllMocks(); mockBuilt = true; mockAppState = 'active'; mockCanOpen = true;
  mockState = { page: { items: [personal, shared], nextCursor: null }, loading: false, refreshing: false, paging: false, stale: false, error: null };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('a tap opens that conversation', () => {
  it('a private conversation opens the Poruke tab of its own Dogovor, remembering that it came from the list', async () => {
    await render();
    await act(async () => rows()[0].props.onPress());
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: personal.routeAgreementId, tab: 'poruke', from: 'poruke' } });
  });

  it('a group opens the group of that Dogovor', async () => {
    await render();
    await act(async () => rows()[1].props.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dogovor/[id]/grupa', params: { id: shared.routeAgreementId, from: 'poruke' } });
  });

  it('never goes to the list of Dogovori', async () => {
    for (const index of [0, 1]) {
      // A fresh visit each time: one visit opens one conversation.
      await render();
      await act(async () => rows()[index].props.onPress());
      await act(async () => tree.unmount());
    }
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
    for (const call of [...mockRouter.push.mock.calls, ...mockRouter.replace.mock.calls]) expect(JSON.stringify(call)).not.toContain('/dogovori');
  });

  it('two quick taps make one navigation', async () => {
    await render();
    await act(async () => { rows()[0].props.onPress(); rows()[0].props.onPress(); });
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });
});

describe('what opens nothing', () => {
  it('a row the model does not admit (stale or still reading)', async () => {
    mockCanOpen = false;
    await render();
    await act(async () => rows()[0].props.onPress());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('a backgrounded app', async () => {
    await render();
    mockAppState = 'background';
    await act(async () => rows()[0].props.onPress());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('the build without the paired reader', () => {
  it('does not call notifications a conversation list: it says the conversations are in the Dogovori and offers to open them', async () => {
    mockBuilt = false;
    await render();
    expect(tree.root.findAllByType('List' as never)).toHaveLength(0);
    const state = tree.root.findByType('StateView' as never);
    expect(state.props).toMatchObject({ title: 'Razgovori su u Dogovorima', body: 'Otvori Dogovor da nastaviš dopisivanje.' });
    await act(async () => state.props.primary.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith('/dogovori');
  });
});
