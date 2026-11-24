import { useRef, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { readableTitle } from '../../data/needDetailPresentation';
import { Avatar } from '../system/Avatar';
import { FactArt, type FactArtKind } from '../system/FactArt';
import type { HomeRaspored, HomeRow, HomeSection, HomeSnapshot, HomeTarget } from '../../data/homeSnapshot';
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
import { SkeletonList } from '../system/Skeleton';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { TaskCard } from '../v2/TaskCard';
import { TaskPublisherPortrait } from '../v2/TaskPublisherPortrait';
import { OwnTaskCard } from '../v2/OwnTaskCard';
import { ApplicationCard } from '../v2/ApplicationFace';
import { AgreementRow } from '../agreements/AgreementListCard';
import { sys } from '../system/tokens';
import { plural, prijava } from '../system/plural';
import { useLayoutClass } from '../system/textScale';
import { usePullRefresh } from '../system/usePullRefresh';
import { HomeLaunchArt } from './HomeLaunchArt';
import { HowItWorks } from './HowItWorks';

/** Two main actions, the next appointment, the carousels and the account's lists.
 * "Čeka Vas" was removed by the owner (2026-11-20); failures retain explicit recovery. One account owns both roles.
 */
export type HomePresentationProps = {
  /** Only the focused live route starts decorative motion; galleries stay still. */
  active?: boolean;
  home: HomeSnapshot | null; loading: boolean; refreshing: boolean; error: boolean;
  /**
   * The last read failed but what is on screen is the last one that worked (the route keeps it through a failed re-read): the
   * screen says so in one line and keeps the content (R31). `error` is the other case, where there is nothing to show.
   */
  stale?: boolean;
  /** Internal galleries supply the same chrome with an inert bell; the live header remains the default. */
  header?: ReactNode;
  /** Account-owned AI conversations, read separately from tasks and decisions. */
  intakeResume?: ReactNode;
  onPublish: () => void; onEarn: () => void; onProfile: () => void; onOpen: (target: HomeTarget) => void;
  /**
   * What waits for my rating. With the one Dogovor's id (the Dogovori read already gave it) the route opens that
   * rating; with null — several, or none known — it opens Dogovori, where each one waits (critique A1, 2026-09-24).
   */
  onRatings: (agreementId: string | null) => void;
  onMyTasks: () => void; onMyApplications: () => void; onRefresh: () => void;
  onAgreements?: () => void;
  /**
   * The face of the other person in the card of the next Dogovor. The route hands over the element that reads their photo (a data
   * client), exactly as it hands over the header's avatar; the presentation passes the stand-in it would draw itself
   * (their initials, or a drawn person). Without it, or without a profile id, the stand-in is the face.
   */
  photo?: (profileId: string, standIn: ReactNode) => ReactNode;
  workProfileRead?: HomeOptionalRead;
};

type HomeOptionalRead = { loading: boolean; refreshing: boolean; error: boolean; stale: boolean; onRetry: () => void };

/** The work-profile read recovers independently from the account's core overview. */
function WorkProfileReadState({ state }: { state?: HomeOptionalRead }) {
  if (!state || !state.loading && !state.refreshing && !state.error && !state.stale) return null;
  return <View testID="home-worker-read" style={s.recovery}>
    <T variant="note" tone="muted" accessibilityRole={state.error || state.stale ? 'alert' : undefined}>
      {state.loading ? 'Učitavamo radni profil…'
        : state.refreshing ? 'Osvežavamo radni profil…'
          : state.stale ? 'Radni profil nije osvežen. Prikazano je poslednje učitano.' : 'Radni profil trenutno nije učitan.'}
    </T>
    {state.error || state.stale || state.refreshing ? <V2Action kind="quiet" compact tone="neutral" label="Osvežite radni profil"
      loading={state.refreshing} disabled={state.loading || state.refreshing} onPress={state.onRetry} /> : null}
  </View>;
}

/** Illustrations identify the two intentions; text and touch area grow independently. */
const DOOR_ART = 48;

/** Equal intentions, without a persistent account role. Large text uses full-width rows. */
function StartActions({ onPublish, onEarn }: { onPublish: () => void; onEarn: () => void }) {
  const { stacked } = useLayoutClass();
  return <View testID="home-intentions" style={[s.actions, stacked && s.actionsStacked]}>
    <Press accessibilityRole="button" accessibilityLabel="Objavi zadatak"
      haptic="select" onPress={onPublish} scaleTo={sys.motion.scale.row} style={[s.door, stacked && s.doorStacked]}>
      <View style={[s.doorMain, stacked && s.doorMainStacked]}>
        <HomeLaunchArt kind="publish" size={DOOR_ART} />
        <T variant="heading" style={s.doorTitle}>Objavi zadatak</T>
      </View>
    </Press>
    <Press accessibilityRole="button" accessibilityLabel="Uskoči i zaradi"
      haptic="select" onPress={onEarn} scaleTo={sys.motion.scale.row} style={[s.door, stacked && s.doorStacked]}>
      <View style={[s.doorMain, stacked && s.doorMainStacked]}>
        <HomeLaunchArt kind="discover" size={DOOR_ART} />
        <T variant="heading" style={s.doorTitle}>Uskoči i zaradi</T>
      </View>
    </Press>
  </View>;
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


/** A front door to one of my lists: its name and, once read, what is in it. It opens the list even when unread. */
function MineRow({ art, title, detail, onPress, last = false }: {
  art: FactArtKind; title: string; detail: string | null; onPress: () => void; last?: boolean;
}) {
  return <ListRow leading={<FactArt kind={art} size={32} />} title={title} subtitle={detail ?? undefined} onPress={onPress} last={last}
    accessibilityLabel={detail ? `${title}. ${detail}` : title} />;
}

/** No optimistic availability toggle: the status changes after AI review and Save. */
/** Said once and quietly: a part of the overview that could not be read names itself, and the shared recovery above retries it. */
function Unavailable({ text }: { text: string }) {
  return <T accessibilityLiveRegion="polite" variant="note" tone="muted">{text}</T>;
}

/**
 * The first read has a calm, truthful status. Its height roughly reserves the old two-row footprint, but no grey shapes suggest
 * that an appointment or pending decision exists before the read confirms one. It stands after the stable doors and list entries:
 * an empty first result therefore cannot pull those controls into a new position merely by removing a placeholder above them.
 */
const INITIAL_READ_HEIGHT = sys.type.heading.lineHeight + layout.group + layout.rowMin * 2;
function HomeInitialLoading() {
  // Owner, 24.11.2026: the shape of what is coming (a heading and two cards), not a spinner on an empty area, so nothing jumps.
  return <View testID="home-initial-loading" accessibilityLiveRegion="polite" style={s.initialLoading}>
    <SkeletonList variant="record" count={2} foot label="Učitavamo Vaš pregled" />
  </View>;
}

/**
 * "8 aktivnih · 1 nacrt" — the sets of "Moji zadaci", counted by the list's own filter, each with its number (the blueprint of 8 Oct
 * 2026, Z1).
 */
function tasksLine(section: HomeSection<OwnedTaskCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nedostupno';
  const c = section.value;
  const parts = [c.active ? plural(c.active, 'aktivan', 'aktivna', 'aktivnih') : null,
    c.drafts ? plural(c.drafts, 'nacrt', 'nacrta', 'nacrta') : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : c.total ? 'Nema aktivnih zadataka' : 'Još nemate zadatak';
}
/**
 * "1 čeka odgovor" — the applications that are open and wait for the other side's answer, counted by the list's own tabs (the blueprint
 * of 8 Oct 2026, Z1 and U8: "Čeka odgovor" is the list's first group). An application that waits for me sits in the list's own "Čeka Vas"
 * set, not among these, so a row with none waiting that is not all finished names how many applications there are instead of saying
 * that none waits over one that does.
 */
function applicationsLine(section: HomeSection<ApplicationCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nedostupno';
  const c = section.value;
  if (c.active) return plural(c.active, 'čeka odgovor', 'čekaju odgovor', 'čeka odgovor');
  return !c.total ? 'Još nemate prijavu' : c.finished === c.total ? 'Nijedna ne čeka odgovor' : prijava(c.total);
}

export function HomePresentation(p: HomePresentationProps) {
  const home = p.home;
  const { stacked } = useLayoutClass();
  // A row that was already here when the screen opened has nothing to tell you by sliding in; only a genuinely new one moves,
  // and each list remembers what it has already shown. The first rows after the initial read are news and arrive once (B1).
  const agreements = useAppear();
  const sawInitialLoading = useRef(false);
  if (p.loading && !home) sawInitialLoading.current = true;
  // Raspored holds the one next appointment that has its day-first words, as a card, and nothing else. With none ahead there is no block
  // (the count of Dogovori with no day, `quietLine`, is no longer drawn here: a weak row, 8 Oct 2026); an active Dogovor is not lost for it,
  const next = home?.agreements.kind === 'known' ? home.agreements.value.rows[0] ?? null : null;
  const raspored = next?.raspored;
  agreements.settle(next && raspored ? [next.id] : []);
  // Before the first answer a front door has no line; after a failed read it says so, never "0".
  const tasksDetail = home ? tasksLine(home.mine.tasks) : p.error ? 'Trenutno nedostupno' : null;
  const applicationsDetail = home ? applicationsLine(home.mine.applications) : p.error ? 'Trenutno nedostupno' : null;
  const profile = home?.workerProfile?.kind === 'known' ? home.workerProfile.value : null;
  const setupProfile = !!profile && (profile.state === 'NONE' || profile.state === 'DRAFT');
  const recovery = p.stale ? 'stale' as const : home?.partial ? 'partial' as const : p.error && !home ? 'failed' as const : null;
  // The pull spinner is for a pull. "Osvežite pregled" has a spinner of its own, and no read the route starts by itself may raise the white
  // disc of Android's pull at the top of the screen (the owner's phone, 8 Oct 2026).
  const pull = usePullRefresh(p.onRefresh, p.refreshing);
  return <><Screen kind="root" background="wash" header={p.header ?? <ScreenHeader title="Početna" onProfile={p.onProfile} />}
    contentStyle={{ paddingBottom: 100 }}
    refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
    {recovery ? <Surface kind="note" testID="home-recovery" style={s.recovery}>
      <T accessibilityRole="alert" variant="note">{recovery === 'stale' ? 'Nema veze. Prikazano je poslednje učitano.'
        : recovery === 'partial' ? 'Deo pregleda trenutno nije učitan.' : 'Pregled nije učitan. Proverite vezu i pokušajte ponovo.'}</T>
      <V2Action label="Osvežite pregled" kind="secondary" compact loading={p.refreshing} disabled={p.loading || p.refreshing} onPress={p.onRefresh} />
    </Surface> : null}
    <StartActions onPublish={p.onPublish} onEarn={p.onEarn} />

    {/* Accepted appointments lead only when explicit raspored exists */}
    {next && raspored ? <Section title="Sledeće">
      <Appear index={0} animate={agreements.isNew(next.id)}><RasporedCard row={next} raspored={raspored} photo={p.photo} onOpen={p.onOpen} /></Appear>
    </Section> : null}

    {/* A Dogovori read that failed says so here, never as an empty schedule; with no appointment ahead there is no block and no placeholder. */}
    {home?.agreements.kind === 'unavailable' ? <Section title="Sledeće"><Unavailable text="Ne možemo da učitamo Dogovore." /></Section> : null}

    {home?.opportunityItems && home.opportunityItems.length > 0 ? <Section title="Prilike za Vas"
      action={{ label: 'Mapa zadataka', onPress: p.onEarn }}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.carousel} style={s.carouselScroll}>
        {home.opportunityItems.map(item => <View key={item.id} style={s.carouselCard}>
          <TaskCard item={item} portrait={<TaskPublisherPortrait item={item} size={40} />}
            onOpen={() => p.onOpen({ kind: 'OPPORTUNITY', needId: item.id })} />
        </View>)}
      </ScrollView>
    </Section> : null}

    {home?.agreementItems && home.agreementItems.length > 0 ? <Section title="Aktuelni dogovori"
      action={{ label: 'Svi dogovori', onPress: p.onAgreements ?? (() => p.onRatings(null)) }}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.carousel} style={s.carouselScroll}>
        {home.agreementItems.map((item, index) => <View key={item.id} style={s.carouselCard}>
          <AgreementRow item={item} index={index} now={Date.now()} animate={false} stale={!!p.stale}
            onOpen={row => p.onOpen({ kind: 'AGREEMENT', agreementId: row.id })}
            onRate={row => p.onRatings(row.id)} />
        </View>)}
      </ScrollView>
    </Section> : null}

    {home?.ownTaskItems && home.ownTaskItems.length > 0 ? <Section title="Vaši objavljeni zadaci"
      action={{ label: 'Svi zadaci', onPress: p.onMyTasks }}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.carousel} style={s.carouselScroll}>
        {home.ownTaskItems.map(item => <View key={item.id} style={s.carouselCard}>
          <OwnTaskCard item={item}
            onOpen={() => p.onOpen({ kind: 'NEED', needId: item.id })}
            onApplications={() => p.onOpen({ kind: 'CANDIDATES', needId: item.id })} />
        </View>)}
      </ScrollView>
    </Section> : null}

    {home?.applicationItems && home.applicationItems.length > 0 ? <Section title="Vaše prijave"
      action={{ label: 'Sve prijave', onPress: p.onMyApplications }}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.carousel} style={s.carouselScroll}>
        {home.applicationItems.map(row => <View key={row.prijavaId} style={s.carouselCard}>
          <ApplicationCard row={row}
            onTask={() => p.onOpen({ kind: 'APPLICATION', applicationId: row.prijavaId })}
            onAgreement={() => row.dogovorId ? p.onOpen({ kind: 'AGREEMENT', agreementId: row.dogovorId }) : p.onOpen({ kind: 'APPLICATION', applicationId: row.prijavaId })}
            onWithdraw={() => p.onOpen({ kind: 'APPLICATION', applicationId: row.prijavaId })}
            onReview={() => p.onOpen({ kind: 'APPLICATION', applicationId: row.prijavaId })} />
        </View>)}
      </ScrollView>
    </Section> : null}

    {/* My lists stand in one group of rows directly under what is above, with the one section gap and no heading or line of their own. */}
    <View style={s.mineGroup}>
      <MineRow art="tasks" title="Moji zadaci" detail={tasksDetail} onPress={p.onMyTasks} />
      <MineRow art="applications" title="Moje prijave" detail={applicationsDetail} onPress={p.onMyApplications} last={!setupProfile} />
      <WorkProfileReadState state={p.workProfileRead} />
      {/* R20: until the work profile exists, one row says what it is for and opens its conversation. */}
      {setupProfile ? <ListRow leading={<FactArt kind="users" size={32} />} title="Podesite radni profil" subtitle="Dobijate zadatke koji Vam odgovaraju."
        onPress={() => p.onOpen({ kind: 'WORKER_PROFILE' })} last accessibilityLabel="Podesite radni profil. Dobijate zadatke koji Vam odgovaraju." /> : null}
    </View>
    {p.loading && !home ? <HomeInitialLoading /> : null}
    {home?.firstRun ? <HowItWorks stacked={stacked} /> : null}
  </Screen>
  </>;
}


const s = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: layout.group },
  actionsStacked: { flexDirection: 'column' },
  door: {
    flex: 1,
    minWidth: 0,
    minHeight: 110,
    paddingVertical: sys.space.base,
    paddingHorizontal: sys.space.md,
    borderRadius: sys.radius.card,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  doorStacked: { flex: 0 },
  publishDoor: { backgroundColor: '#FFFFFF' },
  earnDoor: { backgroundColor: '#FFFFFF' },
  doorMain: { alignItems: 'center', justifyContent: 'center', gap: sys.space.sm },
  doorMainStacked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  doorCopy: { flexShrink: 1, minWidth: 0, gap: sys.space.xs, alignItems: 'center' },
  doorTitle: { color: sys.color.ink, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  // The appointment is a record; its parts stand 12 apart.
  appointment: { gap: layout.group },
  appointmentHead: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  appointmentWhen: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The time leads, in black ("Danas · 14:00–16:00"), in the voice of money: `priceLarge` is 700 with tabular figures, so the clocks line up.
  appointmentDay: { color: sys.color.ink },
  appointmentPerson: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  appointmentName: { color: sys.color.ink, fontWeight: '600' },
  face: { width: FACE, height: FACE, flexShrink: 0, borderRadius: sys.radius.pill, overflow: 'hidden' },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  more: { paddingTop: sys.space.sm },
  recovery: { gap: sys.space.sm, alignItems: 'flex-start' },
  initialLoading: { minHeight: INITIAL_READ_HEIGHT },
  initialLoadingText: { textAlign: 'center' },
  carouselScroll: { marginHorizontal: -layout.gutter },
  carousel: { gap: layout.group, paddingVertical: sys.space.xs, paddingHorizontal: layout.gutter, alignItems: 'stretch' },
  carouselCard: { width: 321, minHeight: 256, flexShrink: 0 },
  mineGroup: { gap: sys.space.sm },
});
