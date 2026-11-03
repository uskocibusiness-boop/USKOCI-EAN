import { LegalReviewController, boundedLegalRead, legalHttpsUrl, reviewedDocuments, sessionLegalIntentJournal } from '../legalReview';
import type { LegalAcceptanceReceipt, LegalBundleStatus } from '../../../contracts/legal';

const terms = 'a'.repeat(64), privacy = 'b'.repeat(64), key = '11111111-1111-4111-8111-111111111111';
const bundle = (): LegalBundleStatus => ({ ready: true, acceptedCurrentBundle: false, reason: null, documents: [
  { kind: 'TERMS', version: 'RC2', sha256: terms, url: 'https://example.test/terms', publishedAt: '2026-09-13T00:00:00Z', effectiveAt: '2026-09-13T00:00:00Z' },
  { kind: 'PRIVACY', version: 'V1', sha256: privacy, url: 'https://example.test/privacy', publishedAt: '2026-09-13T00:00:00Z', effectiveAt: '2026-09-13T00:00:00Z' },
] });
const receipt = (): LegalAcceptanceReceipt => ({ accepted: true, acceptedAt: '2026-09-13T00:00:00Z', idempotentReplay: false,
  termsVersion: 'RC2', privacyVersion: 'V1', termsSha256: terms, privacySha256: privacy });
const ok = <T>(podatak: T) => ({ ok: true as const, podatak });
const uncertain = { ok: false as const, kod: 'LEGAL_ACCEPT_OUTCOME_UNKNOWN', poruka: 'Ishod nije poznat.' };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
const flush = async () => { for (let index = 0; index < 15; index++) await Promise.resolve(); };
function setup() {
  let isOwner = true;
  const deps = { isOwner: () => isOwner, newId: jest.fn(() => key), readBundle: jest.fn(async () => ok(bundle())),
    readProcessors: jest.fn(async () => ok({ ready: false as const, reason: 'PROCESSOR_MAP_NOT_PUBLISHED' as const, missingProviders: [] })),
    accept: jest.fn(async (_key: string, _terms: string, _privacy: string): Promise<any> => ok(receipt())),
    readAcceptance: jest.fn(async (_key: string): Promise<any> => ok({ found: false, receipt: null })) };
  const controller = new LegalReviewController(deps);
  return { deps, controller, loseOwner: () => { isOwner = false; } };
}
afterEach(() => jest.useRealTimers());

it('admits exactly two published documents with real HTTPS URLs and hashes', () => {
  expect(reviewedDocuments(bundle())).toHaveLength(2);
  expect(reviewedDocuments({ ...bundle(), ready: false })).toBeNull();
  expect(reviewedDocuments({ ...bundle(), documents: [bundle().documents[0], bundle().documents[0]] })).toBeNull();
  const invalid = bundle(); invalid.documents[1].url = 'javascript:alert(1)'; expect(reviewedDocuments(invalid)).toBeNull();
  expect(legalHttpsUrl('https://user:password@example.test')).toBeNull(); expect(legalHttpsUrl('https://')).toBeNull();
});
it('does not publish invented documents or providers for not-ready server state', async () => {
  const { controller, deps } = setup(); deps.readBundle.mockResolvedValue(ok({ ready: false, acceptedCurrentBundle: false,
    reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED', documents: [] }));
  controller.activate(); await flush(); await controller.accept();
  expect(controller.snapshot().processors?.ready).toBe(false); expect(deps.accept).not.toHaveBeenCalled();
});
it('sends the exact two reviewed hashes once even under rapid repeated presses', async () => {
  const { controller, deps } = setup(), pending = deferred<any>(); deps.accept.mockReturnValue(pending.promise);
  controller.activate(); await flush(); const first = controller.accept(); void controller.accept();
  await flush(); expect(deps.accept).toHaveBeenCalledTimes(1); expect(deps.accept).toHaveBeenCalledWith(key, terms, privacy);
  pending.resolve(ok(receipt())); await first; await controller.accept(); expect(deps.accept).toHaveBeenCalledTimes(1);
  expect(controller.snapshot().receipt?.accepted).toBe(true);
});
it('an unknown outcome triggers no write retry and readback FOUND confirms original receipt', async () => {
  const { controller, deps } = setup(); deps.accept.mockResolvedValue(uncertain);
  controller.activate(); await flush(); await controller.accept(); await controller.accept();
  expect(deps.accept).toHaveBeenCalledTimes(1); expect(controller.snapshot().pending).toBe('READ_REQUIRED');
  deps.readAcceptance.mockResolvedValue(ok({ found: true, receipt: receipt() })); await controller.readOutcome();
  expect(deps.readAcceptance).toHaveBeenCalledWith(key); expect(controller.snapshot().receipt?.termsSha256).toBe(terms);
});
it('ABSENT offers only an explicit replay of the same key and reviewed bundle', async () => {
  const { controller, deps } = setup(); deps.accept.mockResolvedValueOnce(uncertain);
  controller.activate(); await flush(); await controller.accept(); await controller.readOutcome();
  expect(deps.accept).toHaveBeenCalledTimes(1); expect(controller.snapshot().pending).toBe('REPLAY_AVAILABLE');
  await controller.accept(); expect(deps.accept.mock.calls).toEqual([[key, terms, privacy], [key, terms, privacy]]);
  expect(deps.newId).toHaveBeenCalledTimes(1);
});
it('blur and account ABA make old reads and writes unable to mutate visible state', async () => {
  const { controller, deps, loseOwner } = setup(), pending = deferred<any>();
  controller.activate(); await flush(); deps.accept.mockReturnValue(pending.promise);
  const first = controller.accept(); await flush(); controller.deactivate(); loseOwner();
  pending.resolve(ok(receipt())); await first;
  expect(controller.snapshot().receipt).toBeNull(); await controller.readOutcome(); expect(deps.readAcceptance).not.toHaveBeenCalled();
});
it('refocus retains an unknown intent and requires readback before any further write', async () => {
  const { controller, deps } = setup(), pending = deferred<any>(); controller.activate(); await flush(); deps.accept.mockReturnValue(pending.promise);
  const first = controller.accept(); await flush(); controller.deactivate(); pending.resolve(ok(receipt())); await first;
  controller.activate(); await flush(); await controller.accept(); expect(deps.accept).toHaveBeenCalledTimes(1);
  expect(controller.snapshot().pending).toBe('READ_REQUIRED'); await controller.readOutcome(); expect(deps.readAcceptance).toHaveBeenCalledWith(key);
});
it('route remount retains exact unknown coordinates and account changes retire the journal', async () => {
  const { deps } = setup(), journal = sessionLegalIntentJournal('accountA:1');
  const first = new LegalReviewController({ ...deps, intentJournal: journal }); deps.accept.mockResolvedValue(uncertain);
  first.activate(); await flush(); await first.accept(); first.deactivate();
  const remounted = new LegalReviewController({ ...deps, intentJournal: sessionLegalIntentJournal('accountA:1') });
  remounted.activate(); await flush(); await remounted.accept(); expect(deps.accept).toHaveBeenCalledTimes(1);
  await remounted.readOutcome(); expect(deps.readAcceptance).toHaveBeenCalledWith(key);
  const other = sessionLegalIntentJournal('accountB:2'); expect(other.read()).toBeNull(); expect(journal.read()).toBeNull();
  expect(sessionLegalIntentJournal('accountA:3').read()).toBeNull();
});
it('retained old button callback cannot accept a newly loaded unseen bundle', async () => {
  const { controller, deps } = setup(); controller.activate(); await flush(); const oldBundle = controller.snapshot().bundle;
  const next = bundle(); next.documents[0].sha256 = 'c'.repeat(64); deps.readBundle.mockResolvedValue(ok(next)); await controller.refresh();
  await controller.accept(oldBundle); expect(deps.accept).not.toHaveBeenCalled();
  await controller.accept(controller.snapshot().bundle); expect(deps.accept).toHaveBeenCalledWith(key, 'c'.repeat(64), privacy);
});
it('ABSENT after bundle publication offers explicit frozen replay without allocating another key', async () => {
  const { controller, deps } = setup(); controller.activate(); await flush(); deps.accept.mockResolvedValue(uncertain); await controller.accept();
  const next = bundle(); next.documents[0].sha256 = 'c'.repeat(64); deps.readBundle.mockResolvedValue(ok(next)); await controller.refresh();
  await controller.accept(); expect(deps.accept).toHaveBeenCalledTimes(1);
  await controller.readOutcome(); expect(deps.accept).toHaveBeenCalledTimes(1);
  expect(controller.snapshot().pending).toBe('REPLAY_AVAILABLE');
  await controller.accept(); expect(deps.newId).toHaveBeenCalledTimes(1);
  expect(deps.accept.mock.calls).toEqual([[key, terms, privacy], [key, terms, privacy]]);
  expect(controller.snapshot().pending).toBe('READ_REQUIRED');
});
it('a definitive server review-change denial requires reading the bundle again', async () => {
  const { controller, deps } = setup(); controller.activate(); await flush();
  deps.accept.mockResolvedValue({ ok: false, kod: 'LEGAL_REVIEW_CHANGED', poruka: 'Dokumenti su promenjeni.', authoritativeReviewChanged: true });
  await controller.accept(); expect(controller.snapshot().bundle).toBeNull(); expect(controller.snapshot().pending).toBeNull();
  await controller.accept(); expect(deps.accept).toHaveBeenCalledTimes(1);
});
it('local malformed coordinates cannot retire an unknown intent despite the same error code', async () => {
  const { controller, deps } = setup(); controller.activate(); await flush();
  deps.accept.mockResolvedValue({ ok: false, kod: 'LEGAL_REVIEW_CHANGED', poruka: 'Dokumenti su promenjeni.' });
  await controller.accept(); expect(controller.snapshot().pending).toBe('READ_REQUIRED');
  expect(controller.snapshot().bundle).not.toBeNull();
  await controller.readOutcome(); await controller.accept();
  expect(deps.accept.mock.calls).toEqual([[key, terms, privacy], [key, terms, privacy]]);
  expect(deps.newId).toHaveBeenCalledTimes(1);
});
it('a rejected obsolete replay releases the old intent only for a fresh read and explicit new consent', async () => {
  const { controller, deps } = setup(), nextKey = '22222222-2222-4222-8222-222222222222';
  deps.newId.mockReturnValueOnce(key).mockReturnValueOnce(nextKey);
  controller.activate(); await flush(); deps.accept.mockResolvedValueOnce(uncertain); await controller.accept();
  const next = bundle(); next.documents[0].sha256 = 'c'.repeat(64); deps.readBundle.mockResolvedValue(ok(next)); await controller.refresh();
  await controller.readOutcome();
  deps.accept.mockResolvedValueOnce({ ok: false, kod: 'LEGAL_REVIEW_CHANGED', poruka: 'Pročitaj aktuelne dokumente.', authoritativeReviewChanged: true });
  await controller.accept();
  expect(deps.accept.mock.calls).toEqual([[key, terms, privacy], [key, terms, privacy]]);
  expect(controller.snapshot()).toMatchObject({ bundle: null, pending: null, receipt: null, busy: false });
  await controller.accept(); expect(deps.newId).toHaveBeenCalledTimes(1);
  await controller.refresh(); expect(deps.accept).toHaveBeenCalledTimes(2);
  deps.accept.mockResolvedValueOnce(ok({ ...receipt(), termsSha256: 'c'.repeat(64) })); await controller.accept();
  expect(deps.accept).toHaveBeenLastCalledWith(nextKey, 'c'.repeat(64), privacy);
  expect(controller.snapshot().receipt?.termsSha256).toBe('c'.repeat(64));
});
it.each(['read', 'replay'] as const)('an exact old receipt from %s resolves recovery without accepting newer documents', async source => {
  const { controller, deps } = setup(); controller.activate(); await flush();
  deps.accept.mockResolvedValueOnce(uncertain); await controller.accept();
  const next = bundle(); next.documents[0].sha256 = 'c'.repeat(64); deps.readBundle.mockResolvedValue(ok(next)); await controller.refresh();
  if (source === 'read') deps.readAcceptance.mockResolvedValueOnce(ok({ found: true, receipt: receipt() }));
  await controller.readOutcome();
  if (source === 'replay') await controller.accept();
  expect(controller.snapshot()).toMatchObject({ receipt: receipt(), pending: null, busy: false });
  expect(controller.snapshot().bundle?.acceptedCurrentBundle).toBe(false);
  expect(deps.newId).toHaveBeenCalledTimes(1);
  expect(deps.accept.mock.calls.every(([, t, p]) => t === terms && p === privacy)).toBe(true);
});
it('replay remains possible after ABSENT even when current documents are unavailable', async () => {
  const { controller, deps } = setup(); controller.activate(); await flush();
  deps.accept.mockResolvedValueOnce(uncertain); await controller.accept();
  deps.readBundle.mockRejectedValue(new Error('offline')); await controller.refresh(); await controller.readOutcome();
  expect(controller.snapshot().pending).toBe('REPLAY_AVAILABLE');
  await controller.accept(); expect(deps.accept).toHaveBeenLastCalledWith(key, terms, privacy);
  expect(controller.snapshot()).toMatchObject({ bundle: null, receipt: receipt(), pending: null });
});
it('a malformed absent read cannot authorize replay', async () => {
  const { controller, deps } = setup(); controller.activate(); await flush(); deps.accept.mockResolvedValueOnce(uncertain); await controller.accept();
  deps.readAcceptance.mockResolvedValueOnce(ok({ found: false, receipt: receipt() })); await controller.readOutcome(); await controller.accept();
  expect(controller.snapshot().pending).toBe('READ_REQUIRED'); expect(deps.accept).toHaveBeenCalledTimes(1);
});
it.each(['success', 'changed'] as const)('late %s from a previous controller cannot erase a newer journal intent', async outcome => {
  const { deps } = setup(), old = deferred<any>(), newer = deferred<any>(), nextKey = '22222222-2222-4222-8222-222222222222';
  const journal = sessionLegalIntentJournal(`late-${outcome}`);
  deps.newId.mockReturnValueOnce(key).mockReturnValueOnce(nextKey); deps.accept.mockReturnValueOnce(old.promise);
  const first = new LegalReviewController({ ...deps, intentJournal: journal }); first.activate(); await flush();
  const prior = first.accept(); await flush();
  const second = new LegalReviewController({ ...deps, intentJournal: journal }); second.activate(); await flush();
  deps.readAcceptance.mockResolvedValueOnce(ok({ found: true, receipt: receipt() })); await second.readOutcome();
  const next = bundle(); next.documents[0].sha256 = 'c'.repeat(64); deps.readBundle.mockResolvedValue(ok(next)); await second.refresh();
  deps.accept.mockReturnValueOnce(newer.promise); const active = second.accept(); await flush();
  old.resolve(outcome === 'success' ? ok(receipt()) : { ok: false, kod: 'LEGAL_REVIEW_CHANGED', poruka: 'Promenjeno.', authoritativeReviewChanged: true });
  await prior;
  expect(journal.read()).toEqual({ key: nextKey, terms: 'c'.repeat(64), privacy });
  expect(second.snapshot()).toMatchObject({ busy: true, pending: 'READ_REQUIRED' });
  await first.readOutcome(); await first.accept(); expect(deps.accept).toHaveBeenCalledTimes(2);
  newer.resolve(ok({ ...receipt(), termsSha256: 'c'.repeat(64) })); await active;
  expect(journal.read()).toBeNull();
});
it('blur before deferred dispatch sends no legal write', async () => {
  const { controller, deps } = setup(); controller.activate(); await flush();
  const request = controller.accept(); controller.deactivate(); await request;
  expect(deps.accept).not.toHaveBeenCalled();
});
it('mismatched authoritative receipt is not accepted or silently replaced with a new intent', async () => {
  const { controller, deps } = setup(); controller.activate(); await flush(); deps.accept.mockResolvedValue(ok({ ...receipt(), privacySha256: 'c'.repeat(64) }));
  await controller.accept(); deps.readAcceptance.mockResolvedValue(ok({ found: true, receipt: { ...receipt(), termsSha256: 'c'.repeat(64) } }));
  await controller.readOutcome(); expect(controller.snapshot().receipt).toBeNull(); expect(controller.snapshot().pending).toBe('READ_REQUIRED');
});
it('a bounded read rejects a hung transport and ignores its eventual late result', async () => {
  jest.useFakeTimers(); const pending = deferred<string>(); const read = boundedLegalRead(() => pending.promise);
  const rejection = expect(read).rejects.toThrow('LEGAL_READ_TIMEOUT'); await jest.advanceTimersByTimeAsync(15_000); await rejection;
  pending.resolve('late'); await flush(); expect(jest.getTimerCount()).toBe(0);
});
