import { permissionAsk } from './permissionAsk';

/**
 * Notifications: the question that comes after the first published task or the first application, never at entry
 * (design proposal N; owner 2026-10-02 turned push on, and the push work itself comes last). This is the helper that moment will
 * call, and nothing calls it yet: it is NOT wired to a screen and does not touch `expo-notifications`, Firebase or the push
 * runtime. The system is reached only through the port the caller supplies, so the rule can be proven without any of them.
 */
export type NotificationPermissionPort = {
  /** The current state, read without asking. */
  read(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  /** The system's own window. Called only after the person said "Dozvoli". */
  request(): Promise<{ granted: boolean }>;
};

/**
 * `granted`: already allowed, or allowed now. `denied`: the system's window was answered "no". `blocked`: the system will not ask
 * again (the phone settings are the only way, and the caller's recovery says so). `later`: the person said "Ne sada" to the
 * question, and the system was not asked. `unavailable`: the state could not be read or the window failed; nothing is claimed.
 */
export type NotificationAskResult = 'granted' | 'denied' | 'blocked' | 'later' | 'unavailable';

export async function askForNotifications(port: NotificationPermissionPort): Promise<NotificationAskResult> {
  try {
    const now = await port.read();
    if (now.granted) return 'granted';
    if (!now.canAskAgain) return 'blocked';
    if (await permissionAsk.ask('notifications') === 'later') return 'later';
    const asked = await port.request();
    return asked.granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}
