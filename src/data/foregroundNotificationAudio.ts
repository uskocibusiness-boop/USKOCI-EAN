import AsyncStorage from '@react-native-async-storage/async-storage';

export type ForegroundAudioSettings = { messageSounds: boolean; notificationSounds: boolean };
export type ForegroundAudioSnapshot = Readonly<ForegroundAudioSettings & {
  confirmed: boolean; pending: boolean; error: boolean;
}>;
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
const KEY = 'uskoci.foreground-notification-audio.v1';
const DEFAULTS: ForegroundAudioSettings = { messageSounds: true, notificationSounds: true };

function decode(value: string | null): ForegroundAudioSettings {
  if (value === null) return { ...DEFAULTS };
  const data: unknown = JSON.parse(value);
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || Object.keys(data).length !== 2
    || typeof (data as ForegroundAudioSettings).messageSounds !== 'boolean'
    || typeof (data as ForegroundAudioSettings).notificationSounds !== 'boolean') throw Error('AUDIO_SETTINGS_INVALID');
  return data as ForegroundAudioSettings;
}

/** Device preferences only. They never change server delivery, Android channels,
 * volume, DND or consent. An unknown local write is recovered by reading, not by
 * replaying the write. No sound is permitted while persistence is unconfirmed. */
export function createForegroundAudioStore(storage: Storage, timeoutMs = 3000) {
  let snapshot: ForegroundAudioSnapshot = Object.freeze({ ...DEFAULTS, confirmed: false, pending: false, error: false });
  let operation: Promise<void> | null = null;
  let unsettledWrite: Promise<unknown> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: ForegroundAudioSnapshot) => {
    snapshot = Object.freeze(next); for (const listener of listeners) listener();
  };
  const bounded = async <T,>(promise: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error('AUDIO_SETTINGS_TIMEOUT')), timeoutMs);
    })]); } finally { if (timer !== undefined) clearTimeout(timer); }
  };
  const run = (write?: ForegroundAudioSettings): Promise<void> => {
    if (operation) return operation;
    publish({ ...snapshot, pending: true, error: false });
    // Start after assigning operation: even a synchronously throwing native
    // adapter must clear this flight and leave read-only recovery usable.
    operation = Promise.resolve().then(async () => {
      try {
        // A timed-out bridge write can still finish later. Until it settles,
        // no read may certify an older value and enable a competing write.
        if (unsettledWrite) await bounded(unsettledWrite);
        if (write) {
          const pending = storage.setItem(KEY, JSON.stringify(write));
          unsettledWrite = pending;
          void pending.then(() => { if (unsettledWrite === pending) unsettledWrite = null; },
            () => { if (unsettledWrite === pending) unsettledWrite = null; });
          await bounded(pending);
        }
        const stored = decode(await bounded(storage.getItem(KEY)));
        if (write && (stored.messageSounds !== write.messageSounds || stored.notificationSounds !== write.notificationSounds))
          throw Error('AUDIO_SETTINGS_UNCONFIRMED');
        publish({ ...stored, confirmed: true, pending: false, error: false });
      } catch {
        publish({ ...snapshot, confirmed: false, pending: false, error: true });
      } finally { operation = null; }
    });
    return operation;
  };
  return {
    snapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load: () => snapshot.confirmed && !snapshot.error ? Promise.resolve() : run(),
    refresh: () => run(),
    save: (value: ForegroundAudioSettings) => {
      // A competing UI action must not be silently interpreted as the first write.
      if (operation || !snapshot.confirmed) return Promise.resolve();
      return run({ messageSounds: value.messageSounds === true, notificationSounds: value.notificationSounds === true });
    },
  };
}

export const foregroundNotificationAudio = createForegroundAudioStore(AsyncStorage);
