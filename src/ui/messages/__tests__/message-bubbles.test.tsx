import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AgreementVoiceController } from '../../../hooks/useAgreementVoice';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import { sys } from '../../system/tokens';
import { PhotoBubble, TextBubble, VoiceBubble } from '../MessageBubbles';
import { MessageMark } from '../MessageMark';
import type { ThreadMessage } from '../threadModel';

/**
 * Text, photo and voice in ONE shape (proposal R1, team T3c). What each body keeps from the older chat: one spoken summary per
 * message, never swallowing what a person can act on inside a bubble (the play button, a photo's own retry), and the long press
 * that offers a message to support staying reachable.
 */
let tree: ReactTestRenderer;
const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
const texts = (node = tree.root) => node.findAll(child => String(child.type) === 'T').flatMap(child => child.children.filter(c => typeof c === 'string')).join(' ');
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const summary = (label: string) => ({ accessibilityRole: 'button' as const, accessibilityLabel: label, accessibilityHint: 'Dugi pritisak nudi prijavu podršci.',
  onLongPress: jest.fn(), haptic: 'select' as const, scaleTo: 1 as const });
const common = (over: Record<string, unknown> = {}) => ({ mine: true, first: true, last: true, afterSeparator: false, summary: summary('Ti: poruka'),
  mark: <MessageMark kind="sent" />, ...over });
const draw = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('text bubble', () => {
  it('is one summary stop holding the words and the mark, in the shape of its place in the run', async () => {
    await draw(<TextBubble {...common({ summary: summary('Ti: Stižem uskoro., Danas, 14:12, poslato') })} lines={['Stižem uskoro.']} />);
    const stop = press('Ti: Stižem uskoro., Danas, 14:12, poslato');
    expect(flat(stop.props.style)).toMatchObject({ alignSelf: 'flex-end', backgroundColor: sys.conversation.user, borderBottomRightRadius: sys.space.sm });
    expect(texts(stop)).toBe('Stižem uskoro.');
    // The mark is inside the bubble, after the words, and says its state by name.
    expect(stop.findAllByProps({ accessibilityRole: 'image' })[0].props.accessibilityLabel).toBe('Poslato');
    expect(stop.props.haptic).toBe('select');
  });

  it('has the words in white on mine and in ink on theirs, with no mark for theirs', async () => {
    await draw(<TextBubble {...common({ mine: false, mark: null, summary: summary('Marko: Zdravo') })} lines={['Zdravo']} />);
    const stop = press('Marko: Zdravo');
    expect(flat(stop.props.style)).toMatchObject({ alignSelf: 'flex-start', borderWidth: 1, borderColor: sys.conversation.edge });
    expect(flat(stop.findByType('T' as never).props.style).color).toBe(sys.color.ink);
    expect(stop.findAllByProps({ accessibilityRole: 'image' })).toHaveLength(0);
  });

  it('a failed send keeps the same shape in the danger wash with ink words and no mark', async () => {
    await draw(<TextBubble {...common({ failed: true, mark: null })} lines={['Nije stiglo']} />);
    const stop = press('Ti: poruka');
    expect(flat(stop.props.style).backgroundColor).toBe(sys.color.dangerSoft);
    expect(flat(stop.findByType('T' as never).props.style).color).toBe(sys.color.ink);
  });

  it('names the sender once, at the start of another person\'s run, when asked (a group)', async () => {
    await draw(<TextBubble {...common({ mine: false, mark: null })} sender="Bojana" lines={['Evo me.']} />);
    expect(texts()).toBe('Bojana Evo me.');
  });

  it('closes up under the bubble above in a run and leaves air above a new one', async () => {
    await draw(<TextBubble {...common({ first: false })} lines={['b']} />);
    expect(flat(press('Ti: poruka').props.style).marginTop).toBe(3);
    await act(async () => tree.update(<TextBubble {...common({ first: true })} lines={['b']} />));
    expect(flat(press('Ti: poruka').props.style).marginTop).toBe(sys.space.md);
    await act(async () => tree.update(<TextBubble {...common({ first: true, afterSeparator: true })} lines={['b']} />));
    expect(flat(press('Ti: poruka').props.style).marginTop).toBe(sys.space.xs);
  });
});

describe('photo bubble', () => {
  const PhotoTile = 'photoTile' as unknown as React.ElementType;
  const photos = [<PhotoTile key="1" id="1" />];

  it('with a caption: the caption is the summary stop and the mark closes its line; the photos are not inside the stop', async () => {
    await draw(<PhotoBubble {...common({ summary: summary('Ti: Evo kako izgleda, 1 fotografija, Danas, 12:00, poslato') })} caption="Evo kako izgleda" photos={photos} />);
    const stop = press('Ti: Evo kako izgleda, 1 fotografija, Danas, 12:00, poslato');
    expect(texts(stop)).toBe('Evo kako izgleda');
    expect(stop.findAllByProps({ accessibilityRole: 'image' })[0].props.accessibilityLabel).toBe('Poslato');
    expect(stop.findAllByType('photoTile' as never)).toHaveLength(0);
    expect(tree.root.findAllByType('photoTile' as never)).toHaveLength(1);
    // A caption means no second strip: one stop only.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Ti: Evo kako izgleda, 1 fotografija, Danas, 12:00, poslato' }).filter(n => String(n.type) === 'Press')).toHaveLength(1);
  });

  it('without a caption: the frame of the bubble is the stop, laid UNDER the photos, and the mark of my message stands over their corner', async () => {
    await draw(<PhotoBubble {...common({ summary: summary('Ti: 1 fotografija, Danas, 12:00, poslato') })} caption={null} photos={photos} />);
    const stop = press('Ti: 1 fotografija, Danas, 12:00, poslato');
    // A sibling, painted first (behind), filling the bubble: the photos are never inside it and a tap on a photo reaches the photo.
    expect(flat(stop.props.style)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
    expect(stop.findAllByType('photoTile' as never)).toHaveLength(0);
    const bubble = stop.parent!;
    expect(bubble.children.indexOf(stop)).toBeLessThan(bubble.children.findIndex(child => typeof child !== 'string' && String(child.type) === 'photoTile'));
    // No band is added under the photos, and the mark sits on a dim chip over the photograph, out of the screen reader's way.
    const chip = tree.root.findAll(node => String(node.type) === 'View' && node.props.pointerEvents === 'none')[0];
    expect(chip.findAllByProps({ accessibilityRole: 'image' })[0].props.accessibilityLabel).toBe('Poslato');
    expect(chip.props.accessibilityElementsHidden).toBe(true);
    expect(flat(chip.props.style)).toMatchObject({ position: 'absolute', backgroundColor: sys.color.scrim });
  });

  it('theirs: the same frame is the stop, with no mark and no chip, so the photos keep the whole bubble', async () => {
    await draw(<PhotoBubble {...common({ mine: false, mark: null, summary: summary('Marko: 1 fotografija, Danas, 12:00') })} caption={null} photos={photos} />);
    const stop = press('Marko: 1 fotografija, Danas, 12:00');
    expect(flat(stop.props.style)).toMatchObject({ position: 'absolute' });
    expect(tree.root.findAllByProps({ accessibilityRole: 'image' })).toHaveLength(0);
    expect(tree.root.findAll(node => String(node.type) === 'View' && node.props.pointerEvents === 'none')).toHaveLength(0);
  });

  it('is the same shape as the text bubble and as wide as the photos need', async () => {
    await draw(<PhotoBubble {...common()} caption={null} photos={photos} />);
    const bubble = tree.root.findAll(node => String(node.type) === 'View' && flat(node.props.style).alignSelf === 'flex-end')[0];
    expect(flat(bubble.props.style)).toMatchObject({ backgroundColor: sys.conversation.user, borderBottomRightRadius: sys.space.sm, padding: 4, width: 228 });
  });
});

describe('voice bubble', () => {
  const glas = { assetId: 'aaaaaaaa-0000-4000-8000-000000000001', trajanjeMs: 14_000, velicina: 1000 };
  const message = { id: 'm1', moja: true, posiljalacIme: 'Ja', telo: '', vremeTekst: '', procitano: null, glas } as ThreadMessage;
  const controller = (over: Record<string, unknown> = {}) => ({
    playback: { assetId: null, status: 'idle', positionMs: 0, durationMs: 0, error: null }, toggle: jest.fn().mockResolvedValue(undefined), ...over,
  }) as unknown as AgreementVoiceController;
  const bubble = (voice: AgreementVoiceController, over: Record<string, unknown> = {}) =>
    <VoiceBubble {...common({ summary: summary('Ti: glasovna poruka 0:14, Danas, 14:12, poslato'), ...over })} voice={voice} message={message} />;

  it('is a play control, a progress line and the duration, with the summary stop beside the control, never around it', async () => {
    const voice = controller();
    await draw(bubble(voice));
    expect(texts()).toBe('0:14');
    const play = press('Preslušaj glasovnu poruku, 0:14');
    expect(play.props.accessibilityRole).toBe('button');
    expect(flat(play.props.style)).toMatchObject({ width: 48, height: 48 });
    const stop = press('Ti: glasovna poruka 0:14, Danas, 14:12, poslato');
    expect(stop.findAllByProps({ accessibilityLabel: 'Preslušaj glasovnu poruku, 0:14' })).toHaveLength(0);
    expect(play.findAllByProps({ accessibilityRole: 'image' })).toHaveLength(0);
    expect(stop.findAllByProps({ accessibilityRole: 'image' })[0].props.accessibilityLabel).toBe('Poslato');
    await act(async () => play.props.onPress());
    expect(voice.toggle).toHaveBeenCalledWith(message);
  });

  it('shows the player\'s position over the stored length as the progress, and "0:03 / 0:14" while it plays; pause is its name then', async () => {
    const voice = controller({ playback: { assetId: glas.assetId, status: 'playing', positionMs: 3_500, durationMs: 14_000, error: null } });
    await draw(bubble(voice));
    expect(texts()).toBe('0:03 / 0:14');
    expect(flat(tree.root.findByProps({ testID: 'voice-progress' }).props.style).width).toBe('25%');
    expect(press('Pauziraj glasovnu poruku, 0:14')).toBeTruthy();
  });

  it('stays at zero for a different message that owns the speaker (one speaker at a time)', async () => {
    const voice = controller({ playback: { assetId: 'someone-else', status: 'playing', positionMs: 9_000, durationMs: 20_000, error: null } });
    await draw(bubble(voice));
    expect(texts()).toBe('0:14');
    expect(flat(tree.root.findByProps({ testID: 'voice-progress' }).props.style).width).toBe('0%');
    expect(press('Preslušaj glasovnu poruku, 0:14')).toBeTruthy();
  });

  it('disables the control while it loads and says it is busy', async () => {
    const voice = controller({ playback: { assetId: glas.assetId, status: 'loading', positionMs: 0, durationMs: 14_000, error: null } });
    await draw(bubble(voice));
    const play = press('Preslušaj glasovnu poruku, 0:14');
    expect(play.props.disabled).toBe(true); expect(play.props.accessibilityState).toEqual({ busy: true, disabled: true });
    expect(play.findAllByType('ActivityIndicator' as never)).toHaveLength(1);
  });

  it('offers to load it again after a failure, and says why in the player\'s own sentence', async () => {
    const error = { code: 'PLAYBACK_FAILED', message: 'Glasovna poruka se ne može pustiti. Pokušaj ponovo.' };
    const voice = controller({ playback: { assetId: glas.assetId, status: 'error', positionMs: 0, durationMs: 14_000, error } });
    await draw(bubble(voice));
    expect(press('Ponovo učitaj glasovnu poruku, 0:14')).toBeTruthy();
    expect(texts()).toContain(error.message);
    expect(texts()).toContain('0:14');
  });

  it('theirs is white with a charcoal play control, mine charcoal with a white one, in the same shape', async () => {
    await draw(bubble(controller()));
    const mineBubble = tree.root.findAll(node => String(node.type) === 'View' && flat(node.props.style).alignSelf === 'flex-end' && flat(node.props.style).width === 228)[0];
    expect(flat(mineBubble.props.style)).toMatchObject({ backgroundColor: sys.conversation.user, borderBottomRightRadius: sys.space.sm });
    await act(async () => tree.update(bubble(controller(), { mine: false, mark: null, summary: summary('Marko: glasovna poruka 0:14, Danas, 14:12') })));
    const theirBubble = tree.root.findAll(node => String(node.type) === 'View' && flat(node.props.style).alignSelf === 'flex-start' && flat(node.props.style).width === 228)[0];
    expect(flat(theirBubble.props.style)).toMatchObject({ backgroundColor: sys.conversation.surface, borderWidth: 1, borderBottomLeftRadius: sys.space.sm });
  });

  it('draws nothing for a message that carries no voice', async () => {
    await draw(<VoiceBubble {...common()} voice={controller()} message={{ ...message, glas: undefined }} />);
    expect(tree.toJSON()).toBeNull();
  });
});
