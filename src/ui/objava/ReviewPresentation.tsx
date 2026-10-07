import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { SuccessMark } from '../system/SuccessMark';
import { TurningCaret } from '../system/Disclosure';
import { brandAction, cardCompact, field, inset, sys } from '../system/tokens';
import { CardFact, CardTitle, CardValue, WaitingDot, valueSpoken, type TaskValue } from '../v2/TaskFace';
import { V2Action } from '../v2/V2Action';
import { LocationMapPreview } from '../location/LocationMapPreview';
import { AuthorizedPhoto } from '../media/AuthorizedPhoto';
import type { Summary } from '../v2/draftSummary';
import type { PublicAnchor } from './reviewFacts';

/**
 * The parts of the publish review (/pregled-zadatka), drawings only: the route owns every command, guard and read, and
 * the design gallery (/dizajn-objava) draws the same parts from fixtures. The review is the moment of truth: the task as
 * others will see it, what still stands in the way, the place split into what everybody sees and what only a Dogovor
 * reveals, the photos, the deadline, and one green "Objavi zadatak".
 */

/** What the stored command ended in, said once at the top. Only a publication confirmed here and now springs. */
export function ReviewStatus({ published, fresh, text }: { published: boolean; fresh: boolean; text: string }) {
  if (published) return <View style={[s.status, s.statusDone]}>
    <SuccessMark fresh={fresh} size={40} />
    <T accessibilityLiveRegion="polite" variant="body" style={s.grow}>{text}</T>
  </View>;
  return <View style={[s.status, s.statusQuiet]}>
    <FactArt kind="info" size={20} />
    <T accessibilityLiveRegion="polite" variant="body" style={s.grow}>{text}</T>
  </View>;
}

/**
 * The task as others will see it: the task card's own parts (title with the value slot, where, when, how many people),
 * bare on one compact card. Not a target; it is heard once as a whole. The description and the photos are not repeated
 * here: photos appear only inside a task's detail (owner decision 10, 2026-09-24). The card leads the review with no caption
 * above it ("Ovako će drugi videti zadatak" was a sentence about where the person is, plan 2.17): the card is the task as it
 * will look, and the bar already says "Pregled zadatka". The title is whole, never cut with an ellipsis: this is the moment to read
 * what is about to be published (owner's phone, 2026-10-07: "Prevoz od Petrovaradina do centra No…").
 */
export function ReviewPreview({ summary, unpriced, large, action }: { summary: Summary; unpriced: boolean; large: boolean;
  /** One quiet correction under the card ("Izmeni naslov"). */ action?: ReactNode }) {
  const value: TaskValue | null = summary.value ?? (unpriced ? { kind: 'unpriced' } : null);
  const spoken = [summary.title, value ? valueSpoken(value) : null, summary.zone || null, summary.schedule ?? null, summary.people]
    .filter(Boolean).join(', ');
  return <View style={s.section}>
    <View style={s.card} accessible accessibilityLabel={spoken || 'Zadatak još nema javnih podataka'}>
      {summary.title || value ? <View style={large ? s.headStacked : s.head}>
        {summary.title ? <CardTitle title={summary.title} lines={0} style={!large && s.titleSide} /> : null}
        {value ? <CardValue value={value} large={large} /> : null}
      </View> : null}
      {summary.zone ? <CardFact art={<FactArt kind={summary.zone === 'Na daljinu' ? 'remote' : 'pin'} size={16} />} text={summary.zone} /> : null}
      {summary.schedule ? <CardFact art={<FactArt kind="calendar" size={16} />} text={summary.schedule} lines={2} /> : null}
      {summary.people ? <CardFact art={<FactArt kind="users" size={16} />} text={summary.people} /> : null}
    </View>
    {action ? <View style={s.previewAction}>{action}</View> : null}
  </View>;
}

/** `actionLabel` is the word of the way out ("Izmeni termin"), drawn under the sentence so the row reads as the button it is. */
export type TodoRow = { key: string; text: string; onPress?: () => void; actionLabel?: string };

/**
 * "Još treba": each blocker as a white row with the orange dot, its sentence and, where a tap leads to the fix, the word of that fix in
 * the action's green with a caret (owner's phone, 2026-10-07: a sentence with a faint arrow beside a grey publish was not read as a button).
 */
export function ReviewTodoList({ items, disabled, children }: { items: readonly TodoRow[]; disabled: boolean; children?: ReactNode }) {
  return <View style={s.section}>
    <T variant="heading" accessibilityRole="header" style={s.ink}>Još treba</T>
    <View>
      {items.map(item => {
        const body = <>
          <WaitingDot />
          <View style={s.todoCopy}>
            <T variant="body">{item.text}</T>
            {item.onPress && item.actionLabel ? <T variant="action" style={disabled ? s.todoActionResting : s.todoAction}>{item.actionLabel}</T> : null}
          </View>
          {item.onPress ? <CaretRight size={18} weight="bold" color={disabled ? sys.color.muted : sys.color.green} /> : null}
        </>;
        return item.onPress ? <Press key={item.key} accessibilityRole="button" accessibilityLabel={item.text} accessibilityHint={item.actionLabel}
          accessibilityState={{ disabled }} disabled={disabled} haptic="select" scaleTo={0.99} onPress={item.onPress} style={s.todo}>{body}</Press>
          : <View key={item.key} style={s.todo}>{body}</View>;
      })}
    </View>
    {children}
  </View>;
}

/** A section of the review: its name, and at most one quiet action beside it that changes what the section holds. */
export function ReviewSection({ title, action, children }: { title: string; action?: ReactNode; children?: ReactNode }) {
  return <View style={s.section}>
    <View style={s.sectionHead}>
      <T variant="heading" accessibilityRole="header" style={[s.ink, s.grow]}>{title}</T>
      {action}
    </View>
    {children}
  </View>;
}

/** One of the two halves of the place: what everybody sees, and what only a Dogovor reveals. */
export function PlaceGroup({ kind, children }: { kind: 'public' | 'private'; children: ReactNode }) {
  return <View style={[s.group, kind === 'private' && s.groupDivided]}>
    <View style={s.groupHead}>
      <FactArt kind={kind === 'public' ? 'eye' : 'lock'} size={18} />
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
 * The ways out of a review that is not published yet, under the one green "Objavi zadatak" (owner, 2026-10-07: "when the user arrives
 * at this review there is no easy way to delete it or edit it; to go back to the chat to edit it - at least I do not see that function
 * easily"). "Izmeni zadatak" is white with a line, never green: it returns to the conversation, which keeps the draft. Under it, the
 * quiet ones: keeping the draft ("Sačuvaj nacrt") and, last and in the danger colour, deleting it ("Obriši nacrt"). Side by side
 * at an ordinary text size; one under the other at a large one, where a half of the width cannot hold a label.
 */
export function ReviewExits({ onEdit, onSave, onDelete, disabled, large }: { onEdit: () => void; onSave?: () => void; onDelete?: () => void;
  disabled: boolean; large: boolean }) {
  const beside = large ? undefined : s.exit;
  return <>
    <V2Action label="Izmeni zadatak" kind="secondary" tone="neutral" disabled={disabled} onPress={onEdit} />
    {onSave || onDelete ? <View style={large ? s.exitsStacked : s.exitsRow}>
      {onSave ? <V2Action label="Sačuvaj nacrt" kind="quiet" style={beside} disabled={disabled} onPress={onSave} /> : null}
      {onDelete ? <V2Action label="Obriši nacrt" kind="destructive" style={beside} disabled={disabled} onPress={onDelete} /> : null}
    </View> : null}
  </>;
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
  return <>
    <T variant="body">{text ? `Rok: ${text}` : 'Bez posebnog roka — do popune ili dok ne zaustaviš potragu.'}</T>
    {text ? null : <T variant="note" tone="muted">Zadatak sa tačnim terminom se zatvara kad termin prođe.</T>}
  </>;
}

/**
 * One fact's row: its label, its value (beside the label when it is short and the text is not large, under it
 * otherwise), and a 48 px "Izmeni". An open correction replaces the value with its editor (`children`).
 */
export function ReviewFactRow({ label, value, large, system, edit, editDisabled, children, rowRef }: {
  label: string; value: string; large: boolean; system: boolean;
  edit?: () => void; editDisabled: boolean; children?: ReactNode; rowRef?: (node: View | null) => void;
}) {
  const inline = !children && !large && value.length <= 16;
  return <View ref={rowRef} style={s.field}>
    <View style={s.row}><T style={[s.meta, inline ? undefined : s.grow]}>{label}</T>
      {inline ? <T selectable style={[s.body, s.inlineValue]}>{value}</T> : null}
      {edit ? <Press accessibilityRole="button" accessibilityLabel={`Izmeni: ${label}`}
        disabled={editDisabled} style={s.editButton} onPress={edit}><T style={[s.editLabel, editDisabled && s.editLabelResting]}>Izmeni</T></Press> : null}</View>
    {children ?? (inline ? null : <T selectable style={s.body}>{value}</T>)}
    {system ? <T style={s.meta}>Podrazumevana vrednost</T> : null}
  </View>;
}

/** The facts with nothing in them, named in one line that opens them. */
export function ReviewEmptyFacts({ labels, onOpen }: { labels: readonly string[]; onOpen: () => void }) {
  return <Press accessibilityRole="button" accessibilityState={{ expanded: false }} style={[s.field, s.row]}
    accessibilityLabel={`Prikaži šta nije navedeno: ${labels.join(', ')}`} onPress={onOpen}>
    <T style={[s.meta, s.grow]}>Nije navedeno: {labels.join(' · ')}</T>
    <TurningCaret open={false} />
  </Press>;
}

/**
 * The one brand action of the review. Its states are the V2Action states: at work it keeps its green and its words with
 * a spinner before them; unavailable it is the quiet wash with muted words, never a faded copy of the live button.
 */
export function PublishButton({ label, blocked, working, reason, onPress }: { label: string; blocked: boolean; working: boolean;
  /** Why it is grey: spoken as its hint (the same line is drawn under it by the caller). */ reason?: string | null; onPress: () => void }) {
  const resting = blocked && !working;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={resting && reason ? reason : undefined} disabled={blocked}
    accessibilityState={working ? { disabled: true, busy: true } : { disabled: blocked }} onPress={onPress}
    style={[s.publish, resting && s.publishResting]}>
    {working ? <ActivityIndicator color={sys.color.onGreen} /> : null}
    <T style={[s.publishLabel, resting && s.publishLabelResting]}>{label}</T>
  </Press>;
}

export const reviewStyles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.color.surface },
  content: { padding: sys.space.lg, gap: sys.space.xl, paddingBottom: sys.space.xxl },
  footer: { padding: sys.space.lg, borderTopWidth: 1, borderTopColor: sys.color.line, gap: sys.space.sm, backgroundColor: sys.color.surface },
  caption: { ...sys.type.meta, color: sys.color.muted, textAlign: 'center' },
  error: { ...sys.type.meta, color: sys.color.danger },
  input: { ...field, borderColor: sys.color.green, minHeight: 56, paddingVertical: sys.space.md },
  warn: { ...inset, backgroundColor: sys.color.warnSoft },
  warnText: { ...sys.type.note, color: sys.color.warn },
  danger: { ...inset, backgroundColor: sys.color.dangerSoft, gap: sys.space.sm },
  identity: { gap: sys.space.sm, paddingTop: sys.space.sm },
  stack: { gap: sys.space.xl },
  placeAlert: { marginHorizontal: sys.space.lg, marginTop: sys.space.sm },
});

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  grow: { flex: 1 },
  section: { gap: sys.space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, flexWrap: 'wrap' },
  status: { ...inset, padding: sys.space.base, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  statusDone: { backgroundColor: sys.color.greenSoft },
  statusQuiet: { backgroundColor: sys.color.wash },
  card: { ...cardCompact, gap: sys.space.sm },
  previewAction: { alignItems: 'flex-end' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  headStacked: { gap: sys.space.xs },
  titleSide: { flex: 1, minWidth: 0 },
  todo: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.sm,
    borderBottomWidth: 1, borderBottomColor: sys.color.line },
  group: { gap: sys.space.sm },
  groupDivided: { borderTopWidth: 1, borderTopColor: sys.color.line, paddingTop: sys.space.base },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  todoCopy: { flex: 1, gap: sys.space.xs },
  todoAction: { color: sys.color.green },
  todoActionResting: { color: sys.color.muted },
  ownerPlaces: { gap: sys.space.sm },
  ownerPlace: { gap: sys.space.xs },
  exitsRow: { flexDirection: 'row', gap: sys.space.sm },
  exitsStacked: { gap: sys.space.sm },
  exit: { flex: 1 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  photoMissing: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  meta: { ...sys.type.meta, color: sys.color.muted }, body: { ...sys.type.body, color: sys.color.ink },
  inlineValue: { flexShrink: 1, textAlign: 'right' },
  field: { borderBottomWidth: 1, borderBottomColor: sys.color.line, paddingVertical: sys.space.md, gap: sys.space.xs, minHeight: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  editButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' },
  editLabel: { ...sys.type.meta, fontWeight: '600', color: sys.color.green },
  editLabelResting: { color: sys.color.muted },
  publish: { ...brandAction, flexDirection: 'row', gap: sys.space.sm, alignItems: 'center', justifyContent: 'center', padding: sys.space.md },
  // Shrinks and wraps beside the spinner rather than running out of the button ("Potvrdi izmene i objavi" at 320 dp
  // with large text).
  publishLabel: { ...sys.type.body, fontWeight: '700', color: sys.color.onGreen, flexShrink: 1, textAlign: 'center' },
  publishResting: { backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.line },
  publishLabelResting: { color: sys.color.muted },
});
