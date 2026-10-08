import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { PrilikaProjekcija } from '../../../contracts/projections';
import { needScheduleText } from '../../../data/needDetailPresentation';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { FactRow } from '../../system/FactRow';
import { Glyph } from '../../system/Glyph';
import { layout } from '../../system/layout';
import { osoba, plural } from '../../system/plural';
import { Section } from '../../system/Section';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { RELIABILITY_LABEL } from '../../profile/workTrustModel';
import { OFFERS_WORD } from '../discovery/TaskRecordBody';
import { placesText, taskPlace } from '../TaskFace';
import type { productPriceParts } from '../../product/ProductDetails';

/**
 * The parts of a task page, in the order the page reads (composition spec 2026-10-07, T3 and 4.4): the name (28), the one amount, three
 * facts (where, when, how many), then the sections - what the work is, what it asks, who posted it, where it is - each parted from the
 * next by space and not by a line. The same facts, in the same words and the same order, as the card in the list and on the map:
 * a task does not change its clothes between the list and the page that opens.
 */

/** An open page title: its layout still belongs to the screen's measured chrome handoff. */
export function TaskDecisionTitle({ children, onLayout }: { children: ReactNode; onLayout: (event: LayoutChangeEvent) => void }) {
  return <T accessibilityRole="header" onLayout={onLayout} variant="pageTitle" style={s.ink}>{children}</T>;
}

/**
 * The one amount the page is built around: the figure in the amount type and what it covers under it ("ukupno za ceo zadatak"), or - for a
 * task that takes offers or names no price - a word in the heading type, never in the amount's, so a word about money cannot be read as a sum.
 */
export function TaskDecisionPrice({ price, offers }: { price: ReturnType<typeof productPriceParts>; offers: boolean }) {
  const value = offers ? OFFERS_WORD.worker : price.value;
  return <View accessible accessibilityLabel={`Cena: ${value}${price.note ? `, ${price.note}` : ''}`} style={s.price}>
    <T variant={price.isAmount ? 'priceLarge' : 'heading'} style={s.ink}>{value}</T>
    {price.note ? <T variant="note" tone="muted">{price.note}</T> : null}
  </View>;
}

/**
 * Three aligned facts read as one group: where, when and how many. No date, place or count is parsed, shortened or guessed. The time is
 * written the way the card writes it (the task's own schedule in its own zone), and the place is the public start of the work only.
 */
export function TaskDecisionFacts({ need }: { need: Pick<PrilikaProjekcija, 'detalji' | 'podrucjeTekst' | 'vremeTekst' | 'schedule' | 'taskTimezone' | 'pokrivenost'> }) {
  const place = taskPlace(need);
  const capacity = placesText(need.pokrivenost, 'worker', 'fraction');
  const time = need.schedule ? needScheduleText(need.schedule, need.taskTimezone) : need.vremeTekst;
  return <View style={s.facts}>
    <FactRow size="detail" art={place.remote ? 'remote' : 'pin'} value={place.text} />
    <FactRow size="detail" art="calendar" value={time} />
    <FactRow size="detail" art="users" value={osoba(need.pokrivenost.ukupno)} note={`${capacity.text} popunjeno`} />
  </View>;
}

const REQUIREMENT_ART: Record<string, FactArtKind> = {
  'Veštine': 'tool', 'Alat': 'tool', 'Vozilo': 'vehicle', 'Dozvole': 'document', 'Bitni uslovi': 'info',
  'Najmanje iskustva': 'star', 'Identitet': 'shield', 'Uslovi': 'document',
};

/** The values of a requirement group, one to a line: a bulleted list loses its bullets (the picture is the group's mark), a sentence stays one. */
function valuesOf(value: string): string {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every(line => /^[•\-–]\s*/.test(line)) ? lines.map(line => line.replace(/^[•\-–]\s*/, '')).filter(Boolean).join('\n') : value;
}

/** What the task asks of the person who takes it: every supplied value stays visible, each group is a fact with its name under it. */
export function TaskDecisionRequirements({ rows }: { rows: { label: string; value: string }[] }) {
  if (!rows.length) return null;
  return <Section title="Važno za ovaj zadatak">
    <View style={s.requirements}>{rows.map((row, index) => <FactRow key={`${row.label}:${index}`} size="detail"
      art={REQUIREMENT_ART[row.label] ?? 'document'} value={valuesOf(row.value)} note={row.label} />)}</View>
  </Section>;
}

/**
 * A rating with how many reviews it stands on (UX plan 2.11, R27), as the page draws it: the star and "4,7 · 3 ocene"; "Još nema ocena" for none
 * and "Ocena nije dostupna" when the read says nothing (neither has a star: no figure, nothing to rate); "4,7" alone when the read does not say how
 * many. The count is never guessed, so one review cannot pass for fifty.
 */
export function publisherTrust(rating: string | null | undefined, count: number | null | undefined): { text: string; star: boolean } {
  if (count === 0) return { text: 'Još nema ocena', star: false };
  if (!rating) return { text: 'Ocena nije dostupna', star: false };
  return { text: typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? `${rating} · ${plural(count, 'ocena', 'ocene', 'ocena')}` : rating, star: true };
}

/** The same rating as it is heard: "Ocena 4,7 · 3 ocene", "Još nema ocena", "Ocena nije dostupna". */
export function publisherRatingLine(rating: string | null | undefined, count: number | null | undefined): string {
  const trust = publisherTrust(rating, count);
  return trust.star ? `Ocena ${trust.text}` : trust.text;
}

/** The words of the one action at the foot of a task I can apply to (owner, 8 Oct 2026): a task with a fixed price is applied to, a task without one is answered with an offer. */
export const APPLY_WORDS = { priced: 'Pošalji prijavu', open: 'Pošalji ponudu' } as const;
export const applyActionLabel = (priced: boolean): string => priced ? APPLY_WORDS.priced : APPLY_WORDS.open;

/** The face of a person as a sticker: a ring of the page's own white and the one soft shadow of the screen, round whatever is put in it (a photo or the initials). */
function StickerFace({ photo, initials }: { photo?: ReactNode; initials: string | null }) {
  return <View style={s.sticker}><View style={s.stickerFace}>{photo ?? <Avatar initials={initials} size={FACE} />}</View></View>;
}

/**
 * Who posted it: the one record of the page, the only thing on it that casts a shadow because it is the only thing that is touched (owner, 8 Oct 2026, "Objavio
 * kao kartica poverenja"). A face of 56 as a sticker, the name, the rating with its star, and how reliably the person comes as agreed, only when the server says so
 * (`reliabilityPercent`, from the public work-trust read; nothing is drawn, and nothing is said about what is hidden, when it is not given). Pressing it opens
 * their public profile. A refusal of the safety entry (the one place a person is reported or blocked from) is said under the record, politely, so a screen
 * reader hears it without losing its place.
 */
export function TaskDecisionPublisher({ name, rating, count, reliabilityPercent, photo, initials, onPress, disabled = false, error }: {
  name: string; rating: string | null | undefined; count: number | null | undefined;
  /** "Dolazi kako je dogovoreno": the server's percentage for this person, or nothing. */ reliabilityPercent?: number | null;
  photo?: ReactNode; initials: string | null; onPress?: () => void; disabled?: boolean; error?: string | null;
}) {
  const trust = publisherTrust(rating, count);
  const reliability = typeof reliabilityPercent === 'number' && Number.isFinite(reliabilityPercent) ? `${RELIABILITY_LABEL} · ${Math.round(reliabilityPercent)}%` : null;
  const pressable = !!onPress && !disabled;
  return <Section title="Objavio">
    <Surface kind="record" onPress={pressable ? onPress : undefined} accessibilityLabel={[name, publisherRatingLine(rating, count), reliability].filter(Boolean).join(', ')}
      accessibilityHint={pressable ? 'Otvara javni profil' : undefined}>
      <View style={s.person}>
        <StickerFace photo={photo} initials={initials} />
        <View style={s.personText}>
          <T variant="bodyStrong" style={s.ink}>{name}</T>
          <View style={s.trustRow}>
            {trust.star ? <FactArt kind="star" size={16} /> : null}
            <T variant="note" tone="muted" style={s.tabular}>{trust.text}</T>
          </View>
          {reliability ? <T variant="note" style={s.reliability}>{reliability}</T> : null}
        </View>
        {onPress ? <Glyph name="caret-right" size={20} tone="muted" /> : null}
      </View>
    </Surface>
    {error ? <T accessibilityLiveRegion="polite" variant="note" tone="danger" style={s.refusal}>{error}</T> : null}
  </Section>;
}

/** The face's own size, and the sticker's ring around it. */
const FACE = 56;
const RING = 2;

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  price: { gap: sys.space.xs },
  facts: { gap: layout.group },
  requirements: { gap: layout.group },
  refusal: { paddingTop: sys.space.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  personText: { flex: 1, minWidth: 0, gap: sys.space.xs },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  reliability: { color: sys.color.fact },
  sticker: { width: FACE + 2 * RING, height: FACE + 2 * RING, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center',
    ...sys.elevation.card },
  stickerFace: { width: FACE, height: FACE, borderRadius: sys.radius.pill, overflow: 'hidden' },
});
