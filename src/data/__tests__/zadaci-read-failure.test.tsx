import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Real route + focused resource + list-state rendering. Only transport/native layout are replaced.
const mockSource = { otvorenePrilike: jest.fn(), odnosiPremaZadacima: jest.fn() };
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.preview' } } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('../discoveryV1ReaderGate', () => ({ selectDiscoveryReader: () => 'LEGACY' }));
jest.mock('../../ui/v2/discovery/DiscoveryV1Route', () => ({ DiscoveryV1Route: () => null }));
jest.mock('../../hooks/useDiscoveryWorkArea', () => ({ useDiscoveryWorkArea: () => ({ target: null, retire: jest.fn(), handled: jest.fn() }) }));
jest.mock('../../ui/system/StateView', () => ({ StateView: 'ReadState' }));
jest.mock('../../ui/v2/DiscoveryPresentation', () => ({ DiscoveryPresentation: (props: any) => {
  const React = require('react');
  const { DiscoveryListState } = require('../../ui/v2/discovery/DiscoveryListState');
  return React.createElement('Discovery', props, props.error ? React.createElement(DiscoveryListState, {
    state: { kind: 'error', errorReason: props.errorReason, onRetry: props.onRefresh }, clearAllLabel: 'Uklonite filtere',
  }) : null);
} }));

import Zadaci from '../../app/(app)/zadaci';

let tree: ReactTestRenderer;
let diagnostics: jest.SpyInstance;
const shown = () => tree.root.findByType('Discovery' as React.ElementType).props;
const errorState = () => tree.root.findByType('ReadState' as React.ElementType).props;
beforeEach(() => {
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
  mockSource.otvorenePrilike.mockReset();
  mockSource.odnosiPremaZadacima.mockReset().mockResolvedValue(null);
  diagnostics = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { await act(async () => tree?.unmount()); diagnostics.mockRestore(); });

it.each([
  ['auth', new Error('AUTH_REQUIRED'), 'AUTH_REQUIRED', 'Vaša prijava nije potvrđena.'],
  ['expired session', { code: 'PGRST301', message: 'private token detail' }, 'AUTH_REQUIRED', 'Vaša prijava nije potvrđena.'],
  ['permission', { code: '42501', message: 'private SQL detail' }, 'FORBIDDEN', 'nije dostupan Vašem nalogu'],
  ['contract', new Error('OPPORTUNITIES_RESPONSE_INVALID'), 'CONTRACT', 'Zadaci trenutno ne mogu da se prikažu.'],
  ['RPC refusal', { code: 'PGRST202', message: 'private schema detail' }, 'CONTRACT', 'Zadaci trenutno ne mogu da se prikažu.'],
  ['network', new TypeError('Network request failed'), 'NETWORK', 'Proverite internet vezu'],
  ['SDK network', { code: '', message: 'TypeError: Failed to fetch', details: 'private URL' }, 'NETWORK', 'Proverite internet vezu'],
  ['deadline', new Error('MARKETPLACE_READ_TIMEOUT'), 'TIMEOUT', 'Učitavanje traje duže'],
  ['unknown', { code: 'PRIVATE_FAILURE', message: 'private payload', details: 'private details' }, 'UNAVAILABLE', 'Zadaci trenutno nisu dostupni.'],
] as const)('shows a useful safe %s failure and recovers with the existing retry', async (_name, failure, reason, copy) => {
  mockSource.otvorenePrilike.mockRejectedValueOnce(failure).mockResolvedValueOnce([]);
  await act(async () => { tree = create(<Zadaci />); });
  expect(shown()).toMatchObject({ error: true, errorReason: reason, loading: false });
  expect(errorState().body).toContain(copy);
  expect(errorState().body).not.toMatch(/true|private|PGRST|42501|OPPORTUNITIES|MARKETPLACE/);
  if (reason !== 'NETWORK') expect(errorState().body).not.toContain('internet');
  expect(diagnostics).toHaveBeenCalledWith('[ZADACI_LOAD_ERROR]', reason);
  expect(errorState().primary.label).toBe('Pokušajte ponovo');
  await act(async () => errorState().primary.onPress());
  expect(shown()).toMatchObject({ error: false, loading: false, items: [] });
  expect(shown().errorReason).toBeUndefined();
  expect(mockSource.otvorenePrilike).toHaveBeenCalledTimes(2);
});

it('does not publish an old account failure after A→B→A', async () => {
  let reject!: (error: unknown) => void;
  mockSource.otvorenePrilike.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; })).mockResolvedValueOnce([]);
  await act(async () => { tree = create(<Zadaci />); });
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  mockSession = { user: { id: 'account-a' }, accountRevision: 3 };
  await act(async () => { tree.update(<Zadaci />); reject({ code: '42501', message: 'private old account' }); });
  expect(shown()).toMatchObject({ error: false, loading: false, items: [] });
  expect(shown().errorReason).toBeUndefined();
  expect(tree.root.findAllByType('ReadState' as React.ElementType)).toHaveLength(0);
});
