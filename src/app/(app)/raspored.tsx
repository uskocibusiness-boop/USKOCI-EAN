import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { agreementClientService } from '../../data/agreementClientService';
import { workerCalendarClientService } from '../../data/workerCalendarClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { AgendaScreen, type AgendaList, type AgendaSchedule } from '../../ui/calendar/AgendaScreen';
import { monthDistance } from '../../ui/calendar/months';
import { plannerWindow, serbianToday } from '../../ui/calendar/serbianDays';

/**
 * Raspored. The Dogovori of mine, both sides, with their time: the worker schedule (the one authority for the work I confirmed, read once
 * for three months at a time, so a swipe from week to week reads nothing) and my Dogovori (with their exact window, the same read Dogovori
 * makes). Two reads, not five: since the owner's phone of 8 Oct 2026 the screen holds the Dogovori and nothing else, so it no longer
 * reads my tasks, my applications or the availability the worker keeps (the thin shade under the days is Dostupnost's to show). The screen
 * draws them together; nothing here decides what anything is. A day is a day of Serbian time, the same as the hours written on it.
 */
export default function Raspored() {
  const [selected, setSelected] = useState(() => serbianToday());
  const month = selected.slice(0, 7);
  // The schedule is read for the month in the middle and the one on each side of it, and read again only when the chosen day goes
  // beyond them: weeks and months within them change with no wait, and the marks never leave the week for a read.
  const [middle, setMiddle] = useState(month);
  if (monthDistance(month, middle) > 1) setMiddle(month);
  const read = useMemo(() => plannerWindow(`${middle}-01`, 1), [middle]);
  const { from, to } = read;
  const calendar = useFocusedResource(useCallback(() => workerCalendarClientService.readRange(from, to), [from, to]));
  const agreements = useFocusedResource(useCallback(() => agreementClientService.mojiDogovori({ includeRatings: false }), []));
  const schedule: AgendaSchedule = calendar.error ? { state: 'error', message: null }
    : calendar.data ? calendar.data.ok ? { state: 'ready', events: calendar.data.podatak.events } : { state: 'error', message: calendar.data.poruka }
      : { state: 'loading' };
  const list: AgendaList = agreements.error ? { state: 'error' } : agreements.data ? { state: 'ready', agreements: agreements.data }
    : { state: 'loading' };
  const everything = [calendar, agreements];
  // A pull keeps what is on screen under the spinner; a retry after an error reads the schedule from the start.
  const refresh = () => { for (const resource of everything) void resource.refresh('keep'); };
  const retry = () => { void calendar.refresh(); void agreements.refresh('keep'); };
  const retryRest = () => { if (agreements.error) void agreements.refresh('keep'); };
  return <AgendaScreen selected={selected} today={serbianToday()} schedule={schedule} list={list}
    readWindow={read} refreshing={everything.some(resource => !!resource.refreshing)} retrying={calendar.loading}
    onSelect={setSelected} onRefresh={refresh} onRetry={retry} onRetryList={retryRest}
    onBack={() => router.canGoBack() ? router.back() : router.replace('/dogovori')}
    onOpen={id => router.navigate({ pathname: '/dogovor/[id]', params: { id } })}
    // "Predloži termin": the form of Izmene Dogovora that proposes a term, the same one Početna's "Čeka te" and the Dogovor's own menu open.
    onProposeTerm={id => router.navigate({ pathname: '/dogovor/[id]/izmene', params: { id, start: 'propose' } })}
    onAvailability={() => router.navigate('/profil/dostupnost')} onArchive={() => router.navigate('/arhiva')} />;
}
