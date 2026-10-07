import React from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

import { View } from 'react-native';
import { DownloadSimple } from 'phosphor-react-native';
import { ACTION_MIN_HEIGHT, ACTION_SUCCESS_MS, V2Action } from '../../v2/V2Action';
import { brandAction, sys } from '../tokens';

/**
 * The one action (master design plan, 2026-09-24): a person always sees whether a button can be pressed, is working,
 * went through or did not — and a disabled button still says what it would do.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; jest.useRealTimers(); jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const update = async (element: React.ReactElement) => { await act(async () => tree.update(element)); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
/** The Press as the action asked for it, and the native view it draws. */
const press = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.accessibilityRole === 'button')[0];
const surface = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'button')[0];
const label = (text: string) => tree.root.findAllByType(Text).find(node => node.props.children === text)!;
const checks = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'action-confirmed');
const noop = () => {};

it('is never under 48 px, and the primary is 54 as the brand action', async () => {
  for (const kind of ['secondary', 'quiet', 'destructive'] as const) {
    await render(<V2Action label="Sačuvaj" kind={kind} onPress={noop} />);
    expect(flat(surface()).minHeight).toBe(ACTION_MIN_HEIGHT);
    expect(ACTION_MIN_HEIGHT).toBeGreaterThanOrEqual(48);
  }
  await render(<V2Action label="Sačuvaj" kind="primary" onPress={noop} />);
  expect(flat(surface()).minHeight).toBe(54);
  await render(<V2Action label="Sačuvaj" style={brandAction} onPress={noop} />);
  expect(flat(surface()).minHeight).toBe(54);
});

it('keeps a readable label when disabled: muted ink on the quiet wash, never a faded ghost', async () => {
  await render(<V2Action label="Sačuvaj područje rada" style={brandAction} disabled onPress={noop} />);
  expect(press().props.accessibilityState).toEqual({ disabled: true });
  expect(press().props.disabled).toBe(true);
  expect(flat(surface())).toMatchObject({ backgroundColor: sys.color.wash });
  expect(flat(surface()).opacity ?? 1).toBe(1);
  expect(flat(label('Sačuvaj područje rada')).color).toBe(sys.color.muted);
  // A quiet action stays text; only its ink changes.
  await render(<V2Action label="Otkaži" kind="quiet" disabled onPress={noop} />);
  expect(flat(surface()).backgroundColor).toBe('transparent');
  expect(flat(label('Otkaži')).color).toBe(sys.color.muted);
});

it('keeps its colour and its words while loading, shows a spinner, cannot be pressed twice and is spoken as busy', async () => {
  await render(<V2Action label="Sačuvaj područje rada" style={brandAction} loading onPress={noop} />);
  expect(press().props.accessibilityState).toEqual({ disabled: true, busy: true });
  expect(press().props.disabled).toBe(true);
  expect(flat(surface()).backgroundColor).toBe(sys.color.green);
  expect(flat(label('Sačuvaj područje rada')).color).toBe(sys.color.onGreen);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  await update(<V2Action label="Sačuvaj područje rada" style={brandAction} onPress={noop} />);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(press().props.accessibilityState).toEqual({ disabled: false });
});

it('shows the check for 1.2 s only when the caller says the write is confirmed', async () => {
  jest.useFakeTimers();
  await render(<V2Action label="Sačuvaj" style={brandAction} onPress={noop} />);
  expect(checks()).toHaveLength(0);
  await update(<V2Action label="Sačuvaj" style={brandAction} success onPress={noop} />);
  expect(checks()).toHaveLength(1);
  expect(label('Sačuvaj')).toBeDefined();
  await act(async () => { jest.advanceTimersByTime(ACTION_SUCCESS_MS - 1); });
  expect(checks()).toHaveLength(1);
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(checks()).toHaveLength(0);
  // A caller that keeps saying "saved" does not keep the check: it was news once.
  await update(<V2Action label="Sačuvaj" style={brandAction} success onPress={noop} />);
  expect(checks()).toHaveLength(0);
  expect(ACTION_SUCCESS_MS).toBe(1200);
});

it('settles the check in with a short scale, and simply shows it under reduced motion', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  await render(<V2Action label="Sačuvaj" success onPress={noop} />);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 180, useNativeDriver: true }));
  await act(async () => tree.unmount());
  timing.mockClear(); mockReduced = true;
  await render(<V2Action label="Sačuvaj" success onPress={noop} />);
  expect(checks()).toHaveLength(1);
  expect(timing).not.toHaveBeenCalled();
});

it('draws a danger outline and the caller\'s message right under the button, announced as an alert', async () => {
  await render(<V2Action label="Podeli lokaciju" onPress={noop} />);
  expect(tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'alert')).toHaveLength(0);
  await update(<V2Action label="Podeli lokaciju" error="Lokacija nije podeljena. Pokušaj ponovo." onPress={noop} />);
  expect(flat(surface())).toMatchObject({ borderWidth: 2, borderColor: sys.color.danger });
  const alert = tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'alert')[0];
  expect(alert.props.children).toBe('Lokacija nije podeljena. Pokušaj ponovo.');
  expect(flat(alert).color).toBe(sys.color.danger);
  // The button itself stays usable: an error is a reason to try again, not a lock.
  expect(press().props.accessibilityState).toEqual({ disabled: false });
});

// Review r3 item 1: the grey wash under a disabled green button hid its white icon ("Slanje…", "Preuzimanje i čuvanje…").
it('draws a disabled button\'s icon in the label\'s muted ink, and keeps the live icon\'s own colour otherwise', async () => {
  const icon = () => tree.root.findAll(node => node.type === (DownloadSimple as unknown as React.ElementType))[0];
  await render(<V2Action label="Preuzmi i sačuvaj" style={brandAction} disabled icon={<DownloadSimple size={20} color={sys.color.onGreen} />} onPress={noop} />);
  expect(icon().props.color).toBe(sys.color.muted);
  expect(icon().props.size).toBe(20);
  await update(<V2Action label="Preuzmi i sačuvaj" style={brandAction} icon={<DownloadSimple size={20} color={sys.color.onGreen} />} onPress={noop} />);
  expect(icon().props.color).toBe(sys.color.onGreen);
  // At work the spinner stands where the icon was, in the button's own colour.
  await update(<V2Action label="Preuzmi i sačuvaj" style={brandAction} disabled loading icon={<DownloadSimple size={20} color={sys.color.onGreen} />} onPress={noop} />);
  expect(icon()).toBeUndefined();
  expect(tree.root.findByType(ActivityIndicator).props.color).toBe(sys.color.onGreen);
});

it('says why a disabled action cannot be pressed: a muted line under it and the same words as its spoken hint', async () => {
  const reason = 'Radni profil još nije aktivan — bez njega ponuda ne može da se pošalje.';
  const note = () => tree.root.findAllByType(Text).find(node => node.props.children === reason);
  await render(<V2Action label="Pregledaj ponudu" style={brandAction} disabled reason={reason} onPress={noop} />);
  expect(press().props.accessibilityHint).toBe(reason);
  expect(press().props.accessibilityState).toEqual({ disabled: true });
  expect(flat(note()!).color).toBe(sys.color.muted);
  // Spoken once, as the hint; the drawn line is not read a second time.
  expect(note()!.props.accessibilityElementsHidden).toBe(true);
  expect(note()!.props.importantForAccessibility).toBe('no-hide-descendants');
  // A live button, a working one, or one that already shows an error has no reason line.
  for (const element of [<V2Action label="Pregledaj ponudu" style={brandAction} reason={reason} onPress={noop} />,
    <V2Action label="Pregledaj ponudu" style={brandAction} disabled loading reason={reason} onPress={noop} />,
    <V2Action label="Pregledaj ponudu" style={brandAction} disabled error="Slanje nije uspelo." reason={reason} onPress={noop} />]) {
    await update(element);
    expect(note()).toBeUndefined();
    expect(press().props.accessibilityHint).toBeUndefined();
  }
});

it('keeps a row of buttons in its columns when one of them says something under itself', async () => {
  await render(<View testID="row" style={{ flexDirection: 'row', gap: 8 }}>
    <V2Action label="Podeli lokaciju" style={{ flex: 1, marginTop: 4 }} error="Lokacija nije podeljena." onPress={noop} />
    <V2Action label="Otkaži" style={{ flex: 1 }} kind="quiet" onPress={noop} />
  </View>);
  // Two columns, not three: in what is drawn, the row holds the first button's column and the second button.
  const drawn = tree.toJSON() as { props: { testID?: string }; children: { props: { testID?: string } }[] };
  expect(drawn.props.testID).toBe('row');
  expect(drawn.children).toHaveLength(2);
  expect(drawn.children[0].props.testID).toBe('action-column');
  const column = tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'action-column')[0];
  expect(flat(column)).toMatchObject({ flex: 1, marginTop: 4, gap: sys.space.xs });
  const [button] = column.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'button');
  // The place in the row moved onto the column; the button fills it.
  expect(flat(button).flex).toBeUndefined();
  expect(flat(button).marginTop).toBeUndefined();
  expect(column.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'alert')).toHaveLength(1);
  // Without a message prop (left out, not null) nothing wraps the button: it stays the row's own child.
  await update(<View testID="row" style={{ flexDirection: 'row', gap: 8 }}>
    <V2Action label="Podeli lokaciju" style={{ flex: 1 }} onPress={noop} />
  </View>);
  const plain = tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'row')[0];
  expect(plain.findAll(node => typeof node.type === 'string' && node.props.testID === 'action-column')).toHaveLength(0);
  expect(flat(plain.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'button')[0]).flex).toBe(1);
});

// Round 2c (verifier va, should 3): the top element switched between the bare button and the column the moment an error
// or a reason appeared, so React built the button again and TalkBack lost its place on the button just pressed.
it('keeps the same button when its error or reason appears, because a caller that passes the prop gets the column at once', async () => {
  const hosts = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'button');
  await render(<V2Action label="Podeli lokaciju" error={null} onPress={noop} />);
  const before = hosts()[0];
  expect(tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'action-column')).toHaveLength(1);
  await update(<V2Action label="Podeli lokaciju" error="Lokacija nije podeljena." onPress={noop} />);
  expect(hosts()[0]).toBe(before);
  await render(<V2Action label="Pregledaj ponudu" style={brandAction} reason={null} onPress={noop} />);
  const live = hosts()[0];
  await update(<V2Action label="Pregledaj ponudu" style={brandAction} disabled reason="Zadatak više ne prima prijave." onPress={noop} />);
  expect(hosts()[0]).toBe(live);
  expect(hosts()[0].props.accessibilityHint).toBe('Zadatak više ne prima prijave.');
});

// Round 2c (verifier va, should 4): the reason used to stand in a live region; as the button's hint it is only heard when
// focus lands there, so a reason that turns up after a refresh went unsaid.
it('announces a reason that appears or changes, but not the one it was drawn with, nor the same one after working', async () => {
  // The preset's AccessibilityInfo is already a mock that keeps its calls across tests: start from none.
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  announce.mockClear();
  const action = (props: Partial<React.ComponentProps<typeof V2Action>>) =>
    <V2Action label="Pregledaj ponudu" style={brandAction} onPress={noop} {...props} />;
  await render(action({ disabled: true, reason: 'Radni profil još nije aktivan.' }));
  expect(announce).not.toHaveBeenCalled();
  await update(action({ disabled: true, reason: 'Zadatak više ne prima prijave.' }));
  expect(announce).toHaveBeenCalledTimes(1); expect(announce).toHaveBeenLastCalledWith('Zadatak više ne prima prijave.');
  // At work the line is not drawn; back from work with the same reason, nothing new is said.
  await update(action({ disabled: true, loading: true, reason: 'Zadatak više ne prima prijave.' }));
  await update(action({ disabled: true, reason: 'Zadatak više ne prima prijave.' }));
  expect(announce).toHaveBeenCalledTimes(1);
  // Live again, then refused after a refresh: the reason that turns up is said once.
  await update(action({ reason: null }));
  await update(action({ disabled: true, reason: 'Zadatak više ne prima prijave.' }));
  expect(announce).toHaveBeenCalledTimes(2);
});

// Plan 2.18 (owner: one green primary action per screen): `tone="neutral"` + `brandAction` drew a BLACK primary on the worker
// profile, the profile conversation and two actions of the AI task; `kind="primary"` + `tone="neutral"` did too. A primary is
// green with a white label in every tone; `neutral` is only the ink of a control that is not the primary.
it('draws every primary action green with a white label in any tone: neutral never makes one black', async () => {
  const primaries: Partial<React.ComponentProps<typeof V2Action>>[] = [
    { style: brandAction }, { style: brandAction, tone: 'neutral' }, { style: brandAction, tone: 'brand' },
    { kind: 'primary' }, { kind: 'primary', tone: 'neutral' }, { kind: 'primary', tone: 'neutral', style: brandAction },
  ];
  for (const props of primaries) {
    await render(<V2Action label="Pregledaj i objavi" onPress={noop} {...props} />);
    expect([props, flat(surface()).backgroundColor, flat(surface()).minHeight]).toEqual([props, sys.color.green, 54]);
    expect([props, flat(label('Pregledaj i objavi')).color]).toEqual([props, sys.color.onGreen]);
    expect(flat(surface()).backgroundColor).not.toBe(sys.color.ink);
  }
  // A control that is not the primary keeps what neutral means: ink words, on white, a line or nothing.
  await render(<V2Action label="Sačuvaj kao nacrt" kind="quiet" tone="neutral" onPress={noop} />);
  expect([flat(surface()).backgroundColor, flat(label('Sačuvaj kao nacrt')).color]).toEqual(['transparent', sys.color.ink]);
  await render(<V2Action label="Proveri stanje" tone="neutral" onPress={noop} />);
  expect([flat(surface()).backgroundColor, flat(label('Proveri stanje')).color]).toEqual([sys.color.surface, sys.color.ink]);
  // And a primary that cannot be pressed is the grey wash with a reason, never black and never faded.
  await render(<V2Action label="Pregledaj i objavi" tone="neutral" style={brandAction} disabled reason="Još treba naslov." onPress={noop} />);
  expect(flat(surface())).toMatchObject({ backgroundColor: sys.color.wash }); expect(flat(surface()).opacity ?? 1).toBe(1);
  expect(flat(label('Pregledaj i objavi')).color).toBe(sys.color.muted);
});

it('writes the label white on the brand surface and green on every other action', async () => {
  await render(<V2Action label="Objavi" style={brandAction} onPress={noop} />);
  expect(flat(label('Objavi')).color).toBe(sys.color.onGreen);
  await render(<V2Action label="Pogledaj" onPress={noop} />);
  expect(flat(label('Pogledaj')).color).toBe(sys.color.green);
  await render(<V2Action label="Otkaži Dogovor" kind="destructive" onPress={noop} />);
  expect(flat(label('Otkaži Dogovor')).color).toBe(sys.color.danger);
});
