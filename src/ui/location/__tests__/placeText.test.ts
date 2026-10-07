import type { ConfirmedLocationPoint } from '../../../contracts/location';
import type { NeedTaskGeography } from '../../../contracts/needFactsV2';
import { confirmedPlaceEntries, ownerPlace, ownerPlaceLine, ownerPlaces, shortPlaceLabel, tidyPlaceLabel, toSerbianLatin } from '../placeText';
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

/**
 * The OWNER's place line for a slot (owner, 2026-10-07): he typed "Lenke Dunđerski 11, Novi Sad", moved the pin, and after publishing the
 * task still said "Lenke Dunđerski". The geography's words come from the first text and a pin does not rewrite them; the confirmed point's
 * own address is what the person confirmed. The real shapes of the owner's task are used below.
 */
describe('ownerPlace', () => {
  const ADDRESS = '6, Pavla Ivića, Jugovićevo, MZ Jugovićevo, Novi Sad, Grad Novi Sad, Južnobački upravni okrug, Vojvodina, 21137, Srbija';
  const END_ADDRESS = '12, Dositejeva, Stari grad, Novi Sad, Grad Novi Sad, Južnobački upravni okrug, Vojvodina, 21101, Srbija';
  // What was stored for his task: the label the AI took from the first text, the city, and the pin he moved to another place.
  const stationary: NeedTaskGeography = { mode: 'STATIONARY', start: { city: 'Novi Sad', label: 'Lenke Dunđerski' } };
  const route: NeedTaskGeography = { mode: 'MULTI_STOP', start: { city: 'Novi Sad', label: 'Lenke Dunđerski' },
    waypoints: [{ city: 'Novi Sad', label: 'Bulevar oslobođenja' }], end: { city: 'Novi Sad', label: 'Dositejeva' } };
  const pin = (patch: Partial<ConfirmedLocationPoint> = {}): ConfirmedLocationPoint => ({ slot: 'start', latitudeE6: 45_261_418, longitudeE6: 19_800_509,
    origin: { kind: 'MANUAL_PIN' }, address: ADDRESS, ...patch });
  const provider = (patch: Partial<ConfirmedLocationPoint> = {}): ConfirmedLocationPoint => pin({
    origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'locationiq', candidateHint: null }, ...patch });

  it('prefers the confirmed point’s own address, in the short form, over the label the first text left behind', () => {
    const place = ownerPlace('start', { geography: stationary, exactAddress: ADDRESS, points: [pin()] });
    expect(place).toEqual({ slot: 'start', source: 'POINT', main: 'Pavla Ivića 6', locality: 'Novi Sad', text: 'Pavla Ivića 6, Novi Sad', spoken: ADDRESS });
    expect(place!.text).not.toContain('Lenke');
    expect(ownerPlaceLine('start', { geography: stationary, exactAddress: ADDRESS, points: [pin()] })).toBe('Pavla Ivića 6, Novi Sad');
    // A point the provider proposed and the person accepted reads the same way.
    expect(ownerPlace('start', { geography: stationary, exactAddress: ADDRESS, points: [provider()] })).toMatchObject({ source: 'POINT', text: 'Pavla Ivića 6, Novi Sad' });
  });

  it('reads a Cyrillic provider address in Latin, as the conversation does, and keeps a short typed address whole', () => {
    const cyrillic = '6, Павла Ивића, Југовићево, МЗ Југовићево, Нови Сад, Србија';
    expect(ownerPlace('start', { geography: stationary, exactAddress: null, points: [pin({ address: cyrillic })] })!.text).toBe('Pavla Ivića 6, Novi Sad');
    expect(ownerPlace('start', { geography: stationary, exactAddress: null, points: [pin({ address: 'Kod pošte, ulaz 2' })] })!.text).toBe('Kod pošte, ulaz 2');
  });

  it('falls back to the geography’s words only for a slot that has no confirmed point', () => {
    const place = ownerPlace('start', { geography: stationary, exactAddress: null, points: [] });
    expect(place).toEqual({ slot: 'start', source: 'GEOGRAPHY', main: 'Lenke Dunđerski · Novi Sad', locality: null, text: 'Lenke Dunđerski · Novi Sad', spoken: 'Lenke Dunđerski · Novi Sad' });
    expect(ownerPlace('start', { geography: stationary, exactAddress: null })!.source).toBe('GEOGRAPHY');
    expect(ownerPlace('start', { geography: { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Liman' } }, exactAddress: null })!.text).toBe('Novi Sad · Liman');
    // No point and no place of its own: nothing is invented.
    expect(ownerPlace('end', { geography: stationary, exactAddress: null, points: [pin()] })).toBeNull();
    expect(ownerPlace('start', { geography: null, exactAddress: null, points: [] })).toBeNull();
  });

  it('says only "Tačka na mapi" for a hand-placed pin without an address, never the label that pin outdates', () => {
    const place = ownerPlace('start', { geography: stationary, exactAddress: null, points: [pin({ address: undefined })] });
    expect(place).toEqual({ slot: 'start', source: 'MAP', main: 'tačka na mapi', locality: null, text: 'Tačka na mapi', spoken: 'tačka na mapi' });
    expect(pin({ address: '   ' }).address?.trim()).toBe('');
    expect(ownerPlace('start', { geography: stationary, exactAddress: null, points: [pin({ address: '   ' })] })!.source).toBe('MAP');
  });

  it('a provider point without an address keeps the conversation’s place (the private address, the label, the city)', () => {
    const place = ownerPlace('start', { geography: stationary, exactAddress: 'Pavla Ivića 6', points: [provider({ address: undefined })] });
    expect(place).toMatchObject({ source: 'POINT', main: 'Pavla Ivića 6', locality: 'Novi Sad' });
  });

  it('a route: one line per slot in route order, each from its own point, and an unconfirmed slot keeps only the geography’s words', () => {
    const points = [provider({ slot: 'end', address: END_ADDRESS }), pin()];
    const places = ownerPlaces({ geography: route, exactAddress: null, points });
    expect(places.map(place => [place.slot, place.source, place.text])).toEqual([
      ['start', 'POINT', 'Pavla Ivića 6, Novi Sad'],
      ['waypoints/0', 'GEOGRAPHY', 'Bulevar oslobođenja · Novi Sad'],
      ['end', 'POINT', 'Dositejeva 12, Novi Sad'],
    ]);
    // Both ends confirmed and the stop too: the stale label of the start appears nowhere.
    const all = ownerPlaces({ geography: route, exactAddress: null, points: [...points, pin({ slot: 'waypoints/0', address: '31, Bulevar oslobođenja, Novi Sad, Srbija' })] });
    expect(all.map(place => place.text)).toEqual(['Pavla Ivića 6, Novi Sad', 'Bulevar oslobođenja 31, Novi Sad', 'Dositejeva 12, Novi Sad']);
    expect(all.every(place => place.source === 'POINT')).toBe(true);
    expect(all.map(place => place.text).join(' ')).not.toContain('Lenke');
  });

  it('a point moved to another city is read with its own words, and the old city is not put on it', () => {
    const place = ownerPlace('start', { geography: stationary, exactAddress: null,
      points: [pin({ address: '5, Knez Mihailova, Stari grad, Beograd, Srbija' })] });
    expect(place).toMatchObject({ main: 'Knez Mihailova 5', locality: null, text: 'Knez Mihailova 5' });
  });

  it('the conversation’s confirmed-place entries are made of the same line', () => {
    const [entry] = confirmedPlaceEntries([pin()], { geography: stationary, exactAddress: ADDRESS });
    const place = ownerPlace('start', { geography: stationary, exactAddress: ADDRESS, points: [pin()] })!;
    expect(entry).toMatchObject({ main: place.main, locality: place.locality, exact: true, spoken: `Potvrđeno mesto: ${place.spoken}` });
    const [bare] = confirmedPlaceEntries([pin({ address: undefined })], { geography: stationary, exactAddress: null });
    expect(bare).toMatchObject({ main: 'tačka na mapi', exact: false });
  });

  it('is an owner’s reading and has no place on a task for strangers', () => {
    // The public words of this task never carry a house number or the pin's street, so a screen for strangers cannot get them from here.
    expect(JSON.stringify(stationary)).not.toMatch(/Pavla|\b6\b/);
  });
});

/**
 * A city typed with odd case is SHOWN tidied (owner's phone, 2026-10-07: the Profil header read "NovI SAD", exactly as his profile stores it).
 * Display only; a label that is already well formed comes back untouched.
 */
describe('tidyPlaceLabel', () => {
  it.each([
    ['NovI SAD', 'Novi Sad'], ['NOVI SAD', 'Novi Sad'], ['novi sad', 'Novi Sad'], ['nOVI sAD', 'Novi Sad'], ['Novi SAD', 'Novi Sad'],
    ['ŠID', 'Šid'], ['ĐURĐEVAC', 'Đurđevac'], ['ČAČAK', 'Čačak'], ['ćuprija', 'Ćuprija'], ['ŽABALJ', 'Žabalj'], ['sremska mitrovica', 'Sremska Mitrovica'],
    ['BEOGRAD - ZEMUN', 'Beograd - Zemun'], ['beograd-zemun', 'Beograd-Zemun'], ['SREMSKA–MITROVICA', 'Sremska–Mitrovica'],
    ['PETROVAC NA MLAVI', 'Petrovac na Mlavi'], ['KOVILJ KOD NOVOG SADA', 'Kovilj kod Novog Sada'], ['MZ ŽITNI TRG', 'MZ Žitni Trg'],
    ['ZEMUN POLJE 2', 'Zemun Polje 2'], ['НОВИ САД', 'Нови Сад'], ['нови сад', 'Нови Сад'],
  ])('shows %j as %j', (typed, shown) => {
    expect(tidyPlaceLabel(typed)).toBe(shown);
    // Tidying is stable: what was tidied is well formed and stays as it is.
    expect(tidyPlaceLabel(shown)).toBe(shown);
  });

  it.each(['Novi Sad', 'Sremska Kamenica', 'Beograd - Zemun', 'Bačka Palanka', 'Niš', 'Šid', 'Stari grad', 'Žitni trg', 'MZ Žitni trg', 'Beograd na vodi',
    // Not guessed at: "Novi sad" cannot be told from "Stari grad", so the person's own spelling stands.
    'Novi sad', 'BG', 'NS', 'Zemun Polje 2', '21000', '', '   ', ' - '])('keeps %j byte for byte', label => {
    expect(tidyPlaceLabel(label)).toBe(label);
  });

  it('changes only the case: the separators, the spaces around them and the digits stay exactly as typed', () => {
    expect(tidyPlaceLabel('  NOVI   SAD ,  5. KVART ')).toBe('  Novi   Sad ,  5. Kvart ');
  });
});
