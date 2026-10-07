import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import type { AgreementChangeTerms } from '../../data/agreementClientService';
import { sesijaSada, useSesija } from '../../store/sesija';

import { noviUuidZahtevId } from '../../lib/idempotencija';
import { calendarInstant } from '../../lib/calendarTime';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { civilInstant, zonedParts } from '../calendar/calendarPresentation';
import { AgreementActionsPresentation, type AgreementActionForm } from './AgreementActionsPresentation';
import { AgreementActionsController, type AgreementActionsState } from './AgreementActionsController';
import { journalFor, normalizeAgreementCommand, validProposal, type AgreementActionCommand } from './agreementActionsModel';

type Form = AgreementActionForm;
const initial: AgreementActionsState = { phase: 'LOADING', snapshot: null, journal: null, error: null, message: null, canRetry: false, needsReentry: false };
export function AgreementActionsScreen({ agreementId, start }: {
  agreementId: string;
  /** The form to open as soon as the terms in force have been read (the Dogovor's "···" menu names one); without it the hub opens. */
  start?: Form['kind'];
}) {
  const { user, accountRevision } = useSesija(), accountId = user?.id ?? '';
  const [state, setState] = useState(initial), [form, setForm] = useState<Form | null>(null);
  const [review, setReview] = useState<AgreementActionCommand | null>(null), [error, setError] = useState<string | null>(null), [epoch, setEpoch] = useState(0);
  const owner = useRef<object | null>(null), engine = useRef<AgreementActionsController | null>(null);
  const leaving = useRef(false);
  const formRef = useRef(form); formRef.current = form;
  const reviewRef = useRef(review); reviewRef.current = review;
  const reviewBase = useRef(state.snapshot), submitting = useRef(false);
  useFocusEffect(useCallback(() => {
    const scope = {}; owner.current = scope; leaving.current = false; submitting.current = false; setState(initial); setForm(null); setReview(null); setError(null);
    const current = () => owner.current === scope && !['background','inactive'].includes(AppState.currentState)
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    const controller = new AgreementActionsController({ agreementId, account: { accountId, accountRevision }, current, storage: AsyncStorage });
    engine.current = controller;
    controller.subscribe(() => { if (current()) setState(controller.snapshot()); }); void controller.load();
    const listener = AppState.addEventListener('change', next => {
      if (leaving.current) return;
      if (next !== 'active') { controller.dispose(); owner.current = null; }
      else setEpoch(value => value + 1);
    });
    return () => { listener.remove(); controller.dispose(); if (owner.current === scope) owner.current = null; if (engine.current === controller) engine.current = null; };
  }, [agreementId, accountId, accountRevision, epoch]));
  const renderedOwner = owner.current, controller = engine.current;
  const current = () => renderedOwner !== null && owner.current === renderedOwner && engine.current === controller
    && !['background','inactive'].includes(AppState.currentState) && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision;
  const busy = state.phase === 'LOADING' || state.phase === 'SENDING', snapshot = state.snapshot;
  const actionCurrent = () => current() && controller?.snapshot() === state;
  const openForm = (kind: Form['kind'], reentry = false) => {
    if (!actionCurrent() || !snapshot || busy || submitting.current || formRef.current || reviewRef.current) return;
    if (reentry ? !state.journal || !state.canRetry || state.journal.kind !== kind
      : state.phase !== 'READY' || !(kind === 'PROPOSE' ? snapshot.actions.canProposeChange && snapshot.terms : snapshot.actions.canCancel)) return;
    const zone = DOGOVORENA_ZONA, terms = snapshot.terms;
    const start = terms?.startsAt ? zonedParts(new Date(terms.startsAt), zone) : { date: '', time: '' };
    const end = terms?.endsAt ? zonedParts(new Date(terms.endsAt), zone) : { date: '', time: '' };
    const next: Form = { token: {}, kind, reentry, key: reentry ? state.journal!.clientRequestId ?? '' : noviUuidZahtevId(),
      price: String(terms?.priceRsd ?? ''), scope: terms?.scopeNote ?? '', reason: '', zone,
      startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time,
      priceChanged: false, scopeChanged: false, startChanged: false, endChanged: false }; formRef.current = next; setForm(next); setError(null);
  };
  // Arriving from the menu's "Izmeni uslove" or "Otkaži Dogovor": the form it names opens once, when the terms have been read and
  // the command is permitted. `openForm` keeps every one of its own guards, so a command that is not allowed leaves the hub.
  const arrived = useRef(false);
  useEffect(() => {
    if (!start || arrived.current || state.phase !== 'READY' || !snapshot || form || review) return;
    arrived.current = true;
    openForm(start);
  });
  const edit = (patch: Partial<Form>) => { if (current() && !busy && form && formRef.current?.token === form.token && !reviewRef.current) setForm({ ...formRef.current, ...patch }); };
  const prepare = (command: AgreementActionCommand, fromForm = false) => {
    if (!actionCurrent() || busy || submitting.current || !snapshot || reviewRef.current || (!fromForm && formRef.current)) return;
    const normalized = normalizeAgreementCommand(command);
    if (state.journal && journalFor(normalized).payloadHash !== state.journal.payloadHash) {
      setError('Unos se razlikuje od prvobitnog zahteva. Ponovo unesi iste izmenjene podatke i isti razlog.'); return;
    }
    reviewBase.current = snapshot; reviewRef.current = normalized; setReview(normalized); formRef.current = null; setForm(null); setError(null);
  };
  const prepareForm = () => {
    if (!form || formRef.current !== form || !current() || busy || !snapshot) return;
    const version = form.reentry ? state.journal!.agreementVersion : snapshot.agreementVersion;
    if (form.kind === 'CANCEL') {
      if (!form.reason.trim()) { setError('Unesi razlog otkazivanja.'); return; }
      prepare({ kind: 'CANCEL', agreementId, version, reason: form.reason }, true); return;
    }
    const patch: { cenaIznos?: number; cenaValuta?: string; obim?: string; pocetakIso?: string; krajIso?: string } = {};
    if (form.priceChanged && (form.reentry || Number(form.price) !== snapshot.terms?.priceRsd)) {
      if (!/^[1-9][0-9]*$/.test(form.price.trim()) || !Number.isSafeInteger(Number(form.price))) { setError('Unesi pozitivan ceo iznos u RSD.'); return; }
      patch.cenaIznos = Number(form.price); patch.cenaValuta = 'RSD';
    }
    if (form.scopeChanged && (form.reentry || form.scope.trim() !== (snapshot.terms?.scopeNote ?? ''))) patch.obim = form.scope;
    if (form.startChanged || form.endChanged) {
      // An endpoint the user did not edit retains its accepted precision. Civil
      // controls show minutes; they must not silently round the other endpoint.
      const start = !form.startChanged && snapshot.terms?.startsAt ? { value: snapshot.terms.startsAt, error: null }
        : civilInstant(form.startDate, form.startTime, form.zone);
      const end = !form.endChanged && snapshot.terms?.endsAt ? { value: snapshot.terms.endsAt, error: null }
        : civilInstant(form.endDate, form.endTime, form.zone);
      if (!start.value || !end.value || calendarInstant(start.value)! >= calendarInstant(end.value)!) { setError(start.error || end.error || 'Kraj mora biti posle početka.'); return; }
      patch.pocetakIso = start.value; patch.krajIso = end.value;
    }
    const value = { dogovorId: agreementId, ocekivanaVerzija: version, clientRequestId: form.key, izmena: patch, razlog: form.reason };
    if (!validProposal(value)) { setError('Izmeni bar jedan podatak. Oba kraja termina moraju biti određena.'); return; }
    prepare({ kind: 'PROPOSE', value }, true);
  };
  const send = async () => {
    if (!current() || busy || submitting.current || !review || reviewRef.current !== review || controller?.snapshot().snapshot !== reviewBase.current) return;
    submitting.current = true;
    try { await controller.submit(review); if (current()) { setReview(null); reviewRef.current = null; } }
    finally { if (current()) submitting.current = false; }
  };
  const run = (name: 'refresh' | 'retry') => { if (actionCurrent() && !busy && !submitting.current && !formRef.current && !reviewRef.current) void controller?.[name](); };
  // "Prikaži aktuelni Dogovor" shows the Dogovor (plan 3.6; it used to show this hub again): the outcome is acknowledged - the journal
  // is retired and the terms are read once more - and the screen goes back to the Dogovor, which reads itself again on focus. If the
  // read after the acknowledgement does not answer, the screen stays and says so, as before.
  const showAgreement = async () => {
    if (!actionCurrent() || busy || submitting.current || formRef.current || reviewRef.current) return;
    await controller?.acknowledge();
    if (current() && controller?.snapshot().phase === 'READY') back();
  };
  let proposed: AgreementChangeTerms | null = null;
  if (review?.kind === 'PROPOSE' && snapshot?.terms) { const patch = review.value.izmena; proposed = { ...snapshot.terms,
    priceRsd: patch.cenaIznos ?? snapshot.terms.priceRsd, scopeNote: patch.obim ?? snapshot.terms.scopeNote,
    startsAt: patch.pocetakIso ?? snapshot.terms.startsAt, endsAt: patch.krajIso ?? snapshot.terms.endsAt }; }
  else if (review?.kind === 'RESPOND' || review?.kind === 'WITHDRAW') proposed = review.proposal.terms;
  // The screen came from its Dogovor; with no stack under it (a cold start), it goes to that Dogovor.
  const back = () => {
    if (!current()) return;
    // Retire before navigation: a journal write may settle before the route blurs.
    // Keep the journal for read-only recovery, but never start its writer after exit.
    leaving.current = true; owner.current = null; controller?.dispose();
    if (engine.current === controller) engine.current = null;
    if (router.canGoBack()) router.back(); else router.replace({ pathname: '/dogovor/[id]', params: { id: agreementId } });
  };
  const closeForm = () => { if (current() && formRef.current === form) { formRef.current = null; setForm(null); setError(null); } };
  const closeReview = () => { if (current() && reviewRef.current === review && !submitting.current) { reviewRef.current = null; setReview(null); setError(null); } };
  // A step of the flow is closed by the system Back as by its X, so a typed proposal or reason is never lost to a whole-
  // screen exit; while a command runs, Back waits with the step (review r6).
  const stepBack = useRef<() => boolean>(() => false);
  stepBack.current = () => {
    if (leaving.current) return true;
    if (!current()) return false;
    if (!form && !review) { back(); return true; }
    if (!busy && !submitting.current) { if (form) closeForm(); else closeReview(); }
    return true;
  };
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => stepBack.current());
    return () => subscription.remove();
  }, []));
  return <AgreementActionsPresentation phase={state.phase} snapshot={snapshot} accountId={accountId} error={error || state.error} message={state.message}
    canRetry={state.canRetry} needsReentry={state.needsReentry} journalKind={state.journal?.kind ?? null}
    form={form} review={review} proposed={proposed}
    onBack={back} onRefresh={() => run('refresh')} onOpenForm={openForm} onEdit={edit} onPrepareForm={prepareForm}
    onCloseForm={closeForm}
    onPrepare={command => prepare(command)} onSend={() => { void send(); }}
    onCloseReview={closeReview}
    onRetry={() => run('retry')} onAcknowledge={() => { void showAgreement(); }} />;
}
