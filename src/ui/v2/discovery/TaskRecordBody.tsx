import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NeedUrgencyProjection, Pokrivenost, StanjePotrebe } from '../../../contracts/projections';
import { isOwnedNeed, type MarketplaceItem } from '../../../data/marketplaceView';
import { needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { inicijali } from '../../../lib/inicijali';
import { displaysUrgent } from '../../../lib/needUrgency';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { FactArt } from '../../system/FactArt';
import { FACT_ROW_ART, FactRow } from '../../system/FactRow';
import { layout } from '../../system/layout';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { useUrgencyClock } from '../NeedUrgencyBadge';
import { CardStatus, CardStatusLine, REQUIREMENT_ART, VALUE_WORDS, capacityWords, personSpoken, ratingWords, taskPlace, taskRequirement, taskSpoken, taskStatus, taskValue,
  type TaskCardRelation, type TaskRequirement, type TaskValue } from '../TaskFace';
import { useTaskAge } from './taskAge';
import { distanceOf, useDistanceFrom } from './taskDistance';

/**
 * The face of a task as the Zadaci family draws it (composition spec 2026-10-07, 4.2; the owner's pick of 8 Oct 2026, "Etiketa" with his
 * note): the list's card, the pin's card on the map and, by the same words in the same order, the head of the detail. One face, so a task
 * does not change its clothes between the map, the list and the page that opens: [state] -> title -> what it pays -> where -> when ->
 * (one condition) -> how many places -> who posted it, and how long ago.
 *
 * What this account is to the task ("Tvoj", "Prijava poslata") is a small mark beside the amount or just below it, not above the title.
 * The short owner mark stays inline; worker states take their own line after the 361 dp / 1.15 phone review (9 Oct 2026); what is above the title is only HITNO and a task's own life (a draft, a closed task). The place says how far it is ("Liman, Novi Sad · oko 3 km") only
 * when that can be said (see `taskDistance`): a task's public point and the one place the person said they are, and otherwise nothing.
 *
 * The amount is a fact like the others (the owner: not the price on the right, but under the title with its picture on the left, like
 * everything else): the money picture, the sum and what it buys, the first of the fact rows. The face writes no word for what the sum is,
 * neither "cena" nor "budžet" (people know what it is); a screen reader says "Budžet 6.000 RSD ukupno". A task with no sum is the price
 * tag and its words ("Tražim ponude"), never the sum's type.
 *
 * Four type sizes and no more: the title (heading 18), the amount (16), every fact and the person (note 14), the state (12). The title
 * takes the full width, because a title and an amount side by side broke into three-line titles on the owner's 361 dp phone. Nothing is
 * invented: what the read does not say is left out. (The picked variant's reason row, "Imaš kombi", is not drawn: the list holds no work profile, and a
 * reason that is not read is not made up. How far a task is stands in the place's own line, and only when it is computed from the task's public point.) The count of people is said only when
 * the task needs more than one ("Treba 3 osobe"): a "0/1" meant nothing to the one looking for work (the owner, 8 Oct 2026).
 *
 * The body draws no card and no press of its own: the container is a `Surface record` (the list) or the pin's sheet (the map), and
 * says the whole face to a screen reader ONCE (`TaskRecordModel.spoken`), so nothing in here is a stop of its own.
 */
export type TaskRecordModel = {
  title: string;
  /** The whole state, as the sentence says it ("Tvoj zadatak"). */
  status: { text: string; quiet: boolean } | null;
  /** The part of it that is the task's own life (a draft, a closed task): it stands above the title. */
  head: { text: string; quiet: boolean } | null;
  /** What this account is to the task, in the short words of a mark ("Tvoj", "Prijava poslata"): beside the amount or on its own line below. */
  mark: { text: string; quiet: boolean } | null;
  urgency: NeedUrgencyProjection | undefined;
  /** The one clock the HITNO badge and the card read, so the two never disagree for a frame. */
  urgencyNow: number;
  urgent: boolean;
  value: TaskValue;
  /** Who reads it: a worker is told how many places are left, the owner follows the progress of the task. */
  audience: 'worker' | 'owner';
  /** The words of a task that takes offers: the worker reads the poster's own ("Tražim ponude"), the owner that they are being asked for. */
  offersWord: string;
  places: Pokrivenost;
  place: { remote: boolean; text: string };
  /** "oko 3 km" from where the person said they are ("Moja lokacija"); null where it cannot be said, and then the place says no distance. */
  distance: string | null;
  schedule: string;
  requirement: TaskRequirement | null;
  /** How many people it needs, in words; null for a task for one person (it says nothing of it). */
  capacity: { text: string; spoken: string } | null;
  /** The person who posted it; null for a task that is mine (nobody to introduce) and for a read without a name. */
  person: { name: string; rating: string | null | undefined; count: number | null | undefined } | null;
  /** "pre 2 dana", from the list that read the task; null where the time is not known (nothing is invented). */
  age: string | null;
  /** Everything the face shows, as one sentence after the command name. */
  spoken: string;
};

/**
 * The words of a task that takes offers: the poster's own ("Tražim ponude", 8 Oct 2026). The owner of the task reads the same words on the card, on the
 * pin's card and on the task's own page (the owner, 8 Oct 2026: "isto kao na detalju, ne 'Tražiš ponude'"), so a task does not change its words between them.
 */
export const OFFERS_WORD = { worker: 'Tražim ponude', owner: 'Tražim ponude' } as const;

/** The short words of the relation mark where the state's own sentence is longer; the sentence keeps its words for a screen reader. */
const MARK_WORDS: Readonly<Record<string, string>> = { 'Tvoj zadatak': 'Tvoj', 'Tvoj status nije potvrđen': 'Status nije potvrđen' };

/** What a face shows and says, from the task and what this account is to it. */
export function useTaskRecord(item: MarketplaceItem, relation?: TaskCardRelation, sectionSays?: StanjePotrebe): TaskRecordModel {
  const ownerView = isOwnedNeed(item) || relation === 'OWNED';
  const title = readableTitle(item.naslov);
  const status = taskStatus(item, relation, sectionSays);
  // A task's own life (a draft, a closed task) is above the title; what the account is to a public task follows the amount.
  const head = 'stanje' in item ? status : null;
  const mark = 'stanje' in item || !status ? null : { text: MARK_WORDS[status.text] ?? status.text, quiet: status.quiet };
  // HITNO counts only until the server's expiry, on the one clock the badge is given: an expired HITNO on a task with no state drew an empty first row.
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const value = taskValue(item);
  const place = taskPlace(item);
  const from = useDistanceFrom();
  const distance = distanceOf(from, item);
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const requirement = taskRequirement(item);
  const publisher = !ownerView && 'narucilacIme' in item && typeof item.narucilacIme === 'string' ? item.narucilacIme.trim() : '';
  const person = publisher && 'narucilacIme' in item ? { name: publisher, rating: item.narucilacOcena, count: item.narucilacBrojOcena } : null;
  const age = useTaskAge(item.id);
  const audience = ownerView ? 'owner' : 'worker';
  const capacity = capacityWords(item.pokrivenost, audience);
  const spoken = taskSpoken({ status: status?.text, urgent, value, budget: true, place: distance ? `${place.text}, ${distance}` : place.text, schedule, requirement,
    places: capacity?.spoken ?? null,
    person: person ? personSpoken(person.name, person.rating, person.count) : null,
    next: age ? `Objavljeno: ${age.charAt(0).toLocaleLowerCase('sr-Latn-RS')}${age.slice(1)}` : null });
  return { title, status, head, mark, urgency: item.urgency, urgencyNow, urgent, value, audience, offersWord: OFFERS_WORD[audience], places: item.pokrivenost, place,
    distance, schedule, requirement, capacity, person, age, spoken: spokenWithOffers(spoken, value, OFFERS_WORD[audience]) };
}

/** `taskSpoken` says the shared "Tražim ponude"; this face says the words it draws. */
function spokenWithOffers(spoken: string, value: TaskValue, word: string): string {
  return value.kind === 'offers' ? spoken.replace('Tražim ponude', word) : spoken;
}

/**
 * What the task pays, as the first fact of the face: the money picture on the left like the picture of every other fact, the sum in the
 * amount's type and what it buys beside it. No word says what it is (the picture and the figure do). A task with no sum is the same row
 * with the price tag and words about money, drawn as every fact's words (`FactRow`) and never in the amount's type.
 */
function ValueRow({ model }: { model: TaskRecordModel }) {
  const { value } = model;
  if (value.kind !== 'amount') return <FactRow art="offers" value={value.kind === 'offers' ? model.offersWord : VALUE_WORDS.unpriced} />;
  return <View style={s.valueRow}>
    <View style={s.valueArt}><FactArt kind="money" size={FACT_ROW_ART} /></View>
    <View style={s.valueCopy}>
      <T variant="priceRow" style={s.amount}>{value.amount}</T>
      {value.basis ? <T variant="note" tone="muted">{value.basis}</T> : null}
    </View>
  </View>;
}

/** Who posted it: the one avatar (or the authorized photo the list supplies), the name, and the honest rating with how old the task is. */
function Person({ model, portrait }: { model: TaskRecordModel; portrait?: ReactNode }) {
  const { person, age } = model;
  if (!person) return null;
  const trust = ratingWords(person.rating, person.count);
  return <View style={s.person}>
    <View style={s.face}>{portrait ?? <Avatar initials={inicijali(person.name)} size={40} />}</View>
    <View style={s.personText}>
      <T variant="note" style={s.name}>{person.name}</T>
      {trust || age ? <View style={s.trustRow}>
        {trust ? <View style={s.rating}>
          {trust.star ? <FactArt kind="star" size={16} /> : null}
          <T variant="note" tone="muted" style={s.trust}>{trust.text}</T>
        </View> : null}
        {age ? <T variant="note" tone="muted">{trust ? `· ${age}` : age}</T> : null}
      </View> : null}
    </View>
  </View>;
}

export function TaskRecordBody({ model, portrait, clearOfClose = false }: {
  model: TaskRecordModel; portrait?: ReactNode;
  /** The pin's card has a round × in its top-right corner: the first row keeps clear of it. */
  clearOfClose?: boolean;
}) {
  const { stacked } = useLayoutClass();
  // Longer application states keep the value's full width, including at the phone's 1.15 text scale.
  const stackedValue = stacked || (!!model.mark && model.audience === 'worker');
  const head = !!model.head || model.urgent;
  const first = clearOfClose ? s.clearOfClose : undefined;
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.body}>
    {head ? <View style={first}><CardStatus status={model.head} urgency={model.urgency} now={model.urgencyNow} /></View> : null}
    <View style={head ? undefined : first}><T variant="heading" style={s.title}>{model.title}</T></View>
    <View style={s.facts}>
      {/* Only the short ownership mark shares this row; application states follow the complete value. */}
      <View testID="task-face-value" style={[s.valueLine, stackedValue && s.valueLineStacked]}>
        <View style={s.valueMain}><ValueRow model={model} /></View>
        {model.mark ? <View testID="task-face-mark" style={[s.mark, stackedValue && s.markStacked]}>
          <CardStatusLine text={model.mark.text} tone={model.mark.quiet ? 'muted' : 'green'} />
        </View> : null}
      </View>
      <FactRow art={model.place.remote ? 'remote' : 'pin'} value={model.distance ? `${model.place.text} · ${model.distance}` : model.place.text} />
      <FactRow art="calendar" value={model.schedule} />
      {model.requirement ? <FactRow art={REQUIREMENT_ART[model.requirement.kind]} value={model.requirement.text} /> : null}
      {model.capacity ? <FactRow testID="task-face-capacity" art="users" value={model.capacity.text} /> : null}
    </View>
    {/* The 361 dp / 1.15 native review showed capacity squeezing the name and rating into a narrow column.
        Capacity is now a fact; the publisher always has the full remaining width, with no name truncation. */}
    {model.person ? <View testID="task-face-foot" style={s.foot}>
      <Person model={model} portrait={portrait} />
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  // Between the parts of a face: 12. Inside a part: 4.
  body: { gap: sys.space.md },
  facts: { gap: sys.space.xs },
  // The ownership mark can share the value row; longer relation states have a separate line.
  valueLine: { flexDirection: 'row', alignItems: 'flex-start', columnGap: sys.space.md },
  valueLineStacked: { flexDirection: 'column', alignItems: 'stretch', rowGap: sys.space.xs },
  valueMain: { flex: 1, minWidth: 0 },
  mark: { flexShrink: 1, maxWidth: '46%', minHeight: FACT_ROW_ART, justifyContent: 'center' },
  markStacked: { maxWidth: '100%', minHeight: 0, alignSelf: 'flex-start' },
  title: { color: sys.color.ink },
  // The first row keeps one chrome control (the pin card's close) clear on the right, and is as high as it.
  // The close is 48 tall and stands 8 in from the card's edge, the face 16: so the first row is as high as what is left of it, 40.
  clearOfClose: { marginRight: layout.touch, minHeight: layout.touch - sys.space.sm },
  // The amount's row has `FactRow`'s own geometry: the 28 picture, 12, the copy with its first line centred on the picture.
  valueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, minHeight: FACT_ROW_ART },
  valueArt: { width: FACT_ROW_ART, height: FACT_ROW_ART },
  valueCopy: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm,
    paddingTop: Math.max(0, (FACT_ROW_ART - (sys.type.priceRow.lineHeight ?? FACT_ROW_ART)) / 2) },
  amount: { color: sys.color.money, flexShrink: 0 },
  foot: { alignSelf: 'stretch' },
  person: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  face: { width: 40, height: 40, borderRadius: sys.radius.pill, overflow: 'hidden', flexShrink: 0 },
  personText: { flex: 1, minWidth: 0 },
  name: { color: sys.color.ink, fontWeight: '600' },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.xs },
  rating: { flexDirection: 'row', alignItems: 'center', columnGap: sys.space.xs, maxWidth: '100%' },
  trust: { fontVariant: ['tabular-nums'], flexShrink: 1 },
});
