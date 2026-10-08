import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { ExactLocationReveal, LocationGrantState } from '../../contracts/contact';
const ownerId = 'owner', workerId = 'worker';
let mockSession = { user: { id: workerId }, accountRevision: 1 };
let mockFocused = true;
let mockAppStateListener: (state: string) => void = () => {};
const mockRead = jest.fn(), mockReveal = jest.fn(), mockGrant = jest.fn(), mockRevoke = jest.fn();
const mockSource = { lokacijskaDozvola: mockRead, otkrijTacnuLokaciju: mockReveal, podeliTacnuLokaciju: mockGrant, opoziviTacnuLokaciju: mockRevoke };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource}));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { currentState: 'active', addEventListener: (_event: string, listener: typeof mockAppStateListener) => {
      mockAppStateListener = listener; return { remove: jest.fn() };
    } };
    return key === 'View' ? 'View' : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
// The old Button is gone (2026-09-24); the private-location actions are V2Action, drawn here under the same name.
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));
jest.mock('../../ui/location/LocationMapPreview', () => ({ LocationMapPreview: 'PrivateMap' }));
import { AgreementPrivateLocation } from '../../ui/AgreementPrivateLocation';
const at = '2026-09-10T12:00:00Z';
function state(granted = true, expiresAt: string | null = null): LocationGrantState {
  return { agreementId: 'agreement', accountId: mockSession.user.id, grants: granted ? [{ id: 'grant', ownerAccountId: ownerId,
    recipientAccountId: workerId, status: 'GRANTED', grantedAt: at, expiresAt }] : [] };
}
function receipt(expiresAt: string | null = null): ExactLocationReveal {
  return { authoritative: true, agreementId: 'agreement', needId: 'need', needRevision: 2, grantId: 'grant', ownerAccountId: ownerId,
    grantedAt: at, expiresAt, adresa: null, accessNotes: null, exactPosition: { latitude: 0, longitude: 0 },
    resolvedLocation: { confirmedByAccountId: ownerId, confirmedAt: at, value: { version: 1,
      binding: { taskCountryCode: 'RS', geography: { mode: 'POINT_TO_POINT', start: { city: 'A' }, end: { city: 'B' } }, exactAddress: null },
      points: [{ slot: 'start', latitudeE6: 0, longitudeE6: 0, origin: { kind: 'MANUAL_PIN' }, address: 'PRIVATE START', accessNotes: 'PRIVATE ACCESS' },
        { slot: 'end', latitudeE6: 45271234, longitudeE6: 19831234, origin: { kind: 'MANUAL_PIN' }, address: 'PRIVATE END' }] } } };
}
let agreement: DogovorProjekcija;
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<AgreementPrivateLocation agreement={agreement} enabled />); }); };
const update = async () => { await act(async () => { tree.update(<AgreementPrivateLocation agreement={agreement} enabled />); }); };
const button = (label: string) => tree.root.findByProps({ label });
const press = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
const content = () => JSON.stringify(tree.toJSON());
const mapAuthority = () => tree.root.findByType('PrivateMap' as React.ElementType).props.canUse as () => boolean;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => {
  jest.clearAllMocks(); for (const mock of [mockRead, mockReveal, mockGrant, mockRevoke]) mock.mockReset();
  mockSession = { user: { id: workerId }, accountRevision: 1 }; mockFocused = true;
  agreement = { id: 'agreement', verzija: 1, stanje: 'CONFIRMED', rezim: 'FIZICKI', kontakt: { lokacijaPostoji: true },
    ucesnici: [{ id: ownerId, uloga: 'narucilac', viSte: false }, { id: workerId, uloga: 'uskocer', viSte: true }] } as DogovorProjekcija;
  mockRead.mockImplementation(async () => ({ ok: true, podatak: state() }));
  mockReveal.mockImplementation(async () => ({ ok: true, podatak: receipt() }));
  mockGrant.mockResolvedValue({ ok: true, podatak: null }); mockRevoke.mockResolvedValue({ ok: true, podatak: null });
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); jest.useRealTimers(); });

describe('Agreement private location uses server grant and ephemeral focused state', () => {
  it('reveals coordinate-only per-stop details only after an explicit action and matching grant readback', async () => {
    await render(); expect(mockReveal).not.toHaveBeenCalled(); expect(content()).not.toContain('PRIVATE START');
    expect(content()).not.toContain('Podeli lokaciju'); // active intent is requester, actual party is worker
    await press('Prikaži privatnu lokaciju');
    expect(mockRead).toHaveBeenCalledTimes(2); expect(content()).toContain('PRIVATE START'); expect(content()).toContain('PRIVATE END');
    expect(content()).toContain('PRIVATE ACCESS');
    expect(tree.root.findByType('PrivateMap' as React.ElementType).props).toMatchObject({ route: true, points: [
      { id: 'start', latitude: 0, longitude: 0 }, { id: 'end', latitude: 45.271234, longitude: 19.831234 },
    ] });
    expect(content()).not.toContain('0.000000, 0.000000');
  });
  it('does not reveal when the grant is absent or belongs to different participants', async () => {
    mockRead.mockResolvedValueOnce({ ok: true, podatak: state(false) }); await render();
    expect(content()).not.toContain('Prikaži privatnu lokaciju'); expect(mockReveal).not.toHaveBeenCalled();
    mockRead.mockResolvedValueOnce({ ok: true, podatak: { ...state(), grants: [{ ...state().grants[0], ownerAccountId: 'third' }] } });
    await press('Osveži dozvolu za lokaciju'); expect(content()).not.toContain('Prikaži privatnu lokaciju'); expect(mockReveal).not.toHaveBeenCalled();
  });
  it('serializes duplicate reveal taps and rejects callbacks retained before the readback', async () => {
    const pending = deferred<unknown>(); mockReveal.mockReturnValueOnce(pending.promise); await render();
    const old = button('Prikaži privatnu lokaciju').props.onPress;
    await act(async () => { old(); old(); }); expect(mockReveal).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ ok: true, podatak: receipt() }); }); expect(content()).toContain('PRIVATE START');
    await act(async () => { old(); }); expect(mockReveal).toHaveBeenCalledTimes(1);
  });
  it.each(['revoke', 'regrant'] as const)('clears a reveal when %s is observed before its grant readback', async change => {
    await render();
    mockRead.mockResolvedValueOnce({ ok: true, podatak: change === 'revoke' ? state(false)
      : { ...state(), grants: [{ ...state().grants[0], grantedAt: '2026-09-10T13:00:00Z' }] } });
    await press('Prikaži privatnu lokaciju'); expect(content()).not.toContain('PRIVATE START'); expect(content()).not.toContain('PrivateMap');
    expect(content()).toContain('Dozvola za lokaciju je promenjena');
  });
  it.each(['blur', 'account', 'revision', 'participant', 'background'] as const)('removes private state and fences late callbacks on %s', async change => {
    await render(); const old = button('Prikaži privatnu lokaciju').props.onPress;
    await press('Prikaži privatnu lokaciju'); expect(content()).toContain('PRIVATE START');
    const canUse = mapAuthority(); expect(canUse()).toBe(true);
    if (change === 'blur') mockFocused = false;
    if (change === 'account') mockSession = { user: { id: workerId }, accountRevision: 2 };
    if (change === 'revision') agreement = { ...agreement, verzija: 2 };
    if (change === 'participant') agreement = { ...agreement, ucesnici: agreement.ucesnici.map(party => party.id === ownerId ? { ...party, id: 'new-owner' } : party) };
    if (change === 'background') await act(async () => { mockAppStateListener('background'); });
    await update(); expect(content()).not.toContain('PRIVATE START'); expect(content()).not.toContain('PrivateMap');
    expect(canUse()).toBe(false);
    await act(async () => { old(); }); expect(mockReveal).toHaveBeenCalledTimes(1);
    if (change === 'blur') { mockFocused = true; await update(); expect(content()).not.toContain('PRIVATE START'); }
    if (change === 'background') { await act(async () => { mockAppStateListener('active'); }); expect(content()).not.toContain('PRIVATE START'); }
  });
  it.each(['blur', 'revision', 'account'] as const)('discards a late private network response after %s', async change => {
    const late = deferred<unknown>(); mockReveal.mockReturnValueOnce(late.promise); await render();
    await press('Prikaži privatnu lokaciju');
    if (change === 'blur') mockFocused = false;
    if (change === 'revision') agreement = { ...agreement, verzija: 2 };
    if (change === 'account') mockSession = { user: { id: workerId }, accountRevision: 2 };
    await update(); await act(async () => { late.resolve({ ok: true, podatak: receipt() }); });
    expect(content()).not.toContain('PRIVATE START'); expect(content()).not.toContain('PrivateMap');
  });
  it('removes displayed points on failed refresh', async () => {
    await render(); await press('Prikaži privatnu lokaciju');
    mockRead.mockResolvedValueOnce({ ok: false, kod: 'UNAVAILABLE', poruka: 'Proveri vezu i pokušaj ponovo.' });
    await press('Osveži dozvolu za lokaciju'); expect(content()).not.toContain('PRIVATE START'); expect(content()).not.toContain('PrivateMap');
  });
  it('fences a retained tap synchronously with background notification before React cleanup', async () => {
    await render(); const old = button('Prikaži privatnu lokaciju').props.onPress;
    await act(async () => { mockAppStateListener('background'); old(); });
    expect(mockReveal).not.toHaveBeenCalled(); expect(content()).not.toContain('PrivateMap');
  });
  it('removes exact data at grant expiry without waiting for another tap', async () => {
    jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-10T12:00:00Z'));
    const expiresAt = '2026-09-10T12:00:02Z';
    mockRead.mockImplementation(async () => ({ ok: true, podatak: state(true, expiresAt) }));
    mockReveal.mockResolvedValue({ ok: true, podatak: receipt(expiresAt) });
    await render(); await press('Prikaži privatnu lokaciju'); expect(content()).toContain('PRIVATE START');
    await act(async () => { jest.advanceTimersByTime(2001); });
    expect(content()).not.toContain('PRIVATE START'); expect(content()).not.toContain('Prikaži privatnu lokaciju');
  });
  it('rejects captured map authority at expiry before cleanup timers or a render run', async () => {
    jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-10T12:00:00Z'));
    const expiresAt = '2026-09-10T12:00:02Z';
    mockRead.mockImplementation(async () => ({ ok: true, podatak: state(true, expiresAt) }));
    mockReveal.mockResolvedValue({ ok: true, podatak: receipt(expiresAt) });
    await render(); await press('Prikaži privatnu lokaciju');
    const canUse = mapAuthority(); expect(canUse()).toBe(true);
    const reads = mockRead.mock.calls.length;
    // Moving the clock does not run the expiry timer. The rendered map still holds this callback.
    jest.setSystemTime(new Date(expiresAt));
    expect(content()).toContain('PrivateMap'); expect(canUse()).toBe(false);
    expect(mockRead).toHaveBeenCalledTimes(reads); expect(mockReveal).toHaveBeenCalledTimes(1);
  });
  it.each(['id', 'grantedAt'] as const)('retires old map authority immediately on refresh and keeps it retired after grant %s replacement', async change => {
    await render(); await press('Prikaži privatnu lokaciju');
    const old = mapAuthority(); expect(old()).toBe(true);
    const grant = { ...state().grants[0], ...(change === 'id' ? { id: 'replacement-grant' } : { grantedAt: '2026-09-10T13:00:00Z' }) };
    mockRead.mockImplementation(async () => ({ ok: true, podatak: { ...state(), grants: [grant] } }));
    mockReveal.mockResolvedValue({ ok: true, podatak: { ...receipt(), grantId: grant.id, grantedAt: grant.grantedAt } });
    const refresh = button('Osveži dozvolu za lokaciju').props.onPress;
    await act(async () => { refresh(); expect(old()).toBe(false); });
    expect(content()).not.toContain('PrivateMap');
    await press('Prikaži privatnu lokaciju');
    expect(mapAuthority()()).toBe(true); expect(old()).toBe(false);
  });
  it('does not revive a captured map authority after blur, fresh read and explicit reveal of the same grant', async () => {
    await render(); await press('Prikaži privatnu lokaciju');
    const old = mapAuthority(); expect(old()).toBe(true);
    mockFocused = false; await update(); expect(old()).toBe(false);
    mockFocused = true; await update(); await press('Prikaži privatnu lokaciju');
    expect(mapAuthority()()).toBe(true); expect(old()).toBe(false);
  });
  it.each(['account ABA', 'background'] as const)('checks %s synchronously before React retires the map', async change => {
    await render(); await press('Prikaži privatnu lokaciju');
    const old = mapAuthority(); expect(old()).toBe(true);
    if (change === 'account ABA') {
      mockSession = { user: { id: workerId }, accountRevision: 3 };
      expect(old()).toBe(false);
    } else await act(async () => { mockAppStateListener('background'); expect(old()).toBe(false); });
  });
  it('lets the actual requester grant coordinate-only data, blocks duplicates and unknown-write replay until readback', async () => {
    mockSession = { user: { id: ownerId }, accountRevision: 1 };     agreement.ucesnici = agreement.ucesnici.map(party => ({ ...party, viSte: party.id === ownerId }));
    mockRead.mockImplementation(async () => ({ ok: true, podatak: state(false) }));
    const pending = deferred<unknown>(); mockGrant.mockReturnValueOnce(pending.promise); await render();
    const old = button('Podeli lokaciju').props.onPress;
    await act(async () => { old(); old(); }); expect(mockGrant).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ ok: false, kod: 'UNKNOWN', poruka: 'Osveži prikaz.' }); });
    await act(async () => { old(); button('Podeli lokaciju').props.onPress(); }); expect(mockGrant).toHaveBeenCalledTimes(1);
    await press('Osveži dozvolu za lokaciju'); await act(async () => { old(); }); expect(mockGrant).toHaveBeenCalledTimes(1);
    mockRead.mockImplementation(async () => ({ ok: true, podatak: state() })); await press('Podeli lokaciju');
    expect(mockGrant).toHaveBeenCalledTimes(2); expect(content()).toContain('Opozovi deljenje lokacije'); expect(mockReveal).not.toHaveBeenCalled();
    mockRead.mockImplementation(async () => ({ ok: true, podatak: state(false) })); await press('Opozovi deljenje lokacije');
    expect(mockRevoke).toHaveBeenCalledTimes(1); expect(content()).toContain('Podeli lokaciju');
  });
  it.each(['COMPLETED', 'CANCELLED', 'REMOTE'] as const)('removes private state for %s', async status => {
    await render(); await press('Prikaži privatnu lokaciju');
    agreement = status === 'REMOTE' ? { ...agreement, rezim: 'DALJINSKI' } : { ...agreement, stanje: status };
    await update(); expect(tree.toJSON()).toBeNull();
  });
  it('says how long the access lasts: until its end when the grant has one, else until revoked or the Dogovor ends', async () => {
    // The worker cannot revoke; they are told the other side can.
    await render(); expect(content()).toContain('Važi dok je druga strana ne opozove ili dok se Dogovor ne završi.');
    expect(content()).not.toContain('dok je ne opozoveš');
    mockRead.mockImplementation(async () => ({ ok: true, podatak: state(true, '2099-10-01T10:00:00Z') }));
    await press('Osveži dozvolu za lokaciju'); expect(content()).toContain('Važi do ');
    expect(content()).not.toContain('Privatna lokacija'); expect(mockReveal).not.toHaveBeenCalled();
  });
  it('tells the requester, who can revoke, that the access lasts until they revoke it', async () => {
    mockSession = { user: { id: ownerId }, accountRevision: 1 }; agreement.ucesnici = agreement.ucesnici.map(party => ({ ...party, viSte: party.id === ownerId }));
    await render(); expect(content()).toContain('Važi dok je ne opozoveš ili dok se Dogovor ne završi.'); expect(mockGrant).not.toHaveBeenCalled();
  });
});

// Idea R03 (UI pass 2026-10-08): the address is the requester's to share, and the worker has nowhere to ask for it but the conversation.
describe('the address, said to each side (R03)', () => {
  const draw = async (onRequestAddress?: () => void) => { await act(async () => { tree = create(<AgreementPrivateLocation agreement={agreement} enabled onRequestAddress={onRequestAddress} />); }); };

  it('tells the worker the address is not shared yet and gives the one way to ask for it', async () => {
    mockRead.mockImplementation(async () => ({ ok: true, podatak: state(false) }));
    const ask = jest.fn();
    await draw(ask);
    expect(content()).toContain('Adresa još nije podeljena.');
    await press('Zatraži adresu');
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('draws no question when the screen has no conversation to take it to', async () => {
    mockRead.mockImplementation(async () => ({ ok: true, podatak: state(false) }));
    await draw();
    expect(content()).toContain('Adresa još nije podeljena.'); expect(content()).not.toContain('Zatraži adresu');
  });

  it('tells the requester to share the address when they are ready, and never gives them a question to ask', async () => {
    mockSession = { user: { id: ownerId }, accountRevision: 1 };
    agreement = { ...agreement, ucesnici: [{ id: ownerId, uloga: 'narucilac', viSte: true }, { id: workerId, uloga: 'uskocer', viSte: false }] } as DogovorProjekcija;
    mockRead.mockImplementation(async () => ({ ok: true, podatak: { ...state(false), accountId: ownerId } }));
    await draw(jest.fn());
    expect(content()).toContain('Podeli adresu kad budete spremni.'); expect(content()).not.toContain('Zatraži adresu');
    expect(content()).toContain('Podeli lokaciju');
  });

  it('stops asking once the address is shared: the worker is told so and may look at it', async () => {
    await draw(jest.fn());
    expect(content()).toContain('Prikaz lokacije je dozvoljen u ovom Dogovoru.'); expect(content()).not.toContain('Zatraži adresu');
    expect(content()).toContain('Prikaži privatnu lokaciju');
  });
});
