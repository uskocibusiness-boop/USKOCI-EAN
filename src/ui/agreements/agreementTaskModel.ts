import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { cenaSaOsnovom } from '../../lib/novac';
import { agreementAttention, type AgreementAttention, type AgreementTaskGroup } from './agreementListModel';

/** One task as the owner described it (22.11.2026): a single Dogovor screen per task, also with several people. */
export type AgreementTaskPerson = {
  agreementId: string; accountId: string; profileId: string | null; name: string; initials: string;
  role: UcesnikProjekcija['uloga']; agreement: DogovorProjekcija;
};
export type AgreementTaskSummary = {
  key: string; needId: string | null; title: string; myRole: 'narucilac' | 'uskocer';
  /** "1.200 RSD/sat po osobi", "5.000 RSD ukupno"; several different prices say so instead of picking one. */
  priceText: string | null; remote: boolean; placeText: string; whenText: string; description: string | null;
  /** People agreed on this task (active or finished), the other side of each Dogovor. */
  people: AgreementTaskPerson[];
  /** The owner of the task, for a worker's card ("task owner left, my avatar right"). */
  owner: AgreementTaskPerson | null; me: UcesnikProjekcija | null;
  filled: number; total: number | null;
  attention: AgreementAttention | null; anyActive: boolean;
};

const LIVE = new Set(['CONFIRMED', 'AWAITING_REQUESTER', 'COMPLETED']);
export const isLiveAgreement = (item: DogovorProjekcija) => LIVE.has(item.stanje);
export const isOpenAgreement = (item: DogovorProjekcija) => item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER';

function person(item: DogovorProjekcija, party: UcesnikProjekcija): AgreementTaskPerson {
  return { agreementId: item.id, accountId: party.id, profileId: party.profilId, name: party.ime || 'Učesnik',
    initials: party.inicijali, role: party.uloga, agreement: item };
}

export function agreementTaskSummary(group: AgreementTaskGroup): AgreementTaskSummary {
  const items = group.items, first = items[0];
  const me = first.ucesnici.find(party => party.viSte) ?? null;
  const myRole = me?.uloga === 'narucilac' ? 'narucilac' : 'uskocer';
  const live = items.filter(isLiveAgreement);
  const shown = live.length ? live : items;
  const people = shown.flatMap(item => item.ucesnici.filter(party => !party.viSte).map(party => person(item, party)));
  const ownerParty = myRole === 'uskocer' ? first.ucesnici.find(party => party.uloga === 'narucilac') ?? null : null;
  const prices = [...new Set(shown.filter(item => item.cena.prikaz).map(item => cenaSaOsnovom(item.cena.prikaz, item.osnovaCene)))];
  const total = Number.isInteger(first.pokrivenost?.ukupno) && first.pokrivenost.ukupno > 0 ? first.pokrivenost.ukupno : null;
  const filled = live.reduce((sum, item) => sum + Math.max(1, item.pokrivenost?.popunjeno ?? 1), 0);
  const attention = items.map(agreementAttention).find(Boolean) ?? null;
  return {
    key: group.key, needId: first.izvor?.zadatakId ?? null, title: first.naslov.trim() || 'Zadatak', myRole,
    priceText: prices.length === 1 ? prices[0] : prices.length > 1 ? 'Različite cene po osobi' : null,
    remote: first.rezim === 'DALJINSKI', placeText: first.rezim === 'DALJINSKI' ? 'Na daljinu' : first.putanjaTekst || 'Mesto nije navedeno',
    whenText: first.vremeTekst || 'Termin po dogovoru', description: first.prihvacenObim?.trim() || null,
    people, owner: ownerParty ? person(first, ownerParty) : null, me,
    filled: myRole === 'narucilac' ? filled : Math.min(filled, total ?? filled), total,
    attention, anyActive: items.some(isOpenAgreement),
  };
}

/** "2 od 3 osobe", or "2 osobe" when the requested number is not known. */
export function fillText(summary: Pick<AgreementTaskSummary, 'filled' | 'total'>): string {
  const word = (n: number) => n % 10 === 1 && n % 100 !== 11 ? 'osoba' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'osobe' : 'osoba';
  return summary.total ? `${summary.filled} od ${summary.total} ${word(summary.total)}` : `${summary.filled} ${word(summary.filled)}`;
}
