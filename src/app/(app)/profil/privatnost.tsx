import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { retentionPolicyClientService } from '../../../data/retentionPolicyClientService';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { SettingsRow, SettingsScreen } from '../../../ui/settings/SettingsPresentation';
import { ClosureEntry } from '../../../ui/closure/ClosureDialog';
import { PrivacyBody } from '../../../ui/privacy/PrivacyPresentation';

export default function Privatnost() {
  const { user, accountRevision } = useSesija();
  return <OwnedPrivacy key={`${user?.id ?? ''}:${accountRevision}`} />;
}

function OwnedPrivacy() {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [visit, setVisit] = useState<object | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; navigating.current = false; setVisit(scope); setExpandedRule(null);
    return () => { if (focus.current === scope) focus.current = null; };
  }, [accountId, accountRevision]));
  const readPolicy = useCallback(async () => {
    const result = await retentionPolicyClientService.readStatus();
    if (!result.ok) throw new Error('RETENTION_READ_UNAVAILABLE');
    return result.podatak;
  }, []);
  const readExecution = useCallback(async () => {
    const result = await retentionPolicyClientService.readExecutionStatus();
    if (!result.ok) throw new Error('RETENTION_EXECUTION_UNAVAILABLE');
    return result.podatak;
  }, []);
  // A re-read the person asks for ("Osveži stanje") keeps the published rules on screen under the refresh at work, and says so
  // if it fails; the skeleton is only for the first read.
  const policy = useFocusedResource(readPolicy, { retainOnRefresh: true }), execution = useFocusedResource(readExecution, { retainOnRefresh: true });
  const admitted = policy.data?.ready === true && execution.data?.executionAdmitted === true
    && execution.data.policyVersion === policy.data.policyVersion;
  // A focus event must render its own callbacks even if both reads have settled
  // and closing an already-collapsed rule produces no state change.
  const current = () => visit !== null && focus.current === visit && !navigating.current && !!accountId
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const navigate = (action: () => void) => { if (!current()) return; navigating.current = true; action(); };
  const refresh = () => { if (!current() || policy.loading || execution.loading || policy.refreshing || execution.refreshing) return;
    void policy.refresh(); void execution.refresh(); };
  return <SettingsScreen title="Privatnost i podaci"
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}>
    <PrivacyBody policy={policy} execution={execution} admitted={admitted} expandedRule={expandedRule}
      onToggle={(key, next) => { if (current()) setExpandedRule(next ? key : null); }} onRefresh={refresh}
      dataRows={<>
        <SettingsRow compact label="Izvoz podataka" detail="Pogledaj zahtev, pripremu i dostupnost svoje kopije."
          onPress={() => navigate(() => router.navigate('/profil/izvoz'))} />
        {/* The closure flow opens over this screen, so it is fenced like a navigation but does not retire the screen. */}
        <ClosureEntry canOpen={current} />
      </>} />
  </SettingsScreen>;
}
