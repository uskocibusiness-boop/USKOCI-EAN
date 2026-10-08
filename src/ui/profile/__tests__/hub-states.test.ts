import type { DataExportStatus } from '../../../contracts/dataExport';
import type { LegalBundleStatus } from '../../../contracts/legal';
import type { MyBlockedAccounts } from '../../../data/safetyClientService';
import type { SupportInbox, SupportInboxRow, SupportStatus } from '../../../data/supportCaseTypes';
import { EXPORT_WORDS, LEGAL_WORDS, blockedFrom, blockedWord, exportPhaseFrom, exportWord, hubWords, legalFrom, legalWord, openSupportCases, supportWord, versionWord } from '../hubStates';

/**
 * What the rows of the profile and of "Privatnost i podaci" say about their own state (the product draft the owner approved on 8 Oct 2026, P1 and P5). Every word is
 * read from data the app already has, and a state that could not be read is NOT said: no row claims "Nema" for a list it could not read, and none says "nije dostupno".
 */
const NOW = Date.parse('2026-10-08T10:00:00Z');
const row = (status: SupportStatus, id: string = status): SupportInboxRow => ({ id, caseNumber: '1', channel: 'SERVICE', topic: 'TECHNICAL', status, revision: 1, lastSequence: '1',
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', context: null, unread: false });
const inbox = (...statuses: SupportStatus[]): SupportInbox => ({ accountId: 'a', mode: 'OWN', operatorAvailable: false, cases: statuses.map((status, at) => row(status, `c${at}`)),
  nextBeforeCaseNumber: null, authoritative: true });
const blocks = (count: number, nextCursor: string | null = null): MyBlockedAccounts => ({ accountId: 'a', nextCursor, authoritative: true,
  items: Array.from({ length: count }, (_, at) => ({ accountId: 'a', targetAccountId: `t${at}`, blocked: true as const, revision: 1, authoritative: true as const, displayName: null })) });
const bundle = (ready: boolean, acceptedCurrentBundle: boolean): LegalBundleStatus => ({ ready, acceptedCurrentBundle, reason: ready ? null : 'LEGAL_DOCUMENTS_NOT_PUBLISHED', documents: [] });
const request = (status: 'REQUESTED' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED' | 'EXPIRED'): NonNullable<DataExportStatus['request']> => ({ receiptId: 'r', clientRequestId: 'q', status,
  requestedAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', cancelledAt: null, completedAt: null, failureCode: null });
const exportStatus = (patch: Partial<DataExportStatus>): DataExportStatus => ({ hasRequest: true, request: request('REQUESTED'), downloadAvailable: false, fulfillment: null,
  serverFulfillmentRequired: true, externalDsrChannelReady: false, ...patch });

describe('"Podrška": how many requests are open', () => {
  it('says the count in the shape Serbian gives it, and says nothing for none or for an inbox that was not read', () => {
    expect(supportWord(undefined)).toBeUndefined(); expect(supportWord(0)).toBeUndefined();
    expect([1, 2, 3, 4, 5, 11, 12, 21, 22, 25].map(supportWord)).toEqual(['1 otvoren zahtev', '2 otvorena zahteva', '3 otvorena zahteva', '4 otvorena zahteva',
      '5 otvorenih zahteva', '11 otvorenih zahteva', '12 otvorenih zahteva', '21 otvoren zahtev', '22 otvorena zahteva', '25 otvorenih zahteva']);
  });
  it('counts the cases that are not closed, and nothing from an inbox that was not read', () => {
    expect(openSupportCases(inbox('RECEIVED', 'IN_REVIEW', 'WAITING_FOR_AUTHOR', 'DECIDED', 'CLOSED', 'CLOSED'))).toBe(4);
    expect(openSupportCases(inbox('CLOSED'))).toBe(0); expect(openSupportCases(inbox())).toBe(0);
    expect(openSupportCases(null)).toBeUndefined(); expect(openSupportCases(undefined)).toBeUndefined();
  });
});

describe('"Blokirane osobe": nobody, or how many', () => {
  it('says "Nema" for nobody, the count otherwise, and "+" when another page follows', () => {
    expect(blockedWord({ count: 0, more: false })).toBe('Nema'); expect(blockedWord({ count: 2, more: false })).toBe('2');
    expect(blockedWord({ count: 50, more: true })).toBe('50+'); expect(blockedWord(undefined)).toBeUndefined();
  });
  it('reads the first page of the list, and never says "Nema" for a list that was not read', () => {
    expect(blockedFrom(blocks(0))).toEqual({ count: 0, more: false }); expect(blockedFrom(blocks(3))).toEqual({ count: 3, more: false });
    expect(blockedFrom(blocks(50, '30000000-0000-4000-8000-000000000001'))).toEqual({ count: 50, more: true });
    expect(blockedFrom(null)).toBeUndefined(); expect(blockedFrom(undefined)).toBeUndefined();
  });
});

describe('"Izvoz podataka": where the copy is', () => {
  it('has a word for every phase, in the row\'s own gender, and none for a phase that is not known', () => {
    expect(EXPORT_WORDS).toEqual({ NONE: 'Nije tražen', REQUESTED: 'Zahtev poslat', PROCESSING: 'U pripremi', READY_AVAILABLE: 'Spreman', READY_UNAVAILABLE: 'Nije dostupan',
      EXPIRED: 'Istekao', FAILED: 'Nije uspeo', CANCELLED: 'Otkazan' });
    expect(exportWord('READY_AVAILABLE')).toBe('Spreman'); expect(exportWord(undefined)).toBeUndefined();
  });
  it('reads the phase from the status the export screen reads, with the same rules', () => {
    expect(exportPhaseFrom(null, NOW)).toBeUndefined(); expect(exportPhaseFrom(undefined, NOW)).toBeUndefined();
    expect(exportPhaseFrom(exportStatus({ hasRequest: false, request: null }), NOW)).toBe('NONE');
    expect(exportPhaseFrom(exportStatus({ request: request('REQUESTED') }), NOW)).toBe('REQUESTED');
    expect(exportPhaseFrom(exportStatus({ request: request('PROCESSING') }), NOW)).toBe('PROCESSING');
    expect(exportPhaseFrom(exportStatus({ request: request('FAILED') }), NOW)).toBe('FAILED');
    expect(exportPhaseFrom(exportStatus({ request: request('CANCELLED') }), NOW)).toBe('CANCELLED');
    const artifact = (expires: string) => ({ artifactAvailable: true as const, artifactGeneration: 'g', artifactExpiresAt: expires, byteLength: 1, sha256: 's', md5: 'm' });
    expect(exportPhaseFrom(exportStatus({ request: request('READY'), downloadAvailable: true, fulfillment: artifact('2026-10-09T10:00:00Z') }), NOW)).toBe('READY_AVAILABLE');
    // A copy whose availability has run out is said as expired, and one that was never verified as not available; neither is "Spreman".
    expect(exportPhaseFrom(exportStatus({ request: request('READY'), downloadAvailable: true, fulfillment: artifact('2026-10-07T10:00:00Z') }), NOW)).toBe('EXPIRED');
    expect(exportPhaseFrom(exportStatus({ request: request('READY'), downloadAvailable: false, fulfillment: null }), NOW)).toBe('READY_UNAVAILABLE');
  });
});

describe('"Pravila i saglasnosti": published, and accepted', () => {
  it('says the three states the person can be in, and nothing for a bundle that was not read', () => {
    expect(LEGAL_WORDS).toEqual({ UNPUBLISHED: 'Još nisu objavljena', PENDING: 'Čekaju tvoju saglasnost', ACCEPTED: 'Prihvaćena' });
    expect(legalWord('UNPUBLISHED')).toBe('Još nisu objavljena'); expect(legalWord(undefined)).toBeUndefined();
  });
  it('reads the state from the bundle: not published, published and waiting, accepted', () => {
    expect(legalFrom(bundle(false, false))).toBe('UNPUBLISHED'); expect(legalFrom(bundle(true, false))).toBe('PENDING'); expect(legalFrom(bundle(true, true))).toBe('ACCEPTED');
    // An acceptance of a bundle that is not published is not an acceptance.
    expect(legalFrom(bundle(false, true))).toBe('UNPUBLISHED');
    expect(legalFrom(null)).toBeUndefined(); expect(legalFrom(undefined)).toBeUndefined();
  });
});

describe('the words of the four rows together, and the version', () => {
  it('turns what was read into the words of the rows, and leaves out every part that was not read', () => {
    expect(hubWords({ support: 2, blocked: { count: 1, more: false }, exportPhase: 'PROCESSING', legal: 'PENDING' })).toEqual({
      support: '2 otvorena zahteva', blocked: '1', export: 'U pripremi', legal: 'Čekaju tvoju saglasnost' });
    const nothing = hubWords({});
    expect(nothing).toEqual({ support: undefined, blocked: undefined, export: undefined, legal: undefined });
    expect(Object.values(nothing).every(word => word === undefined)).toBe(true);
    expect(hubWords({ blocked: { count: 0, more: false } })).toMatchObject({ blocked: 'Nema', support: undefined, export: undefined, legal: undefined });
  });
  it('says the version the build records, and never one made up', () => {
    expect(versionWord('1.4.2')).toBe('Verzija 1.4.2'); expect(versionWord(null)).toBeUndefined(); expect(versionWord(undefined)).toBeUndefined(); expect(versionWord('')).toBeUndefined();
  });
  it('says no word that the privacy wording forbids: no promise of anonymity, no "nije dostupno" in place of a state', () => {
    const all = [...Object.values(EXPORT_WORDS).filter(word => word !== EXPORT_WORDS.READY_UNAVAILABLE), ...Object.values(LEGAL_WORDS)].join(' ');
    expect(all).not.toMatch(/anonim|server|zakon|GDPR/i); expect(all).not.toMatch(/nije dostupn/i);
  });
});
