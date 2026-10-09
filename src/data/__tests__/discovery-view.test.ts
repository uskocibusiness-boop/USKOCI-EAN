import { atLeast, dateRange, discoveryConditions, discoveryFiltered, discoveryItems, discoveryShown, discoveryStartSnap, happensBetween, happensIn,
  initialMarketplaceView, marketplaceItems, openPlaces, pinLabel, pinPlaces, placeSuggestions, pointKey, publicArea, publicFeatures, saysWhen,
  saysWorkMode, serbianToday, undatedCount, workMode, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import { FILTER_GROUP, FILTER_WHEN, NEWEST_FIRST, PRICE, QUICK_WHEN, SEARCH_WORDS, WHERE, countLineWords, countWords, datesWords, groupDigits, offMapWords, placesWords,
  searchWords, whenWords } from '../../ui/v2/discovery/discoveryWords';

/**
 * Zadaci as one screen (owner step 4, 2026-09-24): the pure rules under it. The four filter sections read only facts the
 * tasks already carry, a view without them filters exactly as before, the list sheet starts where the rule says, a pin
 * says money only when there is an amount, and tasks rounded to one public point are one reachable place.
 */
const item = (id: string, patch: Partial<MarketplaceItem> & Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`,
  podrucjeTekst: 'Beograd', vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE',
  ponudjenaCena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' }, pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: { lat: 44.81, lng: 20.46 }, taskTimezone: 'Europe/Belgrade', ...patch } as MarketplaceItem);
const ids = (rows: readonly MarketplaceItem[]) => rows.map(row => row.id);
const view = (patch: Partial<MarketplaceView> = {}): MarketplaceView => ({ ...initialMarketplaceView(), ...patch });
// Thursday 24 September 2026, 10:00 in Belgrade (08:00 UTC). The week ends on Sunday the 27th.
const NOW = new Date('2026-09-24T08:00:00Z');
const window = (startsAt: string | null, endsAt: string | null = null) => ({ schedule: { kind: 'FIXED_WINDOW' as const, startsAt, endsAt } });

test('remote discovery ignores restored geographic scope but keeps every shared filter and never invents remote mode', () => {
  const remote = (id: string, patch: Record<string, unknown> = {}) => item(id, { detalji: { rezimLokacije: 'REMOTE' },
    priblizno: null, rezimCene: 'OFFERS', ...window('2026-09-24T14:00:00+02:00'), ...patch } as Partial<MarketplaceItem>);
  const rows = [remote('yes'), remote('tomorrow', window('2026-09-25T14:00:00+02:00')), remote('money', { rezimCene: 'MY_PRICE' }),
    remote('one-person', { pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 } }),
    remote('other-words', { naslov: 'Drugi posao' }), item('unknown', { priblizno: null })];
  const scope = view({ where: 'remote', place: 'Novi Sad', area: [19, 45, 20, 46], pinPlace: '45.25,19.83',
    query: 'Pomoć', when: 'today', price: 'OFFERS', places: 2 });
  expect(ids(discoveryItems(rows, scope, undefined, NOW))).toEqual(['yes']);
  // the pill does not claim a place the list ignores: under the work done remotely only the words are searched
  expect(searchWords(scope)).toBe('„Pomoć“');
  expect(scope.area).toEqual([19, 45, 20, 46]); // normalized view never mutates the remembered input
});

test('1000 local fixture tasks preserve area counts and remote independence when repeatedly zooming between Novi Sad and Serbia', () => {
  const group = (prefix: string, count: number, patch: Partial<MarketplaceItem>) =>
    Array.from({ length: count }, (_, index) => item(`${prefix}-${index}`, patch));
  const noviSad = group('ns', 300, { priblizno: { lat: 45.25, lng: 19.83 }, detalji: { rezimLokacije: 'STATIONARY' } as MarketplaceItem['detalji'] });
  const belgrade = group('bg', 350, { priblizno: { lat: 44.81, lng: 20.46 }, detalji: { rezimLokacije: 'STATIONARY' } as MarketplaceItem['detalji'] });
  const outside = group('outside', 100, { priblizno: { lat: 48.2, lng: 16.37 }, detalji: { rezimLokacije: 'STATIONARY' } as MarketplaceItem['detalji'] });
  const remote = group('remote', 200, { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] });
  const unknown = group('unknown', 50, { priblizno: null });
  const rows = [...noviSad, ...belgrade, ...outside, ...remote, ...unknown];
  expect(rows).toHaveLength(1000);
  const regions = [[19.7, 45.1, 20, 45.4], [18.8, 42.2, 23, 46.2]] as const;
  for (let pass = 0; pass < 3; pass += 1) {
    for (const [index, bounds] of regions.entries()) {
      const area = [...bounds] as [number, number, number, number];
      const shown = discoveryShown(rows, view({ area }), undefined, NOW);
      const local = index === 0 ? noviSad : [...noviSad, ...belgrade];
      expect(ids(shown.inArea)).toEqual(ids(local));
      expect(ids(shown.withoutPoint)).toEqual(ids([...remote, ...unknown]));
      expect(shown.listed).toHaveLength(local.length + 250);
      expect(new Set(ids(shown.listed)).size).toBe(shown.listed.length);
      expect(shown.inArea.some(task => task.id.startsWith('remote') || task.id.startsWith('unknown'))).toBe(false);
      const remoteShown = discoveryShown(rows, view({ where: 'remote', area, place: 'Novi Sad', pinPlace: '45.25,19.83', query: 'Pomoć' }), undefined, NOW);
      expect(ids(remoteShown.listed)).toEqual(ids(remote));
      expect(remoteShown.listed).toHaveLength(200);
      expect(publicFeatures(remoteShown.listed).features).toHaveLength(0);
    }
  }
  expect(discoveryItems(rows, view({ where: 'remote', query: 'Pomoć remote-199' }), undefined, NOW)).toEqual([remote[199]]);
});

test('40000 synthetic tasks across eight Serbian cities keep dense public points reachable and remote filters independent', () => {
  // Pure client/gallery proof. This does not exercise the server reader, concurrent users or native FPS.
  const cities = [
    ['Beograd',44.81,20.46],['Novi Sad',45.25,19.83],['Niš',43.32,21.90],['Kragujevac',44.01,20.91],
    ['Subotica',46.10,19.66],['Čačak',43.89,20.35],['Zrenjanin',45.38,20.39],['Novi Pazar',43.14,20.52],
  ] as const;
  const local = cities.flatMap(([city,lat,lng],cityIndex)=>Array.from({length:4000},(_,index)=>item(`city-${cityIndex}-${index}`,{
    podrucjeTekst:city,priblizno:{lat:lat+(index%40)*0.001,lng:lng+(index%40)*0.001},
    detalji:{rezimLokacije:'STATIONARY'} as MarketplaceItem['detalji'],
  })));
  const remote=Array.from({length:4000},(_,index)=>item(`remote-${index}`,{priblizno:null,detalji:{rezimLokacije:'REMOTE'} as MarketplaceItem['detalji']}));
  const unmapped=Array.from({length:4000},(_,index)=>item(`unmapped-${index}`,{priblizno:null}));
  const rows=[...local,...remote,...unmapped];expect(rows).toHaveLength(40000);
  for(const [cityIndex,[,lat,lng]] of cities.entries()){
    const area:[number,number,number,number]=[lng-0.08,lat-0.08,lng+0.08,lat+0.08];
    const shown=discoveryShown(rows,view({area}),undefined,NOW);
    expect(shown.inArea).toHaveLength(4000);expect(shown.inArea.every(row=>row.id.startsWith(`city-${cityIndex}-`))).toBe(true);
    expect(shown.withoutPoint).toHaveLength(8000);expect(shown.listed).toHaveLength(12000);
    const places=[...pinPlaces(shown.inArea).values()];
    expect(places.length).toBeLessThan(10);expect(places.some(place=>place.ids.length>500)).toBe(true);
    const reachable=places.flatMap(place=>place.ids);
    expect(new Set(reachable).size).toBe(4000);expect(reachable.length).toBe(4000);
    const offMap=discoveryShown(rows,view({where:'remote',area,place:cities[cityIndex][0]}),undefined,NOW);
    expect(offMap.listed).toHaveLength(4000);expect(publicFeatures(offMap.listed).features).toHaveLength(0);
  }
},30000);

describe('Kada, read in the task\'s own zone', () => {
  const today = item('today', window('2026-09-24T14:00:00+02:00', '2026-09-24T16:00:00+02:00'));
  const tomorrow = item('tomorrow', window('2026-09-25T09:00:00+02:00', '2026-09-25T11:00:00+02:00'));
  const sunday = item('sunday', window('2026-09-27T09:00:00+02:00'));
  const nextWeek = item('next-week', window('2026-09-29T09:00:00+02:00'));
  const past = item('past', window('2026-09-20T09:00:00+02:00', '2026-09-20T12:00:00+02:00'));
  // 23:30 UTC on the 24th is already 01:30 on the 25th in Belgrade: tomorrow there, whatever the phone's zone.
  const lateUtc = item('late-utc', window('2026-09-24T23:30:00Z'));
  // A window that runs into the day and ends exactly at midnight belongs to the day before it.
  const toMidnight = item('to-midnight', window('2026-09-24T20:00:00+02:00', '2026-09-25T00:00:00+02:00'));
  const running = item('running', window('2026-09-23T09:00:00+02:00', '2026-09-26T18:00:00+02:00'));
  const rows = [today, tomorrow, sunday, nextWeek, past, lateUtc, toMidnight, running];
  it('Danas, Sutra and Ove nedelje take the days a window touches', () => {
    expect(ids(marketplaceItems(rows, view({ when: 'today' }), false, NOW))).toEqual(['today', 'to-midnight', 'running']);
    expect(ids(marketplaceItems(rows, view({ when: 'tomorrow' }), false, NOW))).toEqual(['tomorrow', 'late-utc', 'running']);
    expect(ids(marketplaceItems(rows, view({ when: 'week' }), false, NOW))).toEqual(['today', 'tomorrow', 'sunday', 'late-utc', 'to-midnight', 'running']);
    expect(ids(marketplaceItems(rows, view({ when: 'any' }), false, NOW))).toEqual(ids(rows));
  });
  it('flexible words without dates mean what the card says; any-time work fits any day; an unknown or incomplete schedule fits no day', () => {
    const flexible = (id: string, kind: 'TODAY_FLEXIBLE' | 'TOMORROW_FLEXIBLE' | 'WEEK_FLEXIBLE' | 'FLEXIBLE' | 'REMOTE_ANYTIME') =>
      item(id, { schedule: { kind, startsAt: null, endsAt: null } });
    const rows2 = [flexible('danas', 'TODAY_FLEXIBLE'), flexible('sutra', 'TOMORROW_FLEXIBLE'), flexible('nedelja', 'WEEK_FLEXIBLE'),
      flexible('bilo-kad', 'FLEXIBLE'), flexible('daljina', 'REMOTE_ANYTIME'), item('bez-rasporeda'), item('nepotpun', window(null, '2026-09-24T12:00:00+02:00'))];
    expect(ids(marketplaceItems(rows2, view({ when: 'today' }), false, NOW))).toEqual(['danas', 'nedelja', 'bilo-kad', 'daljina']);
    expect(ids(marketplaceItems(rows2, view({ when: 'tomorrow' }), false, NOW))).toEqual(['sutra', 'nedelja', 'bilo-kad', 'daljina']);
    // A flexible range is read by its dates when it has them.
    const range = item('range', { schedule: { kind: 'FLEXIBLE', startsAt: '2026-09-28T00:00:00+02:00', endsAt: '2026-10-02T00:00:00+02:00' } });
    expect(happensIn(range, 'week', NOW)).toBe(false);
    expect(happensIn(range, 'any', NOW)).toBe(true);
  });
  // Review of V47: a flexible range that names only its start is open from that day on, as its card says ("Od 26. sep");
  // it was read as that one day. A fixed window that names only its start is still that one day.
  it('a flexible range with only a start is open-ended; a fixed window with only a start is its one day', () => {
    const from26 = item('od-26', { schedule: { kind: 'FLEXIBLE', startsAt: '2026-09-26T09:00:00+02:00', endsAt: null } });
    expect(happensBetween(from26, { from: '2026-09-28', to: '2026-09-30' }, NOW)).toBe(true);
    expect(happensIn(from26, 'next7', new Date('2026-09-27T08:00:00Z'))).toBe(true);
    expect(happensBetween(from26, { from: '2026-09-24', to: '2026-09-25' }, NOW)).toBe(false);
    const fixed26 = item('tacno-26', window('2026-09-26T09:00:00+02:00'));
    expect(happensBetween(fixed26, { from: '2026-09-28', to: '2026-09-30' }, NOW)).toBe(false);
    expect(happensBetween(fixed26, { from: '2026-09-26', to: '2026-09-26' }, NOW)).toBe(true);
  });
  it('an unreadable zone or instant never matches a day and never throws', () => {
    expect(happensIn(item('zone', { ...window('2026-09-24T14:00:00+02:00'), taskTimezone: 'Nije/Zona' }), 'today', NOW)).toBe(false);
    expect(happensIn(item('instant', window('24. 9. 2026')), 'today', NOW)).toBe(false);
  });
});

describe('Gde se radi, Slobodna mesta, Cena', () => {
  const remote = item('remote', { detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] });
  const onsite = item('onsite', { detalji: { rezimLokacije: 'STATIONARY' } as MarketplaceItem['detalji'] });
  const unsaid = item('unsaid');
  it('reads the work mode only from the task, and a task that does not say is in neither set', () => {
    expect([workMode(remote), workMode(onsite), workMode(unsaid)]).toEqual(['remote', 'onsite', null]);
    expect(ids(marketplaceItems([remote, onsite, unsaid], view({ where: 'remote' }), false, NOW))).toEqual(['remote']);
    expect(ids(marketplaceItems([remote, onsite, unsaid], view({ where: 'onsite' }), false, NOW))).toEqual(['onsite']);
    expect(saysWorkMode([unsaid])).toBe(false); expect(saysWorkMode([unsaid, remote])).toBe(true);
  });
  // Discovery V47: "Koliko vas dolazi" is a count of people, at least n open places; the old "2 ili više" is n = 2.
  it('"Koliko vas dolazi" keeps tasks with at least that many open places; 1 is every open task', () => {
    const rows = [item('one', { pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 0.66 } }), item('two'), item('five', { pokrivenost: { ukupno: 5, popunjeno: 0, preostalo: 5, udeo: 0 } })];
    expect(ids(marketplaceItems(rows, view({ places: 2 }), false, NOW))).toEqual(['two', 'five']);
    expect(ids(marketplaceItems(rows, view({ places: 3 }), false, NOW))).toEqual(['five']);
    expect(ids(marketplaceItems(rows, view({ places: 1 }), false, NOW))).toEqual(['one', 'two', 'five']);
    // Anything that is not a whole count from 1 is every open task, and the count never passes its ceiling.
    for (const odd of [0, -2, 1.5, Number.NaN, '2', undefined]) expect(atLeast(odd)).toBe(1);
    expect(atLeast(99)).toBe(10);
  });
  // Review of V47: a read without the slot counts leaves the open places unknown (the mapping writes NaN), and unknown is
  // neither "full" nor "room for n". The choice made and pinned here: such a task is KEPT under "N+ mesta" (never hidden
  // silently), and it never counts as having room (the chip is offered on known counts only, through `openPlaces`).
  it('a task whose open places are unknown is kept under "Koliko vas dolazi" and never counted as having room', () => {
    const unknown = item('unknown', { pokrivenost: { ukupno: Number.NaN, popunjeno: 0, preostalo: Number.NaN, udeo: 0 } });
    const absent = item('absent', { pokrivenost: undefined as never });
    const full = item('full', { pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    expect(ids(marketplaceItems([unknown, absent, full, item('two')], view({ places: 2 }), false, NOW))).toEqual(['unknown', 'absent', 'two']);
    expect([openPlaces(unknown), openPlaces(absent), openPlaces(full), openPlaces(item('two'))]).toEqual([null, null, 1, 2]);
  });
  it('the price filter is the existing one, and the filters combine', () => {
    const rows = [item('price'), item('offers', { rezimCene: 'OFFERS', ponudjenaCena: undefined, detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] })];
    expect(ids(marketplaceItems(rows, view({ price: 'OFFERS' }), false, NOW))).toEqual(['offers']);
    expect(ids(marketplaceItems(rows, view({ price: 'OFFERS', where: 'onsite' }), false, NOW))).toEqual([]);
    expect(discoveryFiltered(view())).toBe(false);
    for (const patch of [{ price: 'MY_PRICE' as const }, { when: 'week' as const }, { where: 'remote' as const }, { places: 2 }, { dates: { from: '2026-09-25', to: '2026-09-26' } }])
      expect(discoveryFiltered(view(patch))).toBe(true);
    // "Uslovi pretrage" counts the conditions that are on; a place, searched words and the map's area are "Gde", not conditions.
    expect(discoveryConditions(view({ when: 'today', where: 'remote', places: 3, price: 'OFFERS' }))).toBe(4);
    expect(discoveryConditions(view({ dates: { from: '2026-09-25', to: '2026-09-26' }, when: 'any' }))).toBe(1);
    expect(discoveryConditions(view({ place: 'Novi Sad', query: 'selidba', area: [19, 45, 20, 46] }))).toBe(0);
  });
  it('defaults change nothing: a view written before the filters existed filters exactly as the new defaults do', () => {
    const rows = [item('a', window('2020-01-01T00:00:00Z')), item('b', { pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 } }), item('c', { detalji: null as never })];
    const old = { query: '', section: 'active', attention: false, price: 'all', mode: 'list', area: null, viewport: null, selectedId: null } as MarketplaceView;
    expect(ids(marketplaceItems(rows, old, false))).toEqual(['a', 'b', 'c']);
    expect(ids(marketplaceItems(rows, initialMarketplaceView(), false))).toEqual(['a', 'b', 'c']);
  });
});

describe('the Zadaci list and its sheet', () => {
  it('separates map, remote and unlocated work even without an area, preserving the filtered set and each group order', () => {
    const remote = (id: string) => item(id, { detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] });
    const rows = [item('unknown1', { priblizno: null }), remote('remote1'), item('map1'),
      item('unknown2', { priblizno: null }), item('map2'), remote('remote2')];
    const shown = discoveryShown(rows, view(), undefined, NOW);
    expect(shown.mapped).toEqual(rows);
    expect(ids(shown.inArea)).toEqual(['map1', 'map2']);
    expect(ids(shown.withoutPoint)).toEqual(['remote1', 'remote2', 'unknown1', 'unknown2']);
    expect(ids(shown.listed)).toEqual(['map1', 'map2', 'remote1', 'remote2', 'unknown1', 'unknown2']);
    expect(new Set(ids(shown.listed))).toEqual(new Set(ids(rows)));
    expect(publicFeatures(shown.mapped).features.map(feature => feature.id)).toEqual(['map1', 'map2']);
  });
  // A chosen public point stays narrow geographically; point-free work follows separately.
  it('one public point lists its tasks first and keeps point-free work available, whatever the area', () => {
    const rows = [item('s1', { priblizno: { lat: 44.7904, lng: 20.4498 } }), item('s2', { priblizno: { lat: 44.79, lng: 20.45 } }),
      item('near', { priblizno: { lat: 44.8, lng: 20.45 } }), item('online', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] }),
      item('nowhere', { priblizno: null }), item('mine', { priblizno: { lat: 44.79, lng: 20.45 } })];
    const shown = discoveryShown(rows, view({ pinPlace: '44.79,20.45', area: [0, 0, 1, 1] }), new Set(['mine']), NOW);
    expect(ids(shown.listed)).toEqual(['s1', 's2', 'mine', 'online', 'nowhere']); expect(ids(shown.inArea)).toEqual(['s1', 's2', 'mine']); expect(ids(shown.withoutPoint)).toEqual(['online', 'nowhere']);
    expect(ids(shown.mapped)).toEqual(['s1', 's2', 'near', 'online', 'nowhere', 'mine']);
    expect(ids(discoveryItems(rows, view({ pinPlace: '44.79,20.45' }), new Set(['mine']), NOW))).toEqual(['s1', 's2', 'mine', 'online', 'nowhere']);
    // The "Gde" places are counted as if no point were chosen (the remote task names no place; the one placed nowhere does).
    expect(placeSuggestions(rows, view({ pinPlace: '44.79,20.45' }), new Set(['mine']), NOW)).toEqual([{ text: 'Beograd', count: 5 }]);
    expect(initialMarketplaceView().pinPlace).toBeNull();
  });
  it('ownership never changes visible membership: own tasks remain searchable before and after label recovery', () => {
    const rows = [item('mine'), item('other'), item('applied')];
    expect(ids(discoveryItems(rows, view(), new Set(['mine']), NOW))).toEqual(['mine', 'other', 'applied']);
    expect(ids(discoveryItems(rows, view(), undefined, NOW))).toEqual(['mine', 'other', 'applied']);
    expect(ids(discoveryItems(rows, view({ query: 'mine' }), new Set(['mine']), NOW))).toEqual(['mine']);
  });
  it.each([
    [6, 4, 'half'], [6, 3, 'half'], [6, 2, 'peek'], [6, 0, 'peek'], [4, 1, 'peek'],
    [3, 0, 'half'], [1, 0, 'half'], [0, 0, 'half'],
    // Nothing on the map at all: the list takes the screen.
    [5, 5, 'full'], [1, 1, 'full'],
  ] as const)('%i shown, %i without a pin → %s', (shown, withoutPin, snap) => {
    expect(discoveryStartSnap(shown, withoutPin)).toBe(snap);
  });
});

describe('what a pin says', () => {
  // Review r3 item 1 (2026-09-24): this pinned a long RSD amount shortened to its bare number ("120.000"), which broke
  // the `Novac` contract (never a number without its currency). Every amount now keeps its currency, whatever its length.
  it('an amount is money, exactly as the read formatted it, and never loses its currency however long it is', () => {
    expect(pinLabel(item('a'))).toEqual({ text: '6.000 RSD', tone: 'money', spoken: '6.000 RSD' });
    expect(pinLabel(item('b', { ponudjenaCena: { iznos: 120000, valuta: 'RSD', prikaz: '120.000 RSD' } }))).toEqual({ text: '120.000 RSD', tone: 'money', spoken: '120.000 RSD' });
    // Another currency is never relabelled as a bare number either.
    expect(pinLabel(item('c', { ponudjenaCena: { iznos: 1200000, valuta: 'EUR', prikaz: '1.200.000 EUR' } })).text).toBe('1.200.000 EUR');
  });
  it('a task that asks for offers says so quietly and never wears the money tone, even with a stale amount on it', () => {
    const offers = pinLabel(item('o', { rezimCene: 'OFFERS' }));
    expect(offers).toEqual({ text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' });
    expect(offers.tone).not.toBe('money');
  });
  it('no price is no words on the pin and an honest sentence to a screen reader; never an invented amount', () => {
    for (const patch of [{ ponudjenaCena: undefined }, { ponudjenaCena: { iznos: 0, valuta: 'RSD', prikaz: '' } }, { rezimCene: undefined, ponudjenaCena: undefined }])
      expect(pinLabel(item('n', patch))).toEqual({ text: '', tone: 'none', spoken: 'Cena nije navedena' });
  });
});

describe('tasks on one public point', () => {
  it('group by the rounded point the map draws, in the list order; a remote or pinless task is in no place', () => {
    const rows = [item('a', { priblizno: { lat: 44.8144, lng: 20.4621 } }), item('b', { priblizno: { lat: 44.8103, lng: 20.4588 } }),
      item('c', { priblizno: { lat: 44.83, lng: 20.41 } }), item('d', { priblizno: null }), item('e', { detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'] })];
    const places = pinPlaces(rows);
    expect([...places.values()]).toEqual([
      { key: '44.81,20.46', point: { lat: 44.81, lng: 20.46 }, ids: ['a', 'b'] },
      { key: '44.83,20.41', point: { lat: 44.83, lng: 20.41 }, ids: ['c'] },
    ]);
    expect(pointKey({ lat: 0, lng: 0 })).toBe('0.00,0.00');
    // The native source is unchanged by the grouping: one feature per task, IDs and rounded points only.
    expect(publicFeatures(rows).features.map(feature => feature.properties)).toEqual([{ needId: 'a' }, { needId: 'b' }, { needId: 'c' }]);
  });
});

/**
 * Discovery V47: the search panel's choices, as pure rules. Kada has two more flexible words and a range of dates; "Gde"
 * offers only the areas the loaded tasks name; a time choice never hides a task without a date silently.
 */
describe('Discovery V47: Kada', () => {
  const flexible = (id: string, kind: 'TODAY_FLEXIBLE' | 'TOMORROW_FLEXIBLE' | 'WEEK_FLEXIBLE' | 'FLEXIBLE') => item(id, { schedule: { kind, startsAt: null, endsAt: null } });
  const on = (id: string, day: string) => item(id, window(`${day}T10:00:00+02:00`, `${day}T12:00:00+02:00`));
  const days = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-30', '2026-10-01'];
  const rows = days.map(day => on(day, day));
  it('"Ovaj vikend" is the coming Saturday and Sunday; on a weekend day, what is left of it', () => {
    expect(ids(marketplaceItems(rows, view({ when: 'weekend' }), false, NOW))).toEqual(['2026-09-26', '2026-09-27']);
    const saturday = new Date('2026-09-26T08:00:00Z'), sunday = new Date('2026-09-27T08:00:00Z');
    expect(ids(marketplaceItems(rows, view({ when: 'weekend' }), false, saturday))).toEqual(['2026-09-26', '2026-09-27']);
    expect(ids(marketplaceItems(rows, view({ when: 'weekend' }), false, sunday))).toEqual(['2026-09-27']);
  });
  it('"Narednih 7 dana" is today and the six days after it', () => {
    expect(ids(marketplaceItems(rows, view({ when: 'next7' }), false, NOW))).toEqual(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-30']);
  });
  it('a range of dates keeps the tasks whose work days touch it; a flexible task is read by what its words mean', () => {
    const range = { from: '2026-09-26', to: '2026-09-28' };
    expect(ids(marketplaceItems(rows, view({ dates: range }), false, NOW))).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
    // A range wins over a stale flexible word: the two are one choice.
    expect(ids(marketplaceItems(rows, view({ dates: range, when: 'today' }), false, NOW))).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
    const week = flexible('ove-nedelje', 'WEEK_FLEXIBLE'), anytime = flexible('bilo-kad', 'FLEXIBLE'), today = flexible('danas', 'TODAY_FLEXIBLE');
    expect(happensBetween(week, range, NOW)).toBe(true);
    expect(happensBetween(anytime, range, NOW)).toBe(true);
    expect(happensBetween(today, range, NOW)).toBe(false);
    // A task whose schedule names no day matches no range.
    expect(happensBetween(item('bez-rasporeda'), range, NOW)).toBe(false);
  });
  it('only a real range of real days is read; anything else is no range at all', () => {
    expect(dateRange({ from: '2026-09-26', to: '2026-09-28' })).toEqual({ from: '2026-09-26', to: '2026-09-28' });
    for (const odd of [{ from: '2026-09-28', to: '2026-09-26' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '26.9.', to: '28.9.' }, null, 'x'])
      expect(dateRange(odd)).toBeNull();
    expect(ids(marketplaceItems(rows, view({ dates: { from: '2026-09-28', to: '2026-09-26' } }), false, NOW))).toEqual(ids(rows));
  });
  it('a time choice says how many tasks it leaves out only because they name no day; with no time choice it says nothing', () => {
    const list = [...rows, item('bez-rasporeda'), item('nepotpun', window(null, '2026-09-24T12:00:00+02:00')), item('moj-bez-rasporeda')];
    expect(undatedCount(list, view(), undefined, NOW)).toBe(0);
    expect(undatedCount(list, view({ when: 'weekend' }), new Set(['moj-bez-rasporeda']), NOW)).toBe(3);
    expect(undatedCount(list, view({ dates: { from: '2026-09-26', to: '2026-09-26' } }), undefined, NOW)).toBe(3);
    // It counts only what the other filters leave: a search that finds none of them leaves none out.
    expect(undatedCount(list, view({ when: 'weekend', query: 'Pomoć 2026' }), undefined, NOW)).toBe(0);
    expect(saysWhen([item('bez-rasporeda')], NOW)).toBe(false); expect(saysWhen(list, NOW)).toBe(true);
  });
  it('today in Serbian time is the day the grid starts from, whatever the phone\'s zone', () => {
    expect(serbianToday(new Date('2026-09-24T21:30:00Z'))).toBe('2026-09-24');
    expect(serbianToday(new Date('2026-09-24T22:30:00Z'))).toBe('2026-09-25');
  });
});

describe('Discovery V47: Gde', () => {
  const at = (id: string, podrucjeTekst: string, patch: Record<string, unknown> = {}) => item(id, { podrucjeTekst, ...patch });
  const rows = [at('a', 'Liman, Novi Sad'), at('b', 'Liman,  Novi Sad'), at('c', 'Vračar, Beograd', { rezimCene: 'OFFERS', ponudjenaCena: undefined }),
    at('d', 'Na daljinu', { detalji: { rezimLokacije: 'REMOTE' } as MarketplaceItem['detalji'], priblizno: null }),
    at('e', 'Lokacija nije navedena', { priblizno: null }), at('mine', 'Zemun, Beograd')];
  it('a place is the public area a task names: never a remote task\'s words or the words for no area', () => {
    expect(rows.map(publicArea)).toEqual(['Liman, Novi Sad', 'Liman, Novi Sad', 'Vračar, Beograd', null, null, 'Zemun, Beograd']);
    // "Na daljinu" is never a place, even on a task whose mode does not say it is remote.
    expect(publicArea(item('reci', { podrucjeTekst: 'Na daljinu', detalji: undefined }))).toBeNull();
    expect(publicArea(item('reci-2', { podrucjeTekst: '  na  daljinu ' }))).toBeNull();
  });
  it('the suggestions include own tasks with the same counts under the other conditions', () => {
    expect(placeSuggestions(rows, view(), new Set(['mine']), NOW)).toEqual([{ text: 'Liman, Novi Sad', count: 2 }, { text: 'Vračar, Beograd', count: 1 }, { text: 'Zemun, Beograd', count: 1 }]);
    // Counted under the other conditions: a price choice leaves one place; the searched words and the map's area do not count.
    expect(placeSuggestions(rows, view({ price: 'OFFERS', query: 'nema', area: [0, 0, 1, 1] }), new Set(['mine']), NOW))
      .toEqual([{ text: 'Vračar, Beograd', count: 1 }]);
  });
  it('choosing a place keeps the tasks that name it, however the spacing or the case', () => {
    expect(ids(marketplaceItems(rows, view({ place: 'liman, novi sad' }), false, NOW))).toEqual(['a', 'b']);
    expect(ids(marketplaceItems(rows, view({ place: 'Nigde' }), false, NOW))).toEqual([]);
    expect(ids(marketplaceItems(rows, view({ place: null }), false, NOW))).toEqual(ids(rows));
  });
});

describe('Discovery V47: the words of the search', () => {
  it('the pill says only what is searched, the words first and then the place, or nothing', () => {
    // The pill (the owner's phone of 8 Oct 2026) is the SEARCH: it never says "Svi zadaci" or a condition, and says nothing while nothing is searched.
    expect(searchWords(view())).toBeNull();
    expect(searchWords(view({ where: 'remote', price: 'OFFERS', when: 'weekend', places: 2 }))).toBeNull();
    expect(searchWords(view({ area: [19, 45, 20, 46] }))).toBe('Ova oblast');
    expect(searchWords(view({ query: ' farbanje ' }))).toBe('„farbanje“');
    // in the order of the pill's own "Šta tražiš · Gde" (the approved plan, U1)
    expect(searchWords(view({ place: 'Liman, Novi Sad', query: 'selidba', area: [19, 45, 20, 46] }))).toBe('„selidba“ · Liman, Novi Sad');
    expect(searchWords(view({ pinPlace: '44.79,20.45', query: 'selidba' }))).toBe('„selidba“ · Na ovom mestu');
    expect(placesWords(1)).toBe('Bilo koliko'); expect(placesWords(2)).toBe('Za 2 i više'); expect(placesWords(4)).toBe('Za 4 i više');
    // One point of the map (a place's whole set) is said as such, before the area.
    expect(searchWords(view({ pinPlace: '44.79,20.45', area: [19, 45, 20, 46] }))).toBe('Na ovom mestu');
    // The work done remotely has no place: a place, an area or a point left over from before it is not claimed, the words are.
    expect(searchWords(view({ where: 'remote', place: 'Novi Sad', area: [19, 45, 20, 46], pinPlace: '44.79,20.45' }))).toBeNull();
    expect(searchWords(view({ where: 'remote', place: 'Novi Sad', query: 'selidba' }))).toBe('„selidba“');
  });
  // Review of V47: the words are the app's own, and one reset and one "remove" are said the same way everywhere. The approved plan of 8 Oct 2026 (U1, U5): "Svejedno" is the
  // "everything" choice of a set, an amount is "Sa iznosom" or "Tražim ponude", and the days of the filters are three.
  it('the work-mode, price and day words are the app\'s own, and a condition is removed by name', () => {
    expect(WHERE.map(([, words]) => words)).toEqual(['Svejedno', 'Na licu mesta', 'Na daljinu']);
    expect(PRICE.map(([, words]) => words)).toEqual(['Svejedno', 'Sa iznosom', 'Tražim ponude']);
    expect(FILTER_WHEN.map(([, words]) => words)).toEqual(['Danas', 'Sutra', 'Ovaj vikend']);
    expect(QUICK_WHEN).toEqual(['today', 'weekend']);
    expect(FILTER_GROUP).toEqual({ when: 'Kada', where: 'Gde', amount: 'Iznos' });
    expect(SEARCH_WORDS.what).toBe('Grad ili zadatak'); expect(SEARCH_WORDS.recent).toBe('Skorašnje pretrage');
  });
  // The row under the list's count (the owner's phone of 8 Oct 2026, "lak pristup zadacima koji nisu na mapi"): the number leads, in the right Serbian plural.
  it.each([[1, '1 nije na mapi'], [2, '2 nisu na mapi'], [4, '4 nisu na mapi'], [5, '5 nisu na mapi'], [11, '11 nisu na mapi'], [21, '21 nije na mapi'], [22, '22 nisu na mapi']])(
    '%i not on the map: "%s"', (count, words) => { expect(offMapWords(count)).toBe(words); });
  it('the top line is never blank and counts in one format, every count through the plural', () => {
    const ready = { status: 'ready' as const, listed: 0, inArea: 0, withoutPoint: 0, pinless: 0, area: false, pinPlace: false };
    expect(countLineWords({ ...ready, status: 'loading' })).toEqual({ words: 'Učitavamo zadatke…', extra: '' });
    expect(countLineWords({ ...ready, status: 'error' })).toEqual({ words: 'Zadaci nisu učitani', extra: '' });
    expect(countLineWords(ready)).toEqual({ words: 'Nema zadataka', extra: '' });
    expect(countLineWords({ ...ready, listed: 12, pinless: 3 })).toEqual({ words: '12 zadataka', extra: ' · 3 zadatka bez tačke na mapi' });
    expect(countLineWords({ ...ready, listed: 21, pinless: 0 })).toEqual({ words: '21 zadatak', extra: '' });
    expect(countLineWords({ ...ready, area: true, listed: 4, inArea: 2, withoutPoint: 2 }))
      .toEqual({ words: '2 zadatka u oblasti', extra: ' · 2 zadatka bez tačke na mapi' });
    expect(countLineWords({ ...ready, area: true, listed: 1, inArea: 0, withoutPoint: 1 })).toEqual({ words: 'U oblasti nema zadataka', extra: ' · 1 zadatak bez tačke na mapi' });
    expect(countLineWords({ ...ready, area: true })).toEqual({ words: 'U oblasti nema zadataka', extra: '' });
    expect(countLineWords({ ...ready, pinPlace: true, area: true, listed: 4, inArea: 4 })).toEqual({ words: '4 zadatka na ovom mestu', extra: '' });
    expect(countLineWords({ ...ready, pinPlace: true, listed: 5, inArea: 4, withoutPoint: 1 })).toEqual({ words: '4 zadatka na ovom mestu', extra: ' · 1 zadatak bez tačke na mapi' });
    expect(countLineWords({ ...ready, pinPlace: true })).toEqual({ words: 'Na ovom mestu nema zadataka', extra: '' });
  });
  it('a count of many tasks sets its thousands apart by a dot, as the app writes money, and the plural follows the number', () => {
    expect([0, 7, 999, 1000, 1248, 21000, 1000000].map(groupDigits)).toEqual(['0', '7', '999', '1.000', '1.248', '21.000', '1.000.000']);
    expect([1, 2, 5, 11, 21, 999, 1001, 1248, 2000, 1111].map(countWords)).toEqual(
      ['1 zadatak', '2 zadatka', '5 zadataka', '11 zadataka', '21 zadatak', '999 zadataka', '1.001 zadatak', '1.248 zadataka', '2.000 zadataka', '1.111 zadataka']);
    const ready = { status: 'ready' as const, listed: 1248, inArea: 0, withoutPoint: 0, pinless: 0, area: false, pinPlace: false };
    expect(countLineWords(ready)).toEqual({ words: '1.248 zadataka', extra: '' });
    expect(countLineWords({ ...ready, pinless: 1003 })).toEqual({ words: '1.248 zadataka', extra: ' · 1.003 zadatka bez tačke na mapi' });
    expect(countLineWords({ ...ready, area: true, inArea: 1100, withoutPoint: 148 })).toEqual({ words: '1.100 zadataka u oblasti', extra: ' · 148 zadataka bez tačke na mapi' });
  });
  it('says how the list is ordered in one word', () => {
    expect(NEWEST_FIRST).toBe('Najnovije prvo');
  });
  it('a range of days is written once, the month once when it can be', () => {
    expect(datesWords({ from: '2026-09-26', to: '2026-09-26' }, NOW)).toBe('26. sep');
    expect(datesWords({ from: '2026-09-26', to: '2026-09-28' }, NOW)).toBe('26–28. sep');
    expect(datesWords({ from: '2026-09-30', to: '2026-10-02' }, NOW)).toBe('30. sep – 2. okt');
    expect(whenWords({ when: 'any', dates: { from: '2026-09-26', to: '2026-09-28' } }, NOW)).toBe('26–28. sep');
    expect(whenWords({ when: 'next7', dates: null }, NOW)).toBe('Narednih 7 dana');
  });
});
