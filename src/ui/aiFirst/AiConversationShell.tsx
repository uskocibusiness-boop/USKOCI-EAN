import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated as NativeAnimated, AppState, Easing, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDown, ArrowUpRight, DotsThree, Info, PaperPlaneTilt, Plus, Waveform } from 'phosphor-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { T } from '../Text';
import { withInter } from '../interFont';
import { Press } from '../Press';
import { ChromeIconButton, ScreenChrome } from '../system/ScreenChrome';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { AiAssistantArt, AiAssistantWelcome, type AssistantWelcomeMemory } from './AiAssistantArt';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { useReducedMotion } from '../system/motion';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
import { HOLD_HINT, VoiceComposer, VoiceMode, VoiceNotice, type VoiceInput } from './VoiceComposer';
import { useConversationArrival } from './useConversationArrival';

export type ConversationMessage = { id: string; fromAi: boolean; body: string };
/** A line of the conversation's own history that is not a message (a confirmed place), drawn after the message it followed. */
export type ConversationNote = { key: string; afterMessageId: string | null; node: ReactNode };
const DraftDisclosure = createContext<{ expanded: boolean; toggle: () => void } | null>(null);
/** Disclosure is presentation state, never the command that prepares the full review. */
export function useAiDraftDisclosure() {
  const shared = useContext(DraftDisclosure);
  const [expanded, setExpanded] = useState(false);
  return shared ?? { expanded, toggle: () => setExpanded(value => !value) };
}
export type AiConversationShellProps = {
  /** Separates arrival/announcement ownership when a different conversation replaces this view. */ conversationKey?: string;
  /** The chrome's title; the chrome draws no line under it (no copy that explains where you are). */ title: string;
  /** The one live card; null until there is something to show. */ card: (compact: boolean) => ReactNode;
  /** A completed draft can become the next decision at the end of the thread, shown once. */
  cardPlacement?: 'top' | 'end';
  messages: readonly ConversationMessage[]; welcome: string; welcomeDetail: string;
  value: string; canEdit: boolean; canSend: boolean; pending: boolean; busy: boolean;
  onChange: (value: string) => void; onSend: () => void; onBack: () => void;
  /** A caller-owned unfinished step can temporarily hold sending without erasing the typed draft. */
  sendBlockedReason?: string;
  /** The "···" of rare actions. Left out when there is nothing to offer, so the chrome shows no dead control. */
  onOptions?: () => void;
  status?: ReactNode; actions?: ReactNode; children?: ReactNode;
  /** Current task context, such as its location, on the conversation's open white surface. */
  context?: ReactNode;
  /** An owned inline editing visit. Reveal its top once; local height changes never follow the thread end. */
  interactiveContextKey?: string;
  /** The visit was asked for explicitly (a tap on a line far up the thread): reveal it even while earlier messages are read. */
  revealInteractiveContext?: boolean;
  /** History notes, each an ordinary item of the message list after the message it followed (owner, 2026-10-07: nothing
   *  stays docked at the bottom). A null anchor, or one no longer in the thread, places the note after the last message. */
  threadNotes?: readonly ConversationNote[];
  /** The conversation's next primary step, shown above the composer when the draft is ready. */
  footerAction?: ReactNode;
  /** Speech: the microphone in the composer, the voice mode behind the waveform button. Left out when speech is closed. */
  voice?: VoiceInput;
  /** The "+" at the start of the composer (the task's photos). Left out when there is nothing to attach to. */
  attach?: { label: string; hint?: string; onPress: () => void; disabled?: boolean };
  placeholder?: string;
  /** Openings offered before the first word. 38 of the first 62 conversations never got one. */
  openings?: readonly string[];
  /** Illustrations describe the opening's task; they add no command or domain state. */
  openingArts?: readonly FactArtKind[];
  /** A sentence already sent and not yet read back from the server. It belongs on screen. */
  sentMessage?: string | null;
  /** Only real server text deltas belong here. No typewriter animation. */
  streamingText?: string;
  /**
   * One question at a time (the worker-profile conversation, M1): the assistant's latest message is THE question and is
   * drawn large, while it waits for an answer; earlier assistant turns are quieter. Default off: a thread of the task
   * conversation keeps one size for every turn.
   */
  questionFocus?: boolean;
};

/**
 * The AI conversation (owner step 6, 2026-09-24, after the owner's Gemini reference): one chrome (the arrow back, the
 * title, "···"), a compact live draft above an independent thread, and one composer edge.
 *
 * - The assistant speaks on an open reading surface with a quiet group label; the person's own words are
 *   dark ink bubbles on the right. Nothing is typed out that has not arrived: streamed text is the
 *   server's own deltas, and while nothing has arrived three dots say that an answer is being written.
 * - The composer gives text its full width; attachments and speech sit in a separate toolbar, with send at the right.
 *   Empty input offers voice mode, which still returns text. A send that cannot go now is disabled and explains why.
 *
 * No domain mutations: card, transcript and composer share one bounded surface, and every command is the screen's own.
 */
export function AiConversationShell(p: AiConversationShellProps) {
  const { height } = useWindowDimensions();
  const textScale = useTextScale();
  const [keyboard, setKeyboard] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  // Voice mode opened from the hold advice while the field has a draft starts with the review on, so what is said joins
  // the draft instead of going out as a message of its own.
  const [voiceReview, setVoiceReview] = useState(false);
  const [holdHint, setHoldHint] = useState(false);
  const [readingEarlier, setReadingEarlier] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [composerWidth, setComposerWidth] = useState(0);
  const [inputHeight, setInputHeight] = useState(48);
  const [expandedDraft, setExpandedDraft] = useState(false);
  const [disclosure, setDisclosure] = useState({ key: p.conversationKey, expanded: false });
  const assistantWelcome = useRef<AssistantWelcomeMemory>({ key: p.conversationKey, consumed: false });
  const expanded = disclosure.key === p.conversationKey && disclosure.expanded;
  const input = useRef<TextInput>(null);
  const thread = useRef<ScrollView>(null);
  // Only a deliberate reading gesture changes intent. Keyboard and content geometry must never impersonate one.
  const followLatest = useRef(true);
  const userScrolling = useRef(false);
  const momentumAllowed = useRef(false);
  const historyOffset = useRef(0);
  const contextHeight = useRef(0);
  const anchorConversation = useRef(p.conversationKey);
  const contextActive = useRef(false);
  contextActive.current = !!p.context && p.interactiveContextKey !== undefined;
  const contextOwner = useRef<{ key: string; conversation: string | undefined; pending: boolean; measuring: boolean } | null>(null);
  // RN exposes innerViewRef for measurement relative to the actual scroll content, not its viewport.
  const threadContent = useRef<View>(null!);
  const interactiveContext = useRef<View>(null);
  const geometry = useRef({ offset: 0, content: 0, viewport: 0 });
  const followFrame = useRef<number | null>(null);
  const hasActivity = !!(p.messages.length || p.sentMessage || p.pending || p.busy || p.streamingText);
  const activity = useRef(hasActivity); activity.current = hasActivity;
  const cancelFollow = useCallback(() => {
    if (followFrame.current !== null) cancelAnimationFrame(followFrame.current);
    followFrame.current = null;
  }, []);
  const revealContext = useCallback(() => {
    const owner = contextOwner.current;
    if (!contextActive.current || !owner?.pending || owner.measuring || userScrolling.current) return;
    cancelFollow();
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = null;
      if (!contextActive.current || contextOwner.current !== owner || !owner.pending || userScrolling.current) return;
      const node = interactiveContext.current, ancestor = threadContent.current;
      if (!node || !ancestor) return; // A later actual layout event retries; never spin waiting for a native ref.
      owner.measuring = true;
      const current = () => contextActive.current && contextOwner.current === owner && owner.pending
        && !userScrolling.current && interactiveContext.current === node && threadContent.current === ancestor;
      const failed = () => { owner.measuring = false; };
      try {
        node.measureLayout(ancestor, (_x, y) => {
          owner.measuring = false;
          if (!current() || !Number.isFinite(y)) return;
          owner.pending = false;
          // A content-size event may still describe the preceding conversation.
          // Let the native ScrollView clamp against its current layout instead.
          const target = Math.max(0, y);
          historyOffset.current = target; geometry.current.offset = target;
          thread.current?.scrollTo({ y: target, animated: false });
        }, failed);
      } catch { failed(); }
    });
  }, [cancelFollow]);
  useLayoutEffect(() => {
    cancelFollow();
    const newConversation = anchorConversation.current !== p.conversationKey;
    anchorConversation.current = p.conversationKey;
    contextOwner.current = contextActive.current && p.interactiveContextKey !== undefined
      ? { key: p.interactiveContextKey, conversation: p.conversationKey,
          pending: newConversation || !!p.revealInteractiveContext || (followLatest.current && !userScrolling.current), measuring: false } : null;
    revealContext();
    return () => { contextOwner.current = null; cancelFollow(); };
  }, [p.conversationKey, p.interactiveContextKey, !!p.context, !!p.revealInteractiveContext, cancelFollow, revealContext]);
  const cancelContextReveal = () => { if (contextOwner.current) contextOwner.current.pending = false; };
  const followAfterLayout = useCallback(() => {
    if (contextActive.current || !followLatest.current || userScrolling.current || !activity.current) return;
    cancelFollow();
    thread.current?.scrollToEnd({ animated: false });
    // Keyboard avoidance settles after the first layout; every later content/viewport event can replace this pass.
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = null;
      if (!contextActive.current && followLatest.current && !userScrolling.current && activity.current) thread.current?.scrollToEnd({ animated: false });
    });
  }, [cancelFollow]);
  const reduced = useReducedMotion();
  const notice = useConfirmSheet({ reduced });
  const arrival = useConversationArrival(p);
  const compact = keyboard || height < 760 || textScale >= 1.3 || p.pending;
  // On a narrow display with very large text the summary can consume half the usable screen.
  // Keep the same review target in the scroll, rather than reserving that space above every message.
  const inlineSummary = textScale >= 1.6 || height < 500;
  const cardAtEnd = p.cardPlacement === 'end';
  const pinned = p.card(compact);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => { setKeyboard(true); followAfterLayout(); });
    const hide = Keyboard.addListener('keyboardDidHide', () => { setKeyboard(false); followAfterLayout(); });
    return () => { show.remove(); hide.remove(); cancelFollow(); };
  }, [cancelFollow, followAfterLayout]);
  const phase = p.voice?.state.phase ?? 'IDLE';
  // The advice after a tap goes as soon as the microphone does anything.
  useEffect(() => { if (phase !== 'IDLE') setHoldHint(false); }, [phase]);
  // Speech that closes (the conversation ended, or it cannot take speech any more) takes voice mode with it.
  useEffect(() => { if (!p.voice) setVoiceMode(false); }, [p.voice]);
  useEffect(() => {
    cancelFollow(); followLatest.current = true; userScrolling.current = false; momentumAllowed.current = false;
    historyOffset.current = 0; setReadingEarlier(false);
    if (contextActive.current) revealContext(); else followAfterLayout();
  }, [p.conversationKey, cancelFollow, followAfterLayout, revealContext]);
  const syncReadingPosition = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    geometry.current = { offset: contentOffset.y, content: contentSize.height, viewport: layoutMeasurement.height };
    if (!userScrolling.current) return;
    historyOffset.current = Math.max(0, contentOffset.y);
    const atBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
    if (followLatest.current !== atBottom) { followLatest.current = atBottom; setReadingEarlier(!atBottom); }
  };
  const latest = (animated: boolean) => {
    cancelContextReveal(); cancelFollow(); userScrolling.current = false; momentumAllowed.current = false;
    followLatest.current = true; setReadingEarlier(false); thread.current?.scrollToEnd({ animated });
  };

  const hasText = p.value.trim().length > 0;
  const sendShown = hasText || p.pending;
  const textRoom = composerWidth - 32 - (p.attach ? 48 : 0) - (p.voice ? 52 : 0) - (sendShown || p.voice ? 48 : 0);
  const stackedComposer = textScale >= 1.3 || (composerWidth > 0 && textRoom < 128) || expandedDraft || p.value.includes('\n');
  // Once a narrow field wraps, keep the full-width draft until it is short again.
  // Measuring the wider result must not oscillate between two layouts while typing.
  useEffect(() => {
    if (p.value.length <= 8 && !p.value.includes('\n')) setExpandedDraft(false);
    if (!p.value) setInputHeight(48);
  }, [p.value]);
  const voiceIdle = phase === 'IDLE';
  const sendReason = p.canSend || !sendShown ? null
    : p.sendBlockedReason ?? (p.pending ? p.busy ? 'Poruka se šalje.' : 'Prethodna poruka čeka ishod. Proveri ga u razgovoru.'
      : !voiceIdle ? 'Završi govor pa pošalji.' : p.busy ? 'Sačekaj da stigne odgovor.' : 'Poruku sada ne možeš da pošalješ.');
  const privacy = () => notice.ask({ title: 'Govorni unos i privatnost', message: VOICE_PROCESSING_NOTICE, confirmLabel: 'U redu', cancelLabel: null });

  // Voice mode shows the last exchange: what the person said last and the answer to it, or the answer being written.
  const last = p.messages.at(-1), beforeLast = p.messages.at(-2);
  const welcomeShown = p.messages.length === 0 && !p.sentMessage && !p.pending && !p.busy && !p.streamingText;
  // History notes are not messages: no entrance, no speaker, and nothing about them is docked outside the thread.
  const notes = p.threadNotes ?? [], anchored = new Set(p.messages.map(message => message.id));
  const drawNote = (note: ConversationNote) => <View key={`note:${note.key}`} testID="ai-thread-note">{note.node}</View>;
  const answer = p.streamingText || (!p.sentMessage && last?.fromAi ? last.body : null);
  const said = p.sentMessage ?? (last && !last.fromAi ? last.body : last?.fromAi && beforeLast && !beforeLast.fromAi ? beforeLast.body : null);

  return <DraftDisclosure.Provider value={{ expanded, toggle: () => setDisclosure({ key: p.conversationKey, expanded: !expanded }) }}>
  <SafeAreaView edges={['top']} style={s.canvas}>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenChrome variant="detail" tone="conversation" onBack={p.onBack} title={p.title}
        right={p.onOptions ? <ChromeIconButton label="Opcije" hint="Opcije razgovora." icon={DotsThree} onPress={p.onOptions} /> : undefined} />
      {/* Before the first word there is no draft to pin, and an empty card pushed the one invitation on the screen
          below the fold. The caller returns null until it has something. */}
      {pinned && !inlineSummary && !cardAtEnd ? <ScrollView testID="ai-pinned-card" style={[s.cardArea,
        { maxHeight: compact ? 180 : Math.min(300, height * 0.36) }]} contentContainerStyle={compact ? s.cardAreaCompact : s.cardContents}
        keyboardShouldPersistTaps="handled" nestedScrollEnabled>{pinned}</ScrollView> : null}
      <View style={s.flex}>
      <ScrollView ref={thread} innerViewRef={threadContent} testID="ai-conversation-thread" style={s.flex}
        // Before the first word the invitation is the only thing on screen, so it sits in the space it has. As soon as
        // there is a thread, the thread starts at the top as threads do.
        contentContainerStyle={[s.thread, p.messages.length === 0 && !p.sentMessage && !p.status && !p.context && !notes.length && s.threadEmpty]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => { cancelContextReveal(); cancelFollow(); userScrolling.current = true; momentumAllowed.current = true; }}
        onScroll={syncReadingPosition}
        onScrollEndDrag={event => { syncReadingPosition(event); userScrolling.current = false; }}
        onMomentumScrollBegin={() => { userScrolling.current = momentumAllowed.current; momentumAllowed.current = false; }}
        onMomentumScrollEnd={event => { syncReadingPosition(event); userScrolling.current = false; momentumAllowed.current = false; }}
        scrollEventThrottle={100}
        accessibilityActions={[{ name: 'scrollBackward', label: 'Prethodne poruke' }, { name: 'scrollForward', label: 'Novije poruke' }]}
        onAccessibilityAction={event => {
          const direction = event.nativeEvent.actionName;
          if (direction !== 'scrollBackward' && direction !== 'scrollForward') return;
          const { offset, viewport, content } = geometry.current;
          if (!viewport) return;
          cancelContextReveal(); cancelFollow(); userScrolling.current = false; momentumAllowed.current = false;
          const end = Math.max(0, content - viewport);
          const target = Math.max(0, Math.min(end, offset + (direction === 'scrollBackward' ? -1 : 1) * viewport * 0.75));
          historyOffset.current = target; geometry.current.offset = target;
          followLatest.current = end - target < 80; setReadingEarlier(!followLatest.current);
          thread.current?.scrollTo({ y: target, animated: false });
        }}
        onLayout={event => {
          const viewport = event.nativeEvent.layout.height;
          if (!Number.isFinite(viewport) || viewport <= 0 || geometry.current.viewport === viewport) return;
          geometry.current.viewport = viewport;
          if (contextActive.current) revealContext();
          if (followLatest.current) followAfterLayout();
          else thread.current?.scrollTo({ y: historyOffset.current, animated: false });
        }}
        // The first pending turn already belongs at the bottom, even before the server returns a message ID.
        onContentSizeChange={(_width, content) => {
          if (!Number.isFinite(content) || content < 0 || geometry.current.content === content) return;
          geometry.current.content = content; revealContext(); followAfterLayout();
        }}>
        {/* Always mounted: inserting/removing inline context preserves the sentence being read below it. */}
        <View testID="ai-inline-context" style={pinned && inlineSummary && !cardAtEnd ? s.inlineContext : undefined} onLayout={event => {
          const previous = contextHeight.current, next = event.nativeEvent.layout.height, delta = next - previous;
          contextHeight.current = next;
          // An anchor inside the draft must stay there when its details open. Only transcript below the old
          // context moves by its height delta. With new context, offset zero still means the visible top.
          const belowContext = previous === 0 ? historyOffset.current > 0 : historyOffset.current >= previous;
          if (!followLatest.current && delta && belowContext) {
            historyOffset.current = Math.max(0, historyOffset.current + delta);
            thread.current?.scrollTo({ y: historyOffset.current, animated: false });
          }
        }}>{pinned && inlineSummary && !cardAtEnd ? <View testID="ai-inline-card">{pinned}</View> : null}</View>
        <View style={s.turns}>
        {welcomeShown ? <View style={s.welcome}>
          {!keyboard ? <View importantForAccessibility="no-hide-descendants" style={s.presence}>
            <AiAssistantWelcome conversationKey={p.conversationKey} memory={assistantWelcome} />
          </View> : null}
          <T accessibilityRole="header" variant="title" style={s.welcomeTitle}>{p.welcome}</T>
          {p.welcomeDetail ? <T variant="copy" tone="muted" style={s.welcomeCopy}>{p.welcomeDetail}</T> : null}
          {p.openings?.length && p.canEdit ? <View style={s.openings}>
            {p.openings.map((opening, index) => <Press key={opening} accessibilityRole="button" accessibilityLabel={opening}
              accessibilityHint="Upisuje ovo u poruku da možeš da dopuniš." haptic="select" style={s.opening}
              onPress={() => { p.onChange(opening + ' '); requestAnimationFrame(() => input.current?.focus()); }}>
              {p.openingArts?.[index] ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.openingArt}>
                <FactArt kind={p.openingArts[index]} size={24} cut="art"
                  role={p.openingArts[index] === 'home' || p.openingArts[index] === 'pin' ? 'location'
                    : p.openingArts[index] === 'users' || p.openingArts[index] === 'person' ? 'people' : 'skills'} /></View> : null}
              <T variant="body" style={s.openingText}>{opening}</T><ArrowUpRight size={18} color={sys.color.muted} /></Press>)}
          </View> : null}
          {/* The speech disclosure is reachable before the first word, and from voice mode at any time. */}
          {p.voice ? <Press accessibilityRole="button" accessibilityLabel="O govornom unosu i privatnosti" haptic="select"
            onPress={privacy} style={s.privacy}>
            <Info size={16} color={sys.color.muted} /><T variant="meta" tone="muted">O govornom unosu i privatnosti</T>
          </Press> : null}
        </View> : null}
        {/* One keyed list: a note keeps its identity when its anchor or the welcome changes, so it moves instead of remounting. */}
        {[...(welcomeShown ? [] : p.messages.flatMap((message, index) => [<Turn key={message.id} {...message}
          showSpeaker={message.fromAi && (index === 0 || !p.messages[index - 1].fromAi)}
          emphasis={!p.questionFocus || !message.fromAi ? 'plain' : index === p.messages.length - 1 && !p.sentMessage && !p.streamingText ? 'question' : 'earlier'}
          // Frequent updates and streamed text get no decorative entrance. A turn that arrives while you are watching is
          // feedback; the thread you already had when the screen opened is not, and must not replay.
          reduced={reduced || !arrival.shouldEnter(message.id)} />,
          ...notes.filter(note => note.afterMessageId === message.id).map(drawNote)])),
          ...notes.filter(note => note.afterMessageId === null || !anchored.has(note.afterMessageId)).map(drawNote)]}
        {/* Until the server read brings it back, what was said is still what was said: present, readable, and visibly
            not yet part of the record. */}
        {p.sentMessage ? <View accessibilityLabel={`Ti, šalje se: ${p.sentMessage}`} style={[s.person, s.sending]}>
          <T selectable style={s.personText}>{p.sentMessage}</T>
        </View> : null}
        {p.streamingText ? <View accessibilityLabel={`USKOČI: ${p.streamingText}`} accessibilityLiveRegion="none" style={s.assistant}>
          {p.sentMessage || !last?.fromAi ? <Mark /> : null}<T selectable style={p.questionFocus ? s.question : s.answer}>{p.streamingText}</T></View> : null}
        {/* Three dots are what a person waiting for an answer already understands; they stop under reduced motion. */}
        {p.busy && !p.streamingText ? <View accessibilityLiveRegion="polite" accessibilityLabel="USKOČI piše odgovor" style={s.assistant}>
          <View style={s.typing}><View style={s.dots}>{[0, 1, 2].map(index => <TypingDot key={index} index={index} reduced={reduced} />)}</View>
            <T variant="note" tone="muted">Stiže odgovor…</T></View>
        </View> : null}
        {p.context ? <View ref={interactiveContext} collapsable={false} testID="ai-task-context" onLayout={revealContext}>{p.context}</View> : null}
        {/* Recovery belongs to scrollable content, not a second fixed footer. */}
        {p.status ? <View testID="ai-recovery-in-thread" style={s.recovery}>{p.status}</View> : null}
        {p.actions ? <View style={s.actions}>{p.actions}</View> : null}
        {pinned && cardAtEnd ? <View testID="ai-end-card">{pinned}</View> : null}
        </View>
      </ScrollView>
      {/* This control gets its own measured row. An overlay hid the expanded draft/review on small screens;
          shrinking the thread preserves its reading anchor through onLayout instead of covering its content. */}
      {readingEarlier && hasActivity ? <View testID="ai-latest-region" style={s.latestRegion}>
        <Press testID="ai-latest" accessibilityRole="button"
        accessibilityLabel="Najnovija poruka" onPress={() => latest(!reduced)} haptic="select" style={s.latest}>
        <ArrowDown size={18} color={sys.color.ink} /><T variant="note" style={s.latestText}>Najnovija poruka</T>
      </Press></View> : null}
      </View>
      {/* Above the keyboard the composer needs no inset of its own; without it, the gesture bar is the phone's. No tab bar
          is drawn under a conversation (`_layout`), so this is the composer's own inset on both conversations. */}
      <SafeAreaView edges={keyboard ? [] : ['bottom']} testID="ai-composer-footer" style={s.footer}>
        {p.footerAction ? <View testID="ai-footer-action">{p.footerAction}</View> : null}
        {/* The hold advice carries the way to speak without holding (review r4 ra item 7): once the field has text the
            waveform button gives way to send, and a person who cannot hold would otherwise have no speech at all. */}
        {p.voice ? <VoiceNotice {...p.voice} hint={holdHint ? HOLD_HINT : null}
          hintAction={holdHint && !p.voice.disabled && voiceIdle ? { label: 'Govori bez držanja', onPress: () => {
            Keyboard.dismiss(); setHoldHint(false); setVoiceReview(hasText); setVoiceMode(true); } } : undefined} /> : null}
        {/* When the thread's own recovery note already explains the wait, the line here would say it twice; the send
            button still says it to a screen reader. The same holds while the message is being sent: the thread shows the
            answer arriving, so no line is docked above the composer for it. */}
        {sendReason && voiceIdle && !p.status && !(p.pending && p.busy) ? <T testID="ai-send-reason" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          variant="note" tone="muted" style={s.reason}>{sendReason}</T> : null}
        <View testID="ai-composer" onLayout={event => {
          const width = event.nativeEvent.layout.width;
          if (Number.isFinite(width) && width > 0) setComposerWidth(previous => previous === width ? previous : width);
        }}
          style={[s.pill, stackedComposer && s.pillExpanded, inputFocused && s.pillFocused]}>
          {p.attach ? <View style={[s.attachmentSlot, stackedComposer && s.attachmentBelow]}>
            <Press accessibilityRole="button" accessibilityLabel={p.attach.label} accessibilityHint={p.attach.hint}
              accessibilityState={{ disabled: !!p.attach.disabled }} disabled={p.attach.disabled} haptic={p.attach.disabled ? 'none' : 'select'}
              hitSlop={0} onPress={p.attach.onPress} style={s.target}>
              <View style={s.toolCircle}><Plus size={22} color={p.attach.disabled ? sys.color.muted : sys.color.ink} /></View>
            </Press>
          </View> : null}
          <TextInput ref={input} accessibilityLabel="Poruka za AI" value={p.value} editable={p.canEdit}
            onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
            onChangeText={text => { setHoldHint(false); p.onChange(text); }}
            placeholder={p.placeholder ?? 'Napiši poruku'} placeholderTextColor={sys.color.muted} multiline maxLength={4000}
            onContentSizeChange={event => {
              const measured = Math.ceil(event.nativeEvent.contentSize.height);
              if (!Number.isFinite(measured) || measured <= 0) return;
              const nextHeight = Math.max(48, Math.min(132, measured));
              setInputHeight(previous => previous === nextHeight ? previous : nextHeight);
              const oneLine = sys.type.body.lineHeight * textScale + 20;
              if (!stackedComposer && p.value.length > 8 && measured > oneLine + 8) setExpandedDraft(true);
            }}
            // A field that cannot be edited now says so in its ink: the words in it are held, not a draft to change.
            style={[s.input, { height: inputHeight }, stackedComposer && s.inputExpanded, !p.canEdit && s.inputOff]} />
          <View testID="ai-composer-tools" style={[s.composerTools, stackedComposer && s.toolsBelow]}>
            {p.voice ? <VoiceComposer {...p.voice} size={52} onTooShort={() => setHoldHint(true)} /> : null}
          {sendShown ? <Press testID="ai-send" accessibilityRole="button" accessibilityLabel={p.pending ? 'Pošalji ponovo' : 'Pošalji poruku'}
            accessibilityHint={sendReason ?? undefined} accessibilityState={{ disabled: !p.canSend }} disabled={!p.canSend}
            onPress={() => { if (!p.canSend) return; latest(false); p.onSend(); }} haptic={p.canSend ? 'light' : 'none'} hitSlop={0} style={s.target}>
            <View style={[s.round, s.send, !p.canSend && s.roundOff]}>
              <PaperPlaneTilt size={22} weight="fill" color={p.canSend ? sys.color.onGreen : sys.color.muted} /></View>
          </Press> : p.voice ? <Press testID="ai-voice-mode" accessibilityRole="button" accessibilityLabel="Razgovaraj glasom"
            accessibilityHint="Govoriš umesto da kucaš; odgovor stiže kao tekst."
            accessibilityState={{ disabled: p.voice.disabled || !voiceIdle }} disabled={p.voice.disabled || !voiceIdle}
            haptic="select" hitSlop={0} onPress={() => { Keyboard.dismiss(); setVoiceReview(false); setVoiceMode(true); }} style={s.target}>
            <View style={[s.round, s.voiceRound, (p.voice.disabled || !voiceIdle) && s.roundOff]}>
              <Waveform size={22} weight="bold" color={p.voice.disabled || !voiceIdle ? sys.color.muted : sys.color.ink} /></View>
          </Press> : null}
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
    {voiceMode && p.voice ? <VoiceMode voice={p.voice} prompt={p.welcome} answer={answer} said={said}
      thinking={p.busy && !p.streamingText} reviewFirst={voiceReview}
      onClose={reason => { setVoiceMode(false); if (reason === 'review') requestAnimationFrame(() => input.current?.focus()); }} /> : null}
    {p.children}
    {notice.sheet}
  </SafeAreaView></DraftDisclosure.Provider>;
}

/** Speaker identity stays explicit without repeating the product logo throughout the transcript. */
function Mark() {
  return <View testID="ai-assistant-mark" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.mark}>
    <AiAssistantArt size={24} />
  </View>;
}

/** One of three dots that rise and fall while an answer is being written. */
function TypingDot({ index, reduced }: { index: number; reduced: boolean }) {
  const life = useRef(new NativeAnimated.Value(0)).current;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    life.stopAnimation();
    life.setValue(0);
    if (reduced || !foreground) return;
    const timing = (toValue: number) => NativeAnimated.timing(life, { toValue, duration: 520,
      easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false });
    const run = NativeAnimated.sequence([NativeAnimated.delay(index * 140),
      NativeAnimated.loop(NativeAnimated.sequence([timing(1), timing(0)]))]);
    run.start();
    return () => run.stop();
  }, [index, life, reduced, foreground]);
  const style = { opacity: life.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] }),
    transform: [{ translateY: life.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] };
  return reduced || !foreground ? <View style={[s.dot, s.dotStill]} /> : <NativeAnimated.View style={[s.dot, style]} />;
}

/**
 * One turn. The assistant has a reading surface under its speaker label; the person's bubble is aligned right.
 * Persisted turns do not rerender for each keystroke or incoming chunk. Side, colour and shape say who is speaking; the
 * labels are for a screen reader.
 */
const Turn = memo(function Turn({ fromAi, body, reduced, showSpeaker, emphasis = 'plain' }: ConversationMessage & {
  reduced: boolean; showSpeaker: boolean; emphasis?: 'plain' | 'question' | 'earlier';
}) {
  const entering = reduced ? undefined : FadeInDown.duration(sys.motion.enter).withInitialValues({ transform: [{ translateY: 8 }] });
  return fromAi
    ? <Animated.View entering={entering} accessibilityLabel={`USKOČI: ${body}`} style={s.assistant}>
      {showSpeaker ? <Mark /> : null}<T selectable style={emphasis === 'question' ? s.question : emphasis === 'earlier' ? s.earlier : s.answer}>{body}</T></Animated.View>
    : <Animated.View entering={entering} accessibilityLabel={`Ti: ${body}`} style={s.person}>
      <T selectable style={s.personText}>{body}</T></Animated.View>;
});

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.conversation.ground }, flex: { flex: 1, minHeight: 0 },
  cardArea: { flexGrow: 0, flexShrink: 1, paddingHorizontal: sys.space.lg },
  cardContents: { paddingTop: 2, paddingBottom: sys.space.md },
  cardAreaCompact: { paddingTop: 0, paddingBottom: sys.space.sm },
  thread: { flexGrow: 1, paddingHorizontal: sys.space.lg, paddingTop: sys.space.md, paddingBottom: sys.space.md },
  turns: { gap: 20 }, inlineContext: { paddingBottom: 20 },
  threadEmpty: { justifyContent: 'center', paddingBottom: sys.space.lg },
  welcome: { gap: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.sm, maxWidth: 440, width: '100%', alignSelf: 'center' },
  presence: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  welcomeTitle: { ...sys.type.title, fontWeight: '600', color: sys.color.ink, textAlign: 'center' },
  welcomeCopy: { lineHeight: 24, textAlign: 'center' },
  openings: { gap: sys.space.sm, marginTop: sys.space.sm },
  // Three illustrated ways into the person's task, not generic command chips.
  opening: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: sys.space.sm,
    borderRadius: 16, backgroundColor: sys.conversation.surface, borderWidth: 1, borderColor: sys.conversation.edge },
  openingArt: { width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center' },
  openingText: { flex: 1, ...sys.type.copy, color: sys.color.ink },
  privacy: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', maxWidth: '100%' },
  // Long replies read on the canvas; alignment and the group label identify the speaker.
  assistant: { gap: 8, alignSelf: 'stretch', paddingVertical: 4, paddingHorizontal: 2 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // The type scale's own voice for a sentence said in the conversation (review r4 ra item 11; it was a raw 17/27).
  answer: { ...sys.type.speech, color: sys.color.ink },
  // One question at a time (`questionFocus`): the latest question in the larger speech of voice mode, what came before it quieter.
  question: { ...sys.type.speechLarge, color: sys.color.ink },
  earlier: { ...sys.type.copy, color: sys.color.muted },
  // Own words have a distinct alignment and high-contrast ink fill.
  person: { alignSelf: 'flex-end', maxWidth: '90%', marginLeft: 24, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: sys.radius.card, borderBottomRightRadius: 8, backgroundColor: sys.color.ink },
  personText: { ...sys.type.body, color: sys.conversation.onUser },
  /** Sent, not yet confirmed by a read: present and readable, visibly not yet part of the record. */
  sending: { opacity: 0.85 },
  // One line of the answer's type (`speech`, 26), so the dots sit where the first line of the answer will.
  typing: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap', minHeight: 28, paddingLeft: 2 },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center', height: 26 },
  dot: { width: 7, height: 7, borderRadius: sys.radius.pill, backgroundColor: sys.color.artRole.ai.front },
  dotStill: { opacity: 0.55 },
  recovery: { gap: 10, padding: 14, borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  actions: { gap: 10 },
  latestRegion: { flexShrink: 0, paddingHorizontal: sys.space.md, backgroundColor: sys.conversation.ground },
  latest: { alignSelf: 'center', maxWidth: '100%', minHeight: 48, flexDirection: 'row', gap: 8,
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface },
  latestText: { flexShrink: 1, color: sys.color.ink, fontWeight: '600' },
  footer: { paddingHorizontal: sys.space.md, paddingTop: sys.space.xs, paddingBottom: sys.space.sm, gap: sys.space.sm, backgroundColor: sys.conversation.ground },
  reason: { paddingHorizontal: sys.space.sm },
  // One ordinary horizontal pill; only a wrapped draft or limited reading space moves tools below.
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: sys.radius.sheet, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.conversation.surface,
    ...sys.elevation.soft },
  pillFocused: { borderColor: sys.color.ink },
  pillExpanded: { paddingBottom: 64 },
  composerTools: { flexDirection: 'row', alignItems: 'center' },
  attachmentSlot: { width: 48 },
  attachmentBelow: { position: 'absolute', left: 8, bottom: 8 },
  toolsBelow: { position: 'absolute', right: 8, bottom: 6, minHeight: 52 },
  toolCircle: { width: 40, height: 40, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    alignItems: 'center', justifyContent: 'center' },
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  input: withInter({ ...sys.type.body, flex: 1, color: sys.color.ink, minWidth: 0, minHeight: 48, maxHeight: 132,
    paddingHorizontal: 8, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'top' }),
  inputExpanded: { paddingHorizontal: 12 },
  inputOff: { color: sys.color.muted },
  round: { width: 44, height: 44, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  send: { backgroundColor: sys.color.ink },
  voiceRound: { backgroundColor: sys.color.artRole.location.soft },
  // Disabled is a quiet wash with a muted glyph, never a faded ghost of the live control.
  roundOff: { backgroundColor: sys.color.wash },
});
