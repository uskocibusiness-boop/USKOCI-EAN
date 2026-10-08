import { useRef, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, Switch, View } from 'react-native';
import { readableTitle } from '../../data/needDetailPresentation';
import { Avatar } from '../system/Avatar';
import { FactArt, type FactArtKind } from '../system/FactArt';
import type { HomeAttention, HomeRaspored, HomeRow, HomeSection, HomeSnapshot, HomeTarget } from '../../data/homeSnapshot';
import type { OwnedTaskCounts } from '../../data/marketplaceView';
import type { ApplicationCounts } from '../../data/myApplicationsView';
import { ScreenHeader } from '../system/ScreenHeader';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { ListRow } from '../system/ListRow';
import { Screen } from '../system/Screen';
import { Section } from '../system/Section';
import { Surface } from '../system/Surface';
import { layout } from '../system/layout';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { materialControl, sys } from '../system/tokens';
import { plural, prijava } from '../system/plural';
import { useLayoutClass, useTextScale } from '../system/textScale';
import { usePullRefresh } from '../system/usePullRefresh';
import { HomeLaunchArt } from './HomeLaunchArt';
import { ListSkeleton } from '../notifications/ListSkeleton';
import { HowItWorks } from './HowItWorks';

/** Home presents two intentions and the account's real next actions. It never infers earnings, creates another user role, or
 * makes failed reads look like empty lists. Start actions remain available before the overview has loaded.
 *
 * One rhythm (UI/UX pass, 2026-10-08, composition spec 4.1): the screen is a `Screen`, so the edge is 20 and the blocks stand 24
 * apart; every block under the doors is a `Section` or a group of `ListRow`s, the next appointment is a `Surface` record, and no
 * line separates one block from another. Nothing here draws a divider of its own.
 *
 * Order (owner, 2026-10-07; "Danas u 14", the owner's pick of 2026-10-08; the blueprint he approved on 8 Oct 2026, Z1): the two
 * doors; for a brand-new account, one quiet row "Kako radi" (three steps, hidden for good with "Sakrij"); "Sledeće" when an accepted
 * appointment lies ahead, as the one record of the screen, directly under the doors: the TIME of the next Dogovor is the largest word
 * on Početna ("Danas · 14:00–16:00", in the voice of money, 24/700) and the calendar stands small at the end of its line, with no way
 * into the whole schedule (that is reached from Dogovori only); then "Čeka te", always once the reads answered (one grey line when
 * nothing waits, and never when something does: a Dogovor without a term, a change to answer, a draft to continue, a rating), at most
 * three things and the rest as a count. With no appointment ahead the hero would vanish, so the first thing that waits takes its place
 * as the one record (its number first: "2 prijave"); the Dogovori that have no day to show them on are NOT a block of their own (the
 * owner's phone, 8 Oct 2026: "Raspored — 1 Dogovor bez tačnog termina" was a weak row): the one that needs a term is asked for under
 * "Čeka te", and all of them stand in Raspored, under "Termin još nije dogovoren". Then "Moji zadaci" / "Moje prijave", each with its
 * number, and, for an active work profile, "Mogu odmah", as one group of rows directly below. A row of "Čeka te" says the task and the
 * action and nothing else: the sentence the phone or the server keeps under it ("Termin još nije dogovoren.") repeated the action, and
 * a screen reader still hears it. The doors and the header are the locked signature. */
export type HomePresentationProps = {
  home: HomeSnapshot | null; loading: boolean; refreshing: boolean; error: boolean;
  /**
   * The last read failed but what is on screen is the last one that worked (the route keeps it through a failed re-read): the
   * screen says so in one line and keeps the content (R31). `error` is the other case, where there is nothing to show.
   */
  stale?: boolean;
  /** Internal galleries supply the same chrome with an inert bell; the live header remains the default. */
  header?: ReactNode;
  onPublish: () => void; onEarn: () => void; onProfile: () => void; onOpen: (target: HomeTarget) => void;
  /**
   * What waits for my rating. With the one Dogovor's id (the Dogovori read already gave it) the route opens that
   * rating; with null — several, or none known — it opens Dogovori, where each one waits (critique A1, 2026-09-24).
   */
  onRatings: (agreementId: string | null) => void;
  onMyTasks: () => void; onMyApplications: () => void; onRefresh: () => void;
  /**
   * R06, "Mogu odmah" (the name Dostupnost gives it, and without a gender): the one switch of the work profile, drawn only for an
   * account whose profile is active. The route saves it through the availability client and says whether it is at work or failed;
   * without it the row is not drawn.
   */
  availableNow?: { value: boolean; onChange: (value: boolean) => void; busy?: boolean; failed?: boolean };
  /**
   * The face of the other person in the card of the next Dogovor. The route hands over the element that reads their photo (a data
   * client), exactly as it hands over the header's avatar; the presentation passes the stand-in it would draw itself
   * (their initials, or a drawn person). Without it, or without a profile id, the stand-in is the face.
   */
  photo?: (profileId: string, standIn: ReactNode) => ReactNode;
};

/** The picture of a front door. 64 dp sets both doors' height (owner, 2026-10-07: smaller doors, about 88 dp). */
const DOOR_ART = 64;
/** How many things "Čeka te" draws (the blueprint of 8 Oct 2026, T3): a list that is longer is counted, not scrolled. */
export const WAITING_LIMIT = 3;

/** Equal doors: original artwork leads, then the intention and one short line. */
function StartActions({ onPublish, onEarn }: { onPublish: () => void; onEarn: () => void }) {
  const textScale = useTextScale();
  // One minimum for both doors: the picture sets it at ordinary text sizes (2 × 12 + 64 = 88 dp).
  // Larger text grows both together instead of clipping; wrapped text grows a door naturally, and no empty lines are reserved.
  const minHeight = Math.ceil(2 * sys.space.md + Math.max(DOOR_ART, 27 * textScale + sys.space.xs + 22 * textScale));
  return <View style={s.actions}>
    <Press accessibilityRole="button" accessibilityLabel="Objavi zadatak" accessibilityHint="Opiši šta ti treba."
      haptic="select" onPress={onPublish} scaleTo={sys.motion.scale.row} style={[s.door, materialControl.raised, { minHeight }]}>
      <View style={s.doorMain}>
        <HomeLaunchArt kind="publish" size={DOOR_ART} />
        <View style={s.doorCopy}>
          <T accessibilityRole="header" style={s.doorTitle}>Objavi zadatak</T>
          <T variant="copy" tone="muted">Opiši šta ti treba.</T>
        </View>
      </View>
    </Press>
    <Press accessibilityRole="button" accessibilityLabel="Uskoči i zaradi" accessibilityHint="Pronađi zadatak."
      haptic="select" onPress={onEarn} scaleTo={sys.motion.scale.row} style={[s.door, materialControl.raised, { minHeight }]}>
      <View style={s.doorMain}>
        <HomeLaunchArt kind="discover" size={DOOR_ART} />
        <View style={s.doorCopy}>
          <T accessibilityRole="header" style={s.doorTitle}>Uskoči i zaradi</T>
          <T variant="copy" tone="muted">Pronađi zadatak.</T>
        </View>
      </View>
    </Press>
  </View>;
}

/** The picture a kind of waiting row is drawn with: the same coloured illustration the cards use for this kind of thing. */
function artFor(target: HomeTarget): FactArtKind {
  switch (target.kind) {
    case 'CANDIDATES': return 'users';
    case 'APPLICATION': return 'offers';
    case 'AGREEMENT': case 'AGREEMENT_CHANGE': return 'agreements';
    case 'AGREEMENT_TERM': return 'calendar';
    case 'WORKER_PROFILE': return 'users';
    default: return 'tasks';
  }
}

/** Something here waits for me: an orange dot on the picture, the one mark of attention (B1). A row that only suggests has none. */
function Marked({ art, attention }: { art: FactArtKind; attention: boolean }) {
  return <View>
    <FactArt kind={art} size={32} />
    {attention ? <View testID="attention-dot" style={s.attentionDot} /> : null}
  </View>;
}

/** "2 prijave · čeka tvoj izbor": two short parts on one line, the second one in the lower case of a sentence's middle. */
const joined = (first: string, second: string) => `${first} · ${second.replace(/\.$/, '').replace(/^\p{Lu}/u, letter => letter.toLowerCase())}`;

/**
 * One thing that waits for me. The subject leads (the task, in 16/24) and the exact action is under it, and that is all the eye is
 * given: the reason the server or the phone keeps ("Termin još nije dogovoren.", "Nacrt još nije objavljen.") said the action a second
 * time, and the owner's phone showed it as a third line (8 Oct 2026). A row about a pile of applications keeps count and action on one
 * line ("2 prijave · čeka tvoj izbor"), because the count alone does not say what is asked. A row the server or the phone could not name
 * a task for leads with its action and the reason under it. The whole row is one stop for a screen reader and says the same words in
 * the same order, the reason included.
 */
function WaitingRow({ row, onOpen, last }: { row: HomeAttention; onOpen: (target: HomeTarget) => void; last: boolean }) {
  const taskTitle = row.taskTitle === undefined ? null : readableTitle(row.taskTitle);
  const title = readableTitle(row.title);
  const compact = !!taskTitle && row.target.kind === 'CANDIDATES';
  const words = taskTitle ? { title: taskTitle, subtitle: compact ? joined(title, row.detail) : title } : { title, subtitle: row.detail };
  return <ListRow leading={<Marked art={artFor(row.target)} attention />} {...words} last={last} onPress={() => onOpen(row.target)}
    accessibilityLabel={[title, taskTitle, row.detail].filter(Boolean).join('. ')} />;
}

/** The width and height of the other person's face in the card of the next Dogovor. */
const FACE = 32;
/** The calendar at the end of the time's line: small, so the time stays the largest thing on the screen. */
const CALENDAR = 32;

/**
 * The next accepted appointment, the time first and largest (owner, 2026-10-07; "Danas u 14", 2026-10-08): when it is, in Serbian
 * time and from the accepted instant (`raspored.when`, never the display sentence), in the voice of money (`priceLarge`: ink, 700,
 * tabular figures, so the clocks line up), then what it is, who it is with, and the one quiet line about the rest. The calendar
 * stands at 32 at the end of the time's line (not larger: it would compete with the time) and says nothing the words do not say.
 * It is the same record a Dogovor is in Dogovori (one shadow, one corner, 16 inside); the whole card opens the Dogovor. The whole
 * schedule is not reached from here: Raspored has one door, Dogovori (the blueprint of 8 Oct 2026). The time is a fact: it is never
 * animated.
 */
function RasporedCard({ row, raspored, photo, onOpen }: {
  row: HomeRow; raspored: HomeRaspored; photo?: HomePresentationProps['photo']; onOpen: (target: HomeTarget) => void;
}) {
  const appointment = row.appointment, title = readableTitle(row.title);
  const name = appointment?.counterpartName ?? '', role = appointment?.roleLabel ?? null;
  const standIn = <Avatar initials={appointment?.counterpartInitials} size={FACE} />;
  const profileId = appointment?.counterpartProfileId;
  const face = profileId && photo ? photo(profileId, standIn) : standIn;
  // "Po vremenu u Srbiji" inside a sentence: only its first letter gives way ("Srbiji" is a name).
  const zone = raspored.zone ? `, ${raspored.zone.charAt(0).toLowerCase()}${raspored.zone.slice(1)}` : '';
  const spoken = [`${raspored.spoken}${zone}`, title, [name, role].filter(Boolean).join(', '), raspored.more].filter(Boolean).join('. ');
  return <Surface kind="record" accessibilityLabel={spoken} accessibilityHint="Otvara Dogovor." onPress={() => onOpen(row.target)} style={s.appointment}>
    <View style={s.appointmentHead}>
      <View style={s.appointmentWhen}>
        <T variant="priceLarge" style={s.appointmentDay}>{raspored.when}</T>
        {/* A phone set to another zone, or one that does not say, is told which time this is (the planner's own rule). */}
        {raspored.zone ? <T variant="meta" tone="muted">{raspored.zone}</T> : null}
      </View>
      <FactArt kind="calendar" size={CALENDAR} />
    </View>
    <T>{title}</T>
    {name || role ? <View style={s.appointmentPerson}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.face}>{face}</View>
      <View style={s.copy}>
        {name ? <T variant="note" style={s.appointmentName}>{name}</T> : null}
        {role ? <T variant="meta" tone="muted">{role}</T> : null}
      </View>
    </View> : null}
    {raspored.more ? <T variant="note" tone="muted">{raspored.more}</T> : null}
  </Surface>;
}

/**
 * No appointment ahead: the first thing that waits for me is the one record of the screen, so the focus does not vanish ("Danas u 14",
 * the risk answered). Its number leads when it is a count ("2 prijave", in the voice of money), the task is under it and, for a count,
 * what is asked of me ("Čeka tvoj izbor."); the picture with the orange dot is at the end. A thing that is not a count leads with the
 * action, the task is under it, and the sentence that said the action again is not drawn (it is in the screen reader's label). It is the
 * same row as the others (same words, same target), only larger.
 */
function FirstWaiting({ row, onOpen }: { row: HomeAttention; onOpen: (target: HomeTarget) => void }) {
  const title = readableTitle(row.title), taskTitle = row.taskTitle === undefined ? null : readableTitle(row.taskTitle);
  const counted = /^\d/.test(title);
  return <Surface kind="record" onPress={() => onOpen(row.target)} accessibilityLabel={[title, taskTitle, row.detail].filter(Boolean).join('. ')} style={s.appointment}>
    <View style={s.appointmentHead}>
      <View style={s.appointmentWhen}>
        <T variant={counted ? 'priceLarge' : 'heading'} style={s.appointmentDay}>{title}</T>
        {taskTitle ? <T>{taskTitle}</T> : null}
        {counted || !taskTitle ? <T variant="note" tone="muted">{row.detail}</T> : null}
      </View>
      <Marked art={artFor(row.target)} attention />
    </View>
  </Surface>;
}

/** A front door to one of my lists: its name and, once read, what is in it. It opens the list even when unread. */
function MineRow({ art, title, detail, onPress, last = false }: {
  art: FactArtKind; title: string; detail: string | null; onPress: () => void; last?: boolean;
}) {
  return <ListRow leading={<FactArt kind={art} size={32} />} title={title} subtitle={detail ?? undefined} onPress={onPress} last={last}
    accessibilityLabel={detail ? `${title}. ${detail}` : title} />;
}

/**
 * R06: one switch, for an account whose work profile is active. It is called what Dostupnost calls it, "Mogu odmah" (it was "Slobodan
 * sam sada": a second name for one thing, and a masculine one, the owner's phone, 8 Oct 2026). The switch says whether it is on; the line
 * under it says only what the switch cannot: that it is on, while it saves, or that saving failed. How long it holds is Dostupnost's to say.
 * The route owns the save. The row is a row that tells and carries a control, so it is not a button itself.
 */
function AvailableNowRow({ control, last }: { control: NonNullable<HomePresentationProps['availableNow']>; last: boolean }) {
  const subtitle = control.failed ? 'Nije sačuvano. Pokušaj ponovo.' : control.busy ? 'Čuvamo…' : control.value ? 'Uključeno' : undefined;
  return <ListRow leading={<FactArt kind="clock" size={32} />} title="Mogu odmah" subtitle={subtitle} last={last}
    trailing={<Switch value={control.value} disabled={control.busy} onValueChange={control.onChange}
      accessibilityLabel="Mogu odmah" trackColor={{ true: sys.color.green, false: sys.color.control }} thumbColor={sys.color.surface} />} />;
}

/** Said once and quietly: a part of the overview that could not be read names itself, and the shared recovery above retries it. */
function Unavailable({ text }: { text: string }) {
  return <T accessibilityLiveRegion="polite" variant="note" tone="muted">{text}</T>;
}

/**
 * What the first read fills first, in its own order: the heading of "Čeka te" and two rows of the real geometry (picture slot,
 * two lines, 64 dp), breathing as one while the answer is on its way. No block is promised that may never come.
 */
const HomeSkeleton = () => <ListSkeleton rows={2} heading label="Učitavanje" />;

// The two doors count what their lists hold, never what waits: that is said once, under "Čeka te", from the server's
// own attention list (PKG-042: no inference fallback). A door that also said "1 čeka izbor" contradicted a known empty
// "Čeka te", and stood in for it when that list could not be read.
/**
 * "8 aktivnih · 1 nacrt" — the sets of "Moji zadaci", counted by the list's own filter, each with its number (the blueprint of 8 Oct
 * 2026, Z1). A draft that "Čeka te" offers to continue is counted here too: the row is the count of the list it opens, and "Nastavi
 * nacrt" is an action; the one does not stand in for the other.
 */
function tasksLine(section: HomeSection<OwnedTaskCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nedostupno';
  const c = section.value;
  const parts = [c.active ? plural(c.active, 'aktivan', 'aktivna', 'aktivnih') : null,
    c.drafts ? plural(c.drafts, 'nacrt', 'nacrta', 'nacrta') : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : c.total ? 'Nema aktivnih zadataka' : 'Još nemaš zadatak';
}
/**
 * "1 čeka odgovor" — the applications that are open and wait for the other side's answer, counted by the list's own tabs (the blueprint
 * of 8 Oct 2026, Z1 and U8: "Čeka odgovor" is the list's first group). An application that waits for me sits in the list's own "Čeka te"
 * set, not among these, so a row with none waiting that is not all finished names how many applications there are instead of saying
 * that none waits over one that does.
 */
function applicationsLine(section: HomeSection<ApplicationCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nedostupno';
  const c = section.value;
  if (c.active) return plural(c.active, 'čeka odgovor', 'čekaju odgovor', 'čeka odgovor');
  return !c.total ? 'Još nemaš prijavu' : c.finished === c.total ? 'Nijedna ne čeka odgovor' : prijava(c.total);
}

export function HomePresentation(p: HomePresentationProps) {
  const home = p.home;
  const { stacked } = useLayoutClass();
  // A row that was already here when the screen opened has nothing to tell you by sliding in; only a genuinely new one moves,
  // and each list remembers what it has already shown. The first rows after a skeleton are news and arrive once (B1).
  const waiting = useAppear(), agreements = useAppear();
  const sawSkeleton = useRef(false);
  if (p.loading && !home) sawSkeleton.current = true;
  const prompts = home?.prompts ?? [];
  waiting.settle([...(home?.attention ?? []), ...prompts].map(item => item.id), undefined, { afterLoading: sawSkeleton.current });
  // Raspored holds the one next appointment that has its day-first words, as a card, and nothing else. With none ahead there is no block
  // (the count of Dogovori with no day, `quietLine`, is no longer drawn here: a weak row, 8 Oct 2026); an active Dogovor is not lost for it,
  // since what it asks of me is said under "Čeka te" and all of them stand in Raspored.
  const next = home?.agreements.kind === 'known' ? home.agreements.value.rows[0] ?? null : null;
  const raspored = next?.raspored;
  agreements.settle(next && raspored ? [next.id] : []);
  const attentionUnavailable = home?.attentionState === 'unavailable';
  // "Ništa ne čeka tvoju odluku." is said only when the server's own attention answer is known and empty, and so is the
  // rating count, and the Dogovori were read (a Dogovor with no term, or a change to answer, is found only there): a read that
  // failed is named where it failed, never drawn as nothing. A brand-new account has no "Čeka te" at all (how it works stands in its place).
  const nothingWaits = !!home && !home.firstRun && !attentionUnavailable && home.attention.length === 0 && home.attentionMore === 0
    && prompts.length === 0 && !home.promptsMore && home.agreements.kind === 'known'
    && home.ratingsDue === 0 && (home.attentionState === 'known' || !home.partial);
  // Ratings share the next-action section but are not part of the server attention count.
  // Show that count only when no ratings are waiting and their read is complete.
  const waitingShown = !!home && (attentionUnavailable || home.attention.length > 0 || prompts.length > 0 || home.ratingsDue === null
    || home.ratingsDue > 0 || nothingWaits);
  // Before the first answer a front door has no line; after a failed read it says so, never "0".
  const tasksDetail = home ? tasksLine(home.mine.tasks) : p.error ? 'Trenutno nedostupno' : null;
  const applicationsDetail = home ? applicationsLine(home.mine.applications) : p.error ? 'Trenutno nedostupno' : null;
  const profile = home?.workerProfile?.kind === 'known' ? home.workerProfile.value : null;
  const setupProfile = !!profile && (profile.state === 'NONE' || profile.state === 'DRAFT');
  const switchShown = !!profile && profile.state === 'ACTIVE' && !!p.availableNow;
  // The rows of "Čeka te", in the order they are drawn, so only the last one has no divider. At most WAITING_LIMIT of them (the server's
  // things first, then what the phone itself found, then the ratings); what does not fit is counted in the line under them, together with
  // what the server and the phone already said they left out. With no appointment ahead the first of them is the one record of the screen
  // (`FirstWaiting`, "Danas u 14": the focus must not vanish), and the rest stand under it as rows.
  const ratings = home ? (home.ratingsDue === null ? 'unknown' as const : home.ratingsDue > 0 ? 'due' as const : null) : null;
  const everyWait = home ? [...home.attention, ...prompts] : [];
  const waits = everyWait.slice(0, WAITING_LIMIT);
  const ratingsShown = ratings !== null && waits.length < WAITING_LIMIT;
  const more = home ? home.attentionMore + (home.promptsMore ?? 0) + (everyWait.length - waits.length) + (ratings !== null && !ratingsShown ? 1 : 0) : 0;
  const lead = !raspored && !attentionUnavailable && waits.length > 0 ? waits[0] : null;
  const rows = lead ? waits.slice(1) : waits;
  const rowCount = rows.length + (ratingsShown ? 1 : 0);
  const underLead = rowCount > 0 || more > 0;
  const recovery = p.stale ? 'stale' as const : home?.partial ? 'partial' as const : p.error && !home ? 'failed' as const : null;
  // The pull spinner is for a pull. "Osveži pregled" has a spinner of its own, and no read the route starts by itself may raise the white
  // disc of Android's pull at the top of the screen (the owner's phone, 8 Oct 2026).
  const pull = usePullRefresh(p.onRefresh, p.refreshing);
  return <Screen kind="root" header={p.header ?? <ScreenHeader title="Početna" onProfile={p.onProfile} />}
    refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
    <StartActions onPublish={p.onPublish} onEarn={p.onEarn} />

    {/* "Kako radi" (N4): one quiet row for a brand-new account, with a "Sakrij" that hides it for good (HowItWorks). */}
    {home?.firstRun ? <HowItWorks stacked={stacked} /> : null}
    {p.loading && !home ? <HomeSkeleton /> : null}
    {recovery ? <Surface kind="note" testID="home-recovery" style={s.recovery}>
      <T accessibilityRole="alert" variant="note">{recovery === 'stale' ? 'Nema veze. Prikazano je poslednje učitano.'
        : recovery === 'partial' ? 'Deo pregleda trenutno nije učitan.' : 'Pregled nije učitan. Proveri vezu i pokušaj ponovo.'}</T>
      <V2Action label="Osveži pregled" kind="secondary" compact loading={p.refreshing} disabled={p.loading || p.refreshing} onPress={p.onRefresh} />
    </Surface> : null}
    {/* "Sledeće", the hero: only an accepted appointment that is not over is "next", and its TIME is the largest word on the screen,
        directly under the doors. It has no command of its own beyond the card; Raspored is reached from Dogovori. */}
    {next && raspored ? <Section title="Sledeće">
      <Appear index={0} animate={agreements.isNew(next.id)}><RasporedCard row={next} raspored={raspored} photo={p.photo} onOpen={p.onOpen} /></Appear>
    </Section> : null}

    {home && waitingShown ? <Section title="Čeka te">
      {attentionUnavailable ? <Unavailable text="Ne možemo da učitamo ono što te čeka." /> : null}
      {nothingWaits ? <ListRow leading={<FactArt kind="check" size={32} />} tone="quiet" title="Ništa ne čeka tvoju odluku." last /> : null}
      {lead ? <View style={underLead ? s.lead : undefined}>
        <Appear index={0} animate={waiting.isNew(lead.id)}><FirstWaiting row={lead} onOpen={p.onOpen} /></Appear>
      </View> : null}
      {rows.map((item, index) => <Appear key={item.id} index={index + (lead ? 1 : 0)} animate={waiting.isNew(item.id)}>
        <WaitingRow row={item} onOpen={p.onOpen} last={index === rowCount - 1} />
      </Appear>)}
      {/* Dogovori/Aktivni lists a completed Dogovor until it is rated; Home names the same thing, verb first, and
          with exactly one it opens that rating in one tap instead of four (critique A1, 2026-09-24). */}
      {ratingsShown && ratings === 'unknown' ? <ListRow leading={<FactArt kind="star" size={32} />} title="Proveri ocene" subtitle="Nisu svi podaci o ocenama učitani."
        onPress={() => p.onRatings(null)} last accessibilityLabel="Proveri ocene u Dogovorima"
        accessibilityHint="Broj Dogovora za ocenjivanje trenutno nije potvrđen." />
        : ratingsShown && ratings === 'due' && home.ratingsDue ? <ListRow leading={<Marked art="star" attention />} title={oceniDogovore(home.ratingsDue)} last
          onPress={() => p.onRatings(home.ratingDueAgreementId)} accessibilityLabel={oceniDogovore(home.ratingsDue)}
          accessibilityHint={home.ratingDueAgreementId ? 'Otvara ocenu saradnje.' : 'Otvara Dogovore.'} /> : null}
      {more > 0 ? <T variant="note" tone="muted" style={s.more}>I još {more} u tvojim zadacima, prijavama i Dogovorima.</T> : null}
    </Section> : null}

    {/* A Dogovori read that failed says so here, never as an empty schedule; with no appointment ahead there is no block and no placeholder. */}
    {home?.agreements.kind === 'unavailable' ? <Section title="Sledeće"><Unavailable text="Ne možemo da učitamo Dogovore." /></Section> : null}

    {/* My lists stand in one group of rows directly under what is above, with the one section gap and no heading or line of their own. */}
    <View>
      <MineRow art="tasks" title="Moji zadaci" detail={tasksDetail} onPress={p.onMyTasks} />
      <MineRow art="offers" title="Moje prijave" detail={applicationsDetail} onPress={p.onMyApplications} last={!setupProfile && !switchShown} />
      {switchShown ? <AvailableNowRow control={p.availableNow!} last={!setupProfile} /> : null}
      {/* R20: until the work profile exists, one row says what it is for and opens its conversation. */}
      {setupProfile ? <ListRow leading={<FactArt kind="users" size={32} />} title="Podesi radni profil" subtitle="Dobijaš zadatke koji ti odgovaraju."
        onPress={() => p.onOpen({ kind: 'WORKER_PROFILE' })} last accessibilityLabel="Podesi radni profil. Dobijaš zadatke koji ti odgovaraju." /> : null}
    </View>
  </Screen>;
}

/** "Oceni završen Dogovor" / "Oceni 2 završena Dogovora" / "Oceni 5 završenih Dogovora": the verb leads (A1). */
function oceniDogovore(count: number): string {
  return count === 1 ? 'Oceni završen Dogovor'
    // plural() already carries the count; the emulator showed "2 2 završena Dogovora" when it was added twice.
    : `Oceni ${plural(count, 'završen Dogovor', 'završena Dogovora', 'završenih Dogovora')}`;
}

const s = StyleSheet.create({
  // Two doors 12 apart, the one gap between cards (`layout.group`); the 8 above them is the screen's own.
  actions: { gap: layout.group },
  // Two equal doors about 88 dp high (owner, 2026-10-07): the 64 dp picture between 12 dp of air above and below.
  door: { paddingVertical: sys.space.md, paddingHorizontal: sys.space.base, borderRadius: sys.radius.card,
    backgroundColor: sys.color.wash, justifyContent: 'center', borderWidth: 1, borderColor: sys.color.surface },
  doorMain: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  doorCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The one title that is not on the type scale: the door's own (the composition spec allows 22 here and nowhere else).
  doorTitle: { fontSize: 22, lineHeight: 27, fontWeight: '600', letterSpacing: -0.5, color: sys.color.ink },
  // Something waits here: the orange dot on the corner of its picture. The white ring keeps it apart from the drawing.
  attentionDot: { position: 'absolute', top: 0, right: 0, width: sys.space.sm, height: sys.space.sm, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.orange, borderWidth: 1, borderColor: sys.color.surface },
  // The appointment is a record; its parts stand 12 apart.
  appointment: { gap: layout.group },
  appointmentHead: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  // The record that leads "Čeka te" when no appointment is ahead: a card, so the rows under it stand one card-gap below.
  lead: { paddingBottom: layout.group },
  appointmentWhen: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The time leads, in black ("Danas · 14:00–16:00"), in the voice of money: `priceLarge` is 700 with tabular figures, so the clocks line up.
  appointmentDay: { color: sys.color.ink },
  appointmentPerson: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  appointmentName: { color: sys.color.ink, fontWeight: '600' },
  face: { width: FACE, height: FACE, flexShrink: 0, borderRadius: sys.radius.pill, overflow: 'hidden' },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  more: { paddingTop: sys.space.sm },
  recovery: { gap: sys.space.sm, alignItems: 'flex-start' },
});
