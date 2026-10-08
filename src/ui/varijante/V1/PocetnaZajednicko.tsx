import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, Switch, View } from 'react-native';
import { readableTitle } from '../../../data/needDetailPresentation';
import type { HomeRaspored, HomeRow, HomeSection, HomeSnapshot } from '../../../data/homeSnapshot';
import type { OwnedTaskCounts } from '../../../data/marketplaceView';
import type { ApplicationCounts } from '../../../data/myApplicationsView';
import { HomeLaunchArt } from '../../home/HomeLaunchArt';
import { Press } from '../../Press';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { FactArt } from '../../system/FactArt';
import { Glyph } from '../../system/Glyph';
import { ListRow } from '../../system/ListRow';
import { useReducedMotion } from '../../system/motion';
import { plural, prijava } from '../../system/plural';
import { ChromeIconButton, ScreenChrome } from '../../system/ScreenChrome';
import { Surface } from '../../system/Surface';
import { TAB_BAR_PADDING, TAB_CAPSULE, TAB_ITEM_BOTTOM, TAB_ITEM_PADDING, TAB_ITEM_TOP, TabCapsule, TabGlyph, TabLabel, tabBarHeight, tabBarSurface } from '../../system/TabBarItem';
import { useTextScale } from '../../system/textScale';
import { layout } from '../../system/layout';
import { materialControl, sys } from '../../system/tokens';
import { DahVar } from './DahVar';
import { inOutQuad, type Kadar } from './kadar';

/**
 * What the three Početna variants share and may NOT change (V1, creative direction 2026-10-08): the LOCKED parts, copied
 * verbatim from `HomePresentation` because they are not exported there and no existing file is touched in this phase, and the
 * small pieces every variant draws the same way. The doors (`VrataVar`) and the header are the HOME signature and are
 * byte-for-byte the production composition (including the one title size off the type scale, 22/27, which the composition spec
 * allows there and nowhere else). If a variant is chosen, the production screen keeps its own `StartActions`; these copies go.
 */
export const noop = () => undefined;

/** The picture of a front door. 64 dp sets both doors' height (owner, 2026-10-07: smaller doors, about 88 dp). */
const DOOR_ART = 64;

/** LOCKED: the two doors, exactly as `HomePresentation.StartActions` draws them. */
export function VrataVar({ onPublish, onEarn }: { onPublish: () => void; onEarn: () => void }) {
  const textScale = useTextScale();
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

/** LOCKED: the root chrome of Početna with an inert bell, as the production gallery draws it. */
export function PocetnaTraka() {
  return <ScreenChrome variant="root" title="Početna" onProfile={noop}
    bell={<ChromeIconButton label="Obaveštenja · primer" glyph="notifications" tone="green" onPress={noop} />} />;
}

type TabKind = Parameters<typeof TabGlyph>[0]['kind'];
const TABS: readonly { kind: TabKind; title: string }[] = [{ kind: 'home', title: 'Početna' }, { kind: 'map', title: 'Zadaci' }, { kind: 'agreements', title: 'Dogovori' }];

/**
 * A STILL stand-in for the tab bar (Početna chosen), drawn from the bar's own parts, so a root scene in the lab is the whole phone
 * screen with the bar under it; it holds no navigation and is not the real navigator's bar.
 */
export function TrakaVar() {
  const labelHeight = sys.type.navLabel.lineHeight * useTextScale();
  return <View style={[tabBarSurface, s.bar, { height: tabBarHeight(labelHeight, TAB_BAR_PADDING) }]}>
    {TABS.map((tab, index) => <View key={tab.kind} accessibilityRole="tab" accessibilityState={{ selected: index === 0 }} style={s.tab}>
      <TabCapsule selected={index === 0} radius={TAB_CAPSULE} />
      <View style={s.tabIcon}><TabGlyph kind={tab.kind} selected={index === 0} /></View>
      <TabLabel selected={index === 0}>{tab.title}</TabLabel>
    </View>)}
  </View>;
}

/** The whole phone screen: the scene above, the still bar under it. */
export function Telefon({ children }: { children: ReactNode }) {
  return <View style={s.phone}>{children}<TrakaVar /></View>;
}

/* ------------------------------------------------------------------------------------------- the words the lists say */

/** "2 aktivna · 1 nacrt": the sets of "Moji zadaci", as `HomePresentation` counts them. */
export function tasksLine(section: HomeSection<OwnedTaskCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nedostupno';
  const c = section.value;
  const parts = [c.active ? plural(c.active, 'aktivan', 'aktivna', 'aktivnih') : null, c.drafts ? plural(c.drafts, 'nacrt', 'nacrta', 'nacrta') : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : c.total ? 'Nema aktivnih zadataka' : 'Još nemaš zadatak';
}
/** "3 aktivne": the "Aktivne" set of "Moje prijave", as `HomePresentation` counts it. */
export function applicationsLine(section: HomeSection<ApplicationCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nedostupno';
  const c = section.value;
  if (c.active) return plural(c.active, 'aktivna', 'aktivne', 'aktivnih');
  return !c.total ? 'Još nemaš prijavu' : c.finished === c.total ? 'Nema aktivnih prijava' : prijava(c.total);
}
/** "Oceni završen Dogovor" / "Oceni 2 završena Dogovora": the verb leads (A1). */
export const oceniDogovore = (count: number) => count === 1 ? 'Oceni završen Dogovor' : `Oceni ${plural(count, 'završen Dogovor', 'završena Dogovora', 'završenih Dogovora')}`;
/** "2 prijave · čeka tvoj izbor": two short parts on one line. */
export const joined = (first: string, second: string) => `${first} · ${second.replace(/\.$/, '').replace(/^\p{Lu}/u, letter => letter.toLowerCase())}`;

/** What the account's work profile asks for on Početna. */
export function profil(home: HomeSnapshot, availableNow: boolean | undefined) {
  const profile = home.workerProfile?.kind === 'known' ? home.workerProfile.value : null;
  const setup = !!profile && (profile.state === 'NONE' || profile.state === 'DRAFT');
  const switchShown = !!profile && profile.state === 'ACTIVE' && availableNow !== undefined;
  return { setup, switchShown };
}

/**
 * The orange dot on the corner of a picture: something here waits for me (B1). `pulse` plays the one pulse of a row that just
 * arrived (direction C.8: "tačka pulsira jednom 600 ms, bez petlje"; 600 has no token, the nearest is `loop.breath` 700).
 */
export function TackaVar({ pulse = false, kadar = null }: { pulse?: boolean; kadar?: Kadar }) {
  const reduced = useReducedMotion();
  const still = useRef(reduced || !pulse).current;
  const at = (ms: number) => Math.min(1, Math.max(0, ms / sys.motion.loop.breath));
  const progress = useRef(new Animated.Value(still ? 1 : kadar === null ? 0 : at(kadar))).current;
  useEffect(() => {
    if (still) return;
    if (kadar !== null) { progress.setValue(at(kadar)); return; }
    const run = Animated.timing(progress, { toValue: 1, duration: sys.motion.loop.breath, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [still, kadar, progress]); // eslint-disable-line react-hooks/exhaustive-deps
  if (still) return <View testID="attention-dot" style={s.dot} />;
  // One swell and back: 1 → 1,4 → 1, so a dot that just arrived is noticed once and then waits like every other.
  const scale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1 + inOutQuad(1) * 0.4, 1] });
  return <Animated.View testID="attention-dot" style={[s.dot, { transform: [{ scale }] }]} />;
}

/** A picture with the orange dot on its corner, as `HomePresentation.Marked`. */
export function Oznaceno({ art, size = 32 }: { art: Parameters<typeof FactArt>[0]['kind']; size?: number }) {
  return <View><FactArt kind={art} size={size} /><TackaVar /></View>;
}

/** The clock picture with the green dot that breathes on its corner (B7): "Slobodan sam sada" is on. */
function SatSaDahom({ kadar }: { kadar: Kadar }) {
  return <View><FactArt kind="clock" size={32} /><View style={s.dah}><DahVar kadar={kadar} /></View></View>;
}

/**
 * My lists as one group of rows under what is above (as today), with the one switch and the one setup row where the account asks
 * for them. `dah` draws the live dot of B7 beside the switched-on "Slobodan sam sada" (variant C).
 */
export function MojeRedovi({ home, availableNow, dah = false, kadar = null }: { home: HomeSnapshot; availableNow?: boolean; dah?: boolean; kadar?: Kadar }) {
  const { setup, switchShown } = profil(home, availableNow);
  const tasks = tasksLine(home.mine.tasks), applications = applicationsLine(home.mine.applications);
  return <View>
    <ListRow leading={<FactArt kind="tasks" size={32} />} title="Moji zadaci" subtitle={tasks} onPress={noop} accessibilityLabel={`Moji zadaci. ${tasks}`} />
    <ListRow leading={<FactArt kind="offers" size={32} />} title="Moje prijave" subtitle={applications} onPress={noop} last={!setup && !switchShown}
      accessibilityLabel={`Moje prijave. ${applications}`} />
    {switchShown ? <ListRow leading={dah && availableNow ? <SatSaDahom kadar={kadar} /> : <FactArt kind="clock" size={32} />} title="Slobodan sam sada"
      subtitle={availableNow ? 'Uključeno. Važi dok ga ne isključiš.' : 'Uključi kad možeš da kreneš odmah.'} last={!setup}
      trailing={<Switch value={!!availableNow} onValueChange={noop} accessibilityLabel="Slobodan sam sada"
        trackColor={{ true: sys.color.green, false: sys.color.control }} thumbColor={sys.color.surface} />} /> : null}
    {setup ? <ListRow leading={<FactArt kind="users" size={32} />} title="Podesi radni profil" subtitle="Dobijaš zadatke koji ti odgovaraju." onPress={noop} last
      accessibilityLabel="Podesi radni profil. Dobijaš zadatke koji ti odgovaraju." /> : null}
  </View>;
}

/** The next appointment as today's card (day first, the person, one quiet line): the record variant C keeps and A and B replace. */
export function RasporedZapis({ row, raspored }: { row: HomeRow; raspored: HomeRaspored }) {
  const appointment = row.appointment, title = readableTitle(row.title);
  const name = appointment?.counterpartName ?? '', role = appointment?.roleLabel ?? null;
  const zone = raspored.zone ? `, ${raspored.zone.charAt(0).toLowerCase()}${raspored.zone.slice(1)}` : '';
  const spoken = [`${raspored.spoken}${zone}`, title, [name, role].filter(Boolean).join(', '), raspored.more].filter(Boolean).join('. ');
  return <Surface kind="record" accessibilityLabel={spoken} accessibilityHint="Otvara Dogovor." onPress={noop} style={s.appointment}>
    <View style={s.appointmentHead}>
      <View style={s.appointmentWhen}>
        <T variant="heading" style={s.appointmentDay}>{raspored.when}</T>
        {raspored.zone ? <T variant="meta" tone="muted">{raspored.zone}</T> : null}
      </View>
      <Glyph name="caret-right" size={20} tone="muted" />
    </View>
    <T>{title}</T>
    {name || role ? <View style={s.appointmentPerson}>
      <Avatar initials={appointment?.counterpartInitials} size={32} />
      <View style={s.copy}>
        {name ? <T variant="note" style={s.appointmentName}>{name}</T> : null}
        {role ? <T variant="meta" tone="muted">{role}</T> : null}
      </View>
    </View> : null}
    {raspored.more ? <T variant="note" tone="muted">{raspored.more}</T> : null}
  </Surface>;
}

const s = StyleSheet.create({
  phone: { flex: 1, backgroundColor: sys.color.ground },
  // LOCKED doors: the styles of `HomePresentation` as they are.
  actions: { gap: layout.group },
  door: { paddingVertical: sys.space.md, paddingHorizontal: sys.space.base, borderRadius: sys.radius.card,
    backgroundColor: sys.color.wash, justifyContent: 'center', borderWidth: 1, borderColor: sys.color.surface },
  doorMain: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  doorCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The one title that is not on the type scale: the door's own (the composition spec allows 22 here and nowhere else).
  doorTitle: { fontSize: 22, lineHeight: 27, fontWeight: '600', letterSpacing: -0.5, color: sys.color.ink },
  // The still bar: the navigator's own geometry (31 by 28 icon box, the tab padding), from `TabBarItem`.
  bar: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', paddingHorizontal: TAB_ITEM_PADDING, paddingTop: TAB_ITEM_TOP, paddingBottom: TAB_ITEM_BOTTOM, borderRadius: TAB_CAPSULE, overflow: 'hidden' },
  tabIcon: { width: 31, height: 28, alignItems: 'center', justifyContent: 'center' },
  // Something waits here: the orange dot on the corner of its picture. The white ring keeps it apart from the drawing.
  dot: { position: 'absolute', top: 0, right: 0, width: sys.space.sm, height: sys.space.sm, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.orange, borderWidth: 1, borderColor: sys.color.surface },
  dah: { position: 'absolute', top: -1, right: -1 },
  appointment: { gap: layout.group },
  appointmentHead: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  appointmentWhen: { flex: 1, minWidth: 0, gap: sys.space.xs },
  appointmentDay: { color: sys.color.ink, fontVariant: ['tabular-nums'] },
  appointmentPerson: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  appointmentName: { color: sys.color.ink, fontWeight: '600' },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
});
