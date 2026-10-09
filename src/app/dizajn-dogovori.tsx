import { useState, type ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import type { DogovorProjekcija, PorukaProjekcija, PredlogIzmeneSazetak, UcesnikProjekcija } from '../contracts/projections';
import type { AgreementCancellations } from '../data/agreementCancellationClientService';
import type { ReviewTag } from '../data/reviewsClientService';
import type { AgreementPhotosController } from '../hooks/useAgreementPhotos';
import { AgreementChat } from '../ui/AgreementChat';
import { AgreementThreadPresentation } from '../ui/v2/AgreementThreadPresentation';
import { WorkspaceFooter, agreementNextStep, agreementQuietLine, agreementStepsInfo, agreementWaitsForMe } from '../ui/agreements/AgreementWorkspace';
import { AgreementOverview } from '../ui/agreements/AgreementOverview';
import { AgreementProblemExits, AgreementProblemForm, AgreementProblemNote, AgreementStatusView, overviewContent } from '../ui/agreements/AgreementOverviewParts';
import { addressWords } from '../ui/agreements/agreementContactModel';
import { cancellationDetailsOf } from '../ui/agreements/agreementListModel';
import { Press } from '../ui/Press';
import { ProductHeader } from '../ui/product/ProductDetails';
import { FactArt } from '../ui/system/FactArt';
import { layout } from '../ui/system/layout';
import { ListRow } from '../ui/system/ListRow';
import { ChromeIconButton, ScreenChrome } from '../ui/system/ScreenChrome';
import { LARGE_LAYOUT, LayoutClassOverride, useWindowRoom } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../ui/v2/AgreementCollectionPresentation';
import { V2Action } from '../ui/v2/V2Action';
import { AgreementTabs, AgreementPersonBar, isNoTermText, type AgreementTab } from '../ui/v2/AgreementPresentation';
import { AgreementReviewPresentation, type ReviewView } from '../ui/reviews/AgreementReviewPresentation';

/**
 * The Dogovori gallery (owner step 8): the real presentation of the Dogovori list, the Dogovor's Pregled and its Poruke,
 * drawn from fixtures in their main states so the lead can photograph them on the emulator, where opening the real
 * screens writes to the server (the Poruke tab settles notifications). Reached only by its address
 * (uskociapp://dizajn-dogovori) in the internal build; the store package shows nothing. Nothing here reads or writes
 * data: no photo, inbox, group or profile read is drawn (every person has no public profile id, and the root bar's bell
 * is a still one), and every command is a no-op. Large text is the system's: set the font scale on the device. The design lab (Expo web) has
 * none, so a scene opened with `?scale=1.15` or `?scale=1.3` draws the step bar for that text size (and from 1.3 up the stacked layouts, as a phone
 * does); the words themselves are enlarged by the lab's own driver.
 */
const noop = () => {};
const later = async () => {};

const ME_REQUESTER: UcesnikProjekcija = { id: 'ja', profilId: null, ime: 'Ana Petrović', inicijali: 'AP', uloga: 'narucilac', mesta: null, viSte: true, telefon: null };
const ME_WORKER: UcesnikProjekcija = { ...ME_REQUESTER, uloga: 'uskocer', mesta: 1 };
const worker = (ime: string, inicijali: string, mesta = 1): UcesnikProjekcija =>
  ({ id: `druga-${inicijali}`, profilId: null, ime, inicijali, uloga: 'uskocer', mesta, viSte: false, telefon: null });
const requester = (ime: string, inicijali: string): UcesnikProjekcija =>
  ({ id: `druga-${inicijali}`, profilId: null, ime, inicijali, uloga: 'narucilac', mesta: null, viSte: false, telefon: null });

function agreement(id: string, patch: Partial<DogovorProjekcija> = {}): DogovorProjekcija {
  return { id, verzija: 1, naslov: 'Prenos ormana do kombija', stanje: 'CONFIRMED', cena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' },
    vremeTekst: '26. sep · 17:00–19:00', putanjaTekst: 'Liman, Novi Sad', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
    ucesnici: [ME_REQUESTER, worker('Marko Jovanović', 'MJ')], rezim: 'FIZICKI',
    kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
    chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null,
    pocinje: '2026-09-26T15:00:00Z', izmenaCeka: null, izvor: { zadatakId: `zadatak-${id}`, prijavaId: `prijava-${id}` }, ...patch };
}

const LIST: DogovorProjekcija[] = [
  agreement('zona', { vremeTekst: '26. sep · 17:00–19:00 (po vremenu u Srbiji)' }),
  agreement('potvrda', { stanje: 'AWAITING_REQUESTER', naslov: 'Montaža police u hodniku', cena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
    vremeTekst: '24. sep · 09:00–11:00', putanjaTekst: 'Grbavica, Novi Sad', pocinje: '2026-09-24T07:00:00Z',
    ucesnici: [ME_REQUESTER, worker('Stefan Ilić', 'SI')] }),
  agreement('izmena', { naslov: 'Košenje trave u dvorištu', ucesnici: [ME_WORKER, requester('Jelena Nikolić', 'JN')], vremeTekst: '28. sep · 08:00–12:00',
    putanjaTekst: 'Sremska Kamenica', izmenaCeka: { predlogId: 'predlog', mojPredlog: false }, pocinje: '2026-09-28T06:00:00Z' }),
  agreement('ocena', { stanje: 'COMPLETED', ocenaMoguca: true, naslov: 'Pomoć pri selidbi', vremeTekst: '20. sep · 10:00–14:00', chatDostupan: false,
    ucesnici: [ME_WORKER, requester('Milica Stojanović', 'MS')], pocinje: '2026-09-20T08:00:00Z' }),
  agreement('grupa', { naslov: 'Prevod uputstva na engleski', rezim: 'DALJINSKI', putanjaTekst: '', vremeTekst: 'Termin nije dogovoren', pocinje: null,
    pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 2 / 3 }, verzija: 2, izmenaCeka: { predlogId: 'moj', mojPredlog: true }, problemOtvoren: true,
    ucesnici: [ME_REQUESTER, worker('Nikola Marković', 'NM', 2)] }),
  agreement('bez-termina', { stanje: 'COMPLETED', vremeTekst: 'Termin nije dogovoren', chatDostupan: false, naslov: 'Čišćenje podruma' }),
  agreement('otkazan', { stanje: 'CANCELLED', cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, chatDostupan: false, naslov: 'Farbanje ograde',
    ucesnici: [ME_WORKER, requester('Druga strana', '')] }),
  agreement('otkazan-ti', { stanje: 'CANCELLED', chatDostupan: false, naslov: 'Montaža rolo zavesa', vremeTekst: '30. sep · 09:00–11:00',
    putanjaTekst: 'Telep, Novi Sad', pocinje: '2026-09-30T07:00:00Z' }),
  agreement('otkazan-drugi', { stanje: 'CANCELLED', chatDostupan: false, naslov: 'Košenje živice', vremeTekst: '29. sep · 08:00–10:00',
    putanjaTekst: 'Detelinara, Novi Sad', pocinje: '2026-09-29T06:00:00Z', ucesnici: [ME_WORKER, requester('Jelena Nikolić', 'JN')] }),
];
/** Four selected people share a task, never bilateral terms. All ids and facts here are inert fixtures. */
const GROUPED_NOW = new Date('2026-09-24T09:00:00Z');
const groupedAgreement = (id: string, name: string, initials: string, amount: number, display: string, patch: Partial<DogovorProjekcija> = {}) =>
  agreement(id, { naslov: 'Pomoć pri preseljenju kancelarije', ucesnici: [ME_REQUESTER, worker(name, initials)],
    cena: { iznos: amount, valuta: 'RSD', prikaz: display }, pokrivenost: { ukupno: 4, popunjeno: 1, preostalo: 3, udeo: 0.25 },
    izvor: { zadatakId: 'galerija-zajednicki-zadatak', prijavaId: `prijava-${id}` }, ...patch });
const GROUPED: DogovorProjekcija[] = [
  groupedAgreement('tim-marko', 'Marko Jovanović', 'MJ', 5500, '5.500 RSD', { izmenaCeka: { predlogId: 'lokalni-moj', mojPredlog: true } }),
  groupedAgreement('tim-stefan', 'Stefan Ilić', 'SI', 3200, '3.200 RSD', { stanje: 'AWAITING_REQUESTER' }),
  groupedAgreement('tim-aleksandra', 'Aleksandra Konstantinović-Radovanović', 'AK', 125000, '125.000 RSD',
    { izmenaCeka: { predlogId: 'lokalni-drugi', mojPredlog: false } }),
  groupedAgreement('tim-iva', 'Iva Petrović', 'IP', 4500, '4.500 RSD', { stanje: 'COMPLETED', chatDostupan: false }),
];

/** An agreed Dogovor with no term at all (R02), one with a problem reported (R04), and one where the other side's number was shared ("Pozovi"). */
const NO_TERM_AGREEMENT = agreement('bez-termina-aktivan', { naslov: 'Pomoć oko računara', vremeTekst: 'Termin nije dogovoren', pocinje: null, putanjaTekst: 'Podbara, Novi Sad' });
/**
 * The Dogovor of the owner's phone picture of 2026-10-08 (12:57): the one who does the work, the work agreed, no term yet, and the server allows
 * marking it done - "Zadatak je gotov" is the one green action. The name of the other person is the one on that picture.
 */
const WORKER_DONE = agreement('uskacem', { naslov: 'Krečenje stana od 80 m² u belo', vremeTekst: 'Termin nije dogovoren', pocinje: null, putanjaTekst: 'Novi Sad',
  ucesnici: [ME_WORKER, requester('msljivic031', 'MS')], cena: { iznos: 62000, valuta: 'RSD', prikaz: '62.000 RSD' } });
/** The same work with its term agreed: the one who does it may mark it done and the page has no note about a missing term. */
const WORKER_TERM: DogovorProjekcija = { ...WORKER_DONE, id: 'uskacem-termin', vremeTekst: '9. okt · 17:00–19:00', pocinje: '2026-10-09T15:00:00Z' };
const PROBLEM_AGREEMENT = agreement('problem', { naslov: 'Montaža nadstrešnice', problemOtvoren: true, vremeTekst: '25. sep · 08:00–12:00', putanjaTekst: 'Veternik, Novi Sad' });
const SHARED_AGREEMENT = agreement('podeljen', { naslov: 'Pomoć pri preseljenju kancelarije',
  kontakt: { mojTelefonPodeljen: true, njihovTelefon: '064 123 4567', lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true } });
/** What `rpc_agreement_cancellation_v1` answers for the two cancelled ones of the list (CANCEL-INFO): the other side's words, and mine with no reason kept. */
const CANCELLATIONS: AgreementCancellations = new Map([
  ['otkazan', { agreementId: 'otkazan', cancelledAt: '2026-09-25T16:40:00Z', by: 'REQUESTER', byMe: false, reason: 'Ujutru je kiša, pomeramo za sledeću nedelju.', reasonState: 'KEPT' }],
  ['otkazan-ti', { agreementId: 'otkazan-ti', cancelledAt: '2026-09-28T08:05:00Z', by: 'REQUESTER', byMe: true, reason: null, reasonState: 'NOT_KEPT' }],
  ['otkazan-drugi', { agreementId: 'otkazan-drugi', cancelledAt: '2026-09-28T17:20:00Z', by: 'REQUESTER', byMe: false, reason: 'Živicu je u međuvremenu orezao komšija.', reasonState: 'KEPT' }],
]);
const LONG: DogovorProjekcija[] = [
  agreement('dugo', { naslov: 'Prenos trosed i dve fotelje sa trećeg sprata zgrade bez lifta do kombija ispred ulaza',
    vremeTekst: '26. sep · 22:00 – 27. sep · 06:00 (po vremenu u Srbiji)', putanjaTekst: 'Petrovaradinska tvrđava, Petrovaradin, Novi Sad',
    cena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' },
    ucesnici: [ME_REQUESTER, worker('Aleksandra Konstantinović-Radovanović', 'AK', 4)], pokrivenost: { ukupno: 4, popunjeno: 4, preostalo: 0, udeo: 1 } }),
  agreement('dugo-ocena', { stanje: 'COMPLETED', ocenaMoguca: true, chatDostupan: false,
    naslov: 'Sklapanje garderobera od tri krila sa kliznim vratima i ogledalom u spavaćoj sobi',
    ucesnici: [ME_WORKER, requester('Vladimir Aleksandrović Petrović', 'VA')] }),
];

/**
 * The change proposals the route reads with a Dogovor's actions (`radnje.predlogIzmene`), for the two fixtures whose
 * change waits: the other side's proposal to the worker (answered from the footer) and the requester's own in the group.
 */
const PROPOSALS: Record<string, Pick<PredlogIzmeneSazetak, 'mozeOdgovoriti' | 'razlog' | 'izmene'>> = {
  izmena: { mozeOdgovoriti: true, razlog: 'Ujutru je trava još mokra od rose.',
    izmene: [{ polje: 'Termin', sada: '28. sep · 08:00–12:00', predlog: '28. sep · 10:00–14:00' }] },
  grupa: { mozeOdgovoriti: false, razlog: 'Uputstvo ima više strana nego što je navedeno.',
    izmene: [{ polje: 'Cena', sada: '5.500 RSD', predlog: '6.500 RSD' }] },
};

const OTHER = 'druga-MJ';
const message = (n: number, moja: boolean, telo: string, vremeTekst: string): PorukaProjekcija => ({ id: `poruka-${n}`, dogovorVerzija: 1,
  clientMessageId: null, posiljalacAccountId: moja ? 'ja' : OTHER, posiljalacIme: moja ? 'Ja' : 'Marko Jovanović', moja, telo, vremeTekst, procitano: null });
const MESSAGES: PorukaProjekcija[] = [
  message(1, false, 'Zdravo! Da li je orman već rasklopljen?', '23. sep · 18:10'),
  message(2, true, 'Jeste, u dva dela je. Treba samo da se snese do kombija.', '23. sep · 18:12'),
  message(3, true, 'Zgrada nema lift, treći sprat.', '23. sep · 18:12'),
  message(4, false, 'Nema problema, dolazim sa još jednom osobom. Ponesite samo ključ od podruma ako tamo stoje delovi, da ne tražimo portira u sedam ujutru.', '09:05'),
  message(5, false, 'Stižem oko 17:00.', '09:06'),
];
type ChatProps = ComponentProps<typeof AgreementChat>;
const PENDING: ChatProps['state']['entries'] = [
  { command: { accountId: 'ja', agreementId: 'zona', clientMessageId: 'galerija-salje', body: 'Super, vidimo se.' }, state: 'sending', persisted: true, attempt: 1 },
  // A message the phone could not keep is a real failure (the outbox settles a lost connection as "unknown", never as "failed"): red, with its reason.
  { command: { accountId: 'ja', agreementId: 'zona', clientMessageId: 'galerija-greska', body: 'Parking je iza zgrade.' }, state: 'failed',
    error: 'STORAGE_UNAVAILABLE', persisted: false, attempt: 1 },
];
/** A send whose outcome is not known (a lost connection): the mark says "Ne znamo da li je stigla" and the one button is "Proveri" (the refused one above keeps "Pošalji ponovo"). */
const UNKNOWN: ChatProps['state']['entries'] = [
  { command: { accountId: 'ja', agreementId: 'zona', clientMessageId: 'galerija-nepoznato', body: 'Parking je iza zgrade.' }, state: 'unknown',
    error: 'UNAVAILABLE', persisted: true, attempt: 2 },
];
/** A photo tool that can do nothing: the gallery shows the "+" and its panel, never a picker or an upload. */
const PHOTOS = { agreementId: 'zona', loaded: true, busy: false, ready: false, hasSelection: false, available: false, items: [], saved: [],
  message: null, versionConflict: false, canSubmit: () => false, capture: () => null, refresh: later, pick: later, retry: later, remove: later,
  restore: later, reserved: () => false, canRetry: () => false } as unknown as AgreementPhotosController;
/** No asset/receipt exists, so this pending-media fixture cannot initiate an authorized-photo read. */
const PENDING_PHOTOS: AgreementPhotosController = { ...PHOTOS, hasSelection: true, canRetry: () => true,
  items: [{ ref: { agreementId: 'zona', agreementVersion: 1, clientRequestId: 'galerija-fotografija' }, receipt: null }],
  message: 'Ne znamo da li je fotografija poslata. Osveži fotografije pre novog izbora.' };

type SceneKey = 'list' | 'grouped-list' | 'history' | 'long' | 'empty' | 'loading' | 'error' | 'one' | 'group' | 'done' | 'waiting' | 'worker' | 'worker-done' | 'worker-term' | 'recovery'
  | 'no-term' | 'problem' | 'form' | 'shared' | 'no-number' | 'cancelled' | 'cancelled-me' | 'long-detail'
  | 'status-loading' | 'status-error' | 'status-unavailable' | 'review' | 'review-grey' | 'review-saved' | 'review-loading' | 'review-error'
  | 'chat' | 'chat-waiting' | 'chat-empty' | 'chat-loading' | 'chat-error' | 'chat-closed' | 'chat-media' | 'chat-unknown';
const SCENES: { key: SceneKey; label: string }[] = [
  { key: 'list', label: 'Lista' }, { key: 'grouped-list', label: 'Jedan zadatak · više ljudi' }, { key: 'history', label: 'Istorija' }, { key: 'long', label: 'Dugačka imena' }, { key: 'empty', label: 'Prazno' },
  { key: 'loading', label: 'Učitavanje' }, { key: 'error', label: 'Greška' }, { key: 'one', label: 'Pregled 1:1' }, { key: 'worker', label: 'Pregled · uskačem' },
  { key: 'worker-done', label: 'Pregled · uskačem, može da završi' }, { key: 'worker-term', label: 'Pregled · uskačem, termin dogovoren' },
  { key: 'group', label: 'Pregled · grupa' }, { key: 'waiting', label: 'Pregled · čeka potvrdu' }, { key: 'recovery', label: 'Pregled · provera ishoda' }, { key: 'done', label: 'Pregled · završen' },
  { key: 'no-term', label: 'Pregled · bez termina' }, { key: 'problem', label: 'Pregled · problem prijavljen' }, { key: 'form', label: 'Pregled · prijava problema' },
  { key: 'shared', label: 'Pregled · broj podeljen' }, { key: 'no-number', label: 'Pregled · nalog bez broja' }, { key: 'cancelled', label: 'Pregled · otkazan' },
  { key: 'cancelled-me', label: 'Pregled · otkazao si' }, { key: 'long-detail', label: 'Pregled · dugačka imena' },
  { key: 'status-loading', label: 'Dogovor · učitavanje' }, { key: 'status-error', label: 'Dogovor · greška' }, { key: 'status-unavailable', label: 'Dogovor · nedostupan' },
  { key: 'review', label: 'Ocena' }, { key: 'review-grey', label: 'Ocena · bez izabrane ocene' }, { key: 'review-saved', label: 'Ocena · sačuvana' },
  { key: 'review-loading', label: 'Ocena · učitavanje' }, { key: 'review-error', label: 'Ocena · greška' },
  { key: 'chat', label: 'Poruke' }, { key: 'chat-waiting', label: 'Poruke · čeka te' }, { key: 'chat-empty', label: 'Poruke · prazne' }, { key: 'chat-loading', label: 'Poruke · učitavanje' },
  { key: 'chat-error', label: 'Poruke · greška' }, { key: 'chat-closed', label: 'Poruke · zatvoren' },
  { key: 'chat-media', label: 'Poruke · fotografija na čekanju' }, { key: 'chat-unknown', label: 'Poruke · ne znamo da li je stigla' },
];

/** The root bar as the Dogovori tab draws it, with a bell that reads nothing. */
const STILL_HEADER = <ScreenChrome variant="root" title="Dogovori" onProfile={noop}
  bell={<ChromeIconButton label="Obaveštenja" icon={Bell} tone="green" onPress={noop} />} />;

function ListScene({ items, loading = false, error = false, initial = 'active', cancellations, now }: { items: DogovorProjekcija[]; loading?: boolean; error?: boolean;
  initial?: AgreementCollectionSection; cancellations?: AgreementCancellations; now?: Date }) {
  const [section, setSection] = useState<AgreementCollectionSection>(initial);
  const [only, setOnly] = useState(false);
  return <AgreementCollectionPresentation items={items} now={now} loading={loading} error={error} section={section} confirmationOnly={only}
    onSection={setSection} onConfirmationOnly={setOnly} onRefresh={noop} onOpen={noop} onRate={noop} onCalendar={noop} onProfile={noop}
    onHome={noop} onTasks={noop} onPublish={noop} header={STILL_HEADER} cancellations={cancellations} />;
}

function Chat({ messages = MESSAGES, entries = PENDING, loading = false, error = false, terminal = false, photos = PHOTOS, thread }: {
  messages?: PorukaProjekcija[]; entries?: ChatProps['state']['entries']; loading?: boolean; error?: boolean; terminal?: boolean;
  photos?: AgreementPhotosController;
  thread: Omit<ComponentProps<typeof AgreementThreadPresentation>, 'chat'>;
}) {
  const [draft, setDraft] = useState('');
  const outbox = { setDraft, sendDraft: later, retry: later, start: later, reconcile: later } as unknown as ChatProps['outbox'];
  return <AgreementThreadPresentation {...thread} chat={{ messages, loading, error, writable: !terminal, terminal, refresh: later,
    refreshWorkspace: later, outbox, state: { phase: 'ready', draft, capturing: false, entries, error: null }, photos }} />;
}

/** The private location of the place section in its unshared state, as `AgreementPrivateLocation` draws it; the gallery reads no grant. */
function StillLocation({ requester }: { requester: boolean }) {
  const words = addressWords({ requester, granted: false });
  return <View style={s.location}>
    <View><ListRow leading={<FactArt kind="lock" size={32} muted />} title={words.title} last /></View>
    {requester ? <V2Action label="Podeli lokaciju" onPress={noop} /> : words.ask ? <V2Action label="Zatraži adresu" onPress={noop} /> : null}
    <V2Action label="Osveži dozvolu za lokaciju" kind="quiet" style={s.quietStart} onPress={noop} />
  </View>;
}

/** The Dogovor as its route composes it: the person's bar, the tabs, the Pregled (`AgreementOverview`, the same component) and its footer, or the Poruke. */
function DogovorScene({ item, me, ownRating = 'NOT_APPLICABLE', brand, initialTab = 'pregled', chat, recovery = false, formOpen = false, accountHasNumber = true, scale }: {
  item: DogovorProjekcija; me: UcesnikProjekcija; ownRating?: 'DUE' | 'GIVEN' | 'CLOSED' | 'UNKNOWN' | 'NOT_APPLICABLE'; brand: string;
  initialTab?: AgreementTab; chat?: Omit<ComponentProps<typeof Chat>, 'thread'>; recovery?: boolean;
  /** The form that reports a problem is open (the row "Prijavi problem" was pressed). */
  formOpen?: boolean;
  /** The signed-in account has a number to share (R01a). */
  accountHasNumber?: boolean;
  /** The text size the scene stands for (the lab has none): the step bar is drawn for it, and from 1.3 the layouts stack as on a phone. */
  scale?: number;
}) {
  const room = useWindowRoom();
  const [tab, setTab] = useState<AgreementTab>(initialTab);
  const [opened, setOpened] = useState(formOpen), [text, setText] = useState('');
  const other = item.ucesnici.find(person => !person.viSte);
  const isWorker = me.uloga === 'uskocer', isRequester = me.uloga === 'narucilac';
  const active = item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER';
  // The scenes compose what the route composes (round 4 review rd item 3: photos of a scene the real screen never draws
  // would be false evidence). A change that waits is the step card's subject, and one from the other side is answered by
  // the footer's one action, as `dogovor/[id].tsx` decides; the requester has no change row once the worker said done.
  const change = { waits: active && !!item.izmenaCeka, mine: active && item.izmenaCeka ? item.izmenaCeka.mojPredlog : null };
  const footer = change.waits && change.mine === false ? 'Odgovori na predlog' : brand;
  const canChange = active && !(isRequester && item.stanje === 'AWAITING_REQUESTER');
  const step = agreementNextStep({ state: item.stanje, party: true, worker: isWorker, change, ownRating,
    problemOpen: item.problemOtvoren, deadline: 'Do 27. sep · 17:00' });
  const proposal = change.waits ? PROPOSALS[item.id] ?? null : null;
  // What waits for me, at the head of Poruke, as the route says it.
  const waiting = agreementWaitsForMe({ state: item.stanje, requester: isRequester, change, ownRating });
  // The problem: the note about one that was reported and the three ways on, or the form that reports one.
  const note = item.problemOtvoren
    ? <AgreementProblemNote mine={false} openedAt="2026-09-25T16:40:00Z" narrative="Deo teksta nije bio u dogovorenom obimu." active={active} /> : null;
  const exits = note && active ? <AgreementProblemExits disabled={recovery} onMessages={() => setTab('poruke')} onCancel={canChange ? noop : undefined} onNoShow={noop} /> : null;
  const form = !note && active && opened
    ? <AgreementProblemForm value={text} onChange={setText} editable kept={false} busy={false} canSend={!!text.trim()} onSend={noop} onCancel={() => setOpened(false)} /> : null;
  const needsTerm = item.stanje === 'CONFIRMED' && isNoTermText(item.vremeTekst) && canChange && !change.waits && !item.problemOtvoren;
  const cancelled = item.stanje === 'CANCELLED' ? cancellationDetailsOf(CANCELLATIONS.get(item.id), other?.ime) : null;
  const body = <KeyboardAvoidingView style={s.fill} enabled={tab === 'poruke' || opened} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    {tab === 'poruke' ? <Chat {...chat} terminal={chat?.terminal ?? !item.chatDostupan}
      thread={{ agreement: item, person: other, waiting, onOverview: () => setTab('pregled') }} /> : <>
      {other ? <AgreementPersonBar person={other} back={noop} /> : <ProductHeader back={noop} title="Dogovor" />}
      <View style={s.tabs}><AgreementTabs tab={tab} onChange={setTab} /></View>
      <ScrollView contentContainerStyle={overviewContent}>
        <AgreementOverview agreement={item} step={step} info={active ? agreementStepsInfo({ worker: isWorker }) : null} party enabled={!recovery} accountHasNumber={accountHasNumber}
          steps={{ state: item.stanje, ownRating, cancellation: cancelled, room: scale ? { width: room.width, scale } : undefined }}
          // The proposal's lines stand inside the step card, as the route draws them (verify r4b rd item 3): what changes
          // and why, and for one's own proposal the quiet way to look at it (the other side's is answered from the footer).
          headExtra={proposal ? <View style={s.stack}>
            {proposal.izmene.map(line => <View key={line.polje} style={s.change}>
              <T variant="note" tone="muted">{line.polje}</T>
              <T variant="body" style={s.ink}>{line.sada}</T>
              <T variant="bodyStrong" style={s.ink}>{`→ ${line.predlog}`}</T>
            </View>)}
            {proposal.razlog ? <T variant="note" tone="muted">Razlog: {proposal.razlog}</T> : null}
            {proposal.mozeOdgovoriti ? null : <V2Action label="Pogledaj predlog" kind="quiet" onPress={noop} />}
          </View> : null}
          problem={{ note, exits, form }}
          // The route's GroupConversationEntry reads the group; still here, in the words it says (`ui/groups/GroupConversationEntry`) when
          // the task has fewer than two people chosen, which is true of the group fixture (one worker for two places).
          group={item.pokrivenost.ukupno > 1 ? <T variant="meta" tone="muted">Grupni razgovor se otvara kad su za ovaj zadatak izabrane najmanje dve osobe.</T> : null}
          location={<StillLocation requester={isRequester} />}
          on={{
            proposeTerm: needsTerm ? noop : undefined,
            togglePhone: noop, openMessages: () => setTab('poruke'), requestAddress: () => setTab('poruke'),
            openTask: item.izvor?.zadatakId ? noop : undefined, openApplication: isWorker && item.izvor?.prijavaId ? noop : undefined,
            openChange: canChange ? noop : undefined, openCancel: canChange ? noop : undefined,
            openProblem: active && !note && !opened ? () => setOpened(true) : undefined, openSafety: other ? noop : undefined,
          }} />
      </ScrollView>
      <WorkspaceFooter brand={footer ? { label: footer, disabled: recovery, onPress: noop } : null}
        quiet={footer ? null : agreementQuietLine({ state: item.stanje, party: true, worker: isWorker, otherName: other?.ime, change, permissionsKnown: true })}
        notice={recovery ? { message: 'Ne znamo da li je prethodna radnja uspela. Osveži Dogovor pa pokušaj ponovo.', refresh: noop, refreshing: false } : null} />
    </>}
  </KeyboardAvoidingView>;
  return scale && scale >= 1.3 ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{body}</LayoutClassOverride.Provider> : body;
}

const REVIEW_CATALOG = { maxTags: 3, tags: ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'] as ReviewTag[] };
/** The rating screen, drawn from its state (`AgreementReviewPresentation`): the stars and the tags answer, nothing is saved. */
function ReviewScene({ mode }: { mode: 'eligible' | 'grey' | 'saved' | 'loading' | 'error' }) {
  const [rating, setRating] = useState(mode === 'grey' ? 0 : 4);
  const [tags, setTags] = useState<ReviewTag[]>(mode === 'grey' ? [] : ['ON_TIME']);
  const view: ReviewView = mode === 'loading' ? { kind: 'loading' }
    : mode === 'error' ? { kind: 'error', message: 'Ocenu trenutno nije moguće učitati. Proveri vezu.' }
      : mode === 'saved' ? { kind: 'saved', rating: 4, tags: ['ON_TIME', 'RELIABLE'], fresh: false }
        : { kind: 'eligible', catalog: REVIEW_CATALOG, rating, tags, editable: true, attempt: false, onRate: setRating,
          onToggleTag: tag => setTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag]),
          save: { label: 'Sačuvaj ocenu', loading: false, disabled: rating === 0, reason: rating === 0 ? 'Izaberi ocenu.' : null, onPress: noop } };
  return <AgreementReviewPresentation backLabel="Nazad na Dogovor" onBack={noop} view={view} retry={{ label: 'Ponovo učitaj ocenu', disabled: false, onPress: noop }}
    notice={null} person={{ name: 'Marko Jovanović', initials: 'MJ', profileId: null, role: 'Uskače na tvoj zadatak', task: 'Prenos ormana do kombija' }} />;
}

function Scene({ scene, scale }: { scene: SceneKey; scale?: number }) {
  switch (scene) {
    case 'list': return <ListScene items={LIST} />;
    case 'grouped-list': return <ListScene items={GROUPED} now={GROUPED_NOW} />;
    case 'history': return <ListScene items={LIST} initial="history" cancellations={CANCELLATIONS} />;
    case 'long': return <ListScene items={LONG} />;
    case 'empty': return <ListScene items={[]} />;
    case 'loading': return <ListScene items={LIST} loading />;
    case 'error': return <ListScene items={LIST} error />;
    case 'one': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="" scale={scale} />;
    case 'worker': return <DogovorScene item={LIST[2]} me={ME_WORKER} brand="" scale={scale} />;
    case 'worker-done': return <DogovorScene item={WORKER_DONE} me={ME_WORKER} brand="Zadatak je gotov" scale={scale} />;
    case 'worker-term': return <DogovorScene item={WORKER_TERM} me={ME_WORKER} brand="Zadatak je gotov" scale={scale} />;
    case 'group': return <DogovorScene item={LIST[4]} me={ME_REQUESTER} brand="" scale={scale} />;
    case 'waiting': return <DogovorScene item={LIST[1]} me={ME_REQUESTER} brand="Potvrdi završetak" scale={scale} />;
    case 'recovery': return <DogovorScene item={LIST[1]} me={ME_REQUESTER} brand="Potvrdi završetak" recovery scale={scale} />;
    case 'done': return <DogovorScene item={LIST[5]} me={ME_REQUESTER} ownRating="DUE" brand="Oceni saradnju" scale={scale} />;
    case 'no-term': return <DogovorScene item={NO_TERM_AGREEMENT} me={ME_REQUESTER} brand="" scale={scale} />;
    case 'problem': return <DogovorScene item={PROBLEM_AGREEMENT} me={ME_REQUESTER} brand="" scale={scale} />;
    case 'form': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="" formOpen scale={scale} />;
    case 'shared': return <DogovorScene item={SHARED_AGREEMENT} me={ME_REQUESTER} brand="" scale={scale} />;
    case 'no-number': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="" accountHasNumber={false} scale={scale} />;
    case 'cancelled': return <DogovorScene item={LIST[8]} me={ME_WORKER} brand="" scale={scale} />;
    case 'cancelled-me': return <DogovorScene item={LIST[7]} me={ME_REQUESTER} brand="" scale={scale} />;
    case 'long-detail': return <DogovorScene item={LONG[0]} me={ME_REQUESTER} brand="" scale={scale} />;
    case 'status-loading': return <AgreementStatusView loading back={noop} />;
    case 'status-error': return <AgreementStatusView error retry={noop} back={noop} />;
    case 'status-unavailable': return <AgreementStatusView back={noop} />;
    case 'review': return <ReviewScene mode="eligible" />;
    case 'review-grey': return <ReviewScene mode="grey" />;
    case 'review-saved': return <ReviewScene mode="saved" />;
    case 'review-loading': return <ReviewScene mode="loading" />;
    case 'review-error': return <ReviewScene mode="error" />;
    case 'chat': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" />;
    case 'chat-waiting': return <DogovorScene item={LIST[1]} me={ME_REQUESTER} brand="Potvrdi završetak" initialTab="poruke" />;
    case 'chat-empty': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" chat={{ messages: [], entries: [] }} />;
    case 'chat-loading': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" chat={{ messages: [], entries: [], loading: true }} />;
    case 'chat-error': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" chat={{ error: true, entries: [] }} />;
    case 'chat-media': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" chat={{ photos: PENDING_PHOTOS }} />;
    case 'chat-unknown': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" chat={{ entries: UNKNOWN }} />;
    case 'chat-closed': return <DogovorScene item={LIST[5]} me={ME_REQUESTER} ownRating="DUE" brand="Oceni saradnju" initialTab="poruke" chat={{ entries: [] }} />;
  }
}

export default function DizajnDogovori() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[]; scale?: string | string[] }>();
  const requested = typeof params.scene === 'string' ? params.scene : undefined;
  const direct = SCENES.find(option => option.key === requested)?.key;
  // The two text sizes the owner's phone and a larger one stand for; any other value is ignored.
  const asked = typeof params.scale === 'string' ? Number(params.scale) : NaN;
  const scale = asked === 1.15 || asked === 1.3 ? asked : undefined;
  const [scene, setScene] = useState<SceneKey>('list');
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  // A known scene can occupy the real route's viewport for keyboard and large-text checks.
  // This remains the same inert internal fixture; arbitrary queries cannot select data or bypass the store guard.
  if (direct) return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    {/* No extra View: KeyboardAvoidingView must share the real route's SafeArea coordinate origin. */}
    <Scene key={direct} scene={direct} scale={scale} />
  </SafeAreaView>;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ScreenChrome variant="detail" title="Dogovori · galerija" onBack={() => router.back()} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.picker} contentContainerStyle={s.pickerRow}>
      {SCENES.map(option => <Press key={option.key} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected: option.key === scene }}
        haptic="select" onPress={() => setScene(option.key)} style={[s.chip, option.key === scene && s.chipOn]}>
        <T variant="meta" style={[s.chipText, option.key === scene && s.chipTextOn]}>{option.label}</T>
      </Press>)}
    </ScrollView>
    {/* Each scene is mounted fresh, so its tabs and draft start where the scene says. */}
    <View key={scene} style={s.fill}><Scene scene={scene} /></View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  fill: { flex: 1 },
  picker: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  pickerRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line },
  chipOn: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  chipText: { color: sys.color.ink, fontWeight: '600' }, chipTextOn: { color: sys.color.green },
  tabs: { paddingHorizontal: layout.gutter, paddingBottom: sys.space.md },
  // The route's own proposal lines (`dogovor/[id].tsx`: stack, change).
  stack: { gap: sys.space.sm, marginTop: sys.space.xs }, change: { gap: sys.space.xs }, ink: { color: sys.color.ink },
  // The private location in its unshared state (`AgreementPrivateLocation`: stack).
  location: { paddingTop: sys.space.sm, gap: sys.space.md }, quietStart: { alignSelf: 'flex-start', marginLeft: -sys.space.base },
});
