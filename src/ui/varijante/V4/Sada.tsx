import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../../contracts/projections';
import type { ReviewTag } from '../../../data/reviewsClientService';
import { AgreementOverview } from '../../agreements/AgreementOverview';
import { overviewContent } from '../../agreements/AgreementOverviewParts';
import { WorkspaceFooter, agreementNextStep, agreementQuietLine } from '../../agreements/AgreementWorkspace';
import { addressWords } from '../../agreements/agreementContactModel';
import { ProfileHub, PROFILE_AVATAR } from '../../profile/ProfileHubPresentation';
import { ProfileStatsSection } from '../../profile/ProfileStats';
import { FinishedAgreements } from '../../profile/ProfileWorkSummary';
import { ReputationLine } from '../../reviews/AccountReputation';
import { AgreementReviewPresentation, type ReviewPerson, type ReviewView } from '../../reviews/AgreementReviewPresentation';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { FactArt } from '../../system/FactArt';
import { layout } from '../../system/layout';
import { ListRow } from '../../system/ListRow';
import { PublicProfileSheet } from '../../system/PublicProfileSheet';
import { ChromeIconButton, ScreenChrome } from '../../system/ScreenChrome';
import { sys } from '../../system/tokens';
import { AgreementCollectionPresentation } from '../../v2/AgreementCollectionPresentation';
import { AgreementPersonBar, AgreementTabs } from '../../v2/AgreementPresentation';
import { V2Action } from '../../v2/V2Action';
import { NOW, PROFILE_ME, PUBLIC, RATED, REVIEW_CATALOG, REVIEW_PERSON, SAVED_TAGS, STATS, TRUST } from './fixtures';
import { noop } from './lab';

/**
 * "SADA": today's production screens, drawn with the SAME fake data as the variants, so the owner sees "before" beside "after". Every
 * component here is the one the app draws (the list, the Pregled of the Dogovor, the rating, the profile hub, the public profile);
 * nothing reads or writes, and every command is a no-op, as in the design galleries.
 */
const STILL_HEADER = <ScreenChrome variant="root" title="Dogovori" onProfile={noop} bell={<ChromeIconButton label="Obaveštenja" glyph="notifications" onPress={noop} />} />;

export function ListaSada({ items }: { items: readonly DogovorProjekcija[] }) {
  return <AgreementCollectionPresentation items={items} loading={false} error={false} section="active" confirmationOnly={false} now={NOW}
    onSection={noop} onConfirmationOnly={noop} onRefresh={noop} onOpen={noop} onRate={noop} onCalendar={noop} onProfile={noop}
    onHome={noop} onTasks={noop} onPublish={noop} header={STILL_HEADER} />;
}

/** The private location in its unshared state, as the gallery draws it; nothing is read. */
function StillLocation({ requester }: { requester: boolean }) {
  const words = addressWords({ requester, granted: false });
  return <View style={s.location}>
    <View><ListRow leading={<FactArt kind="lock" size={32} muted />} title={words.title} last /></View>
    {requester ? <V2Action label="Podeli lokaciju" onPress={noop} /> : words.ask ? <V2Action label="Zatraži adresu" onPress={noop} /> : null}
  </View>;
}

export function DetaljSada({ item, ownRating = 'NOT_APPLICABLE', brand }: { item: DogovorProjekcija; ownRating?: 'DUE' | 'GIVEN' | 'CLOSED' | 'UNKNOWN' | 'NOT_APPLICABLE'; brand: string }) {
  const other = item.ucesnici.find(person => !person.viSte) as UcesnikProjekcija | undefined;
  const me = item.ucesnici.find(person => person.viSte);
  const isWorker = me?.uloga === 'uskocer', isRequester = me?.uloga === 'narucilac';
  const active = item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER';
  const change = { waits: false, mine: null };
  const step = agreementNextStep({ state: item.stanje, party: true, worker: isWorker, change, ownRating, problemOpen: item.problemOtvoren, deadline: 'Do 9. okt · 09:00' });
  const canChange = active && !(isRequester && item.stanje === 'AWAITING_REQUESTER');
  return <View style={s.fill}>
    {other ? <AgreementPersonBar person={other} back={noop} /> : null}
    <View style={s.tabs}><AgreementTabs tab="pregled" onChange={noop} /></View>
    <ScrollView contentContainerStyle={overviewContent}>
      <AgreementOverview agreement={item} step={step} party enabled accountHasNumber
        steps={{ state: item.stanje, ownRating, deadlineIso: item.rokPotvrdeIso, problemOpen: item.problemOtvoren, cancellation: null }}
        location={<StillLocation requester={isRequester} />}
        on={{ changeTerms: canChange ? noop : undefined, togglePhone: noop, openMessages: noop, requestAddress: noop,
          openTask: noop, openChange: canChange ? noop : undefined, openProblem: active ? noop : undefined, openSafety: noop }} />
    </ScrollView>
    <WorkspaceFooter brand={brand ? { label: brand, onPress: noop } : null}
      quiet={brand ? null : agreementQuietLine({ state: item.stanje, party: true, worker: isWorker, otherName: other?.ime, change, permissionsKnown: true })} />
  </View>;
}

export function OcenaSada({ saved = false, initial = 4, person = REVIEW_PERSON }: { saved?: boolean; initial?: number; person?: ReviewPerson }) {
  const [rating, setRating] = useState(initial);
  const [tags, setTags] = useState<ReviewTag[]>(initial ? ['ON_TIME'] : []);
  const view: ReviewView = saved ? { kind: 'saved', rating: 4, tags: SAVED_TAGS, fresh: false }
    : { kind: 'eligible', catalog: REVIEW_CATALOG, rating, tags, editable: true, attempt: false, onRate: setRating,
      onToggleTag: tag => setTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag]),
      save: { label: 'Sačuvaj ocenu', loading: false, disabled: rating === 0, reason: rating === 0 ? 'Izaberi ocenu.' : null, onPress: noop } };
  return <AgreementReviewPresentation backLabel="Nazad na Dogovor" onBack={noop} view={view} retry={{ label: 'Ponovo učitaj ocenu', disabled: false, onPress: noop }}
    notice={null} person={person} />;
}

export function ProfilSada() {
  return <ProfileHub busy={false} open={noop} onBack={noop} onLogout={noop} logoutError={false} capabilityDetail="Profil je aktivan." workArea="Novi Sad" email={PROFILE_ME.email}
    identity={{ state: 'ready', name: PROFILE_ME.name, place: PROFILE_ME.place, photo: <Avatar initials={PROFILE_ME.initials} size={PROFILE_AVATAR} />, photoReady: true, openPhoto: noop,
      reputation: <ReputationLine state={RATED} onRetry={noop} onOpen={noop} /> }}
    workSummary={<FinishedAgreements view={{ kind: 'ready', facts: [{ role: 'uskocer', count: 9 }, { role: 'narucilac', count: 3 }] }} onOpen={noop} onRefresh={noop} />}
    stats={<ProfileStatsSection state={{ kind: 'ready', stats: STATS }} />} />;
}

export function JavniSada() {
  return <PublicProfileSheet state={{ loading: false, data: PUBLIC }} onClose={noop} onRetry={noop} trust={TRUST} safety={{ onPress: noop, busy: false, error: null }} />;
}

/** The lab's note under a "sada" scene that draws a sheet: nothing. The sheet lies over an empty white screen, as it would over any screen. */
export function Prazno() { return <View style={s.fill}><T variant="note" tone="muted" style={s.hidden}> </T></View>; }

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: sys.color.ground },
  tabs: { paddingHorizontal: layout.gutter, paddingBottom: sys.space.md },
  location: { paddingTop: sys.space.sm, gap: sys.space.md },
  hidden: { opacity: 0 },
});
