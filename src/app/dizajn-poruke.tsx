import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConversationInboxPresentation, type ConversationInboxRow } from '../ui/messages/ConversationInboxPresentation';
import { ChromeIconButton, ScreenChrome } from '../ui/system/ScreenChrome';
import { T } from '../ui/Text';
import { LARGE_LAYOUT, LayoutClassOverride, type LayoutClassResult } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';

/**
 * Internal fixtures of the Poruke list: uskociapp://dizajn-poruke?scene=list. Static examples, never account data: no reader, no photo
 * service, no navigation (every action is inert), and the internal-build boundary of the other galleries. The REAL presentation draws
 * them, with the root bar a tab has (the mark, the bell, the face) and the screen's own geometry.
 *
 * Scenes: `list` an ordinary inbox (private and group conversations, the unread count of a group, a closed Dogovor); `long` the longest
 * words a row may meet; `sets` the same inbox told in two sets, "Aktivni" and "Završeni" (R17); `owner` the rows of the owner's own phone
 * (8 Oct 2026: a long name, a preview of four lines, the task, one active conversation and three over), told in the two sets; `empty`,
 * `loading`, `error` (nothing to show) and `stale` (a refresh failed and the rows that were read stay).
 */
const noop = () => undefined;
/** The web lab has no text scale: `?text=1.15` draws the designed layout and `?text=1.3` the stacked one, whatever the width says. */
const COMPACT_LAYOUT: LayoutClassResult = { cls: 'compact', stacked: false };
const SCENES = ['list', 'long', 'sets', 'owner', 'empty', 'loading', 'error', 'stale'] as const;
type Scene = typeof SCENES[number];

const minutes = (count: number) => new Date(Date.now() - count * 60_000).toISOString();
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
type Options = { n: number; ago: number; name?: string | null; task: string; preview: string | null; mine?: boolean; kind?: 'AGREEMENT' | 'GROUP';
  last?: 'TEXT' | 'PHOTO' | 'VOICE'; unread?: number | null; closed?: boolean; members?: number };
const row = (o: Options): ConversationInboxRow => ({ kind: o.kind ?? 'AGREEMENT', id: id(o.n), routeAgreementId: id(o.n), task: { id: id(900 + o.n), title: o.task },
  counterpart: o.name === null ? null : { profileId: id(800 + o.n), displayName: o.name ?? 'Jovana' },
  lastMessage: { id: id(700 + o.n), createdAt: minutes(o.ago), mine: o.mine ?? false, kind: o.last ?? 'TEXT', preview: o.preview },
  unreadMessageCount: o.unread ?? null, ...(o.closed !== undefined ? { closed: o.closed } : {}), ...(o.members !== undefined ? { memberCount: o.members } : {}) });

const ORDINARY: ConversationInboxRow[] = [
  row({ n: 1, ago: 14, name: 'Jovana Nikolić', task: 'Sastavljanje IKEA ormara', preview: 'Gotovo, sve je sastavljeno.' }),
  row({ n: 2, ago: 70, kind: 'GROUP', name: null, task: 'Selidba garsonjere u Zemunu', preview: 'Kamion stiže u 18:30', unread: 3, members: 3 }),
  row({ n: 3, ago: 60 * 28, name: 'Teodora Ilić', task: 'Bašta, sezonsko orezivanje', preview: 'Može i utorak, javi.' }),
  row({ n: 4, ago: 60 * 24 * 4, name: 'Ivana Marković', task: 'Prevoz fotelje iz Podbare', preview: 'Hvala!', mine: true, closed: true }),
  row({ n: 5, ago: 60 * 24 * 6, name: 'Marko Petrović', task: 'Krečenje stana u belo', preview: 'Evo fotografije zida', last: 'PHOTO' }),
  row({ n: 6, ago: 60 * 24 * 9, name: 'Milica Stojanović', task: 'Čišćenje posle renoviranja', preview: null, last: 'VOICE', mine: true }),
];

const LONG: ConversationInboxRow[] = [
  row({ n: 11, ago: 20, name: 'Aleksandra Konstantinović-Radovanović', task: 'Prenos troseda i dve fotelje sa trećeg sprata zgrade bez lifta do kombija ispred ulaza',
    preview: 'Dobar dan, javljam se u vezi sa terminom koji smo dogovorili za subotu, mislim da će nam trebati još jedna osoba za nošenje.' }),
  row({ n: 12, ago: 50, kind: 'GROUP', name: null, task: 'Postavljanje laminata u tri sobe i hodniku stana na Limanu', preview: 'Materijal stiže u petak ujutru', mine: true, unread: 12, members: 5 }),
];

/**
 * What the owner's phone showed (8 Oct 2026): names and previews as the people wrote them, the task a conversation is about, and the
 * two sets. Each row says whether its Dogovor is over, so the list is told in two sets without being given the Dogovori.
 */
const OWNER: ConversationInboxRow[] = [
  row({ n: 21, ago: 60 * 24 * 5, name: 'msljivic031', mine: true, task: 'Krečenje stana od 80 m² u belo', preview: 'QA povezivanje 03.10: poruka sa telefona u inbox.', closed: false }),
  row({ n: 22, ago: 60 * 24 * 3, name: 'USKOCI TEST INTERNAL QA', task: 'Krečenje stana od 80 m²', preview: 'Otkazujem Dogovor. Razlog: EX06E closed-search phone acceptance cancellation test', closed: true }),
  row({ n: 23, ago: 60 * 24 * 3 + 40, name: 'adversarial_a', task: 'Krečenje stana od 80 m²', preview: 'Otkazujem Dogovor. Razlog: EX06E phone acceptance test cancellation', closed: true }),
  row({ n: 24, ago: 60 * 24 * 13, name: 'msljivic031', task: 'Test R18 - poruka i dogovor', preview: 'TEST R18: Poruka je stigla. Provera dogovora je uradjena.', closed: true }),
];

/** Ordinary rows, each saying whether its Dogovor is over, so the list is told in two sets. */
const CLOSED_IDS: ReadonlySet<string> = new Set([id(4), id(6)]);

const STILL_HEADER = <ScreenChrome variant="root" title="Poruke · interna galerija" onProfile={noop}
  bell={<ChromeIconButton label="Obaveštenja · primer" glyph="notifications" tone="green" onPress={noop} />} />;

export default function DizajnPoruke() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[]; text?: string | string[] }>();
  const scene: Scene = SCENES.find(value => value === params.scene) ?? 'list';
  const textLayout = params.text === '1.3' ? LARGE_LAYOUT : params.text === '1.15' ? COMPACT_LAYOUT : null;
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const base = { loading: false, refreshing: false, error: false, paging: false, pageError: false, hasMore: false, onOpen: noop, onRefresh: noop, onLoadMore: noop,
    onAgreements: noop, titleInHeader: true, header: STILL_HEADER };
  const view = scene === 'long' ? { items: LONG }
    : scene === 'sets' ? { items: ORDINARY, closedAgreements: CLOSED_IDS }
      : scene === 'owner' ? { items: OWNER }
      : scene === 'empty' ? { items: [] as ConversationInboxRow[] }
        : scene === 'loading' ? { items: null, loading: true }
          : scene === 'error' ? { items: null, error: true }
            : scene === 'stale' ? { items: ORDINARY.slice(0, 3), error: true }
              : { items: ORDINARY };
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
    <LayoutClassOverride.Provider value={textLayout}>
      <ConversationInboxPresentation key={scene} {...base} {...view} />
    </LayoutClassOverride.Provider>
  </SafeAreaView>;
}

const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: sys.color.surface } });
