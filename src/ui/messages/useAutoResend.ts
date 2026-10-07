import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { OutboxEntry } from '../../data/agreementOutbox';
import { takeAutoResend } from './threadModel';

/**
 * The three moments a message whose send was lost to the network is tried once more by itself (team T3c, 2026-10-07):
 *
 *   1. the conversation opens with such a message waiting (this is also how a return from the background arrives: the route
 *      leaves the thread for a fresh read and mounts it again), once the thread has been read and may send;
 *   2. the app comes back to the foreground while the thread is open;
 *   3. a read that was failing works again (the closest thing to "the connection is back" that does not need a new package).
 *
 * Never on a timer and never at the moment of the failure, when the connection is surely still down. What is tried, and the
 * rule that each message is tried once, are `takeAutoResend`'s; the retry itself is the caller's `resend`, which is the outbox's
 * own `retry(clientMessageId)` (the same retained command, the same client message id), so the server can only ever answer with the
 * message it already holds. `enabled` is false for a closed Dogovor, a Dogovor that does not take messages, an outbox that is not
 * ready and a thread that has not been read.
 */
export function useAutoResend({ entries, enabled, broken, resend }: {
  entries: readonly OutboxEntry[]; enabled: boolean;
  /** A read of the thread is failing now (the first read, a refresh or a history page). */
  broken: boolean;
  resend: (entry: OutboxEntry) => void;
}) {
  const latest = useRef({ entries, enabled, resend });
  latest.current = { entries, enabled, resend };
  const run = useCallback(() => {
    const now = latest.current;
    if (!now.enabled) return;
    for (const entry of takeAutoResend(now.entries)) now.resend(entry);
  }, []);

  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !enabled) return;
    opened.current = true;
    run();
  }, [enabled, run]);

  useEffect(() => {
    let last = AppState.currentState ?? 'active';
    const subscription = AppState.addEventListener('change', state => {
      // Android repeats "active" around permission dialogs without ever leaving the foreground: that is not a return.
      const returned = state === 'active' && last !== 'active';
      last = state;
      if (returned) run();
    });
    return () => subscription.remove();
  }, [run]);

  const wasBroken = useRef(false);
  useEffect(() => {
    if (broken) { wasBroken.current = true; return; }
    if (!wasBroken.current) return;
    wasBroken.current = false;
    run();
  }, [broken, run]);
}
