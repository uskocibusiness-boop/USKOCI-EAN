import type { DogovorProjekcija } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { normalizedPlaceText } from '../location/placeText';
import type { AgreementTaskGroup, HistoryFilter } from './agreementListModel';

export const AGREEMENT_SEARCH_MAX_LENGTH = 120;
export const agreementSearchQuery = (query: string) => normalizedPlaceText(query.slice(0, AGREEMENT_SEARCH_MAX_LENGTH));

/** Only the three already rendered facts. Never stringify a private projection:
 * IDs, exact address, coordinates, phone, messages and hidden source fields are
 * deliberately not search metadata. A remote job ignores an old physical label. */
export function agreementMatchesSearch(item: DogovorProjekcija, query: string): boolean {
  const words = agreementSearchQuery(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const other = item.ucesnici.find(person => !person.viSte);
  const displayed = [readableTitle(item.naslov), other?.ime ?? '', item.rezim === 'DALJINSKI' ? 'Na daljinu' : item.putanjaTekst ?? ''];
  const tokens = normalizedPlaceText(displayed.join(' ')).split(' ');
  // Word prefixes keep short names meaningful: Ana must not match 'stana'.
  return words.every(word => tokens.some(token => token.startsWith(word)));
}

/** Filter whole groups AFTER role/lifecycle grouping, retaining accepted siblings
 * and capacity counts. A completed-only history search cannot match cancelled text. */
export function agreementGroupMatchesSearch(group: AgreementTaskGroup, query: string, outcome: HistoryFilter = 'all'): boolean {
  if (!agreementSearchQuery(query)) return true;
  return group.items.some(item => (outcome === 'all' || item.stanje === (outcome === 'completed' ? 'COMPLETED' : 'CANCELLED'))
    && agreementMatchesSearch(item, query));
}

/** A matching collaborator must not hide below the three-row disclosure. */
export function prioritizeAgreementSearch(items: readonly DogovorProjekcija[], query: string, outcome: HistoryFilter = 'all'): readonly DogovorProjekcija[] {
  if (!agreementSearchQuery(query)) return items;
  const found = (item: DogovorProjekcija) => (outcome === 'all' || item.stanje === (outcome === 'completed' ? 'COMPLETED' : 'CANCELLED'))
    && agreementMatchesSearch(item, query);
  return [...items.filter(found), ...items.filter(item => !found(item))];
}
