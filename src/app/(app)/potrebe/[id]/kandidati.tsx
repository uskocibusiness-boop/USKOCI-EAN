import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { ProfilePhoto } from '../../../../ui/media/ContextPhotos';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../../contracts/projections';
import type { Ishod, Izvor, IzborKomanda } from '../../../../data/ports';
import { applicationSelectionErrors, boundedApplicationSelectionRead, readSelectedAgreement } from '../../../../data/applicationSelectionClientService';
import type { CandidatesPageRequest } from '../../../../data/candidatesPage';
import { candidatesPagedBuilt } from '../../../../data/candidatesPagedGate';
import { useCandidatesPager } from '../../../../hooks/useCandidatesPager';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { useIzvor } from '../../../../store/uloga';
import { CandidateListPresentation, CandidateSelectionPresentation, SelectionUnavailable, type CandidatesPaging, type CandidateSort } from '../../../../ui/v2/ApplicationSelectionPresentation';
import { useSafetyEntry } from '../../../../ui/safety/useSafetyEntry';
import { Avatar, type AvatarSize } from '../../../../ui/system/Avatar';
type Receipt = { dogovorId: string };
type Pending = { command: IzborKomanda; need: PotrebaProjekcija; candidate: KandidatProjekcija; result: Ishod<Receipt> | null; inFlight: boolean; reconciled: boolean };
type Loaded = { need: PotrebaProjekcija; candidates: KandidatProjekcija[]; receipt: Receipt | null };
type Viewed = { state: 'PENDING' | 'CONFIRMED' | 'UNCONFIRMED' };
const NO_ROWS: KandidatProjekcija[] = [];
/** One sentence for the one refusal: the task changed between two reads, so the applications read before it are not the applications of what it is now. */
const STALE_REVIEW_MESSAGE = 'Zadatak se upravo promenio. Učitaj prijave ponovo.';

/**
 * EX-04 S4 (A11): the same applications a page at a time, in the whole-list order. The screen's editor keeps owning the read of the task, the revision check, the offer sheet and the
 * choice; the pager owns the rows, the server's total and the next page. `complete` asks for the whole set (the order by price and the comparison are only right over every application).
 */
function usePagedCandidates(source: Izvor, taskId: string | undefined, complete: boolean) {
  const readPage = useCallback((request: CandidatesPageRequest) => taskId ? source.prijaveZaPotrebuStrana(taskId, { limit: request.limit, cursor: request.cursor })
    : Promise.reject(new Error('CANDIDATE_PAGE_NEED_REQUIRED')), [source, taskId]);
  const { state, pager } = useCandidatesPager(readPage, complete);
  return { pager, state, rows: state.items as KandidatProjekcija[],
    paging: { total: state.counts?.total ?? null, hasMore: state.hasMore, loadingMore: state.loadingMore, moreError: state.moreError,
      onLoadMore: () => { void pager.loadMore(); } } satisfies CandidatesPaging };
}
type PagedCandidates = ReturnType<typeof usePagedCandidates>;
const useNoPagedCandidates = (_source: Izvor, _taskId: string | undefined, _complete: boolean): PagedCandidates | null => null;
// One reader per build: a compile-time flag, so the order of hooks never changes while the app runs.
const usePagedCandidateRows: (source: Izvor, taskId: string | undefined, complete: boolean) => PagedCandidates | null =
  candidatesPagedBuilt() ? usePagedCandidates : useNoPagedCandidates;
export default function Kandidati() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const izvor = useIzvor(), router = useRouter();
  const { user, accountRevision } = useSesija();
  const session = useMemo(() => ({ pending: null as Pending | null, viewed: new Map<string, Viewed>(), navigated: false,
    active: AppState.currentState !== 'background' && AppState.currentState !== 'inactive', focused: false,
    focusToken: 0, readRevision: 0, reading: false, compare: false, hardReload: false }), [id, izvor, user?.id, accountRevision]);
  const [, render] = useState(0), [resume, setResume] = useState(0);
  const currentAccount = useCallback(() => !!user?.id && sesijaSada().user?.id === user.id &&
    sesijaSada().accountRevision === accountRevision, [user?.id, accountRevision]);
  const [opened, setOpened] = useState<{ data: Loaded; candidate: KandidatProjekcija } | null>(null);
  // The order chosen on the list outlives opening one offer and coming back; it belongs to this Task and
  // this account only, and it is a view of rows already read, never a new request.
  const sortScope = `${id ?? ''}:${user?.id ?? ''}:${accountRevision}`;
  const [sorted, setSorted] = useState<{ scope: string; sort: CandidateSort } | null>(null);
  const sort = sorted?.scope === sortScope ? sorted.sort : 'ARRIVAL';
  // Paged builds only. The order by price and the comparison are only right over every application: while either is on, the rest of the set is read, a page at a time and up to a bound.
  const paged = usePagedCandidateRows(izvor, id, sort === 'PRICE' || session.compare);
  const pager = paged?.pager;
  // A person's photo by their verified public profile id; without one (or while it cannot be read) the one Avatar with the
  // letters the candidate read already carries. One function for the life of the screen, so the memoised rows keep.
  const photo = useCallback((k: KandidatProjekcija, size: AvatarSize) => <ProfilePhoto profileId={k.radnikProfilId} size={size} initial={null}
    fallback={<Avatar size={size} initials={k.inicijali || null} />} />, []);
  // The applications the server confirmed as seen on this phone: their chip says "Viđena". The candidate read carries no viewed flag, so the
  // confirmed marks written by `openOffer` are all there is to say it with; an application not in the set reads "Poslata", which is still true.
  // One Set per distinct content, so the memoised rows do not redraw on every render.
  const seen = Array.from(session.viewed, ([key, view]) => view.state === 'CONFIRMED' ? key : '').filter(Boolean).sort().join('|');
  const viewed = useMemo(() => new Set(seen ? seen.split('|') : []), [seen]);
  useFocusEffect(useCallback(() => {
    session.focused = true; session.focusToken++; render(v => v + 1);
    return () => { session.focused = false; };
  }, [session]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (session.active === active) return;
      session.active = active; session.focusToken++; session.readRevision++; session.reading = false;
      // Private offer/profile/confirmation sheets leave with this visit. A dispatched command is
      // still owned by its original pending record and is reconciled after the next current read.
      setOpened(null);
      if (active) setResume(value => value + 1); else render(value => value + 1);
    });
    return () => subscription.remove();
  }, [session]);
  const read = useCallback(async (): Promise<Ishod<Loaded>> => {
    const generation = ++session.readRevision, token = session.focusToken; session.reading = true;
    session.navigated = false;
    const hard = session.hardReload; session.hardReload = false;
    if (!id) { session.reading = false; return { ok: false, kod: 'UNAVAILABLE', poruka: 'Zadatak nije dostupan.' }; }
    try {
      const [need, candidates] = await boundedApplicationSelectionRead(Promise.all([izvor.potreba(id),
        // Paged: the first page of the set is the read (the rows live in the pager); a page that did not arrive is a read that failed, like the whole list.
        pager ? pager.reload(hard ? 'keep' : 'auto').then(fresh => { if (!fresh) throw new Error('CANDIDATES_PAGE_NOT_READ'); return pager.snapshot().items as KandidatProjekcija[]; })
          : izvor.prijaveZaPotrebu(id)]));
      if (!need) return { ok: false, kod: 'UNAVAILABLE', poruka: 'Zadatak nije dostupan.' };
      // RPC needRevision is the current Need revision for every row, including
      // STALE. Its separate responseNeedRevision is the older submitted snapshot.
      // Never combine independent reads from different current Need revisions.
      if (candidates.some(k => k.potrebaRevizija !== need.revizija)) return { ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: STALE_REVIEW_MESSAGE };
      if (generation !== session.readRevision || token !== session.focusToken || !session.focused || !session.active || !currentAccount())
        return { ok: false, kod: 'STALE_READ', poruka: 'Učitaj aktuelno stanje.' };
      if (session.pending) session.pending.reconciled = !session.pending.inFlight;
      const result = session.pending?.result;
      return { ok: true, podatak: { need, candidates: pager ? NO_ROWS : candidates, receipt: result?.ok ? result.podatak : null } };
    } catch { return { ok: false, kod: 'READ_FAILED', poruka: 'Prijave trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo.' }; }
    finally { if (generation === session.readRevision) session.reading = false; }
  }, [id, izvor, session, currentAccount, resume, pager]);
  const editor = useOwnedEditor(read), data = editor.data;
  // The applications on screen: the whole list's rows, or (paged) what the pager holds for this task.
  const shownRows = paged ? paged.rows : data?.candidates ?? NO_ROWS;
  const pending = session.pending;
  const candidate = pending?.candidate ?? (opened?.data === data ? opened.candidate : null);
  // F05: a candidate is a person; the server resolves the safety target before bezbednost opens.
  const safety = useSafetyEntry(candidate?.radnikProfilId, { needId: id ?? null });
  const focusToken = session.focusToken, readRevision = session.readRevision;
  const current = () => session.focused && session.active && session.focusToken === focusToken && session.readRevision === readRevision && currentAccount();
  const refresh = () => { if (current() && !session.reading && !session.pending?.inFlight) { session.hardReload = true; void editor.refresh(); } };
  const back = () => {
    if (!current()) return;
    // An offer still open on screen closes first. One left behind by a fresh read (the band's "Osveži prijave" brings new
    // data, so the sheet is gone) is cleared on the way out, and this same press goes back (review r4 rk item 1): it
    // used to take one press to clear what nobody could see.
    if (opened && !pending) { setOpened(null); if (candidate) return; }
    if (session.navigated) return; session.navigated = true;
    if (router.canGoBack()) router.back(); else if (id) router.replace({ pathname: '/potrebe/[id]/pregled', params: { id } });
    else router.replace('/potrebe');
  };
  // The offer's confirmation waits on the returned command; every guard below still decides alone whether it runs.
  const choose = () => {
    const k = candidate;
    if (!current() || session.pending?.inFlight || !data || !k || (!pending && (!k.mozeIzabrati || k.stanje !== 'SELECTABLE' || k.potrebaRevizija !== data.need.revizija))) return;
    return editor.save(async () => {
      if (!session.pending) session.pending = { need: data.need, candidate: k, result: null, inFlight: false, reconciled: false,
        command: Object.freeze({ potrebaId: data.need.id, potrebaRevizija: data.need.revizija, prijavaId: k.prijavaId,
          prijavaVerzija: k.verzija, prijavaHash: k.hash, mesta: k.pokrivaMesta, clientRequestId: noviZahtevId('izbor') }) };
      const request = session.pending;
      request.inFlight = true; request.reconciled = false;
      let result: Ishod<Receipt>;
      try { result = await izvor.izaberiPrijavu(request.command); }
      catch { result = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod izbora nije potvrđen. Proveri stanje.' }; }
      finally { request.inFlight = false; }
      request.result = result;
      if (session.focused && session.active && currentAccount()) render(v => v + 1);
      return result.ok ? { ok: true, podatak: { ...data, receipt: result.podatak } } : result;
    });
  };
  const openOffer = (k: KandidatProjekcija) => {
    if (!current() || session.navigated || session.reading || editor.busy || editor.loading || !data ||
        !shownRows.includes(k)) return;
    setOpened({ data, candidate: k });
    const previous = session.viewed.get(k.prijavaId);
    if (previous && previous.state !== 'UNCONFIRMED') return;
    const attempt: Viewed = { state: 'PENDING' };
    session.viewed.set(k.prijavaId, attempt);
    // Only this explicit offer-opening action writes viewed state. Reopening an
    // unconfirmed offer may repeat its exact idempotent target; reads never do.
    void (async () => {
      try {
        const result = await izvor.oznaciPrijavuVidjenom(k.prijavaId);
        attempt.state = result.ok ? 'CONFIRMED' : 'UNCONFIRMED';
      } catch { attempt.state = 'UNCONFIRMED'; }
      // The result remains scoped to this original account/session object.
      // A late result cannot navigate, change selection, or update another view.
      if (current() && session.viewed.get(k.prijavaId) === attempt) render(value => value + 1);
    })();
  };
  // The row at the top of the list opens the Task itself, whichever screen the list was opened from.
  const openTask = () => {
    if (!current() || session.navigated || !id) return;
    session.navigated = true; router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id } });
  };
  // One function per offer, read revision and account (it was a new one on every render, and the Dogovor link of an
  // offer already chosen was read again on each, e.g. when the viewed mark came back). Every check stays inside it.
  const needId = data?.need.id, chosenId = candidate?.prijavaId;
  const readAgreement = useCallback(async (): Promise<Ishod<{ dogovorId: string | null }>> => {
    if (!needId || !chosenId || !current()) return { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvori prijavu.' };
    const result = await readSelectedAgreement(needId, chosenId);
    return current() ? result : { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvori prijavu.' };
    // `current` reads the render's focus token and read revision and the account; those are the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId, chosenId, focusToken, readRevision, user?.id, accountRevision, session]);
  // Paged: a later page may have been read after the task changed under the first one. Applications of two revisions are never shown together: the same refusal the whole list makes,
  // unless a choice is already being decided (its sheet is what matters then).
  const mixed = !!paged && !!data && !pending && paged.rows.some(k => k.potrebaRevizija !== data.need.revizija);
  if (!session.focused || !session.active || editor.loading || !data || mixed)
    return <SelectionUnavailable loading={!session.focused || !session.active || editor.loading}
      message={mixed ? STALE_REVIEW_MESSAGE : editor.error ?? 'Prijave nisu dostupne.'} retry={refresh} back={back} />;
  // Step 7 (2026-09-24): the list stays under an opened offer, which is a sheet over it; closing the sheet is `back`.
  const list = <CandidateListPresentation need={data.need} candidates={shownRows} back={back} refresh={refresh} paging={paged?.paging}
    open={openOffer} openTask={openTask} sort={sort}
    onSort={sort => { if (current()) setSorted({ scope: sortScope, sort }); }}
    comparison={session.compare} onComparison={compare => { if (current()) { session.compare = compare; render(value => value + 1); } }} photo={photo} viewed={viewed} />;
  if (!candidate) return list;
  const rejection = pending?.result && !pending.result.ok && Object.prototype.hasOwnProperty.call(applicationSelectionErrors, pending.result.kod);
  return <>{list}<CandidateSelectionPresentation need={pending?.need ?? data.need} candidate={candidate} back={back}
    photo={photo(candidate, 56)} safety={safety} viewed={viewed.has(candidate.prijavaId)}
    // The profile sheet's 96 px portrait, as the task's poster sheet draws it: the photo or its own large stand-in.
    publicPhoto={(profileId, size) => <ProfilePhoto profileId={profileId} size={size ?? 96} initial={null} />}
    readAgreement={readAgreement} openLinkedAgreement={agreementId => {
      if (!current() || session.navigated) return;
      session.navigated = true; router.replace({ pathname: '/dogovor/[id]', params: { id: agreementId } });
    }}
    publicProfile={async () => {
      if (!current()) return null;
      const profile = await izvor.javniProfil(candidate.radnikProfilId);
      return current() ? profile : null;
    }}
    choose={choose} busy={editor.busy || !!pending?.inFlight} pending={!!pending} uncertain={editor.uncertain || (!!pending && !pending.reconciled && !data.receipt)} refresh={refresh}
    error={editor.error ?? (pending && !data.receipt && !editor.uncertain ? 'Aktuelno stanje je učitano. Za potvrdu prvobitnog izbora pošalji ponovo.'
      : session.viewed.get(candidate.prijavaId)?.state === 'UNCONFIRMED'
        ? 'Ponuda je otvorena, ali nije označena kao viđena. Zatvori je i otvori ponovo.' : null)}
    confirmed={!!data.receipt} openAgreement={() => {
      if (!current() || !data.receipt || session.navigated) return;
      session.navigated = true; router.replace({ pathname: '/dogovor/[id]', params: { id: data.receipt.dogovorId } });
    }} reset={rejection && !editor.uncertain ? () => {
      if (!current() || editor.busy || !pending || pending.inFlight || session.pending !== pending || !pending.result || pending.result.ok) return;
      session.pending = null; setOpened(null); void editor.refresh();
    } : undefined} /></>;
}
