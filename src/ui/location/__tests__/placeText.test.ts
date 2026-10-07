import type { ConfirmedLocationPoint } from '../../../contracts/location';
import { confirmedPlaceEntries, shortPlaceLabel, toSerbianLatin } from '../placeText';
import { toSerbianLatin as fromEditor } from '../LocationPointEditor';

/**
 * The confirmed place as ONE line of the conversation (owner, phone test 2026-10-07): street and number in bold, then the
 * place, never the provider's whole label with its "MZ" and neighbourhoods. Nothing is invented: a part that is not in the
 * label is never added, and a short text a person typed is shown whole.
 */
describe('shortPlaceLabel', () => {
  const provider = '65, Bulevar oslobođenja, MZ Žitni trg, Rotkvarija, Novi Sad, Grad Novi Sad, Južnobački upravni okrug, Vojvodina, 21101, Srbija';

  it('turns the provider label of the owner’s test into street, number and locality', () => {
    expect(shortPlaceLabel(provider, ['Novi Sad'])).toEqual({ main: 'Bulevar oslobođenja 65', locality: 'Novi Sad' });
  });

  it('reads a Cyrillic provider label in Latin', () => {
    expect(shortPlaceLabel('65, Булевар ослобођења, МЗ Житни трг, Роткварија, Нови Сад, Србија', ['Novi Sad']))
      .toEqual({ main: 'Bulevar oslobođenja 65', locality: 'Novi Sad' });
  });

  it('never adds a locality the label does not contain, and never guesses one among many parts', () => {
    expect(shortPlaceLabel(provider, ['Beograd'])).toEqual({ main: 'Bulevar oslobođenja 65', locality: null });
    expect(shortPlaceLabel(provider, [])).toEqual({ main: 'Bulevar oslobođenja 65', locality: null });
  });

  it('keeps a short text whole: the spoken address and a typed note lose nothing', () => {
    expect(shortPlaceLabel('Bulevar oslobođenja 65, Novi Sad', ['Novi Sad'])).toEqual({ main: 'Bulevar oslobođenja 65', locality: 'Novi Sad' });
    expect(shortPlaceLabel('Kod pošte, ulaz 2', ['Novi Sad'])).toEqual({ main: 'Kod pošte', locality: 'ulaz 2' });
    expect(shortPlaceLabel('Synthetic private candidate', ['Novi Sad'])).toEqual({ main: 'Synthetic private candidate', locality: null });
  });

  it('keeps a named place first and a house number with a letter', () => {
    expect(shortPlaceLabel('Spens, Sutjeska, Liman, Novi Sad, Srbija', ['Novi Sad'])).toEqual({ main: 'Spens', locality: 'Novi Sad' });
    expect(shortPlaceLabel('12a, Zmaj Jovina, Stari grad, Novi Sad, Srbija', ['novi sad'])).toEqual({ main: 'Zmaj Jovina 12a', locality: 'Novi Sad' });
  });

  it('does not repeat a locality the main part already names', () => {
    expect(shortPlaceLabel('Novi Sad, Grad Novi Sad, Srbija', ['Novi Sad'])).toEqual({ main: 'Novi Sad', locality: null });
  });

  it('is the one transliteration the point editor uses too', () => {
    expect(fromEditor).toBe(toSerbianLatin);
    expect(toSerbianLatin('Љубе Ненадовића 3, Нови Сад')).toBe('Ljube Nenadovića 3, Novi Sad');
  });
});

describe('confirmedPlaceEntries', () => {
  const stationary = { mode: 'STATIONARY' as const, start: { city: 'Novi Sad', area: 'Rotkvarija' } };
  const point = (patch: Partial<ConfirmedLocationPoint> = {}): ConfirmedLocationPoint => ({ slot: 'start', latitudeE6: 45_258_900,
    longitudeE6: 19_832_700, origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'locationiq', candidateHint: null },
    address: '65, Bulevar oslobođenja, MZ Žitni trg, Rotkvarija, Novi Sad, Srbija', ...patch });

  it('says "Potvrđeno mesto" for a task in one place, and keeps the whole label for a screen reader', () => {
    expect(confirmedPlaceEntries([point()], { geography: stationary, exactAddress: null })).toEqual([{ slot: 'start',
      lead: 'Potvrđeno mesto', noun: 'mesto zadatka', main: 'Bulevar oslobođenja 65', locality: 'Novi Sad', exact: true, ack: false,
      spoken: 'Potvrđeno mesto: 65, Bulevar oslobođenja, MZ Žitni trg, Rotkvarija, Novi Sad, Srbija' }]);
  });

  it('acknowledges a place the person moved by hand, from that point alone', () => {
    const [entry] = confirmedPlaceEntries([point({ origin: { kind: 'MANUAL_PIN' } })], { geography: stationary, exactAddress: null }, new Set(['start']));
    expect(entry).toMatchObject({ ack: true, main: 'Bulevar oslobođenja 65', locality: 'Novi Sad',
      spoken: 'U redu, mesto zadatka je sada: 65, Bulevar oslobođenja, MZ Žitni trg, Rotkvarija, Novi Sad, Srbija' });
  });

  it('names each route point by its role, in route order', () => {
    const route = { mode: 'MULTI_STOP' as const, start: { city: 'Novi Sad' }, waypoints: [{ city: 'Sremski Karlovci' }], end: { city: 'Beočin' } };
    const entries = confirmedPlaceEntries([
      point({ slot: 'end', address: 'Beočin centar' }), point({ slot: 'start', address: 'Bulevar oslobođenja 65, Novi Sad' }),
      point({ slot: 'waypoints/0', address: 'Trg Branka Radičevića, Sremski Karlovci' }),
    ], { geography: route, exactAddress: null });
    expect(entries.map(entry => [entry.lead, entry.main, entry.locality])).toEqual([
      ['Potvrđeno polazište', 'Bulevar oslobođenja 65', 'Novi Sad'],
      ['Potvrđena stanica 1', 'Trg Branka Radičevića', 'Sremski Karlovci'],
      ['Potvrđeno odredište', 'Beočin centar', null],
    ]);
  });

  it('says only "tačka na mapi" for a hand-placed point without an address, and the conversation’s place for a provider point without one', () => {
    const [manual] = confirmedPlaceEntries([point({ origin: { kind: 'MANUAL_PIN' }, address: undefined })], { geography: stationary, exactAddress: null });
    expect(manual).toMatchObject({ main: 'tačka na mapi', locality: null, exact: false, spoken: 'Potvrđeno mesto: tačka na mapi' });
    const [provider] = confirmedPlaceEntries([point({ address: undefined })],
      { geography: stationary, exactAddress: 'Bulevar oslobođenja 65' });
    // The seed is the private address, the area and the city ("Bulevar oslobođenja 65, Rotkvarija, Novi Sad").
    expect(provider).toMatchObject({ main: 'Bulevar oslobođenja 65', locality: 'Novi Sad', exact: true });
  });
});
