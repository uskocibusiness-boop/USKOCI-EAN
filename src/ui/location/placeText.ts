import type { ConfirmedLocationPoint, LocationSlot } from '../../contracts/location';
import type { NeedTaskGeography, NeedTaskGeographyPoint } from '../../contracts/needFactsV2';

/**
 * The words for a place: what each slot is called, the conversation's own search seed and the short line a confirmed
 * point becomes in the thread. Pure and map-free, so the conversation can import it without the native map
 * (ConversationPointAsk, which reaches the map, is loaded lazily).
 */

// Serbian Cyrillic to Latin. OSM / LocationIQ labels for Serbia are often Cyrillic ("Булевар ослобођења") while people
// type or speak Latin; matching and the shown address both use Latin.
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm',
  н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
};
export const toSerbianLatin = (value: string): string => value.replace(/[Ѐ-ӿ]/g, letter => {
  const lower = letter.toLowerCase(), latin = CYRILLIC[lower];
  if (latin === undefined) return letter;
  return letter === lower ? latin : latin.charAt(0).toUpperCase() + latin.slice(1);
});

export const normalizedPlaceText = (value: string): string => value.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLocaleLowerCase('sr-Latn-RS').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();

type PlaceValue = Readonly<{ geography: NeedTaskGeography | null; exactAddress: string | null }>;

export const slotTitle = (slot: LocationSlot, geography: NeedTaskGeography | null): string => {
  if (slot === 'start') return geography?.mode === 'STATIONARY' ? 'Mesto zadatka' : 'Polazište';
  if (slot === 'end') return 'Odredište';
  if (slot === 'serviceArea') return 'Područje rada';
  return `Stanica ${Number(slot.slice('waypoints/'.length)) + 1}`;
};

const slotPlace = (slot: LocationSlot, geography: NeedTaskGeography | null): NeedTaskGeographyPoint | undefined =>
  slot === 'start' ? geography?.start
    : slot === 'end' ? geography?.end
      : slot === 'serviceArea' ? geography?.serviceArea
        : geography?.waypoints?.[Number(slot.slice('waypoints/'.length))];

export const exactAddressForSlot = (slot: LocationSlot, value: PlaceValue): string | null => {
  const geography = value.geography, exact = value.exactAddress?.trim();
  if (!geography || !exact) return null;
  if (geography.mode === 'STATIONARY' && slot === 'start') return exact;
  const place = slotPlace(slot, geography);
  if (!place) return null;
  // A route has one legacy private exact-address fact, so bind it only when the street/POI
  // text itself matches this slot. City is deliberately excluded: both ends often share it.
  const exactNormalized = normalizedPlaceText(exact);
  const identities = [place.label, place.area].filter((part): part is string => typeof part === 'string')
    .map(part => normalizedPlaceText(part)).filter(part => part.length >= 4);
  return identities.some(identity => exactNormalized.includes(identity)) ? exact : null;
};

const uniqueSeedParts = (parts: readonly (string | null | undefined)[]): string[] => {
  const result: string[] = [];
  for (const raw of parts) {
    if (typeof raw !== 'string') continue;
    for (const piece of raw.split(',').map(part => part.trim()).filter(Boolean)) {
      const normalized = normalizedPlaceText(piece);
      if (!normalized || result.some(existing => {
        const existingTokens = new Set(normalizedPlaceText(existing).split(' ').filter(Boolean));
        const candidateTokens = normalized.split(' ').filter(Boolean);
        return candidateTokens.length > 0 && candidateTokens.every(token => existingTokens.has(token));
      })) continue;
      result.push(piece);
    }
  }
  return result;
};

/** The most precise thing already known for this slot, used only as a search seed. */
export const slotSeed = (slot: LocationSlot, value: PlaceValue): string => {
  const place = slotPlace(slot, value.geography);
  // Use the private house/street string only when it can be bound to this slot by the slot's
  // own street/POI identity. That gives the geocoder the exact spoken address without ever
  // copying one endpoint's private address onto another endpoint.
  return uniqueSeedParts([exactAddressForSlot(slot, value), place?.label, place?.area, place?.city]).join(', ');
};

/** A confirmed point's own words: its address, or for a provider point the conversation's place. A hand-placed pin with no
 *  address has none: a manually confirmed coordinate is not a resolved address. */
export const confirmedPointText = (point: ConfirmedLocationPoint, value: PlaceValue): string | null =>
  point.address?.trim() || (point.origin.kind === 'MANUAL_PIN' ? null : slotSeed(point.slot, value) || null);

const HOUSE_NUMBER = /^\d+\s?[a-zA-ZčćžšđČĆŽŠĐ]?(?:\s?[/-]\s?\d+\s?[a-zA-ZčćžšđČĆŽŠĐ]?)?$/;

/**
 * Street and number, then the locality, from a label that may be the provider's whole address line ("65, Bulevar
 * oslobođenja, MZ Žitni trg, Rotkvarija, Novi Sad, …"). Only the label's own parts are used: the locality is the part that
 * names one of the given places (the conversation's city for this slot), never a guess among neighbourhoods, districts and
 * postcodes. A short text (one or two parts, as a person says or types it) is kept whole.
 */
export function shortPlaceLabel(label: string, localities: readonly (string | null | undefined)[] = []): { main: string; locality: string | null } {
  const text = toSerbianLatin(label).replace(/\s+/g, ' ').trim();
  const parts = text.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) return { main: parts[0] ?? text, locality: null };
  const leadingNumber = HOUSE_NUMBER.test(parts[0]) && !!parts[1] && !HOUSE_NUMBER.test(parts[1]);
  const main = leadingNumber ? `${parts[1]} ${parts[0]}` : parts[0];
  const rest = parts.slice(leadingNumber ? 2 : 1);
  const wanted = new Set(localities.filter((place): place is string => typeof place === 'string')
    .map(place => normalizedPlaceText(toSerbianLatin(place))).filter(Boolean));
  const named = rest.find(part => wanted.has(normalizedPlaceText(part)));
  // Two parts are what a person says ("Bulevar oslobođenja 65, Novi Sad"); nothing of it is dropped.
  const locality = named ?? (parts.length === 2 && rest.length === 1 ? rest[0] : null);
  const repeats = locality !== null && ` ${normalizedPlaceText(main)} `.includes(` ${normalizedPlaceText(locality)} `);
  return { main, locality: repeats ? null : locality };
}

export type ConfirmedPlaceEntry = Readonly<{
  slot: LocationSlot;
  /** "Potvrđeno mesto", "Potvrđeno polazište", "Potvrđena stanica 1". */
  lead: string;
  /** The same place inside a sentence: "mesto zadatka", "polazište", "stanica 1". */
  noun: string;
  main: string; locality: string | null;
  /** False for a hand-placed pin without an address: "tačka na mapi" is not a street to set in bold. */
  exact: boolean;
  /** The person set this point by hand just now: the line acknowledges it. */
  ack: boolean;
  /** The whole label, for a screen reader; the line joins its entries into sentences. */
  spoken: string;
}>;

const lead = (slot: LocationSlot, geography: NeedTaskGeography | null): string => {
  if (slot === 'start' && geography?.mode === 'STATIONARY') return 'Potvrđeno mesto';
  return slot.startsWith('waypoints/') ? `Potvrđena ${slotTitle(slot, geography).toLocaleLowerCase('sr-Latn-RS')}`
    : `Potvrđeno ${slotTitle(slot, geography).toLocaleLowerCase('sr-Latn-RS')}`;
};

/** Route order: start, the stops in order (at most 22 points), end, then a service area. */
const slotOrder = (slot: LocationSlot): number =>
  slot === 'start' ? 0 : slot === 'end' ? 2_000 : slot === 'serviceArea' ? 3_000
    : 1 + Number(slot.slice('waypoints/'.length));

/** One entry per confirmed point, in route order, for the conversation's confirmed-place line. */
export function confirmedPlaceEntries(points: readonly ConfirmedLocationPoint[], value: PlaceValue,
  acknowledged: ReadonlySet<LocationSlot> = new Set()): ConfirmedPlaceEntry[] {
  const geography = value.geography;
  return [...points].sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot)).map(point => {
    const own = confirmedPointText(point, value);
    const short = own ? shortPlaceLabel(own, [slotPlace(point.slot, geography)?.city]) : { main: 'tačka na mapi', locality: null };
    const noun = slotTitle(point.slot, geography).toLocaleLowerCase('sr-Latn-RS');
    const ack = acknowledged.has(point.slot);
    const full = own ? toSerbianLatin(own) : 'tačka na mapi';
    const entryLead = lead(point.slot, geography);
    return { slot: point.slot, lead: entryLead, noun, main: short.main, locality: short.locality, exact: !!own, ack,
      spoken: ack ? `U redu, ${noun} je sada: ${full}` : `${entryLead}: ${full}` };
  });
}
