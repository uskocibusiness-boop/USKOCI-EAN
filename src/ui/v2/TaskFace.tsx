import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { CaretDown, CaretRight } from 'phosphor-react-native';
import type { NeedScheduleProjection, NeedUrgencyProjection, Pokrivenost, PotrebaProjekcija, StanjePotrebe } from '../../contracts/projections';
import type { NeedTaskGeographyPoint } from '../../contracts/needFactsV2';
import { hasNeedAttention, type MarketplaceItem } from '../../data/marketplaceView';
import { inicijali } from '../../lib/inicijali';
import { Avatar } from '../system/Avatar';
import { FactArt, type FactArtKind, type FactArtRole } from '../system/FactArt';
import { MoneyArt } from '../system/MoneyArt';
import { osobuAkuz, plural } from '../system/plural';
import type { WindowRoom } from '../system/textScale';
import { nested, sys } from '../system/tokens';
import { T } from '../Text';
import { HEAD_GAP, TITLE_SIZE, headBeside } from './cardHeadFit';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

/**
 * A compact work brief: conditional state, title with truthful terms, grouped place/time/material requirements,
 * then human identity and capacity. Long text stays readable; narrower or enlarged-text cards stack whole groups.
 * No helper invents a rating, count, state or price basis, and a word about money never wears an amount's styling.
 * The parts are drawings only: the card is one target and says every fact once (`taskSpoken`).
 * Pure helpers first, then reusable parts for the list and selected map preview.
 */

/* ------------------------------------------------------------------------------------------------ what it says */

/** What stands in the value slot. It is always one of the three: a card never leaves the corner empty (A8). */
export type TaskValue =
  | { kind: 'amount'; amount: string; basis: 'ukupno' | 'po osobi' | null }
  | { kind: 'offers' }
  | { kind: 'unpriced' };

export function taskValue(item: Pick<MarketplaceItem, 'rezimCene' | 'ponudjenaCena' | 'osnovaCene'>): TaskValue {
  if (item.rezimCene === 'OFFERS') return { kind: 'offers' };
  const amount = item.ponudjenaCena?.prikaz;
  if (!amount) return { kind: 'unpriced' };
  // The card says what the number buys in one or two words (A10, B14); the full sentence stays on the detail.
  return { kind: 'amount', amount, basis: item.osnovaCene === 'TOTAL' ? 'ukupno' : item.osnovaCene === 'PER_PERSON' ? 'po osobi' : null };
}

/** The words of a value slot without an amount. They are labels, never drawn as money. */
export const VALUE_WORDS = { offers: 'Tražim ponude', unpriced: 'Cena nije navedena' } as const;

/** The value slot as it is heard: the amount with what it buys, or the word. */
export const valueSpoken = (value: TaskValue) => value.kind === 'amount'
  ? value.basis ? `${value.amount} ${value.basis}` : value.amount : VALUE_WORDS[value.kind];

/** Where the task starts, from public data only. Route cards show the pickup/start area only;
 * the full A→B route belongs on detail/map, not in a dense discovery card. */
export function taskPlace(item: Pick<MarketplaceItem, 'detalji' | 'podrucjeTekst'>): { remote: boolean; text: string } {
  if (item.detalji?.rezimLokacije === 'REMOTE') return { remote: true, text: 'Na daljinu' };
  const geography = item.detalji?.geografija;
  if (geography?.mode === 'POINT_TO_POINT' || geography?.mode === 'MULTI_STOP') {
    const from = publicName(geography.start);
    if (from) return { remote: false, text: from };
  }
  return { remote: false, text: item.podrucjeTekst };
}
const publicName = (point: NeedTaskGeographyPoint | undefined) => point?.label?.trim() || point?.area?.trim() || point?.city?.trim() || null;

/**
 * The one requirement a worker decides on, from the task's own conditions, then its vehicles, then its tools. Skills
 * are never read and neither is `uslovi` (skills + tools + vehicles in one list): "Krečenje" under "Krečenje stana" read
 * as a category, which the owner forbids. The skills stay on the detail's requirement list.
 */
export type TaskRequirement = { kind: 'condition' | 'vehicle' | 'tool'; text: string; spoken: string };
export function taskRequirement(item: Pick<MarketplaceItem, 'detalji'>): TaskRequirement | null {
  const needs = item.detalji?.zahtevi;
  if (!needs) return null;
  const clean = (values: readonly string[] | null | undefined) => (values ?? []).map(value => value.trim()).filter(Boolean);
  const conditions = clean(needs.bitniUslovi), vehicles = clean(needs.vozila), tools = clean(needs.alati);
  if (conditions.length) return { kind: 'condition', text: conditions.join(' · '), spoken: `Bitni uslovi: ${conditions.join(', ')}` };
  if (vehicles.length) return { kind: 'vehicle', text: vehicles.join(' · '), spoken: `Potrebno vozilo: ${vehicles.join(', ')}` };
  if (tools.length) return { kind: 'tool', text: tools.join(' · '), spoken: `Potreban alat: ${tools.join(', ')}` };
  return null;
}
/**
 * The fact drawing of each requirement. A vehicle and a tool are FactArt kinds of their own (card review r3 item 5): the
 * picker's Pictogram is a scene for 32 px and above, broke its own size rule at the card's 16 and brought orange in.
 */
export const REQUIREMENT_ART: Record<TaskRequirement['kind'], FactArtKind> = { condition: 'info', vehicle: 'vehicle', tool: 'tool' };

/**
 * How many people, said to the one reading it. A worker asks how many places are left ("Traži 2 osobe", "Još 1 od 2
 * mesta"); the owner follows the progress of their own task ("0/2 popunjeno").
 */
export function placesText(places: Pokrivenost, audience: 'worker' | 'owner', display: 'words' | 'fraction' = 'words'): { text: string; spoken: string } {
  // A list card compares filled/total at a glance; its single accessible card still explains the fraction in full.
  // Composer and detail-like previews keep the audience-specific words unless they explicitly opt in.
  if (display === 'fraction') return { text: `${places.popunjeno}/${places.ukupno}`, spoken: `${places.popunjeno} od ${places.ukupno} mesta popunjeno` };
  if (audience === 'owner') return { text: `${places.popunjeno}/${places.ukupno} popunjeno`, spoken: `${places.popunjeno} od ${places.ukupno} mesta popunjeno` };
  if (places.preostalo <= 0) return { text: 'Sva mesta su popunjena', spoken: 'Sva mesta su popunjena' };
  if (places.popunjeno <= 0) return { text: `Traži ${osobuAkuz(places.ukupno)}`, spoken: `Traži ${osobuAkuz(places.ukupno)}` };
  return { text: `Još ${places.preostalo} od ${places.ukupno} mesta`, spoken: `Još ${places.preostalo} od ${places.ukupno} mesta` };
}

/**
 * A rating is shown with how many reviews it stands on, so a 5,0 from one review never looks like one from fifty.
 * Zero reviews says so; an unknown count (the profile read did not say) shows the rating alone; no rating shows nothing.
 * The same honesty rule as the public profile sheet.
 */
export function ratingWords(rating: string | null | undefined, count: number | null | undefined): { text: string; star: boolean; spoken: string } | null {
  if (count === 0) return { text: 'Još nema ocena', star: false, spoken: 'još nema ocena' };
  if (!rating) return null;
  if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0) {
    return { text: `${rating} (${count})`, star: true, spoken: `ocena ${rating}, ${plural(count, 'ocena', 'ocene', 'ocena')}` };
  }
  return { text: rating, star: true, spoken: `ocena ${rating}` };
}
/** The person as heard: the name, and the honest rating when there is one. */
export function personSpoken(name: string, rating: string | null | undefined, count: number | null | undefined): string {
  const trust = ratingWords(rating, count);
  return trust ? `${name}, ${trust.spoken}` : name;
}

// Capacity already conveys fullness; only draft and closure need separate lifecycle words.
const OWN_STATUS: Partial<Record<StanjePotrebe, string>> = { NACRT: 'Nacrt', ZATVORENA: 'Zatvoren' };
/**
 * The status line, only when it says something: every card in a list of open tasks is open, so that is never said, and
 * a card in a section named for its state (every card under Nacrti is a draft, every card under Istorija is closed) does
 * not repeat it (card review r3 item 10). `sectionSays` is the state the list's own section already names.
 */
export type TaskCardRelation = 'OWNED' | 'APPLIED' | 'UNKNOWN' | 'PENDING';
export function taskStatus(item: MarketplaceItem, relation?: TaskCardRelation, sectionSays?: StanjePotrebe): { text: string; quiet: boolean } | null {
  if ('stanje' in item) {
    if (sectionSays && item.stanje === sectionSays) return null;
    const text = OWN_STATUS[item.stanje];
    return text ? { text, quiet: item.stanje === 'NACRT' || item.stanje === 'ZATVORENA' } : null;
  }
  // A sent application is a paper plane in words, never the tick of something finished.
  return relation === 'OWNED' ? { text: 'Tvoj zadatak', quiet: false }
    : relation === 'APPLIED' ? { text: 'Prijava poslata', quiet: false }
    : relation === 'UNKNOWN' ? { text: 'Tvoj status nije potvrđen', quiet: true }
    : relation === 'PENDING' ? { text: 'Proveravamo…', quiet: true } : null;
}

/**
 * What my own task asks of me next, from the server's count of applications I can choose among. Unknown (null) draws
 * nothing, never zero; a draft continues its editing; a closed or full task asks nothing. Whether applications wait is
 * the list's own rule (`hasNeedAttention`), the one the "Aktivni" badge and "Treba moja radnja" count by, so the card's
 * foot and that count can never disagree (card review r3 item 7).
 */
export type OwnerNext = { kind: 'waiting'; count: number; text: string } | { kind: 'none' } | { kind: 'draft' } | null;
export function ownerNext(item: PotrebaProjekcija): OwnerNext {
  if (item.stanje === 'NACRT') return { kind: 'draft' };
  if (item.stanje === 'ZATVORENA' || item.pokrivenost.preostalo <= 0) return null;
  const count = item.brojPrijavaZaIzbor;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
  if (!hasNeedAttention(item)) return count === 0 ? { kind: 'none' } : null;
  return { kind: 'waiting', count, text: plural(count, 'prijava čeka izbor', 'prijave čekaju izbor', 'prijava čeka izbor') };
}

/**
 * Whether a task's term is a confirmed instant: a fixed window that names a start or an end. A flexible range (today,
 * tomorrow, this week, any time on a remote task) and a term the read did not carry are not, and the calendar mark beside
 * them is drawn quiet: green means a fact that IS confirmed, grey a term that is not set (the colour-meaning table in
 * `tokens.ts`, wave-1 review).
 */
export function scheduleConfirmed(schedule: NeedScheduleProjection | undefined): boolean {
  return schedule?.kind === 'FIXED_WINDOW' && (schedule.startsAt != null || schedule.endsAt != null);
}

/**
 * Everything the card shows, as one sentence after its command name, in this order: HITNO, status, the value, where,
 * when, the requirement, the places, the person and what comes next. It is the order the card is drawn in, except that
 * HITNO, drawn after the status on the first line, is said before it. Empty parts are left out.
 */
export function taskSpoken(parts: { status?: string | null; urgent?: boolean; value: TaskValue; place: string; schedule: string;
  requirement?: TaskRequirement | null; places?: string | null; person?: string | null; next?: string | null }): string {
  return [parts.urgent ? 'HITNO' : null, parts.status, valueSpoken(parts.value), parts.place, parts.schedule, parts.requirement?.spoken,
    parts.places, parts.person, parts.next].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(', ');
}

/* ------------------------------------------------------------------------------------------------ the parts */

/** Line 1. The HITNO badge reads the card's one clock; the card says HITNO itself, so the badge is not a stop of its own. */
export function CardStatus({ status, urgency, now }: { status: { text: string; quiet: boolean } | null; urgency?: NeedUrgencyProjection; now: number }) {
  const tone = status?.quiet ? sys.color.muted : sys.color.green;
  return <View style={s.statusRow}>
    {status ? <View style={s.status}><View style={[s.dot, { backgroundColor: tone }]} />
      <T variant="label" numberOfLines={1} style={[s.statusText, { color: tone }]}>{status.text}</T></View> : <View style={s.grow} />}
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><NeedUrgencyBadge urgency={urgency} now={now} /></View>
  </View>;
}

/**
 * The title and its terms form one brief. The price stands beside the title when the title fits the column it leaves
 * (`headBeside`: measured below 380 dp, the old length gate from there up); larger text, a word instead of an amount and a
 * title that would break or tower keep a full-width heading with the price under it.
 */
export function CardHead({ title, value, large, room }: { title: string; value: TaskValue; large: boolean;
  /** The window the card is drawn in. Without it the head keeps the fixed gate it had before the room was measured. */
  room?: WindowRoom }) {
  const stacked = large || value.kind !== 'amount' || !headBeside(title, value.amount, value.basis, room);
  return <View style={stacked ? s.headStacked : s.head}>
    <T style={[s.title, s.briefTitle, !stacked && s.titleSide]}>{title}</T>
    <View style={s.briefTerms}>
      {value.kind === 'offers' ? <FactArt kind="offers" size={24} cut="art" /> : null}
      <View style={s.briefValue}><CardValue value={value} large={stacked} prominent /></View>
    </View>
  </View>;
}

/**
 * The value slot. An amount is money (colour, weight, tabular figures) and is never cut: it keeps its own width and the
 * title gives way (card review r3 item 2). A word is a quiet label, capped at 42% so it cannot squeeze the title.
 */
export function CardValue({ value, large, prominent = false }: { value: TaskValue; large: boolean; prominent?: boolean }) {
  if (value.kind === 'amount') {
    return <View style={large ? s.valueRow : valueStyles.amountSide}>
      <T style={[valueStyles.amount, prominent && s.decisionAmount, large && valueStyles.alignStart, large && s.valueWrap]}>{value.amount}</T>
      {value.basis ? <T style={[valueStyles.basis, large && valueStyles.alignStart]} numberOfLines={1}>{value.basis}</T> : null}
    </View>;
  }
  return <View style={large ? s.valueRow : valueStyles.wordSide}>
    <T style={[valueStyles.valueWord, prominent && value.kind === 'offers' && s.offerWord, large && valueStyles.alignStart, large && s.valueWrap]}
      numberOfLines={large ? undefined : 2}>{VALUE_WORDS[value.kind]}</T>
  </View>;
}

/** A task's real value and capacity, below its full-width title. Large text gives each its own row. */
export function CardDecision({ value, places, large }: { value: TaskValue; places: ReactNode; large: boolean }) {
  return <View style={[s.decision, large && s.decisionStacked]}>
    <View style={s.decisionValue}>
      {value.kind !== 'unpriced' ? <View style={s.decisionArt}>{value.kind === 'offers' ? <FactArt kind="offers" size={24} cut="art" /> : <MoneyArt size={24} />}</View> : null}
      <View style={s.decisionCopy}><CardValue value={value} large prominent /></View>
    </View>
    {places ? <View style={s.decisionPlaces}>{places}</View> : null}
  </View>;
}

/** One complete fact. A larger illustration opts into a matching slot without crowding the words. */
export function CardFact({ art, text, lines = 1, artSize = 24 }: { art: ReactNode; text: string; lines?: number; artSize?: 24 | 28 }) {
  return <View style={s.fact}>
    <View style={[s.art, artSize === 28 && s.artLarge]}>{art}</View>
    <T style={s.factText} numberOfLines={lines || undefined}>{text}</T>
  </View>;
}

/** Line 5: a condition draws the "info" fact, a vehicle the van and a tool the toolbox, all at fact size. */
export function CardRequirement({ requirement, artSize = 24, role }: { requirement: TaskRequirement; artSize?: 24 | 28; role?: FactArtRole }) {
  return <CardFact art={<FactArt kind={REQUIREMENT_ART[requirement.kind]} size={artSize} cut="art" role={role} />}
    text={requirement.text} lines={0} artSize={artSize} />;
}

/** Who posted the task: the one avatar and the one initials rule of the app, the name, and the honest rating. */
export const CardPerson = memo(function CardPerson({ name, rating, count, size = 40, portrait }: {
  name: string; rating: string | null | undefined; count: number | null | undefined; size?: 32 | 40 | 56;
  /** Authorized media supplied by the caller; this drawing starts no profile or photo read. */
  portrait?: ReactNode;
}) {
  const trust = ratingWords(rating, count);
  return <View style={s.person}>
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ width: size, height: size, borderRadius: sys.radius.pill, overflow: 'hidden', flexShrink: 0 }}>
      {portrait ?? <Avatar initials={inicijali(name)} size={size} />}
    </View>
    <View style={s.personText}>
      <T style={s.personName} numberOfLines={1}>{name}</T>
      {trust ? <View style={s.rating}>
        {trust.star ? <FactArt kind="star" size={14} /> : null}
        <T style={s.ratingText} numberOfLines={1}>{trust.text}</T>
      </View> : null}
    </View>
  </View>;
});

/** A person or next-step note anchors the brief; a compact capacity stays at its lower right, including stacked mode. */
export function CardBriefFoot({ places, person, large, capacityAtEnd = false }: {
  places: ReactNode; person: ReactNode; large: boolean; capacityAtEnd?: boolean;
}) {
  return <View style={[s.briefFoot, large && s.briefFootStacked]}>
    {person ? <View style={large ? s.briefPersonStacked : s.briefPerson}>{person}</View> : null}
    {places ? <View style={capacityAtEnd ? s.briefCapacityEnd : !large && person ? s.briefCapacity : undefined}>{places}</View> : null}
  </View>;
}

/** Line 6: places on the left, the person anchored bottom right; at large text they are two whole lines. */
export function CardFoot({ places, person, large }: { places: ReactNode; person: ReactNode; large: boolean }) {
  return <View style={large ? s.footStacked : s.foot}>
    {places}
    {person ? <View style={large ? s.personStacked : s.personSide}>{person}</View> : null}
  </View>;
}

/**
 * The count of places. Beside the person it never shrinks, so a long name is what gives way ("Nikola Petrov…"), never
 * "Traži 2 os…" (card review r3 item 3); on its own line at large text it may take a second line.
 */
export function CardPlaces({ places, audience, large = false, display = 'words' }: {
  places: Pokrivenost; audience: 'worker' | 'owner'; large?: boolean; display?: 'words' | 'fraction';
}) {
  const words = placesText(places, audience, display);
  return <View style={large ? s.placesStacked : s.places}>
    <FactArt kind="users" size={20} cut="art" tone="quiet" />
    <T style={[s.placesText, display === 'fraction' && s.placesFraction, large && s.placesTextStacked]} numberOfLines={large ? undefined : 1}>{words.text}</T>
  </View>;
}

/** A line inside the card's own target: "Nastavi uređivanje" continues the draft the card opens. */
export function CardNext({ label }: { label: string }) {
  return <View style={s.next}><T style={s.nextText} numberOfLines={1}>{label}</T><CaretRight size={16} weight="bold" color={sys.color.green} /></View>;
}

/** A quiet sentence of fact inside the card, never a target of its own. */
export function CardNote({ text }: { text: string }) {
  return <T style={s.note} numberOfLines={2}>{text}</T>;
}

/** What waits for me, for a card that has nowhere to send it (no route handed over): the foot's dot and words, as a line. */
export function CardWaitingLine({ text }: { text: string }) {
  return <View style={s.waitingRow}><WaitingDot /><T style={s.waitingLine} numberOfLines={1}>{text}</T></View>;
}

/** The orange dot that marks what waits for me: a dot, never an orange fill (R1 critique B1). */
export function WaitingDot() {
  return <View style={faceStyles.ownerFootDot} />;
}

/* ------------------------------------------------------------------ parts other faces share (step 5c, 2026-09-24) */

/**
 * How a status line speaks, for a face whose states are not the task's (an application: Poslata, Izabrana, Povučena).
 * `ink` is a state in progress, `green` a good outcome, `muted` one that is over, and `waiting` something that waits for
 * me (the orange dot and the `warn` words of the waiting foot). The state is said by the dot and the word, never by a
 * coloured card edge.
 */
export type StatusTone = 'ink' | 'green' | 'muted' | 'waiting';
const STATUS_TONES: Record<StatusTone, { dot: string; text: string }> = {
  ink: { dot: sys.color.ink, text: sys.color.ink },
  green: { dot: sys.color.green, text: sys.color.green },
  muted: { dot: sys.color.muted, text: sys.color.muted },
  waiting: { dot: sys.color.orange, text: sys.color.warn },
};

/** Line 1 of a face with its own states: the dot and the word, on the task card's status geometry. */
export function CardStatusLine({ text, tone }: { text: string; tone: StatusTone }) {
  const ink = STATUS_TONES[tone];
  return <View style={s.status}>
    <View testID="card-status-dot" style={[s.dot, { backgroundColor: ink.dot }]} />
    <T variant="label" numberOfLines={1} style={[s.statusText, { color: ink.text }]}>{text}</T>
  </View>;
}

/**
 * The title alone, in the task card's title type, for a face whose value is not beside it. `style` places it (beside a
 * value slot) or quiets it (a title not known yet); the type stays the card's.
 */
export function CardTitle({ title, lines = 2, style }: { title: string; lines?: number; style?: StyleProp<TextStyle> }) {
  return <T style={[s.title, style]} numberOfLines={lines || undefined}>{title}</T>;
}

/**
 * The words of a card's one foot action, a quiet row link at the bottom of the card and never a button inside it. The
 * card that draws it puts it in its own press, a sibling of the body, on `faceStyles.footLink` (or `ownerFoot` for what
 * waits for me), so no target sits inside another:
 * - `green`   goes somewhere (a caret to the right);
 * - `ink`     a rare step that asks before it ends something, drawn quietly on every card that allows it (no caret: it
 *             opens a question, not a screen; the question itself carries the danger colour; a red foot tone had no
 *             caller and was removed, verify r4c);
 * - `waiting` is what waits for me: the orange dot and the `warn` words, as the own-task foot.
 * Disabled draws the words muted, never faded.
 */
export type FootTone = 'green' | 'ink' | 'waiting';
const FOOT_TONES: Record<FootTone, string> = { green: sys.color.green, ink: sys.color.ink, waiting: sys.color.warn };
export function CardFootLine({ label, tone, caret = 'none', disabled = false }: { label: string; tone: FootTone;
  caret?: 'right' | 'down' | 'none'; disabled?: boolean }) {
  const color = disabled ? sys.color.muted : FOOT_TONES[tone];
  const Caret = caret === 'down' ? CaretDown : CaretRight;
  return <>
    {tone === 'waiting' ? <WaitingDot /> : null}
    <T style={[s.footLinkText, { color }]} numberOfLines={2}>{label}</T>
    {caret !== 'none' ? <Caret size={18} weight="bold" color={color} /> : null}
  </>;
}

/**
 * The value slot's type, shared by every face that shows an amount or the word instead of one (the task card, my
 * application's offer, a candidate's offer, the AI's live draft), so no face keeps its own copy (review r4 item 8). An
 * amount is money (colour, weight, tabular figures) and is never cut; what it buys and a word are quiet labels.
 */
export const valueStyles = StyleSheet.create({
  // An amount keeps its whole width, whatever the phone and the text size: the title beside it is what gives way.
  amountSide: { alignItems: 'flex-end', flexShrink: 0 },
  // A word may take two short lines rather than squeeze the title.
  wordSide: { alignItems: 'flex-end', maxWidth: '42%', flexShrink: 0 },
  alignStart: { textAlign: 'left' },
  amount: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2, color: sys.color.money, fontVariant: ['tabular-nums'], textAlign: 'right' },
  basis: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: sys.color.muted, textAlign: 'right' },
  valueWord: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: sys.color.muted, textAlign: 'right' },
});

export const faceStyles = StyleSheet.create({
  /**
   * The own-task foot (R1 critique B1, card review r3 item 6): the bottom strip of the card on the quiet wash under one
   * hairline, with an orange dot and the words in `warn`. An orange fill on every waiting card spent the screen's one
   * orange fill several times over in Moji zadaci. Its lower corners follow the card's, inside its 1 px edge.
   */
  ownerFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.wash,
    borderBottomLeftRadius: nested(sys.radius.cardCompact, 1), borderBottomRightRadius: nested(sys.radius.cardCompact, 1) },
  ownerFootDot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  /**
   * A quiet foot link (`CardFootLine` green or ink): the own-task foot's geometry, one hairline above and 48 px of
   * touch, on the card's own white. The hairline is the border between the two targets, as there.
   */
  footLink: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: sys.color.line },
});

const s = StyleSheet.create({
  grow: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill },
  statusText: { flexShrink: 1, letterSpacing: 0.3 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: HEAD_GAP },
  headStacked: { gap: 8 },
  briefTitle: { color: sys.color.ink },
  briefTerms: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm, flexShrink: 0 },
  briefValue: { flexShrink: 1, minWidth: 0 },
  title: { fontSize: TITLE_SIZE, lineHeight: 26, fontWeight: sys.type.cardTitle.fontWeight, letterSpacing: -0.3, color: sys.color.ink },
  titleSide: { flex: 1, minWidth: 0 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, rowGap: 2 },
  valueWrap: { flexShrink: 1, maxWidth: '100%' },
  decision: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 16, rowGap: 10 },
  decisionStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  decisionValue: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flexShrink: 1, maxWidth: '100%' },
  decisionArt: { paddingTop: 2 },
  decisionCopy: { flexShrink: 1, minWidth: 0 },
  decisionPlaces: { flexShrink: 1, maxWidth: '100%' },
  decisionAmount: { ...sys.type.priceSmall },
  offerWord: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: sys.color.muted },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  art: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  artLarge: { width: 28, height: 28, flexShrink: 0 },
  factText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 21, fontWeight: '400', color: sys.color.muted },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  footStacked: { gap: 8, marginTop: 2 },
  places: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  placesStacked: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  placesText: { fontSize: 15, lineHeight: 22, fontWeight: '500', color: sys.color.fact, fontVariant: ['tabular-nums'] },
  placesFraction: { fontWeight: '600', color: sys.color.muted },
  placesTextStacked: { flexShrink: 1 },
  personSide: { flexShrink: 1, minWidth: 0, maxWidth: '62%' },
  personStacked: { alignSelf: 'flex-end', maxWidth: '100%' },
  briefFoot: { flexDirection: 'row', alignItems: 'center', columnGap: sys.space.base, rowGap: sys.space.md,
    borderTopWidth: 1, borderTopColor: sys.color.line, paddingTop: sys.space.md },
  briefFootStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  briefPerson: { flex: 1.5, minWidth: 0 },
  briefPersonStacked: { alignSelf: 'stretch' },
  briefCapacity: { flex: 1, minWidth: 0 },
  briefCapacityEnd: { alignSelf: 'flex-end', marginLeft: 'auto', flexShrink: 0 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personText: { flexShrink: 1, minWidth: 0 },
  personName: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: sys.color.ink },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { flexShrink: 1, fontSize: 13, lineHeight: 17, fontWeight: '500', color: sys.color.muted, fontVariant: ['tabular-nums'] },
  next: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  nextText: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: sys.color.green },
  note: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: sys.color.muted },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  waitingLine: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '700', color: sys.color.warn },
  footLinkText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 19, fontWeight: '700' },
});
