import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The reads behind the words of the profile's and the privacy screen's rows (`useHubStates`; the product draft the owner approved on 8 Oct 2026, P1 and P5). Each read is
 * the app's own and independent: one that fails or is refused is "not known", never an error and never a made-up answer, and the others still say theirs. Only the
 * parts the screen asks for are read.
 */
let mockSession: { user: { id: string } | null; accountRevision: number } = { user: { id: 'account-a' }, accountRevision: 4 };
const mockInbox = jest.fn(), mockBlocks = jest.fn(), mockExport = jest.fn(), mockLegal = jest.fn();
jest.mock('../../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../../../data/supportCaseClientService', () => ({ supportCaseClientService: { inbox: (...args: unknown[]) => mockInbox(...args) } }));
jest.mock('../../../data/safetyClientService', () => ({ safetyClientService: { listMyBlocks: (...args: unknown[]) => mockBlocks(...args) } }));
jest.mock('../../../data/dataExportClientService', () => ({ dataExportClientService: { readStatus: (...args: unknown[]) => mockExport(...args) } }));
jest.mock('../../../data/legalClientService', () => ({ legalClientService: { readBundle: (...args: unknown[]) => mockLegal(...args) } }));
// One read per focus, as the screens have it; the hook's own logic is what runs.
jest.mock('../../../hooks/useFocusedResource', () => {
  const { useEffect, useState } = require('react');
  return { useFocusedResource: (load: () => Promise<unknown>) => {
    const [state, setState] = useState({ data: null as unknown, loading: true });
    useEffect(() => { let live = true; void load().then((data: unknown) => { if (live) setState({ data, loading: false }); }); return () => { live = false; }; }, [load]);
    return state;
  } };
});
import { useHubStates, type HubStateKey } from '../useHubStates';
import type { HubStates } from '../hubStates';

const ok = (podatak: unknown) => ({ ok: true, podatak });
const refused = { ok: false, kod: 'X', poruka: 'x' };
let tree: ReactTestRenderer;
let seen: HubStates = {};
function Probe({ keys }: { keys: readonly HubStateKey[] }) { seen = useHubStates(keys); return null; }
const mount = async (keys: readonly HubStateKey[]) => { await act(async () => { tree = create(<Probe keys={keys} />); }); await act(async () => {}); };
const ALL: readonly HubStateKey[] = ['support', 'blocked', 'export', 'legal'];

beforeEach(() => {
  jest.clearAllMocks(); seen = {}; mockSession = { user: { id: 'account-a' }, accountRevision: 4 };
  mockInbox.mockReset().mockResolvedValue(ok({ cases: [{ status: 'RECEIVED' }, { status: 'CLOSED' }, { status: 'IN_REVIEW' }] }));
  mockBlocks.mockReset().mockResolvedValue(ok({ items: [{}, {}], nextCursor: null }));
  mockExport.mockReset().mockResolvedValue(ok({ hasRequest: false, request: null, downloadAvailable: false }));
  mockLegal.mockReset().mockResolvedValue(ok({ ready: true, acceptedCurrentBundle: true, documents: [] }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('reads the four parts apart from each other and says each as the screen\'s rows need it', async () => {
  await mount(ALL);
  expect(seen).toEqual({ support: 2, blocked: { count: 2, more: false }, exportPhase: 'NONE', legal: 'ACCEPTED' });
  for (const read of [mockInbox, mockBlocks, mockExport, mockLegal]) expect(read).toHaveBeenCalledTimes(1);
});

it('reads the support inbox of the person only: the own list, its first page, for the account and the revision that are signed in', async () => {
  await mount(['support']);
  expect(mockInbox).toHaveBeenCalledWith('OWN', null, { accountId: 'account-a', accountRevision: 4 });
  expect(mockBlocks).not.toHaveBeenCalled(); expect(mockExport).not.toHaveBeenCalled(); expect(mockLegal).not.toHaveBeenCalled();
  expect(seen).toMatchObject({ support: 2 });
});

it('reads only the parts it is asked for: the privacy screen has no support inbox to read', async () => {
  await mount(['blocked', 'export', 'legal']);
  expect(mockInbox).not.toHaveBeenCalled();
  expect(seen.support).toBeUndefined(); expect(seen).toMatchObject({ blocked: { count: 2, more: false }, exportPhase: 'NONE', legal: 'ACCEPTED' });
});

it.each([
  ['support', () => mockInbox.mockResolvedValue(refused)], ['blocked', () => mockBlocks.mockResolvedValue(refused)],
  ['export', () => mockExport.mockResolvedValue(refused)], ['legal', () => mockLegal.mockResolvedValue(refused)],
])('does not know the %s part when its read is refused, and the other three still say theirs', async (part, arrange) => {
  arrange(); await mount(ALL);
  const expected: Record<string, unknown> = { support: 2, blocked: { count: 2, more: false }, exportPhase: 'NONE', legal: 'ACCEPTED' };
  const key = { support: 'support', blocked: 'blocked', export: 'exportPhase', legal: 'legal' }[part as 'support']!;
  for (const [name, value] of Object.entries(expected)) {
    if (name === key) expect([name, (seen as Record<string, unknown>)[name]]).toEqual([name, undefined]);
    else expect([name, (seen as Record<string, unknown>)[name]]).toEqual([name, value]);
  }
});

it.each([
  ['support', () => mockInbox.mockRejectedValue(new Error('offline'))], ['blocked', () => mockBlocks.mockRejectedValue(new Error('offline'))],
  ['export', () => mockExport.mockRejectedValue(new Error('offline'))], ['legal', () => mockLegal.mockRejectedValue(new Error('offline'))],
])('does not know the %s part when its read throws, and the screen is not troubled', async (_part, arrange) => {
  arrange(); await expect(mount(ALL)).resolves.toBeUndefined();
  expect(Object.values(seen).filter(value => value !== undefined)).toHaveLength(3);
});

it('knows nothing when nobody is signed in, and reads nothing', async () => {
  mockSession = { user: null, accountRevision: 4 }; await mount(ALL);
  expect(seen).toEqual({}); for (const read of [mockInbox, mockBlocks, mockExport, mockLegal]) expect(read).not.toHaveBeenCalled();
});

it('says "Nema" only for a list it read empty, and the unpublished rules only for a bundle that says so', async () => {
  mockBlocks.mockResolvedValue(ok({ items: [], nextCursor: null })); mockLegal.mockResolvedValue(ok({ ready: false, acceptedCurrentBundle: false, documents: [] }));
  await mount(ALL);
  expect(seen).toMatchObject({ blocked: { count: 0, more: false }, legal: 'UNPUBLISHED' });
});
