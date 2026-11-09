import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { readBuildIdentity } from '../../../data/buildIdentity';
import { hubWords, versionWord } from '../../../ui/profile/hubStates';
import { useHubStates, type HubStateKey } from '../../../ui/profile/useHubStates';
import type { ProfileHubPath } from '../../../ui/profile/ProfileHubPresentation';
import { AccountSettings } from '../../../ui/settings/AccountSettingsPresentation';

const STATE_ROWS: readonly HubStateKey[] = ['support', 'legal'];
type Visit = { accountId: string; revision: number; busy: boolean };

/** Separate settings destination, with the same account/focus/single-flight protection as the profile. */
export default function Podesavanja() {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const current = useRef<Visit | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);
  const words = hubWords(useHubStates(STATE_ROWS));
  useFocusEffect(useCallback(() => {
    const scope = accountId ? { accountId, revision: accountRevision, busy: false } : null;
    current.current = scope; setVisit(scope); setBusy(false);
    return () => { if (current.current === scope) current.current = null; };
  }, [accountId, accountRevision]));
  const owns = (scope: Visit) => current.current === scope && sesijaSada().user?.id === scope.accountId
    && sesijaSada().accountRevision === scope.revision;
  const begin = () => {
    if (!visit || visit.busy || !owns(visit)) return null;
    visit.busy = true; setBusy(true); return visit;
  };
  const navigate = (action: () => void) => { if (begin()) action(); };
  return <AccountSettings busy={busy} words={words}
    version={versionWord(readBuildIdentity().version)}
    open={(path: ProfileHubPath) => navigate(() => router.navigate(path))}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))} />;
}
