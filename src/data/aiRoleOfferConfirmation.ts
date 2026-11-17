/**
 * High-confidence detector used only to ask whether the user wants to open the
 * other role. It never stores, transfers, or submits the original message.
 */
const MAX_TEXT = 4000;
const CYRILLIC: Readonly<Record<string,string>> = {
  а:'a', б:'b', в:'v', г:'g', д:'d', ђ:'dj', е:'e', ж:'z', з:'z', и:'i', ј:'j',
  к:'k', л:'l', љ:'lj', м:'m', н:'n', њ:'nj', о:'o', п:'p', р:'r', с:'s', т:'t',
  ћ:'c', у:'u', ф:'f', х:'h', ц:'c', ч:'c', џ:'dz', ш:'s',
};
function normalized(text: string): string {
  const latin = Array.from(text.toLocaleLowerCase('sr'), char => CYRILLIC[char] ?? char).join('').replace(/đ/g, 'dj');
  return latin.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
// Reuse the same bounded predicates for an offer and its explicit withdrawal.
const OFFER_PREDICATE = 'nudim|pruzam|pozelim da ponudim|zelim da (?:nudim|ponudim|pruzam|radim|se bavim)|hocu da (?:nudim|ponudim|pruzam|radim|se bavim)|(?:hteo|htela|zeleo|zelela|voleo|volela) bih da (?:nudim|ponudim|radim)|ja mogu da (?:radim|pruzam|pomognem)|radim kao|bavim se|drzim (?:privatne |online |onlajn )?casove|dajem (?:privatne )?casove';
const POSITIVE_OFFER = new RegExp('(?:^| )(?:' + OFFER_PREDICATE + ')(?: |$)');
const NEGATED_OFFER = new RegExp('(?:^| )(?:ne|nisam|necu(?: da)?) (?:' + OFFER_PREDICATE + ')(?: |$)');
/** High-confidence only. Mixed/ambiguous messages remain with the AI for clarification.
 * This is only a confirmation prompt, not automatic routing or text transfer.
 */
export function isExplicitWorkerOffer(text: string): boolean {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) return false;
  const t = normalized(text);
  if (!t) return false;
  // Questions stay in the conversation. Negating the offer itself also needs
  // clarification, while a separate limit (no loading/weekends) stays in its draft.
  if (/[?？]/.test(text) || /(?:^| )(?:da li|je li|jel|kako|gde|sta|zasto|mogu li|smem li)(?: |$)/.test(t)) return false;
  if (/(?:^| )(?:treba mi|potreban mi|potrebna mi|potrebni su mi|trebaju mi|trazim nekog|trazim nekoga|trazim radnika|trazim radnike|trazim majstora|trazim pomoc|neko da mi|da mi neko|ako mi neko|zelim da mi neko|hocu da mi neko)(?: |$)/.test(t)) return false;
  if (NEGATED_OFFER.test(t)) return false;
  return POSITIVE_OFFER.test(t);
}
