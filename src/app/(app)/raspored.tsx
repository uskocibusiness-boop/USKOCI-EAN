import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { agreementClientService } from '../../data/agreementClientService';
import { applicationClientService } from '../../data/applicationClientService';
import { needClientService } from '../../data/needClientService';
import { workerAvailabilityClientService } from '../../data/workerAvailabilityClientService';
import { workerCalendarClientService } from '../../data/workerCalendarClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { AgendaScreen, type AgendaApplications, type AgendaAvailability, type AgendaList, type AgendaNeeds, type AgendaSchedule } from '../../ui/calendar/AgendaScreen';
import { monthDistance } from '../../ui/calendar/months';
import { plannerWindow, serbianToday } from '../../ui/calendar/serbianDays';

/**
 * Raspored. Everything of mine that has a time, from the reads the app already makes: the worker schedule (the one authority for
 * the work I confirmed, read once for three months at a time, so a swipe from week to week reads nothing), my Dogovori
 * (both sides, with an exact window), my own tasks and my applications (the reads Početna makes), and the availability the worker
 * keeps, for the thin shade under the days. The screen draws them together; nothing here decides what anything is. A day is a day
 * of Serbian time, the same as the hours written on it.
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
  const needs = useFocusedResource(useCallback(() => needClientService.mojePotrebe({ includeUrgency: false }), []));
  const applications = useFocusedResource(useCallback(() => applicationClientService.mojePrijave(), []));
  const hours = useFocusedResource(useCallback(() => workerAvailabilityClientService.read(), []));
  const schedule: AgendaSchedule = calendar.error ? { state: 'error', message: null }
    : calendar.data ? calendar.data.ok ? { state: 'ready', events: calendar.data.podatak.events } : { state: 'error', message: calendar.data.poruka }
      : { state: 'loading' };
  const list: AgendaList = agreements.error ? { state: 'error' } : agreements.data ? { state: 'ready', agreements: agreements.data }
    : { state: 'loading' };
  const taskList: AgendaNeeds = needs.error ? { state: 'error' } : needs.data ? { state: 'ready', needs: needs.data } : { state: 'loading' };
  const applicationList: AgendaApplications = applications.error ? { state: 'error' }
    : applications.data ? { state: 'ready', applications: applications.data } : { state: 'loading' };
  // The shade is a hint: a person without a work profile, a read that has not come and a read that failed all draw none.
  const availability = useMemo<AgendaAvailability>(() => hours.data?.ok ? { state: 'ready', value: hours.data.podatak } : { state: 'none' }, [hours.data]);
  const everything = [calendar, agreements, needs, applications, hours];
  // A pull keeps what is on screen under the spinner; a retry after an error reads the schedule from the start.
  const refresh = () => { for (const resource of everything) void resource.refresh('keep'); };
  const retry = () => { void calendar.refresh(); for (const resource of [agreements, needs, applications]) void resource.refresh('keep'); };
  const retryRest = () => { for (const resource of [agreements, needs, applications]) if (resource.error) void resource.refresh('keep'); };
  return <AgendaScreen selected={selected} today={serbianToday()} schedule={schedule} list={list} needs={taskList} applications={applicationList}
    availability={availability} readWindow={read} refreshing={everything.some(resource => !!resource.refreshing)} retrying={calendar.loading}
    onSelect={setSelected} onRefresh={refresh} onRetry={retry} onRetryList={retryRest}
    onBack={() => router.canGoBack() ? router.back() : router.replace('/dogovori')}
    onOpen={id => router.navigate({ pathname: '/dogovor/[id]', params: { id } })}
    // A task with applications to choose from opens the candidates, as Početna's "Čeka te" does; any other opens the task.
    onOpenTask={(id, choosing) => router.navigate({ pathname: choosing > 0 ? '/potrebe/[id]/kandidati' : '/potrebe/[id]/pregled', params: { id } })}
    onOpenApplication={prijavaId => router.navigate({ pathname: '/moje-prijave', params: { prijavaId } })}
    onAvailability={() => router.navigate('/profil/dostupnost')} onArchive={() => router.navigate('/arhiva')} />;
}
