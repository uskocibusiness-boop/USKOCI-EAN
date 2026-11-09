import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { applicationServiceAccountCurrent, applicationServiceClientService,
  type ApplicationServiceIntent, type ApplicationServiceResult } from '../../data/applicationServiceClientService';
import { T } from '../Text';
import { Section } from '../system/Section';
import { V2Action } from '../v2/V2Action';

/** One opt-in for the service of the submitted application. Preparing the signed
 * document is internal; reopening/checking never restores consent or retries Save. */
export function ApplicationServiceOffer({ input, openProfile }: {
  input: ApplicationServiceIntent; openProfile: () => void;
}) {
  const owner = useMemo(() => ({ input: { ...input }, focused: false, generation: 0, busy: false, explicitAddition: false,
    checkOnIdle: false, cancelWait: null as (() => void) | null }),
    [input.accountId, input.accountRevision, input.applicationId, input.needId, input.profileId]);
  const [value, setValue] = useState<ApplicationServiceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyPresent, setAlreadyPresent] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const mounted = useRef(false);
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const current = (generation: number) => activeOwner.current === owner && mounted.current && owner.focused && owner.generation === generation
    && applicationServiceAccountCurrent(owner.input);

  const act = async (add: boolean) => {
    const generation = owner.generation;
    if (!current(generation)) return;
    // A fast blur/focus can happen before an old read or Save settles. Queue one
    // read-only check, but never release the real in-flight writer or replay consent.
    if (owner.busy) { if (!add) owner.checkOnIdle = true; return; }
    // Presentation only: a later read-only check can still confirm this click.
    // It never grants permission to prepare or save again.
    if (add) owner.explicitAddition = true;
    owner.checkOnIdle = false;
    owner.busy = true; setBusy(true); setUncertain(true); setError(null);
    try {
      let result = await applicationServiceClientService.read(owner.input, add);
      if (!current(generation)) return;
      // This click authorizes only the known service of this owned application.
      // The server prepares it without AI; there is no second user confirmation.
      if (add && result.ok && result.podatak.state === 'READY') {
        const saved = await applicationServiceClientService.save(owner.input, result.podatak);
        if (!current(generation)) return;
        if (!saved.ok) { setError(saved.poruka); return; }
        result = await applicationServiceClientService.read(owner.input);
      }
      // Observe the existing background binder briefly. These reads cannot save,
      // submit another application or repeat a model request after a lost reply.
      for (let attempt = 0; attempt < 4 && result.ok && result.podatak.state === 'SAVED'; attempt++) {
        if (!current(generation)) return;
        await new Promise<void>(resolve => {
          const finish = () => {
            clearTimeout(timer);
            if (owner.cancelWait === finish) owner.cancelWait = null;
            resolve();
          };
          const timer = setTimeout(finish, 1200);
          owner.cancelWait = finish;
        });
        if (!current(generation)) return;
        result = await applicationServiceClientService.read(owner.input);
      }
      if (!current(generation)) return;
      if (result.ok) {
        setValue(result.podatak); setAlreadyPresent(false); setNeedsProfile(false); setUncertain(false);
      }
      else if (result.kod === 'APPLICATION_SERVICE_ALREADY_PRESENT') {
        setValue(null); setAlreadyPresent(true); setNeedsProfile(false); setUncertain(false);
      } else {
        setError(result.poruka); setAlreadyPresent(false); setUncertain(true);
        setNeedsProfile(['APPLICATION_SERVICE_PROFILE_DRAFT_OPEN', 'APPLICATION_SERVICE_DRAFT_CHANGED',
          'APPLICATION_SERVICE_PROFILE_REVIEW_REQUIRED', 'APPLICATION_SERVICE_AREA_REQUIRED',
          'APPLICATION_SERVICE_LIMIT', 'APPLICATION_SERVICE_TASK_CHANGED', 'WORKER_PROFILE_RESTRICTED'].includes(result.kod));
      }
    } catch {
      if (current(generation)) { setError('Trenutno ne možemo da potvrdimo dodavanje. Pokušajte ponovo.'); setUncertain(true); }
    } finally {
      owner.busy = false;
      if (current(owner.generation)) {
        if (owner.checkOnIdle) { owner.checkOnIdle = false; void act(false); }
        else setBusy(false);
      }
    }
  };
  useFocusEffect(useCallback(() => {
    mounted.current = true; owner.focused = true; owner.generation++;
    setUncertain(true);
    // The same response ID locates a prepared/saved result after cold start.
    void act(false);
    return () => {
      owner.focused = false; owner.generation++; mounted.current = false;
      owner.checkOnIdle = false;
      // Clearing a timer alone strands its awaited Promise and owner.busy forever.
      // Settle the local wait after invalidating this focus; it cannot send a write.
      owner.cancelWait?.();
    };
    // Owner identity, not a render or state update, opens this read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]));

  const prepared = value && value.state !== 'NONE' ? value : null;
  const confirmed = !uncertain && (alreadyPresent || prepared?.state === 'CONFIRMED');
  const saved = prepared?.state === 'SAVED';
  const changed = !uncertain && prepared?.state === 'CHANGED';
  const profileHelp = needsProfile || changed;
  if (!uncertain && alreadyPresent && !owner.explicitAddition) return null;
  return <Section>
    <View style={styles.body} testID="application-service-offer">
      <T variant="bodyStrong" accessibilityLiveRegion="polite">{confirmed
        ? alreadyPresent ? 'Ova usluga je već u Vašem profilu.' : 'Dodato u radni profil.'
        : saved && !uncertain ? 'Dodavanje je u toku.' : 'Dodajte ovu vrstu zadatka u radni profil.'}</T>
      {!confirmed && !profileHelp ? <V2Action compact loading={busy} error={error}
        label={error ? 'Pokušajte ponovo' : saved ? 'Osvežite' : 'Dodajte'}
        onPress={() => void act(!uncertain && !saved)} /> : null}
      {profileHelp ? <V2Action compact kind="quiet" label="Otvorite radni profil" error={error ?? 'Profil je u međuvremenu izmenjen.'} onPress={() => {
        if (current(owner.generation) && !owner.busy) openProfile();
      }} disabled={busy} /> : null}
    </View>
  </Section>;
}
const styles = StyleSheet.create({ body: { gap: 12 } });
