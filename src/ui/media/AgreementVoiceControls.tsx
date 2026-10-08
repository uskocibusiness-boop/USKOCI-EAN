import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { PorukaProjekcija } from '../../contracts/projections';
import type { AgreementVoiceController } from '../../hooks/useAgreementVoice';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { tick } from '../system/haptics';
import { sys } from '../system/tokens';
import { usePressLift } from '../system/usePressLift';
import { useLayoutClass } from '../system/textScale';

export function voiceTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function Action({ label, onPress, disabled = false, primary = false }: {
  label: string; onPress(): void; disabled?: boolean; primary?: boolean;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled}
    accessibilityState={{ disabled }} style={[s.action, primary && s.primary, disabled && s.disabled]}>
    <T variant="action" style={{ color: primary ? sys.color.surface : sys.color.ink }}>{label}</T>
  </Press>;
}

/** A separate accessible playback button, never hidden inside the bubble's spoken summary. */
export function AgreementVoiceMessage({ voice, message }: { voice: AgreementVoiceController; message: PorukaProjekcija }) {
  if (!message.glas) return null;
  const active = voice.playback.assetId === message.glas.assetId;
  const status = active ? voice.playback.status : 'idle';
  const playing = status === 'playing', loading = status === 'loading';
  const label = playing ? 'Pauziraj glasovnu poruku' : status === 'error' ? 'Ponovo učitaj glasovnu poruku' : 'Preslušaj glasovnu poruku';
  return <View style={s.message}>
    <Press accessibilityRole="button" accessibilityLabel={`${label}, ${voiceTime(message.glas.trajanjeMs)}`}
      accessibilityState={{ busy: loading, disabled: loading }} disabled={loading}
      onPress={() => { void voice.toggle(message); }} style={s.play}>
      {loading ? <ActivityIndicator color={sys.color.ink} /> : <Glyph name="wave" size={24} />}
      <View style={s.flex}><T variant="bodyStrong">{playing ? 'Pauza' : loading ? 'Učitavamo…' : 'Preslušaj'}</T>
        <T variant="note" tone="muted">{active && status !== 'error' ? `${voiceTime(voice.playback.positionMs)} / ` : ''}{voiceTime(message.glas.trajanjeMs)}</T></View>
    </Press>
    {active && voice.playback.error ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">{voice.playback.error.message}</T> : null}
  </View>;
}

export function AgreementVoiceMic({ voice }: { voice: AgreementVoiceController }) {
  const held = useRef(false), startY = useRef(0);
  const lift = usePressLift(sys.motion.scale.button);
  const state = voice.recording;
  const capturing = state.phase === 'requesting' || state.phase === 'recording';
  const disabled = !capturing && !state.canRecord;
  const label = voice.screenReader
    ? capturing ? 'Zaustavi snimanje i pregledaj glasovnu poruku' : 'Snimi glasovnu poruku'
    : 'Drži za glasovnu poruku';
  const MicTarget = voice.screenReader ? Press : Animated.View;
  // The recording REALLY began (the microphone is open, not merely touched): one tick, as the picture changes (spec M-04, rule R5).
  // A tick is not movement and follows no reduced-motion setting (`system/haptics`).
  const recording = state.phase === 'recording';
  const wasRecording = useRef(false);
  useEffect(() => {
    if (recording && !wasRecording.current) tick('gestureStart');
    wasRecording.current = recording;
  }, [recording]);
  // Called off by dragging away or by the system taking the touch: the recording is dropped, and that is felt as a refusal.
  const cancel = () => { if (held.current) { held.current = false; lift.settle(); tick('cancel'); void voice.cancel(); } };
  return <MicTarget accessible accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={voice.review ? `Snimak prvo preslušaj, pa izaberi Pošalji snimak.${voice.screenReader ? '' : ' Povuci nagore da odustaneš.'}` : 'Drži dok govoriš. Puštanje šalje snimak. Povuci nagore da otkažeš.'}
    accessibilityState={{ disabled, busy: state.phase === 'requesting' }} disabled={disabled}
    // Press-out is not finger-up: leaving its rectangle used to stop a still-held recording.
    onStartShouldSetResponder={voice.screenReader ? undefined : () => !disabled}
    onResponderGrant={voice.screenReader ? undefined : event => {
      if (disabled || held.current) return;
      held.current = true; startY.current = event.nativeEvent.pageY; lift.give(); void voice.begin();
    }}
    onResponderRelease={voice.screenReader ? undefined : () => {
      if (!held.current) return;
      held.current = false; lift.settle(); tick('gestureEnd'); void voice.release();
    }}
    onResponderTerminate={voice.screenReader ? undefined : cancel}
    onResponderTerminationRequest={voice.screenReader ? undefined : () => true}
    onResponderMove={voice.screenReader ? undefined : event => {
      if (held.current && startY.current - event.nativeEvent.pageY > 70) cancel();
    }}
    onPress={voice.screenReader ? () => { if (capturing) tick('gestureEnd'); void (capturing ? voice.release() : voice.begin()); } : undefined}
    style={[s.mic, capturing && s.primary, disabled && s.disabled, !voice.screenReader && lift.style]}>
    <Glyph name="mic" size={24} tone={capturing ? 'onGreen' : 'ink'} />
  </MicTarget>;
}

/** The same opt-in review mode stays explicit beside the microphone, including its off state. */
export function AgreementVoicePreference({ voice, writable, compact = false }: { voice: AgreementVoiceController; writable: boolean; compact?: boolean }) {
  if (voice.recording.phase !== 'idle' || !writable || voice.screenReader) return null;
  return <Press accessibilityRole="checkbox" accessibilityLabel="Pregledaj snimak pre slanja"
    accessibilityState={{ checked: voice.reviewFirst }}
    onPress={() => voice.setReviewFirst(!voice.reviewFirst)} style={[s.preference, compact && s.preferenceCompact]}>
    <View accessible={false} style={[s.preferenceMark, voice.reviewFirst && s.preferenceMarkChecked]}>
      {voice.reviewFirst ? <Glyph name="check" size={16} tone="ink" /> : null}
    </View>
    <T variant="meta" tone="muted" style={[s.preferenceText, compact && s.preferenceTextCompact]}>
      {compact ? 'Pregled' : `Pregled: ${voice.reviewFirst ? 'uključen' : 'isključen'}`}
    </T>
  </Press>;
}

/** The recording is voice-only. It never consumes or silently replaces a text/photo draft. */
export function AgreementVoicePanel({ voice, writable }: { voice: AgreementVoiceController; writable: boolean }) {
  const { stacked } = useLayoutClass();
  const state = voice.recording;
  const recording = state.phase === 'recording', requesting = state.phase === 'requesting';
  const review = state.phase === 'review', failed = state.phase === 'failed', uploading = state.phase === 'uploading';
  return <View style={s.panel}>
    {recording || requesting ? <View style={s.recording}>
      <View style={s.flex}><T variant="bodyStrong">{requesting ? 'Pripremamo mikrofon…' : `Snimaš · ${voiceTime(state.elapsedMs)}`}</T>
        {recording ? <T variant="note" tone="muted">{voice.screenReader ? 'Zaustavi, pa pregledaj snimak.' : `${voice.review ? 'Pusti za pregled.' : 'Pusti za slanje.'} Povuci ↑ da odustaneš.`}</T> : null}</View>
      {recording && state.level !== null ? <View accessible={false} style={s.meter}>
        <View style={[s.level, { width: `${Math.round(state.level * 100)}%` }]} /></View> : null}
      <Action label="Odustani" onPress={() => { void voice.cancel(); }} />
    </View> : null}
    {review ? <View style={s.review}>
      <T variant="meta" tone="muted">Glasovna poruka</T>
      <View style={s.reviewActions}>
        <Press accessibilityRole="button" accessibilityLabel={state.preview === 'playing' ? 'Pauziraj snimak' : 'Preslušaj snimak'}
          accessibilityValue={state.durationMs !== null ? { text: voiceTime(state.durationMs) } : undefined}
          onPress={() => { void voice.preview(); }} style={[s.reviewPlay, stacked && s.reviewPlayStacked]}>
          <View accessible={false}><Glyph name="wave" size={24} /></View>
          <View style={s.flex}>
            <T variant="note">{state.preview === 'playing' ? 'Pauziraj' : 'Preslušaj'}</T>
            {state.durationMs !== null ? <T variant="meta" tone="muted" style={s.duration}>{voiceTime(state.durationMs)}</T> : null}
          </View>
        </Press>
        <Press accessibilityRole="button" accessibilityLabel="Odbaci snimak" disabled={!state.canDiscard}
          accessibilityState={{ disabled: !state.canDiscard }} onPress={() => { void voice.cancel(); }}
          style={[s.reviewDiscard, !state.canDiscard && s.disabled]}>
          <Glyph name="trash" size={24} />
        </Press>
        <Press accessibilityRole="button" accessibilityLabel="Pošalji snimak" disabled={!state.canSend}
          accessibilityState={{ disabled: !state.canSend }} onPress={() => { void voice.send(); }}
          style={[s.reviewSend, !state.canSend && s.disabled]}>
          <T variant="note" style={s.reviewSendText}>Pošalji</T>
        </Press>
      </View>
    </View> : null}
    {failed || uploading ? <View style={s.preview}>
      <T variant="bodyStrong">Glasovna poruka{state.durationMs !== null ? ` · ${voiceTime(state.durationMs)}` : ''}</T>
      {uploading ? <View style={s.row}><ActivityIndicator color={sys.color.ink} /><T variant="note" tone="muted">Pripremamo slanje…</T></View> :
        <View style={s.row}>
          <Action label="Odbaci snimak" disabled={!state.canDiscard} onPress={() => { void voice.cancel(); }} />
          {failed ? <Action label="Proveri isto slanje" primary disabled={!state.canRetry} onPress={() => { void voice.retry(); }} /> : null}
        </View>}
    </View> : null}
    {state.error ? <T variant="note" tone="danger" accessibilityLiveRegion="polite">{state.error.message}</T> : null}
    {voice.interactionError ? <T variant="note" tone="danger" accessibilityLiveRegion="polite">{voice.interactionError}</T> : null}
    {state.recovered.map(item => <View style={s.preview} key={item.ref.clientRequestId}>
      <T variant="bodyStrong">Sačuvan snimak · {voiceTime(item.durationMs)}</T>
      <T variant="note" tone="muted">Snimak je sačuvan, ali još nije poslat.</T>
      <View style={s.row}>
        <Action label="Odbaci sačuvan snimak" onPress={() => { void voice.discardRecovered(item.ref); }} />
        {writable ? <Action label="Pošalji sačuvan snimak" primary onPress={() => { void voice.sendRecovered(item.ref); }} /> : null}
      </View>
    </View>)}
  </View>;
}

const s = StyleSheet.create({
  panel: { gap: 8 }, flex: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  action: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  primary: { backgroundColor: sys.color.ink, borderColor: sys.color.ink }, disabled: { opacity: 0.5 },
  mic: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  recording: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  // Review is part of the composer, not a second large card competing with the conversation.
  review: { gap: sys.space.xs, paddingVertical: sys.space.sm },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sys.space.sm },
  reviewPlay: { minHeight: 48, flexBasis: 120, flexGrow: 1, flexShrink: 1, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: sys.space.xs },
  reviewPlayStacked: { flexBasis: '100%', flexGrow: 0 },
  reviewDiscard: { width: 48, minHeight: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  reviewSend: { minHeight: 48, maxWidth: '100%', paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.ink, alignItems: 'center', justifyContent: 'center' },
  reviewSendText: { color: sys.color.surface, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  duration: { fontVariant: ['tabular-nums'] },
  preview: { gap: 8, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  message: { minWidth: 180, gap: 6, backgroundColor: sys.color.surface, borderRadius: 18, padding: 8 },
  play: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  preference: { minHeight: 48, flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 4 },
  preferenceCompact: { flexDirection: 'column', justifyContent: 'center', gap: 0, paddingHorizontal: 0, paddingVertical: 0 },
  preferenceText: { flex: 1, minWidth: 0 },
  preferenceTextCompact: { flex: 0, textAlign: 'center', maxWidth: '100%' },
  preferenceMark: { width: 20, height: 20, flexShrink: 0, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  preferenceMarkChecked: { backgroundColor: sys.color.control, borderColor: sys.color.ink },
  meter: { width: 40, height: 6, borderRadius: 3, backgroundColor: sys.color.control, overflow: 'hidden' },
  level: { height: 6, backgroundColor: sys.color.ink },
});
