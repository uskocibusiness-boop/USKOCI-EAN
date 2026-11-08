import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NativeNotificationAudio =
  | { kind: 'UNAVAILABLE' }
  | { kind: 'DENIED' }
  | { kind: 'CHANNEL_MISSING' }
  | { kind: 'CHANNEL'; enabled: boolean; sound: boolean; vibration: boolean };

/** Read the channel actually used by the current server transport. This is a
 * settings observation, never evidence of delivery, audible output or DND state.
 * No new channel is selected and no user preference is overwritten. */
export async function readNativeNotificationAudio(): Promise<NativeNotificationAudio> {
  if (Platform.OS !== 'android') return { kind: 'UNAVAILABLE' };
  const permission = await Notifications.getPermissionsAsync();
  if (!permission || typeof permission.granted !== 'boolean') throw Error('NATIVE_NOTIFICATION_AUDIO_UNCONFIRMED');
  if (!permission.granted) return { kind: 'DENIED' };
  const channel = await Notifications.getNotificationChannelAsync('default');
  if (!channel) return { kind: 'CHANNEL_MISSING' };
  const importance = Notifications.AndroidImportance;
  // Native bridge values are runtime input, despite the SDK's static type.
  // UNKNOWN/UNSPECIFIED, absent fields and a different channel prove no state.
  if (channel.id !== 'default' || typeof channel.importance !== 'number'
    || ![importance.NONE, importance.MIN, importance.LOW, importance.DEFAULT, importance.HIGH, importance.MAX].includes(channel.importance)
    || ![null, 'default', 'custom'].includes(channel.sound)
    || typeof channel.enableVibrate !== 'boolean') throw Error('NATIVE_NOTIFICATION_AUDIO_UNCONFIRMED');
  const enabled = channel.importance !== Notifications.AndroidImportance.NONE;
  return { kind: 'CHANNEL', enabled,
    sound: enabled && channel.importance >= Notifications.AndroidImportance.DEFAULT && channel.sound !== null,
    vibration: enabled && channel.enableVibrate === true };
}
