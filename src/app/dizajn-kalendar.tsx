import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import type { MojaPrijavaProjekcija, NeedScheduleProjection, PotrebaProjekcija, UcesnikProjekcija } from '../contracts/projections';
import type { WorkerCalendarEvent } from '../contracts/workerCalendar';
import type { AvailabilityRule, AvailabilityWindow, WorkerAvailabilityInput } from '../contracts/workerAvailability';
import { AgendaScreen, type AgendaApplications, type AgendaList, type AgendaNeeds, type AgendaSchedule } from '../ui/calendar/AgendaScreen';
import { ArchiveScreen } from '../ui/calendar/ArchiveScreen';
import type { AgendaAgreement } from '../ui/calendar/agenda';
import { AvailabilityForm, CopySheet, RuleSheet, WindowSheet } from '../ui/calendar/AvailabilityForm';
import { CalendarScreen } from '../ui/calendar/CalendarControls';
import { civilInstant, deviceDate, shiftDate, weekdays } from '../ui/calendar/calendarPresentation';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { StateView } from '../ui/system/StateView';
import { sys } from '../ui/system/tokens';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';

/**
 * Kalendar obaveza and Dostupnost za rad in their main states, for the lead to photograph on the emulator (owner step 10,
 * 2026-09-24). Reached only by its address (uskociapp://dizajn-kalendar) in the internal build; the store package shows
 * nothing. It draws the real presentation (`AgendaScreen`, `AvailabilityForm`, its three sheets and `CalendarScreen`) with
 * fixture props: nothing here reads or writes data, no command is sent, and every press that would leave the screen or
 * save does nothing. Each scene is chosen from the list by its label; "Nazad" (the strip at the bottom, or the top bar's
 * arrow) returns to the list.
 */
type SceneKey = 'dan' | 'prazno' | 'prazanDan' | 'jednaVrsta' | 'bezTermina' | 'ucitava' | 'greska' | 'delimicno' | 'bezVremena' | 'dugi' | 'zona'
  | 'arhiva' | 'arhivaPrazna' | 'arhivaGreska'
  | 'nedeljaPrazna' | 'nedelja' | 'dUcitava' | 'dGreska' | 'bezProfila' | 'cuva' | 'nepoznato' | 'razlog' | 'sacuvano' | 'dZona'
  | 'termin' | 'poseban' | 'kopiraj';
const SCENES: { key: SceneKey; label: string }[] = [
  { key: 'dan', label: 'Kalendar · dan sa Dogovorima' }, { key: 'prazno', label: 'Kalendar · prazan dan' },
  { key: 'prazanDan', label: 'Kalendar · prazan dan, ima čipove' }, { key: 'jednaVrsta', label: 'Kalendar · samo Dogovori, bez čipova' },
  { key: 'bezTermina', label: 'Kalendar · bez tačnog termina i prijave na čekanju' },
  { key: 'arhiva', label: 'Arhiva · završeno i otkazano' }, { key: 'arhivaPrazna', label: 'Arhiva · prazna' }, { key: 'arhivaGreska', label: 'Arhiva · greška' },
  { key: 'ucitava', label: 'Kalendar · učitava' }, { key: 'greska', label: 'Kalendar · greška' },
  { key: 'delimicno', label: 'Kalendar · samo termini u kojima uskačeš' },
  { key: 'bezVremena', label: 'Kalendar · lista ne kaže tačno vreme' }, { key: 'dugi', label: 'Kalendar · dugi nazivi' },
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

const today = deviceDate(new Date());
/** An instant of today (or a day around it) at a Serbian clock. */
const at = (time: string, days = 0) => civilInstant(shiftDate(today, days), time, 'Europe/Belgrade').value ?? new Date().toISOString();
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
  agreement('f1', { naslov: 'Košenje trave', tacanTermin: null }),
];
const LONG: AgendaAgreement[] = [
  agreement('l1', { naslov: 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu zgrade',
    tacanTermin: { pocetak: at('09:00'), kraj: at('16:30') }, cena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' },
    putanjaTekst: 'Novo naselje, Bulevar Evrope, Novi Sad, blizu Ekonomske škole', ucesnici: people('narucilac', 'Aleksandra Petrović-Jovanović') }),
  agreement('l2', { naslov: 'Selidba kancelarije sa arhivom i nameštajem na drugi kraj grada', stanje: 'AWAITING_REQUESTER',
    tacanTermin: { pocetak: at('17:00'), kraj: at('23:30') }, ucesnici: people('narucilac', 'Konstantin Radosavljević') }),
];

/** My own task, published: the fields the planner and the archive read, with a fixed window or none. */
const need = (id: string, patch: Partial<PotrebaProjekcija>): PotrebaProjekcija => ({ id, revizija: 1, naslov: 'Selidba ormara', opis: '', stanje: 'OBJAVLJENA',
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, vremeTekst: 'Fleksibilan termin', podrucjeTekst: 'Detelinara, Novi Sad', uslovi: [],
  brojPrijava: 0, brojPrijavaZaIzbor: 0, schedule: { kind: 'FLEXIBLE', startsAt: null, endsAt: null }, ...patch } as PotrebaProjekcija);
const fixed = (start: string, end: string | null): NeedScheduleProjection => ({ kind: 'FIXED_WINDOW', startsAt: start, endsAt: end });
/** My own application, sent: with a task window it stands on a day, without one it waits under "Čekaju odgovor". */
const application = (id: string, patch: Partial<MojaPrijavaProjekcija>): MojaPrijavaProjekcija => ({ prijavaId: id, potrebaId: `need-${id}`, potrebaRevizija: 1,
  prijavaRevizija: 1, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: 'Košenje trave', opis: '', cena: { iznos: 1500, valuta: 'RSD', prikaz: '1.500 RSD' },
  pokrivaMesta: 1, napomena: '', podrucjeTekst: 'Novi Sad', vremeTekst: 'Fleksibilno', dogovorId: null, promenjenaPotreba: false, mozePovuci: true,
  traziPaznju: false, ...patch });
const MY_NEEDS: PotrebaProjekcija[] = [
  need('n1', { naslov: 'Selidba ormara', stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3, schedule: fixed(at('13:00'), at('15:00')) }),
];
const MY_APPLICATIONS: MojaPrijavaProjekcija[] = [
  application('p1', { naslov: 'Košenje trave u dvorištu', zadatak: { raspored: fixed(at('15:30'), at('17:30')), rezimLokacije: null, vremenskaZona: null, rezimCene: 'OFFERS',
    osnovaCene: null, potrebnoMesta: 1 } }),
];
const LOOSE_NEEDS: PotrebaProjekcija[] = [need('f1', { naslov: 'Čišćenje tavana' }), need('f2', { naslov: 'Pomoć oko računara', vremeTekst: 'Bilo kada ove nedelje' })];
const PENDING_APPLICATIONS: MojaPrijavaProjekcija[] = [application('p2', { naslov: 'Farbanje ograde' }), application('p3', { naslov: 'Pomoć pri selidbi', stanje: 'VIEWED' })];
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

function Calendar({ schedule, list, needs, applications, phoneZone, back }: { schedule: AgendaSchedule; list: AgendaList; needs?: AgendaNeeds;
  applications?: AgendaApplications; phoneZone?: string; back: () => void }) {
  const [selected, setSelected] = useState(today);
  return <AgendaScreen selected={selected} today={today} schedule={schedule} list={list} needs={needs} applications={applications} refreshing={false}
    onSelect={setSelected} onBack={back} onRefresh={noop} onRetry={noop} onRetryList={noop} onOpen={noop} onOpenTask={noop} onOpenApplication={noop}
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
    // Every kind at once: Dogovori, my own task with applications to choose from, and my application - so the chips have something to choose.
    case 'dan': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }}
      needs={{ state: 'ready', needs: MY_NEEDS }} applications={{ state: 'ready', applications: MY_APPLICATIONS }} />;
    case 'prazno': return <Calendar back={back} schedule={ready([])} list={{ state: 'ready', agreements: [] }} />;
    // Two kinds in the window but none on today: the chips are there, the day is one quiet line.
    case 'prazanDan': return <Calendar back={back} schedule={ready([])} list={{ state: 'ready', agreements: [] }}
      needs={{ state: 'ready', needs: [need('n2', { naslov: 'Pomoć pri selidbi', schedule: fixed(at('10:00', 3), at('12:00', 3)) })] }}
      applications={{ state: 'ready', applications: [application('p4', { naslov: 'Montaža rolo zavesa', zadatak: { raspored: fixed(at('09:00', 4), at('11:00', 4)),
        rezimLokacije: null, vremenskaZona: null, rezimCene: 'OFFERS', osnovaCene: null, potrebnoMesta: 1 } })] }} />;
    // Only Dogovori: there is nothing to choose between, so there is no row of chips.
    case 'jednaVrsta': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }} />;
    case 'bezTermina': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }}
      needs={{ state: 'ready', needs: LOOSE_NEEDS }} applications={{ state: 'ready', applications: PENDING_APPLICATIONS }} />;
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
    case 'dugi': return <Calendar back={back} schedule={ready([])} list={{ state: 'ready', agreements: LONG }}
      needs={{ state: 'ready', needs: [need('n3', { naslov: 'Prenos trosed i dve fotelje sa trećeg sprata bez lifta', schedule: fixed(at('18:00'), at('20:00')) })] }} />;
    case 'zona': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }} phoneZone="America/New_York" />;
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
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const requested = SCENES.find(option => option.key === (typeof params.scene === 'string' ? params.scene : undefined))?.key ?? null;
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
    <View key={scene} style={s.grow}><Scene scene={scene} back={back} /></View>
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
