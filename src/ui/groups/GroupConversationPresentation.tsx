import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users } from 'phosphor-react-native';
import type { GroupMessage } from '../../data/groupConversationService';
import { inicijali } from '../../lib/inicijali';
import { serbianToday } from '../calendar/serbianDays';
import { TextBubble } from '../messages/MessageBubbles';
import { MessageMark } from '../messages/MessageMark';
import { MARK_WORDS, buildThread, messageSpoken, type ThreadMessage } from '../messages/threadModel';
import { T } from '../Text';
import { Appear, useAppear } from '../system/Appear';
import { Avatar } from '../system/Avatar';
import { PillComposer, PillNote } from '../system/PillComposer';
import { ChromeIconButton, ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { brandAction, sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { V2Action } from '../v2/V2Action';
import type { GroupState } from './GroupConversationController';
import { ConversationChannels } from './ConversationChannels';

type Group = NonNullable<NonNullable<GroupState['context']>['group']>;
type Member = Group['members'][number];
/** The one sentence a finished group conversation says where the pill would be (the same as a closed Dogovor's, in the group's word). */
export const GROUP_CLOSED_SENTENCE = 'Razgovor je završen. Poruke možeš samo da čitaš.';
// The management block is the requester's alone, so a finish that waits on the requester waits on the person reading it.
const status = (value: string) => ({ CONFIRMED: 'Važeći Dogovor', AWAITING_REQUESTER: 'Čeka tvoju potvrdu završetka', COMPLETED: 'Završen', CANCELLED: 'Otkazan' }[value] ?? 'Dogovor');
/** The counter appears only near the limit, as in Poruke. */
const LIMIT = 2000, NEAR = 1800;

export type GroupConversationPresentationProps = {
  state: GroupState; draft: string; showPeople: boolean; listKey: number;
  /** The draft's length as the group counts it, and whether it is a message that can go (the screen's own rule). */
  draftLength: number; draftSendable: boolean;
  viewability: { viewAreaCoveragePercentThreshold: number; minimumViewTime: number };
  onVisible: (info: { viewableItems: ViewToken<GroupMessage>[] }) => void;
  onBack: () => void; onTogglePeople: () => void; onRefresh: () => void; onOlder: () => void; onManagementNext: () => void;
  backLabel?: string;
  onPrivate?: (id: string) => void;
  onOpenAgreement: (id: string) => void; onDraft: (value: string) => void; onSend: () => void; onAcknowledge: () => void;
  /** The member's photo, drawn by the screen (it reads media); the gallery leaves it out and the initials stand. */
  photo?: (member: Member, fallback: ReactNode) => ReactNode;
  /** The support entry under a message, drawn by the screen (it opens support); the gallery leaves it out. */
  support?: (message: GroupMessage) => ReactNode;
};

/**
 * The shared conversation of a group task, in the look of Poruke (round 6): the other people's messages on the left,
 * white with the card edge and the name at the start of their turn, mine on the right on pale green, the clock small,
 * and the floating pill to write in. A short thread sits on the composer, where a reply is written, and a state stands
 * in the middle; the header copy and the states keep the screens' 20 dp gutter while the bubbles stay on Poruke's 16.
 * The people of the group sit behind the bar's people button. Presentation only: the screen owns the controller, the
 * journal, the read marking of truly visible rows and every fence.
 */
export function GroupConversationPresentation(p: GroupConversationPresentationProps) {
  const { state } = p, group = state.context?.group ?? null, ready = state.phase === 'READY';
  const retry = state.phase === 'UNKNOWN' && state.canRetry;
  const olderUnavailable = state.phase === 'ERROR' && state.olderPageUnavailable && !!group && state.messages.length > 0;
  const first = state.phase === 'LOADING' && !state.messages.length && !group;
  // As in Poruke: a thread is anchored to the composer, a state (the first read, an error, nothing to show) to the middle.
  const centred = first || (state.phase === 'ERROR' && !olderUnavailable) || (ready && (!group || state.messages.length === 0));
  const me = state.context?.accountId;
  // The pull spinner answers a pull only; a read of its own does not raise it (the owner's "dot", 8 Oct 2026).
  const pull = usePullRefresh(p.onRefresh, state.phase === 'LOADING' && state.messages.length > 0);
  // In a conversation the arrival IS the message. The history that was already there settles silently, "Starije poruke"
  // does not replay the thread, and only a message that has just landed moves.
  const appear = useAppear();
  // Which message the person is holding, for the support path (as in Poruke: it stood under every message).
  const [chosen, setChosen] = useState<string | null>(null);
  const toggle = (id: string) => setChosen(current => current === id ? null : id);
  appear.settle(state.messages.map(message => message.messageId));
  const length = p.draftLength;
  const composer = (ready && group?.canSend) || retry;
  const name = (message: GroupMessage) => message.mine ? 'Ti' : group?.members.find(member => member.accountId === message.senderAccountId)?.displayName ?? 'Učesnik';
  // The same runs, Serbian day lines and tails as the Dogovor's conversation (proposal R): the group only adds the sender's
  // name at the start of another person's run. The thread is text only (decision A07).
  const today = serbianToday();
  const thread = useMemo(() => buildThread(state.messages.map((message): ThreadMessage => ({ id: message.messageId, moja: message.mine,
    posiljalacAccountId: message.senderAccountId, posiljalacIme: name(message), telo: message.body, vremeTekst: '', procitano: null,
    createdAt: message.createdAt }))), [state.messages, group, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const header =<View style={[s.stack, s.gutter]}>
    {first ? <StateView kind="loading" title="Učitavamo razgovor…" skeleton={{ count: 2, rows: 2 }} /> : null}
    {state.phase === 'ERROR' && !olderUnavailable ? <StateView kind="error" art="chat" title="Razgovor nije učitan" body={state.message ?? undefined}
      primary={{ label: 'Pokušaj ponovo', onPress: p.onRefresh }} /> : null}
    {group ? <>
      <T variant="copy" tone="muted">Zajedničke poruke za koordinaciju zadatka. Cenu, lične uslove i probleme dogovori u svom privatnom Dogovoru.</T>
      {/* A finished conversation says so once, where the pill would be. */}
      {!group.terminal && !group.canSend ? <T variant="meta" tone="muted">Dostupna istorija razgovora</T> : null}
      {p.showPeople ? <View style={s.people}>
        {group.members.map(member => {
          const fallback = <Avatar initials={inicijali(member.displayName)} size={40} />;
          // The read lists the requester and every member, the reader included: their own row says so.
          const role = member.role === 'REQUESTER' ? 'Traži pomoć' : 'Učesnik';
          return <View key={member.accountId} style={s.member}>
            {p.photo ? p.photo(member, fallback) : fallback}
            <View style={s.flex}><T variant="bodyStrong">{member.displayName}</T><T variant="meta" tone="muted">{member.accountId === me ? `Ti · ${role}` : role}</T></View>
          </View>;
        })}
        {group.members.length === 0 ? <T variant="meta" tone="muted">Prikazana je ranije dostupna istorija.</T> : null}
        {group.role === 'REQUESTER' ? <View style={[s.stack, s.parted]}>
          <T variant="heading" accessibilityRole="header">Tvoji pojedinačni Dogovori</T><T variant="meta" tone="muted">Ovo vidiš samo ti.</T>
          {(group.management ?? []).map(item => <View key={item.agreementId} style={s.managed}>
            <T variant="body">{group.members.find(member => member.accountId === item.accountId)?.displayName ?? 'Učesnik'} · {status(item.executionState ?? item.status)}</T>
            {item.problemOpened ? <T variant="meta" tone="muted">Privatan problem u Dogovoru</T> : null}
            <V2Action label="Otvori pojedinačni Dogovor" compact onPress={() => p.onOpenAgreement(item.agreementId)} />
          </View>)}
          {group.managementNextId ? <V2Action label="Još pojedinačnih Dogovora" kind="quiet" onPress={p.onManagementNext} /> : null}
        </View> : null}
      </View> : null}
    </> : ready ? <StateView kind="empty" art="users" title="Grupni razgovor još nije otvoren"
      body="Grupni razgovor se otvara kad su za ovaj zadatak izabrane najmanje dve osobe. Tvoj privatni Dogovor je i dalje dostupan." /> : null}
    {state.message && (state.phase !== 'ERROR' || olderUnavailable) ? <T variant="copy" accessibilityLiveRegion="polite">{state.message}</T> : null}
    {state.before ? <V2Action label={olderUnavailable ? 'Ponovo učitaj starije poruke' : 'Starije poruke'} kind="quiet" disabled={!ready && !olderUnavailable} onPress={p.onOlder} /> : null}
    {/* A member admitted later reads the group from their admission on, so an empty thread is honest about what it shows. */}
    {ready && group && state.messages.length === 0 ? <StateView kind="empty" art="chat" title="Još nema poruka"
      body={group.canSend ? 'Vidiš poruke od svog ulaska u grupu. Napiši prvu.' : 'Vidiš poruke od svog ulaska u grupu.'} /> : null}
    {/* New messages come on focus, after my own send or by pulling down, and a screen reader cannot easily pull: as in
        Poruke the refresh is also a quiet action at the head of the thread, centred, under the empty state's words when
        there is none, and never on a finished conversation, where nothing new can arrive. */}
    {ready && group && !group.terminal ? <V2Action label="Osveži poruke" kind="quiet" style={s.centred} onPress={p.onRefresh} /> : null}
  </View>;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ScreenChrome variant="detail" title={group?.title ?? 'Grupni razgovor'} subtitle={group ? 'Grupni razgovor' : undefined}
      backLabel={p.backLabel ?? 'Nazad na Dogovor'} onBack={p.onBack}
      right={group ? <ChromeIconButton label="Učesnici razgovora" icon={Users} active={p.showPeople} onPress={p.onTogglePeople} /> : undefined} />
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {state.context?.group && p.onPrivate ? <View style={s.gutter}><ConversationChannels context={state.context} selected="group" disabled={!ready}
        onGroup={() => undefined} onPrivate={p.onPrivate} onMore={p.onManagementNext} /></View> : null}
      <FlatList key={p.listKey} data={state.messages} keyExtractor={item => item.messageId} contentContainerStyle={[s.content, centred ? s.listCentred : s.listBottom]} keyboardShouldPersistTaps="handled"
        onViewableItemsChanged={p.onVisible} viewabilityConfig={p.viewability} refreshing={pull.refreshing} onRefresh={pull.onRefresh}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => {
          const entry = thread[index];
          if (!entry) return null;
          // Mine carries the one small mark: sent, because the group's read holds it. A group has no single reader, so it is never "seen".
          const mark = item.mine ? 'sent' as const : null;
          const sender = group?.members.find(member => member.accountId === item.senderAccountId);
          return <Appear index={index} animate={appear.isNew(item.messageId)}>
            {entry.separator ? <T accessibilityRole="header" variant="label" tone="muted" style={s.day}>{entry.separator}</T> : null}
            {entry.first ? <View testID={`group-message-sender-${item.messageId}`} style={[s.member, item.mine && s.supportMine]}>
              <Avatar initials={sender ? inicijali(sender.displayName) : null} size={40} />
              <T variant="note" tone="muted">{sender?.displayName ?? name(item)}</T>
            </View> : null}
            {/* A tap (or a long press, or the screen reader's action) offers the message to support: the entry that stood
                under every message is one step away, never behind a gesture alone (review r6). Without support the
                bubble is text, not a button. */}
            <TextBubble lines={[item.body]} mine={item.mine} first={entry.first} last={entry.last} afterSeparator={entry.separator !== null}
              sender={null} mark={mark ? <MessageMark kind={mark} /> : null}
              summary={{ accessibilityRole: p.support ? 'button' : 'text',
                accessibilityLabel: messageSpoken({ moja: item.mine, posiljalacIme: name(item), telo: item.body }, entry.moment, mark ? MARK_WORDS[mark].toLowerCase() : undefined),
                accessibilityHint: p.support ? 'Dodirom prijavljuješ poruku podršci.' : undefined, haptic: p.support ? 'select' : 'none', scaleTo: 1,
                disabled: !p.support, onPress: p.support ? () => toggle(item.messageId) : undefined,
                onLongPress: p.support ? () => toggle(item.messageId) : undefined,
                accessibilityActions: p.support ? [{ name: 'activate', label: 'Izaberi ovu poruku za podršku' }] : undefined,
                onAccessibilityAction: p.support ? () => toggle(item.messageId) : undefined }} />
            {p.support && chosen === item.messageId ? <View style={[s.support, item.mine ? s.supportMine : s.supportTheirs]}>{p.support(item)}</View> : null}
          </Appear>;
        }}
        ListFooterComponent={<View style={[s.stack, s.gutter]}>
          {state.phase === 'SENDING' ? <T variant="meta" tone="muted" accessibilityLiveRegion="polite">Čekamo potvrdu slanja…</T> : null}
          {state.phase === 'UNKNOWN' ? <V2Action label="Proveri da li je poruka stigla" style={brandAction} onPress={p.onRefresh} /> : null}
          {state.phase === 'CONFIRMED' ? <V2Action label="Nastavi razgovor" style={brandAction} onPress={p.onAcknowledge} /> : null}
        </View>} />
      {composer ? <PillComposer value={p.draft} onChange={p.onDraft} label={retry ? 'Upiši istu poruku' : 'Poruka grupi'}
        placeholder={retry ? 'Prvobitna poruka…' : 'Napiši poruku grupi…'} sendLabel={retry ? 'Ponovi slanje iste poruke' : 'Pošalji poruku grupi'}
        canSend={p.draftSendable} reason={length === 0 ? 'Upiši poruku pre slanja.' : length > LIMIT ? 'Poruka je duža od 2.000 znakova.' : null}
        onSend={p.onSend} maxLength={4000}
        above={<>
          {retry ? <PillNote>Prvobitna poruka</PillNote> : null}
          {length > NEAR ? <PillNote tone={length > LIMIT ? 'danger' : 'muted'}>{length.toLocaleString('sr-Latn-RS')} / 2.000 znakova</PillNote> : null}
        </>} />
        : group?.terminal ? <T variant="note" tone="muted" style={s.closed}>{GROUP_CLOSED_SENTENCE}</T> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  // Poruke's list: the bubbles on 16, and the content grows so a short thread can sit on the composer.
  content: { paddingHorizontal: sys.space.base, paddingTop: sys.space.sm, paddingBottom: sys.space.md, gap: 0, flexGrow: 1 },
  listBottom: { justifyContent: 'flex-end' },
  listCentred: { justifyContent: 'center' },
  stack: { gap: sys.space.md, paddingBottom: sys.space.sm },
  // The header copy, the people panel and the states sit on the screens' 20 dp gutter, 4 in from the bubbles' 16.
  gutter: { paddingHorizontal: sys.space.xs },
  centred: { alignSelf: 'center' },
  flex: { flex: 1 },
  people: { gap: sys.space.md, paddingVertical: sys.space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 48 },
  parted: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.cardLine, paddingTop: sys.space.md },
  managed: { gap: sys.space.xs },
  // The bubbles are the Dogovor conversation's (../messages/bubbleShape): one shape, runs with one tail. A day or a pause is a quiet word.
  day: { alignSelf: 'center', marginTop: sys.space.base, marginBottom: sys.space.sm, letterSpacing: 0, fontVariant: ['tabular-nums'] },
  support: { maxWidth: '78%', marginTop: sys.space.xs },
  supportMine: { alignSelf: 'flex-end' }, supportTheirs: { alignSelf: 'flex-start' },
  closed: { textAlign: 'center', paddingHorizontal: sys.space.base, paddingVertical: sys.space.md },
});
