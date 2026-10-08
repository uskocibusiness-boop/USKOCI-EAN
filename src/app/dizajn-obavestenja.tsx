import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { CaretRight, GearSix } from 'phosphor-react-native';
import type { InboxItem, InboxRole } from '../contracts/inbox';
import type { NotificationSettings } from '../contracts/notificationPreferences';
import type { MyBlockedAccounts } from '../data/safetyClientService';
import type { PushReadiness } from '../data/pushReadinessClientService';
import { InboxList, type InboxView } from '../ui/notifications/InboxPresentation';
import { PushPreferencesView, editSettings, pushScope, type PushPreferencesViewProps, type Roles } from '../ui/notifications/PushPreferences';
import { BlockedAccountsList } from '../ui/settings/BlockedAccountsList';
import { SettingsGroup, SettingsInfo, SettingsPersonRow, SettingsRow, SettingsScreen, SettingsSwitchRow } from '../ui/settings/SettingsPresentation';
import { ConfirmSheet } from '../ui/system/ConfirmSheet';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { FactArt } from '../ui/system/FactArt';
import { ChromeIconButton } from '../ui/system/ScreenChrome';
import { LARGE_LAYOUT, LayoutClassOverride, type LayoutClassResult } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';

/**
 * Step 11a on the device (2026-09-24): the inbox, the notification settings, the blocked list and the settings rows,
 * drawn by their real presentation components from fixtures, in every main state. Reached only by its address
 * (uskociapp://dizajn-obavestenja) in the internal build; the store package shows nothing. Nothing here reads or writes
 * data: every command is a no-op, and a switch changes only this screen's own copy.
 *
 * The first screen lists the scenes by name; a scene has "Nazad" at its foot (and its own arrow, and Android Back) to
 * return to that list.
 */
const noop = () => {};
/** The web lab has no text scale: `?text=1.15` draws the designed layout and `?text=1.3` the stacked one, whatever the width says. */
const COMPACT_LAYOUT: LayoutClassResult = { cls: 'compact', stacked: false };
const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const inbox = (id: string, eventType: string, family: string, minutes: number, title: string, body: string, read = false,
  role: InboxRole = 'WORKER'): InboxItem => ({ id, eventType, family, role, title, body, occurredAt: ago(minutes), readAt: read ? ago(minutes - 1) : null });
// The server's own stored words (pkg027c copy map) where they are known; the second row's body is a task's own title.
const ITEMS: InboxItem[] = [
  inbox('g1', 'MESSAGE_RECEIVED', 'dogovor', 4, 'Nova poruka', 'Imaš novu poruku u Dogovoru.'),
  inbox('g2', 'OPPORTUNITY_AVAILABLE', 'opportunities', 38, 'Nova prilika koja ti može odgovarati',
    'Prenos ormana i dve komode sa trećeg sprata zgrade bez lifta do kombija ispred ulaza'),
  inbox('g3', 'RESPONSE_CREATED', 'responses', 95, 'Nova prijava', 'Imaš novu prijavu za Zadatak.', true, 'REQUESTER'),
  inbox('g4', 'COMPLETION_REQUIRED', 'execution', 60 * 26, 'Završetak čeka tvoju potvrdu', 'Dogovor je označen kao završen.'),
  inbox('g5', 'NEED_CANCELLED', 'responses', 60 * 27, 'Zadatak je otkazan', 'Zadatak za koji imaš prijavu je otkazan.', true),
  inbox('g6', 'CLARIFICATION_ANSWERED', 'responses', 60 * 24 * 3, 'Odgovor na pitanje', 'Stigao je odgovor na tvoje pitanje.', true),
  inbox('g7', 'REVIEW_RECEIVED', 'dogovor', 60 * 24 * 4, 'Nova ocena', 'Stigla je ocena za završen Dogovor.', true),
  inbox('g8', 'RESPONSE_SELECTED', 'responses', 60 * 24 * 400, 'Tvoja prijava je izabrana', 'Otvori Dogovor za detalje zadatka.', true),
];
/**
 * R11 / R15, as the list looks the day the read says which task an event is about (`taskTitle`, kept by the decoder since commit 6c78480e;
 * the server package INBOX-NASLOV that sends it is proven apart and not applied): the event leads and the task is the line under it. A server
 * that does not send it leaves the line to the event's own words, so until it does this scene is the only place the task can be seen.
 */
const named = (source: InboxItem, taskTitle: string): InboxItem => ({ ...source, taskTitle });
const TASK_ITEMS: InboxItem[] = [
  named(ITEMS[2], 'Montaža police u hodniku'),
  named(inbox('t2', 'RESPONSE_SELECTED', 'responses', 130, 'Tvoja prijava je izabrana', 'Otvori Dogovor za detalje zadatka.'), 'Krečenje stana u belo'),
  named(ITEMS[4], 'Prenos ormana i dve komode sa trećeg sprata zgrade bez lifta do kombija ispred ulaza'),
  named(ITEMS[5], 'Montaža police u hodniku'),
];
const page = (items: InboxItem[], hasMore = false) => ({ items, hasMore, unreadCount: items.filter(item => !item.readAt).length, asOf: ago(0) });
const base: InboxView = { page: page(ITEMS, true), loading: false, paging: false, acting: null, error: null, unavailable: false };

const SETTINGS: NotificationSettings = { in_app_enabled: true, push_enabled: true, opportunities_enabled: true, responses_enabled: true,
  dogovor_enabled: true, execution_enabled: true, recovery_enabled: true, account_enabled: true, quiet_hours_enabled: true,
  quiet_start: '22:00:00', quiet_end: '07:00:00', quiet_timezone: 'Europe/Belgrade', urgent_overrides_quiet_hours: false };
/** Both sets of settings as the server keeps them for the account (the screen is one for both); a scene changes the parts it is about. */
const BOTH: Roles<NotificationSettings> = { REQUESTER: SETTINGS, WORKER: SETTINGS };
const READINESS = { state: 'OPERATIONAL', checkedAt: ago(12) } as PushReadiness;
/** DEV today: the sender is switched off (PKG-030), so the send check reads NOT_READY while a set's choice is on. */
const NOT_READY = { state: 'NOT_READY', checkedAt: ago(3) } as PushReadiness;

const blocked = (targetAccountId: string, displayName: string | null) =>
  ({ accountId: 'g', targetAccountId, blocked: true, revision: 1, authoritative: true as const, displayName });
const BLOCKED: MyBlockedAccounts = { accountId: 'g', authoritative: true, nextCursor: 'g-next', items: [
  blocked('b1', 'Marko Marković'), blocked('b2', 'Aleksandra Stojanović-Radovanović iz Novog Sada'), blocked('b3', null)] };
const NO_BLOCKS: MyBlockedAccounts = { accountId: 'g', authoritative: true, nextCursor: null, items: [] };

type Scene = { key: string; label: string; group: string };
const SCENES: Scene[] = [
  { key: 'inbox', label: 'Obaveštenja · spisak', group: 'Obaveštenja' },
  { key: 'inbox-task', label: 'Obaveštenja · uz naziv zadatka', group: 'Obaveštenja' },
  { key: 'inbox-loading', label: 'Obaveštenja · učitavanje', group: 'Obaveštenja' },
  { key: 'inbox-empty', label: 'Obaveštenja · prazno', group: 'Obaveštenja' },
  { key: 'inbox-empty-worker', label: 'Obaveštenja · prazno, Moje prijave', group: 'Obaveštenja' },
  { key: 'inbox-failed', label: 'Obaveštenja · nisu učitana', group: 'Obaveštenja' },
  { key: 'inbox-action', label: 'Obaveštenja · radnja nije potvrđena', group: 'Obaveštenja' },
  { key: 'inbox-page', label: 'Obaveštenja · starija nisu učitana', group: 'Obaveštenja' },
  { key: 'inbox-opening', label: 'Obaveštenja · otvaranje u toku', group: 'Obaveštenja' },
  { key: 'inbox-reading', label: 'Obaveštenja · označavanje svih', group: 'Obaveštenja' },
  { key: 'inbox-unavailable', label: 'Obaveštenja · sadržaj nije dostupan', group: 'Obaveštenja' },
  { key: 'push', label: 'Podešavanja · uključeno, povezan telefon', group: 'Podešavanja obaveštenja' },
  { key: 'push-unlinked', label: 'Podešavanja · uključeno, telefon nije povezan', group: 'Podešavanja obaveštenja' },
  { key: 'push-off', label: 'Podešavanja · isključeno na telefonu', group: 'Podešavanja obaveštenja' },
  { key: 'push-some', label: 'Podešavanja · telefon prima samo „Kad uskačeš“', group: 'Podešavanja obaveštenja' },
  { key: 'push-mixed', label: 'Podešavanja · vrsta uključena delimično', group: 'Podešavanja obaveštenja' },
  { key: 'push-denied', label: 'Podešavanja · telefon ne dozvoljava', group: 'Podešavanja obaveštenja' },
  { key: 'push-dirty', label: 'Podešavanja · izmena nije sačuvana', group: 'Podešavanja obaveštenja' },
  { key: 'push-saving', label: 'Podešavanja · čuvanje', group: 'Podešavanja obaveštenja' },
  { key: 'push-saved', label: 'Podešavanja · sačuvano', group: 'Podešavanja obaveštenja' },
  { key: 'push-uncertain', label: 'Podešavanja · stanje nije potvrđeno', group: 'Podešavanja obaveštenja' },
  { key: 'push-invalid', label: 'Podešavanja · vreme nije ispravno', group: 'Podešavanja obaveštenja' },
  { key: 'push-emulator', label: 'Podešavanja · uređaj bez obaveštenja', group: 'Podešavanja obaveštenja' },
  { key: 'push-emulator-on', label: 'Podešavanja · uključeno, slanje još nije uključeno', group: 'Podešavanja obaveštenja' },
  { key: 'push-loading', label: 'Podešavanja · učitavanje', group: 'Podešavanja obaveštenja' },
  { key: 'push-failed', label: 'Podešavanja · nisu učitana', group: 'Podešavanja obaveštenja' },
  { key: 'blocked', label: 'Blokirani · spisak', group: 'Blokirane osobe' },
  { key: 'blocked-confirm', label: 'Blokirani · pitanje pre odblokiranja', group: 'Blokirane osobe' },
  { key: 'blocked-pending', label: 'Blokirani · odblokiranje u toku', group: 'Blokirane osobe' },
  { key: 'blocked-uncertain', label: 'Blokirani · ishod nije potvrđen', group: 'Blokirane osobe' },
  { key: 'blocked-stale', label: 'Blokirani · lista nije osvežena', group: 'Blokirane osobe' },
  { key: 'blocked-done', label: 'Blokirani · uklonjeno', group: 'Blokirane osobe' },
  { key: 'blocked-empty', label: 'Blokirani · prazno', group: 'Blokirane osobe' },
  { key: 'blocked-loading', label: 'Blokirani · učitavanje', group: 'Blokirane osobe' },
  { key: 'blocked-failed', label: 'Blokirani · nije učitano', group: 'Blokirane osobe' },
  { key: 'rows', label: 'Delovi · redovi podešavanja', group: 'Delovi podešavanja' },
];

export default function DizajnObavestenja() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  // A known scene can be opened by its address (`?scene=push-unlinked`), to be photographed in the lab; anything else selects nothing.
  // `?text=1.15` draws the designed layout and `?text=1.3` the stacked one, whatever the width says (the web lab has no text scale).
  const params = useLocalSearchParams<{ scene?: string | string[]; text?: string | string[] }>();
  const textLayout = params.text === '1.3' ? LARGE_LAYOUT : params.text === '1.15' ? COMPACT_LAYOUT : null;
  const [scene, setScene] = useState<Scene | null>(() => SCENES.find(option => option.key === (typeof params.scene === 'string' ? params.scene : undefined)) ?? null);
  // Android Back inside a scene returns to the list, as the arrow and "Nazad" do.
  useEffect(() => {
    if (!scene) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setScene(null); return true; });
    return () => subscription.remove();
  }, [scene]);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  if (!scene) return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Tabla obaveštenja i podešavanja" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={s.list}>
      {[...new Set(SCENES.map(item => item.group))].map(group => <View key={group} style={s.group}>
        <T variant="meta" tone="muted" accessibilityRole="header" style={s.groupTitle}>{group}</T>
        {SCENES.filter(item => item.group === group).map(item => <Press key={item.key} accessibilityRole="button" accessibilityLabel={item.label}
          haptic="select" scaleTo={1} onPress={() => setScene(item)} style={s.pick}>
          <T variant="bodyStrong" style={s.pickLabel}>{item.label}</T>
          <CaretRight size={18} color={sys.color.muted} />
        </Press>)}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
  const back = () => setScene(null);
  return <LayoutClassOverride.Provider value={textLayout}><SafeAreaView edges={['bottom']} style={s.screen}>
    <View style={s.stage}>{render(scene.key, back)}</View>
    <View style={s.strip}>
      <V2Action kind="quiet" compact label="Nazad" accessibilityLabel="Nazad na scene" onPress={back} style={s.stripBack} />
      <T variant="meta" tone="muted" numberOfLines={1} style={s.stripName}>{scene.label}</T>
    </View>
  </SafeAreaView></LayoutClassOverride.Provider>;
}

function render(key: string, back: () => void): ReactNode {
  if (key.startsWith('inbox')) {
    const state: InboxView = key === 'inbox-task' ? { ...base, page: page(TASK_ITEMS) }
      : key === 'inbox-loading' ? { ...base, page: null, loading: true }
      : key === 'inbox-empty' || key === 'inbox-empty-worker' ? { ...base, page: page([]) }
        : key === 'inbox-failed' ? { ...base, page: null, error: 'load' }
          : key === 'inbox-action' ? { ...base, error: 'action' }
            : key === 'inbox-page' ? { ...base, error: 'page' }
              : key === 'inbox-opening' ? { ...base, acting: 'g2' }
                : key === 'inbox-reading' ? { ...base, acting: 'all' }
                  : key === 'inbox-unavailable' ? { ...base, unavailable: true, page: page(ITEMS.map(item => item.id === 'g1' ? { ...item, readAt: ago(1) } : item), true) }
                    : base;
    return <InboxScene state={state} role={key === 'inbox-empty-worker' ? 'WORKER' : null} back={back} />;
  }
  if (key.startsWith('push')) return <PushScene scene={key} back={back} />;
  if (key.startsWith('blocked')) return <BlockedScene scene={key} back={back} />;
  return <RowsScene back={back} />;
}

function InboxScene({ state, role: initial, back }: { state: InboxView; role: InboxRole | null; back: () => void }) {
  const [role, setRole] = useState(initial);
  return <SafeAreaView edges={['top']} style={s.screen}>
    <DetailTopBar title="Obaveštenja" onBack={back} right={<ChromeIconButton label="Podesi obaveštenja" icon={GearSix} onPress={noop} />} />
    <InboxList state={state} role={role} onRole={setRole} onOpen={noop} onReadAll={noop} onRefresh={noop} onMore={noop} onSettings={noop} />
  </SafeAreaView>;
}

/**
 * The route's own frame (the bar, nothing else: the screen is ONE for both sets, no tabs and no caption) around the real settings view;
 * switches change a local copy of both sets, the very edit the container makes (`editSettings`).
 *
 * - `push`: both sets send to a connected phone, the last check is good; `push-unlinked`: sending is on and this phone is not connected;
 *   `push-off`: the phone is connected and no set sends; `push-some`: the phone is sent "Kad uskačeš" only; `push-mixed`: a choice whose
 *   categories differ ("Prijave i poruke" under "Kad uskačeš" reads off and says why); `push-dirty`: a change not yet saved and the phone
 *   still to be asked; the rest are the states of a save, of a read and of a device that cannot receive notifications.
 */
function PushScene({ scene, back }: { scene: string; back: () => void }) {
  const saved: Roles<NotificationSettings> = scene === 'push-invalid' ? { REQUESTER: { ...SETTINGS, quiet_start: '25:99' }, WORKER: { ...SETTINGS, quiet_start: '25:99' } }
    : scene === 'push-off' ? { REQUESTER: { ...SETTINGS, push_enabled: false }, WORKER: { ...SETTINGS, push_enabled: false } }
    : scene === 'push-some' ? { REQUESTER: { ...SETTINGS, push_enabled: false }, WORKER: SETTINGS }
    : scene === 'push-mixed' ? { REQUESTER: SETTINGS, WORKER: { ...SETTINGS, dogovor_enabled: false } }
    : BOTH;
  const [draft, setDraft] = useState<Roles<NotificationSettings>>(scene === 'push-dirty' || scene === 'push-saving' || scene === 'push-invalid'
    ? editSettings(saved, 'WORKER', 'dogovor_enabled', false) : saved);
  const dirty = (['REQUESTER', 'WORKER'] as const).some(role => (Object.keys(saved[role]) as (keyof NotificationSettings)[]).some(key => saved[role][key] !== draft[role][key]));
  const native: NonNullable<PushPreferencesViewProps['data']>['native'] = scene === 'push-denied' ? 'DENIED'
    : scene === 'push-emulator' || scene === 'push-emulator-on' ? 'UNSUPPORTED'
    : scene === 'push-dirty' ? 'PERMISSION_REQUIRED' : 'READY';
  const busy = scene === 'push-saving', error = scene === 'push-uncertain' || scene === 'push-failed';
  // Only "telefon nije povezan" draws a phone that has not been connected; every other ready phone is connected.
  const props: PushPreferencesViewProps = { signedIn: true,
    data: scene === 'push-loading' || scene === 'push-failed' ? null : { settings: draft, native, push: pushScope(saved),
      registered: native === 'READY' && scene !== 'push-unlinked',
      readiness: scene === 'push' || scene === 'push-saved' ? READINESS : scene === 'push-emulator-on' ? NOT_READY : null },
    busy, error, locked: busy || error, dirty, validation: scene === 'push-invalid' ? 'Vreme tihih sati nije ispravno. Izaberi ga ponovo.' : null,
    working: busy ? 'save' : null, justSaved: scene === 'push-saved' && !dirty, deviceZone: 'Europe/Belgrade',
    onEdit: (role, key, value) => setDraft(current => editSettings(current, role, key, value)), onSave: noop, onEnable: noop, onDisable: noop, onRefresh: noop,
    onOpenSystemSettings: noop };
  return <SafeAreaView edges={['top']} style={s.screen}>
    <DetailTopBar title="Podešavanja" onBack={back} />
    <PushPreferencesView {...props} />
  </SafeAreaView>;
}

function BlockedScene({ scene, back }: { scene: string; back: () => void }) {
  const [asking, setAsking] = useState(scene === 'blocked-confirm');
  const data = scene === 'blocked-loading' || scene === 'blocked-failed' ? null : scene === 'blocked-empty' ? NO_BLOCKS
    : scene === 'blocked-done' ? { ...BLOCKED, items: BLOCKED.items.slice(1) } : BLOCKED;
  return <SettingsScreen title="Blokirane osobe" onBack={back}>
    <BlockedAccountsList data={data} loading={scene === 'blocked-loading'} busy={false}
      error={scene === 'blocked-failed' || scene === 'blocked-stale' ? 'Podaci nisu učitani. Proveri vezu i pokušaj ponovo.'
        : scene === 'blocked-uncertain' ? 'Čuvanje nije potvrđeno. Proveri sačuvano stanje pre novog pokušaja.' : null}
      uncertain={scene === 'blocked-uncertain'} cursor={null} pending={scene === 'blocked-pending' ? 'b1' : null}
      notice={scene === 'blocked-done' ? 'Blokiranje je uklonjeno: Marko Marković.' : null}
      onOpen={noop} onUnblock={() => setAsking(true)} onRefresh={noop} onPage={noop} />
    {asking ? <ConfirmSheet title="Marko Marković" message="Odblokiranje ne vraća ranije dozvole za deljenje kontakta ili tačne lokacije."
      confirmLabel="Odblokiraj" onConfirm={noop} onClosed={() => setAsking(false)} /> : null}
  </SettingsScreen>;
}

/** Every settings row the family has, in each of its states, at the one 56 dp rhythm. */
function RowsScene({ back }: { back: () => void }) {
  const [on, setOn] = useState(true);
  return <SettingsScreen title="Redovi podešavanja" onBack={back}>
    <SettingsGroup title="Redovi">
      <SettingsRow label="Obaveštenja" detail="Šta stiže u aplikaciju i na telefon." icon={<FactArt kind="bell" size={26} />} onPress={noop} />
      <SettingsRow compact label="Pravila i saglasnosti" detail="Pravni dokumenti i obrada podataka." onPress={noop} />
      <SettingsRow compact label="Izvoz podataka" detail="Nije dostupno dok traje drugi zahtev." onPress={noop} disabled />
      <SettingsRow label="Zatvori nalog" detail="Trajno, posle potvrde." tone="danger" icon={<FactArt kind="lock" size={26} />} onPress={noop} last />
    </SettingsGroup>
    <SettingsGroup title="Izbori" footer="Ono što isključiš ne stiže ni u aplikaciju ni na telefon.">
      <SettingsSwitchRow label="Prijave i poruke" value={on} onChange={setOn} />
      <SettingsSwitchRow label="Ostalo" value={false} onChange={noop} />
      <SettingsSwitchRow label="Hitno može i tokom tihih sati" value={false} disabled
        reason="Prvo sačuvaj izmene." onChange={noop} last />
    </SettingsGroup>
    <SettingsGroup title="Stanje i osobe">
      <SettingsInfo title="Obaveštenja su uključena" icon={<FactArt kind="phone" size={26} />}>Ovaj telefon je povezan sa tvojim nalogom.</SettingsInfo>
      <SettingsPersonRow name="Aleksandra Stojanović-Radovanović iz Novog Sada" initials="AS" onOpen={noop}
        action={{ label: 'Odblokiraj', onPress: noop }} />
      <SettingsPersonRow name="Ime nije dostupno" initials={null} onOpen={noop} action={{ label: 'Odblokiraj', onPress: noop, loading: true }} last />
    </SettingsGroup>
  </SettingsScreen>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  stage: { flex: 1 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 24 },
  group: { gap: 4 },
  groupTitle: { fontWeight: '600', paddingBottom: 4 },
  pick: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  pickLabel: { flex: 1 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: sys.color.line,
    backgroundColor: sys.color.surface },
  stripBack: { paddingHorizontal: 0 },
  stripName: { flex: 1 },
});
