import type { Notification, NotificationBehavior } from 'expo-notifications';
import type { ForegroundAudioSnapshot } from '../../data/foregroundNotificationAudio';
import { isPublicInboxNotification } from './publicInboxCopy';
import { publicPushTarget } from './pushTarget';

const SILENT: NotificationBehavior = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
const MAX_SEEN = 1024;
const BURST_GAP_MS = 800;

/** One native foreground alert owner. Realtime invalidations and history reads
 * never call this function: neither proves that a new incoming message exists.
 * Business event identity suppresses retries with different Expo transport IDs.
 * Legacy generic pushes only have transport-level dedupe, explicitly bounded to
 * this mounted runtime; backend ledger and OS background delivery remain separate. */
export function createForegroundAlertPolicy(clock: () => number = Date.now) {
  const seen = new Set<string>();
  let lastSoundAt: number | null = null;
  return (notification: Notification, eligible: boolean, settings: ForegroundAudioSnapshot): NotificationBehavior => {
    if (!eligible || !isPublicInboxNotification(notification)) return { ...SILENT };
    const target = publicPushTarget(notification.request.content.data)!;
    const key = target.kind === 'INBOX' ? `transport:${notification.request.identifier}` : `event:${target.eventId}`;
    if (seen.has(key)) return { ...SILENT };
    seen.add(key);
    if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value!);
    const message = target.kind === 'MESSAGE_EVENT'
      || notification.request.content.title === 'Nova poruka u Dogovoru';
    const now = clock();
    // Date.now is the wall clock: correcting the device time must not
    // leave every new event silent until the former clock catches up.
    if (lastSoundAt !== null && now < lastSoundAt) lastSoundAt = null;
    const permitted = settings.confirmed && !settings.pending && !settings.error
      && (message ? settings.messageSounds : settings.notificationSounds);
    // A deliberately silent push stays silent. Use native notification playback,
    // never a media player or separate vibration that can bypass the OS channel.
    const sound = permitted && notification.request.content.sound === 'default'
      && (lastSoundAt === null || now - lastSoundAt >= BURST_GAP_MS);
    if (sound) lastSoundAt = now;
    return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: sound, shouldSetBadge: false };
  };
}
