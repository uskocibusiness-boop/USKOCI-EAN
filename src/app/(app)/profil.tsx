import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import type { JavniProfilProjekcija } from '../../contracts/projections';
import { sesijaSada, useSesija } from '../../store/sesija';
import { useIzvor } from '../../store/uloga';
import { authClientService } from '../../data/authClientService';
import { ownProfileClientService, type OwnProfileIdentity } from '../../data/ownProfileClientService';
import { readBuildIdentity } from '../../data/buildIdentity';
import { publicProfileClientService } from '../../data/publicProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { AccountReputation } from '../../ui/reviews/AccountReputation';
import { ProfilePhoto } from '../../ui/media/ContextPhotos';
import { ProfileStats } from '../../ui/profile/ProfileStats';
import { ProfileWorkSummary } from '../../ui/profile/ProfileWorkSummary';
import { cityLabel } from '../../ui/profile/cityLabel';
import { hubWords, versionWord } from '../../ui/profile/hubStates';
import { useHubStates, type HubStateKey } from '../../ui/profile/useHubStates';
import { workProfileSummary } from '../../ui/profile/workProfileSummary';
import { Avatar } from '../../ui/system/Avatar';
import { PublicProfileSheet, type PublicProfileState } from '../../ui/system/PublicProfileSheet';
import { inicijali } from '../../lib/inicijali';
import { PROFILE_AVATAR, ProfileHub, type ProfileHubIdentity, type ProfileHubPath } from '../../ui/profile/ProfileHubPresentation';

type ActionScope = { accountId: string; accountRevision: number; busy: boolean };
/** The rows that say their own state (open requests, blocked people, the export, the legal documents); read apart from the profile, so none of them can hold it up. */
const STATE_ROWS: readonly HubStateKey[] = ['support', 'blocked', 'export', 'legal'];
/** The work profile as the hub reads it: the account's own row, with the two facts its one line needs (skills and radius). */
type WorkCapability = OwnProfileIdentity & { vestine?: string[]; radijusKm?: number };

export default function Profil() {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const izvor = useIzvor();
  // One account has one identity and, beside it, how it can help (owner decision 1, 2026-09-19).
  // The hub used to be two hubs chosen by a global mode, with a switch between them. It now reads
  // both of the account's own profile rows: the one tasks are published under carries the name and
  // the photo, the other says whether tasks can be offered to this person at all. The work profile is
  // read by its own projection (the one the work profile screen reads), because its one line on the hub
  // names its skills and area as well as its state (owner's phone, 8 Oct 2026).
  const load = useCallback(async () => {
    const [identity, worker] = await Promise.all([ownProfileClientService.read(accountId ?? '', 'narucilac'), izvor.mojRadnikProfil()]);
    const capability: WorkCapability | null = worker ? { accountId: accountId ?? '', profileId: worker.id, kind: 'WORKER', ime: worker.ime.trim() || null,
      grad: worker.grad.trim() || null, stanje: worker.stanje, vestine: worker.vestine, radijusKm: worker.radijusKm } : null;
    return { identity: identity ?? capability, capability };
  }, [accountId, izvor]);
  const profile = useFocusedResource(load);
  const words = hubWords(useHubStates(STATE_ROWS));
  const actionScope = useRef<ActionScope | null>(null);
  const [renderedScope, setRenderedScope] = useState<ActionScope | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  // "Kako te drugi vide" (Airbnb's standard): the person's own public profile, as a sheet over this screen. Opened only by an explicit
  // press and retired with the focus and the account, like every sheet of a read that can arrive late.
  const [publicView, setPublicView] = useState<PublicProfileState>(null);
  const publicRequest = useRef(0);
  useEffect(() => { publicRequest.current++; setPublicView(null); }, [accountId, accountRevision]);

  useFocusEffect(useCallback(() => {
    const scope: ActionScope | null = accountId ? { accountId, accountRevision, busy: false } : null;
    actionScope.current = scope;
    setRenderedScope(scope);
    setBusy(false);
    setLogoutError(false);
    return () => { if (actionScope.current === scope) actionScope.current = null; publicRequest.current++; setPublicView(null); };
  }, [accountId, accountRevision]));

  function isCurrent(scope: ActionScope) {
    return actionScope.current === scope && sesijaSada().user?.id === scope.accountId &&
      sesijaSada().accountRevision === scope.accountRevision;
  }

  function beginAction() {
    // A retained callback belongs to the visit that rendered it, never a later account or focus.
    const scope = renderedScope;
    if (!scope || scope.busy || !isCurrent(scope)) return null;
    scope.busy = true;
    setBusy(true);
    return scope;
  }

  function navigate(action: () => void) {
    if (!beginAction()) return;
    action();
  }

  async function logout() {
    const scope = beginAction();
    if (!scope) return;
    setLogoutError(false);
    try {
      await authClientService.signOutLocal({ accountId: scope.accountId, accountRevision: scope.accountRevision });
    } catch {
      if (isCurrent(scope)) setLogoutError(true);
    } finally {
      // A late response must not change a new account or focused screen.
      if (isCurrent(scope)) {
        scope.busy = false;
        setBusy(false);
      }
    }
  }

  const identity = profile.data?.identity ?? null, capability: WorkCapability | null = profile.data?.capability ?? null;
  // The row says the state, the skills and the area, and nothing else: while the read runs or failed there is nothing true to say yet.
  const capabilityDetail = !profile.data ? undefined : workProfileSummary(capability);
  const photoReady = !!identity?.profileId && !profile.loading && !profile.error;
  const openPhoto = () => { const id = identity?.profileId; if (!id || profile.loading || profile.error) return;
    navigate(() => router.push({ pathname: '/profil/fotografija', params: { profileId: id } })); };
  // Sentences that mean something lead to the place (T4a, 2026-10-07): the rating line to "Ocene", "Završeni Dogovori" to the
  // Dogovori, on the section that holds the finished ones ("istorija"; the Dogovori screen takes it as `odeljak`).
  const openRatings = () => navigate(() => router.navigate('/profil/ocene'));
  const openFinished = () => navigate(() => router.navigate({ pathname: '/dogovori', params: { odeljak: 'istorija' } }));
  // The one Avatar at its header size, with the one way to take letters from a name; no name draws a person.
  const avatar = <Avatar initials={inicijali(identity?.ime)} size={PROFILE_AVATAR} />;
  // A city is shown as a city is written: typed as "NovI SAD" or "Novi sad" it reads "Novi Sad" here. Display only; the profile keeps what was typed.
  const city = identity?.grad?.trim() || capability?.grad?.trim();
  // Others read the person as the one who helps (the work profile) once it is active, and as the one who asks otherwise.
  const publicProfileId = (capability?.stanje === 'ACTIVE' ? capability.profileId : null) ?? identity?.profileId ?? null;
  function openPublicProfile() {
    const scope = renderedScope, profileId = publicProfileId;
    if (!scope || scope.busy || !isCurrent(scope) || !profileId || publicView?.loading) return;
    const request = ++publicRequest.current;
    setPublicView({ loading: true, data: null });
    const settle = (data: JavniProfilProjekcija | null) => {
      if (request === publicRequest.current && isCurrent(scope)) setPublicView({ loading: false, data });
    };
    void publicProfileClientService.javniProfil(profileId)
      .then(value => settle(value?.profilId === profileId ? value : null)).catch(() => settle(null));
  }
  const closePublicProfile = () => { publicRequest.current++; setPublicView(null); };
  const hubIdentity: ProfileHubIdentity = profile.loading ? { state: 'loading' }
    : profile.error ? { state: 'error', retry: () => { void profile.refresh(); } }
      : { state: 'ready', name: identity?.ime || null,
        // The place under the name is the one the account really has: the requester row's city, or else the work area's.
        // Nothing in the app sets the requester's city, so "Grad još nije unet" invited an action that did not exist.
        place: city ? cityLabel(city) : null,
        photo: identity?.profileId ? <ProfilePhoto profileId={identity.profileId} size={PROFILE_AVATAR} fallback={avatar} own /> : avatar,
        // The rating line is a way in: it opens "Ocene" (what the person received and gave, and with D12 the comments about them).
        photoReady, openPhoto, reputation: accountId
          ? <AccountReputation accountId={accountId} onOpen={openRatings} /> : null };

  // Something waits for the person when the work profile is not set up or is still a draft: the row says so with its dot (and says nothing while it reads).
  const capabilityNeedsAttention = !!profile.data && (!capability || capability.stanje === 'DRAFT');
  return <ProfileHub identity={hubIdentity} capabilityDetail={capabilityDetail} capabilityNeedsAttention={capabilityNeedsAttention}
    busy={busy} email={user?.email ?? null} words={words} version={versionWord(readBuildIdentity().version)}
    workSummary={hubIdentity.state === 'ready' ? <ProfileWorkSummary
      requesterProfileId={identity?.kind === 'REQUESTER' ? identity.profileId : null}
      workerProfileId={capability?.profileId ?? null} onOpen={openFinished} /> : undefined}
    // The reliability counts work, so it exists only for an account that has a work profile (and shows itself only with a percentage).
    stats={hubIdentity.state === 'ready' && capability?.profileId ? <ProfileStats /> : undefined}
    onViewPublic={hubIdentity.state === 'ready' && publicProfileId ? openPublicProfile : undefined}
    sheet={publicView ? <PublicProfileSheet state={publicView} onClose={closePublicProfile} onRetry={openPublicProfile}
      photo={(profileId, size) => <ProfilePhoto profileId={profileId} size={size} initial={identity?.ime} own />} /> : undefined}
    open={(path: ProfileHubPath) => navigate(() => router.navigate(path))}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/'))}
    onLogout={() => { void logout(); }} logoutError={logoutError} />;
}
