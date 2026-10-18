import { ru4Production } from '../ru4Production';
const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
const input = { prijavaId: '10000000-0000-4000-8000-000000000001', ocekivanaVerzija: 2,
  ocekivanaPotrebaRevizija: 4, clientRequestId: 'reconfirm-123456', akcija: 'KEEP' as const };

it.each(['FIXED_PRICE_MISMATCH','FIXED_PRICE_NOT_READY','TOTAL_PRICE_REQUIRES_ALL_SLOTS','UNKNOWN_PRICE_BASIS',
  'PROFILE_NOT_OWNED_BY_ACCOUNT','WORKER_PROFILE_NOT_READY','WORKER_NOT_ELIGIBLE','TEAM_CAPACITY_EXCEEDED',
  'NEED_FULL','NEED_REMAINING_CAPACITY_EXCEEDED','RESPONSE_WINDOW_EXPIRED','NEED_EXECUTION_WINDOW_EXPIRED','INVALID_PROPOSED_INTERVAL',
  'AGREEMENT_CALENDAR_INTERVAL_INVALID','NEED_FIXED_INTERVAL_INVALID','IDEMPOTENCY_KEY_REUSED'])
('reconfirmation preserves a definite %s refusal without leaking raw server details', async message => {
  mockRpc.mockResolvedValue({ data: null, error: { message, details: 'private SQL evidence', hint: 'secret detail' } });
  const result = await ru4Production.resolveChangedApplication(input);
  expect(result).toMatchObject({ ok: false, kod: message });
  expect(JSON.stringify(result)).not.toMatch(/private SQL|secret detail/);
});
it('keeps an unknown server failure unconfirmed', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'private internal exception' } });
  const result = await ru4Production.resolveChangedApplication(input);
  expect(result).toMatchObject({ ok: false, kod: 'STALE_RESPONSE_RESOLUTION_FAILED' });
  expect(JSON.stringify(result)).not.toContain('private internal');
});
