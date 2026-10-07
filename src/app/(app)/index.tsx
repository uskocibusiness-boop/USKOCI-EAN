import { useCallback, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../../ui/system/ScreenHeader';
import { ActualUserAvatar } from '../../ui/system/ActualUserAvatar';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { composeHome, readHomeSection, type HomeAttentionPreview, type HomeReads, type HomeSection, type HomeTarget } from '../../data/homeSnapshot';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { HomePresentation } from '../../ui/home/HomePresentation';
import { ProfilePhoto } from '../../ui/media/ContextPhotos';

/**
 * Početna: the root of the one shell (owner decision 1, 2026-09-19). This route used to be a
 * redirect that read a global mode and sent the person to Zadaci or to Prijave. It now answers
 * "what waits for me" from the account-owned server aggregate, shows the next Dogovor, counts my own
 * tasks and my applications from the reads it already makes, and offers the two things a person can
 * start. It reads no mode and sets none.
 */
export default function Pocetna() {
  const { user, accountRevision } = useSesija();
  return <Home key={`${user?.id ?? ''}:${accountRevision}`} />;
}
function Home() {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const retrying = useRef<object | null>(null);
  const [scope, setScope] = useState<object | null>(null);
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false; retrying.current = null;
    // A silent refresh keeps the old snapshot without an immediate render. Publish
    // this focus token now so current actions do not wait for a network response;
    // callbacks retained from a previous focus still fail the identity check below.
    setScope(owner);
    return () => { if (focus.current === owner) focus.current = null; };
  }, []));
  const load = useCallback(async (signal: AbortSignal): Promise<HomeReads & { attention: HomeSection<HomeAttentionPreview> }> => {
    const retry = retrying.current;
    // Background/blur retires the resource read before these section promises may
    // settle. Its retry must retire too, without unlocking a newer retry.
    const retireRetry = () => { if (retrying.current === retry) retrying.current = null; };
    signal.addEventListener('abort', retireRetry, { once: true });
    try {
      const [needs, applications, agreements, attention] = await Promise.all([
        readHomeSection(() => source.mojePotrebe({ includeUrgency: false })), readHomeSection(() => source.mojePrijave()), readHomeSection(() => source.mojiDogovori()),
        readHomeSection(() => source.paznjaZaPocetnu())]);
      // Every failed read is unavailable, never an account with nothing in it.
      if ([needs, applications, agreements, attention].every(part => part.kind === 'unavailable')) throw new Error('HOME_READ_FAILED');
      return { needs, applications, agreements, attention };
    } finally { signal.removeEventListener('abort', retireRetry); }
  }, [source]);
  const resource = useFocusedResource(load);
  const home = useMemo(() => resource.data ? composeHome(resource.data, resource.data.attention) : null, [resource.data]);
  const current = () => !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => { if (current() && !navigating.current) { navigating.current = true; action(); } };
  const open = (target: HomeTarget) => navigate(() => {
    if (target.kind === 'NEED') router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: target.needId } });
    else if (target.kind === 'CANDIDATES') router.navigate({ pathname: '/potrebe/[id]/kandidati', params: { id: target.needId } });
    else if (target.kind === 'AGREEMENT') router.navigate({ pathname: '/dogovor/[id]', params: { id: target.agreementId } });
    else router.navigate({ pathname: '/moje-prijave', params: { prijavaId: target.applicationId } });
  });
  // My own tasks and my applications are reached from here, as two front doors; "Moje aktivnosti" is no longer a
  // destination (2026-09-23). Every press keeps the focus, account and foreground guards above.
  const onProfile = () => navigate(() => router.navigate('/profil'));
  return <HomePresentation header={<ScreenHeader title="Početna" onProfile={onProfile} profileEntry={<ActualUserAvatar onPress={onProfile} />} />} home={home} loading={resource.loading} refreshing={resource.refreshing} error={!!resource.error}
    onPublish={() => navigate(() => router.navigate('/nova'))} onEarn={() => navigate(() => router.navigate('/zadaci'))}
    onProfile={onProfile} onOpen={open}
    // One completed Dogovor waiting for my rating, named by the Dogovori read: its rating opens in one tap (critique A1,
    // 2026-09-24), exactly as the Dogovor screen opens it. Several, or none known: Dogovori, where each one waits.
    // `from` tells the rating where Back returns, so its button says "Nazad na Početnu" and not "Nazad na Dogovor".
    onRatings={agreementId => navigate(() => agreementId
      ? router.navigate({ pathname: '/oceni-dogovor', params: { agreementId, from: 'pocetna' } }) : router.navigate('/dogovori'))}
    onMyTasks={() => navigate(() => router.navigate('/potrebe'))}
    onMyApplications={() => navigate(() => router.navigate('/moje-prijave'))}
    // Raspored: "Ceo raspored" opens the planner; the face of the other person in its block is read by the route's own
    // photo element (a data client), as the header's avatar is, so the presentation and its gallery load none.
    onPlanner={() => navigate(() => router.navigate('/raspored'))}
    photo={(profileId, standIn) => <ProfilePhoto profileId={profileId} size={32} fallback={standIn} />}
    onRefresh={() => {
      if (!current() || resource.loading || retrying.current) return;
      const retry = {}; retrying.current = retry;
      void resource.refresh(true).finally(() => { if (retrying.current === retry) retrying.current = null; });
    }} />;
}
