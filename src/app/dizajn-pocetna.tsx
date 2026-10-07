import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import type { HomeRaspored, HomeRow, HomeSnapshot } from '../data/homeSnapshot';
import { HomePresentation } from '../ui/home/HomePresentation';
import { ChromeIconButton, ScreenChrome } from '../ui/system/ScreenChrome';
import { T } from '../ui/Text';
import { sys } from '../ui/system/tokens';

/**
 * Internal Home fixtures for native layout checks: uskociapp://dizajn-pocetna?scene=upcoming.
 * These are static examples, never account data. The existing internal-build boundary is retained;
 * no auth state changes, data services or live inbox mount, and every action is inert.
 * Home owns the complete viewport, SafeArea and scroll geometry, without gallery controls above it.
 */
const noop = () => undefined;
// 2026-10-07: Početna became Raspored-first. `flexible` and `untimed` showed an "Aktivni Dogovor" card that no longer exists
// (a Dogovor without an exact accepted term is now one quiet line, never a card); `long`, `loose` and `quiet` take their place.
const SCENES = ['upcoming', 'long', 'loose', 'quiet', 'empty', 'unavailable'] as const;
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

const FIXTURES: Record<Scene, HomeSnapshot> = {
  upcoming: { ...appointment('upcoming', 'Montaža police u hodniku', {
    timeText: '26. sep · 17:00–19:00', counterpartName: 'Jelena Nikolić', roleLabel: 'Tvoj zadatak', counterpartInitials: 'JN',
  }, { when: 'Danas · 14:00–16:00', spoken: 'Danas, od 14:00 do 16:00',
    more: 'Ove nedelje još 2 Dogovora · 1 Dogovor bez tačnog termina', zone: null }), attention: [{ id: 'gallery:choice', title: '2 prijave',
    detail: 'Pomoć pri selidbi · čeka tvoj izbor', target: { kind: 'CANDIDATES', needId: 'gallery-choice' } }],
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
    more: 'Ove nedelje još 12 Dogovora · 21 Dogovor bez tačnog termina · 3 Dogovora čekaju završetak', zone: 'Po vremenu u Srbiji' }),
  // An active Dogovor with no day to show it on (its term is not confirmed, or it passed unfinished): no card, only the
  // counts and the way into Raspored.
  loose: appointment('loose', 'Krečenje stana u belo', {
    timeText: 'Termin nije potvrđen', counterpartName: 'Druga strana', roleLabel: 'Tvoj zadatak',
  }, undefined, '2 Dogovora bez tačnog termina · 1 Dogovor čeka završetak'),
  // Nothing waits and nothing is scheduled: a calm "Čeka te" and no Raspored block, only the two lists.
  quiet: { ...EMPTY, firstRun: false, mine: WORKING_ACCOUNT },
  empty: EMPTY,
  unavailable: { ...EMPTY, partial: true, firstRun: false, attentionState: 'unavailable',
    agreements: { kind: 'unavailable' }, mine: { tasks: { kind: 'unavailable' }, applications: { kind: 'unavailable' } } },
};

const STILL_HEADER = <ScreenChrome variant="root" title="Početna · interna galerija" onProfile={noop}
  bell={<ChromeIconButton label="Obaveštenja · primer" icon={Bell} tone="green" onPress={noop} />} />;

export default function DizajnPocetna() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const scene = SCENES.find(value => value === params.scene) ?? 'upcoming';
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  return <HomePresentation key={scene} home={FIXTURES[scene]} header={STILL_HEADER} loading={false} refreshing={false} error={false}
    onPublish={noop} onEarn={noop} onProfile={noop} onOpen={noop} onRatings={noop}
    onMyTasks={noop} onMyApplications={noop} onRefresh={noop} onPlanner={noop} />;
}

const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: sys.color.surface } });
