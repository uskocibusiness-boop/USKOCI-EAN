import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { WorkerAvailability } from '../contracts/workerAvailability';
import { workerAvailabilityClientService } from '../data/workerAvailabilityClientService';
import { sesijaSada, useSesija } from '../store/sesija';

export type WorkerAvailabilityView = { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; value: WorkerAvailability };

/** The saved profile reads the existing owned receipt; no AI turn or profile write.
 * A prior account, profile, focus or background read cannot supply displayed hours. */
export function useWorkerAvailability(profileId: string | null, profileRead = 0) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const key = `${accountId}:${accountRevision}:${profileId}:${profileRead}`;
  const [state, setState] = useState<{ key: string; view: WorkerAvailabilityView }>({ key, view: { kind: 'loading' } });
  const refreshRef = useRef<() => void>(() => undefined);
  useFocusEffect(useCallback(() => {
    let alive = true, request = 0;
    const owned = () => alive && !!accountId && sesijaSada().user?.id === accountId
      && sesijaSada().accountRevision === accountRevision;
    const read = () => {
      const turn = ++request;
      setState({ key, view: { kind: 'loading' } });
      if (!owned() || !profileId || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      void workerAvailabilityClientService.read().then(result => {
        if (!owned() || turn !== request) return;
        setState({ key, view: result.ok && result.podatak.accountId === accountId && result.podatak.profileId === profileId
          ? { kind: 'ready', value: result.podatak } : { kind: 'unavailable' } });
      }).catch(() => { if (owned() && turn === request) setState({ key, view: { kind: 'unavailable' } }); });
    };
    refreshRef.current = read;
    read();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') read();
      else { request++; setState({ key, view: { kind: 'loading' } }); }
    });
    return () => {
      alive = false; request++; refreshRef.current = () => undefined; subscription.remove();
      setState({ key, view: { kind: 'loading' } });
    };
  }, [accountId, accountRevision, profileId, profileRead, key]));
  return { view: state.key === key ? state.view : { kind: 'loading' } as WorkerAvailabilityView,
    refresh: useCallback(() => refreshRef.current(), []) };
}
