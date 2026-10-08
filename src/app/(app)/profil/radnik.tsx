import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { RadnikProfilProjekcija } from '../../../contracts/projections';
import type { AzurirajProfilKomanda, Ishod } from '../../../data/ports';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useUnsavedProfileBack } from '../../../hooks/useUnsavedProfileBack';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { useIzvor } from '../../../store/uloga';
import { inicijali } from '../../../lib/inicijali';
import { ProfilePhoto } from '../../../ui/media/ContextPhotos';
import { RatingLine } from '../../../ui/profile/RatingLine';
import { useAccountName } from '../../../ui/profile/useAccountName';
import { HeaderInfo } from '../../../ui/settings/InfoTitle';
import { Avatar } from '../../../ui/system/Avatar';
import { brandAction } from '../../../ui/system/tokens';
import { V2Action } from '../../../ui/v2/V2Action';
import { WorkerProfileFooter, WorkerProfileForm, WorkerProfileFrame, WorkerProfileStatus, type WorkerNavigation, type WorkerProfileFocusRequest } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { workerCommand, workerDraft, workerReadbackMatches, type WorkerDraft } from '../../../ui/workerProfile/workerProfileDraft';
import { workerProfileInfoLines } from '../../../ui/workerProfile/workerProfileFacts';
import { writeAvailableNow } from '../../../data/availableNowWrite';
import type { AvailableNowControl, SavedProfilePart } from '../../../ui/workerProfile/WorkerProfileSaved';

type Snapshot = { profile: RadnikProfilProjekcija | null; read: number };
type Draft = { value: WorkerDraft; initial: WorkerDraft; profileId: string | null };
type Attempt = { command: AzurirajProfilKomanda; expected: AzurirajProfilKomanda; profileId: string | null; afterRead: number };
/** The one write that changes only the name ("Koristi „<ime naloga>“"): nothing else is sent, so nothing else can be read back differently. */
const isNameOnly = (command: AzurirajProfilKomanda) => command.zavrsi !== true && command.ime !== undefined
  && Object.keys(command).every(key => key === 'zavrsi' || key === 'ime');
const failed = (): Ishod<Snapshot> => ({ ok: false, kod: 'PROFILE_UNCONFIRMED',
  poruka: 'Čuvanje nije potvrđeno. Pogledaj sačuvani profil pre nego što pokušaš ponovo.' });
async function bounded<T>(request: () => Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([request(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), milliseconds); })]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
export default function ProfilRadnikEkran() {
  const session = useSesija();
  return <OwnedWorkerProfile key={`${session.user?.id}:${session.accountRevision}`}
    accountId={session.user?.id} accountRevision={session.accountRevision} />;
}
function OwnedWorkerProfile({ accountId, accountRevision }: { accountId?: string; accountRevision: number }) {
  const izvor = useIzvor();
  // ONE NAME (owner, 8 Oct 2026): the work profile has no field for it. It takes the ACCOUNT's name, changed only in "Lični podaci".
  const account = useAccountName();
  const accountName = account.state === 'ready' ? account.name : null;
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId &&
    sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const lifecycle = useRef({ focus: null as object | null, active: !AppState.currentState || AppState.currentState === 'active', generation: 0 });
  const [foreground, setForeground] = useState(lifecycle.current.active), [resumeRequired, setResumeRequired] = useState(false);
  const [focusEpoch, setFocusEpoch] = useState(0);
  const scroll = useRef<ScrollView>(null), readingOffset = useRef(0);
  const returningTo = useRef<{ y: number; fromFocus: object | null } | null>(null);
  useFocusEffect(useCallback(() => {
    const token = {}; lifecycle.current.focus = token; setFocusEpoch(value => value + 1);
    return () => { if (lifecycle.current.focus === token) { lifecycle.current.focus = null; lifecycle.current.generation++; } };
  }, []));
  useEffect(() => { const subscription = AppState.addEventListener('change', state => {
    lifecycle.current.active = state === 'active'; lifecycle.current.generation++;
    setForeground(lifecycle.current.active); setResumeRequired(true);
  }); return () => { subscription.remove(); lifecycle.current.active = false; }; }, []);
  const readSequence = useRef(0);
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    if (!owns()) return failed();
    const sequence = ++readSequence.current;
    try {
      const profile = await bounded(() => izvor.mojRadnikProfil(), 15_000);
      if (!owns()) return failed();
      return { ok: true, podatak: { profile, read: sequence } };
    } catch { return { ok: false, kod: 'PROFILE_READ_FAILED', poruka: 'Profil nije učitan. Proveri vezu pa pokušaj ponovo.' }; }
  }, [izvor, owns]);
  const editor = useOwnedEditor(read);
  const [draft, setDraft] = useState<Draft | null>(null), draftRef = useRef<Draft | null>(null), draftGeneration = useRef(0);
  const [pending, setPending] = useState<Attempt | null>(null), pendingRef = useRef<Attempt | null>(null);
  const [transportBusy, setTransportBusy] = useState(false), transportRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null), [validation, setValidation] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<WorkerProfileFocusRequest | null>(null), focusRequestSequence = useRef(0);
  // A finished profile is READ first (M3); a row of it that changes something (`editPart`) is what turns it into the editor, with that part open and no field
  // focused, so no keyboard comes up. Leaving the screen reads it again next time.
  const [manual, setManual] = useState(false);
  const [openSection, setOpenSection] = useState<{ section: SavedProfilePart | 'identity'; token: number } | null>(null), openSectionSequence = useRef(0);
  // "O meni" is written in the work profile's editor, and "Lični podaci" leads there with `uredi=o-meni` (and a nonce `n`, so each tap is its own request).
  const params = useLocalSearchParams<{ uredi?: string; n?: string }>(), openedFor = useRef<string | null>(null);
  // The switch "Mogu odmah" (approved draft, P3): saved exactly as Početna saves it, the saved week with only the status changed, against the revision it was
  // read at. What the switch shows while it saves and after it saved is this screen's own until the next read lands, which is the truth again.
  const [switching, setSwitching] = useState<{ value: boolean | null; busy: boolean; failed: boolean }>({ value: null, busy: false, failed: false });
  const switchSaving = useRef(false);
  const setLocal = (next: Draft) => { draftGeneration.current++; draftRef.current = next; setDraft(next); };
  useEffect(() => {
    if (!editor.data || transportBusy) return;
    const { profile, read: sequence } = editor.data, attempt = pendingRef.current;
    const confirmed = attempt && sequence > attempt.afterRead && workerReadbackMatches(profile, attempt.expected, attempt.profileId);
    const pristine = draftRef.current && JSON.stringify(draftRef.current.value) === JSON.stringify(draftRef.current.initial);
    if (!draftRef.current || confirmed || (!attempt && pristine)) {
      const value = workerDraft(profile); setLocal({ value, initial: value, profileId: profile?.id ?? null });
    }
    if (confirmed) {
      pendingRef.current = null; setPending(null); setValidation(null);
      setMessage(attempt.command.zavrsi ? 'Profil je aktivan i sačuvan.'
        : isNameOnly(attempt.command) ? 'Ime radnog profila je promenjeno.'
          : attempt.profileId === null ? 'Profil je sačuvan. Nastavi sa podešavanjem.'
            : 'Izmene profila su sačuvane.');
    }
  }, [editor.data, transportBusy]);
  useEffect(() => {
    if (!foreground || !resumeRequired || transportBusy || !lifecycle.current.focus) return;
    let current = true;
    const generation = lifecycle.current.generation;
    void editor.refresh().then(() => {
      if (current && owns() && lifecycle.current.active && generation === lifecycle.current.generation) setResumeRequired(false);
    });
    return () => { current = false; };
  }, [foreground, resumeRequired, transportBusy, editor.refresh, focusEpoch, owns]);
  const focus = lifecycle.current.focus, generation = lifecycle.current.generation, renderedDraft = draftGeneration.current;
  const current = () => owns() && !!focus && lifecycle.current.focus === focus && lifecycle.current.active && lifecycle.current.generation === generation;
  const enabled = current() && !resumeRequired && !transportBusy && !editor.busy && !editor.loading && !editor.error && !editor.uncertain;
  const goBack = () => {
    if (!current() || transportRef.current || pendingRef.current) return;
    returningTo.current = null;
    // Navigation may retain this route. An explicitly discarded draft must not
    // return on the next visit, or stay reachable through a retained callback.
    const local = draftRef.current;
    if (local && JSON.stringify(local.value) !== JSON.stringify(local.initial)) {
      setLocal({ ...local, value: local.initial });
      setMessage(null); setValidation(null); setFocusRequest(null);
    }
    setManual(false); setOpenSection(null);
    if (router.canGoBack()) router.back(); else router.replace('/profil');
  };
  const change = (value: WorkerDraft) => {
    if (!enabled || transportRef.current || pendingRef.current || renderedDraft !== draftGeneration.current || !draftRef.current || !current()) return;
    setLocal({ ...draftRef.current, value }); setMessage(null); setValidation(null); setFocusRequest(null);
  };
  // One attempt at a time: a command is sent once, its whole pipeline stays owned until it settles, and the profile is read back before it is called saved.
  const commit = async (attempt: Attempt) => {
    await editor.save(async () => {
      transportRef.current = true; setTransportBusy(true); pendingRef.current = attempt; setPending(attempt); setMessage(null); setValidation(null);
      try {
        // The existing writer bounds each of its four authenticated operations
        // to 15s. Keep its whole pipeline owned until it settles; never replay it.
        const result = await bounded(() => izvor.azurirajRadnikProfil(attempt.command), 65_000);
        if (!current()) return failed();
        if (!result.ok) return failed();
        const refreshed = await read();
        if (!current() || !refreshed.ok || !workerReadbackMatches(refreshed.podatak.profile, attempt.expected, attempt.profileId)) return failed();
        return refreshed;
      } catch { return failed(); }
      finally {
        transportRef.current = false;
        if (owns()) { setTransportBusy(false); if (!current()) setResumeRequired(true); }
      }
    });
  };
  const save = async (activate: boolean) => {
    if (!enabled || !current() || transportRef.current || !draftRef.current || renderedDraft !== draftGeneration.current) return;
    const built = pendingRef.current ? { command: pendingRef.current.command, expected: pendingRef.current.expected } : workerCommand(draftRef.current.value, draftRef.current.initial, activate, accountName);
    if (!built.command) {
      setValidation(built.error ?? 'Proveri popunjena polja.');
      const value = draftRef.current.value;
      const target = value.newSkill.trim() ? 'skill' : value.newTool.trim() ? 'tool' : value.newVehicle.trim() ? 'vehicle' : null;
      if (target) setFocusRequest({ target, token: ++focusRequestSequence.current });
      return;
    }
    await commit(pendingRef.current ?? { command: built.command, expected: built.expected!, profileId: draftRef.current.profileId, afterRead: readSequence.current });
  };
  // "Koristi „<ime naloga>“" (the person's own action, never automatic): writes the account's name into the work profile through the same owned
  // writer and the same readback as every other save. Unsaved edits are not thrown away by it: they have to be saved first.
  const adoptAccountName = async () => {
    if (!enabled || !current() || transportRef.current || pendingRef.current || !draftRef.current || renderedDraft !== draftGeneration.current) return;
    const name = accountName?.trim();
    if (!name || draftRef.current.profileId === null) return;
    if (JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)) { setValidation('Sačuvaj unos pre promene imena.'); return; }
    const command: AzurirajProfilKomanda = { zavrsi: false, ime: name };
    await commit({ command, expected: command, profileId: draftRef.current.profileId, afterRead: readSequence.current });
  };
  const refresh = () => { if (current() && !transportRef.current) { setMessage(null); void editor.refresh(); } };
  const editAfterRead = () => {
    if (!enabled || !current() || transportRef.current || !editor.data || !pendingRef.current || editor.data.read <= pendingRef.current.afterRead) return;
    pendingRef.current = null; setPending(null); setMessage(null); setValidation(null); draftGeneration.current++;
  };
  const navigate = (path: WorkerNavigation) => {
    if (!enabled || !current() || transportRef.current || pendingRef.current) return;
    if (draftRef.current && JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)) {
      // Support is not a setting, so it has its own sentence (review of step 9, 2026-09-24).
      setValidation(path === '/podrska' ? 'Sačuvaj unos pre nego što pišeš podršci.' : 'Sačuvaj unos pre otvaranja drugog podešavanja.'); return;
    }
    // Capture before blur replaces the private form with a short status. Its
    // native scroll clamp must not overwrite where this owner was reading.
    returningTo.current = { y: readingOffset.current, fromFocus: focus };
    if (path === '/profil/obavestenja') router.navigate({ pathname: path, params: { skup: 'WORKER' } });
    else router.navigate(path);
  };
  // A row of the read profile that changes something opens the editor of ITS part. Nothing is written by the tap; unsaved work and a save in flight keep it out.
  const editPart = (part: SavedProfilePart) => {
    if (!enabled || !current() || transportRef.current || pendingRef.current) return;
    setManual(true); setMessage(null); setValidation(null);
    setOpenSection({ section: part, token: ++openSectionSequence.current });
  };
  const changeAvailable = (next: boolean) => {
    if (!enabled || !current() || switchSaving.current || pendingRef.current || !draftRef.current
      || JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)) return;
    switchSaving.current = true;
    setSwitching({ value: next, busy: true, failed: false });
    void (async () => {
      // The one write of "Mogu odmah" (src/data/availableNowWrite.ts), shared with Početna; each call is bounded as before.
      const saved = await writeAvailableNow(next, call => bounded(call, 30_000));
      switchSaving.current = false;
      if (!owns()) return;
      setSwitching(saved === null ? { value: null, busy: false, failed: true } : { value: saved, busy: false, failed: false });
    })();
  };
  const guide = (target: WorkerProfileFocusRequest['target'], copy: string) => {
    if (!enabled || !current() || pendingRef.current || transportRef.current) return;
    setValidation(copy); setMessage(null);
    setFocusRequest({ target, token: ++focusRequestSequence.current });
  };
  const visible = foreground && !resumeRequired && !!editor.data && !!draft && !!focus;
  const rememberReading = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (visible && current() && !returningTo.current) readingOffset.current = Math.max(0, event.nativeEvent.contentOffset.y);
  };
  const resumeReading = () => {
    const target = returningTo.current;
    if (!visible || !current() || !target || target.fromFocus === focus || !scroll.current) return;
    returningTo.current = null;
    // The form has laid out again; native scrollTo clamps if the updated
    // content is shorter. No timer can move the next route or another owner.
    scroll.current.scrollTo({ y: target.y, animated: false });
  };
  const beginReading = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!visible || !current()) return;
    returningTo.current = null;
    rememberReading(event);
  };
  const profile = editor.data?.profile ?? null;
  const status = profile?.stanje ?? null;
  const firstSave = profile === null;
  const localDirty = !!draft && JSON.stringify(draft.value) !== JSON.stringify(draft.initial);
  // Read, not edited: a finished profile with nothing unsaved or in flight. Any edit in progress means the editor is already open. A write of ONLY the name
  // ("Koristi „<ime naloga>“") leaves the profile read: its button spins in place, and the screen does not turn into the editor for the length of one write.
  const nameOnly = !!pending && isNameOnly(pending.command);
  const reading = profile !== null && (status === 'ACTIVE' || status === 'SUSPENDED') && !manual && !localDirty && (!pending || nameOnly) && (!transportBusy || nameOnly);
  // The next read of the profile is the truth about the switch again, so it takes this screen's own answer away.
  useEffect(() => { setSwitching(held => held.busy || held.value === null && !held.failed ? held : { value: null, busy: false, failed: false }); }, [editor.data]);
  // "Lični podaci" led here to write "O meni": the editor opens on that part, once for each tap.
  useEffect(() => {
    const token = params.uredi === 'o-meni' && params.n ? params.n : null;
    if (!token || openedFor.current === token || profile === null || !enabled || !current()) return;
    openedFor.current = token;
    setManual(true); setOpenSection({ section: 'identity', token: ++openSectionSequence.current });
  }, [params.uredi, params.n, profile, enabled]);
  const leave = useUnsavedProfileBack({ dirty: localDirty, busy: transportBusy || editor.busy, uncertain: !!pending || editor.uncertain,
    revision: draftGeneration.current, onBack: goBack });
  const pendingBack = () => {
    if (!transportRef.current && !pendingRef.current) return false;
    setValidation('Prvo proveri ishod čuvanja. Tvoj unos je zadržan.'); return true;
  };
  const back = () => { if (current() && !pendingBack()) leave.back(); };
  // A local unconfirmed command must stay owned until readback. Hardware Back follows the same boundary.
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!transportRef.current && !pendingRef.current) return false;
      setValidation('Prvo proveri ishod čuvanja. Tvoj unos je zadržan.'); return true;
    });
    return () => subscription.remove();
  }, []));
  const showFooter = (status !== 'ACTIVE' && status !== 'SUSPENDED') || localDirty || !!pending || transportBusy
    || editor.busy || editor.loading || editor.uncertain || !!editor.error || !!validation || !!message;
  const value = draft?.value;
  // The name this profile is activated under is the account's (`nameForSave`); its own only while the account's cannot be read.
  const profileName = accountName?.trim() || value?.ime.trim() || '';
  const basicsReady = !!value && profileName.length >= 2 && value.vestine.length > 0;
  const locationReady = !!value && value.grad.trim().length >= 2 && /^\d{1,3}$/.test(value.radius)
    && Number(value.radius) >= 1 && Number(value.radius) <= 200;
  // `activates` marks the one branch that really offers activation; the status note says "ready" only then, never while
  // the primary still has to save a change first.
  const primary: { label: string; run: () => void; activates?: boolean } = (() => {
    if (status === 'ACTIVE' || status === 'SUSPENDED') return { label: 'Sačuvaj izmene', run: () => { void save(false); } };
    if (firstSave) return localDirty
      ? { label: 'Sačuvaj profil', run: () => { void save(false); } }
      : { label: 'Uredi kroz razgovor', run: () => openConversation() };
    if (status !== 'DRAFT') return { label: 'Osveži radni profil', run: refresh };
    if (localDirty) return { label: 'Sačuvaj izmene', run: () => { void save(false); } };
    if (!locationReady) return { label: 'Podesi područje rada', run: () => navigate('/profil/lokacija') };
    // The name is not typed here: when it is missing, the primary leads to the one place it is written.
    if (!basicsReady) return profileName.length < 2
      ? { label: 'Dodaj ime', run: () => navigate('/profil/podaci') }
      : { label: 'Dopuni osnovne podatke', run: () => guide('skill', 'Pre aktivacije dodaj bar jednu veštinu.') };
    return { label: 'Proveri i aktiviraj profil', run: () => { if (account.state !== 'loading') void save(true); }, activates: true };
  })();
  // The main setup entry preserves the same ownership and pending-save guards as manual corrections.
  const openConversation = () => {
    if (!enabled || !current() || transportRef.current || pendingRef.current) return;
    if (draftRef.current && JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)) {
      setValidation('Sačuvaj unos pre otvaranja razgovora.'); return;
    }
    router.push('/profil/razgovor');
  };
  // The answer to a save stands in the footer, above the button that was pressed (it used to sit at the top of the scroll).
  // What the profile does with its data is behind the "ⓘ" in the bar, not a block of sentences on the screen (owner's phone, 8 Oct 2026).
  const nameWorking = transportBusy && nameOnly;
  // The card "Kako te vide kad uskačeš": the face (the account's own photo, or its letters), and the rating when there is one.
  const accountProfileId = account.state === 'ready' ? account.profileId ?? null : null;
  const stand = <Avatar initials={inicijali(accountName ?? value?.ime ?? null)} size={56} />;
  const face = accountProfileId ? <ProfilePhoto profileId={accountProfileId} size={56} fallback={stand} own /> : stand;
  // Only an active profile has the switch; a suspended one says its state and cannot change it.
  const availableNowControl: AvailableNowControl | undefined = status === 'ACTIVE' && value
    ? { value: switching.value ?? value.dostupanOdmah, onChange: changeAvailable, busy: switching.busy, failed: switching.failed } : undefined;
  return <WorkerProfileFrame back={back} scrollRef={scroll} onScroll={rememberReading} onScrollBeginDrag={beginReading}
    right={visible ? <HeaderInfo title="Na šta utiče radni profil" testID="worker-profile-info" info={workerProfileInfoLines(!reading)} /> : undefined}
    footer={visible && showFooter ? <WorkerProfileFooter message={message} error={validation ?? editor.error}
    held={!!pending && !transportBusy}>
    {pending && (editor.uncertain || editor.error) ? <V2Action label="Pogledaj sačuvani profil" disabled={transportBusy} onPress={refresh} style={brandAction} />
      : <V2Action label={transportBusy ? 'Čuvamo profil…' : pending ? 'Sačuvaj ponovo' : primary.label}
        disabled={!enabled || (!!primary.activates && !pending && account.state === 'loading')} loading={transportBusy} success={!!message}
        onPress={() => { if (pending) void save(false); else primary.run(); }}
        style={brandAction} />}
    {!pending && status === 'DRAFT' && primary.label !== 'Sačuvaj izmene' ? <V2Action tone="neutral" label="Sačuvaj kao nacrt" kind="quiet" disabled={!enabled} onPress={() => { void save(false); }} /> : null}
    {pending && enabled ? <V2Action tone="neutral" label="Izmeni podatke" kind="quiet" onPress={editAfterRead} /> : null}
  </WorkerProfileFooter> : undefined}>
    {!visible ? <WorkerProfileStatus loading={!foreground || resumeRequired || editor.loading || transportBusy} error={editor.error} retry={refresh} />
      : <View testID="worker-profile-reading" onLayout={resumeReading}><WorkerProfileForm draft={draft!.value} change={change} disabled={!enabled || !!pending} status={status} navigate={navigate} focusRequest={focusRequest}
        checks={{ basics: basicsReady, area: locationReady }} readyToActivate={!!primary.activates && !pending}
        openConversation={openConversation} profileExists={profile !== null}
        reading={reading} onEditPart={editPart} openSection={openSection} face={face} rating={accountId ? <RatingLine accountId={accountId} /> : undefined}
        availableNow={availableNowControl}
        accountName={accountName} onUseAccountName={() => { void adoptAccountName(); }} nameWorking={nameWorking} /></View>}
    {leave.sheet}
  </WorkerProfileFrame>;
}
