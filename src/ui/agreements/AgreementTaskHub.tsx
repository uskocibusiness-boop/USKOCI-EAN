import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { T } from '../Text';
import { Press } from '../Press';
import { Surface } from '../system/Surface';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { FACT_ROW_ART, FactRow } from '../system/FactRow';
import { Glyph } from '../system/Glyph';
import { Avatar, type AvatarSize } from '../system/Avatar';
import { StateView } from '../system/StateView';
import { ChromeIconButton } from '../system/ScreenChrome';
import { ActionSheet, type SheetAction } from '../system/ActionSheet';
import { PublicProfileSheet, type PublicProfileState } from '../system/PublicProfileSheet';
import { sys } from '../system/tokens';
import { layout } from '../system/layout';
import { ProfilePhoto } from '../media/ContextPhotos';
import { LocationMapPreview } from '../location/LocationMapPreview';
import { AgreementPrivateLocation } from '../AgreementPrivateLocation';
import { GroupConversationScreen } from '../groups/GroupConversationScreen';
import { ratingWords } from '../v2/TaskFace';
import { applicationPriceBasisText } from '../../lib/novac';
import { needScheduleText } from '../../data/needDetailPresentation';
import { V2Action } from '../v2/V2Action';
import { isNoTermText } from '../v2/AgreementPresentation';
import type { DogovorProjekcija, JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { ownAgreementView, type OwnAgreementGroup } from '../../data/ownAgreementGroupsPage';
import { declineApplication } from '../../data/applicationDeclineClientService';
import { publicProfileClientService } from '../../data/publicProfileClientService';
import { noviZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { agreementAttention, agreementChip, awaitsMyConfirmation, awaitsMyRating } from './agreementListModel';
import { AgreementStatusChip } from './AgreementStatusChip';
import { ApplicationSwipeCard } from './ApplicationSwipeCard';
import { TaskTopBar, type TaskTab } from './TaskTabs';
import { MyPeriodSheet, periodLine } from './MyPeriodSheet';
import { readMyAgreementPeriods, type AgreementPeriod } from '../../data/agreementPeriodClientService';
import { TaskDecisionTitle } from '../v2/detail/TaskDecision';
import { agreementTaskSummary, isLiveAgreement, isOpenAgreement, type AgreementTaskPerson } from './agreementTaskModel';

type Role = 'narucilac' | 'uskocer';
type Pane = 'overview' | 'agreed' | 'applications' | 'messages' | 'group' | 'edit';
type Loaded = { items: DogovorProjekcija[] } | { error: true } | null;
type Apps = { items: KandidatProjekcija[] } | { error: true } | null;
/** Applications the owner can still decide on; declined, withdrawn, closed and selected ones are not drawn. */
const OPEN_APPLICATION = new Set(['SELECTABLE', 'STALE', 'OVERFILL']);
const MIXED = 'Različite cene po osobi';

/** All my Dogovori of one task, in both sections. The list searches by title; only this exact task and role is kept. */
async function readTaskAgreements(source: ReturnType<typeof useIzvor>, needId: string, role: Role, title: string): Promise<DogovorProjekcija[] | null> {
  const found: DogovorProjekcija[] = [];
  for (const section of ['active', 'history'] as const) {
    const view = ownAgreementView({ section, role, outcome: 'all', confirmationOnly: false, query: title });
    const page = await source.mojiDogovoriStrana({ view, limit: 20, cursor: null });
    for (const group of page.items as OwnAgreementGroup[]) {
      if (group.needId === needId && group.role === role) for (const item of group.items) if (!found.some(x => x.id === item.id)) found.push(item);
    }
  }
  return found;
}

function Face({ person, size }: { person: { profileId: string | null; initials: string }; size: AvatarSize }) {
  const letters = <Avatar initials={person.initials} size={size} edge />;
  return person.profileId ? <ProfilePhoto profileId={person.profileId} size={size} fallback={letters} /> : letters;
}

/** An agreed person (🤝): avatar on the left with the name under it; rating, price, place and date; remove and a private message. */
function PersonCard({ person, owner, remote, place, now, rating, onProfile, onOpen, onMessage, onMore, onComplete, onRate, onChanges, onProposeTerm, facts = true, period, onPeriod }: {
  person: AgreementTaskPerson; owner: boolean; remote: boolean; place: string; now: Date; rating: string | null;
  /** My own marked time for this Dogovor (owner, 25.11.2026): private, it fills my schedule. */ period?: AgreementPeriod | null; onPeriod?: () => void;
  /** The price, place and term; a worker's Pregled already says them above the task owner's row. */ facts?: boolean;
  onProfile: () => void; onOpen: () => void; onMessage: () => void; onMore?: () => void; onComplete: () => void; onRate: () => void;
  onChanges: () => void; onProposeTerm: () => void;
}) {
  const item = person.agreement, attention = agreementAttention(item);
  // Completion is per person (owner, 22.11.2026). The server's allowed actions decide when they are known; the state is
  // only a fallback for a list row without them. The button opens the existing completion review of that Dogovor.
  const canConfirm = owner && (item.radnje ? item.radnje.mozePotvrditiZavrsetak && item.stanje === 'AWAITING_REQUESTER' : awaitsMyConfirmation(item));
  const canReport = !owner && (item.radnje ? item.radnje.mozeOznacitiZavrsetak : item.stanje === 'CONFIRMED' && !item.izmenaCeka);
  const autoConfirm = canConfirm && item.rokPotvrdeIso
    ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: item.rokPotvrdeIso }, 'Europe/Belgrade') : null;
  const amount = item.cena.prikaz;
  // Every step of this Dogovor is on its card (owner's concept, 21.11.2026): answering a change, proposing a missing term,
  // completion and the rating; one action at a time, and the words of a step that has its own button are not said twice.
  const answersChange = attention?.kind === 'change';
  const waitsOnOther = !!item.izmenaCeka?.mojPredlog;
  // Owner, 25.11.2026: no term is proposed between the parties any more; the time is arranged in Poruke.
  const needsTerm = false;
  const rates = !canConfirm && !canReport && !answersChange && awaitsMyRating(item);
  const sayAttention = attention && !answersChange && !(attention.kind === 'confirm' && canConfirm) && !(attention.kind === 'rate' && rates);
  // Owner, 25.11.2026: a person stands on the white page and breathes - no frame, the face and name on top, the facts across
  // the whole width, one wide step at the foot with the message and "···" beside it; a hairline parts one person from the next.
  const step = answersChange ? <V2Action tone="brand" label="Odgovorite na predlog" onPress={onChanges} style={s.flex} />
    : canConfirm ? <V2Action tone="brand" label="Potvrdite završetak" onPress={onComplete} style={s.flex} />
      : needsTerm && !canReport ? <V2Action tone="neutral" kind="secondary" label="Predložite termin" onPress={onProposeTerm} style={s.flex} />
        : canReport ? <V2Action tone="brand" label="Zadatak je gotov" onPress={onComplete} style={s.flex} />
          : rates ? <V2Action tone="neutral" kind="secondary" label="Ocenite saradnju" onPress={onRate} style={s.flex} /> : <View style={s.flex} />;
  return <View style={s.person}>
    <View style={s.personHead}>
      <Press accessibilityRole="button" accessibilityLabel={`Profil: ${person.name}`} accessibilityHint="Otvara profil, ocene i recenzije."
        onPress={onProfile} haptic="select" style={s.personWho}>
        <Face person={person} size={48} />
        <View style={s.flex}>
          <T variant="bodyStrong" numberOfLines={1}>{person.name}</T>
          <T variant="note" tone="muted" numberOfLines={1}>{rating ?? (owner ? 'Uskače' : 'Objavio zadatak')}</T>
        </View>
      </Press>
      <AgreementStatusChip chip={agreementChip(item, now)} />
    </View>
    {facts ? <Press accessibilityRole="button" accessibilityLabel={`Uslovi Dogovora sa: ${person.name}`} accessibilityHint="Otvara uslove i izmene ovog Dogovora."
      onPress={onOpen} haptic="select" style={s.personFacts}>
      <View style={s.inline}><FactArt kind="money" size={26} />
        <T variant="bodyStrong" style={s.money}>{amount || 'Cena po dogovoru'}</T>
        {amount ? <T variant="note" tone="muted">{applicationPriceBasisText(item.osnovaCene)}</T> : null}</View>
      <View style={s.inline}><FactArt kind={remote ? 'remote' : 'pin'} size={26} /><T variant="copy" numberOfLines={2} style={s.flex}>{place}</T></View>
      <View style={s.inline}><FactArt kind="calendar" size={26} /><T variant="copy" numberOfLines={2} style={s.flex}>{item.vremeTekst || 'Termin po dogovoru'}</T></View>
    </Press> : null}
    {sayAttention ? <View style={s.inline}><View style={s.dot} /><T variant="note" style={s.warn} numberOfLines={2}>{attention!.title}</T></View> : null}
    {waitsOnOther ? <T variant="note" tone="muted">Čeka se odgovor na Vaš predlog izmene.</T> : null}
    {item.problemOtvoren ? <T variant="note" tone="danger">Prijavljen je problem</T> : null}
    {autoConfirm ? <T variant="note" tone="muted">Ako ne odgovorite, završetak se sam potvrđuje: {autoConfirm}.</T> : null}
    <View style={s.personFoot}>
      {step}
      {/* No message icon beside the step (owner, 26.11.2026): Poruke is one tap away in the bar on top. */}
      {/* The rest of this Dogovor, one tap away (owner's choice, 25.11.2026): problem, report or block, cancel. */}
      {onMore ? <Press accessibilityRole="button" accessibilityLabel={`Više radnji: ${person.name}`}
        accessibilityHint="Prijava problema, prijava ili blokiranje osobe, otkazivanje." onPress={onMore} haptic="select" style={s.iconButton}>
        <Glyph name="more" size={22} tone="ink" />
      </Press> : null}
    </View>
    {needsTerm && canReport ? <V2Action tone="neutral" kind="quiet" label="Predložite termin" onPress={onProposeTerm} /> : null}
  </View>;
}

/**
 * The Dogovor of one task (owner's sketch and explanation, 22.11.2026). Top: back and four premium icons — 🤝 dogovoreni,
 * ✈️ prijave (the app's blue paper plane), 💬 grupni razgovor, ✏️ uređivanje. Below, the overview: title, coins and price,
 * globe or pin, calendar, the description (not on the card), the map and "Dogovoreno sa". A worker sees the task owner,
 * the description, the map and the group conversation, never other workers or their applications.
 */
export function AgreementTaskHub({ needId, role, title, fallbackAgreementId, initialPane }: { needId: string; role: Role; title: string; fallbackAgreementId?: string;
  /** The part opened from the owner's task page: Dogovoreni, Prijave or Poruke. */ initialPane?: TaskTab }) {
  const router = useRouter(), source = useIzvor(), { user, accountRevision } = useSesija();
  const owner = role === 'narucilac';
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [pane, setPane] = useState<Pane>(initialPane && initialPane !== 'overview' ? initialPane : role === 'narucilac' ? 'agreed' : 'overview');
  const [menuFor, setMenuFor] = useState<AgreementTaskPerson | null>(null);
  const [periods, setPeriods] = useState<ReadonlyMap<string, AgreementPeriod>>(new Map());
  const [periodFor, setPeriodFor] = useState<string | null>(null);
  const [apps, setApps] = useState<Apps>(null);
  const [need, setNeed] = useState<PotrebaProjekcija | null>(null);
  // The task's own description, for a worker (owner, 26.11.2026): the Dogovor's accepted scope was the worker's application note.
  const [taskText, setTaskText] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ReadonlyMap<string, JavniProfilProjekcija>>(new Map());
  const [profile, setProfile] = useState<PublicProfileState>(null);
  const [deciding, setDeciding] = useState<{ id: string; error: string | null } | null>(null);
  const declineIds = useRef(new Map<string, string>());
  const generation = useRef(0), focused = useRef(false), navigating = useRef(false), profileRequest = useRef(0);
  const owns = useCallback((run: number, account: string | undefined) => run === generation.current && sesijaSada().user?.id === account
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source, [accountRevision, source]);

  const load = useCallback(async () => {
    const run = ++generation.current, account = user?.id;
    const items = await readTaskAgreements(source, needId, role, title).catch(() => null);
    if (!owns(run, account)) return;
    setLoaded(items ? { items } : { error: true });
    const day = 86_400_000, at = Date.now();
    readMyAgreementPeriods(new Date(at - 60 * day), new Date(at + 400 * day)).then(result => {
      if (owns(run, account) && result.ok) setPeriods(new Map(result.podatak.map(period => [period.agreementId, period])));
    }, () => {});
    const ids = [...new Set((items ?? []).flatMap(item => item.ucesnici.filter(p => !p.viSte && p.profilId).map(p => p.profilId!)))];
    if (ids.length) publicProfileClientService.javniProfili(ids).then(list => {
      if (owns(run, account)) setProfiles(new Map((Array.isArray(list) ? list : []).map(p => [p.profilId, p])));
    }, () => {});
    if (!owner) source.prilika(needId).then(value => { if (owns(run, account)) setTaskText(value?.opis?.trim() || null); }, () => {});
    if (owner) {
      source.potreba(needId).then(value => { if (owns(run, account)) setNeed(value); }, () => {});
      source.prijaveZaPotrebu(needId).then(list => { if (owns(run, account)) setApps({ items: list.filter(c => OPEN_APPLICATION.has(c.stanje)) }); },
        () => { if (owns(run, account)) setApps({ error: true }); });
    }
  }, [source, needId, role, title, user?.id, owner, owns]);
  useFocusEffect(useCallback(() => {
    focused.current = true; navigating.current = false; void load();
    return () => { focused.current = false; generation.current++; profileRequest.current++; };
  }, [load]));
  const go = (action: () => void) => {
    if (!focused.current || navigating.current || AppState.currentState !== 'active') return;
    navigating.current = true; action();
  };
  const items = loaded && 'items' in loaded ? loaded.items : null;
  const summary = useMemo(() => items?.length ? agreementTaskSummary({ key: needId, items }) : null, [items, needId]);
  const now = new Date();
  const anchor = items?.find(isOpenAgreement) ?? items?.find(isLiveAgreement) ?? items?.[0] ?? null;
  const openAgreement = (id: string, tab?: 'poruke') => go(() => router.navigate({ pathname: '/dogovor/[id]', params: { id, tab: tab ?? 'poruke' } }));
  const back = () => go(() => (router.canGoBack() ? router.back() : router.navigate('/dogovori')));
  const people = summary ? (owner ? summary.people : summary.owner ? [summary.owner] : []) : [];
  const live = people.filter(p => isLiveAgreement(p.agreement)), earlier = people.filter(p => !isLiveAgreement(p.agreement));
  const ratingOf = (profileId: string | null) => {
    const trust = profileId ? profiles.get(profileId)?.poverenje : null;
    return trust?.ocenaDostupna && trust.ocenaProsek != null ? ratingWords(trust.ocenaProsek.toFixed(1), trust.brojRecenzija)?.text ?? null : null;
  };
  const openProfile = (profileId: string | null) => {
    if (!profileId) return;
    const request = ++profileRequest.current, known = profiles.get(profileId) ?? null;
    setProfile(known ? { loading: false, data: known } : { loading: true, data: null });
    if (known) return;
    publicProfileClientService.javniProfil(profileId).then(value => { if (request === profileRequest.current) setProfile({ loading: false, data: value ?? null }); },
      () => { if (request === profileRequest.current) setProfile({ loading: false, data: null }); });
  };
  const accept = (c: KandidatProjekcija) => go(() => router.navigate({ pathname: '/potrebe/[id]/kandidati', params: { id: needId, prijavaId: c.prijavaId } }));
  const decline = async (c: KandidatProjekcija) => {
    if (deciding?.id === c.prijavaId && !deciding.error) return;
    if (!c.potrebaRevizija) { setDeciding({ id: c.prijavaId, error: 'Osvežite prijave pa pokušajte ponovo.' }); return; }
    const requestId = declineIds.current.get(c.prijavaId) ?? noviZahtevId('odbijanje');
    declineIds.current.set(c.prijavaId, requestId);
    setDeciding({ id: c.prijavaId, error: null });
    const result = await declineApplication({ prijavaId: c.prijavaId, potrebaRevizija: c.potrebaRevizija, verzija: c.verzija, clientRequestId: requestId });
    if (!focused.current) return;
    if (result.ok) {
      declineIds.current.delete(c.prijavaId); setDeciding(null);
      setApps(current => current && 'items' in current ? { items: current.items.filter(x => x.prijavaId !== c.prijavaId) } : current);
    } else setDeciding({ id: c.prijavaId, error: result.poruka });
  };
  const appCount = apps && 'items' in apps ? apps.items.length : 0;
  // A person's "···": the steps that used to need the old Dogovor page, each on its own clean screen.
  const personActions = (person: AgreementTaskPerson): SheetAction[] => {
    const id = person.agreementId, open = isOpenAgreement(person.agreement);
    return [
      ...(open && !person.agreement.problemOtvoren ? [{ key: 'problem', label: 'Prijavite problem', icon: 'alert' as const,
        onPress: () => go(() => router.navigate({ pathname: '/dogovor/[id]', params: { id, action: 'problem' } })) }] : []),
      { key: 'safety', label: 'Prijavite ili blokirajte osobu', icon: 'shield' as const,
        destructive: true, onPress: () => go(() => router.navigate({ pathname: '/bezbednost', params: { targetAccountId: person.accountId, agreementId: id } })) },
      ...(open ? [{ key: 'cancel', label: owner ? 'Uklonite iz Dogovora' : 'Otkažite Dogovor', icon: 'tasks' as const, destructive: true,
        onPress: () => go(() => router.navigate({ pathname: '/dogovor/[id]/izmene', params: { id, start: 'cancel' } })) }] : []),
    ];
  };
  const toggle = (next: Pane) => setPane(current => current === next ? 'overview' : next);
  // Poruke (owner's choice, 25.11.2026, after WhatsApp/Slack/Airbnb): one person on the task opens that conversation at once;
  // several open a short list - the group of everyone on top, then a private conversation with each person.
  const hasGroup = (anchor?.pokrivenost.ukupno ?? 1) > 1;
  // The owner's Pregled is the task's own page (owner, 25.11.2026: the task looks like its Dogovor from the moment it is
  // published); the two pages carry the same top, so moving between them reads as one screen.
  const openOverview = () => {
    if (owner) go(() => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: needId } }));
    else setPane('overview');
  };
  const openMessages = () => {
    if (!hasGroup && live.length === 1) openAgreement(live[0].agreementId, 'poruke');
    else setPane('messages');
  };

  // Owner-approved look (canvas of 25.11.2026, with the app's 3D pictures): back, the task and its pencil on top; under them
  // the four parts of the task - Pregled, Dogovoreni, Prijave, Poruke - each saying how many, the open one underlined.
  // Owner, 25.11.2026: the same quiet navigation as the task's own page - back, the parts, nothing more; the title is the large heading below.
  const bar = <TaskTopBar owner={owner} agreed={live.length} applications={appCount} messages={!!anchor && live.length > 0}
    selected={pane === 'overview' || pane === 'edit' ? 'overview' : pane === 'group' ? 'messages' : pane}
    onSelect={tab => tab === 'overview' ? openOverview() : tab === 'messages' ? openMessages() : setPane(tab)}
    onBack={back} backLabel="Nazad na Dogovore"
    right={!owner && live[0] && isLiveAgreement(live[0].agreement) ? <ChromeIconButton glyph="more" label="Više radnji" onPress={() => setMenuFor(live[0])} /> : undefined} />;
  const heading = <TaskDecisionTitle prominent onLayout={() => undefined}>{summary?.title || title || 'Dogovor'}</TaskDecisionTitle>;

  let body: ReactNode;
  if (!loaded) body = <StateView skeleton={{ rows: 3, face: true }} title="Učitavamo Dogovor…" body="Proveravamo dogovorene osobe i uslove." />;
  else if ('error' in loaded) body = <StateView kind="error" art="agreements" title="Dogovor nije učitan" body="Proverite vezu i pokušajte ponovo."
    primary={{ label: 'Pokušajte ponovo', onPress: () => { setLoaded(null); void load(); } }} />;
  else if (!summary && !owner) body = <StateView art="agreements" title="Dogovor nije pronađen" body="Možda je zadatak promenjen ili je Dogovor otkazan."
    primary={fallbackAgreementId ? { label: 'Otvorite Dogovor', onPress: () => openAgreement(fallbackAgreementId) } : { label: 'Nazad na Dogovore', onPress: back }} />;
  else if (pane === 'group' && anchor) body = <View style={s.flex}><GroupConversationScreen agreementId={anchor.id} embedded /></View>;
  else {
    const first = summary?.people[0]?.agreement ?? items?.[0];
    const amount = first?.cena.prikaz, mixed = summary?.priceText === MIXED;
    const approx = need?.priblizno ?? null;
    const card = (person: AgreementTaskPerson, removable: boolean, facts = true) => <PersonCard key={person.agreementId} person={person} owner={owner} facts={facts}
      onComplete={() => go(() => router.navigate({ pathname: '/dogovor/[id]', params: { id: person.agreementId, action: 'complete' } }))}
      onRate={() => go(() => router.navigate({ pathname: '/oceni-dogovor', params: { agreementId: person.agreementId } }))}
      remote={summary?.remote ?? false} place={summary?.placeText ?? ''} now={now} rating={ratingOf(person.profileId)} onProfile={() => openProfile(person.profileId)}
      onOpen={() => go(() => router.navigate({ pathname: '/dogovor/[id]/izmene', params: { id: person.agreementId } }))}
      onChanges={() => go(() => router.navigate({ pathname: '/dogovor/[id]/izmene', params: { id: person.agreementId } }))}
      onProposeTerm={() => go(() => router.navigate({ pathname: '/dogovor/[id]/izmene', params: { id: person.agreementId, start: 'propose' } }))}
      onMessage={() => openAgreement(person.agreementId, 'poruke')}
      period={periods.get(person.agreementId) ?? null}
      onPeriod={person.agreement.stanje === 'CONFIRMED' ? () => setPeriodFor(person.agreementId) : undefined}
      onMore={removable && isLiveAgreement(person.agreement) ? () => setMenuFor(person) : undefined} />;
    body = <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {heading}
      {pane === 'overview' && summary ? <View style={s.overview}>
        <View style={s.valueWithArt}>
          <View style={s.valueArt}><FactArt kind="money" size={FACT_ROW_ART} /></View>
          <View style={s.valueCopy}>
            <T variant="priceRow" style={s.money}>{mixed || !amount ? summary.priceText ?? 'Cena po dogovoru' : amount}</T>
            {amount && !mixed ? <T variant="note" tone="muted">{applicationPriceBasisText(first!.osnovaCene)}</T> : null}
          </View>
        </View>
        <FactRow art={summary.remote ? 'remote' : 'pin'} value={summary.placeText} size="detail" />
        {/* Owner, 26.11.2026: a task with its own day is in the schedule by itself; only a flexible one asks which day, here. */}
        {(() => {
          const mine = anchor ? periods.get(anchor.id) ?? null : null;
          const flexible = !!anchor && isLiveAgreement(anchor) && anchor.stanje === 'CONFIRMED' && (isNoTermText(anchor.vremeTekst) || !anchor.prihvacenPocetak);
          const text = mine ? periodLine(mine) : summary.whenText;
          return flexible || mine ? <Press accessibilityRole="button" accessibilityLabel={mine ? `U Vašem rasporedu: ${text}` : `${text}. Dodajte u raspored`}
            onPress={() => setPeriodFor(anchor!.id)} haptic="select" style={s.calendarRow}>
            <FactRow art="calendar" value={text} size="detail" />
            <T variant="note" style={s.periodAdd}>{mine ? 'U Vašem rasporedu · promenite' : 'Dodajte u raspored'}</T>
          </Press> : <FactRow art="calendar" value={text} size="detail" />;
        })()}
        {(owner ? need?.opis?.trim() : taskText) ? <View style={s.block}><T variant="label" tone="muted">Opis</T><T variant="copy">{owner ? need!.opis!.trim() : taskText}</T></View> : null}
        {!summary.remote && anchor && isLiveAgreement(anchor)
          ? <AgreementPrivateLocation agreement={anchor} enabled={focused.current} onRequestAddress={() => openAgreement(anchor.id, 'poruke')} />
          : !summary.remote && approx ? <View style={s.block}>
            <LocationMapPreview points={[{ id: 'area', label: 'Približno mesto', latitude: approx.lat, longitude: approx.lng }]} coarse height={184} scopeKey={`dogovor:${needId}`} />
            <T variant="meta" tone="muted">Približno mesto, oko 200 m. Tačna adresa se vidi posle Dogovora.</T>
          </View> : null}
        {/* A worker's Dogovor: the task owner, the message, "···" and the next step stand right here (owner, 25.11.2026). */}
        {!owner && live[0] ? card(live[0], false, false) : live.length ? <Press accessibilityRole="button" accessibilityLabel={`${owner ? 'Dogovoreno sa' : 'Objavio zadatak'}: ${live.map(person => person.name).join(', ')}`}
          accessibilityHint={owner ? 'Otvara dogovorene osobe.' : 'Otvara profil i ocene.'}
          onPress={() => owner ? setPane('agreed') : openProfile(live[0].profileId)} haptic="select" style={s.peopleRow}>
          <View style={s.peopleCopy}>
            <T variant="bodyStrong">{owner ? 'Dogovoreno sa' : 'Objavio zadatak'}</T>
            <T variant="note" tone="muted" numberOfLines={1}>{live.map(person => person.name.split(' ')[0]).join(', ')}</T>
          </View>
          <View style={s.peopleFaces}>{live.slice(0, 3).map((person, index) => <View key={person.agreementId} style={index ? s.peopleOverlap : undefined}>
            <Face person={person} size={40} /></View>)}</View>
          {owner && summary.total ? <T variant="bodyStrong">{summary.filled}/{summary.total}</T> : null}
        </Press> : <T variant="note" tone="muted">{owner ? 'Još niko nije izabran. Pogledajte prijave.' : 'Podaci o naručiocu nisu dostupni.'}</T>}
      </View> : null}
      {pane === 'agreed' ? <View style={s.list}>
        {live.length ? live.map(person => card(person, true))
          : <StateView compact art="agreements" title={owner ? 'Još nema dogovorenih osoba' : 'Dogovor nije aktivan'}
            body={owner ? 'Prevucite prijavu udesno da izaberete osobu.' : 'Ranije saradnje su ispod.'} />}
        {earlier.length ? <><T variant="label" tone="muted" style={s.earlierTitle}>Ranije</T>{earlier.map(person => card(person, false))}</> : null}
      </View> : null}
      {pane === 'applications' ? <View style={s.list}>
        {!apps ? <StateView skeleton={{ rows: 2, face: true }} title="Učitavamo prijave…" body="Proveravamo ko se prijavio." />
          : 'error' in apps ? <StateView kind="error" art="applications" title="Prijave nisu učitane" body="Proverite vezu i pokušajte ponovo."
            primary={{ label: 'Pokušajte ponovo', onPress: () => { setApps(null); void load(); } }} />
            : !apps.items.length ? <StateView compact art="applications" title="Nema novih prijava" body="Kada se neko prijavi, videćete ga ovde." />
              : <>
                <T variant="note" tone="muted">Prevucite udesno da prihvatite, ulevo da odbijete.</T>
                {apps.items.map(c => <ApplicationSwipeCard key={c.prijavaId} candidate={c} onAvatar={() => openProfile(c.radnikProfilId)}
                  busy={deciding?.id === c.prijavaId && !deciding.error} error={deciding?.id === c.prijavaId ? deciding.error : null}
                  onAccept={() => accept(c)} onDecline={() => { void decline(c); }} />)}
              </>}
      </View> : null}
      {pane === 'messages' ? <View style={s.list}>
        {hasGroup ? <Press accessibilityRole="button" accessibilityLabel="Grupni razgovor, svi učesnici zadatka" onPress={() => setPane('group')}
          haptic="select" style={s.peopleRow}>
          <FactArt kind="chat" size={40} />
          <View style={s.peopleCopy}><T variant="bodyStrong">Grupni razgovor</T>
            <T variant="note" tone="muted" numberOfLines={1}>Svi učesnici zadatka</T></View>
          <Glyph name="caret-right" size={20} tone="muted" />
        </Press> : null}
        {live.map(person => <Press key={person.agreementId} accessibilityRole="button" accessibilityLabel={`Privatna poruka: ${person.name}`}
          onPress={() => openAgreement(person.agreementId, 'poruke')} haptic="select" style={s.peopleRow}>
          <Face person={person} size={40} />
          <View style={s.peopleCopy}><T variant="bodyStrong" numberOfLines={1}>{person.name}</T>
            <T variant="note" tone="muted" numberOfLines={1}>Privatna poruka</T></View>
          <Glyph name="caret-right" size={20} tone="muted" />
        </Press>)}
      </View> : null}
      {pane === 'edit' ? <StateView art="document" title="Uređivanje zadatka"
        body={appCount ? 'Zadatak već ima prijave. Izmene uslova idu kroz Dogovor sa svakom osobom.' : 'Dok nema prijava, zadatak možete urediti na njegovoj stranici.'}
        primary={{ label: 'Otvorite zadatak', onPress: () => go(() => router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: needId } })) }} /> : null}
    </ScrollView>;
  }

  return <SafeAreaView edges={['top']} style={s.screen}>
    {bar}
    {body}
    {periodFor ? <MyPeriodSheet agreementId={periodFor} current={periods.get(periodFor) ?? null} onClose={() => setPeriodFor(null)}
      day={items?.find(item => item.id === periodFor)?.prihvacenPocetak ?? null}
      onSaved={period => setPeriods(current => { const next = new Map(current); if (period) next.set(periodFor, period); else next.delete(periodFor); return next; })} /> : null}
    {menuFor ? <ActionSheet label={`Radnje: ${menuFor.name}`} onClose={() => setMenuFor(null)} actions={personActions(menuFor)} /> : null}
    <PublicProfileSheet state={profile} onClose={() => { profileRequest.current++; setProfile(null); }}
      onRetry={() => { const id = profile?.data?.profilId; if (id) openProfile(id); }}
      photo={(profileId, size) => <ProfilePhoto profileId={profileId} size={72} fallback={<Avatar initials={null} size={72} />} />} />
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  flex: { flex: 1, minWidth: 0 },
  bar: { paddingHorizontal: sys.space.sm, paddingTop: sys.space.xs, gap: sys.space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line, backgroundColor: sys.color.surface },
  heading: { color: sys.color.ink },
  headTitle: { flex: 1, minWidth: 0 },
  content: { padding: layout.gutter, gap: sys.space.md, paddingBottom: sys.space.xl * 2 },
  overview: { gap: sys.space.md },
  valueArt: { width: FACT_ROW_ART, height: FACT_ROW_ART },
  valueWithArt: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: FACT_ROW_ART },
  valueCopy: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm },
  money: { color: sys.color.money },
  block: { gap: sys.space.sm },
  faceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.md },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, padding: sys.space.md, minHeight: 64,
    borderRadius: sys.radius.card, backgroundColor: sys.color.wash },
  peopleCopy: { flex: 1, minWidth: 0, gap: 2 },
  peopleFaces: { flexDirection: 'row', alignItems: 'center' },
  peopleOverlap: { marginLeft: -10 },
  gridFace: { width: 88, alignItems: 'center', gap: 6 },
  gridName: { textAlign: 'center', fontWeight: '600', color: sys.color.ink },
  list: { gap: sys.space.md },
  earlierTitle: { marginTop: sys.space.sm },
  person: { gap: sys.space.md, paddingVertical: sys.space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  personWho: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  personFacts: { gap: sys.space.sm },
  personFoot: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  periodAdd: { color: sys.color.green, paddingLeft: FACT_ROW_ART + sys.space.md },
  calendarRow: { gap: 2 },
  personCard: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  personFace: { width: 72, alignItems: 'center', gap: 4 },
  personName: { textAlign: 'center', fontWeight: '600' },
  personBody: { flex: 1, minWidth: 0, gap: 6 },
  personTop: { flexDirection: 'row' },
  personStep: { marginTop: sys.space.sm, gap: sys.space.xs },
  personActions: { alignItems: 'center', gap: 2 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: sys.color.warn },
  warn: { color: sys.color.warn, flexShrink: 1 },
});
