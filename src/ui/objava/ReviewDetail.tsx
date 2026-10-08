import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { JavniProfilProjekcija, PrilikaProjekcija } from '../../contracts/projections';
import { needGeographyRows, needRequirementRows, needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { inicijali } from '../../lib/inicijali';
import { T } from '../Text';
import { DetailDescription, DetailRoute, routeAddsToArea } from '../product/ProductDetails';
import { PhotoPages, PhotoViewer } from '../media/PhotoViewer';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { FactRow } from '../system/FactRow';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { PublicProfileSheet } from '../system/PublicProfileSheet';
import { Section } from '../system/Section';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { TaskDecisionPublisher, TaskDecisionTitle, TaskDecisionValue } from '../v2/detail/TaskDecision';
import { placesText, taskPlace } from '../v2/TaskFace';
import { EditPencil, PencilOverPhoto, type PartPencil } from './EditPencil';
import { deadlineWords, type AddressFrame } from './reviewFacts';

/**
 * The task as the people who open it will read it, with the owner's pencils on it (owner, 8 Oct 2026: "pregled zadatka pre objave treba da
 * bude kao detaljan pregled zadatka, a ne da bude taksativno"). It is the page of a task somebody else posted (`PublicNeedPresentation`) in
 * the same order and in the same words, made from the same parts (`TaskDecision*`, `DetailDescription`, the approximate map), over the
 * projection the review is made into (`reviewAsTask`): the photos, the name, what it pays, where, when and how many people, who asks,
 * what the work is, what it asks, where it is, until when people may apply. `review-detail-parity.test` holds the two pages to the
 * same words, so a change of the published page cannot leave this one behind.
 *
 * What is the owner's alone is added to it and nothing else: a pencil at the end of each part (the correction of exactly that fact, in
 * place, or the step that holds it), the frame of the exact address with its lock (the page of others says only where it is roughly),
 * and the way to add what the task does not say yet. The apply button, the questions and the report of a person are left out: this is not a
 * task one applies to, and the person who asks is the owner. Presentation only; the route owns every read, guard and command.
 */

/**
 * One part of the preview. `pencil` is absent while the part cannot be changed (a save is running, another correction is open, the review
 * is already accepted): nothing is drawn that cannot be pressed. `editor` is a correction that is open on this part, and it stands in
 * the place of the part, which is read again when the correction ends. `note` is a quiet word under the part (the system chose its value).
 */
export type PreviewPart = { pencil?: PartPencil; editor?: ReactNode; note?: string };
export const NO_PART: PreviewPart = {};

/** What the preview needs to say who asks: the owner as the others read him, and the public profile the sheet of his face opens. */
export type DetailPerson = Readonly<{
  profileId: string; name: string; rating: string | null; reviewCount: number | null; profile: JavniProfilProjekcija | null;
  /** His authorized portrait at the size asked for; without it the initials stand in. */
  photo?: (profileId: string, size?: number) => ReactNode;
}>;

export type ReviewDetailParts = Readonly<{
  title: PreviewPart; value: PreviewPart; place: PreviewPart; time: PreviewPart; people: PreviewPart; description: PreviewPart;
  /** The approximate place, as a section of its own. */
  map: PreviewPart;
  deadline: PreviewPart;
  /** The requirement lines by the name the detail gives them ("Alat", "Najmanje iskustva"). */
  requirements: Readonly<Record<string, PreviewPart>>;
}>;

/** The picture of each requirement line, as the page of others draws it (`TaskDecisionRequirements`); the parity test holds the two together. */
export const REQUIREMENT_ART: Readonly<Record<string, FactArtKind>> = {
  'Veštine': 'tool', 'Alat': 'tool', 'Vozilo': 'vehicle', 'Dozvole': 'document', 'Bitni uslovi': 'info',
  'Najmanje iskustva': 'star', 'Identitet': 'shield', 'Uslovi': 'document',
};
/** The values of a requirement line, one to a line: a bulleted list loses its bullets (the picture is the mark), a sentence stays one. */
export function requirementValues(value: string): string {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every(line => /^[•\-–]\s*/.test(line)) ? lines.map(line => line.replace(/^[•\-–]\s*/, '')).filter(Boolean).join('\n') : value;
}

const noop = () => undefined;

export function ReviewDetail({ need, parts, photos, map, address, more, person }: {
  need: PrilikaProjekcija; parts: ReviewDetailParts;
  /** The photos, which lead the page of others: the gallery of the draft's photos, or the owner's way to add them. */
  photos?: ReactNode;
  /** The approximate map (the public one), which the route builds because a map has a focus-bound lifetime. */
  map?: ReactNode;
  /** The frame of the exact address (`OwnerAddress`): the owner's, and nobody's else. */
  address?: ReactNode;
  /** What can still be added to the task (`ReviewMoreFacts`). */
  more?: ReactNode;
  person?: DetailPerson | null;
}) {
  const place = taskPlace(need);
  const time = need.schedule ? needScheduleText(need.schedule, need.taskTimezone) : need.vremeTekst;
  const people = placesText(need.pokrivenost, 'worker');
  // How many people it needs is a fact only when it is more than one (or all the places are taken), as on the page of others.
  const showPeople = need.pokrivenost.ukupno > 1 || need.pokrivenost.preostalo <= 0;
  const remote = need.detalji?.rezimLokacije === 'REMOTE';
  const moves = !!need.detalji?.geografija && need.detalji.geografija.mode !== 'STATIONARY' && !remote;
  const stops = moves && routeAddsToArea(needGeographyRows(need), need.podrucjeTekst) ? needGeographyRows(need) : [];
  const requirements = needRequirementRows(need);
  return <View testID="review-detail" style={s.detail}>
    {photos}
    <View>
      <PartRow part={parts.title}><TaskDecisionTitle onLayout={noop}>{readableTitle(need.naslov)}</TaskDecisionTitle></PartRow>
      <PartRow part={parts.value}><TaskDecisionValue need={need} /></PartRow>
      <PartRow part={parts.place}><FactRow size="detail" art={place.remote ? 'remote' : 'pin'} value={place.text} /></PartRow>
      <PartRow part={parts.time}><FactRow size="detail" art="calendar" value={time} /></PartRow>
      {showPeople ? <PartRow part={parts.people}><FactRow size="detail" art="users" value={people.text} /></PartRow> : null}
    </View>
    {person ? <Publisher person={person} /> : null}
    {need.opis ? <PartSection title="O zadatku" part={parts.description}><DetailDescription text={need.opis} /></PartSection> : null}
    {requirements.length ? <Section title="Važno za ovaj zadatak">
      <View>{requirements.map((row, index) => <PartRow key={`${row.label}:${index}`} part={parts.requirements[row.label] ?? NO_PART}>
        <FactRow size="detail" art={REQUIREMENT_ART[row.label] ?? 'document'} value={requirementValues(row.value)} note={row.label} />
      </PartRow>)}</View>
    </Section> : null}
    {more}
    {!remote && (map || stops.length) ? <PartSection title="Približno mesto" part={parts.map}>
      <View style={s.stack}>{map}{stops.length ? <DetailRoute rows={stops} /> : null}</View>
    </PartSection> : null}
    {address}
    <PartSection title="Prijave" part={parts.deadline}><T variant="body">{deadlineWords(need.rokZaPrijaveIso ?? null)}</T></PartSection>
  </View>;
}

/** One line of the task and its pencil: the line takes the room, the pencil is the touch at its end. */
function PartRow({ part, children }: { part: PreviewPart; children: ReactNode }) {
  if (part.editor) return <>{part.editor}</>;
  return <View style={s.part}>
    <View style={s.partBody}>
      {children}
      {part.note ? <T variant="meta" tone="muted">{part.note}</T> : null}
    </View>
    {part.pencil ? <EditPencil pencil={part.pencil} /> : null}
  </View>;
}

/**
 * A section of the page with its name and, at the end of that line, its pencil. The line is a touch of 48 dp when there is a pencil, and
 * it pulls up 12 dp into the gap above it so the name stays where it would be without one (as `Section` does with its own command).
 */
function PartSection({ title, part, children }: { title: string; part: PreviewPart; children: ReactNode }) {
  const pencil = !part.editor && part.pencil ? part.pencil : null;
  return <View style={pencil ? s.pulled : undefined}>
    <View style={[s.heading, pencil ? s.headingTouch : s.headingPlain]}>
      <T variant="heading" accessibilityRole="header" style={s.headingText}>{title}</T>
      {pencil ? <EditPencil pencil={pencil} /> : null}
    </View>
    {part.editor ?? children}
    {!part.editor && part.note ? <T variant="meta" tone="muted">{part.note}</T> : null}
  </View>;
}

/**
 * "Objavio": the owner as the others read him, in the same record as on the page of others. It opens his public profile, the sheet
 * that shows him as everyone sees him, when that read was made; without it the record is only read (and draws no arrow).
 */
function Publisher({ person }: { person: DetailPerson }) {
  const [open, setOpen] = useState(false);
  // Leaving the screen takes the sheet with it.
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  const name = person.name.trim();
  if (!name) return null;
  return <>
    <TaskDecisionPublisher name={name} rating={person.rating} count={person.reviewCount} initials={inicijali(name)}
      photo={person.photo?.(person.profileId, 56)} onPress={person.profile ? () => setOpen(true) : undefined} />
    {person.profile ? <PublicProfileSheet state={open ? { loading: false, data: person.profile } : null} onClose={() => setOpen(false)}
      onRetry={() => setOpen(false)} photo={person.photo} /> : null}
  </>;
}

/**
 * The frame of the exact address: the owner's, and nobody's else until a Dogovor (the page of others says only where the place is roughly).
 * The lock, what he confirmed in his own short words, the address as it was stored when it says more, what he wrote about getting in, the
 * exact map when there is one, and the ONE sentence of privacy this review has. One pencil, which opens the step that holds all of it.
 */
export function OwnerAddress({ frame, map, part }: { frame: AddressFrame; map?: ReactNode; part: PreviewPart }) {
  const named = frame.places.length > 1;
  const pencil = part.pencil ?? null;
  return <Surface kind="panel">
    <View style={s.frame}>
      <View style={s.frameHead}>
        <View style={s.frameTitle}>
          <FactArt kind="lock" size={24} />
          <T variant="bodyStrong" accessibilityRole="header" style={s.headingText}>Tačna adresa</T>
        </View>
        {pencil ? <EditPencil pencil={pencil} /> : null}
      </View>
      {frame.places.map(place => <View key={place.slot} accessible accessibilityLabel={named ? `${place.title}: ${place.text}` : place.text} style={s.place}>
        {named ? <T variant="meta" tone="muted">{place.title}</T> : null}
        <T variant="bodyStrong">{place.text}</T>
      </View>)}
      {frame.fullAddress ? <T variant={frame.places.length ? 'note' : 'bodyStrong'} tone={frame.places.length ? 'muted' : 'ink'}>{frame.fullAddress}</T> : null}
      {frame.notes.map((note, index) => <T key={index} variant="note" tone="muted">{note.title ? `${note.title} · Pristup: ${note.text}` : `Pristup: ${note.text}`}</T>)}
      {frame.unconfirmed ? <T variant="note" tone="muted">{`Potvrđeno tačaka: ${frame.unconfirmed.done} od ${frame.unconfirmed.total}`}</T> : null}
      {map}
      <T variant="note" tone="muted">Vidiš samo ti. Osoba sa kojom se dogovoriš vidi je u Dogovoru.</T>
    </View>
  </Surface>;
}

/**
 * The photos of the draft as the page of others leads with them: pages of 4:3 you turn, the count at the corner when there is more than
 * one, the full-screen viewer on a touch (the very parts the published task's gallery is made of), and the owner's pencil over the
 * photograph. They are read in the owner's own context (a draft has no task to read them through), and a page that cannot be read says so
 * quietly in its place instead of a grey plate. `picture` is the design gallery's stand-in, so it reads no media.
 */
export function ReviewGallery({ assetIds, pencil, picture }: { assetIds: readonly string[]; pencil?: PartPencil;
  picture?: (index: number) => ReactNode }) {
  const [chosen, setIndex] = useState(0), [open, setOpen] = useState(false);
  const index = Math.min(chosen, Math.max(0, assetIds.length - 1));
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  const photos = assetIds.map(assetId => ({ assetId }));
  const context = {};
  return <>
    <PencilOverPhoto pencil={pencil}>
      <View style={s.gallery} accessibilityElementsHidden={open} importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}>
        {picture ? <View style={s.standIn}>{picture(index)}</View>
          : <PhotoPages context={context} photos={photos} index={index} onIndex={setIndex} onOpen={page => { setIndex(page); setOpen(true); }}
            pending={<FactArt kind="photo" size={48} />}
            unavailable={() => <View accessible accessibilityLabel="Fotografija trenutno nije dostupna." style={s.lost}><FactArt kind="photo" size={24} muted /></View>} />}
        {assetIds.length > 1 ? <View pointerEvents="none" style={s.overlay}>
          <View style={s.counter}>
            <T variant="meta" accessibilityLabel={`Fotografija ${index + 1} od ${assetIds.length}`}>{`${index + 1} / ${assetIds.length}`}</T>
          </View>
        </View> : null}
      </View>
    </PencilOverPhoto>
    {open && !picture ? <PhotoViewer context={context} photos={photos} index={index} onIndex={setIndex} onClose={() => setOpen(false)} /> : null}
  </>;
}

/** A draft with no photos: the page of others draws none, so the owner is offered the way to add them, as a row of his own. */
export function AddPhotos({ pencil, title = 'Dodaj fotografije' }: { pencil?: PartPencil; title?: string }) {
  if (!pencil) return null;
  return <ListRow leading={<FactArt kind="photo" size={32} />} title={title} accessibilityLabel={pencil.label} last onPress={pencil.onPress} />;
}

const s = StyleSheet.create({
  detail: { gap: layout.section },
  // The first line of a part stands on its pencil: 8 above a 28 picture or a 33 line, in a 48 touch.
  part: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  partBody: { flex: 1, minWidth: 0, minHeight: layout.touch, paddingTop: sys.space.sm },
  place: { gap: sys.space.xs },
  stack: { gap: sys.space.md },
  pulled: { marginTop: -sys.space.md },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: layout.group },
  headingPlain: { marginBottom: layout.group },
  headingTouch: { minHeight: layout.touch },
  headingText: { flexShrink: 1, color: sys.color.ink },
  frame: { gap: sys.space.sm },
  frameHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: layout.group },
  frameTitle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  gallery: { borderRadius: sys.radius.cardCompact, overflow: 'hidden' },
  standIn: { width: '100%', aspectRatio: 4 / 3 },
  lost: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', bottom: sys.space.md, right: sys.space.md },
  counter: { minHeight: 32, justifyContent: 'center', paddingHorizontal: sys.space.md, paddingVertical: sys.space.xs, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface },
});
