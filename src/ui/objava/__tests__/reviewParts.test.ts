import type { NeedLocationInput } from '../../../contracts/location';
import type { NeedFactV2Key } from '../../../contracts/needFactsV2';
import { blankList, deadlineWords, groupOf, groupedFacts, ownerAddressFrame, partFact } from '../reviewFacts';

/**
 * The price and the time are each ONE line of the task and several facts (owner, 8 Oct 2026: a pencil on each part, opening exactly that
 * data). The line has one pencil, which opens the fact a person most likely means; the others are a tap away inside its editor.
 */
describe('the lines made of several facts', () => {
  const f = (key: NeedFactV2Key, value: unknown, id: string | null = key) => ({ id, key, value });
  const price = (mode: string, amount: number | null, basis = true) => [f('need.price_mode', mode), ...(amount === null ? [] : [f('need.price_rsd', amount)]),
    ...(basis ? [f('need.price_basis', 'TOTAL')] : [])];

  it('lists the facts of a line that can be corrected here, in the order of the line', () => {
    expect(groupedFacts('value', price('MY_PRICE', 1500)).map(fact => fact.key)).toEqual(['need.price_rsd', 'need.price_mode', 'need.price_basis']);
    expect(groupedFacts('time', [f('need.ends_at', 'b'), f('need.starts_at', 'a'), f('need.schedule_kind', 'FIXED_WINDOW')]).map(fact => fact.key))
      .toEqual(['need.schedule_kind', 'need.starts_at', 'need.ends_at']);
    // A fact with no id cannot be corrected, so it is not offered; a fact of another line is not either.
    expect(groupedFacts('value', [f('need.price_rsd', 1500, null), f('need.title', 'x')])).toEqual([]);
  });
  it('the pencil of the price opens the amount under "Moja cena", and the way the price works under "Ponude"', () => {
    expect(partFact('value', price('MY_PRICE', 1500))?.key).toBe('need.price_rsd');
    expect(partFact('value', price('OFFERS', 1500))?.key).toBe('need.price_mode');
    expect(partFact('value', price('OFFERS', null, false))?.key).toBe('need.price_mode');
  });
  it('falls to whatever can be corrected, and to nothing when nothing can', () => {
    expect(partFact('value', [f('need.price_mode', 'MY_PRICE'), f('need.price_rsd', 1500, null)])?.key).toBe('need.price_mode');
    expect(partFact('value', [f('need.price_mode', 'MY_PRICE', null), f('need.price_basis', 'TOTAL')])?.key).toBe('need.price_basis');
    expect(partFact('value', [f('need.title', 'x')])).toBeUndefined(); expect(partFact('time', [])).toBeUndefined();
  });
  it('the pencil of the time opens the start of a fixed term, and the kind of any other', () => {
    const fixed = [f('need.schedule_kind', 'FIXED_WINDOW'), f('need.starts_at', 'a'), f('need.ends_at', 'b')];
    expect(partFact('time', fixed)?.key).toBe('need.starts_at');
    expect(partFact('time', [f('need.schedule_kind', 'FLEXIBLE'), f('need.starts_at', 'a')])?.key).toBe('need.schedule_kind');
    expect(partFact('time', [f('need.schedule_kind', 'FIXED_WINDOW')])?.key).toBe('need.schedule_kind');
    expect(partFact('time', [f('need.ends_at', 'b')])?.key).toBe('need.ends_at');
  });
  it('says which line a fact belongs to, and none for a fact that stands alone', () => {
    expect([groupOf('need.price_rsd'), groupOf('need.price_mode'), groupOf('need.price_basis')]).toEqual(['value', 'value', 'value']);
    expect([groupOf('need.schedule_kind'), groupOf('need.starts_at'), groupOf('need.ends_at')]).toEqual(['time', 'time', 'time']);
    expect([groupOf('need.title'), groupOf('need.people_needed'), groupOf('need.required_tools')]).toEqual([null, null, null]);
  });
});

describe('what the task does not say yet', () => {
  it('a list with nothing in it is blank; one with an item, and a fact that is not a list, are not', () => {
    expect(blankList({ key: 'need.required_tools', value: [] })).toBe(true);
    expect(blankList({ key: 'need.required_tools', value: ['Čekić'] })).toBe(false);
    expect(blankList({ key: 'need.critical_conditions', value: null })).toBe(true);
    expect(blankList({ key: 'need.title', value: '' })).toBe(false);
    expect(blankList({ key: 'need.people_needed', value: 1 })).toBe(false);
  });
});

describe('deadlineWords', () => {
  it('says the deadline as the people who apply read it, in Serbian time', () => {
    expect(deadlineWords('2026-10-12T10:15:00.000Z')).toMatch(/^Prijave do 12\. okt( \d{4})? · 12:15 \(po vremenu u Srbiji\)$/);
  });
  it('says no deadline in three words: the part is named "Prijave", and what it means is no sentence of the screen', () => {
    expect(deadlineWords(null)).toBe('Bez posebnog roka');
  });
});

/** The frame of the exact address (owner only): the confirmed places in their short words, the stored address when it says more, what he wrote about getting in. */
describe('ownerAddressFrame', () => {
  const ADDRESS = '6, Pavla Ivića, Jugovićevo, MZ Jugovićevo, Novi Sad, Grad Novi Sad, Južnobački upravni okrug, Vojvodina, 21137, Srbija';
  const stationary: NeedLocationInput['geography'] = { mode: 'STATIONARY', start: { city: 'Novi Sad' } };
  const route: NeedLocationInput['geography'] = { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad' }, end: { city: 'Beograd' } };
  const START = { slot: 'start', latitudeE6: 45261418, longitudeE6: 19800509, origin: { kind: 'MANUAL_PIN' }, address: ADDRESS };
  const END = { slot: 'end', latitudeE6: 44811111, longitudeE6: 20461111, origin: { kind: 'MANUAL_PIN' }, address: '12, Dositejeva, Beograd, Srbija' };
  const at = (geography: NeedLocationInput['geography'], points: unknown[], exactAddress: string | null = null, accessNotes: string | null = null): NeedLocationInput =>
    ({ taskCountryCode: 'RS', geography, exactAddress, accessNotes,
      resolvedLocation: points.length ? { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress }, points } : null } as NeedLocationInput);
  const privates = (address: string | null, access: string | null = null) => [
    ...(address ? [{ key: 'need.exact_address' as const, value: address }] : []), ...(access ? [{ key: 'need.access_notes' as const, value: access }] : [])];

  it('reads one confirmed place in its short words and keeps the stored address when it says more', () => {
    const frame = ownerAddressFrame(at(stationary, [START], 'Pavla Ivića 6, stan 4'), privates('Pavla Ivića 6, stan 4', 'Interfon 4'));
    expect(frame.places).toEqual([{ slot: 'start', title: 'Mesto', text: 'Pavla Ivića 6, Novi Sad' }]);
    expect(frame.fullAddress).toBe('Pavla Ivića 6, stan 4'); expect(frame.notes).toEqual([{ title: null, text: 'Interfon 4' }]); expect(frame.unconfirmed).toBeNull();
  });
  it('does not say the address twice: the stored one stays only when it is not the very line the point gave', () => {
    expect(ownerAddressFrame(at(stationary, [START], 'Pavla Ivića 6, Novi Sad'), privates('Pavla Ivića 6, Novi Sad')).fullAddress).toBeNull();
    expect(ownerAddressFrame(at(stationary, [START], ADDRESS), privates(ADDRESS)).fullAddress).toBe(ADDRESS);
  });
  it('a route names each place under its role, and counts the points still to confirm', () => {
    const frame = ownerAddressFrame(at(route, [START]), []);
    expect(frame.places.map(place => place.title)).toEqual(['Polazište']);
    expect(frame.unconfirmed).toEqual({ done: 1, total: 2 });
    const both = ownerAddressFrame(at(route, [START, END]), []);
    expect(both.places.map(place => place.title)).toEqual(['Polazište', 'Odredište']); expect(both.unconfirmed).toBeNull();
  });
  it('with no confirmed point the stored address is the only line, and nothing is counted', () => {
    expect(ownerAddressFrame(null, privates('Privatna 42'))).toEqual({ places: [], fullAddress: 'Privatna 42', notes: [], unconfirmed: null });
  });
  it('names the notes of several points by their role, beside the one the owner wrote for the whole task', () => {
    const noted = (slot: string, accessNotes: string) => ({ ...(slot === 'start' ? START : END), accessNotes });
    const frame = ownerAddressFrame(at(route, [noted('start', 'Zvono 3'), noted('end', 'Ulaz sa dvorišta')], null, 'Pozovi pre dolaska'), privates(null, 'Pozovi pre dolaska'));
    expect(frame.notes).toEqual([{ title: null, text: 'Pozovi pre dolaska' }, { title: 'Polazište', text: 'Zvono 3' }, { title: 'Odredište', text: 'Ulaz sa dvorišta' }]);
  });
  it('says nothing of remote work', () => {
    expect(ownerAddressFrame({ taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null, resolvedLocation: null }, []))
      .toEqual({ places: [], fullAddress: null, notes: [], unconfirmed: null });
  });
});
