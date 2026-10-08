import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import type { MojaPrijavaProjekcija, PotrebaProjekcija, UcesnikProjekcija } from '../contracts/projections';
import type { WorkerCalendarEvent } from '../contracts/workerCalendar';
import type { AvailabilityRule, AvailabilityWindow, WorkerAvailabilityInput } from '../contracts/workerAvailability';
import { AgendaScreen, type AgendaAvailability, type AgendaList, type AgendaSchedule } from '../ui/calendar/AgendaScreen';
import { ArchiveScreen } from '../ui/calendar/ArchiveScreen';
import type { AgendaAgreement } from '../ui/calendar/agenda';
import { AvailabilityForm, CopySheet, RuleSheet, WindowSheet } from '../ui/calendar/AvailabilityForm';
import { CalendarScreen } from '../ui/calendar/CalendarControls';
import { civilInstant, shiftDate, weekDates, weekdays } from '../ui/calendar/calendarPresentation';
import type { CalendarView } from '../ui/calendar/calendarViews';
import { serbianToday } from '../ui/calendar/serbianDays';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { StateView } from '../ui/system/StateView';
import { LARGE_LAYOUT, LayoutClassOverride, type LayoutClassResult } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';

/**
 * Raspored (the calendar of three views: Mesec, Nedelja, Dan), Arhiva and Dostupnost za rad in their main states, for the lead to
 * photograph on the emulator (owner step 10, 2026-09-24; the calendar since 8 Oct 2026). Reached only by its address
 * (uskociapp://dizajn-kalendar) in the internal build; the store package shows nothing. It draws the real presentation (`AgendaScreen`,
 * `AvailabilityForm`, its three sheets and `CalendarScreen`) with fixture props: nothing here reads or writes data, no command is sent,
 * and every press that would leave the screen or save does nothing. Each scene is chosen from the list by its label, or by its address
 * (`?scene=mesec`), at the designed text size or, with `?text=1.15` / `?text=1.3`, at the larger ones; "Nazad" (the strip at the
 * bottom, or the top bar's arrow) returns to the list.
 */
type SceneKey = 'dan' | 'prazno' | 'prazanDan' | 'bezTermina' | 'vlasnik' | 'ucitava' | 'greska' | 'delimicno' | 'bezVremena' | 'dugi' | 'zona'
  | 'mnogo' | 'mesecBezProfila' | 'nedeljaDogovori' | 'nedeljaSlobodna' | 'nedeljaDugi'
  | 'danDogovori' | 'danPrazan' | 'danPreklapanje' | 'danNoc' | 'danDugi'
  | 'arhiva' | 'arhivaPrazna' | 'arhivaGreska'
  | 'nedeljaPrazna' | 'nedelja' | 'dUcitava' | 'dGreska' | 'bezProfila' | 'cuva' | 'nepoznato' | 'razlog' | 'sacuvano' | 'dZona'
  | 'termin' | 'poseban' | 'kopiraj';
const SCENES: { key: SceneKey; label: string }[] = [
  { key: 'dan', label: 'Kalendar · mesec, dan sa Dogovorima' }, { key: 'prazno', label: 'Kalendar · mesec bez Dogovora' },
  { key: 'prazanDan', label: 'Kalendar · mesec, prazan dan, Dogovori na drugim danima' },
  { key: 'bezTermina', label: 'Kalendar · mesec, Dogovori bez termina (traka i spisak)' }, { key: 'vlasnik', label: 'Kalendar · kako ga je video vlasnik (jedan Dogovor bez termina)' },
  { key: 'mnogo', label: 'Kalendar · mesec, mnogo Dogovora u danu' }, { key: 'mesecBezProfila', label: 'Kalendar · mesec, bez radnog profila' },
  { key: 'nedeljaDogovori', label: 'Kalendar · nedelja sa Dogovorima' }, { key: 'nedeljaSlobodna', label: 'Kalendar · nedelja, ništa zakazano' },
  { key: 'nedeljaDugi', label: 'Kalendar · nedelja, dugi nazivi' },
  { key: 'danDogovori', label: 'Kalendar · dan na satnici, Dogovori i dostupnost' }, { key: 'danPrazan', label: 'Kalendar · dan na satnici, prazan dan' },
  { key: 'danPreklapanje', label: 'Kalendar · dan, preklapanje i mnogo Dogovora' }, { key: 'danNoc', label: 'Kalendar · dan, Dogovor u toku noći' },
  { key: 'danDugi', label: 'Kalendar · dan, dugi nazivi' },
  { key: 'arhiva', label: 'Arhiva · završeno i otkazano' }, { key: 'arhivaPrazna', label: 'Arhiva · prazna' }, { key: 'arhivaGreska', label: 'Arhiva · greška' },
  { key: 'ucitava', label: 'Kalendar · učitava' }, { key: 'greska', label: 'Kalendar · greška' },
  { key: 'delimicno', label: 'Kalendar · samo termini u kojima uskačeš' },
  { key: 'bezVremena', label: 'Kalendar · lista ne kaže tačno vreme' }, { key: 'dugi', label: 'Kalendar · mesec, dugi nazivi' },
  { key: 'zona', label: 'Kalendar · telefon van Srbije' },
  { key: 'nedeljaPrazna', label: 'Dostupnost · prazna nedelja' }, { key: 'nedelja', label: 'Dostupnost · radna nedelja' },
  { key: 'dUcitava', label: 'Dostupnost · učitava' }, { key: 'dGreska', label: 'Dostupnost · greška' },
  { key: 'bezProfila', label: 'Dostupnost · bez radnog profila' },
  { key: 'cuva', label: 'Dostupnost · čuva se' }, { key: 'nepoznato', label: 'Dostupnost · ishod nije potvrđen' },
  { key: 'razlog', label: 'Dostupnost · profil, dugme sa razlogom' }, { key: 'sacuvano', label: 'Dostupnost · sačuvano' },
  { key: 'dZona', label: 'Dostupnost · druga vremenska zona' },
  { key: 'termin', label: 'List · Novi termin' }, { key: 'poseban', label: 'List · Poseban datum' },
  { key: 'kopiraj', label: 'List · Kopiraj termine' },
];
const noop = () => {};
/** The web lab has no text scale: `?text=1.15` draws the designed layout and `?text=1.3` the stacked one, whatever the width says. */
const COMPACT_LAYOUT: LayoutClassResult = { cls: 'compact', stacked: false };

const today = serbianToday();
/** An instant of a civil day at a Serbian clock. */
const onDay = (day: string, time: string) => civilInstant(day, time, 'Europe/Belgrade').value ?? new Date().toISOString();
/** An instant of today (or a day around it) at a Serbian clock. */
const at = (time: string, days = 0) => onDay(shiftDate(today, days), time);
/** The Monday of today's week, so the week's scenes stand on the same days of it whatever day the gallery is opened on. */
const [monday] = weekDates(today);
const people = (me: 'narucilac' | 'uskocer', other: string): UcesnikProjekcija[] => [
  { id: 'me', profilId: null, ime: 'Ti', inicijali: '', uloga: me, mesta: me === 'uskocer' ? 1 : null, viSte: true, telefon: null },
  { id: 'other', profilId: null, ime: other, inicijali: other.charAt(0), uloga: me === 'uskocer' ? 'narucilac' as const : 'uskocer' as const, mesta: null,
    viSte: false, telefon: null }];
const agreement = (id: string, patch: Partial<AgendaAgreement>): AgendaAgreement => ({ id, verzija: 1, naslov: 'Pomoć oko krečenja stana',
  stanje: 'CONFIRMED', cena: { iznos: 4000, valuta: 'RSD', prikaz: '4.000 RSD' }, vremeTekst: '', putanjaTekst: 'Liman, Novi Sad',
  pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 }, ucesnici: people('narucilac', 'Marko'), rezim: 'FIZICKI',
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null,
  izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null }, tacanTermin: null, ...patch });
/** The same Dogovor as an older list read gives it: without saying whether it has an exact time (no `tacanTermin` key). */
const unsaid = ({ tacanTermin: _unsaid, ...rest }: AgendaAgreement): AgendaAgreement => rest;
const event = (id: string, agreementId: string, start: string, end: string): WorkerCalendarEvent =>
  ({ eventId: id, agreementId, agreementVersion: 1, startsAt: start, endsAt: end, agreementStatus: 'CONFIRMED', source: 'AGREEMENT' });

const EVENTS = [event('e1', 'w1', at('08:00'), at('10:30')), event('e2', 'w2', at('19:30'), at('21:00'))];
const AGREEMENTS: AgendaAgreement[] = [
  agreement('w1', { naslov: 'Montaža police u hodniku', ucesnici: people('uskocer', 'Ana'), cena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
    putanjaTekst: 'Grbavica, Novi Sad' }),
  // My own work, marked done and waiting for Nikola: the schedule keeps it and says it waits.
  agreement('w2', { naslov: 'Prenos ormara do kombija', stanje: 'AWAITING_REQUESTER', ucesnici: people('uskocer', 'Nikola'),
    cena: { iznos: 0, valuta: 'RSD', prikaz: '' } }),
  agreement('r1', { tacanTermin: { pocetak: at('12:00'), kraj: at('19:00') }, stanje: 'COMPLETED' }),
  agreement('r2', { naslov: 'Čišćenje stana posle krečenja', tacanTermin: { pocetak: at('11:00'), kraj: at('13:00') }, stanje: 'AWAITING_REQUESTER',
    ucesnici: people('narucilac', 'Jelena'), putanjaTekst: 'Detelinara, Novi Sad' }),
  agreement('r3', { naslov: 'Pomoć pri selidbi', tacanTermin: { pocetak: at('22:00', 1), kraj: at('02:00', 2) }, ucesnici: people('narucilac', 'Stefan') }),
  agreement('r4', { naslov: 'Lekcije iz matematike', rezim: 'DALJINSKI', tacanTermin: { pocetak: at('17:00', -1), kraj: at('18:00', -1) } }),
  // An accepted start and no accepted end ("kraj nije potvrđen"): it has an hour, so it stands on its day as "od 15:30", never under "Termin još nije dogovoren".
  agreement('r5', { naslov: 'Šišanje živice', vremeTekst: 'Od 15:30 · kraj nije potvrđen', tacanTermin: null, prihvacenPocetak: at('15:30'), ucesnici: people('narucilac', 'Stefan') }),
  agreement('f1', { naslov: 'Košenje trave', tacanTermin: null, prihvacenPocetak: null }),
];
/**
 * The Dogovori that have no accepted start, as the list tells them: one that has no term at all (it asks for one), one with only an accepted
 * END (its own words say so: "Do 10. okt · 18:00 · početak nije potvrđen"; asks for a term), and one whose completion waits for a
 * confirmation (no command: "Čeka potvrdu"). One with an accepted start is not here: it stands on its day (`r5`).
 */
const WITHOUT_TERM: AgendaAgreement[] = [
  agreement('f1', { naslov: 'Krečenje stana od 80 m² u belo', vremeTekst: 'Termin nije dogovoren', putanjaTekst: 'Novi Sad', cena: { iznos: 62000, valuta: 'RSD', prikaz: '62.000 RSD' },
    tacanTermin: null, prihvacenPocetak: null, ucesnici: people('uskocer', 'msljivic031') }),
  agreement('f2', { naslov: 'Čišćenje stana na Petrovaradinu', vremeTekst: 'Do 10. okt · 18:00 · početak nije potvrđen', putanjaTekst: 'Petrovaradin, Novi Sad', tacanTermin: null,
    prihvacenPocetak: null, ucesnici: people('narucilac', 'Jelena') }),
  agreement('f3', { naslov: 'Montaža nadstrešnice', vremeTekst: 'Termin nije dogovoren', stanje: 'AWAITING_REQUESTER', tacanTermin: null,
    prihvacenPocetak: null, ucesnici: people('narucilac', 'Nikola'), cena: { iznos: 0, valuta: 'RSD', prikaz: '' } }),
];
const LONG: AgendaAgreement[] = [
  agreement('l1', { naslov: 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu zgrade',
    tacanTermin: { pocetak: at('09:00'), kraj: at('16:30') }, cena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' },
    putanjaTekst: 'Novo naselje, Bulevar Evrope, Novi Sad, blizu Ekonomske škole', ucesnici: people('narucilac', 'Aleksandra Petrović-Jovanović') }),
  agreement('l2', { naslov: 'Selidba kancelarije sa arhivom i nameštajem na drugi kraj grada', stanje: 'AWAITING_REQUESTER',
    tacanTermin: { pocetak: at('17:00'), kraj: at('23:30') }, ucesnici: people('narucilac', 'Konstantin Radosavljević') }),
];

/**
 * A Dogovor of one day at Serbian clocks: work I do (`uskocer`: it comes from the schedule, which is the authority for it) or my own task
 * (`narucilac`: its exact window comes with the list). Returns the Dogovor and, for my work, its row of the schedule.
 */
function onTheDay(day: string, id: string, title: string, from: string, to: string, side: 'narucilac' | 'uskocer', who: string, patch: Partial<AgendaAgreement> = {}) {
  const mine = side === 'uskocer';
  return { agreement: agreement(id, { naslov: title, ucesnici: people(side, who), ...(mine ? {} : { tacanTermin: { pocetak: onDay(day, from), kraj: onDay(day, to) } }), ...patch }),
    events: mine ? [event(`e-${id}`, id, onDay(day, from), onDay(day, to))] : [] };
}
const gather = (parts: ReturnType<typeof onTheDay>[]) => ({ agreements: parts.map(part => part.agreement), events: parts.flatMap(part => part.events) });
/** Nine Dogovori in one day, four of them at once in the morning: the hours draw three columns, and the fourth is listed under them. */
const MANY = gather([
  onTheDay(today, 'm1', 'Montaža police u hodniku', '08:00', '09:30', 'uskocer', 'Ana'), onTheDay(today, 'm2', 'Bojenje ograde', '08:30', '10:30', 'narucilac', 'Marko'),
  onTheDay(today, 'm3', 'Prenos kutija', '09:00', '11:00', 'uskocer', 'Nikola'), onTheDay(today, 'm4', 'Popravka slavine', '09:15', '10:00', 'narucilac', 'Jelena'),
  onTheDay(today, 'm5', 'Košenje trave', '12:00', '13:00', 'uskocer', 'Stefan'), onTheDay(today, 'm6', 'Čišćenje terase', '13:00', '14:30', 'narucilac', 'Ivana'),
  onTheDay(today, 'm7', 'Lekcije iz matematike', '15:00', '16:00', 'uskocer', 'Petar', { rezim: 'DALJINSKI' }),
  onTheDay(today, 'm8', 'Sklapanje kreveta', '18:00', '19:00', 'narucilac', 'Milica'), onTheDay(today, 'm9', 'Pomoć pri selidbi', '18:30', '20:00', 'uskocer', 'Dragan'),
]);
/** A Dogovor that begins before the hours of the day and one that runs past them: the rail moves outwards to take them in. */
const NIGHT = gather([
  onTheDay(today, 'n1', 'Dostava pekarskih proizvoda', '05:30', '07:30', 'uskocer', 'Zoran'),
  onTheDay(today, 'n2', 'Čuvanje deteta preko večeri', '20:00', '23:30', 'narucilac', 'Maja'),
  onTheDay(today, 'n3', 'Noćno dežurstvo', '22:30', '23:59', 'uskocer', 'Goran'),
]);
/** A week of them, on the same days of it whatever day it is: Monday and Friday are free, and the days between have one, two and three. */
const WEEKLY = gather([
  onTheDay(shiftDate(monday, 1), 'k1', 'Montaža police', '18:00', '19:30', 'narucilac', 'Petar'),
  onTheDay(shiftDate(monday, 2), 'k2', 'Prevoz od Petrovaradina do centra', '14:00', '16:00', 'uskocer', 'Marko'),
  onTheDay(shiftDate(monday, 2), 'k3', 'Čišćenje stana posle krečenja', '09:00', '11:00', 'narucilac', 'Jelena', { stanje: 'AWAITING_REQUESTER' }),
  onTheDay(shiftDate(monday, 3), 'k4', 'Krečenje stana od 80 m² u belo', '09:00', '13:00', 'uskocer', 'Milan'),
  onTheDay(shiftDate(monday, 3), 'k5', 'Montaža police', '17:00', '18:30', 'narucilac', 'Ana'),
  onTheDay(shiftDate(monday, 5), 'k6', 'Selidba kancelarije', '10:00', '15:00', 'uskocer', 'Nikola'),
  onTheDay(shiftDate(monday, 5), 'k7', 'Košenje trave', '15:30', '17:00', 'narucilac', 'Stefan'),
  onTheDay(shiftDate(monday, 5), 'k8', 'Lekcije iz matematike', '18:00', '19:00', 'uskocer', 'Ivana', { rezim: 'DALJINSKI' }),
]);

/** My own task, closed: the fields the Arhiva reads (Raspored no longer holds tasks or applications). */
const need = (id: string, patch: Partial<PotrebaProjekcija>): PotrebaProjekcija => ({ id, revizija: 1, naslov: 'Selidba ormara', opis: '', stanje: 'OBJAVLJENA',
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, vremeTekst: 'Fleksibilan termin', podrucjeTekst: 'Detelinara, Novi Sad', uslovi: [],
  brojPrijava: 0, brojPrijavaZaIzbor: 0, schedule: { kind: 'FLEXIBLE', startsAt: null, endsAt: null }, ...patch } as PotrebaProjekcija);
/** My own application, withdrawn or closed: the fields the Arhiva reads. */
const application = (id: string, patch: Partial<MojaPrijavaProjekcija>): MojaPrijavaProjekcija => ({ prijavaId: id, potrebaId: `need-${id}`, potrebaRevizija: 1,
  prijavaRevizija: 1, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: 'Košenje trave', opis: '', cena: { iznos: 1500, valuta: 'RSD', prikaz: '1.500 RSD' },
  pokrivaMesta: 1, napomena: '', podrucjeTekst: 'Novi Sad', vremeTekst: 'Fleksibilno', dogovorId: null, promenjenaPotreba: false, mozePovuci: true,
  traziPaznju: false, ...patch });
/** A little of everything that is over, for the Arhiva. */
const OVER_AGREEMENTS: AgendaAgreement[] = [
  agreement('o1', { naslov: 'Prenos ormana do kombija', stanje: 'COMPLETED', vremeTekst: '20. sep · 10:00–14:00', ucesnici: people('uskocer', 'Milica') }),
  agreement('o2', { naslov: 'Košenje živice', stanje: 'CANCELLED', vremeTekst: '29. sep · 08:00–10:00', ucesnici: people('narucilac', 'Jelena') }),
];
const OVER_NEEDS: PotrebaProjekcija[] = [need('o3', { naslov: 'Montaža nadstrešnice', stanje: 'ZATVORENA' as PotrebaProjekcija['stanje'] })];

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const rule = (n: number, days: number[], startTime: string, endTime: string, patch: Partial<AvailabilityRule> = {}): AvailabilityRule =>
  ({ id: id(n), weekdays: days, startTime, endTime, startsOn: '2026-09-01', endsOn: null, label: '', active: true, ...patch });
const windowAt = (n: number, days: number, from: string, to: string, state: AvailabilityWindow['state'], label = ''): AvailabilityWindow =>
  ({ id: id(n), startsAt: at(from, days), endsAt: at(to, days), state, label });
const EMPTY: WorkerAvailabilityInput = { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] };
const WEEK: WorkerAvailabilityInput = { timezone: 'Europe/Belgrade', availableNow: true,
  rules: [rule(1, [1, 2, 3, 4, 5], '09:00:00', '17:00:00', { label: 'Radno vreme' }), rule(2, [6], '10:00:00', '14:00:00', { active: false }),
    // Friday 22:00–02:00 as the Termin sheet saves it: the night, and its part after midnight dated one day later.
    rule(3, [5], '22:00:00', '24:00:00'), rule(4, [6], '00:00:00', '02:00:00', { startsOn: '2026-09-02' })],
  windows: [windowAt(5, 3, '08:00', '20:00', 'UNAVAILABLE', 'Slava'), windowAt(6, 10, '09:00', '13:00', 'AVAILABLE'),
    windowAt(7, -20, '08:00', '12:00', 'UNAVAILABLE', 'Pregled kod lekara')] };

/** The hours a worker with an active profile has given: the shade of the days in the month and the band beside the hours of a day. */
const WORKING: AgendaAvailability = { value: WEEK, active: true };

/** Raspored drawn from fixtures. It opens on the month, as the route does, or on the view the scene asks for; a worker's hours are drawn unless the scene has no work profile. */
function Calendar({ schedule, list, phoneZone, back, view, availability = WORKING }: {
  schedule: AgendaSchedule; list: AgendaList; phoneZone?: string; back: () => void; view?: CalendarView; availability?: AgendaAvailability | null;
}) {
  const [selected, setSelected] = useState(today);
  return <AgendaScreen selected={selected} today={today} schedule={schedule} list={list} availability={availability} initialView={view} refreshing={false}
    onSelect={setSelected} onBack={back} onRefresh={noop} onRetry={noop} onRetryList={noop} onOpen={noop} onProposeTerm={noop}
    onAvailability={noop} onArchive={noop} phoneZone={phoneZone ?? 'Europe/Belgrade'} />;
}
const source = <Row,>(rows: Row[]) => ({ state: 'ready' as const, rows });
function Availability({ value, back, loading = false, error, errorAction = 'Učitaj sačuvano stanje', noProfile = false, below, ...form }: {
  value: WorkerAvailabilityInput; back: () => void; loading?: boolean; error?: string; errorAction?: string;
  /** No saved work profile: a precondition, drawn as the route draws it, not as an error. */ noProfile?: boolean;
  /** What the surrounding screen shows under the form (the profile conversation's own check). */ below?: React.ReactNode;
} & Partial<React.ComponentProps<typeof AvailabilityForm>>) {
  return <CalendarScreen title="Dostupnost za rad" back={back} loading={loading} scroll={false} footer={below}>
    {noProfile ? <View style={s.pad}><StateView kind="empty" art="clock" title="Najpre sačuvaj svoj radni profil."
      primary={{ label: 'Dopuni radni profil', onPress: noop }} /></View>
      : error ? <View style={s.pad}><StateView kind="error" art="clock" title="Dostupnost nije učitana." body={error}
      primary={{ label: errorAction, onPress: noop }} /></View>
      : <AvailabilityForm availability={value} busy={false} uncertain={false} onSave={noop} onRefresh={noop} phoneZone="Europe/Belgrade" {...form} />}
  </CalendarScreen>;
}

function Scene({ scene, back }: { scene: SceneKey; back: () => void }) {
  const ready = (events: readonly WorkerCalendarEvent[]): AgendaSchedule => ({ state: 'ready', events });
  switch (scene) {
    // The Dogovori of both sides on a day: mine to do, mine to confirm, finished, an overlap.
    case 'dan': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }} />;
    case 'prazno': return <Calendar back={back} schedule={ready([])} list={{ state: 'ready', agreements: [] }} />;
    // Dogovori in the window but none on today: the day is one quiet line, and the dots of the week say where they are.
    case 'prazanDan': return <Calendar back={back} schedule={ready([])} list={{ state: 'ready', agreements: [
      agreement('d3', { naslov: 'Pomoć pri selidbi', tacanTermin: { pocetak: at('10:00', 3), kraj: at('12:00', 3) }, ucesnici: people('narucilac', 'Stefan') }),
      agreement('d4', { naslov: 'Montaža rolo zavesa', tacanTermin: { pocetak: at('09:00', 4), kraj: at('11:00', 4) }, ucesnici: people('uskocer', 'Ana') })] }} />;
    // The section under the day: three Dogovori with no accepted start (none at all, only an end, waiting for a confirmation), the command only
    // where a term may be proposed, and above them, on the day, the one that has a start ("od 15:30").
    case 'bezTermina': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: [...AGREEMENTS.filter(item => item.id !== 'f1'), ...WITHOUT_TERM] }} />;
    // The owner's phone, 8 Oct 2026: one Dogovor without a term and nothing on the day.
    case 'vlasnik': return <Calendar back={back} schedule={ready([])} list={{ state: 'ready', agreements: [WITHOUT_TERM[0]] }} />;
    case 'arhiva': return <ArchiveScreen agreements={source(OVER_AGREEMENTS)} needs={source(OVER_NEEDS)} applications={source([application('o4', { naslov: 'Lekcije iz matematike', stanje: 'WITHDRAWN' as MojaPrijavaProjekcija['stanje'] })])}
      refreshing={false} onBack={back} onRefresh={noop} onRetry={noop} onOpen={noop} />;
    case 'arhivaPrazna': return <ArchiveScreen agreements={source([])} needs={source([])} applications={source([])} refreshing={false} onBack={back} onRefresh={noop} onRetry={noop} onOpen={noop} />;
    case 'arhivaGreska': return <ArchiveScreen agreements={{ state: 'error' }} needs={{ state: 'error' }} applications={{ state: 'error' }} refreshing={false}
      onBack={back} onRefresh={noop} onRetry={noop} onOpen={noop} />;
    case 'ucitava': return <Calendar back={back} schedule={{ state: 'loading' }} list={{ state: 'loading' }} />;
    case 'greska': return <Calendar back={back} schedule={{ state: 'error', message: null }} list={{ state: 'ready', agreements: AGREEMENTS }} />;
    case 'delimicno': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'error' }} />;
    // What a list read that does not carry the exact window shows: only my own work, and a line that says so.
    case 'bezVremena': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS.map(unsaid) }} />;
    case 'dugi': return <Calendar back={back} schedule={ready([])} list={{ state: 'ready', agreements: LONG }} />;
    case 'zona': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }} phoneZone="America/New_York" />;
    // Nine in one day, four of them at once: the dots say two and "+7", the list under the grid has them all.
    case 'mnogo': return <Calendar back={back} schedule={ready(MANY.events)} list={{ state: 'ready', agreements: MANY.agreements }} />;
    // A person with no work profile: no tint on the days and no "Moja dostupnost" under the calendar.
    case 'mesecBezProfila': return <Calendar back={back} availability={null} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }} />;
    // The week: Monday and Friday free, the others with one to three.
    case 'nedeljaDogovori': return <Calendar back={back} view="week" schedule={ready(WEEKLY.events)} list={{ state: 'ready', agreements: WEEKLY.agreements }} />;
    case 'nedeljaSlobodna': return <Calendar back={back} view="week" schedule={ready([])} list={{ state: 'ready', agreements: [] }} />;
    case 'nedeljaDugi': return <Calendar back={back} view="week" schedule={ready([])} list={{ state: 'ready', agreements: LONG }} />;
    // The day on its hours: the blocks of both sides, the worker's own hours beside the rail, and the red line where "sada" is.
    case 'danDogovori': return <Calendar back={back} view="day" schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }} />;
    case 'danPrazan': return <Calendar back={back} view="day" schedule={ready([])} list={{ state: 'ready', agreements: [] }} />;
    case 'danPreklapanje': return <Calendar back={back} view="day" schedule={ready(MANY.events)} list={{ state: 'ready', agreements: MANY.agreements }} />;
    case 'danNoc': return <Calendar back={back} view="day" schedule={ready(NIGHT.events)} list={{ state: 'ready', agreements: NIGHT.agreements }} />;
    case 'danDugi': return <Calendar back={back} view="day" schedule={ready([])} list={{ state: 'ready', agreements: LONG }} />;
    case 'nedeljaPrazna': return <Availability back={back} value={EMPTY} />;
    case 'nedelja': return <Availability back={back} value={WEEK} />;
    case 'dUcitava': return <Availability back={back} value={EMPTY} loading />;
    case 'dGreska': return <Availability back={back} value={EMPTY} error="Podaci nisu učitani. Proveri vezu i pokušaj ponovo." />;
    case 'bezProfila': return <Availability back={back} value={EMPTY} noProfile />;
    case 'cuva': return <Availability back={back} value={WEEK} busy />;
    case 'nepoznato': return <Availability back={back} value={WEEK} uncertain onReconcile={noop}
      problem="Čuvanje nije potvrđeno. Proveri sačuvano stanje pre novog pokušaja." />;
    // The reason names the conversation's own check, which the profile conversation draws under the form.
    case 'razlog': return <Availability back={back} value={WEEK} uncertain candidateMode
      below={<V2Action label="Proveri stanje razgovora" onPress={noop} />} />;
    case 'sacuvano': return <Availability back={back} value={WEEK} saved />;
    case 'dZona': return <Availability back={back} value={{ ...WEEK, timezone: 'Asia/Kathmandu' }} />;
    case 'termin': return <><Availability back={back} value={EMPTY} />
      <RuleSheet isNew timezone="Europe/Belgrade" phoneZone="Europe/Belgrade" close={back} accept={noop}
        rule={rule(9, [2], '', '', { startsOn: today })} /></>;
    case 'poseban': return <><Availability back={back} value={WEEK} />
      <WindowSheet window={null} timezone="Europe/Belgrade" phoneZone="Europe/Belgrade" close={back} accept={noop} /></>;
    case 'kopiraj': return <><Availability back={back} value={WEEK} />
      <CopySheet source={weekdays[0]} rules={WEEK.rules} close={back} apply={noop} /></>;
  }
}

export default function DizajnKalendar() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  // A known scene can be opened by its address (`?scene=dan`), to be photographed on the emulator or in the lab; arbitrary queries select nothing.
  const params = useLocalSearchParams<{ scene?: string | string[]; text?: string | string[] }>();
  const requested = SCENES.find(option => option.key === (typeof params.scene === 'string' ? params.scene : undefined))?.key ?? null;
  const textLayout = params.text === '1.3' ? LARGE_LAYOUT : params.text === '1.15' ? COMPACT_LAYOUT : null;
  const [scene, setScene] = useState<SceneKey | null>(requested);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  if (!scene) return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    {/* Opened cold by its address there is no history to go back to. */}
    <DetailTopBar title="Kalendar · galerija" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />
    <ScrollView contentContainerStyle={s.list}>
      {SCENES.map(option => <Press key={option.key} accessibilityRole="button" accessibilityLabel={option.label} haptic="select"
        onPress={() => setScene(option.key)} style={s.row}>
        <T variant="bodyStrong" style={s.grow}>{option.label}</T>
        <CaretRight size={18} color={sys.color.muted} />
      </Press>)}
    </ScrollView>
  </SafeAreaView>;
  const back = () => setScene(null);
  return <View style={s.screen}>
    {/* Each scene is mounted fresh, so its day, draft and open parts start where the scene says. */}
    <LayoutClassOverride.Provider value={textLayout}><View key={scene} style={s.grow}><Scene scene={scene} back={back} /></View></LayoutClassOverride.Provider>
    <SafeAreaView edges={['bottom']} style={s.strip}>
      <V2Action label="Nazad" accessibilityLabel="Nazad na scene" kind="quiet" onPress={back} />
    </SafeAreaView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  grow: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: sys.space.lg },
  list: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.xxl },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  strip: { paddingHorizontal: sys.space.md, borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface },
});
