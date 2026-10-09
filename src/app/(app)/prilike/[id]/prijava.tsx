import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { MojaPrijavaProjekcija, PotrebaProjekcija, PrilikaProjekcija, RadnikProfilProjekcija } from '../../../../contracts/projections';
import type { Ishod, PodnesiPrijavuKomanda } from '../../../../data/ports';
import { applicationRefusalGuidance, boundedApplicationSelectionRead, conclusiveApplicationRefusal } from '../../../../data/applicationSelectionClientService';
import { applicationCommandJournal } from '../../../../data/applicationCommandJournal';
import { fixedApplicationPrice } from '../../../../data/needDetailPresentation';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { useIzvor } from '../../../../store/uloga';
import { ApplicationComposerPresentation, ComposerUnavailable, type ApplicationDraft } from '../../../../ui/v2/ApplicationComposerPresentation';

/** The phone could not keep the request: a fresh read of the task cannot fix that, so no refresh is offered beside it. */
const NOT_SAVED_ON_DEVICE = 'Prijava nije sačuvana na telefonu. Oslobodi prostor na telefonu i pokušaj ponovo.';
const NOT_RETIRED_ON_DEVICE = 'Stara prijava nije uklonjena sa telefona. Pokušaj ponovo; nova prijava još nije otvorena.';
const JOURNAL_RECOVERY_REQUIRED = 'Prvo proveri da li je prethodna prijava poslata. Izaberi „Proveri da li je poslato“.';
type Receipt = { prijavaId: string; verzija: number; hash: string };
type Loaded = { need: PotrebaProjekcija; opportunity: PrilikaProjekcija; profile: RadnikProfilProjekcija; applications: MojaPrijavaProjekcija[]; receipt: Receipt | null };
type Pending = { command: PodnesiPrijavuKomanda; need: PotrebaProjekcija; opportunity: PrilikaProjekcija; profile: RadnikProfilProjekcija; result: Ishod<Receipt> | null; inFlight: boolean; reconciled: boolean };
/** A price the task names is never typed: it follows the people this application brings (deep read 8.10). */
function withTaskPrice(draft: ApplicationDraft, need: PotrebaProjekcija): ApplicationDraft {
  if (need.rezimCene !== 'MY_PRICE') return draft;
  const people = draft.people;
  const price = fixedApplicationPrice(need, /^\d+$/.test(people) ? Number(people) : NaN);
  return { ...draft, people, price: price === null ? '' : String(price) };
}
export default function Prijava() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const izvor = useIzvor(), router = useRouter();
  const { user, accountRevision } = useSesija();
  // One uncertain intent survives a retained tab, but never an A→B→A transition.
  // PKG-006: the same intent also survives remount/cold restore through the durable
  // per-account/Need command journal; only its own server outcome retires it.
  const session = useMemo(() => ({ pending: null as Pending | null, draft: null as ApplicationDraft | null, navigated: false, focused: false, focusToken: 0, readRevision: 0, reading: false,
    journaling: false, journalRecovery: false, resetting: false, notice: null as string | null }), [id, izvor, user?.id, accountRevision]);
  const [, render] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    session.focused = true; session.focusToken++; render(v => v + 1);
    return () => { session.focused = false; };
  }, [session]));
  const read = useCallback(async (): Promise<Ishod<Loaded>> => {
    const generation = ++session.readRevision; session.reading = true;
    session.navigated = false;
    if (!id) { session.reading = false; return { ok: false, kod: 'UNAVAILABLE', poruka: 'Podaci za prijavu nisu dostupni.' }; }
    try {
      const [liveOpportunity, liveNeed, liveProfile, applications] = await boundedApplicationSelectionRead(Promise.all([
        izvor.prilika(id), izvor.potreba(id), izvor.mojRadnikProfil(), izvor.mojePrijave(),
      ]));
      // Visibility can close after a committed write. A successful owned list
      // read still permits replay of only the frozen original request.
      const opportunity = liveOpportunity ?? session.pending?.opportunity;
      const need = liveNeed ?? session.pending?.need;
      const profile = liveProfile ?? session.pending?.profile;
      if (!opportunity || !need || !profile) return { ok: false, kod: 'UNAVAILABLE', poruka: 'Podaci za prijavu nisu dostupni. Proveri zadatak i radni profil.' };
      if (generation !== session.readRevision) return { ok: false, kod: 'STALE_READ', poruka: 'Osveži pa pokušaj ponovo.' };
      session.notice = null;
      if (!session.pending && user?.id) {
        // A recreated instance restores only the exact unresolved command of this account and
        // Need. It is never resent here; the owner replays it explicitly. Corrupt storage is an
        // explicit exit, never a replay source.
        try {
          const stored = await applicationCommandJournal.load(user.id, id);
          const owned = sesijaSada().user?.id === user.id && sesijaSada().accountRevision === accountRevision;
          if (generation !== session.readRevision || !owned) return { ok: false, kod: 'STALE_READ', poruka: 'Osveži pa pokušaj ponovo.' };
          if (stored.state === 'CORRUPT') {
            await applicationCommandJournal.discard(user.id, id);
            if (generation !== session.readRevision) return { ok: false, kod: 'STALE_READ', poruka: 'Osveži pa pokušaj ponovo.' };
            session.notice = 'Sačuvana prijava na telefonu se nije mogla pročitati, pa je uklonjena. Proveri svoje prijave.';
          } else if (stored.state === 'PRESENT' && !session.pending) {
            const command = stored.record.command;
            session.pending = { command, need, opportunity, profile, result: null, inFlight: false, reconciled: false };
            session.draft = { price: String(command.cenaRsd), people: String(command.pokrivenaMesta), note: command.napomena ?? '',
              start: command.predlozeniPocetak, end: command.predlozeniKraj };
          }
          session.journalRecovery = false;
          if (session.focused && sesijaSada().user?.id === user.id &&
            sesijaSada().accountRevision === accountRevision) {
            setValidation(value => value === JOURNAL_RECOVERY_REQUIRED ? null : value);
          }
        } catch {
          // An unread journal may hold an earlier sent command. Do not offer a fresh identity until it is read.
          session.journalRecovery = true;
          return { ok: false, kod: 'APPLICATION_JOURNAL_READ_FAILED',
            poruka: 'Ne možemo da proverimo prethodno poslatu prijavu. Pokušaj ponovo.' };
        }
      }
      // Displayed terms and command revision come from the same Need read.
      const displayedOpportunity = { ...opportunity, naslov: need.naslov, podrucjeTekst: need.podrucjeTekst, vremeTekst: need.vremeTekst,
        pokrivenost: need.pokrivenost, rezimCene: need.rezimCene, osnovaCene: need.osnovaCene, ponudjenaCena: need.ponudjenaCena };
      if (!session.draft) session.draft = withTaskPrice({ price: '', people: '1', note: '', start: null, end: null }, need);
      else if (!session.pending) session.draft = withTaskPrice(session.draft, need);
      if (session.pending) session.pending.reconciled = !session.pending.inFlight;
      const result = session.pending?.result;
      return { ok: true, podatak: { opportunity: displayedOpportunity, need, profile, applications, receipt: result?.ok ? result.podatak : null } };
    } catch { return { ok: false, kod: 'READ_FAILED', poruka: 'Podatke za prijavu trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo.' }; }
    finally { if (generation === session.readRevision) session.reading = false; }
  }, [id, izvor, session]);
  const editor = useOwnedEditor(read), data = editor.data;
  const focusToken = session.focusToken, readRevision = session.readRevision;
  const currentAccount = () => sesijaSada().user?.id === user?.id && sesijaSada().accountRevision === accountRevision;
  const current = () => session.focused && session.focusToken === focusToken && session.readRevision === readRevision && currentAccount();
  const refresh = () => { if (current() && !session.reading && !session.pending?.inFlight && !session.resetting && !session.journaling) void editor.refresh(); };
  const back = () => {
    if (!current()) return;
    if (session.navigated) return;
    session.navigated = true;
    if (router.canGoBack()) router.back();
    else if (id) router.replace({ pathname: '/prilike/[id]', params: { id } });
    else router.replace('/zadaci');
  };
  const submit = async () => {
    const accountId = user?.id;
    if (!current() || !data || !session.draft || session.pending?.inFlight || session.journaling || session.journalRecovery || session.resetting || session.reading || editor.busy || editor.uncertain || !accountId) return;
    if (session.pending?.result && conclusiveApplicationRefusal(session.pending.result)) return;
    // The price and people sent are derived from the same Need read as the revision, never from a stale draft.
    const draft = withTaskPrice(session.draft, data.need);
    if (!session.pending) {
      const price = /^\d+$/.test(draft.price) ? Number(draft.price) : NaN;
      const people = /^\d+$/.test(draft.people) ? Number(draft.people) : NaN;
      if (!Number.isSafeInteger(price) || price < 1 || price > 2_147_483_647 || !Number.isSafeInteger(people) ||
          people < 1 || people > data.need.pokrivenost.preostalo) { setValidation('Unesi cenu u dinarima i broj ljudi koji staje u preostala mesta.'); return; }
      if (data.profile.stanje !== 'ACTIVE' || data.opportunity.primaNovePrijave !== true) { setValidation('Proveri trenutni zadatak i aktivan radni profil.'); return; }
      const deadline = data.opportunity.rokZaPrijaveIso;
      if (typeof deadline === 'string' && Date.parse(deadline) <= Date.now()) { setValidation('Rok za prijave je istekao. Osveži zadatak.'); return; }
      const command: PodnesiPrijavuKomanda = Object.freeze({ clientRequestId: noviZahtevId('prijava'), potrebaId: data.need.id, potrebaRevizija: data.need.revizija,
        radnikProfilId: data.profile.id, pokrivenaMesta: Number(draft.people), cenaRsd: Number(draft.price),
        predlozeniPocetak: draft.start, predlozeniKraj: draft.end, napomena: draft.note.trim() || null });
      // PKG-006: the identity is durable before any I/O. Without it nothing is sent, and the
      // composer stays editable for a plain retry (no request ever left this device).
      session.journaling = true;
      try { await applicationCommandJournal.save({ version: 1, accountId, needId: data.need.id, command }, current); }
      catch (error) {
        if (current()) {
          // Another retained composer or an unread/corrupt journal is a recovery case, not proof of a full disk.
          const needsRecovery = error instanceof Error && ['APPLICATION_COMMAND_UNRESOLVED',
            'APPLICATION_COMMAND_PAYLOAD_CHANGED', 'APPLICATION_COMMAND_JOURNAL_INVALID'].includes(error.message);
          if (needsRecovery) session.journalRecovery = true;
          setValidation(needsRecovery ? JOURNAL_RECOVERY_REQUIRED : NOT_SAVED_ON_DEVICE);
        }
        return;
      }
      finally { session.journaling = false; }
      if (!current() || session.pending) return;
      session.pending = { need: data.need, opportunity: data.opportunity, profile: data.profile, result: null, inFlight: false, reconciled: false, command };
    }
    void editor.save(async () => {
      setValidation(null);
      const pending = session.pending!;
      pending.inFlight = true; pending.reconciled = false;
      let result: Ishod<Receipt>;
      try { result = await izvor.podnesiPrijavu(pending.command); }
      // The notice names the button under it, "Proveri da li je poslato" (r6: it said "Proveri stanje").
      catch { result = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ne znamo da li je prijava stigla. Izaberi „Proveri da li je poslato“.' }; }
      finally { pending.inFlight = false; }
      pending.result = result;
      // Only an exact refusal in the original focus settles the route's second fence.
      // Success belongs to the editor receipt; a late success/refusal still needs fresh readback.
      pending.reconciled = current() && conclusiveApplicationRefusal(result);
      // Only this command's own authoritative receipt retires the durable identity.
      if (result.ok) await applicationCommandJournal.clear(accountId, pending.command.potrebaId, pending.command.clientRequestId).catch(() => undefined);
      if (session.focused && currentAccount()) render(v => v + 1);
      return result.ok ? { ok: true, podatak: { ...data, receipt: result.podatak } } : result;
    }, { settledFailure: conclusiveApplicationRefusal });
  };
  if (!data || !session.draft) return <ComposerUnavailable loading={editor.loading} message={editor.error ?? 'Podaci za prijavu nisu dostupni.'}
    retry={refresh} back={back} />;
  const pending = session.pending;
  // Only SQLSTATE-bound submit evidence may retire this exact intent. A matching message,
  // a fresh collection read or IDEMPOTENCY_KEY_REUSED never does.
  const refusal = pending?.result && conclusiveApplicationRefusal(pending.result) ? pending.result : null;
  const guidance = refusal ? applicationRefusalGuidance(refusal) : null;
  const reset = pending && refusal && !editor.uncertain ? async () => {
    if (!current() || !user?.id || editor.busy || pending.inFlight || session.pending !== pending || pending.result !== refusal || session.resetting || session.journaling || session.reading) return;
    const ownsReset = () => current() && session.pending === pending && pending.result === refusal && !pending.inFlight;
    // Synchronous latch also fences two retained callbacks in the same event turn.
    session.resetting = true; render(v => v + 1);
    try {
      const retired = await applicationCommandJournal.clear(user.id, pending.command.potrebaId, pending.command.clientRequestId, ownsReset);
      if (!ownsReset()) return;
      if (!retired) { setValidation(NOT_RETIRED_ON_DEVICE); return; }
      session.pending = null;
      session.draft = withTaskPrice(session.draft!, data.need);
      setValidation(null);
      await editor.refresh();
    } catch { if (ownsReset()) setValidation(NOT_RETIRED_ON_DEVICE); }
    finally {
      session.resetting = false;
      if (session.focused && currentAccount()) render(v => v + 1);
    }
  } : undefined;
  const pendingHelp = pending && !data.receipt && (!refusal || guidance) ? {
    lines: guidance?.messages.length ? guidance.messages : ['Tvoja prijava ostaje sačuvana dok proveravaš radni profil.'],
    actions: [
      ...((!refusal || guidance?.profile) ? [{ label: 'Dopuni radni profil', onPress: () => { if (current()) router.push('/profil/radnik'); } }] : []),
      ...(guidance?.calendar ? [{ label: 'Otvori raspored', onPress: () => { if (current()) router.push('/raspored'); } }] : []),
    ],
  } : null;
  return <ApplicationComposerPresentation need={pending?.need ?? data.need} opportunity={pending?.opportunity ?? data.opportunity}
    draft={session.draft} change={draft => { if (current() && !editor.busy && !session.pending && !session.resetting && !session.journaling && !session.journalRecovery && !session.reading) { session.draft = withTaskPrice(draft, data.need); setValidation(null); render(v => v + 1); } }}
    busy={editor.busy || !!pending?.inFlight || session.resetting || session.journaling} pending={!!pending} uncertain={editor.uncertain || session.journalRecovery || (!!pending && !pending.reconciled && !data.receipt)} confirmed={!!data.receipt}
    // A conclusive refusal carries its outcome beside the new-offer action immediately.
    // Other failures keep their error and exact-command retry; a collection read never proves refusal.
    error={validation ?? session.notice ?? (refusal && !editor.uncertain
      ? `Ova prijava nije primljena. ${refusal.poruka}`
      : editor.error ?? (pending && !data.receipt && !editor.uncertain
        ? 'Ne znamo da li je prijava stigla. Pošalji istu prijavu još jednom — ako je već stigla, neće biti poslata dvaput.'
        : null))}
    refreshHelps={validation !== NOT_SAVED_ON_DEVICE && validation !== NOT_RETIRED_ON_DEVICE}
    canSubmit={!session.journalRecovery && data.profile.stanje === 'ACTIVE' && data.opportunity.primaNovePrijave === true}
    // The same two facts that decide canSubmit, said in words with the way out (owner's rule: a grey button has a reason beside it).
    blocked={data.profile.stanje !== 'ACTIVE'
      ? { reason: 'Radni profil još nije aktivan — bez njega ponuda ne može da se pošalje.', actionLabel: 'Dopuni radni profil',
        onAction: () => { if (current()) router.push('/profil/radnik'); } }
      // A task that closed under the draft is a dead end without a way on (r6): the other tasks are it. Back stays the
      // header's arrow, so the way on is not "Nazad na zadatak" a second time.
      : data.opportunity.primaNovePrijave !== true ? { reason: 'Zadatak više ne prima prijave.', actionLabel: 'Pogledaj druge zadatke',
        onAction: () => { if (current() && !session.navigated) { session.navigated = true; router.replace('/zadaci'); } } } : null}
    submit={submit} back={back} refresh={refresh} reset={reset} pendingHelp={pendingHelp}
    openApplications={() => { if (!current() || !data.receipt || session.navigated) return; session.navigated = true;
      router.replace({ pathname: '/moje-prijave', params: { prijavaId: data.receipt.prijavaId, nova: '1' } }); }} />;
}
