import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockWindow = { width: 390, height: 844, scale: 1, fontScale: 1 };
/** What the layout hands to Zadaci through the context (the navigator stand-in below reads it from where its screens would). */
let mockBar: { hidden: { setValue: (to: number) => void }; height: number } | null = null;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return key === 'useWindowDimensions' ? () => mockWindow : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => { const React = require('react');
  const Tabs = (props: object) => { mockBar = require('../../ui/v2/discovery/zadaciBar').useZadaciBar(); return React.createElement('Tabs', props); };
  Tabs.Screen = (props: object) => React.createElement('Screen', props); return { Tabs };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 24 }) }));
jest.mock('phosphor-react-native', () => ({ House: 'Icon', Handshake: 'Icon' }));
jest.mock('../../ui/referenceEntry/ReferenceEntryHero', () => ({ CanonicalMark: 'Mark' }));
import Tabs from '../../app/(app)/_layout';
import { Press } from '../../ui/Press';
import { StyleSheet } from 'react-native';
import { TAB_CAPSULE, TAB_ITEM_BOTTOM, TAB_ITEM_PADDING, TAB_ITEM_TOP, TabCapsule, TabGlyph, TabLabel } from '../../ui/system/TabBarItem';
let tree: ReactTestRenderer;
const routes = ['index', 'zadaci', 'dogovori', 'profil', 'profil/obavestenja', 'moje-aktivnosti', 'prilike', 'mapa', 'prilike/[id]', 'oceni-dogovor']
  .map(name => ({ name, key: name }));
function optionsFor(name: string, history: string[]) {
  const options = tree.root.findByType('Tabs' as React.ElementType).props.screenOptions;
  const state = { index: routes.findIndex(route => route.name === history[history.length - 1]), routes,
    history: history.map(key => ({ type: 'route', key })) };
  return typeof options === 'function' ? options({ route: routes.find(route => route.name === name), navigation: { getState: () => state } }) : options;
}
function tabButton(name: string, history: string[]) {
  return optionsFor(name, history).tabBarButton({ children: name, 'aria-selected': name === history[history.length - 1] });
}
beforeEach(() => { mockWindow = { width: 390, height: 844, scale: 1, fontScale: 1 }; });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('adds the owner-requested Poruke root only in a build paired with the conversation reader', async () => {
  const old = process.env.EXPO_PUBLIC_CONVERSATION_INBOX;
  process.env.EXPO_PUBLIC_CONVERSATION_INBOX = '1';
  try {
    await act(async () => { tree = create(<Tabs />); });
    const visible = tree.root.findAllByType('Screen' as React.ElementType).filter(screen => screen.props.options.href !== null);
    expect(visible.map(screen => screen.props.name)).toEqual(['index', 'zadaci', 'dogovori', 'poruke']);
  } finally {
    if (old === undefined) delete process.env.EXPO_PUBLIC_CONVERSATION_INBOX;
    else process.env.EXPO_PUBLIC_CONVERSATION_INBOX = old;
  }
});

/**
 * Owner decision 1 (2026-09-19): one shell for an account that may at
 * the same moment own tasks, have applied to others, and hold Dogovori on both sides. Until then the
 * shell had two shapes chosen by a global mode, and `Tabs key={intent}` remounted the whole
 * navigator — every screen under it — whenever the mode changed. Since the owner's information architecture of
 * 2026-09-23 the shell is Početna | Zadaci | Dogovori: Zadaci replaced the Mapa tab and the duplicate `/prilike` root.
 */
it('is one shell: Početna | Zadaci | Dogovori, in that order, whoever the account is to a task', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  const visible = screens.filter(screen => screen.props.options.href !== null);
  expect(visible.map(screen => screen.props.name)).toEqual(['index', 'zadaci', 'dogovori']);
  expect(visible.map(screen => screen.props.options.title)).toEqual(['Početna', 'Zadaci', 'Dogovori']);
  expect(visible.map(screen => screen.props.options.tabBarAccessibilityLabel)).toEqual(['Početna', 'Zadaci', 'Dogovori']);
  expect(tree.root.findByType('Tabs' as React.ElementType).props.initialRouteName).toBe('index');
});

it('never remounts the navigator: it has no key and reads no mode', async () => {
  await act(async () => { tree = create(<Tabs />); });
  // A key on the navigator is what reset every screen beneath it. React does not expose `key` as a
  // prop, so the source is the witness, together with the absence of the store that fed it.
  const source = readFileSync(join(__dirname, '../../app/(app)/_layout.tsx'), 'utf8');
  expect(source).not.toMatch(/<Tabs\s+key=/);
  expect(source).not.toMatch(/store\/uloga/);
});

it('Back leads to where the person actually came from: the navigator walks its own history', async () => {
  await act(async () => { tree = create(<Tabs />); });
  // A Task opened from Početna, from Zadaci or from a list is the same hidden route. With any other
  // back behaviour Back would land on the first tab, whichever of them the person had come from.
  expect(tree.root.findByType('Tabs' as React.ElementType).props.backBehavior).toBe('history');
});

it('keeps every earlier destination registered and reachable by its URL, only no longer as a tab', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  const hidden = (name: string) => screens.find(screen => screen.props.name === name)?.props.options.href;
  for (const name of ['potrebe', 'moje-prijave', 'prilike', 'mapa', 'nova', 'pregled-nacrta', 'pregled-zadatka', 'moje-aktivnosti',
    'profil', 'potrebe/[id]/pregled', 'potrebe/[id]/kandidati', 'prilike/[id]', 'prilike/[id]/prijava']) expect(hidden(name)).toBeNull();
});

it('keeps the full-width rail and its tab surface aligned without nested rounded cards', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const options = optionsFor('zadaci', ['index', 'zadaci']);
  const capsule = StyleSheet.flatten(options.tabBarButton({ children: 'Zadaci', 'aria-selected': true }).props.style).borderRadius;
  expect(options.tabBarStyle).toMatchObject({ borderRadius: 0, marginHorizontal: 0, marginTop: 0 });
  expect(capsule).toBe(TAB_CAPSULE);
  expect(options.tabBarItemStyle.borderRadius).toBe(capsule);
});

// The owner's phone of 8 Oct 2026: "dok je lista dole, donja navigacija se ne vidi; pojavi se kad se lista digne na pola ili skroz". On Zadaci, and only there, the bar lies over the
// bottom of the screen and slides by one value that the layout owns; the screen gets that value and the bar's whole height through a context and drives it from its list.
it('draws the bar over the bottom of Zadaci and nowhere else, and gives that screen the one value that moves it', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const zadaci = StyleSheet.flatten(optionsFor('zadaci', ['zadaci']).tabBarStyle) as Record<string, any>;
  const others = ['index', 'dogovori'].map(name => StyleSheet.flatten(optionsFor(name, [name]).tabBarStyle) as Record<string, any>);
  for (const other of others) {
    expect(other.position).toBeUndefined(); expect(other.transform).toBeUndefined();
    expect(other.marginBottom).toBe(24); // the system's inset (the window's 24), as it always was
  }
  const normal = others[0];
  // Over the bottom of the screen, so the map and the list have the whole height; the margin under the bar becomes white padding inside it, so the bar still reaches the bottom.
  expect(zadaci).toMatchObject({ position: 'absolute', left: 0, right: 0, bottom: 0, marginBottom: 0, paddingBottom: normal.marginBottom, borderRadius: 0 });
  expect(zadaci.height).toBe(normal.height + normal.marginBottom);
  const bar = mockBar!;
  expect(bar).not.toBeNull();
  expect(bar.height).toBe(normal.height + normal.marginBottom);
  // The bar is where it always was while the value is 0, and is carried by its own height (and a pixel, for its shadow) off the bottom when the value is 1: a translation, never a change of size.
  const away = () => zadaci.transform[0].translateY.__getValue() as number;
  expect(away()).toBe(0);
  bar.hidden.setValue(1);
  expect(away()).toBe(bar.height + 1);
  bar.hidden.setValue(0.5);
  expect(away()).toBeCloseTo((bar.height + 1) / 2, 5);
});

it('the new tab surface preserves navigator press/long-press handlers and exposes the selected tab', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const renderButton = optionsFor('zadaci', ['index', 'zadaci']).tabBarButton;
  const onPress = jest.fn(), onLongPress = jest.fn();
  const button = renderButton({ children: 'Zadaci', onPress, onLongPress, 'aria-label': 'Zadaci', 'aria-selected': true, testID: 'tasks-tab' });
  expect(button.type).toBe(Press);
  expect(button.props.accessibilityRole).toBe('tab');
  expect(button.props.accessibilityLabel).toBe('Zadaci');
  expect(button.props.accessibilityState).toEqual({ selected: true });
  const event = { nativeEvent: {} };
  button.props.onPress(event); button.props.onLongPress(event);
  expect(onPress).toHaveBeenCalledWith(event); expect(onLongPress).toHaveBeenCalledWith(event);
  expect(tabButton('index', ['index', 'zadaci']).props.accessibilityState).toEqual({ selected: false });
});

// UI/UX pass, wave 2, item 2.1 (ON PURPOSE; audits HP-03, ICO-06, MO-M11): the selected tab was a background colour on the Press, which
// swapped in one frame and scaled with the Press's own 0.97. Now the capsule is the button's own, always-mounted child (React Native
// Animated, opacity only), the Press does not scale (no second motion on top of the capsule, and one Reanimated view fewer per tab,
// B22). Navigation is silent per owner U10, including a cancelled touch and tapping the current tab.
it('draws the chosen tab as an always-mounted capsule inside the button, without haptics or a second scale', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const capsuleOf = (button: React.ReactElement<{ children: React.ReactNode }>) =>
    React.Children.toArray(button.props.children).find(child => React.isValidElement(child) && child.type === TabCapsule) as React.ReactElement<{ selected: boolean; radius: number }>;
  for (const [name, selected] of [['zadaci', true], ['index', false], ['dogovori', false]] as const) {
    const button = tabButton(name, ['index', 'zadaci']);
    expect(button.props).toMatchObject({ haptic: 'none', scaleTo: 1, hitSlop: 0, accessibilityRole: 'tab' });
    expect(button.props.hapticOn).toBeUndefined();
    // The capsule is there for EVERY tab, chosen or not (so it can fade), and says whether it is chosen.
    expect(capsuleOf(button)).toBeDefined();
    expect(capsuleOf(button).props).toMatchObject({ selected, radius: TAB_CAPSULE });
    // `selected` for a screen reader is immediate: it never waits for the 180 ms fade.
    expect(button.props.accessibilityState).toEqual({ selected });
    // The same spacing constants are used in the real navigator and its preview.
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ paddingHorizontal: TAB_ITEM_PADDING, paddingTop: TAB_ITEM_TOP, paddingBottom: TAB_ITEM_BOTTOM });
  }
  // The navigator no longer paints the chosen tab itself, and the Press carries no background of its own.
  expect(StyleSheet.flatten(tabButton('zadaci', ['index', 'zadaci']).props.style).backgroundColor).toBeUndefined();
  expect(optionsFor('zadaci', ['index', 'zadaci']).tabBarActiveBackgroundColor).toBeUndefined();
});

it('draws every tab label in the `tab` variant through TabLabel, chosen in ink and the rest muted', async () => {
  await act(async () => { tree = create(<Tabs />); });
  for (const [name, title, selected] of [['index', 'Početna', false], ['zadaci', 'Zadaci', true], ['dogovori', 'Dogovori', false]] as const) {
    const label = optionsFor(name, ['index', 'zadaci']).tabBarLabel({ children: title });
    expect(label.type).toBe(TabLabel);
    expect(label.props).toMatchObject({ children: title, selected });
  }
});

it.each(['index', 'zadaci', 'dogovori'])('profile settings preserve the originating %s tab across two inner screens', async origin => {
  await act(async () => { tree = create(<Tabs />); });
  const history = [origin, 'profil', 'profil/obavestenja'];
  const selected = ['index', 'zadaci', 'dogovori'].filter(name => tabButton(name, history).props.accessibilityState.selected);
  expect(selected).toEqual([origin]);
  // UI/UX pass, wave 2, item 2.1 (ON PURPOSE): the icon used to be a FactArt whose `muted` prop said "not chosen"; it is now a
  // TabGlyph that cross-fades quiet and brand marks, and it says `selected`.
  expect(optionsFor(origin, history).tabBarIcon({ focused: false }).props.selected).toBe(true);
  expect(optionsFor(origin, history).tabBarIcon({ focused: false }).type).toBe(TabGlyph);
});

it('returning through history updates the section and never hijacks the actual tab action', async () => {
  await act(async () => { tree = create(<Tabs />); });
  expect(tabButton('dogovori', ['index', 'zadaci', 'dogovori', 'profil']).props.accessibilityState.selected).toBe(true);
  expect(tabButton('zadaci', ['index', 'zadaci', 'profil']).props.accessibilityState.selected).toBe(true);
  const onPress = jest.fn();
  optionsFor('zadaci', ['index', 'zadaci', 'profil']).tabBarButton({ onPress, 'aria-selected': false }).props.onPress();
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('an inner link without tab history still has one truthful section fallback', async () => {
  await act(async () => { tree = create(<Tabs />); });
  // A task and the two retired discovery addresses belong to Zadaci.
  for (const inner of ['prilike', 'prilike/[id]', 'mapa']) expect(tabButton('zadaci', [inner]).props.accessibilityState.selected).toBe(true);
  expect(tabButton('dogovori', ['oceni-dogovor']).props.accessibilityState.selected).toBe(true);
  expect(tabButton('index', ['profil']).props.accessibilityState.selected).toBe(true);
});

it('the publishing, review and location flows still hide the tabs', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  for (const name of ['nova', 'pregled-zadatka', 'mesto-zadatka']) {
    expect(screens.find(screen => screen.props.name === name)?.props.options.tabBarStyle.display).toBe('none');
  }
});

// Početna got its own house (2026-09-23): the clipboard sat next to a tab called Zadaci. Zadaci keeps the map.
it('draws Početna as a house, Zadaci as the map and Dogovori as agreements', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const kinds = ['index', 'zadaci', 'dogovori'].map(name => optionsFor(name, [name]).tabBarIcon({ focused: true }).props.kind);
  expect(kinds).toEqual(['home', 'map', 'agreements']);
});

it('keeps the retired discovery addresses as hidden redirects that never show the bar', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  for (const name of ['mapa', 'prilike']) {
    const options = screens.find(screen => screen.props.name === name)?.props.options;
    expect(options.href).toBeNull(); expect(options.tabBarStyle.display).toBe('none'); expect(options.animation).toBe('none');
  }
});

it('gives enlarged full labels room without shrinking them or dropping their icons and selected state', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const ordinary = optionsFor('index', ['index']);
  mockWindow = { ...mockWindow, width: 320, fontScale: 2 };
  await act(async () => tree.update(<Tabs />));
  const home = optionsFor('index', ['index']), tasks = optionsFor('zadaci', ['index']), agreements = optionsFor('dogovori', ['index']);
  expect(home.tabBarStyle.marginHorizontal).toBe(0);
  expect(ordinary.tabBarStyle.marginHorizontal).toBe(0);
  expect(agreements.tabBarItemStyle.flex).toBeGreaterThan(home.tabBarItemStyle.flex);
  expect(home.tabBarItemStyle.flex).toBeGreaterThan(tasks.tabBarItemStyle.flex);
  expect(StyleSheet.flatten(home.tabBarButton({ children: 'Početna' }).props.style).paddingHorizontal).toBe(0);
  for (const [options, title] of [[home, 'Početna'], [tasks, 'Zadaci'], [agreements, 'Dogovori']] as const) {
    const label = options.tabBarLabel({ children: title });
    expect(label.props.children).toBe(title);
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.adjustsFontSizeToFit).toBeUndefined();
    expect(options.tabBarAllowFontScaling).toBe(true);
    expect(options.tabBarIcon({ focused: true })).not.toBeNull();
  }
  expect(tabButton('index', ['index']).props.accessibilityState.selected).toBe(true);
});

it('fits measured label height and ignores a late measurement from the previous text size', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const prior = optionsFor('dogovori', ['dogovori']).tabBarLabel({ children: 'Dogovori' }).props.onTextLayout;
  mockWindow = { ...mockWindow, width: 320, fontScale: 2 };
  await act(async () => tree.update(<Tabs />));
  const before = optionsFor('dogovori', ['dogovori']).tabBarStyle.height;
  await act(async () => prior({ nativeEvent: { lines: [{ y: 0, height: 500 }] } }));
  expect(optionsFor('dogovori', ['dogovori']).tabBarStyle.height).toBe(before);
  const current = optionsFor('dogovori', ['dogovori']).tabBarLabel({ children: 'Dogovori' }).props.onTextLayout;
  await act(async () => current({ nativeEvent: { lines: [{ y: 0, height: 32 }, { y: 32, height: 32 }] } }));
  expect(optionsFor('dogovori', ['dogovori']).tabBarStyle.height).toBeGreaterThan(before);
  expect(optionsFor('dogovori', ['dogovori']).tabBarStyle.height).toBeGreaterThan(64);
  expect(tabButton('dogovori', ['dogovori']).props.accessibilityState.selected).toBe(true);
});
