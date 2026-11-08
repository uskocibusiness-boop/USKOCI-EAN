import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { foregroundNotificationAudio } from '../../data/foregroundNotificationAudio';
import { readNativeNotificationAudio, type NativeNotificationAudio } from '../../data/nativeNotificationAudio';
import { SettingsGroup } from '../settings/SettingsPresentation';
import { SystemSettingsAction } from '../system/SystemSettingsAction';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { NoticeSwitchRow } from './NoticeSwitchRow';

/** Local foreground sound choices are separate from the account's business push
 * preferences. Android owns background sounds and vibration; opening settings
 * must never claim a system change was applied. */
export function NotificationAudioPreferences({ openSystemSettings }: { openSystemSettings?: () => void | Promise<void> }) {
  const audio = useSyncExternalStore(foregroundNotificationAudio.subscribe, foregroundNotificationAudio.snapshot, foregroundNotificationAudio.snapshot);
  useEffect(() => { void foregroundNotificationAudio.load(); }, []);
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  const disabled = audio.pending || !audio.confirmed;
  const save = (key: 'messageSounds' | 'notificationSounds', value: boolean) => {
    void foregroundNotificationAudio.save({ messageSounds: audio.messageSounds, notificationSounds: audio.notificationSounds, [key]: value });
  };
  return <SettingsGroup title="Zvuk i vibracija" footer="Ova podešavanja važe za ovaj telefon. Ne menjaju koje događaje želite da primate.">
    <T variant="note" tone="muted">Dok je aplikacija otvorena</T>
    <NoticeSwitchRow label="Zvuk poruka" value={audio.messageSounds} disabled={disabled} onChange={value => save('messageSounds', value)} />
    <NoticeSwitchRow label="Zvuk ostalih obaveštenja" value={audio.notificationSounds} disabled={disabled} last onChange={value => save('notificationSounds', value)} />
    {Platform.OS === 'android' ? <T variant="note" tone="muted">Kada ovde isključite zvuk, utišava se i vibracija tog obaveštenja dok je aplikacija otvorena.</T> : null}
    {audio.pending ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">Proveravamo sačuvana podešavanja zvuka…</T> : null}
    {audio.error ? <View accessibilityLiveRegion="polite">
      <T variant="note" tone="danger">Podešavanja zvuka nisu potvrđena. Zvuk u otvorenoj aplikaciji je privremeno utišan.</T>
      <V2Action label="Proverite podešavanja zvuka" kind="quiet" onPress={() => { void foregroundNotificationAudio.refresh(); }} />
    </View> : null}
    <T variant="note" tone="muted">Sistemski zvuk, vibraciju i obaveštenja kada je aplikacija zatvorena uređujete u podešavanjima telefona. USKOČI poštuje sistemski režim „Ne uznemiravaj”.</T>
    <SystemAudioReadback />
    <SystemSettingsAction open={openSystemSettings} />
  </SettingsGroup>;
}

function SystemAudioReadback() {
  const [native, setNative] = useState<NativeNotificationAudio | 'CHECKING' | 'UNKNOWN'>('CHECKING');
  useFocusEffect(useCallback(() => {
    let alive = true, sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      const own = ++sequence;
      if (timer !== undefined) clearTimeout(timer);
      setNative('CHECKING');
      timer = setTimeout(() => { if (alive && sequence === own) { sequence++; setNative('UNKNOWN'); } }, 3000);
      void readNativeNotificationAudio().then(value => {
        if (alive && sequence === own) { clearTimeout(timer); setNative(value); }
      }, () => { if (alive && sequence === own) { clearTimeout(timer); setNative('UNKNOWN'); } });
    };
    if (AppState.currentState === 'active') read();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') read();
      else { sequence++; if (timer !== undefined) clearTimeout(timer); }
    });
    return () => { alive = false; sequence++; if (timer !== undefined) clearTimeout(timer); subscription.remove(); };
  }, []));
  if (Platform.OS !== 'android') return null;
  const text = native === 'CHECKING' ? 'Proveravamo sistemska podešavanja…'
    : native === 'UNKNOWN' ? 'Sistemska podešavanja nisu potvrđena. Proverite ih na telefonu.'
      : native.kind === 'DENIED' ? 'Telefon trenutno ne dozvoljava obaveštenja za USKOČI.'
        : native.kind === 'CHANNEL' ? !native.enabled ? 'Sistemski kanal obaveštenja je isključen.'
          : `Sistemski kanal: zvuk ${native.sound ? 'uključen' : 'isključen'}, vibracija ${native.vibration ? 'uključena' : 'isključena'}.`
          : 'Sistemski kanal još nije potvrđen na ovom telefonu.';
  return <T variant="note" tone="muted" accessibilityLiveRegion="polite">{text}</T>;
}
