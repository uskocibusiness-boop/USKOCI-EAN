import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { readableTitle } from '../../data/needDetailPresentation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Glyph } from '../system/Glyph';
import { FactArt, type FactArtKind } from '../system/FactArt';
import type { HomeAttention, HomeRow, HomeSection, HomeSnapshot, HomeTarget } from '../../data/homeSnapshot';
import type { OwnedTaskCounts } from '../../data/marketplaceView';
import type { ApplicationCounts } from '../../data/myApplicationsView';
import { ScreenHeader } from '../system/ScreenHeader';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { materialControl, sys } from '../system/tokens';
import { plural, prijava } from '../system/plural';
import { useTextScale } from '../system/textScale';
import { HomeLaunchArt } from './HomeLaunchArt';

/** Home presents two intentions and the account's real next actions. It never infers
 * earnings, creates another user role, or makes failed reads look like empty lists.
 * Start actions remain available before the overview has loaded. */
export type HomePresentationProps = {
  home: HomeSnapshot | null; loading: boolean; refreshing: boolean; error: boolean;
  /** Internal galleries supply the same chrome with an inert bell; the live header remains the default. */
  header?: ReactNode;
  onPublish: () => void; onEarn: () => void; onProfile: () => void; onOpen: (target: HomeTarget) => void;
  /**
   * What waits for my rating. With the one Dogovor's id (the Dogovori read already gave it) the route opens that
   * rating; with null — several, or none known — it opens Dogovori, where each one waits (critique A1, 2026-09-24).
   */
  onRatings: (agreementId: string | null) => void;
  onMyTasks: () => void; onMyApplications: () => void; onRefresh: () => void;
};

/** Equal doors: original artwork leads, then the intention and one short explanation. */
function StartActions({ compact, onPublish, onEarn }: {
  compact: boolean; onPublish: () => void; onEarn: () => void;
}) {
  const textScale = useTextScale();
  // Share an art/content-sized minimum. Wrapped text grows naturally; do not reserve
  // four empty lines when Android large text still renders both labels on one line.
  const minHeight = Math.ceil(2 * sys.space.lg + Math.max(compact ? 64 : 96,
    27 * textScale + sys.space.sm + 20 * textScale));
  return <View style={s.actions}>
    <Press accessibilityRole="button" accessibilityLabel="Objavi zadatak" accessibilityHint="Opiši šta ti treba."
      haptic="select" onPress={onPublish} scaleTo={sys.motion.scale.row} style={[s.createEntry, materialControl.raised, { minHeight }]}>
      <View style={s.createMain}>
        <HomeLaunchArt kind="publish" size={compact ? 64 : 96} />
        <View style={s.actionCopy}>
          <T accessibilityRole="header" style={s.actionTitle}>Objavi zadatak</T>
          <T style={s.actionSubtitle} tone="muted">Opiši šta ti treba.</T>
        </View>
      </View>
    </Press>
    <Press accessibilityRole="button" accessibilityLabel="Uskoči i zaradi" accessibilityHint="Nađi posao blizu."
      haptic="select" onPress={onEarn} scaleTo={sys.motion.scale.row} style={[s.createEntry, materialControl.raised, { minHeight }]}>
      <View style={s.createMain}>
        <HomeLaunchArt kind="discover" size={compact ? 64 : 96} />
        <View style={s.actionCopy}>
          <T accessibilityRole="header" style={s.actionTitle}>Uskoči i zaradi</T>
          <T style={s.actionSubtitle} tone="muted">Pronađi posao.</T>
        </View>
      </View>
    </Press>
  </View>;
}

function AttentionRow({ row, onOpen, last = false }: {
  row: HomeAttention; onOpen: (target: HomeTarget) => void; last?: boolean;
}) {
  // The same coloured illustration the cards use for this kind of thing (owner, 2026-09-23: thin grey glyphs sat here while the rest of the app was illustrated).
  const art: FactArtKind = row.target.kind === 'CANDIDATES' ? 'users'
    : row.target.kind === 'APPLICATION' ? 'offers' : row.target.kind === 'AGREEMENT' ? 'agreements' : 'tasks';
  const taskTitle = row.taskTitle === undefined ? null : readableTitle(row.taskTitle);
  const compactCandidates = !!taskTitle && row.target.kind === 'CANDIDATES';
  return <Press accessibilityRole="button" accessibilityLabel={[readableTitle(row.title), taskTitle, row.detail].filter(Boolean).join('. ')} haptic="select" scaleTo={0.99}
    onPress={() => onOpen(row.target)} style={[s.row, last && s.lastRow]}>
    <View style={[s.rowIcon, s.attentionIcon]}>
      <FactArt kind={art} size={32} />
      {/* Something here waits for me: an orange dot on the picture, the one mark of attention (B1). */}
      <View style={s.attentionDot} />
    </View>
    <View style={s.rowCopy}>
      {taskTitle ? <T variant="bodyStrong">{taskTitle}</T> : null}
      <T variant={taskTitle ? 'meta' : 'bodyStrong'} tone={taskTitle ? 'muted' : 'ink'}>
        {compactCandidates ? `${readableTitle(row.title)} · ${row.detail}` : readableTitle(row.title)}</T>
      {!compactCandidates ? <T variant="note" tone="muted">{row.detail}</T> : null}
    </View>
    <View style={s.rowDirection}><Glyph name="caret-right" tone="muted" /></View>
  </Press>;
}

/** The projection's time can be exact, flexible or absent; no date is extracted from a display sentence. */
function AppointmentCard({ row, onOpen }: {
  row: HomeRow; onOpen: (target: HomeTarget) => void;
}) {
  const appointment = row.appointment;
  return <Press accessibilityRole="button" accessibilityLabel={`${readableTitle(row.title)}. ${row.detail}`}
    accessibilityHint="Otvara Dogovor." haptic="select" scaleTo={0.99} onPress={() => onOpen(row.target)} style={s.appointment}>
    <View style={s.appointmentHead}>
      <T variant="cardTitle" style={s.appointmentTitle}>{readableTitle(row.title)}</T>
      <View style={s.appointmentDirection}><Glyph name="caret-right" tone="muted" /></View>
    </View>
    {appointment ? <>
      {appointment.timeText ? <View style={s.appointmentWhen}>
        <FactArt kind="calendar" size={28} cut="art" role="time" />
        <T variant="note" style={s.appointmentTime}>{appointment.timeText}</T>
      </View> : null}
      {appointment.counterpartName || appointment.roleLabel ? <View style={s.appointmentPerson}>
        {appointment.counterpartName ? <T variant="note" style={s.appointmentName}>{appointment.counterpartName}</T> : null}
        {appointment.roleLabel ? <T variant="note" tone="muted">{appointment.roleLabel}</T> : null}
      </View> : null}
    </> : <T variant="note" tone="muted">{row.detail}</T>}
  </Press>;
}

/** A front door to one of my lists: its name and, once read, what is in it. It opens the list even when unread. */
function MineRow({ art, title, detail, onPress, last = false }: {
  art: FactArtKind; title: string; detail: string | null; onPress: () => void; last?: boolean;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={detail ? `${title}. ${detail}` : title} haptic="select" scaleTo={0.99}
    onPress={onPress} style={[s.row, last && s.lastRow]}>
    <View style={s.mineIcon}><FactArt kind={art} size={32} /></View>
    <View style={s.rowCopy}>
      <T variant="bodyStrong">{title}</T>
      {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    </View>
    <Glyph name="caret-right" tone="muted" />
  </Press>;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return <View style={s.section}>
    <View style={s.sectionHead} accessible accessibilityRole="header"
      accessibilityLabel={count != null && count > 0 ? `${title}: ${plural(count, 'stavka', 'stavke', 'stavki')}` : title}>
      <T variant="heading" style={[s.flexible, s.sectionTitle]}>{title}</T>
      {count != null && count > 0 ? <View style={s.counter}><T variant="meta" style={s.link}>{count}</T></View> : null}
    </View>
    {children}
  </View>;
}

/** Each missing section names itself; the shared recovery action retries the same four reads once. */
function Unavailable({ what }: { what: string }) {
  return <View style={s.unavailable}>
    <T accessibilityLiveRegion="polite" variant="note" tone="muted">{`${what} trenutno nisu učitani.`}</T>
  </View>;
}

const Skeleton = () => <View accessibilityLabel="Učitavanje" style={s.skeletonBlock}>
  {[0, 1].map(index => <View key={index} style={s.skeletonRow} />)}
</View>;

// The two doors count what their lists hold, never what waits: that is said once, under "Čeka te", from the server's
// own attention list (PKG-042: no inference fallback). A door that also said "1 čeka izbor" contradicted a known empty
// "Čeka te", and stood in for it when that list could not be read.
/** "2 aktivna · 1 nacrt" — the sets of "Moji zadaci", counted by the list's own filter. */
function tasksLine(section: HomeSection<OwnedTaskCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nisu učitani';
  const c = section.value;
  const parts = [c.active ? plural(c.active, 'aktivan', 'aktivna', 'aktivnih') : null,
    c.drafts ? plural(c.drafts, 'nacrt', 'nacrta', 'nacrta') : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : c.total ? 'Nema aktivnih zadataka' : 'Još nemaš Zadatak';
}
/**
 * "3 aktivne" — the "Aktivne" set of "Moje prijave", counted by the list's own tabs. An application that waits for me
 * sits in the list's own "Čeka te" set, not in "Aktivne", so a door with nothing active that is not all finished names
 * how many applications there are instead of saying "Nema aktivnih prijava" over one that waits.
 */
function applicationsLine(section: HomeSection<ApplicationCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nisu učitane';
  const c = section.value;
  if (c.active) return plural(c.active, 'aktivna', 'aktivne', 'aktivnih');
  return !c.total ? 'Još nemaš prijavu' : c.finished === c.total ? 'Nema aktivnih prijava' : prijava(c.total);
}

export function HomePresentation(p: HomePresentationProps) {
  const home = p.home;
  const { width } = useWindowDimensions();
  // Rounded, because Android reports its "Large" text as 1.2999999523 and the raw value never reached 1.3.
  const stacked = useTextScale() >= 1.3 || width < 340;
  // A row that was already here when the screen opened has nothing to tell you by sliding in; only a
  // genuinely new one moves, and each list remembers what it has already shown.
  const waiting = useAppear(), agreements = useAppear();
  waiting.settle((home?.attention ?? []).map(item => item.id));
  const next = home?.agreements.kind === 'known' ? home.agreements.value.rows[0] ?? null : null;
  agreements.settle(next ? [next.id] : []);
  const attentionUnavailable = home?.attentionState === 'unavailable';
  // Ratings share the next-action section but are not part of the server attention count.
  // Show that count only when no ratings are waiting and their read is complete.
  const waitingShown = !!home && (attentionUnavailable || home.attention.length > 0 || home.ratingsDue === null || home.ratingsDue > 0);
  // Before the first answer a front door has no line; after a failed read it says so, never "0".
  const tasksDetail = home ? tasksLine(home.mine.tasks) : p.error ? 'Trenutno nisu učitani' : null;
  const applicationsDetail = home ? applicationsLine(home.mine.applications) : p.error ? 'Trenutno nisu učitane' : null;
  const recoveryNeeded = p.error || home?.partial;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.canvas}>
    {/* Shared root chrome: identity, notifications and the account's real avatar. */}
    {p.header ?? <ScreenHeader title="Početna" onProfile={p.onProfile} />}
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
      <StartActions compact={stacked} onPublish={p.onPublish} onEarn={p.onEarn} />

      {p.loading && !home ? <Skeleton /> : null}
      {recoveryNeeded ? <View style={s.recovery}>
        <T accessibilityRole="alert" variant="note" tone="muted">{home ? 'Deo pregleda trenutno nije učitan.' : 'Pregled trenutno nije učitan.'}</T>
        <V2Action label="Osveži pregled" kind="secondary" compact loading={p.refreshing} disabled={p.loading || p.refreshing} onPress={p.onRefresh} />
      </View> : null}
      {home && waitingShown ? <Section title="Čeka te"
        count={home.ratingsDue === 0 && home.attention.length > 0 && (home.attentionState === 'known' || !home.partial)
          ? home.attention.length + home.attentionMore : undefined}>
        {attentionUnavailable ? <Unavailable what="Podaci o obavezama" /> : null}
        {home.attention.length > 0 ? <View style={s.attention}>
          {home.attention.map((item, index) => <Appear key={item.id} index={index} animate={waiting.isNew(item.id)}>
            <AttentionRow row={item} onOpen={p.onOpen} last={index === home.attention.length - 1} /></Appear>)}
        </View> : null}
        {home.attentionMore > 0 ? <T variant="note" tone="muted" style={s.more}>I još {home.attentionMore} u tvojim zadacima, prijavama i Dogovorima.</T> : null}
        {/* Dogovori/Aktivni lists a completed Dogovor until it is rated; Home names the same thing, verb first, and
            with exactly one it opens that rating in one tap instead of four (critique A1, 2026-09-24). */}
        {home.ratingsDue === null ? <Press accessibilityRole="button" haptic="select" style={s.ratingsDue}
          onPress={() => p.onRatings(null)} accessibilityLabel="Proveri ocene u Dogovorima"
          accessibilityHint="Broj Dogovora za ocenjivanje trenutno nije potvrđen.">
          <FactArt kind="star" size={24} />
          <View style={{ flex: 1 }}><T variant="note" style={s.ratingsDueText}>Proveri ocene</T>
            <T variant="meta" tone="muted">Nisu svi podaci o ocenama učitani.</T></View>
          <Glyph name="caret-right" tone="muted" />
        </Press> : home.ratingsDue > 0 ? <Press accessibilityRole="button" haptic="select" style={s.ratingsDue}
          onPress={() => p.onRatings(home.ratingDueAgreementId)}
          accessibilityLabel={oceniDogovore(home.ratingsDue)}
          accessibilityHint={home.ratingDueAgreementId ? 'Otvara ocenu saradnje.' : 'Otvara Dogovore.'}>
          <FactArt kind="star" size={24} />
          <T variant="note" style={s.ratingsDueText}>{oceniDogovore(home.ratingsDue)}</T>
          <Glyph name="caret-right" tone="muted" />
        </Press> : null}
      </Section> : null}

      {/* Only a future accepted term is "next"; other active Agreements retain a neutral heading. */}
      {home?.agreements.kind === 'unavailable' ? <Section title="Dogovori"><Unavailable what="Dogovori" /></Section>
        : next ? <Section title={next.upcoming ? 'Sledeći Dogovor' : 'Aktivni Dogovor'}>
          <Appear index={0} animate={agreements.isNew(next.id)}><AppointmentCard row={next} onOpen={p.onOpen} /></Appear>
        </Section> : null}

      <View style={s.mine}>
        <MineRow art="tasks" title="Moji zadaci" detail={tasksDetail} onPress={p.onMyTasks} />
        <MineRow art="offers" title="Moje prijave" detail={applicationsDetail} onPress={p.onMyApplications} last />
      </View>
    </ScrollView>
  </SafeAreaView>;
}


/** "Oceni završen Dogovor" / "Oceni 2 završena Dogovora" / "Oceni 5 završenih Dogovora": the verb leads (A1). */
function oceniDogovore(count: number): string {
  return count === 1 ? 'Oceni završen Dogovor'
    // plural() already carries the count; the emulator showed "2 2 završena Dogovora" when it was added twice.
    : `Oceni ${plural(count, 'završen Dogovor', 'završena Dogovora', 'završenih Dogovora')}`;
}

const s = StyleSheet.create({
  // A rating is still a real pending action, but its illustration and words carry the accent, not a tinted band.
  ratingsDue: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 52, marginTop: sys.space.sm,
    paddingVertical: sys.space.md, backgroundColor: sys.color.surface },
  ratingsDueText: { flex: 1, color: sys.color.ink, fontWeight: '500' },
  canvas: { flex: 1, backgroundColor: sys.color.ground },
  // The bottom padding leaves air between the last row and the inset tab bar below the list when it is scrolled to its end.
  content: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.huge, width: '100%', maxWidth: 640, alignSelf: 'center' },
  flexible: { flexShrink: 1 }, muted: { color: sys.color.muted },
  actions: { gap: sys.space.base, paddingTop: sys.space.sm },
  createEntry: { padding: sys.space.lg, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, justifyContent: 'center',
    borderWidth: 1, borderColor: sys.color.surface,
    gap: sys.space.md },
  createMain: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  actionCopy: { flex: 1, minWidth: 0, gap: sys.space.sm },
  actionTitle: { fontSize: 22, lineHeight: 27, fontWeight: '600', letterSpacing: -0.5, color: sys.color.ink },
  actionSubtitle: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  // Attention is an open inbox: the subject leads, with the exact action/reason below, never truncated.
  attention: { backgroundColor: sys.color.surface },
  section: { marginTop: sys.space.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 28, marginBottom: sys.space.md },
  sectionTitle: { ...sys.type.heading, color: sys.color.ink },
  counter: { minWidth: 28, minHeight: 28, paddingHorizontal: sys.space.xs,
    backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  link: { color: sys.color.muted, ...sys.type.meta, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 64, paddingVertical: sys.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  lastRow: { borderBottomWidth: 0 },
  rowIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  attentionIcon: { width: 40, height: 40, backgroundColor: sys.color.surface },
  rowDirection: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  attentionDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.orange, borderWidth: 1, borderColor: sys.color.surface },
  // One outline identifies the upcoming appointment. Its work, time and person need no nested rails or panels.
  appointment: { borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.cardLine,
    backgroundColor: sys.color.surface, padding: sys.space.base, gap: sys.space.md },
  appointmentHead: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  appointmentTitle: { flex: 1, minWidth: 0, ...sys.type.cardTitle, color: sys.color.ink },
  appointmentDirection: { width: 24, height: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  appointmentWhen: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  appointmentTime: { flex: 1, minWidth: 0, color: sys.color.muted, fontWeight: '400', fontVariant: ['tabular-nums'] },
  appointmentPerson: { gap: 2 },
  appointmentName: { color: sys.color.ink, fontWeight: '600' },
  rowCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // Open navigation rows: the illustrated icons supply color, without a tinted group behind them.
  mine: { marginTop: sys.space.xxl, backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line,
    paddingTop: sys.space.xs },
  mineIcon: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.surface,
    alignItems: 'center', justifyContent: 'center' },
  more: { paddingVertical: sys.space.sm },
  unavailable: { gap: sys.space.xs, paddingVertical: sys.space.md, alignItems: 'flex-start' },
  recovery: { marginTop: sys.space.lg, gap: sys.space.sm, alignItems: 'flex-start' },
  skeletonBlock: { marginTop: sys.space.xxl, gap: sys.space.base },
  skeletonRow: { height: 64, borderRadius: sys.radius.cardCompact, backgroundColor: sys.color.skeleton },
});
