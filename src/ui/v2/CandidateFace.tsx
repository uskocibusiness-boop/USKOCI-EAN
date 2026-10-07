import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { KandidatProjekcija } from '../../contracts/projections';
import { needScheduleText } from '../../data/needDetailPresentation';
import { calendarInstant } from '../../lib/calendarTime';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { Avatar, type AvatarSize } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { osoba } from '../system/plural';
import { useTextScale } from '../system/textScale';
import { cardCompact, raisedItem, sys } from '../system/tokens';
import { Press } from '../Press';
import { T } from '../Text';
import { PRICE_NOT_STORED, PrijavaCard, PrijavaPriceText, PrijavaState, prijavaStatusWord, type PrijavaModel, type PrijavaStatus } from './PrijavaCard';

/**
 * The requester's side of the shared application card (owner's step 7, 2026-09-24; one object for both people since 2026-10-07,
 * plan 2.12). An application is chosen as a PERSON first, so the card reads the way the decision is made, and it is the SAME card
 * the worker finds in "Moje prijave" (`PrijavaCard`):
 *
 *   1. the state, as the app's one `StatusChip` (Poslata, Viđena, Izabrana, Nije izabrana, Povučena), and under it the reason when
 *      an open application cannot simply be chosen;
 *   2. the person — the one Avatar (or their photo), the name and the rating with the count it stands on;
 *   3. the facts in the fixed order: the term, the price, the people, their complete message, before opening the application to decide.
 *
 * Nothing here invents a rating, a count, a time or a state: a missing rating says it is missing, a count is the server's own
 * words, an amount without figures is never dressed as money ("Iznos nije sačuvan"), and "Viđena" is said only for an application the
 * server confirmed as seen on this phone (the candidate read merges SUBMITTED, VIEWED and SHORTLISTED into one SELECTABLE and carries no
 * viewed flag; until it does, an application opened earlier reads "Poslata" again after a restart, which is still true).
 * The card is ONE press that opens the application and is heard once, as the person and everything the card shows.
 *
 * Pure helpers first (tested on their own), then the parts the list, the comparison and the offer are built from.
 */

/* ------------------------------------------------------------------------------------------------ what it says */

/** What the service writes when the read carried no rating (`candidateClientService`). */
const NO_RATING = '—';

export type CandidateTrust = { text: string; star: boolean; spoken: string };
/**
 * The rating with the count it stands on, as the read gave them. A star only beside a real figure; a missing rating is
 * said to be missing, never left blank and never replaced by a number. The count is the server's own words (ratings, or
 * finished tasks when the read has no count of ratings) and is shown only when the read had it.
 */
export function candidateTrust(k: Pick<KandidatProjekcija, 'ocenaTekst' | 'recenzijeTekst'>): CandidateTrust {
  const rating = (k.ocenaTekst ?? '').trim(), count = (k.recenzijeTekst ?? '').trim();
  const rated = rating !== '' && rating !== NO_RATING && /\d/.test(rating);
  if (rated) return { star: true, text: count ? `${rating} · ${count}` : rating, spoken: count ? `ocena ${rating}, ${count}` : `ocena ${rating}` };
  // The read counted the ratings and there are none: that is news the person can read, not a rating that is "unavailable".
  if (count === '0 ocena') return { star: false, text: 'Još nema ocena', spoken: 'još nema ocena' };
  return { star: false, text: count ? `Ocena nije dostupna · ${count}` : 'Ocena nije dostupna',
    spoken: count ? `ocena nije dostupna, ${count}` : 'ocena nije dostupna' };
}

/** What stands in the price row: the total, or the quiet words for a price that was not stored. The people have a row of their own. */
export type CandidateValue = PrijavaModel['price'];
export const UNPRICED = PRICE_NOT_STORED;
export function candidateValue(k: Pick<KandidatProjekcija, 'cena' | 'pokrivaMesta'>): CandidateValue {
  const shown = (k.cena?.prikaz ?? '').trim();
  if (!shown || !/\d/.test(shown) || !Number.isSafeInteger(k.cena.iznos) || k.cena.iznos <= 0) return { kind: 'unpriced' };
  // An amount never loses its currency: a figure written without one gets the offer's own.
  const amount = /[A-Za-z]/.test(shown) ? shown : `${shown} ${k.cena.valuta || 'RSD'}`;
  return { kind: 'amount', amount, basis: 'ukupno' };
}

/**
 * The exact interval the person proposed, in the task's zone (Serbian time when the task has none: an agreed term reads
 * the same on both phones). The zone is named only on a phone that stands in another one. Null when nothing was proposed.
 */
export function candidateTime(k: Pick<KandidatProjekcija, 'predlozeniPocetak' | 'predlozeniKraj'>, timezone?: string | null): string | null {
  const from = calendarInstant(k.predlozeniPocetak), to = calendarInstant(k.predlozeniKraj);
  if (from === null || to === null || from >= to) return null;
  return needScheduleText({ kind: 'FIXED_WINDOW', startsAt: k.predlozeniPocetak ?? null, endsAt: k.predlozeniKraj ?? null }, timezone || DOGOVORENA_ZONA);
}

/**
 * The state of an application as the chip says it (the owner's five words, 2026-10-07). The candidate read merges SUBMITTED, VIEWED
 * and SHORTLISTED into one SELECTABLE and carries no viewed flag, so "Viđena" is only said when the screen knows the server confirmed
 * the view (`viewed`). An application that cannot be chosen because the task is full or closed was not chosen: "Nije izabrana".
 */
export function candidateChip(k: Pick<KandidatProjekcija, 'stanje'>, viewed = false): PrijavaStatus {
  switch (k.stanje) {
    case 'SELECTED': return 'application.selected';
    case 'WITHDRAWN': return 'application.withdrawn';
    case 'CLOSED': case 'FULL': return 'application.notSelected';
    // Open, whether it can be chosen right now (SELECTABLE) or waits on something (STALE, OVERFILL): it was sent, and perhaps seen.
    default: return viewed ? 'application.seen' : 'application.sent';
  }
}

/** Why an application that the chip alone does not explain is not simply open. The chip is the state; this is only the reason. */
export const CANDIDATE_REASON: Partial<Record<KandidatProjekcija['stanje'], string>> = {
  STALE: 'Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.', OVERFILL: 'Više ljudi nego što je preostalo',
  CLOSED: 'Zadatak je zatvoren', FULL: 'Sva mesta su popunjena',
};
export type CandidateTone = 'warn' | 'muted';
/** The reason line, only when it says something: an application that can simply be chosen, and one that was chosen or withdrawn, need none. */
export function candidateStatus(k: Pick<KandidatProjekcija, 'stanje'>): { text: string; tone: CandidateTone } | null {
  const text = CANDIDATE_REASON[k.stanje];
  return text ? { text, tone: k.stanje === 'STALE' || k.stanje === 'OVERFILL' ? 'warn' : 'muted' } : null;
}

/**
 * The term row: the exact time the person proposed, marked as theirs, or else the task's own term (which then applies, and is what
 * every card of the list says; the proposals are the cards that differ).
 */
export function candidateTerm(k: Pick<KandidatProjekcija, 'predlozeniPocetak' | 'predlozeniKraj'>, timezone: string | null | undefined, taskTerm: string): string {
  const proposed = candidateTime(k, timezone);
  return proposed ? `Predlog: ${proposed}` : taskTerm;
}

/** The message's first 180 characters, for what is heard before the application is opened. */
export function messagePreview(message: string): { text: string; cut: boolean } {
  const text = Array.from(message).slice(0, 180).join('');
  return { text, cut: text.length < message.length };
}

/** The shared card's model for an application seen by the requester: nothing here that the read did not carry. */
export function requesterPrijava(k: KandidatProjekcija, context: { timezone?: string | null; taskTerm: string; viewed?: boolean; avatar: ReactNode }): PrijavaModel {
  const message = k.napomena?.trim();
  return { status: candidateChip(k, context.viewed), reason: candidateStatus(k),
    who: { kind: 'person', name: k.ime, avatar: context.avatar, trust: <CandidateTrustLine candidate={k} /> },
    term: candidateTerm(k, context.timezone, context.taskTerm), price: candidateValue(k), people: osoba(k.pokrivaMesta), message: message || null,
    quiet: k.stanje === 'WITHDRAWN' || k.stanje === 'CLOSED' || k.stanje === 'FULL' };
}

/**
 * Everything the card shows, as one sentence a screen reader hears after its name: the state, the rating, the term, the price, the
 * people, a bounded preview of the message and, for an application that cannot be chosen, why.
 */
export function candidateSpoken(k: KandidatProjekcija, taskTerm: string, timezone?: string | null, viewed = false): string {
  const trust = candidateTrust(k), reason = candidateStatus(k);
  const message = k.napomena?.trim() ?? '';
  const preview = messagePreview(message);
  const price = candidateValue(k), proposed = candidateTime(k, timezone);
  return [prijavaStatusWord(candidateChip(k, viewed)), `${trust.spoken.charAt(0).toLocaleUpperCase('sr-Latn-RS')}${trust.spoken.slice(1)}`,
    proposed ? `Predlog termina: ${proposed}` : `Termin: ${taskTerm}`, price.kind === 'amount' ? `Ponuda: ${price.amount} ${price.basis}` : UNPRICED, osoba(k.pokrivaMesta),
    message ? `Poruka: „${preview.text}${preview.cut ? '…' : ''}“. Otvori prijavu za celu poruku` : null, reason?.text.replace(/\.$/, '') ?? null]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join('. ').concat('.');
}

/* ------------------------------------------------------------------------------------------------ the parts */

/** The person's picture: the photo the screen hands in, or the one Avatar with their letters (a drawn person without a name). */
export function CandidateAvatar({ candidate, size, photo }: { candidate: Pick<KandidatProjekcija, 'inicijali'>; size: AvatarSize; photo?: ReactNode }) {
  return <View style={{ width: size, height: size }}>{photo ?? <Avatar initials={candidate.inicijali || null} size={size} />}</View>;
}

/**
 * The rating line: a star only beside a figure. When it wraps, it breaks after the dot and keeps the count whole ("Ocena nije
 * dostupna ·" over "3 završena posla"), never inside the count ("· 3" over "završena posla").
 */
export function CandidateTrustLine({ candidate, lines = 2 }: { candidate: Pick<KandidatProjekcija, 'ocenaTekst' | 'recenzijeTekst'>; lines?: number }) {
  const trust = candidateTrust(candidate);
  const [lead, count] = trust.text.split(' · ');
  const shown = count ? `${lead}${NBSP}· ${count.replace(/ /g, NBSP)}` : trust.text;
  return <View style={s.trust}>
    {trust.star ? <FactArt kind="star" size={14} /> : null}
    <T style={s.trustText} numberOfLines={lines}>{shown}</T>
  </View>;
}
const NBSP = ' ';

/**
 * An application in the requester's list: ONE press that opens it, heard as the person and everything the card shows. The content
 * is the shared `PrijavaCard` (the same card the worker finds in "Moje prijave"); the frame is the raised white item, leaving the
 * person and the facts to lead, and an application that was chosen keeps its semantic green edge.
 */
export const CandidateCard = memo(function CandidateCard({ candidate: k, timezone, fallbackTime, viewed = false, onOpen, photo, large, narrow = false }: {
  candidate: KandidatProjekcija; timezone?: string | null;
  /** The task's own term: what applies when the person proposed none. */ fallbackTime: string;
  /** The server confirmed that this application was seen (see `candidateChip`). */ viewed?: boolean;
  onOpen: () => void; photo?: ReactNode;
  /** The owner's large text: the price and its basis stack. */ large: boolean;
  /** A narrow phone uses the same stacked terms. */ narrow?: boolean;
}) {
  const model = requesterPrijava(k, { timezone, taskTerm: fallbackTime, viewed, avatar: <CandidateAvatar candidate={k} size={56} photo={photo} /> });
  return <Press accessibilityRole="button" accessibilityLabel={`Pogledaj prijavu: ${k.ime}`}
    accessibilityValue={{ text: candidateSpoken(k, fallbackTime, timezone, viewed) }} accessibilityHint="Otvara celu prijavu."
    haptic="select" scaleTo={0.986} onPress={onOpen} style={[s.card, k.stanje === 'SELECTED' && s.chosen]}>
    <PrijavaCard model={model} large={large || narrow} trailing={<CaretRight size={20} color={sys.color.muted} />} />
  </Press>;
});

/**
 * The height of a comparison column's head at its fullest: the 40 px picture, a three-line name, a two-line rating, the state's
 * chip and a two-line reason, with the gaps between them, at the rounded text scale. The head is the person and then the state; both
 * aligned columns reserve all of it so a long name or a reason cannot shift just one column's cells. Two columns side by side hold
 * their head to it, so their cells line up whatever the names (review r4 rk item 6: a fixed 132 was shorter than a three-line name
 * beside the picture, and the columns slipped).
 */
export function compareIdentityHeight(scale: number): number {
  const text = 3 * sys.type.cardTitleCompact.lineHeight! + 2 * TRUST_LINE + CHIP_HEIGHT + 2 * REASON_LINE;
  return Math.ceil(40 + 3 * COMPARE_IDENTITY_GAP + sys.space.sm + text * scale);
}
const TRUST_LINE = 20, COMPARE_IDENTITY_GAP = 6, CHIP_HEIGHT = 24, REASON_LINE = sys.type.note.lineHeight!;

/**
 * An application as a comparison column: the person on top, then the state (the same chip as the card), then the same cells in
 * every column and in the card's order — the term, the offer, the people — followed by the complete message. `aligned` holds
 * the head to one height when two columns stand side by side.
 */
export const CandidateCompareCard = memo(function CandidateCompareCard({ candidate: k, timezone, fallbackTime, viewed = false, onOpen, photo, aligned }: {
  candidate: KandidatProjekcija; timezone?: string | null; fallbackTime: string; viewed?: boolean; onOpen: () => void; photo?: ReactNode; aligned: boolean;
}) {
  const reason = candidateStatus(k), value = candidateValue(k), message = k.napomena?.trim() ?? '';
  const scale = useTextScale();
  return <Press accessibilityRole="button" accessibilityLabel={`Otvori prijavu: ${k.ime}`}
    accessibilityValue={{ text: candidateSpoken(k, fallbackTime, timezone, viewed) }} accessibilityHint="Otvara celu prijavu."
    haptic="select" scaleTo={0.986} onPress={onOpen} style={[s.compare, k.stanje === 'SELECTED' && s.chosen]}>
    <View style={[s.compareHead, aligned && { minHeight: compareIdentityHeight(scale) }]}>
      <View style={[s.compareIdentity, !aligned && s.comparePhoneHead]}>
        <CandidateAvatar candidate={k} size={40} photo={photo} />
        <View style={[!aligned && s.identity, s.comparePersonCopy]}>
          <T style={s.compareName} numberOfLines={aligned ? 3 : undefined}>{k.ime}</T>
          <CandidateTrustLine candidate={k} />
        </View>
      </View>
      <PrijavaState status={candidateChip(k, viewed)} reason={reason ? { text: reason.text, tone: reason.tone } : null} silent />
    </View>
    <View style={s.cell}><T variant="label" tone="muted">Termin</T><T variant="meta" style={s.ink}>{candidateTerm(k, timezone, fallbackTime)}</T></View>
    {/* A column reads from its left edge: the quiet words too (review r4 rk item 7). */}
    <View style={s.cell}><T variant="label" tone="muted">Ponuda</T><PrijavaPriceText price={value} large={false} /></View>
    <View style={s.cell}><T variant="label" tone="muted">Ljudi</T><T variant="bodyStrong" style={s.ink}>{osoba(k.pokrivaMesta)}</T></View>
    {message ? <View style={s.cell}><T variant="label" tone="muted">Poruka</T><T style={s.compareMessage}>{message}</T></View> : null}
  </Press>;
});

/**
 * The person at the head of their offer, under the sheet's title, which is their name (review r4 rk item 3): the 56 px
 * picture and the rating beside it. The name is not drawn again; the row still says it to a screen reader, as the person
 * first, with what a press does as its hint (as the task's poster row is). It opens their public profile.
 */
export function CandidatePerson({ candidate: k, photo, onPress, disabled = false }: {
  candidate: KandidatProjekcija; photo?: ReactNode; onPress: () => void; disabled?: boolean;
}) {
  const trust = candidateTrust(k);
  // No heading role inside the press: a screen reader never reaches a heading that lives in a button (review r4 rk item
  // 3). The sheet's own title is the heading.
  return <Press accessibilityRole="button" accessibilityLabel={`${k.ime}, ${trust.spoken}`} accessibilityHint="Otvara javni profil"
    accessibilityState={{ disabled }} disabled={disabled} haptic="select" scaleTo={0.99} onPress={onPress} style={s.person}>
    <CandidateAvatar candidate={k} size={56} photo={photo} />
    <View style={s.identity}>
      <CandidateTrustLine candidate={k} lines={3} />
      {/* A visible word for the row (verify r4c item 3): with only the picture and "Ocena nije dostupna" beside the caret,
          the row read as dead or as a link to the rating. It stays while a command runs, as the caret does. */}
      <T style={s.personAction}>Pogledaj profil</T>
    </View>
    <CaretRight size={20} color={sys.color.muted} />
  </Press>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  personAction: { ...sys.type.bodyStrong, color: sys.color.green },
  card: { ...raisedItem, borderRadius: sys.radius.card, padding: sys.space.base, gap: sys.space.md },
  chosen: { borderColor: sys.color.green },
  identity: { flex: 1, minWidth: 0, gap: sys.space.xs },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { flexShrink: 1, fontSize: 14, lineHeight: TRUST_LINE, fontWeight: '500', color: sys.color.muted, fontVariant: ['tabular-nums'] },
  compare: { ...cardCompact, ...raisedItem, flex: 1, minWidth: 0, padding: sys.space.base, gap: sys.space.md,
    borderColor: sys.color.line, backgroundColor: sys.color.surface },
  compareName: { ...sys.type.cardTitleCompact, color: sys.color.ink },
  compareHead: { gap: sys.space.sm },
  compareIdentity: { gap: COMPARE_IDENTITY_GAP },
  comparePhoneHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  comparePersonCopy: { gap: COMPARE_IDENTITY_GAP, minWidth: 0 },
  cell: { gap: sys.space.xs, paddingTop: sys.space.md, borderTopWidth: 1, borderColor: sys.color.line },
  compareMessage: { fontSize: 14, lineHeight: 21, color: sys.color.muted },
  person: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base, minHeight: 64, paddingVertical: sys.space.xs },
});
