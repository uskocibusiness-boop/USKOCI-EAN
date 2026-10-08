import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { PrilikaProjekcija } from '../../../contracts/projections';
import { needScheduleText } from '../../../data/needDetailPresentation';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import type { FactArtKind } from '../../system/FactArt';
import { FactRow } from '../../system/FactRow';
import { layout } from '../../system/layout';
import { ListRow } from '../../system/ListRow';
import { osoba, plural } from '../../system/plural';
import { Section } from '../../system/Section';
import { sys } from '../../system/tokens';
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
 * A rating with how many reviews it stands on (UX plan 2.11, R27): "Ocena 4,7 · 3 ocene", "Još nema ocena" for none, "Ocena 4,7" when the
 * read does not say how many, and "Ocena nije dostupna" when it says nothing. The count is never guessed, so one review cannot pass for fifty.
 */
export function publisherRatingLine(rating: string | null | undefined, count: number | null | undefined): string {
  if (count === 0) return 'Još nema ocena';
  if (!rating) return 'Ocena nije dostupna';
  return typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? `Ocena ${rating} · ${plural(count, 'ocena', 'ocene', 'ocena')}` : `Ocena ${rating}`;
}

/**
 * Who posted it: the main person of the page, a row with a face of 56. Pressing it opens their public profile. A refusal of the safety entry
 * (the one place a person is reported or blocked from) is said under the row, politely, so a screen reader hears it without losing its place.
 */
export function TaskDecisionPublisher({ name, rating, photo, initials, onPress, disabled = false, error }: {
  name: string; /** From `publisherRatingLine`. */ rating: string; photo?: ReactNode; initials: string | null; onPress?: () => void; disabled?: boolean;
  error?: string | null;
}) {
  return <Section title="Objavio">
    <ListRow faceSlot last leading={photo ?? <Avatar initials={initials} size={56} />} title={name} subtitle={rating}
      onPress={onPress} disabled={disabled && !!onPress} accessibilityLabel={`${name}, ${rating}`} accessibilityHint={onPress ? 'Otvara javni profil' : undefined} />
    {error ? <T accessibilityLiveRegion="polite" variant="note" tone="danger" style={s.refusal}>{error}</T> : null}
  </Section>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  price: { gap: sys.space.xs },
  facts: { gap: layout.group },
  requirements: { gap: layout.group },
  refusal: { paddingTop: sys.space.sm },
});
