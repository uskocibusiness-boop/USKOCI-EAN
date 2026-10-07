import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { OutboxSnapshot } from '../agreementOutbox';
const mockVoice: Record<string, any> = {};
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { ...native.Platform, OS: 'android' };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../voiceMessagesGate', () => ({ voiceMessagesBuilt: () => true }));
jest.mock('../../hooks/useAgreementVoice', () => ({ useAgreementVoice: () => mockVoice }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/usePressLift', () => ({ usePressLift: () => ({ style: {}, give: jest.fn(), settle: jest.fn() }) }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../../ui/media/AgreementPhotoComposer', () => ({ AgreementPhotoComposer: 'AgreementPhotoComposer', AgreementPhotoSheet: 'AgreementPhotoSheet' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
import { AgreementChat, CLOSED_SENTENCE } from '../../ui/AgreementChat';
import { sys } from '../../ui/system/tokens';
import { forgetAutoResendForTests } from '../../ui/messages/threadModel';

/**
 * Voice in the conversation (team T3c): a voice message is a bubble in the same shape as text and photo, with a play control, a
 * progress line and its length; it plays through the chat's own controller (the process-wide audio arbiter is behind it, and is
 * not touched here); and the composer is the one pill, "+ / text / microphone", where a hold sends on release and a screen reader
 * keeps the review step.
 */
const account = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
const agreement = '20000000-0000-4000-8000-000000000001';
const glas = { assetId: '50000000-0000-4000-8000-000000000001', trajanjeMs: 14_000, velicina: 1000 };
const voiceRow = (moja: boolean) => ({ id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 2, clientMessageId: 'glas_00000001', posiljalacAccountId: moja ? account : other,
  posiljalacIme: moja ? 'Ja' : 'Marko', moja, telo: '', vremeTekst: '14:12', procitano: null, glas });
const outbox = { setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined), retry: jest.fn().mockResolvedValue(undefined), start: jest.fn() } as any;
let tree: ReactTestRenderer;
let props: React.ComponentProps<typeof AgreementChat>;
const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
const texts = (node: ReactTestInstance = tree.root) => node.findAll(child => String(child.type) === 'T').flatMap(child => child.children.filter(c => typeof c === 'string')).join(' ');
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const has = (label: string) => tree.root.findAllByProps({ accessibilityLabel: label }).length > 0;
const idle = { phase: 'idle', elapsedMs: 0, durationMs: null, preview: 'idle', level: null, error: null, canRecord: true, canSend: false, canDiscard: false, canRetry: false, recovered: [] };
async function render(over: Partial<typeof props> = {}) {
  await act(async () => { tree = create(<AgreementChat {...props} {...over} />, { createNodeMock: element => element.type === ('ScrollView' as never) ? { scrollToEnd: jest.fn(), scrollTo: jest.fn() } : null }); });
}
beforeEach(() => {
  jest.clearAllMocks(); forgetAutoResendForTests();
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 1);
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => undefined);
  Object.keys(mockVoice).forEach(key => delete mockVoice[key]);
  Object.assign(mockVoice, {
    recording: { ...idle }, playback: { assetId: null, status: 'idle', positionMs: 0, durationMs: 0, error: null },
    outbox: { retry: jest.fn().mockResolvedValue(undefined), start: jest.fn() }, outboxState: { phase: 'ready', entries: [], error: null },
    review: false, reviewFirst: false, screenReader: false, setReviewFirst: jest.fn(), interactionError: null,
    begin: jest.fn().mockResolvedValue(undefined), endHold: jest.fn().mockResolvedValue(undefined), release: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined), preview: jest.fn(), send: jest.fn().mockResolvedValue(undefined), retry: jest.fn(),
    refreshRecovery: jest.fn(), sendRecovered: jest.fn(), discardRecovered: jest.fn(), toggle: jest.fn().mockResolvedValue(undefined),
  });
  const state: OutboxSnapshot = { phase: 'ready', draft: '', capturing: false, entries: [], error: null };
  props = { messages: [], loading: false, error: false, writable: true, terminal: false, refresh: jest.fn().mockResolvedValue(undefined),
    refreshWorkspace: jest.fn().mockResolvedValue(undefined), outbox, state,
    voiceScope: { accountId: account, accountRevision: 0, agreementId: agreement, version: 2, isCurrent: () => true } };
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });

describe('a voice message in the thread', () => {
  it('is a play control, a progress line and its length, in the shape of a text bubble, and plays through the controller', async () => {
    await render({ messages: [voiceRow(false)] });
    const play = button('Preslušaj glasovnu poruku, 0:14');
    const bubble = tree.root.findAll(node => String(node.type) === 'View' && flat(node.props.style).width === 228)[0];
    expect(flat(bubble.props.style)).toMatchObject({ alignSelf: 'flex-start', backgroundColor: sys.conversation.surface, borderBottomLeftRadius: sys.space.sm });
    expect(texts(bubble)).toBe('0:14');
    await act(async () => play.props.onPress());
    expect(mockVoice.toggle).toHaveBeenCalledWith(expect.objectContaining({ id: voiceRow(false).id, glas }));
  });

  it('mine carries the one small mark and a summary with who, what, when and state; the play control stays its own stop', async () => {
    await render({ messages: [voiceRow(true)] });
    const stop = tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Ti: '))[0];
    expect(stop.props.accessibilityLabel).toBe('Ti: glasovna poruka 0:14, Danas, 14:12, poslato');
    expect(stop.findAll(node => node.props.accessibilityRole === 'image')[0].props.accessibilityLabel).toBe('Poslato');
    expect(stop.findAllByProps({ accessibilityLabel: 'Preslušaj glasovnu poruku, 0:14' })).toHaveLength(0);
  });

  it('shows the progress of the message that has the speaker, and nothing for the others', async () => {
    mockVoice.playback = { assetId: glas.assetId, status: 'playing', positionMs: 7_000, durationMs: 14_000, error: null };
    await render({ messages: [voiceRow(false)] });
    expect(flat(tree.root.findByProps({ testID: 'voice-progress' }).props.style).width).toBe('50%');
    expect(has('Pauziraj glasovnu poruku, 0:14')).toBe(true);
  });

  it('keeps playing in a closed Dogovor, where there is no pill', async () => {
    await render({ terminal: true, writable: false, messages: [voiceRow(false)] });
    await act(async () => button('Preslušaj glasovnu poruku, 0:14').props.onPress());
    expect(mockVoice.toggle).toHaveBeenCalledTimes(1);
    expect(has('Drži za glasovnu poruku')).toBe(false);
    expect(texts()).toContain(CLOSED_SENTENCE);
  });

  it('a voice message sent from this phone stands in the same shape, with a dot while it goes, and is retried through the voice outbox', async () => {
    const command = { accountId: account, agreementId: agreement, clientMessageId: 'glas_00000009', body: '', voice: { agreementVersion: 2, assetId: glas.assetId } };
    mockVoice.outboxState = { phase: 'ready', error: null, entries: [{ command, state: 'unknown', error: 'INVALID_RESPONSE', persisted: true, attempt: 1 }] };
    await render();
    expect(texts()).toContain('Glasovna poruka'); expect(texts()).toContain('Slanje nije potvrđeno');
    await act(async () => button('Pošalji glasovnu poruku ponovo').props.onPress());
    // The explicit retry goes to the voice outbox, never the text one.
    expect(mockVoice.outbox.retry).toHaveBeenCalledWith('glas_00000009');
    expect(outbox.retry).not.toHaveBeenCalled();
  });
});

describe('a voice send the network left unknown', () => {
  const command = { accountId: account, agreementId: agreement, clientMessageId: 'glas_00000010', body: '', voice: { agreementVersion: 2, assetId: glas.assetId } };
  const unknown = (error?: string) => ({ command, state: 'unknown', ...(error ? { error } : {}), persisted: true, attempt: 1 });

  it('is tried once by itself through the VOICE outbox, with the retained command\'s own id, and never through the text outbox', async () => {
    mockVoice.outboxState = { phase: 'ready', error: null, entries: [unknown('UNAVAILABLE')] };
    await render();
    expect(mockVoice.outbox.retry).toHaveBeenCalledTimes(1);
    expect(mockVoice.outbox.retry).toHaveBeenCalledWith('glas_00000010');
    expect(outbox.retry).not.toHaveBeenCalled(); expect(outbox.sendDraft).not.toHaveBeenCalled();
    // A later render with the same unknown entry does not try it again.
    await act(async () => tree.update(<AgreementChat {...props} />));
    expect(mockVoice.outbox.retry).toHaveBeenCalledTimes(1);
  });

  it('waits until the voice outbox itself is ready, so the one automatic try is not spent on a retry that would be ignored, and then takes it', async () => {
    mockVoice.outboxState = { phase: 'loading', error: null, entries: [unknown('UNAVAILABLE')] };
    await render();
    expect(mockVoice.outbox.retry).not.toHaveBeenCalled();
    // The text journal was ready long ago and had nothing to retry; the voice journal becomes ready later and has its own opening.
    mockVoice.outboxState = { phase: 'ready', error: null, entries: [unknown('UNAVAILABLE')] };
    await act(async () => tree.update(<AgreementChat {...props} />));
    expect(mockVoice.outbox.retry).toHaveBeenCalledTimes(1);
    expect(mockVoice.outbox.retry).toHaveBeenCalledWith('glas_00000010');
  });

  it('is left alone when the outcome is not a network one, or the Dogovor is closed', async () => {
    mockVoice.outboxState = { phase: 'ready', error: null, entries: [unknown('INVALID_RESPONSE')] };
    await render();
    expect(mockVoice.outbox.retry).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
    mockVoice.outboxState = { phase: 'ready', error: null, entries: [{ ...unknown('UNAVAILABLE'), command: { ...command, clientMessageId: 'glas_00000011' } }] };
    await render({ terminal: true, writable: false });
    expect(mockVoice.outbox.retry).not.toHaveBeenCalled();
  });
});

describe('the pill with a microphone', () => {
  it('draws "+ / text / microphone" and no send while the draft is empty; the review checkbox is not in the pill', async () => {
    await render();
    expect(has('Drži za glasovnu poruku')).toBe(true);
    expect(has('Dodaj fotografije')).toBe(false); // no photo controller in this scene: only the microphone stands in the toolbar
    expect(flat(button('Pošalji poruku').props.style).display).toBe('none');
    expect(has('Pregledaj snimak pre slanja')).toBe(false);
  });

  it('a hold on the microphone begins on touch and sends on release, through the controller; moving away does neither', async () => {
    await render();
    const mic = button('Drži za glasovnu poruku');
    await act(async () => mic.props.onResponderGrant({ nativeEvent: { pageY: 300 } }));
    expect(mockVoice.begin).toHaveBeenCalledTimes(1);
    await act(async () => mic.props.onResponderMove({ nativeEvent: { pageY: 296 } }));
    expect(mockVoice.cancel).not.toHaveBeenCalled(); expect(mockVoice.release).not.toHaveBeenCalled();
    await act(async () => mic.props.onResponderRelease());
    expect(mockVoice.release).toHaveBeenCalledTimes(1);
  });

  it('typing text swaps the microphone for the send, and clearing it brings the microphone back', async () => {
    await render();
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...props.state, draft: 'Nešto' }} />));
    expect(flat(button('Pošalji poruku').props.style).display).toBeUndefined();
    const micSlot = button('Drži za glasovnu poruku').parent!;
    expect(micSlot).toBeTruthy();
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...props.state, draft: '' }} />));
    expect(flat(button('Pošalji poruku').props.style).display).toBe('none');
  });

  it('with a screen reader the microphone is a start/stop button and the review step stays: the field hides while a recording waits', async () => {
    mockVoice.screenReader = true; mockVoice.review = true;
    await render();
    const mic = button('Snimi glasovnu poruku');
    expect(mic.props.onResponderGrant).toBeUndefined();
    await act(async () => mic.props.onPress());
    expect(mockVoice.begin).toHaveBeenCalledTimes(1);
    mockVoice.recording = { ...idle, phase: 'review', durationMs: 4_000, canSend: true, canDiscard: true };
    await act(async () => tree.update(<AgreementChat {...props} />));
    expect(has('Pošalji snimak')).toBe(true); expect(has('Odbaci snimak')).toBe(true);
    await act(async () => button('Pošalji snimak').props.onPress());
    expect(mockVoice.send).toHaveBeenCalledTimes(1);
    expect(button('Napiši poruku').parent!.props.accessibilityElementsHidden).toBe(true);
  });
});
