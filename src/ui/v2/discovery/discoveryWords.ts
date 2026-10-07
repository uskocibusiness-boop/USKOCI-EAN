import { atLeast, dateRange, type DateRange, type MarketplaceView, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { civilDay, weekLabel } from '../../calendar/calendarPresentation';
import { plural, zadataka } from '../../system/plural';

/**
 * The words of the Zadaci search (Discovery V47), in one place: the search pill, the quick chips, the steps of the search
 * panel and the chips under the list's count all say a choice the same way. Every set starts with its "everything"
 * choice, so the default always sits in the same place. The work-mode and price words are the ones the app already says
 * (review of V47): "Na daljinu" as a task itself says it, "Navedena cena" as the Moji zadaci price filter says it, "Bilo gde" /
 * "Na licu mesta" as the Zadaci filter sheet before V47 said them; never new names.
 *
 * One reader, one voice (UX plan 2.13, 2.17; the visual proposal 2026-10-07): the person who looks for work reads the WORKER's
 * words. A task that waits for offers is "Prima ponude" here (the requester's own screens say "Tražim ponude": that is his voice),
 * and "at least two places" is "Za 2 i više".
 */
export const WHEN: readonly (readonly [WhenFilter, string])[] = [['any', 'Bilo kada'], ['today', 'Danas'], ['tomorrow', 'Sutra'],
  ['week', 'Ove nedelje'], ['weekend', 'Ovaj vikend'], ['next7', 'Narednih 7 dana']];
/** The time choices a quick chip over the map toggles; the rest are in the panel's Kada step. */
export const QUICK_WHEN: readonly WhenFilter[] = ['today', 'tomorrow', 'week'];
export const WHERE: readonly (readonly [WhereFilter, string])[] = [['any', 'Bilo gde'], ['onsite', 'Na licu mesta'], ['remote', 'Na daljinu']];
export const PRICE: readonly (readonly [MarketplaceView['price'], string])[] = [['all', 'Sve'], ['MY_PRICE', 'Navedena cena'], ['OFFERS', 'Prima ponude']];
/** The one reset of the search, on the panel and on the empty list alike. */
export const CLEAR_ALL = 'Obriši uslove';
/**
 * The sections of the search panel, in the order the person is walked through them (UX plan 2.19: Gde, Kada, Šta, Cena,
 * Broj ljudi, Način rada), and the one word each is called by. A person is spoken to as "ti": there is no "vas" here.
 */
export const SECTION_LABEL = { gde: 'Gde', kada: 'Kada', sta: 'Šta', cena: 'Cena', koliko: 'Broj ljudi', kako: 'Način rada' } as const;
/** What the "Šta" row says while no word is typed. */
export const ANY_WHAT = 'Bilo šta';
/** What removes one condition that is on (a chip under the count). */
export const removeWords = (label: string) => `Ukloni uslov: ${label}`;
/** Where the list is narrowed to one public point (a place's "Prikaži sve u listi"). */
export const PIN_PLACE = 'Na ovom mestu';

/** The words of one choice of a set, or '' for a value the set does not have. */
export function said<K extends string>(options: readonly (readonly [K, string])[], key: K | undefined): string {
  return options.find(([value]) => value === key)?.[1] ?? '';
}

/** "Broj ljudi": "Za 2 i više" for a task with room for at least two, "Bilo koliko" for every open task. */
export const placesWords = (places: number | undefined) => atLeast(places) > 1 ? `Za ${atLeast(places)} i više` : 'Bilo koliko';

/** The word over the list for how it is ordered: the server reads the open tasks newest first (UX plan 2.14). */
export const NEWEST_FIRST = 'Najnovije prvo';

/** A count with the thousands set apart by a dot, as the app writes money and as the person reads it: 1.248. */
export const groupDigits = (count: number) => String(Math.trunc(count)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** "1.248 zadataka": the plural of the tasks with the number grouped. */
export const countWords = (count: number) => zadataka(count).replace(String(count), groupDigits(count));

/** A chosen range of days: "26. sep" for one day, "26–28. sep" inside a month, "30. sep – 2. okt" across two. */
export function datesWords(range: DateRange, now: Date = new Date()): string {
  return range.from === range.to ? civilDay(range.from, now) : weekLabel([range.from, range.to], now);
}

/** Kada in words: the chosen days, or the flexible choice ("Bilo kada" when nothing is chosen). */
export function whenWords(view: Pick<MarketplaceView, 'when' | 'dates'>, now: Date = new Date()): string {
  const dates = dateRange(view.dates);
  return dates ? datesWords(dates, now) : said(WHEN, view.when ?? 'any') || 'Bilo kada';
}

/** A searched word as it is shown back: in Serbian quotation marks, so it never reads as a place. */
export const quoted = (text: string) => `„${text.trim()}“`;

/**
 * Line 1 of the search pill, and the value of the "Gde" step: one public point (a place's whole set, "Na ovom mestu"),
 * the chosen place (with the searched words, when there are both), the searched words, the map's area, or "Svi zadaci".
 */
export function whereWords(view: Pick<MarketplaceView, 'place' | 'query' | 'area' | 'pinPlace' | 'where'>): string {
  const place = typeof view.place === 'string' ? view.place.trim() : '', query = view.query.trim();
  if (view.where === 'remote') return query ? `Na daljinu · ${quoted(query)}` : 'Na daljinu';
  const where = view.pinPlace ? PIN_PLACE : place;
  if (where) return query ? `${where} · ${quoted(query)}` : where;
  if (query) return quoted(query);
  return view.area ? 'Ova oblast' : 'Svi zadaci';
}

/**
 * Line 2 of the search pill: when, then the conditions that are on ("Ovaj vikend · 2+ mesta").
 * The separate Filteri control already names the action, so this line only describes the current choice.
 */
export function conditionsWords(view: MarketplaceView, now: Date = new Date()): string {
  const extras = [(view.where ?? 'any') !== 'any' ? said(WHERE, view.where) : '', atLeast(view.places) > 1 ? placesWords(view.places) : '',
    view.price !== 'all' ? said(PRICE, view.price) : ''].filter(Boolean);
  return [whenWords(view, now), ...extras].join(' · ');
}

/** Tasks a time choice leaves out because they name no day: said, never hidden silently. */
export const undatedWords = (count: number) => plural(count, 'zadatak bez datuma nije u ovom izboru.',
  'zadatka bez datuma nisu u ovom izboru.', 'zadataka bez datuma nije u ovom izboru.');

/**
 * The list sheet's top line, never blank (Discovery V47 review): while the list is read (or while it is still read which
 * tasks are mine) it says so; a read that failed says so; nothing found is "Nema zadataka" (the empty list under it says
 * why, in its own words). Otherwise one format, every count through the plural: the tasks listed, then apart and quieter
 * (`extra`) the tasks the map cannot show — "12 zadataka · 3 zadatka bez tačke na mapi", under an area
 * "2 zadatka u oblasti · 2 zadatka bez tačke na mapi" or "U oblasti nema zadataka"; on one point,
 * the point's count is followed by the separate count of point-free tasks when present.
 */
export function countLineWords({ status, listed, inArea, withoutPoint, pinless, area, pinPlace }: {
  status: 'loading' | 'error' | 'ready'; listed: number; inArea: number; withoutPoint: number;
  /** Without an area: how many of the listed tasks have no point on the map. */ pinless: number;
  area: boolean; pinPlace: boolean;
}): { words: string; extra: string } {
  if (status === 'loading') return { words: 'Učitavamo zadatke…', extra: '' };
  if (status === 'error') return { words: 'Zadaci nisu učitani', extra: '' };
  const without = (count: number) => count ? ` · ${countWords(count)} bez tačke na mapi` : '';
  if (pinPlace) return { words: inArea ? `${countWords(inArea)} na ovom mestu` : 'Na ovom mestu nema zadataka', extra: without(withoutPoint) };
  if (area) return { words: inArea ? `${countWords(inArea)} u oblasti` : 'U oblasti nema zadataka', extra: without(withoutPoint) };
  return listed ? { words: countWords(listed), extra: without(pinless) } : { words: 'Nema zadataka', extra: '' };
}
