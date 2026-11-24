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
import { agreementTaskSummary, isLiveAgreement, isOpenAgreement, type AgreementTaskPerson } from './agreementTaskModel';

type Role = 'narucilac' | 'uskocer';
type Pane = 'overview' | 'agreed' | 'applications' | 'group' | 'edit';
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

/** One premium icon of the top bar (owner's sketch): the picture alone, a soft ring when its pane is open. */
function BarIcon({ label, art, glyph, selected, badge, onPress }: {
  label: string; art?: FactArtKind; glyph?: 'edit'; selected: boolean; badge?: number; onPress: () => void;
}) {
  return <Press accessibilityRole="tab" accessibilityLabel={badge ? `${label}, ${badge}` : label} accessibilityState={{ selected }}
    onPress={onPress} haptic="select" style={s.barIcon}>
    <View style={[s.barDisc, selected && s.barDiscOn]}>
      {art ? <FactArt kind={art} size={30} /> : <Glyph name={glyph!} size={26} tone={selected ? 'green' : 'ink'} />}
    </View>
    <View style={[s.barMark, selected && s.barMarkOn]} />
    {badge ? <View style={s.badge}><T variant="meta" maxFontSizeMultiplier={1.2} style={s.badgeText}>{badge > 99 ? '99+' : badge}</T></View> : null}
  </Press>;
}

/** An agreed person (🤝): avatar on the left with the name under it; rating, price, place and date; remove and a private message. */
function PersonCard({ person, owner, remote, place, now, rating, onProfile, onOpen, onMessage, onRemove, onComplete, onRate }: {
  person: AgreementTaskPerson; owner: boolean; remote: boolean; place: string; now: Date; rating: string | null;
  onProfile: () => void; onOpen: () => void; onMessage: () => void; onRemove?: () => void; onComplete: () => void; onRate: () => void;
}) {
  const item = person.agreement, attention = agreementAttention(item);
  // Completion is per person (owner, 22.11.2026). The server's allowed actions decide when they are known; the state is
  // only a fallback for a list row without them. The button opens the existing completion review of that Dogovor.
  const canConfirm = owner && (item.radnje ? item.radnje.mozePotvrditiZavrsetak && item.stanje === 'AWAITING_REQUESTER' : awaitsMyConfirmation(item));
  const canReport = !owner && (item.radnje ? item.radnje.mozeOznacitiZavrsetak : item.stanje === 'CONFIRMED' && !item.izmenaCeka);
  const autoConfirm = canConfirm && item.rokPotvrdeIso
    ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: item.rokPotvrdeIso }, 'Europe/Belgrade') : null;
  const amount = item.cena.prikaz;
  return <Surface kind="record">
    <View style={s.personCard}>
      <Press accessibilityRole="button" accessibilityLabel={`Profil: ${person.name}`} accessibilityHint="Otvara profil, ocene i recenzije."
        onPress={onProfile} haptic="select" style={s.personFace}>
        <Face person={person} size={56} />
        <T variant="meta" numberOfLines={2} style={s.personName}>{person.name}</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel={`Dogovor sa: ${person.name}`} accessibilityHint="Otvara uslove, poruke i završetak za ovu osobu."
        onPress={onOpen} haptic="select" style={s.personBody}>
        <View style={s.personTop}><AgreementStatusChip chip={agreementChip(item, now)} /></View>
        {rating ? <View style={s.inline}><FactArt kind="star" size={26} /><T variant="note" tone="muted">{rating}</T></View> : null}
        <View style={s.inline}><FactArt kind="money" size={26} />
          <T variant="bodyStrong" style={s.money}>{amount || 'Cena po dogovoru'}</T>
          {amount ? <T variant="note" tone="muted">{applicationPriceBasisText(item.osnovaCene)}</T> : null}</View>
        <View style={s.inline}><FactArt kind={remote ? 'remote' : 'pin'} size={26} /><T variant="note" tone="muted" numberOfLines={2} style={s.flex}>{place}</T></View>
        <View style={s.inline}><FactArt kind="calendar" size={26} /><T variant="note" tone="muted" numberOfLines={2} style={s.flex}>{item.vremeTekst || 'Termin po dogovoru'}</T></View>
        {attention ? <View style={s.inline}><View style={s.dot} /><T variant="note" style={s.warn} numberOfLines={2}>{attention.title}</T></View> : null}
        {item.problemOtvoren ? <T variant="note" tone="danger">Prijavljen je problem</T> : null}
        {canConfirm || canReport || awaitsMyRating(item) ? <View style={s.personStep}>
          {canConfirm ? <V2Action tone="brand" label="Potvrdite završetak" onPress={onComplete} />
            : canReport ? <V2Action tone="brand" label="Zadatak je gotov" onPress={onComplete} />
              : <V2Action tone="neutral" kind="secondary" label="Ocenite saradnju" onPress={onRate} />}
          {autoConfirm ? <T variant="note" tone="muted">Ako ne odgovorite, završetak se sam potvrđuje: {autoConfirm}.</T> : null}
        </View> : null}
      </Press>
      <View style={s.personActions}>
        {onRemove ? <Press accessibilityRole="button" accessibilityLabel={`Uklonite iz Dogovora: ${person.name}`}
          accessibilityHint="Otvara otkazivanje uz razlog. Pre slanja vidite pregled." onPress={onRemove} haptic="select" style={s.iconButton}>
          <Glyph name="close" size={22} tone="danger" />
        </Press> : null}
        <Press accessibilityRole="button" accessibilityLabel={`Privatna poruka: ${person.name}`} onPress={onMessage} haptic="select" style={s.iconButton}>
          <FactArt kind="chat" size={26} />
        </Press>
      </View>
    </View>
  </Surface>;
}

/**
 * The Dogovor of one task (owner's sketch and explanation, 22.11.2026). Top: back and four premium icons — 🤝 dogovoreni,
 * ✈️ prijave (the app's blue paper plane), 💬 grupni razgovor, ✏️ uređivanje. Below, the overview: title, coins and price,
 * globe or pin, calendar, the description (not on the card), the map and "Dogovoreno sa". A worker sees the task owner,
 * the description, the map and the group conversation, never other workers or their applications.
 */
export function AgreementTaskHub({ needId, role, title, fallbackAgreementId }: { needId: string; role: Role; title: string; fallbackAgreementId?: string }) {
  const router = useRouter(), source = useIzvor(), { user, accountRevision } = useSesija();
  const owner = role === 'narucilac';
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [pane, setPane] = useState<Pane>('overview');
  const [apps, setApps] = useState<Apps>(null);
  const [need, setNeed] = useState<PotrebaProjekcija | null>(null);
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
    const ids = [...new Set((items ?? []).flatMap(item => item.ucesnici.filter(p => !p.viSte && p.profilId).map(p => p.profilId!)))];
    if (ids.length) publicProfileClientService.javniProfili(ids).then(list => {
      if (owns(run, account)) setProfiles(new Map((Array.isArray(list) ? list : []).map(p => [p.profilId, p])));
    }, () => {});
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
  const openAgreement = (id: string, tab?: 'poruke') => go(() => router.navigate({ pathname: '/dogovor/[id]', params: tab ? { id, tab } : { id } }));
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
  const toggle = (next: Pane) => setPane(current => current === next ? 'overview' : next);

  const bar = <View style={s.bar} accessibilityRole="tablist">
    <ChromeIconButton glyph="back" label={pane === 'overview' ? 'Nazad na Dogovore' : 'Nazad na pregled'} onPress={pane === 'overview' ? back : () => setPane('overview')} />
    <View style={s.barIcons}>
      <BarIcon label={owner ? 'Dogovoreni' : 'Dogovor'} art="agreements" selected={pane === 'agreed'} onPress={() => toggle('agreed')} />
      {owner ? <BarIcon label="Prijave" art="applications" selected={pane === 'applications'} badge={appCount} onPress={() => toggle('applications')} /> : null}
      {anchor ? <BarIcon label="Grupni razgovor" art="chat" selected={pane === 'group'} onPress={() => toggle('group')} /> : null}
      {owner ? <BarIcon label="Uređivanje zadatka" glyph="edit" selected={pane === 'edit'} onPress={() => toggle('edit')} /> : null}
    </View>
  </View>;

  let body: ReactNode;
  if (!loaded) body = <StateView skeleton={{ rows: 3, face: true }} title="Učitavamo Dogovor…" body="Proveravamo dogovorene osobe i uslove." />;
  else if ('error' in loaded) body = <StateView kind="error" art="agreements" title="Dogovor nije učitan" body="Proverite vezu i pokušajte ponovo."
    primary={{ label: 'Pokušajte ponovo', onPress: () => { setLoaded(null); void load(); } }} />;
  else if (!summary) body = <StateView art="agreements" title="Dogovor nije pronađen" body="Možda je zadatak promenjen ili je Dogovor otkazan."
    primary={fallbackAgreementId ? { label: 'Otvorite Dogovor', onPress: () => openAgreement(fallbackAgreementId) } : { label: 'Nazad na Dogovore', onPress: back }} />;
  else if (pane === 'group' && anchor) body = <View style={s.flex}><GroupConversationScreen agreementId={anchor.id} embedded /></View>;
  else {
    const first = summary.people[0]?.agreement ?? items![0];
    const amount = first.cena.prikaz, mixed = summary.priceText === MIXED;
    const approx = need?.priblizno ?? null;
    const card = (person: AgreementTaskPerson, removable: boolean) => <PersonCard key={person.agreementId} person={person} owner={owner}
      onComplete={() => go(() => router.navigate({ pathname: '/dogovor/[id]', params: { id: person.agreementId, action: 'complete' } }))}
      onRate={() => go(() => router.navigate({ pathname: '/oceni-dogovor', params: { agreementId: person.agreementId } }))}
      remote={summary.remote} place={summary.placeText} now={now} rating={ratingOf(person.profileId)} onProfile={() => openProfile(person.profileId)}
      onOpen={() => openAgreement(person.agreementId)} onMessage={() => openAgreement(person.agreementId, 'poruke')}
      onRemove={removable && owner && isOpenAgreement(person.agreement)
        ? () => go(() => router.navigate({ pathname: '/dogovor/[id]/izmene', params: { id: person.agreementId, start: 'cancel' } })) : undefined} />;
    body = <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {pane === 'overview' ? <View style={s.overview}>
        <T variant="title" accessibilityRole="header">{summary.title}</T>
        <View style={s.valueWithArt}>
          <View style={s.valueArt}><FactArt kind="money" size={FACT_ROW_ART} /></View>
          <View style={s.valueCopy}>
            <T variant="priceRow" style={s.money}>{mixed || !amount ? summary.priceText ?? 'Cena po dogovoru' : amount}</T>
            {amount && !mixed ? <T variant="note" tone="muted">{applicationPriceBasisText(first.osnovaCene)}</T> : null}
          </View>
        </View>
        <FactRow art={summary.remote ? 'remote' : 'pin'} value={summary.placeText} size="detail" />
        <FactRow art="calendar" value={summary.whenText} size="detail" />
        {summary.description ? <View style={s.block}><T variant="label" tone="muted">Opis</T><T variant="copy">{summary.description}</T></View> : null}
        {!summary.remote && anchor && isLiveAgreement(anchor)
          ? <AgreementPrivateLocation agreement={anchor} enabled={focused.current} onRequestAddress={() => openAgreement(anchor.id, 'poruke')} />
          : !summary.remote && approx ? <View style={s.block}>
            <LocationMapPreview points={[{ id: 'area', label: 'Približno mesto', latitude: approx.lat, longitude: approx.lng }]} coarse height={184} scopeKey={`dogovor:${needId}`} />
            <T variant="meta" tone="muted">Približno mesto, oko 200 m. Tačna adresa se vidi posle Dogovora.</T>
          </View> : null}
        <View style={s.block}>
          <T variant="label" tone="muted">{owner ? 'Dogovoreno sa' : 'Objavio zadatak'}</T>
          {live.length ? <View style={s.faceGrid}>{live.map(person => <Press key={person.agreementId} accessibilityRole="button"
            accessibilityLabel={`Profil: ${person.name}`} onPress={() => openProfile(person.profileId)} haptic="select" style={s.gridFace}>
            <Face person={person} size={56} /><T variant="meta" numberOfLines={2} style={s.gridName}>{person.name}</T>
          </Press>)}</View> : <T variant="note" tone="muted">{owner ? 'Još niko nije izabran. Pogledajte prijave.' : 'Podaci o naručiocu nisu dostupni.'}</T>}
        </View>
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
      {pane === 'edit' ? <StateView art="document" title="Uređivanje zadatka"
        body={appCount ? 'Zadatak već ima prijave. Izmene uslova idu kroz Dogovor sa svakom osobom.' : 'Dok nema prijava, zadatak možete urediti na njegovoj stranici.'}
        primary={{ label: 'Otvorite zadatak', onPress: () => go(() => router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: needId } })) }} /> : null}
    </ScrollView>;
  }

  return <SafeAreaView edges={['top']} style={s.screen}>
    {bar}
    {body}
    <PublicProfileSheet state={profile} onClose={() => { profileRequest.current++; setProfile(null); }}
      onRetry={() => { const id = profile?.data?.profilId; if (id) openProfile(id); }}
      photo={(profileId, size) => <ProfilePhoto profileId={profileId} size={72} fallback={<Avatar initials={null} size={72} />} />} />
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  flex: { flex: 1, minWidth: 0 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: sys.space.sm, paddingVertical: sys.space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line, backgroundColor: sys.color.surface },
  barIcons: { flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  barIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', gap: 3 },
  barDisc: { width: 48, height: 48, borderRadius: sys.radius.pill, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  barDiscOn: { backgroundColor: sys.color.greenSoft },
  barMark: { width: 18, height: 3, borderRadius: 2 },
  barMarkOn: { backgroundColor: sys.color.green },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: sys.color.warn, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontWeight: '800' },
  content: { padding: layout.gutter, gap: sys.space.md, paddingBottom: sys.space.xl * 2 },
  overview: { gap: sys.space.md },
  valueArt: { width: FACT_ROW_ART, height: FACT_ROW_ART },
  valueWithArt: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: FACT_ROW_ART },
  valueCopy: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm },
  money: { color: sys.color.money },
  block: { gap: sys.space.sm },
  faceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.md },
  gridFace: { width: 88, alignItems: 'center', gap: 6 },
  gridName: { textAlign: 'center', fontWeight: '600', color: sys.color.ink },
  list: { gap: sys.space.md },
  earlierTitle: { marginTop: sys.space.sm },
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
