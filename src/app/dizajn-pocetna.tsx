import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import type { HomeAttention, HomeRaspored, HomeRow, HomeSnapshot } from '../data/homeSnapshot';
import { HomePresentation, type HomePresentationProps } from '../ui/home/HomePresentation';
import { ChromeIconButton, ScreenChrome } from '../ui/system/ScreenChrome';
import { LARGE_LAYOUT, LayoutClassOverride, type LayoutClassResult } from '../ui/system/textScale';
import { T } from '../ui/Text';
import { sys } from '../ui/system/tokens';

/**
 * Internal Home fixtures for native layout checks: uskociapp://dizajn-pocetna?scene=upcoming.
 * These are static examples, never account data. The existing internal-build boundary is retained;
 * no auth state changes, data services or live inbox mount, and every action is inert.
 * Home owns the complete viewport, SafeArea and scroll geometry, without gallery controls above it.
 *
 * Scenes (2026-10-08): `upcoming`, `long`, `loose`, `quiet`, `empty`, `unavailable` are the states of the overview; `waits` is "Čeka te"
 * with more than it can hold (an application choice, a Dogovor with no term, a change to answer, a draft, a rating): it draws three
 * of them and counts the rest ("I još 2 ..."), with the work profile still to be set up; `rated` is a choice and a rating, with room to
 * spare; `worker` is an account with an active work profile
 * and its "Mogu odmah" switch; `owner` is what the owner's phone showed on 8 Oct 2026 (no appointment ahead, a Dogovor with no term and a
 * draft under "Čeka te", eight tasks and the draft counted in their row, the switch on); `stale` is the last overview kept after a failed
 * read ("Nema veze"); `loading` is the first read on its way.
 *
 * "Danas u 14" (the owner's pick of 2026-10-08): with a next appointment (`upcoming`, `long`, `waits`, `worker`, `stale`) its TIME is the largest
 * word under the doors and "Sledeće" stands before "Čeka te" (no way into the whole schedule: Raspored is reached from Dogovori); with none
 * ahead (`loose`, `owner`) the first thing that waits leads as the one record, its number first, and nothing says that Dogovori have no day.
 */
const noop = () => undefined;
// 2026-10-07: Početna became Raspored-first. `flexible` and `untimed` showed an "Aktivni Dogovor" card that no longer exists
// (a Dogovor without an exact accepted term is now one quiet line, never a card); `long`, `loose` and `quiet` take their place.
const SCENES = ['upcoming', 'long', 'loose', 'quiet', 'empty', 'unavailable', 'waits', 'rated', 'worker', 'owner', 'stale', 'loading'] as const;
/** The web lab has no text scale: `?text=1.15` draws the designed layout and `?text=1.3` the stacked one, whatever the width says. */
const COMPACT_LAYOUT: LayoutClassResult = { cls: 'compact', stacked: false };
type Scene = typeof SCENES[number];

const EMPTY: HomeSnapshot = {
  attention: [], attentionMore: 0, attentionState: 'known',
  agreements: { kind: 'known', value: { rows: [], more: 0 } },
  mine: {
    tasks: { kind: 'known', value: { total: 0, active: 0, waiting: 0, drafts: 0, history: 0 } },
    applications: { kind: 'known', value: { total: 0, attention: 0, active: 0, finished: 0 } },
  },
  partial: false, firstRun: true, ratingsDue: 0, ratingDueAgreementId: null,
};

const WORKING_ACCOUNT: HomeSnapshot['mine'] = {
  tasks: { kind: 'known', value: { total: 3, active: 2, waiting: 0, drafts: 1, history: 0 } },
  applications: { kind: 'known', value: { total: 1, attention: 0, active: 1, finished: 0 } },
};

/** The server's own shape of a row: the task named, the action under it, the reason last. */
const CHOICE: HomeAttention = { id: 'gallery:choice', title: '2 prijave', taskTitle: 'Pomoć pri selidbi', detail: 'Čeka tvoj izbor.',
  target: { kind: 'CANDIDATES', needId: 'gallery-choice' } };

/** What the phone adds to "Čeka te" from the reads it already makes (R02, a change to answer, R18). */
const PROMPTS: HomeAttention[] = [
  { id: 'gallery:change', title: 'Odgovori na predlog izmene', taskTitle: 'Montaža police u hodniku', detail: 'Druga strana predlaže izmenu uslova.',
    target: { kind: 'AGREEMENT_CHANGE', agreementId: 'gallery-change' } },
  { id: 'gallery:term', title: 'Predloži termin', taskTitle: 'Krečenje stana u belo', detail: 'Termin još nije dogovoren.',
    target: { kind: 'AGREEMENT_TERM', agreementId: 'gallery-term' } },
  { id: 'gallery:draft', title: 'Nastavi nacrt', taskTitle: 'Prevoz ormana iz Novog Sada', detail: 'Nacrt još nije objavljen.',
    target: { kind: 'NEED', needId: 'gallery-draft' } },
];

/**
 * One of the Dogovori the quiet line of `loose` counts, as the real composition makes it: no term at all, so "Čeka te" asks for one
 * (R02) and never says nothing waits while a Dogovor stands without a term.
 */
const LOOSE_TERM: HomeAttention = { id: 'gallery:loose-term', title: 'Predloži termin', taskTitle: 'Čišćenje posle renoviranja', detail: 'Termin još nije dogovoren.',
  target: { kind: 'AGREEMENT_TERM', agreementId: 'gallery-loose-term' } };

/**
 * A static example of the next appointment: its words are written here, never computed, so the scene reads the same on
 * any day. Without `raspored` the row is an active Dogovor with no day to show it on: it draws no card, and `quietLine`
 * is the one quiet line that says so.
 */
function appointment(id: string, title: string, facts: NonNullable<HomeRow['appointment']>, raspored?: HomeRaspored,
  quietLine?: string): HomeSnapshot {
  return {
    ...EMPTY, firstRun: false,
    agreements: { kind: 'known', value: { more: 0, rows: [{ id: `gallery:${id}`, title,
      detail: [facts.roleLabel, facts.counterpartName, facts.timeText].filter(Boolean).join(' · '),
      target: { kind: 'AGREEMENT', agreementId: `gallery-${id}` }, appointment: facts,
      ...(raspored ? { upcoming: true as const, raspored } : {}) }], ...(quietLine ? { quietLine } : {}) } },
    mine: WORKING_ACCOUNT,
  };
}

/** What the owner's phone asked for under "Čeka te" (8 Oct 2026): a Dogovor with no term and a draft, each the task and the action, once. */
const OWNER_TERM: HomeAttention = { id: 'gallery:owner-term', title: 'Predloži termin', taskTitle: 'Krečenje stana od 80 m² u belo',
  detail: 'Termin još nije dogovoren.', target: { kind: 'AGREEMENT_TERM', agreementId: 'gallery-owner-term' } };
const OWNER_DRAFT: HomeAttention = { id: 'gallery:owner-draft', title: 'Nastavi nacrt', taskTitle: 'Prevoz od Petrovaradina do centra Novog Sada',
  detail: 'Nacrt još nije objavljen.', target: { kind: 'NEED', needId: 'gallery-owner-draft' } };

const NEXT = appointment('upcoming', 'Montaža police u hodniku', {
  timeText: '26. sep · 17:00–19:00', counterpartName: 'Jelena Nikolić', roleLabel: 'Tvoj zadatak', counterpartInitials: 'JN',
}, { when: 'Danas · 14:00–16:00', spoken: 'Danas, od 14:00 do 16:00',
  more: 'Ove nedelje još 2 Dogovora', zone: null });

const FIXTURES: Record<Scene, HomeSnapshot> = {
  upcoming: { ...NEXT, attention: [CHOICE],
    mine: {
      tasks: { kind: 'known', value: { total: 3, active: 2, waiting: 1, drafts: 1, history: 0 } },
      applications: { kind: 'known', value: { total: 1, attention: 0, active: 1, finished: 0 } },
    } },
  // The longest words the block may meet: a long title, a long double name, a window across midnight, big counts, and
  // a phone that is not in Serbian time (the zone is said under the day).
  long: appointment('long', 'Prenos troseda i dve fotelje sa trećeg sprata zgrade bez lifta do kombija ispred ulaza', {
    timeText: 'Fleksibilno · tokom sledeće nedelje', counterpartName: 'Aleksandra Konstantinović-Radovanović', roleLabel: 'Uskačeš',
    counterpartInitials: 'AK',
  }, { when: 'Četvrtak, 15. okt · 22:00 – petak, 16. okt 06:00', spoken: 'Četvrtak, 15. okt, od 22:00 do petak, 16. okt 06:00',
    more: 'Ove nedelje još 12 Dogovora', zone: 'Po vremenu u Srbiji' }),
  // An active Dogovor with no day to show it on (its term is not confirmed, or it passed unfinished): no card, only the
  // counts and the way into Raspored; and, because one of them has no term at all, the row that asks for one under "Čeka te".
  loose: { ...appointment('loose', 'Krečenje stana u belo', {
    timeText: 'Termin nije potvrđen', counterpartName: 'Druga strana', roleLabel: 'Tvoj zadatak',
  }, undefined, '2 Dogovora bez tačnog termina · 1 Dogovor čeka završetak'), prompts: [LOOSE_TERM] },
  // Nothing waits and nothing is scheduled: a calm "Čeka te" and no Raspored block, only the two lists.
  quiet: { ...EMPTY, firstRun: false, mine: WORKING_ACCOUNT },
  empty: { ...EMPTY, workerProfile: { kind: 'known', value: { state: 'NONE', availableNow: false } } },
  unavailable: { ...EMPTY, partial: true, firstRun: false, attentionState: 'unavailable',
    agreements: { kind: 'unavailable' }, mine: { tasks: { kind: 'unavailable' }, applications: { kind: 'unavailable' } } },
  // Everything "Čeka te" can hold at once: the server's row first, then the phone's own, then the ratings: five things, of which it draws
  // three and counts the other two; the work profile still has to be set up.
  waits: { ...NEXT, attention: [CHOICE], prompts: PROMPTS.slice(0, 3), ratingsDue: 2,
    workerProfile: { kind: 'known', value: { state: 'DRAFT', availableNow: false } },
    mine: {
      tasks: { kind: 'known', value: { total: 3, active: 2, waiting: 1, drafts: 1, history: 0 } },
      applications: { kind: 'known', value: { total: 1, attention: 0, active: 1, finished: 0 } },
    } },
  // A choice of applications and a rating: the two things that fit under "Čeka te" with room to spare (no "I još"), the rating in its verb-first words.
  rated: { ...NEXT, attention: [CHOICE], ratingsDue: 2 },
  worker: { ...NEXT, workerProfile: { kind: 'known', value: { state: 'ACTIVE', availableNow: true } } },
  // No appointment ahead, so the first thing that waits is the one record; the draft is offered there and counted in "Moji zadaci" (8 aktivnih · 1 nacrt).
  owner: { ...appointment('owner', 'Krečenje stana od 80 m² u belo', { timeText: 'Termin nije potvrđen', counterpartName: 'Druga strana', roleLabel: 'Tvoj zadatak' },
    undefined, '1 Dogovor bez tačnog termina'), prompts: [OWNER_TERM, OWNER_DRAFT],
    workerProfile: { kind: 'known', value: { state: 'ACTIVE', availableNow: true } },
    mine: { tasks: { kind: 'known', value: { total: 9, active: 8, waiting: 0, drafts: 1, history: 0 } },
      applications: { kind: 'known', value: { total: 1, attention: 0, active: 1, finished: 0 } } } },
  stale: { ...NEXT, attention: [CHOICE] },
  loading: EMPTY,
};

const STILL_HEADER = <ScreenChrome variant="root" title="Početna · interna galerija" onProfile={noop}
  bell={<ChromeIconButton label="Obaveštenja · primer" glyph="notifications" tone="green" onPress={noop} />} />;

export default function DizajnPocetna() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[]; text?: string | string[] }>();
  const scene = SCENES.find(value => value === params.scene) ?? 'upcoming';
  const textLayout = params.text === '1.3' ? LARGE_LAYOUT : params.text === '1.15' ? COMPACT_LAYOUT : null;
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const extra: Partial<HomePresentationProps> = scene === 'worker' || scene === 'owner' ? { availableNow: { value: true, onChange: noop } }
    : scene === 'stale' ? { stale: true } : scene === 'loading' ? { loading: true } : {};
  return <LayoutClassOverride.Provider value={textLayout}>
    <HomePresentation key={scene} home={scene === 'loading' ? null : FIXTURES[scene]} header={STILL_HEADER} loading={false} refreshing={false} error={false}
      onPublish={noop} onEarn={noop} onProfile={noop} onOpen={noop} onRatings={noop}
      onMyTasks={noop} onMyApplications={noop} onRefresh={noop} {...extra} />
  </LayoutClassOverride.Provider>;
}

const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: sys.color.surface } });
