import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, HourglassMedium, Info, Microphone, StopCircle, Waveform, X } from 'phosphor-react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action } from '../v2/V2Action';
import { VOICE_ERROR_COPY, voiceErrorCopy, type HoldToTalkController, type VoicePhase, type VoiceSnapshot } from '../../features/voice/holdToTalk';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { tick } from '../system/haptics';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';

/**
 * Speech in the AI conversation (owner step 6, 2026-09-24; the owner's Gemini reference). Three parts, one controller:
 *
 * - `VoiceComposer`: the microphone inside the floating composer. Held, it listens, and what was said goes into the
 *   conversation the moment the finger lifts (owner, 2026-09-23); pulled up, it cancels. With a screen reader it is a
 *   start/stop button whose text lands in the message field for review, because a person who cannot hold the button
 *   cannot pull up to cancel either, so the review IS their cancel.
 * - `VoiceNotice`: the one line above the composer that says what the microphone is doing, what was heard so far, and
 *   what went wrong, with the way out ("Otkaži govor", "Uredi sačuvani tekst", the phone settings).
 * - `VoiceMode`: a calm full screen for talking instead of typing: a softly glowing pill, a microphone toggle and a
 *   close X. Tap to start, tap again to send; the answer arrives as TEXT. The app does not speak (no speech package is
 *   approved), so nothing here promises that it will.
 *
 * Every capture goes through the existing `HoldToTalkController` (begin, release, cancel, useFallback) and every
 * transcript through the screen's own `onTranscript`, which keeps every guard on sending. Nothing here sends a message.
 */
export type VoiceInput = {
  controller: HoldToTalkController; state: VoiceSnapshot;
  /** The screen cannot take a new message now (one is pending, the answer is being written, the conversation is closed). */
  disabled: boolean;
  /** Moves text kept after a failed capture into the message field; false when the field cannot take it. */
  onKeepText: (text: string) => boolean;
};

const ACTIVE: readonly VoicePhase[] = ['PERMISSION_PENDING', 'PREPARING', 'STARTING', 'LISTENING'];
/** The microphone is on its way or listening; FINALIZING is after it, and IDLE is before. */
export const voiceActive = (state: VoiceSnapshot) => ACTIVE.includes(state.phase);

/** What each phase is called where it is shown or spoken; LISTENING and IDLE depend on the mode and are said by the caller. */
const PHASE_WORDS: Partial<Record<VoicePhase, string>> = {
  PERMISSION_PENDING: 'Čekamo dozvolu mikrofona…', PREPARING: 'Pripremamo govorni unos…', STARTING: 'Povezujemo mikrofon…',
  FINALIZING: 'Završavamo tekst…',
};
/** Shown when the microphone was only tapped: it listens while it is held. */
export const HOLD_HINT = 'Drži mikrofon dok govoriš, pa pusti da pošalješ.';

function useScreenReader(): boolean {
  const [reader, setReader] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => { if (alive) setReader(enabled); }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => { alive = false; listener.remove(); };
  }, []);
  return reader;
}
/** Whether the text of this capture goes to the field for review: from the running session, else from the screen reader. */
const reviewing = (state: VoiceSnapshot, reader: boolean) => state.session ? state.session.mode === 'accessible' : reader;

/** The microphone keeps its gesture; the ordinary AI pill uses a practical 52 px target. */
export function VoiceComposer(p: VoiceInput & { onTooShort?: () => void; size?: 48 | 52 | 60; tapToTalk?: boolean }) {
  const reader = useScreenReader();
  const reduced = useReducedMotion();
  const gesture = useRef<string | null>(null), startY = useRef(0);
  const explicit = reader || !!p.tapToTalk;
  const { phase } = p.state;
  const active = voiceActive(p.state);
  const occupied = phase !== 'IDLE' && !active;
  const blocked = (p.disabled && !active) || occupied;
  const listening = phase === 'LISTENING';
  const targetSize = p.size ?? 48;
  const glyphSize = targetSize === 60 ? 28 : targetSize === 52 ? 26 : 22;
  // Pressable's onPressOut also fires on leaving its press rectangle or losing the responder.
  // Held speech must finish only on actual responder release; termination cancels it unsent.
  const MicTarget = explicit ? Pressable : View;
  // The three ticks of holding to talk are outcomes (haptics rule R5): the recording really began, the finger was lifted to send what
  // was said, the recording was called off. The first is read from the phase, not from the touch: a hold that never got the
  // microphone (permission, a busy adapter) has not started anything to feel.
  useEffect(() => { if (phase === 'LISTENING' && gesture.current) tick('gestureStart'); }, [phase]);
  // A recording that fails says so with the error tick, here and not in the notice, so that voice mode over this composer does not tick twice.
  useEffect(() => { if (p.state.error) tick('error'); }, [p.state.error]);
  const begin = () => {
    if (p.disabled || occupied || active) return;
    const id = noviUuidZahtevId(); gesture.current = id;
    if (!p.controller.begin(id, explicit ? 'accessible' : 'hold')) gesture.current = null;
  };
  const release = () => {
    const id = gesture.current; gesture.current = null;
    if (!id) return;
    // A tap on a held control does nothing a person can see, so the composer says how it works.
    const early = phase !== 'LISTENING';
    if (!early) tick('gestureEnd');
    void p.controller.release(id);
    if (early && !explicit) p.onTooShort?.();
  };
  // A running capture is said and drawn in its own mode; before one starts, the mode is the screen reader's.
  const review = reviewing(p.state, explicit);
  const label = listening ? review ? 'Zaustavi i pregledaj tekst' : 'Slušamo — pusti da pošalješ'
    : PHASE_WORDS[phase] ?? (explicit ? 'Pokreni govorni unos' : 'Drži da govoriš');
  const waiting = phase === 'PERMISSION_PENDING' || phase === 'PREPARING' || phase === 'STARTING' || phase === 'FINALIZING';
  const cancel = () => { if (gesture.current) { gesture.current = null; tick('cancel'); p.controller.cancel('gesture'); } };
  return <MicTarget testID="voice-mic" accessible accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={explicit ? 'Zaustavljanje priprema tekst za pregled i izmenu. Poruku šalješ zasebnim dugmetom.'
      : 'Drži tokom govora. Kad pustiš, poruka ide u razgovor. Povuci prst naviše da otkažeš.'}
    accessibilityState={{ disabled: blocked, busy: waiting }} disabled={blocked}
    // Switch Access and Voice Access click instead of holding: that click reaches only `onPress` (or this action), never
    // the press-in and press-out a hold is made of, so on its own it did nothing. In hold mode it shows the same advice
    // as a short tap, with "Govori bez držanja" beside it, which opens voice mode (verify r4b ra item B).
    accessibilityActions={explicit ? undefined : [{ name: 'activate' }]}
    onAccessibilityAction={explicit ? undefined : event => { if (event.nativeEvent.actionName === 'activate' && !blocked) p.onTooShort?.(); }}
    onStartShouldSetResponder={explicit ? undefined : () => !blocked}
    onResponderGrant={explicit ? undefined : event => { startY.current = event.nativeEvent.pageY; begin(); }}
    onResponderRelease={explicit ? undefined : release}
    onResponderTerminate={explicit ? undefined : cancel}
    onResponderTerminationRequest={explicit ? undefined : () => true}
    onPress={explicit ? () => active ? release() : begin() : undefined}
    onResponderMove={explicit ? undefined : event => { if (gesture.current && startY.current - event.nativeEvent.pageY > 70) cancel(); }}
    style={[s.target, { width: targetSize, height: targetSize }]}>
    <View style={[s.micCircle, { width: targetSize - 4, height: targetSize - 4 }, listening && s.micListening, waiting && s.micWaiting]}>
      {waiting ? reduced
        ? <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <HourglassMedium size={glyphSize} color={sys.color.artRole.ai.front} />
          </View>
        : <ActivityIndicator size="small" color={sys.color.artRole.ai.front} />
        : active && review ? <StopCircle size={glyphSize} weight="fill" color={listening ? sys.color.onGreen : sys.color.ink} />
          : <Microphone size={glyphSize} weight={listening ? 'fill' : 'regular'} color={listening ? sys.color.onGreen : blocked ? sys.color.muted : sys.color.ink} />}
    </View>
  </MicTarget>;
}

/** Five still bars for the measured level; they redraw with the level and never animate on their own. */
function Levels({ level }: { level: number }) {
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.levels}>
    {[0.08, 0.2, 0.4, 0.65, 0.85].map((threshold, i) => <View key={threshold}
      style={[s.level, { height: 6 + i * 4 }, level >= threshold && s.levelOn]} />)}
  </View>;
}

/**
 * The line above the composer: what the microphone is doing and what it heard, or what went wrong and the way out.
 * `hint` is the composer's own quiet advice, shown only while the microphone has nothing to say.
 */
export function VoiceNotice(p: VoiceInput & { hint?: string | null; hintAction?: { label: string; onPress: () => void } }) {
  const reader = useScreenReader();
  const { state } = p;
  const active = voiceActive(state), listening = state.phase === 'LISTENING';
  if (active || state.phase === 'FINALIZING') {
    const words = [state.finalText, state.interimText].filter(Boolean).join(' ');
    const line = listening ? reviewing(state, reader) ? 'Slušam… Zaustavi, pregledaj tekst i izaberi Pošalji.'
      : 'Slušam… Pusti da pošalješ, povuci nagore da odustaneš.' : state.phase === 'FINALIZING' ? 'Prepoznajemo govor…' : PHASE_WORDS[state.phase] ?? '';
    return <View testID="voice-notice" style={s.notice}>
      {words ? <T testID="voice-live-transcript" selectable numberOfLines={3} style={s.heard}>{words}</T> : null}
      <View style={s.noticeRow}>
        {listening && state.audioLevel !== null ? <Levels level={state.audioLevel} /> : null}
        <T accessibilityLiveRegion="polite" variant="note" style={[s.noticeText, listening && s.noticeLive]}>{line}</T>
        {active ? <V2Action tone="neutral" kind="quiet" compact label="Otkaži govor" onPress={() => p.controller.cancel('gesture')} /> : null}
      </View>
    </View>;
  }
  if (state.error === 'MIC_PERMISSION_DENIED') return <PermissionRecovery compact message={VOICE_ERROR_COPY[state.error]} />;
  const keep = state.fallbackText && state.phase === 'IDLE';
  if (state.error || keep) return <View testID="voice-notice" style={s.notice}>
    {state.error ? <T accessibilityLiveRegion="polite" variant="note" style={s.error}>{voiceErrorCopy(state.error, state.fallbackText)}</T> : null}
    {keep ? <V2Action tone="neutral" kind="quiet" compact label="Uredi sačuvani tekst" style={s.start}
      onPress={() => p.controller.useFallback(p.onKeepText)} /> : null}
  </View>;
  if (!p.hint) return null;
  // The advice after a tap carries the way to speak without holding (review r4 ra item 7): a person who cannot hold, or
  // who uses Switch Access or Voice Access (their click on the microphone is its `activate` action, which brings this
  // advice), has voice mode here even while the field has text and the waveform button is not shown.
  return <View style={s.hintRow}>
    <T accessibilityLiveRegion="polite" variant="note" tone="muted" style={s.hintText}>{p.hint}</T>
    {p.hintAction ? <V2Action tone="neutral" kind="quiet" compact label={p.hintAction.label} onPress={p.hintAction.onPress} /> : null}
  </View>;
}

/**
 * Talking instead of typing (the owner's Gemini reference, 2026-09-23): the last exchange as plain large text, a softly
 * glowing pill that follows the measured level while listening (still otherwise and under reduced motion),
 * the microphone toggle and the close X. Tap starts, tap again sends what was said through the screen's own
 * `onTranscript`, and the answer arrives here as text. "Pregledaj tekst pre slanja" (always on with a screen reader)
 * puts the text in the message field instead, and this screen steps aside so the person can read and send it.
 */
export function VoiceMode(p: { voice: VoiceInput; prompt: string; answer: string | null; said: string | null;
  /** The answer is being written and no text has arrived yet. */ thinking: boolean;
  /** Opens with "Pregledaj tekst pre slanja" already on (reached from the hold advice while the field has a draft). */
  reviewFirst?: boolean;
  onClose: (reason: 'closed' | 'review') => void }) {
  const { controller, state, disabled, onKeepText } = p.voice;
  const reduced = useReducedMotion();
  const reader = useScreenReader();
  const [reviewFirst, setReviewFirst] = useState(p.reviewFirst ?? false);
  const review = reader || reviewFirst;
  const notice = useConfirmSheet({ reduced });
  const gesture = useRef<string | null>(null), started = useRef<'hold' | 'accessible' | null>(null);
  const previous = useRef<VoicePhase>(state.phase);
  const active = voiceActive(state), listening = state.phase === 'LISTENING', finishing = state.phase === 'FINALIZING';
  const blocked = (disabled && !active) || finishing;
  const close = useRef(p.onClose); close.current = p.onClose;
  useEffect(() => {
    const before = previous.current; previous.current = state.phase;
    if (before === 'IDLE' || state.phase !== 'IDLE') return;
    const mode = started.current; started.current = null; gesture.current = null;
    // A reviewed capture is now in the message field: this screen steps aside so the person reads and sends it. Only a
    // capture that was finalised put text there (review r4 ra item 5): one stopped while the microphone was still on
    // its way ("Dodir prekida."), or cancelled when the app left the foreground, ends in IDLE with nothing in the field,
    // and voice mode stays open. The controller tells the two apart itself: a finished capture rests with its session
    // kept, and a cancel clears it, so this holds even when FINALIZING and IDLE arrive in one render (verify r4b ra 5).
    if (mode === 'accessible' && state.session !== null && !state.error && !state.fallbackText) close.current('review');
  }, [state.phase, state.session, state.error, state.fallbackText]);
  // Taken away by its screen while a capture it started still runs: that capture ends unsent.
  useEffect(() => () => { if (gesture.current) controller.cancel('gesture'); }, [controller]);
  const toggle = () => {
    // A capture this screen did not start (a screen reader started it from the composer) is still stopped by its own id.
    if (active) { const id = gesture.current ?? state.session?.gestureId; gesture.current = null; if (id) controller.release(id); return; }
    if (blocked) return;
    const id = noviUuidZahtevId(), mode = review ? 'accessible' : 'hold';
    gesture.current = id; started.current = mode;
    if (!controller.begin(id, mode)) { gesture.current = null; started.current = null; }
  };
  // Closing throws away only what is still being captured. Once the person has tapped to send (FINALIZING), the text is
  // on its way through the screen's own `onTranscript` and closing does not take it back.
  const leave = () => {
    if (active) { gesture.current = null; started.current = null; controller.cancel('gesture'); }
    p.onClose('closed');
  };
  const words = [state.finalText, state.interimText].filter(Boolean).join(' ');
  const micLabel = listening ? review ? 'Zaustavi i pregledaj tekst' : 'Pošalji izgovoreno'
    : active ? `${PHASE_WORDS[state.phase]} Dodir prekida.` : finishing ? PHASE_WORDS.FINALIZING! : 'Počni da govoriš';
  const line = state.error ? null : listening ? review ? 'Slušamo. Dodirni kad završiš — tekst ide u polje za poruku.'
      : 'Slušamo. Dodirni kad završiš — poruka ide u razgovor.'
    : active || finishing ? PHASE_WORDS[state.phase]!
      // While the answer is being written the exchange above says "Stiže odgovor…" once, in its own live region
      // (review r4 ra item 10); the line under it would say it a second time.
      : disabled ? p.thinking ? null : 'Prethodna poruka još nije poslata. Zatvori i proveri razgovor.'
        : review ? 'Dodirni mikrofon i govori. Tekst stiže u polje za poruku da ga pregledaš.'
          : 'Dodirni mikrofon i govori. Kad ponovo dodirneš, poruka ide u razgovor.';
  // The answer is above the person's latest words, so a previous answer never appears to answer a live capture.
  const live = active && !!words;
  const heard = live ? words : p.said;
  return <Modal visible transparent={false} animationType={reduced ? 'none' : 'fade'} statusBarTranslucent navigationBarTranslucent
    onRequestClose={leave}>
    <SafeAreaView edges={['top', 'bottom']} accessibilityViewIsModal accessibilityLabel="Razgovor glasom" style={s.screen}>
      <View style={s.top}>
        <Press accessibilityRole="button" accessibilityLabel="O govornom unosu i privatnosti" haptic="select" hitSlop={0}
          onPress={() => notice.ask({ title: 'Govorni unos i privatnost', message: VOICE_PROCESSING_NOTICE, confirmLabel: 'U redu', cancelLabel: null })}
          style={s.target}><View style={s.quietCircle}><Info size={22} color={sys.color.muted} /></View></Press>
      </View>
      <ScrollView style={s.flex} contentContainerStyle={s.exchange} showsVerticalScrollIndicator={false}>
        {p.answer ? <View accessibilityLabel={`USKOČI: ${p.answer}`} style={s.answerBlock}>
          <T selectable style={s.answer}>{p.answer}</T>
        </View> : p.thinking ? <View style={s.answerBlock}>
          <T accessibilityLiveRegion="polite" variant="copy" tone="muted">Stiže odgovor…</T>
        </View> : !heard ? <View style={s.answerBlock}>
          <T accessibilityRole="header" style={s.prompt}>{p.prompt}</T>
          <T variant="copy" tone="muted">Odgovor stiže ovde, kao tekst.</T>
        </View> : null}
        {heard ? <View accessibilityLabel={`Ti: ${heard}`} style={[s.said, live && s.saidLive]}>
          <T selectable style={s.saidText}>{heard}</T></View> : null}
      </ScrollView>
      <View style={s.controls}>
        {state.error === 'MIC_PERMISSION_DENIED' ? <PermissionRecovery compact message={VOICE_ERROR_COPY[state.error]} />
          : state.error ? <T accessibilityLiveRegion="polite" variant="note" style={[s.error, s.center]}>{voiceErrorCopy(state.error, state.fallbackText)}</T>
            : line ? <T testID="voice-mode-line" accessibilityLiveRegion="polite" variant="note" tone="muted" style={s.center}>{line}</T> : null}
        {state.fallbackText && state.phase === 'IDLE' ? <V2Action tone="neutral" kind="quiet" compact label="Uredi sačuvani tekst"
          onPress={() => { if (controller.useFallback(onKeepText)) p.onClose('review'); }} /> : null}
        <View style={s.row}>
          <GlowPill listening={listening} level={state.audioLevel} reduced={reduced} />
          <Press testID="voice-mode-mic" accessibilityRole="button" accessibilityLabel={micLabel}
            accessibilityState={{ disabled: blocked, busy: finishing }} disabled={blocked} haptic={blocked ? 'none' : 'light'} hitSlop={0}
            onPress={toggle} style={[s.big, s.micReady, listening && s.bigOn, blocked && s.bigOff]}>
            {listening && review ? <StopCircle size={28} weight="fill" color={sys.color.onGreen} />
              : <Microphone size={28} weight={listening ? 'fill' : 'regular'} color={blocked ? sys.color.muted : sys.color.surface} />}
          </Press>
          <Press testID="voice-mode-close" accessibilityRole="button" accessibilityLabel="Zatvori govorni razgovor"
            accessibilityHint={active ? 'Ako zatvoriš, izgovoreni tekst koji nije poslat se briše.' : undefined}
            haptic="select" hitSlop={0} onPress={leave} style={s.big}>
            <X size={28} color={sys.color.ink} />
          </Press>
        </View>
        {/* Drawn as a checkbox, so it is one to a screen reader too (review r4 ra item 12). */}
        {reader ? null : <Press accessibilityRole="checkbox" accessibilityLabel="Pregledaj tekst pre slanja"
          accessibilityState={{ checked: reviewFirst, disabled: active || finishing }} disabled={active || finishing} haptic="select"
          onPress={() => setReviewFirst(value => !value)} style={s.option}>
          <View style={[s.box, reviewFirst && s.boxOn]}>{reviewFirst ? <Check size={14} weight="bold" color={sys.color.onGreen} /> : null}</View>
          <T variant="note" style={s.optionText}>Pregledaj tekst pre slanja</T>
        </Press>}
      </View>
    </SafeAreaView>
    {notice.sheet}
  </Modal>;
}

/**
 * The glowing pill: a white capsule with the waveform, lying on a soft blue glow. While the microphone listens the
 * capsule turns ink and the glow follows the measured level. Idle, unknown levels, permission/error states and the
 * background stay still: decoration must not imply that the microphone hears audio. Reduced motion stays still too.
 * It says nothing a screen reader needs: the microphone button and the line above say the state.
 */
function GlowPill({ listening, level, reduced }: { listening: boolean; level: number | null; reduced: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    pulse.stopAnimation();
    if (reduced || !foreground || !listening || level === null || !Number.isFinite(level)) {
      pulse.setValue(0);
      return;
    }
    const transition = Animated.timing(pulse, { toValue: Math.max(0, Math.min(1, level)),
      duration: sys.motion.press, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false });
    transition.start();
    return () => transition.stop();
  }, [pulse, reduced, foreground, listening, level]);
  const glow = { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.36] }),
    transform: [{ scaleX: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
      { scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }] };
  return <View testID="voice-glow" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.pillStage}>
    <Animated.View style={[s.glow, listening && s.glowOn, !reduced && glow]} />
    <View style={[s.pillCore, listening && s.pillCoreOn]}>
      <Waveform size={28} weight="bold" color={listening ? sys.color.onGreen : sys.color.ink} />
    </View>
  </View>;
}

const BIG = 52;
const s = StyleSheet.create({
  flex: { flex: 1 }, center: { textAlign: 'center' }, start: { alignSelf: 'flex-start' },
  // The composer's controls: a 48 px target, a 44 px circle inside it.
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  micCircle: { width: 44, height: 44, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  micListening: { backgroundColor: sys.color.ink },
  micWaiting: { backgroundColor: sys.color.wash },
  notice: { gap: 4, paddingHorizontal: 8 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeText: { flex: 1, color: sys.color.muted },
  noticeLive: { color: sys.color.ink, fontWeight: '600' },
  heard: { ...sys.type.body, color: sys.color.ink },
  hintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, paddingHorizontal: 8 },
  hintText: { flexShrink: 1 },
  error: { color: sys.color.danger },
  levels: { flexDirection: 'row', gap: 3, height: 24, alignItems: 'center' },
  level: { width: 3, borderRadius: sys.radius.pill, backgroundColor: sys.color.lineStrong },
  levelOn: { backgroundColor: sys.color.artRole.ai.front },
  // Voice mode: white, the exchange above, the controls at the thumb.
  screen: { flex: 1, backgroundColor: sys.color.surface },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: sys.space.lg, paddingTop: sys.space.sm },
  quietCircle: { width: 44, height: 44, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  exchange: { flexGrow: 1, gap: 24, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  said: { alignSelf: 'stretch', marginTop: 'auto', paddingVertical: 16, paddingHorizontal: 20, borderRadius: sys.radius.card,
    backgroundColor: sys.color.wash },
  saidLive: { opacity: 0.7 },
  saidText: { ...sys.type.body, color: sys.color.ink },
  answerBlock: { gap: 10 },
  answer: { ...sys.type.speechLarge, color: sys.color.ink },
  prompt: { ...sys.type.title, color: sys.color.ink },
  controls: { gap: 12, paddingHorizontal: sys.space.lg, paddingTop: 8, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { width: BIG, height: BIG, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine },
  micReady: { backgroundColor: sys.color.ink, borderColor: sys.color.ink },
  bigOn: { backgroundColor: sys.color.ink, borderColor: sys.color.ink },
  bigOff: { backgroundColor: sys.color.wash, borderColor: sys.color.line },
  pillStage: { flex: 1, minWidth: 0, maxWidth: 120, marginRight: 'auto', height: 56, justifyContent: 'center' },
  // A faint blue glow; only measured speech adds movement. The idle surface remains still.
  glow: { ...StyleSheet.absoluteFill, borderRadius: sys.radius.pill, backgroundColor: sys.color.artRole.ai.front, opacity: 0.14 },
  glowOn: { opacity: 0.22 },
  pillCore: { height: BIG, marginHorizontal: 4, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine },
  pillCoreOn: { backgroundColor: sys.color.ink, borderColor: sys.color.ink },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', paddingHorizontal: 8 },
  box: { width: 22, height: 22, borderRadius: sys.radius.check, borderWidth: 1.5, borderColor: sys.color.lineStrong,
    alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  boxOn: { backgroundColor: sys.color.ink, borderColor: sys.color.ink },
  optionText: { flexShrink: 1, color: sys.color.ink },
});
