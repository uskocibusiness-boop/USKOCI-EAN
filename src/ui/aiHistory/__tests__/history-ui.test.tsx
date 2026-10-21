import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AiHistoryPage, AiHistoryRow } from '../../../data/aiHistoryClientService';
import type { AiHistoryMessagesPage } from '../../../data/aiHistoryMessagesClientService';

const ACCOUNT = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';
const CID = '20000000-0000-4000-8000-000000000001';
let mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
const mockList = jest.fn(), mockMessages = jest.fn();

jest.mock('../../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../../../data/aiHistoryClientService', () => ({ listAiHistory: (...args: unknown[]) => mockList(...args) }));
jest.mock('../../../data/aiHistoryMessagesClientService', () => ({ listAiHistoryMessages: (...args: unknown[]) => mockMessages(...args) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const React = require('react');
  const FlatList = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() }));
    return React.createElement('FlatList', props,
      props.ListHeaderComponent,
      (props.data as unknown[]).map((item, index) => React.createElement(React.Fragment, { key: props.keyExtractor(item) },
        props.renderItem({ item, index, separators: {} }))),
      props.data.length ? props.ListFooterComponent : props.ListEmptyComponent);
  });
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return FlatList;
    if (key === 'View') return 'View';
    if (key === 'ActivityIndicator') return 'ActivityIndicator';
    if (key === 'RefreshControl') return 'RefreshControl';
    return Reflect.get(target, key);
  } });
});
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../profile/AccountHeader', () => ({ AccountHeader: 'AccountHeader' }));
jest.mock('../../system/Glyph', () => ({ Glyph: 'Glyph' }));
jest.mock('../../system/Screen', () => ({ Screen: 'Screen' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));

import { AiHistoryListScreen } from '../AiHistoryListScreen';
import { AiHistoryTranscriptScreen } from '../AiHistoryTranscriptScreen';
import { admitClosedHistory, admittedClosedHistory, historyStatusLabel, retireClosedHistory } from '../historyUiModel';

const row = (patch: Partial<AiHistoryRow> = {}): AiHistoryRow => ({
  conversationId: CID, createdAt: '2026-10-20T10:00:00Z', closedAt: null, status: 'OPEN',
  title: 'Razgovor o zadatku', titleSource: 'GENERIC', hasSavedProfile: false,
  visibility: 'VISIBLE', canContinue: true, canRead: false, ...patch,
});
const page = (rows: AiHistoryRow[], nextCursor: AiHistoryPage['nextCursor'] = null): AiHistoryPage => ({
  schemaVersion: 'AI_HISTORY_V1', accountId: ACCOUNT, purpose: 'NEED_INTAKE', observedAt: '2026-10-21T10:00:00Z',
  rows, nextCursor, authoritative: true,
});
const message = (n: number) => ({ id: `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  role: n % 2 ? 'USER' as const : 'ASSISTANT' as const, body: `Poruka ${n}`, createdAt: '2026-10-20T10:00:00Z' });
const messagesPage = (rows: ReturnType<typeof message>[], nextBeforeMessageId: string | null): AiHistoryMessagesPage => ({
  schemaVersion: 'AI_HISTORY_MESSAGES_V1', accountId: ACCOUNT, purpose: 'NEED_INTAKE', conversationId: CID,
  status: 'COMPLETED', observedAt: '2026-10-21T10:00:00Z', rows,
  hasMore: nextBeforeMessageId !== null, nextBeforeMessageId, authoritative: true,
});
const flush = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
const nodes = (tree: ReactTestRenderer, type: string) => tree.root.findAll(node => String(node.type) === type);
const words = (tree: ReactTestRenderer) => nodes(tree, 'T').flatMap(node => node.children.filter(x => typeof x === 'string'));
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockList.mockReset(); mockMessages.mockReset(); retireClosedHistory();
});
afterEach(async () => { if (tree) await act(async () => { tree!.unmount(); await flush(); }); tree = undefined; });

it('keeps task and profile lists separate, pages metadata, and opens only an admitted OPEN row', async () => {
  const open = row(), closed = row({ conversationId: '20000000-0000-4000-8000-000000000002',
    status: 'ABANDONED', closedAt: '2026-10-20T12:00:00Z', canContinue: false });
  const cursor = { createdAt: closed.createdAt, conversationId: closed.conversationId };
  mockList.mockResolvedValueOnce({ ok: true, podatak: page([open, closed], cursor) })
    .mockResolvedValueOnce({ ok: true, podatak: page([row({ conversationId: '20000000-0000-4000-8000-000000000003' })]) })
    .mockResolvedValueOnce({ ok: true, podatak: { ...page([]), purpose: 'PROFILE' } });
  const onOpen = jest.fn();
  await act(async () => { tree = create(<AiHistoryListScreen accountId={ACCOUNT} accountRevision={1} focused
    onBack={jest.fn()} onOpen={onOpen} />); await flush(); });
  expect(mockList.mock.calls).toEqual([['NEED_INTAKE', null]]);
  const rows = nodes(tree!, 'Press').filter(node => String(node.props.accessibilityLabel).includes('Razgovor o zadatku'));
  expect(rows).toHaveLength(2);
  expect(rows[0].props.disabled).toBe(false);
  expect(rows[1].props.disabled).toBe(true);
  expect(words(tree!)).toContain('Pregled poruka trenutno nije dostupan.');
  await act(async () => rows[0].props.onPress());
  expect(onOpen).toHaveBeenCalledWith('NEED_INTAKE', open);
  await act(async () => { nodes(tree!, 'Action').find(node => node.props.label === 'Prikaži još')!.props.onPress(); await flush(); });
  expect(mockList.mock.calls[1]).toEqual(['NEED_INTAKE', cursor]);
  await act(async () => { nodes(tree!, 'Press').find(node => node.props.accessibilityRole === 'tab'
    && node.props.accessibilityLabel === 'Razgovori o radnom profilu')!.props.onPress(); await flush(); });
  expect(mockList.mock.calls[2]).toEqual(['PROFILE', null]);
  expect(words(tree!)).toContain('Ovde još nema razgovora.');
});

it('shows unavailable state for an absent H1 RPC and recovers on retry', async () => {
  mockList.mockResolvedValueOnce({ ok: false, kod: 'AI_HISTORY_UNAVAILABLE', poruka: 'unavailable' })
    .mockResolvedValueOnce({ ok: true, podatak: page([]) });
  await act(async () => { tree = create(<AiHistoryListScreen accountId={ACCOUNT} accountRevision={1} focused
    onBack={jest.fn()} onOpen={jest.fn()} />); await flush(); });
  expect(words(tree!)).toContain('Istorija trenutno nije dostupna.');
  await act(async () => { nodes(tree!, 'Action').find(node => node.props.label === 'Pokušaj ponovo')!.props.onPress(); await flush(); });
  expect(words(tree!)).toContain('Ovde još nema razgovora.');
});

it('requires H1 canRead and the same account before a closed transcript can open', () => {
  const closed = row({ status: 'COMPLETED', closedAt: '2026-10-20T12:00:00Z', canContinue: false });
  expect(admitClosedHistory('NEED_INTAKE', closed)).toBe(false);
  expect(admittedClosedHistory('NEED_INTAKE', CID)).toBeNull();
  const enabled = { ...closed, canRead: true } as unknown as AiHistoryRow;
  expect(admitClosedHistory('NEED_INTAKE', enabled)).toBe(true);
  expect(admittedClosedHistory('PROFILE', CID)).toBeNull();
  expect(admittedClosedHistory('NEED_INTAKE', CID)).toBe(enabled);
  mockSession = { user: { id: OTHER }, accountRevision: 2 };
  expect(admittedClosedHistory('NEED_INTAKE', CID)).toBeNull();
});

it('prepends older H2 pages in chronological order and never mounts a write control', async () => {
  const latest = Array.from({ length: 50 }, (_, index) => message(52 - index));
  mockMessages.mockResolvedValueOnce({ ok: true, podatak: messagesPage(latest, latest[49].id) })
    .mockResolvedValueOnce({ ok: true, podatak: messagesPage([message(2), message(1)], null) });
  const closed = { ...row({ status: 'COMPLETED', closedAt: '2026-10-20T12:00:00Z', canContinue: false }),
    canRead: true } as unknown as AiHistoryRow;
  await act(async () => { tree = create(<AiHistoryTranscriptScreen purpose="NEED_INTAKE" row={closed}
    accountId={ACCOUNT} accountRevision={1} focused onBack={jest.fn()} />); await flush(); });
  expect(mockMessages.mock.calls[0]).toEqual(['NEED_INTAKE', CID, null]);
  expect(nodes(tree!, 'FlatList')[0].props.data).toHaveLength(50);
  await act(async () => { nodes(tree!, 'Action').find(node => node.props.label === 'Učitaj starije poruke')!.props.onPress(); await flush(); });
  expect(mockMessages.mock.calls[1]).toEqual(['NEED_INTAKE', CID, latest[49].id]);
  expect(nodes(tree!, 'FlatList')[0].props.data.map((item: { id: string }) => item.id))
    .toEqual(Array.from({ length: 52 }, (_, index) => message(index + 1).id));
  expect(nodes(tree!, 'FlatList')[0].props.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });
  expect(nodes(tree!, 'Action').map(node => node.props.label)).not.toEqual(expect.arrayContaining(['Pošalji', 'Sačuvaj', 'Objavi']));
  expect(historyStatusLabel('NEED_INTAKE', closed)).toBe('Razgovor završen');
});

it('discards an H2 page returned after the account changes', async () => {
  let finish!: (value: unknown) => void;
  mockMessages.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const closed = { ...row({ status: 'COMPLETED', closedAt: '2026-10-20T12:00:00Z', canContinue: false }),
    canRead: true } as unknown as AiHistoryRow;
  await act(async () => { tree = create(<AiHistoryTranscriptScreen purpose="NEED_INTAKE" row={closed}
    accountId={ACCOUNT} accountRevision={1} focused onBack={jest.fn()} />); await flush(); });
  mockSession = { user: { id: OTHER }, accountRevision: 2 };
  await act(async () => { finish({ ok: true, podatak: messagesPage([message(1)], null) }); await flush(); });
  expect(nodes(tree!, 'FlatList')).toHaveLength(0);
  expect(words(tree!)).not.toContain('Poruka 1');
});
