import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { AuthAccountScope } from '../../contracts/auth';
import type { NotificationPreferences, NotificationRole, NotificationSettings } from '../../contracts/notificationPreferences';
import { notificationPreferencesClientService } from '../../data/notificationPreferencesClientService';
import { nativePushDevice, type NativePushState } from '../../data/nativePushDevice';
import { pushDeviceClientService, type PushDevice } from '../../data/pushDeviceClientService';
import { pushReadinessClientService, type PushReadiness } from '../../data/pushReadinessClientService';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { CivilField } from '../calendar/CalendarControls';
import { SettingsFooter, SettingsGroup, SettingsInfo, SettingsSwitchRow } from '../settings/SettingsPresentation';
import { FactArt } from '../system/FactArt';
import { Disclosure } from '../system/Disclosure';
import { StateView } from '../system/StateView';
import { SystemSettingsAction } from '../system/SystemSettingsAction';
import { useTextScale } from '../system/textScale';
import { brandAction, sys } from '../system/tokens';
import { vreme } from '../../lib/vreme';
import { urgentBuilt } from '../../lib/needUrgency';

type Snapshot = { preferences: NotificationPreferences; native: NativePushState; device: PushDevice | null; readiness: PushReadiness | null };
type Scope = AuthAccountScope & { role: NotificationRole; alive: boolean; busy: boolean; generation: number };
type Draft = { owner: Scope; settings: NotificationSettings };
const SETTING_KEYS: (keyof NotificationSettings)[] = [
 'in_app_enabled', 'push_enabled', 'opportunities_enabled', 'responses_enabled', 'dogovor_enabled', 'execution_enabled',
 'recovery_enabled', 'account_enabled', 'quiet_hours_enabled', 'quiet_start', 'quiet_end', 'quiet_timezone', 'urgent_overrides_quiet_hours',
];
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/;
function sameSettings(a: NotificationSettings, b: NotificationSettings) { return SETTING_KEYS.every(key => a[key] === b[key]); }
function cloneSettings(value: NotificationSettings): NotificationSettings { return { ...value }; }
function validateDraft(value: NotificationSettings): string | null {
 if (!value.quiet_timezone.trim()) return 'Izaberi zonu telefona za tihe sate.';
 if (!value.quiet_hours_enabled) return null;
 if (!value.quiet_start || !value.quiet_end) return 'Za tihe sate izaberi početak i kraj.';
 if (!TIME.test(value.quiet_start) || !TIME.test(value.quiet_end)) return 'Vreme tihih sati nije ispravno. Izaberi ga ponovo.';
 return null;
}
/** Which of this screen's own commands is at work, so only its button shows the spinner. Presentation only. */
type Working = 'save' | 'enable' | 'disable' | 'read' | null;

export function PushPreferences({ role, onDirtyChange, onWritingChange }: { role: NotificationRole;
 /** Told whenever there are unsaved changes, so the route can ask before Back or a set switch throws them away. A change
  *  that is being saved is not reported: its request is already on its way and lands whether the person stays or not. */
 onDirtyChange?: (dirty: boolean) => void;
 /** Told while one of this screen's writes (save, enable, disable) runs, so the route keeps the set where it is. */
 onWritingChange?: (writing: boolean) => void }) {
 const { user, accountRevision } = useSesija(); const accountId = user?.id ?? '';
 const renderedOwner = useRef({ accountId, accountRevision, role }); renderedOwner.current = { accountId, accountRevision, role };
 const scopeRef = useRef<Scope | null>(null);
 const [view, setView] = useState<{ owner: Scope; snapshot: Snapshot } | null>(null);
 const [draft, setDraft] = useState<Draft | null>(null);
 const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const [validation, setValidation] = useState<string | null>(null);
 const [working, setWorking] = useState<Working>(null);
 /** The snapshot a save's own re-read returned; the check shows only once that very read-back is on screen. */
 const savedSnapshot = useRef<Snapshot | null>(null);
 const current = (scope: Scope, generation: number) => scopeRef.current === scope && scope.alive && scope.generation === generation
  && sesijaSada().user?.id === scope.accountId && sesijaSada().accountRevision === scope.accountRevision
  && renderedOwner.current.accountId === scope.accountId && renderedOwner.current.accountRevision === scope.accountRevision && renderedOwner.current.role === scope.role;
 async function bounded<T>(task: Promise<T>, scope: Scope): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => { scope.generation++; reject(Error('TIMEOUT')); }, 15000); })]); }
  finally { if (timer) clearTimeout(timer); }
 }
 async function read(scope: Scope, generation: number, ask: boolean): Promise<Snapshot> {
  const transport = readTransport();
  const preferences = await notificationPreferencesClientService.read(scope.accountId, scope.role);
  if (!current(scope, generation)) throw Error('STALE');
  const native = await nativePushDevice(ask, () => current(scope, generation));
  if (!current(scope, generation)) throw Error('STALE');
  const result = native.kind === 'READY' ? await pushDeviceClientService.read(scope, native.token) : null;
  if (!current(scope, generation) || result && !result.ok) throw Error('READ_UNAVAILABLE');
  const readiness = await transport;
  if (!current(scope, generation)) throw Error('STALE');
  return { preferences, native, device: result?.ok ? result.podatak : null, readiness };
 }
 async function run(scope: Scope, work: (generation: number) => Promise<Snapshot>, kind: Working = null) {
  if (scope.busy || !current(scope, scope.generation)) return;
  // setView(null) here meant that pressing "Sačuvaj podešavanja" made nine switches, three fields
  // and five buttons vanish behind a spinner, and on any failure the wipe was permanent: the error
  // panel replaced the settings instead of standing beside them. The last good state stays mounted
  // and waits (every control is locked) while the work runs; only a first read has nothing to show.
  // The spinner goes to the command that really starts, after the busy check: a press or a foreground re-read that is
  // refused here must not move it onto its own button while another command runs.
  scope.busy = true; const generation = ++scope.generation; setBusy(true); setError(false); setValidation(null); setWorking(kind);
  try {
   const snapshot = await bounded(work(generation), scope);
   if (current(scope, generation)) {
    setView({ owner: scope, snapshot });
    setDraft({ owner: scope, settings: cloneSettings(snapshot.preferences.settings) });
   }
  }
  catch { if (scopeRef.current === scope && scope.alive) setError(true); }
  finally { if (scopeRef.current === scope && scope.alive) { scope.busy = false; setBusy(false); setWorking(null); } }
 }
 // What the foreground re-read below reads at the moment the app comes back; never a value captured at focus.
 const latest = useRef({ snapshot: null as Snapshot | null, busy: false, dirty: false });
 useFocusEffect(useCallback(() => {
  const scope: Scope = { accountId, accountRevision, role, alive: true, busy: false, generation: 0 };
  scopeRef.current = scope; setView(null); setDraft(null); setError(false); setValidation(null); setBusy(false); setWorking(null);
  if (accountId) void run(scope, generation => read(scope, generation, false));
  // Back from the phone's own settings, where the person may just have allowed notifications: read the state again, but
  // only when that read can change something shown (a denial or a missing permission) and never over unsaved changes,
  // because a read replaces the draft with what the server holds.
  const foreground = AppState.addEventListener('change', next => {
   const now = latest.current;
   // `scope.busy` as well as the rendered value: a command that started after the last render is already at work.
   if (next !== 'active' || scopeRef.current !== scope || scope.busy || !now.snapshot || now.busy || now.dirty
    || (now.snapshot.native.kind !== 'DENIED' && now.snapshot.native.kind !== 'PERMISSION_REQUIRED')) return;
   void run(scope, generation => read(scope, generation, false), 'read');
  });
  return () => { foreground?.remove(); scope.alive = false; scope.generation++; if (scopeRef.current === scope) scopeRef.current = null; };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [accountId, accountRevision, role]));
 const owner = scopeRef.current;
 const renderedGeneration = owner?.generation;
 const snapshot = owner && owner.accountId === accountId && owner.accountRevision === accountRevision && owner.role === role && view?.owner === owner ? view.snapshot : null;
 const settings = owner && draft?.owner === owner ? draft.settings : null;
 function refresh() { const scope = scopeRef.current; if (scope) void run(scope, generation => read(scope, generation, false), 'read'); }
 function enable() {
  const scope = scopeRef.current; if (!scope || !snapshot || view?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  void run(scope, async generation => {
   const fresh = await read(scope, generation, true);
   if (fresh.native.kind !== 'READY' || !fresh.device) return fresh;
   const registered = await pushDeviceClientService.set(scope, fresh.native.token, fresh.native.platform, true, fresh.device.revision);
   if (!current(scope, generation) || !registered.ok) throw Error('REGISTRATION_UNCONFIRMED');
   if (!fresh.preferences.settings.push_enabled) await notificationPreferencesClientService.save(scope.accountId, scope.role,
    { ...fresh.preferences.settings, push_enabled: true }, fresh.preferences.revision);
   if (!current(scope, generation)) throw Error('STALE');
   return read(scope, generation, false);
  }, 'enable');
 }
 function disable() {
  const scope = scopeRef.current; if (!scope || !snapshot || view?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  const original = snapshot.preferences;
  void run(scope, async generation => {
   await notificationPreferencesClientService.save(scope.accountId, scope.role, { ...original.settings, push_enabled: false }, original.revision);
   if (!current(scope, generation)) throw Error('STALE');
   return read(scope, generation, false);
  }, 'disable');
 }
 function edit<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
  const scope = scopeRef.current;
  if (!scope || !settings || draft?.owner !== scope || scope.busy || scope.generation !== renderedGeneration || !snapshot || view?.owner !== scope) return;
  setValidation(null); setDraft({ owner: scope, settings: { ...settings, [key]: value } });
 }
 function saveSettings() {
  const scope = scopeRef.current;
  if (!scope || !snapshot || view?.owner !== scope || !settings || draft?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  const problem = validateDraft(settings); if (problem) { setValidation(problem); return; }
  const original = snapshot.preferences; const payload = cloneSettings(settings);
  void run(scope, async generation => {
   await notificationPreferencesClientService.save(scope.accountId, scope.role, payload, original.revision);
   if (!current(scope, generation)) throw Error('STALE');
   const confirmed = await read(scope, generation, false);
   savedSnapshot.current = confirmed;
   return confirmed;
  }, 'save');
 }
 const enabled = snapshot?.preferences.settings.push_enabled === true;
 const registered = snapshot?.native.kind === 'READY' && snapshot.device?.active && snapshot.device.sessionBound;
 const dirty = !!snapshot && !!settings && !sameSettings(snapshot.preferences.settings, settings);
 latest.current = { snapshot, busy, dirty };
 // While "Sačuvaj podešavanja" runs the changes are on their way, so Back must not offer to throw them away. After an
 // unconfirmed outcome it is not known whether they were saved, so Back must not say they were not: until "Proveri
 // stanje" reads the state again, every control is locked and nothing on screen is a draft worth keeping.
 const unsaved = dirty && !busy && !error;
 useEffect(() => { onDirtyChange?.(unsaved); }, [unsaved, onDirtyChange]);
 const writing = busy && (working === 'save' || working === 'enable' || working === 'disable');
 useEffect(() => { onWritingChange?.(writing); }, [writing, onWritingChange]);
 // An unconfirmed outcome used to remove the controls by wiping the whole body. Keeping them on
 // screen must not make them usable: until the state is read back, everything here is locked.
 const locked = busy || error;
 const change = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => { savedSnapshot.current = null; edit(key, value); };
 return <PushPreferencesView role={role} signedIn={!!accountId}
  data={snapshot && settings ? { settings, native: snapshot.native.kind, enabled, registered: !!registered, readiness: snapshot.readiness } : null}
  busy={busy} error={error} locked={locked} dirty={dirty} validation={validation} working={busy ? working : null}
  justSaved={!!snapshot && snapshot === savedSnapshot.current && !dirty && !busy}
  onEdit={change} onSave={saveSettings} onEnable={enable} onDisable={disable} onRefresh={refresh} />;
}

/** The copy of each category, per set. The REQUESTER set has no "new task" switch: that event is only sent to WORKER. */
const CATEGORY_HELP = {
 opportunities: 'Kad se pojavi zadatak koji ti može odgovarati.',
 responses: { REQUESTER: 'Nove i izmenjene prijave i pitanja o tvojim zadacima.',
  WORKER: 'Promene tvoje prijave i zadatka, odgovori na tvoja pitanja.' } as Record<NotificationRole, string>,
};
const PRIVACY = 'Na zaključanom ekranu prikazujemo samo da imaš novo obaveštenje. Poruke i privatne lokacije ostaju u aplikaciji.';
const SAVE_FIRST = 'Prvo sačuvaj izmene kategorija i tihih sati.';
const CHECK_FIRST = 'Prvo proveri stanje.';
/** Said once a save has been read back, in place of the reason the grey button otherwise gives. */
const SAVED = 'Podešavanja su sačuvana.';
/** Each set by the name its underlined tab shows, in the form that follows "za" ("za Moje zadatke"), so a sentence about
 *  sending says which set it means. */
const FOR_SET: Record<NotificationRole, string> = { REQUESTER: 'Moje zadatke', WORKER: 'poslove' };

export type PushPreferencesViewProps = {
 role: NotificationRole; signedIn: boolean;
 /** What was read back, with the draft in place of the saved settings; null before the first read has landed. */
 data: { settings: NotificationSettings; native: NativePushState['kind']; enabled: boolean; registered: boolean; readiness: PushReadiness | null } | null;
 busy: boolean; error: boolean; locked: boolean; dirty: boolean; validation: string | null; working: Working; justSaved: boolean;
 onEdit: <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => void;
 onSave: () => void; onEnable: () => void; onDisable: () => void; onRefresh: () => void;
 /** The phone's own settings; the route passes nothing and the system page opens. */ onOpenSystemSettings?: () => void | Promise<void>;
 /** The phone's zone; read from the device when left out (fixed by the gallery). */ deviceZone?: string | null;
};

/**
 * The notification settings of one set (step 11a, 2026-09-24), drawn from what the container read. Whether anything
 * can reach the phone remains visible with its permission/connection actions. Categories and quiet hours lead the
 * editable content; phone explanation, privacy and the last sending check are in one disclosure below. They remain
 * available even when phone delivery is unavailable. "Sačuvaj podešavanja" sits in the footer, so a change at
 * the top does not need a scroll to be saved; the phone's own actions are white and never compete with it.
 */
export function PushPreferencesView({ role, signedIn, data, busy, error, locked, dirty, validation, working, justSaved,
 onEdit, onSave, onEnable, onDisable, onRefresh, onOpenSystemSettings, deviceZone: fixedZone }: PushPreferencesViewProps) {
 const large = useTextScale() >= 1.3;
 const narrow = useWindowDimensions().width < 360;
 if (!signedIn) return <View style={styles.fill}><ScrollView contentContainerStyle={styles.content}>
  <StateView kind="error" title="Prijavi se da urediš obaveštenja." />
 </ScrollView></View>;
 if (!data) return <View style={styles.fill}><ScrollView contentContainerStyle={styles.content}>
  {error ? <StateView kind="error" title="Podešavanja nisu učitana" body="Stanje nije potvrđeno. Proveri ga pre ponovnog pokušaja."
   primary={{ label: 'Proveri stanje', onPress: onRefresh, disabled: busy }} />
   : <StateView kind="loading" title="Učitavamo podešavanja obaveštenja…" skeleton={{ count: 3, rows: 2, variant: 'plain' }} />}
 </ScrollView></View>;
 const { settings, native, enabled, registered, readiness } = data;
 const zone = fixedZone === undefined ? deviceZone() : fixedZone;
 const phone = phoneStatus(native, enabled, registered, FOR_SET[role]);
 // Keep the same capability/role-scoped commands; presentation below gives the next step priority.
 const phoneActions: { label: string; kind: 'secondary' | 'quiet'; onPress: () => void; working?: Working; guarded: boolean }[] = [];
 // A device that cannot receive notifications at all (the emulator) or a build without them has no phone action: next to
 // "Nije dostupno na ovom uređaju" a switch-off button contradicted the headline.
 const deviceKnowsPush = native !== 'UNSUPPORTED' && native !== 'UNCONFIGURED';
 const deviceCanAsk = deviceKnowsPush && native !== 'DENIED';
 // A saved ON preference or a connected phone is not proof that delivery is operational.
 // Keep an adverse/unknown sending state visible where it affects this enabled set; the full last-check receipt stays below.
 const deliveryNotice = enabled && deviceKnowsPush
  ? readiness?.state === 'NOT_READY' ? 'Slanje na telefon trenutno nije uključeno.'
   : readiness?.state === 'DEGRADED' ? 'Pri poslednjoj proveri slanja zabeležene su poteškoće.'
    : readiness?.state === 'OPERATIONAL' ? null : 'Stanje slanja na telefon još nije potvrđeno.'
  : null;
 // Sending is already on for this set and only this phone is missing: the step is to connect it, not to switch on.
 if (deviceCanAsk && (!registered || !enabled)) phoneActions.push({ label: enabled ? 'Poveži ovaj telefon' : 'Uključi obaveštenja na telefonu',
  kind: 'secondary', onPress: onEnable, working: 'enable', guarded: true });
 if (enabled && deviceKnowsPush) phoneActions.push({ label: `Isključi za ${FOR_SET[role].toLocaleLowerCase('sr-Latn-RS')}`, kind: 'quiet', onPress: onDisable, working: 'disable', guarded: true });
 // Reading again is offered only where it can change something, and not beside "Proveri stanje", which already does it.
 if (deviceKnowsPush && !error) phoneActions.push({ label: 'Osveži stanje', kind: 'quiet', onPress: onRefresh, working: 'read', guarded: true });
 // A denied permission already has its immediate SystemSettingsAction. Otherwise connect/enable leads,
 // or the connected set can be switched off directly. Refresh and the remaining command stay nearby.
 const primaryPhoneAction = native === 'DENIED' ? null : phoneActions.find(action => action.working !== 'read') ?? null;
 const secondaryPhoneActions = phoneActions.filter(action => action !== primaryPhoneAction);
 // While the state is unconfirmed the alert and "Proveri stanje" stand directly above the phone buttons, and Save says
 // "Prvo proveri stanje." already; a second copy here was spoken twice in a row.
 const waitReason = dirty && !error ? SAVE_FIRST : null;
 const showZone = settings.quiet_timezone !== zone && (settings.quiet_hours_enabled || !settings.quiet_timezone.trim());
 // Reading clean settings needs no disabled action blocking the categories. Preserve the footer throughout a save,
 // uncertain readback and validation; a phone-only refresh never announces an irrelevant Save state.
 const showSave = dirty || working === 'save' || !!validation || error || justSaved;
 const saveReason = error ? CHECK_FIRST : null;
 const stackTimes = large || narrow;
 return <View style={styles.fill}>
  <SavedAnnouncement justSaved={justSaved} />
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
   {busy && working !== 'save' ? <View style={styles.checking}>
    <ActivityIndicator size="small" accessibilityLabel="Provera obaveštenja na telefonu" color={sys.color.green} />
    <T variant="note" tone="muted">Proveravamo stanje…</T>
   </View> : null}
   {error ? <View style={styles.block} accessibilityLiveRegion="polite">
    <T tone="danger" accessibilityRole="alert">Stanje nije potvrđeno. Proveri ga pre ponovnog pokušaja.</T>
    <V2Action label="Proveri stanje" kind="secondary" onPress={onRefresh} disabled={busy} />
   </View> : null}

   <View style={styles.block}>
    <T variant="meta" tone="muted">{error ? 'Poslednje potvrđeno stanje telefona' : 'Na ovom telefonu'}</T>
    <View style={styles.phoneStatus}>
     <FactArt kind="phone" size={24} cut="art" tone="quiet" />
     <View style={styles.phoneCopy}>
      <T accessibilityRole="header" style={styles.phoneTitle}>{phone.title}</T>
      {deliveryNotice ? <T variant="copy" tone="muted">{deliveryNotice}</T> : null}
     </View>
    </View>
    {native === 'DENIED' ? <SystemSettingsAction open={onOpenSystemSettings} /> : null}
    {primaryPhoneAction ? <V2Action label={primaryPhoneAction.label} kind={primaryPhoneAction.kind} onPress={primaryPhoneAction.onPress}
     compact={primaryPhoneAction.kind === 'quiet'} tone="neutral" style={styles.phoneConnect}
     loading={!!primaryPhoneAction.working && working === primaryPhoneAction.working}
     disabled={primaryPhoneAction.guarded ? locked || dirty : false} reason={waitReason} /> : null}
    {/* A closed disclosure must never hide why its commands are waiting. The error recovery above is always visible. */}
    {!primaryPhoneAction && secondaryPhoneActions.length > 0 && waitReason ? <T variant="note" tone="muted">{waitReason}</T> : null}
    {secondaryPhoneActions.length > 0 ? <Disclosure label="Upravljanje telefonom">
     <View style={styles.phoneActions}>
      {secondaryPhoneActions.map(action => <V2Action key={action.label} label={action.label} kind={action.kind} onPress={action.onPress}
       compact tone="neutral" style={styles.phoneQuiet}
       loading={!!action.working && working === action.working} disabled={action.guarded ? locked || dirty : false}
       reason={action.guarded ? null : undefined} />)}
     </View>
    </Disclosure> : null}
   </View>

   {/* While a command runs the choices stay readable and visibly wait: every locked row draws its words in muted ink, so
       the block is not faded a second time on top of that. The phone's state and the footer are not touched. */}
   <View style={styles.groups}>
    <SettingsGroup>
     <SettingsSwitchRow label="Obaveštenja u aplikaciji" help="Isključivanje ne briše spisak obaveštenja."
      value={settings.in_app_enabled} disabled={locked} onChange={value => onEdit('in_app_enabled', value)} last />
    </SettingsGroup>
    {/* The note covers every category, so it stands under the first of them, not under the last. */}
    <SettingsGroup title="Zadaci i prijave" footer="Isključena kategorija ne stiže ni u aplikaciju ni na telefon. Promena kategorije ne menja dozvolu za obaveštenja na telefonu.">
     {role === 'WORKER' ? <SettingsSwitchRow label="Novi zadaci" help={CATEGORY_HELP.opportunities}
      value={settings.opportunities_enabled} disabled={locked} onChange={value => onEdit('opportunities_enabled', value)} /> : null}
     <SettingsSwitchRow label="Prijave i odgovori" help={CATEGORY_HELP.responses[role]}
      value={settings.responses_enabled} disabled={locked} onChange={value => onEdit('responses_enabled', value)} last />
    </SettingsGroup>
    <SettingsGroup title="Dogovori">
     <SettingsSwitchRow label="Dogovor i poruke" help="Dogovor, poruke, pristup i ocene."
      value={settings.dogovor_enabled} disabled={locked} onChange={value => onEdit('dogovor_enabled', value)} />
     <SettingsSwitchRow label="Izvršenje i završetak" help="Tok posla i potvrda završetka."
      value={settings.execution_enabled} disabled={locked} onChange={value => onEdit('execution_enabled', value)} last />
    </SettingsGroup>
    <SettingsGroup title="Ostalo">
     <SettingsSwitchRow label="Oporavak" help="Nedovršene radnje koje treba proveriti."
      value={settings.recovery_enabled} disabled={locked} onChange={value => onEdit('recovery_enabled', value)} />
     <SettingsSwitchRow label="Nalog i ostalo" help="Obaveštenja o tvom nalogu i bezbednosti."
      value={settings.account_enabled} disabled={locked} onChange={value => onEdit('account_enabled', value)} last />
    </SettingsGroup>
    <SettingsGroup title="Tihi sati">
     <SettingsSwitchRow label="Uključi tihe sate" help={urgentBuilt()
      ? 'Bez obaveštenja na telefon u ovom periodu, osim posebno dozvoljenih hitnih događaja. Period može da prelazi preko ponoći.'
      : 'Bez obaveštenja na telefon u ovom periodu. Period može da prelazi preko ponoći.'}
      value={settings.quiet_hours_enabled} disabled={locked} onChange={value => onEdit('quiet_hours_enabled', value)}
      last={!settings.quiet_hours_enabled && !showZone} />
     {settings.quiet_hours_enabled ? <View style={[styles.times, stackTimes && styles.timesStacked]}>
      <View style={styles.time}><CivilField label="Početak tihih sati" mode="time" value={settings.quiet_start ?? ''} disabled={locked}
       onChange={value => onEdit('quiet_start', value || null)} /></View>
      <View style={styles.time}><CivilField label="Kraj tihih sati" mode="time" value={settings.quiet_end ?? ''} disabled={locked}
       onChange={value => onEdit('quiet_end', value || null)} /></View>
     </View> : null}
     {/* A text box asking a person to type an IANA identifier by hand, where one typo silently moves their quiet hours,
         is gone. The device knows its zone; the stored value is shown only when it is not the phone's own. */}
     {showZone ? <View style={settings.quiet_hours_enabled ? styles.zone : undefined}>
      <SettingsInfo title="Vremenska zona tihih sati" last>{settings.quiet_timezone.trim() ? zoneLabel(settings.quiet_timezone) : 'Nije izabrana.'}</SettingsInfo>
      {zone ? <V2Action label={`Koristi zonu telefona (${zoneLabel(zone)})`} kind="quiet" compact disabled={locked}
       onPress={() => onEdit('quiet_timezone', zone)} style={styles.inline} /> : null}
     </View> : null}
     {settings.quiet_hours_enabled && urgentBuilt() ? <SettingsSwitchRow label="Hitno može i tokom tihih sati" help="Važi samo za hitne događaje i samo kada je ovo posebno uključeno."
      value={settings.urgent_overrides_quiet_hours} disabled={locked} onChange={value => onEdit('urgent_overrides_quiet_hours', value)} last /> : null}
    </SettingsGroup>
   </View>

   <Disclosure label="Detalji telefona i slanja" hint="Dozvola, privatnost i poslednja provera slanja." divider>
    <T variant="note" tone="muted">{phone.body}</T>
    <View style={styles.block}>
     <T variant="bodyStrong" style={styles.ink} accessibilityRole="header">Privatnost</T>
     <T variant="note" tone="muted">{PRIVACY}</T>
    </View>
    <View style={styles.readiness}>
     <T variant="bodyStrong" style={styles.ink} accessibilityRole="header">Poslednja provera slanja</T>
     <T variant="note" tone="muted">{readiness?.state === 'OPERATIONAL' ? 'Sistem za slanje je radio pri poslednjoj proveri.'
      : readiness?.state === 'DEGRADED' ? 'Zabeležene su poteškoće ili kašnjenje u slanju.'
       : readiness?.state === 'NOT_READY' ? 'Slanje iz aplikacije trenutno nije uključeno, čak i ako je telefon povezan.'
        : 'Rad sistema za slanje još nije potvrđen.'}</T>
     {readiness ? <T variant="meta" tone="muted">Provereno: {vreme(readiness.checkedAt)}</T> : null}
     <T variant="meta" tone="muted">Ova provera ne potvrđuje da je obaveštenje stiglo na tvoj telefon.</T>
    </View>
   </Disclosure>

  </ScrollView>
  {showSave ? <SettingsFooter>
   {validation ? <T variant="note" tone="danger" accessibilityRole="alert">{validation}</T> : null}
   {/* The confirmed save is said in words (in the success colour, once to a screen reader), not only by a check that
       leaves after a moment on a button that turns grey again. */}
   {justSaved ? <T variant="note" tone="success" accessibilityLiveRegion="polite">{SAVED}</T> : null}
   <V2Action label="Sačuvaj podešavanja" onPress={onSave} disabled={locked || !dirty} loading={working === 'save'}
    success={justSaved} reason={saveReason} style={brandAction} />
  </SettingsFooter> : null}
 </View>;
}

/**
 * What the phone can do, in one headline and one sentence: the device first, then the account's choice for this set.
 * The headline never claims what this phone does not do: a phone that is not connected says so first, and the set's
 * choice follows. The choice names its set, because turning it off leaves the other set as it is.
 */
function phoneStatus(native: NativePushState['kind'], enabled: boolean, registered: boolean, set: string): { title: string; body: string } {
 // The account's choice is said with the buttons' own noun ("obaveštenja na telefon"). "Slanje" belongs to the send check
 // below the phone state, which can say sending is not on while this set's choice is.
 const choice = enabled ? `Obaveštenja na telefon su uključena za ${set}.` : `Obaveštenja na telefon su isključena za ${set}.`;
 // A saved preference is not evidence that another phone received a notification.
 const onElsewhere = enabled ? ` ${choice}` : '';
 if (native === 'UNSUPPORTED') return { title: 'Nije dostupno na ovom uređaju', body: `Ovde ne možeš da uključiš obaveštenja na telefonu. Podešavanja u aplikaciji i dalje možeš da uređuješ.${onElsewhere}` };
 if (native === 'UNCONFIGURED') return { title: 'Povezivanje trenutno nije dostupno', body: `Ova verzija aplikacije trenutno ne može da poveže telefon za obaveštenja.${onElsewhere}` };
 if (native === 'DENIED') return { title: 'Telefon ne dozvoljava obaveštenja', body: `Dozvoli obaveštenja u podešavanjima telefona.${onElsewhere}` };
 if (native === 'PERMISSION_REQUIRED') return { title: 'Potrebna je dozvola telefona',
  body: `Dugme ispod traži dozvolu za obaveštenja i povezuje ovaj telefon. ${choice}` };
 if (!registered) return { title: 'Ovaj telefon još nije povezan', body: `Dozvola telefona je data. ${choice}` };
 // A short headline without a period, like the others; the set it belongs to is already the selected tab, and the body
 // names it again for a screen reader.
 return { title: enabled ? 'Obaveštenja su uključena' : 'Obaveštenja su isključena',
  body: `Važi za ${set}. Ovaj telefon je povezan sa tvojim nalogom. Stanje slanja je prikazano ispod.` };
}

/** iOS ignores `accessibilityLiveRegion`, so there the saved line is also said once, when it appears. */
function SavedAnnouncement({ justSaved }: { justSaved: boolean }) {
 useEffect(() => { if (justSaved && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(SAVED); }, [justSaved]);
 return null;
}

const deviceZone = (): string | null => {
 try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
};
/** The city, not the database identifier. */
// Serbian time is named the way the rest of the app names it; any other zone keeps its city.
const zoneLabel = (zone: string): string => zone === 'Europe/Belgrade' ? 'Vreme u Srbiji' : zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;

const styles = StyleSheet.create({
 fill: { flex: 1, backgroundColor: sys.color.surface },
 content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 20, flexGrow: 1 },
 block: { gap: 8 },
 ink: { color: sys.color.ink },
 phoneStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, paddingVertical: sys.space.xs },
 phoneCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
 phoneActions: { gap: 4 },
 phoneQuiet: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 0 },
 phoneConnect: { width: '100%' },
 phoneTitle: { ...sys.type.bodyStrong, fontWeight: '500', color: sys.color.ink },
 groups: { gap: 24 },
 checking: { flexDirection: 'row', alignItems: 'center', gap: 8 },
 times: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: sys.color.line },
 timesStacked: { flexDirection: 'column' },
 time: { flex: 1, minWidth: 0 },
 // The zone sits between the times and the last switch, so it keeps the rows' hairline under it.
 zone: { borderBottomWidth: 1, borderBottomColor: sys.color.line, paddingBottom: 4 },
 inline: { paddingHorizontal: 0, alignSelf: 'flex-start' },
 readiness: { gap: 4, paddingTop: sys.space.md, borderTopWidth: 1, borderTopColor: sys.color.line },
});

async function readTransport(): Promise<PushReadiness | null> {
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  return await Promise.race([
   pushReadinessClientService.read().then(result => result.ok ? result.podatak : null).catch(() => null),
   new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 5000); }),
  ]);
 } catch { return null; }
 finally { if (timer !== undefined) clearTimeout(timer); }
}
