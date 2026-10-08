import { useState, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { FactRow } from '../system/FactRow';
import { KeyValueRow } from '../system/KeyValueRow';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Screen } from '../system/Screen';
import { Section, type SectionAction } from '../system/Section';
import { SuccessMark } from '../system/SuccessMark';
import { Surface } from '../system/Surface';
import { useLayoutClass } from '../system/textScale';
import { brandAction, field, sys } from '../system/tokens';
import { CardTitle, CardValue, WaitingDot, valueSpoken, type TaskValue } from '../v2/TaskFace';
import { LocationMapPreview } from '../location/LocationMapPreview';
import { AuthorizedPhoto } from '../media/AuthorizedPhoto';
import type { Summary } from '../v2/draftSummary';
import type { PublicAnchor } from './reviewFacts';

/**
 * The parts of the publish review (/pregled-zadatka), drawings only: the route owns every command, guard and read, and
 * the design gallery (/dizajn-objava) draws the same parts from fixtures. The review is the moment of truth: the task as
 * others will see it, what still stands in the way, the place split into what everybody sees and what only a Dogovor
 * reveals, the photos, the deadline, and one green "Objavi zadatak".
 *
 * It stands on the one grid (composition spec 2026-10-07, 4.6): the screen is a `Screen kind="flow"` with its one foot, every part
 * is a `Section` (a name, 12 below it, 24 from the next, never a line), every fact a `KeyValueRow` or a `ListRow` whose divider
 * begins at its words, and the one container is the `panel` of the task itself. An action of a part (Uredi mesto, Izmeni) is a word at
 * the end of its line; while the screen cannot act (a save is running, an edit is open, an outcome is not read yet) those words are
 * not drawn at all, so the one open thing is the only thing that can be pressed and nothing looks pressable that is not.
 */

/**
 * The frame of the review: `Screen kind="flow"` with its bar and its one foot, and, inside it, the scroll of the parts. `Screen` draws the
 * measure of every screen (the edge `layout.gutter`, 8 under the bar, `layout.section` between the parts and above the foot), but gives no
 * reference to its scroll, and an open correction has to scroll its row into view (`scrollRef`, `contentRef`). So the review turns `Screen`'s
 * own measure off (`reset`) and draws the same numbers around the scroll it holds (F8: a `scrollRef` on `Screen` takes this back, and this
 * is the one place to change).
 */
export function ReviewFrame({ header, footer, scrollRef, contentRef, children }: { header: ReactNode; footer?: ReactNode;
  scrollRef?: Ref<ScrollView>; contentRef?: Ref<View>; children: ReactNode }) {
  return <Screen kind="flow" scroll={false} contentStyle={frame.reset} header={header} footer={footer}>
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" style={frame.fill} contentContainerStyle={frame.content}>
      <View ref={contentRef} style={frame.stack}>{children}</View>
    </ScrollView>
  </Screen>;
}

/**
 * What the stored command ended in, said once at the top, in a note. Only a publication confirmed here and now springs. `action` is the one
 * way to check what the note says is not known ("Proveri", the one word of the app's vocabulary of trouble), drawn inside the note it belongs to.
 */
export function ReviewStatus({ published, fresh, text, action }: { published: boolean; fresh: boolean; text: string; action?: ReactNode }) {
  return <Surface kind="note">
    {/* The action stands in the sentence's own column, so a quiet button starts where the words start; with one the icon stands at the first line. */}
    <View style={[s.statusRow, action ? s.statusRowTop : null]}>
      {published ? <SuccessMark fresh={fresh} size={40} /> : <FactArt kind="info" size={24} />}
      <View style={s.statusText}>
        <T accessibilityLiveRegion="polite" variant="body">{text}</T>
        {action}
      </View>
    </View>
  </Surface>;
}

/**
 * The task as others will see it: the task card's own parts (the whole title, the value, where, when, how many people), bare on one
 * `panel`. It is read, not pressed, so it has the frame and no shadow, and it is heard once as a whole. The description and the photos
 * are not repeated here: photos appear only inside a task's detail (owner decision 10, 2026-09-24). The card leads the review with no
 * caption above it ("Ovako će drugi videti zadatak" was a sentence about where the person is, plan 2.17): the card is the task as it
 * will look, and the bar already says "Pregled zadatka". The title is whole, never cut with an ellipsis: this is the moment to read what
 * is about to be published (owner's phone, 2026-10-07: "Prevoz od Petrovaradina do centra No…"). Changing the title is a row of "Detalji",
 * like every other fact, and not a button of its own under the card.
 */
export function ReviewPreview({ summary, unpriced }: { summary: Summary; unpriced: boolean }) {
  const { stacked } = useLayoutClass();
  const value: TaskValue | null = summary.value ?? (unpriced ? { kind: 'unpriced' } : null);
  const spoken = [summary.title, value ? valueSpoken(value) : null, summary.zone || null, summary.schedule ?? null, summary.people]
    .filter(Boolean).join(', ');
  return <Surface kind="panel" accessibilityLabel={spoken || 'Zadatak još nema javnih podataka'}>
    <View style={s.preview}>
      {summary.title || value ? <View style={stacked ? s.headStacked : s.head}>
        {summary.title ? <CardTitle title={summary.title} lines={0} style={!stacked && s.titleSide} /> : null}
        {value ? <CardValue value={value} large={stacked} /> : null}
      </View> : null}
      {summary.zone ? <FactRow art={summary.zone === 'Na daljinu' ? 'remote' : 'pin'} value={summary.zone} /> : null}
      {summary.schedule ? <FactRow art="calendar" value={summary.schedule} /> : null}
      {summary.people ? <FactRow art="users" value={summary.people} /> : null}
    </View>
  </Surface>;
}

/** `actionLabel` is the word of the way out ("Izmeni termin"), drawn under the sentence so the row reads as the button it is. */
export type TodoRow = { key: string; text: string; onPress?: () => void; actionLabel?: string };

/**
 * "Još treba": each blocker as a row with the orange dot (the screen's one accent), its sentence and, where a tap leads to the fix, the
 * word of that fix under it and the arrow ("Dopuni u razgovoru ›"). A row that leads nowhere has no arrow and no press: nothing here looks
 * like a link and goes nowhere (owner's phone, 2026-10-07: a sentence with a faint arrow beside a grey publish was not read as a button, so
 * the way out is said in words and the row is the one a touch is meant for).
 */
export function ReviewTodoList({ items, disabled, children }: { items: readonly TodoRow[]; disabled: boolean; children?: ReactNode }) {
  return <Section title="Još treba">
    {items.map((item, index) => <ListRow key={item.key} leading={<WaitingDot />} title={item.text}
      subtitle={item.onPress ? item.actionLabel : undefined} accessibilityLabel={item.onPress ? item.text : undefined}
      accessibilityHint={item.onPress ? item.actionLabel : undefined} disabled={disabled && !!item.onPress}
      onPress={item.onPress} last={index === items.length - 1 && !children} />)}
    {children}
  </Section>;
}

/**
 * A part of the review: its name, and at most one word at the end of that line that changes what the part holds. `spaced` parts hold
 * two blocks that the space parts (the place: what everybody sees, what only a Dogovor reveals); rows draw their own dividers.
 */
export function ReviewSection({ title, action, spaced = false, children }: { title: string; action?: SectionAction | null; spaced?: boolean; children?: ReactNode }) {
  return <Section title={title} action={action ?? undefined}>
    {spaced ? <View style={s.spaced}>{children}</View> : children}
  </Section>;
}

/** One of the two halves of the place: what everybody sees, and what only a Dogovor reveals. */
export function PlaceGroup({ kind, children }: { kind: 'public' | 'private'; children: ReactNode }) {
  return <View style={s.group}>
    <View style={s.groupHead}>
      <FactArt kind={kind === 'public' ? 'eye' : 'lock'} size={24} />
      <T variant="bodyStrong" accessibilityRole="header" style={s.ink}>{kind === 'public' ? 'Vide svi' : 'Privatni podaci'}</T>
    </View>
    {children}
  </View>;
}

/**
 * The public place: the area line, the route's stops, and the approximate point the public map will show (never the
 * exact one). With no confirmed point there is no map and no invented point.
 */
export function PublicPlace({ zone, lines, anchor, scopeKey, pointsConfirmed }: { zone: string | null; lines: readonly string[];
  anchor: PublicAnchor | null; scopeKey: string; /** Any exact point is confirmed: the privacy sentence belongs to it. */ pointsConfirmed?: boolean }) {
  return <PlaceGroup kind="public">
    <T variant="body">{zone || 'Mesto još nije navedeno.'}</T>
    {lines.map((line, index) => <T key={index} variant="note" tone="muted">{line}</T>)}
    {anchor ? <LocationMapPreview points={[{ id: 'public-area', label: zone || 'Približno mesto', ...anchor }]}
      coarse height={160} scopeKey={scopeKey} /> : null}
    {anchor || pointsConfirmed ? <T variant="note" tone="muted">Na javnoj mapi prikazuje se približno područje. Tačne tačke ostaju privatne.</T> : null}
  </PlaceGroup>;
}

/** The private half of the place, with the privacy sentence word for word. */
export function PrivatePlace({ children }: { children: ReactNode }) {
  return <PlaceGroup kind="private">
    <T variant="note" tone="muted">Ovi podaci nisu deo javnog zadatka. Pristup ostaje prema pravilima Dogovora.</T>
    <View>{children}</View>
  </PlaceGroup>;
}

/**
 * The places the owner CONFIRMED, as short lines at the top of the private half: street and number, then the place ("Pavla Ivića 6,
 * Novi Sad"). Several places name their role. The words are the confirmed points' own (`ownerPlaceLines`), so a pin moved after the
 * first text is what is read here; the long rows under them keep the whole address. Private: never drawn in the public half.
 */
export function OwnerPlaces({ places }: { places: readonly { slot: string; title: string; text: string }[] }) {
  if (!places.length) return null;
  const named = places.length > 1;
  return <View style={s.ownerPlaces}>
    {places.map(place => <View key={place.slot} accessible accessibilityLabel={named ? `${place.title}: ${place.text}` : place.text} style={s.ownerPlace}>
      {named ? <T variant="meta" tone="muted">{place.title}</T> : null}
      <T variant="bodyStrong" style={s.ink}>{place.text}</T>
    </View>)}
  </View>;
}

/**
 * The ways out of a review that is not published yet, at the end of it, after everything there is to change (owner, 2026-10-07: "when
 * the user arrives at this review there is no easy way to delete it or edit it; to go back to the chat to edit it - at least I do not see
 * that function easily"). They are two rows of the page and not two more buttons in its foot, where the green "Objavi zadatak" and "Sačuvaj
 * nacrt" are the whole of what can be decided: "Izmeni zadatak" returns to the conversation, which keeps the draft, and, last and in the
 * danger colour, "Obriši nacrt" deletes it after a question. `onDelete` is left out where there is no draft to delete (the changes of a task
 * that exists).
 */
export function ReviewWaysOut({ onEdit, onDelete, disabled }: { onEdit: () => void; onDelete?: () => void; disabled: boolean }) {
  return <Section>
    <ListRow leading={<FactArt kind="chat" size={32} />} title="Izmeni zadatak" subtitle="Vrati se u razgovor. Nacrt ostaje sačuvan."
      accessibilityLabel="Izmeni zadatak" disabled={disabled} last={!onDelete} onPress={onEdit} />
    {onDelete ? <ListRow leading={<FactArt kind="document" size={32} />} title="Obriši nacrt" accessibilityLabel="Obriši nacrt" tone="danger" disabled={disabled} last
      onPress={onDelete} /> : null}
  </Section>;
}

/** The photos as square tiles, three to a row, or one quiet line when there are none. */
export function ReviewPhotos({ assetIds, picture }: { assetIds: readonly string[];
  /** The design gallery's stand-in for a photo, so it reads nothing. */ picture?: (index: number, size: number) => ReactNode }) {
  // Three tiles and two 8 px gaps fill the width exactly; a percentage width wrapped the third tile at 320 dp.
  const [width, setWidth] = useState(0);
  const tile = width ? Math.floor((width - 2 * sys.space.sm) / 3) : 0;
  return assetIds.length ? <View style={s.photoGrid} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {tile ? assetIds.map((assetId, i) => picture ? <View key={assetId}>{picture(i, tile)}</View>
      : <AuthorizedPhoto key={assetId} assetId={assetId} label={`Fotografija zadatka ${i + 1}`} contentFit="cover" style={{ width: tile, aspectRatio: 1 }}
        // A small tile has no room for the sentence: the muted picture alone, and the sentence for a screen reader.
        unavailable={<View accessible accessibilityLabel="Fotografija trenutno nije dostupna." style={s.photoMissing}>
          <FactArt kind="photo" size={24} muted /></View>} />) : null}
  </View> : <T variant="note" tone="muted">Fotografije nisu dodate.</T>;
}

/** When applications close: the deadline in Serbian time, or the rule when there is none. */
export function ReviewDeadline({ text }: { text: string | null }) {
  // The rule for a task with a fixed time belongs to "no deadline"; with a deadline set, the deadline says it.
  return <View style={s.deadline}>
    <T variant="body">{text ? `Rok: ${text}` : 'Bez posebnog roka — do popune ili dok ne zaustaviš potragu.'}</T>
    {text ? null : <T variant="note" tone="muted">Zadatak sa tačnim terminom se zatvara kad termin prođe.</T>}
  </View>;
}

/**
 * One fact's row: its label and its value, and a word "Izmeni" at the end of the row (`KeyValueRow`: beside the label when the value is short
 * and the text ordinary, under it when it is long or the text is large). While an edit is open the row is its editor (`children`): the label,
 * then the field and its commands, and nothing else of the row.
 */
export function ReviewFactRow({ label, value, system, edit, children, rowRef, last = false }: {
  label: string; value: string; system: boolean; edit?: () => void;
  /** An open correction: replaces the value with its editor. */ children?: ReactNode;
  rowRef?: (node: View | null) => void; /** The last row of its group: no divider under it. */ last?: boolean;
}) {
  if (children) return <View ref={rowRef} collapsable={false} style={s.editing}>
    <T variant="meta" tone="muted">{label}</T>
    {children}
  </View>;
  // A value the system chose says so under it, in the same quiet words, so it is not read as the owner's own.
  const shown = system ? <View><T variant="body">{value}</T><T variant="meta" tone="muted">Podrazumevana vrednost</T></View> : value;
  return <View ref={rowRef} collapsable={false}>
    <KeyValueRow label={label} value={shown} action={edit ? { label: 'Izmeni', onPress: edit } : undefined} last={last} />
  </View>;
}

/** The facts with nothing in them, named in one line of the same list ("Nije navedeno · Alati · Vozila · Prikaži"); "Prikaži" opens them as rows. */
export function ReviewEmptyFacts({ labels, onOpen, last = true }: { labels: readonly string[]; onOpen: () => void; last?: boolean }) {
  return <KeyValueRow label="Nije navedeno" value={labels.join(' · ')} action={{ label: 'Prikaži', onPress: onOpen }} last={last} />;
}

/**
 * The one brand action of the review. Its states are the V2Action states: at work it keeps its green and its words with
 * a spinner before them; unavailable it is the quiet wash with muted words, never a faded copy of the live button. Why it is grey is
 * said in the foot (`FlowFooter reason`), above it; here it is only its spoken hint.
 */
export function PublishButton({ label, blocked, working, reason, onPress }: { label: string; blocked: boolean; working: boolean;
  /** Why it is grey: spoken as its hint (the same line is drawn above it, in the foot). */ reason?: string | null; onPress: () => void }) {
  const resting = blocked && !working;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={resting && reason ? reason : undefined} disabled={blocked}
    accessibilityState={working ? { disabled: true, busy: true } : { disabled: blocked }} onPress={onPress}
    style={[s.publish, resting && s.publishResting]}>
    {working ? <ActivityIndicator color={sys.color.onGreen} /> : null}
    <T style={[s.publishLabel, resting && s.publishLabelResting]}>{label}</T>
  </Press>;
}

/** What the route draws around the parts: the field of an open correction, the sentence of an error, and the one note of a failure. */
export const reviewStyles = StyleSheet.create({
  error: { ...sys.type.meta, color: sys.color.danger },
  // The editor's text field: the app's one field (its green outline was the loudest line of the review, 2026-09-24).
  input: { ...field, minHeight: 56, paddingVertical: sys.space.md },
  warnText: { ...sys.type.note, color: sys.color.warn },
  identity: { gap: sys.space.sm, paddingTop: sys.space.sm },
});

const frame = StyleSheet.create({
  fill: { flex: 1 },
  reset: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 },
  content: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: sys.space.sm,
    paddingBottom: layout.section },
  stack: { gap: layout.section },
});

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  statusRowTop: { alignItems: 'flex-start' },
  statusText: { flex: 1, minWidth: 0, gap: sys.space.xs },
  preview: { gap: sys.space.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  headStacked: { gap: sys.space.xs },
  titleSide: { flex: 1, minWidth: 0 },
  spaced: { gap: layout.section },
  group: { gap: layout.group },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  ownerPlaces: { gap: sys.space.sm },
  ownerPlace: { gap: sys.space.xs },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  photoMissing: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  deadline: { gap: sys.space.xs },
  editing: { paddingVertical: sys.space.md, gap: sys.space.sm },
  publish: { ...brandAction, flexDirection: 'row', gap: sys.space.sm, alignItems: 'center', justifyContent: 'center', padding: sys.space.md },
  // Shrinks and wraps beside the spinner rather than running out of the button ("Potvrdi izmene i objavi" at 320 dp
  // with large text).
  publishLabel: { ...sys.type.body, fontWeight: '700', color: sys.color.onGreen, flexShrink: 1, textAlign: 'center' },
  publishResting: { backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.line },
  publishLabelResting: { color: sys.color.muted },
});
