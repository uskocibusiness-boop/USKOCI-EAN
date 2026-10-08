import { writeAvailableNow } from '../availableNowWrite';

const mockRead = jest.fn(), mockSave = jest.fn();
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: { read: () => mockRead(), save: (c: unknown) => mockSave(c) } }));

// "Mogu odmah" is written one way from Početna and Radni profil (8 Oct 2026): the saved week goes back with only availableNow changed.
const week = { timezone: 'Europe/Belgrade', availableNow: false, rules: [{ weekdays: [1], startTime: '08:00', endTime: '16:00', active: true }], windows: [], revision: 'r7' };
beforeEach(() => { mockRead.mockReset(); mockSave.mockReset(); });

it('reads the saved week and writes it back with only availableNow changed, at the revision it was read at', async () => {
  mockRead.mockResolvedValue({ ok: true, podatak: week });
  mockSave.mockResolvedValue({ ok: true, podatak: { availability: { ...week, availableNow: true } } });
  await expect(writeAvailableNow(true)).resolves.toBe(true);
  expect(mockSave).toHaveBeenCalledWith({ expectedRevision: 'r7', value: { timezone: week.timezone, availableNow: true, rules: week.rules, windows: [] } });
});

it('answers null, never a change, when the read or the save does not go through', async () => {
  mockRead.mockResolvedValue({ ok: false });
  await expect(writeAvailableNow(true)).resolves.toBeNull(); expect(mockSave).not.toHaveBeenCalled();
  mockRead.mockResolvedValue({ ok: true, podatak: week }); mockSave.mockRejectedValue(new Error('NETWORK'));
  await expect(writeAvailableNow(false)).resolves.toBeNull();
});

it('lets a screen bound each call', async () => {
  mockRead.mockResolvedValue({ ok: true, podatak: week });
  mockSave.mockResolvedValue({ ok: true, podatak: { availability: { ...week, availableNow: false } } });
  let calls = 0;
  const bound = <T,>(call: () => Promise<T>) => { calls++; return call(); };
  await expect(writeAvailableNow(false, bound)).resolves.toBe(false);
  expect(calls).toBe(2);
});
