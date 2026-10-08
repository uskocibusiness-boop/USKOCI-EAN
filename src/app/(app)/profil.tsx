import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { sesijaSada, useSesija } from '../../store/sesija';
import { authClientService } from '../../data/authClientService';
import { ownProfileClientService } from '../../data/ownProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { AccountReputation } from '../../ui/reviews/AccountReputation';
import { ProfilePhoto } from '../../ui/media/ContextPhotos';
import { ProfileStats } from '../../ui/profile/ProfileStats';
import { ProfileWorkSummary } from '../../ui/profile/ProfileWorkSummary';
import { Avatar } from '../../ui/system/Avatar';
import { inicijali } from '../../lib/inicijali';
import { tidyPlaceLabel } from '../../ui/location/placeText';
import { PROFILE_AVATAR, ProfileHub, type ProfileHubIdentity, type ProfileHubPath } from '../../ui/profile/ProfileHubPresentation';

type ActionScope = { accountId: string; accountRevision: number; busy: boolean };

export default function Profil() {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  // One account has one identity and, beside it, how it can help (owner decision 1, 2026-09-19).
  // The hub used to be two hubs chosen by a global mode, with a switch between them. It now reads
  // both of the account's own profile rows: the one tasks are published under carries the name and
  // the photo, the other says whether tasks can be offered to this person at all.
  const load = useCallback(async () => {
    const [identity, capability] = await Promise.all([
      ownProfileClientService.read(accountId ?? '', 'narucilac'), ownProfileClientService.read(accountId ?? '', 'uskocer')]);
    return { identity: identity ?? capability, capability };
  }, [accountId]);
  const profile = useFocusedResource(load);
  const actionScope = useRef<ActionScope | null>(null);
  const [renderedScope, setRenderedScope] = useState<ActionScope | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  useFocusEffect(useCallback(() => {
    const scope: ActionScope | null = accountId ? { accountId, accountRevision, busy: false } : null;
    actionScope.current = scope;
    setRenderedScope(scope);
    setBusy(false);
    setLogoutError(false);
    return () => { if (actionScope.current === scope) actionScope.current = null; };
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

  const identity = profile.data?.identity ?? null, capability = profile.data?.capability ?? null;
  // The row says the state, and only the state: while the read runs or failed there is nothing true to say yet.
  const capabilityDetail = !profile.data ? undefined
    // No grammatical gender (one voice, 2026-09-23): "nisi podesio" spoke to a man only.
    : !capability ? 'Radni profil još nije podešen. Bez njega ne možeš da se prijaviš na zadatak.'
      : capability.stanje === 'DRAFT' ? 'Profil je nacrt — dok je nacrt, zadaci ti se ne nude.'
        : capability.stanje === 'SUSPENDED' ? 'Radni profil je suspendovan. Obrati se podršci.'
          // Only a state the read really returned is said: a status the app does not know (a closed profile, a new value)
          // reads as nothing rather than as "active" (review of step 9, 2026-09-24).
          : capability.stanje === 'ACTIVE' ? 'Profil je aktivan.' : undefined;
  const photoReady = !!identity?.profileId && !profile.loading && !profile.error;
  const openPhoto = () => { const id = identity?.profileId; if (!id || profile.loading || profile.error) return;
    navigate(() => router.push({ pathname: '/profil/fotografija', params: { profileId: id } })); };
  // Sentences that mean something lead to the place (T4a, 2026-10-07): the rating line to "Ocene", "Završeni Dogovori" to the
  // Dogovori, on the section that holds the finished ones ("istorija"; the Dogovori screen takes it as `odeljak`).
  const openRatings = () => navigate(() => router.navigate('/profil/ocene'));
  const openFinished = () => navigate(() => router.navigate({ pathname: '/dogovori', params: { odeljak: 'istorija' } }));
  // The one Avatar at its header size, with the one way to take letters from a name; no name draws a person.
  const avatar = <Avatar initials={inicijali(identity?.ime)} size={PROFILE_AVATAR} />;
  // A city is shown as a city is written: typed as "NovI SAD" it reads "Novi Sad" here. Display only; the profile keeps what was typed.
  const city = identity?.grad?.trim() || capability?.grad?.trim();
  const hubIdentity: ProfileHubIdentity = profile.loading ? { state: 'loading' }
    : profile.error ? { state: 'error', retry: () => { void profile.refresh(); } }
      : { state: 'ready', name: identity?.ime || null,
        // The place under the name is the one the account really has: the requester row's city, or else the work area's.
        // Nothing in the app sets the requester's city, so "Grad još nije unet" invited an action that did not exist.
        place: city ? tidyPlaceLabel(city) : null,
        photo: identity?.profileId ? <ProfilePhoto profileId={identity.profileId} size={PROFILE_AVATAR} fallback={avatar} /> : avatar,
        // The rating line is a way in: it opens "Ocene" (what the person received and gave, and with D12 the comments about them).
        photoReady, openPhoto, reputation: accountId
          ? <AccountReputation accountId={accountId} onOpen={openRatings} /> : null };

  // A work profile without an area says so, as the worker screen does; without a work profile the row has nothing to say.
  const workCity = capability?.grad?.trim();
  const workArea = workCity ? tidyPlaceLabel(workCity) : (capability ? 'Nije podešeno' : undefined);
  // Something waits for the person when the work profile is not set up or is still a draft: the row says so with its dot (and says nothing while it reads).
  const capabilityNeedsAttention = !!profile.data && (!capability || capability.stanje === 'DRAFT');
  return <ProfileHub identity={hubIdentity} capabilityDetail={capabilityDetail} capabilityNeedsAttention={capabilityNeedsAttention} workArea={workArea}
    busy={busy} email={user?.email ?? null}
    workSummary={hubIdentity.state === 'ready' ? <ProfileWorkSummary
      requesterProfileId={identity?.kind === 'REQUESTER' ? identity.profileId : null}
      workerProfileId={capability?.profileId ?? null} onOpen={openFinished} /> : undefined}
    // "Moja statistika" counts work, so it exists only for an account that has a work profile.
    stats={hubIdentity.state === 'ready' && capability?.profileId ? <ProfileStats /> : undefined}
    open={(path: ProfileHubPath) => navigate(() => router.navigate(path))}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/'))}
    onLogout={() => { void logout(); }} logoutError={logoutError} />;
}
