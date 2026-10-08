import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// The bell reads the inbox; the root bar only has to hold it. The bell's own drawing is checked below on the real one.
jest.mock('../../InboxBell', () => ({ InboxBell: () => require('react').createElement('Bell') }));
// Own identity is exercised with the real focused resource in actual-user-avatar.test; chrome stays data-isolated.
jest.mock('../ActualUserAvatar', () => ({ ActualUserAvatar: ({ onPress }: { onPress: () => void }) =>
  require('react').createElement(require('../../Press').Press, { accessibilityRole: 'button', accessibilityLabel: 'Moj profil',
    onPress, haptic: 'select', hitSlop: 0, style: { width: 56, height: 56 } },
  require('react').createElement('HeaderAvatar', { size: 48 })) }));
let mockUnread: number | undefined;
jest.mock('../../../hooks/useInbox', () => ({ useInbox: () => ({ state: { error: null, page: mockUnread === undefined ? null : { unreadCount: mockUnread } } }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { ArrowLeft, CalendarBlank, MagnifyingGlass, SlidersHorizontal, User, X } from 'phosphor-react-native';
import { GLYPH_NAMES } from '../Glyph';
import { layout } from '../layout';
import { chrome, ChromeIconButton, SCROLL_TITLE_MAX_SCALE, ScreenChrome, useChromeTitleOnScroll } from '../ScreenChrome';
import { HeaderIconButton, ScreenHeader } from '../ScreenHeader';
import { ActualUserAvatar } from '../ActualUserAvatar';
import { DetailTopBar } from '../DetailTopBar';
import { ProductHeader } from '../../product/ProductDetails';
import { SettingsScreen } from '../../settings/SettingsPresentation';
import { sys } from '../tokens';

/**
 * One chrome for every screen (master design plan, 2026-09-24). Six ways of drawing a top bar gave six heights, two
 * arrow sizes and three title styles; these checks hold the one bar that replaced them, through the wrappers every
 * screen already uses.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const hosts = (match: (node: ReactTestInstance) => boolean) => tree.root.findAll(node => typeof node.type === 'string' && match(node));
const control = (label: string) => hosts(node => node.props.accessibilityLabel === label)[0];
/** The Press itself, whose props are what the screen asked for (the native host adds every state key). */
const press = (label: string) => tree.root.findAll(node => typeof node.type !== 'string' && node.props.accessibilityLabel === label)[0];
const bar = () => hosts(node => flat(node).minHeight === chrome.minHeight)[0];
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children).flat().filter(child => typeof child === 'string');
const header = () => hosts(node => node.props.accessibilityRole === 'header')[0];
/** The drawn circle inside a control's 48 px touch area, and the glyph inside it. */
const circle = (label: string) => control(label).findAll(node => typeof node.type === 'string' && node.props.testID === 'chrome-circle')[0];
// The repository's phosphor mock draws each icon as a host element named after it.
const glyph = (label: string) => press(label).findAll(node => node.props.size === chrome.icon && node.props.weight !== undefined)[0];
const noop = () => {};

describe('one bar for every kind of screen', () => {
  it('keeps shared padding, with a 56 px profile target and unchanged 48 px detail/flow controls', async () => {
    for (const [element, lead] of [
      [<ScreenHeader title="Dogovori" onProfile={noop} profileEntry={<ActualUserAvatar onPress={noop} />} />, 'Moj profil'],
      [<DetailTopBar title="Kalendar obaveza" onBack={noop} />, 'Nazad'],
      [<ScreenChrome variant="flow" title="Novi zadatak" onClose={noop} />, 'Zatvori'],
    ] as const) {
      await render(element);
      expect(flat(bar())).toMatchObject({ minHeight: 64, paddingHorizontal: 20, paddingVertical: 8 });
      // The same values, named on the one spacing scale.
      expect(flat(bar())).toMatchObject({ paddingHorizontal: sys.space.lg, paddingVertical: sys.space.sm, gap: sys.space.md });
      const target = lead === 'Moj profil' ? 56 : 48;
      expect(flat(control(lead))).toMatchObject({ width: target, height: target });
      await act(async () => tree.unmount());
    }
  });

  // UI/UX pass 2026-10-08 (F8a): the edge of the bar is the grid's, so the arrow and the first line of content stand on one line.
  it('has the edge of the grid: `layout.gutter`, which is the edge of every screen, for each of the three bars', async () => {
    expect(chrome.paddingHorizontal).toBe(layout.gutter);
    expect(layout.gutter).toBe(20);
    for (const element of [<ScreenHeader title="Dogovori" onProfile={noop} />, <DetailTopBar title="Raspored" onBack={noop} />,
      <ScreenChrome variant="flow" title="Novi zadatak" onClose={noop} />]) {
      await render(element);
      expect(flat(bar()).paddingHorizontal).toBe(layout.gutter);
      await act(async () => tree.unmount());
    }
  });

  it('draws DetailTopBar, ProductHeader and the Settings screens with the same bar and the same title', async () => {
    const measured: unknown[] = [];
    for (const element of [<DetailTopBar title="Profil" onBack={noop} />, <ProductHeader title="Profil" back={noop} />,
      <SettingsScreen title="Profil" onBack={noop}>{null}</SettingsScreen>]) {
      await render(element);
      measured.push({ bar: flat(bar()), title: flat(header()), arrow: flat(control('Nazad')) });
      await act(async () => tree.unmount());
    }
    expect(measured[1]).toEqual(measured[0]);
    expect(measured[2]).toEqual(measured[0]);
    const { fontSize, lineHeight, letterSpacing } = sys.type.title;
    expect((measured[0] as { title: object }).title).toMatchObject({ fontSize, lineHeight, letterSpacing, color: sys.color.ink });
  });
});

describe('root', () => {
  it('keeps the mark in flow, then the screen action, bell and own profile; the section remains spoken', async () => {
    await render(<ScreenHeader title="Dogovori" onProfile={noop} profileEntry={<ActualUserAvatar onPress={noop} />} right={<HeaderIconButton label="Kalendar obaveza" icon={MagnifyingGlass} onPress={noop} />} />);
    expect(control('Moj profil')).toBeDefined();
    expect(header().props.accessibilityLabel).toBe('USKOČI, Dogovori');
    expect(tree.root.findAllByType('Bell' as React.ElementType)).toHaveLength(1);
    expect(texts()).not.toContain('Dogovori');
    expect(control('Kalendar obaveza')).toBeDefined();
  });

  it('speaks a header toggle as selected or not, and shows it by weight and colour together', async () => {
    await render(<HeaderIconButton label="Pretraga" icon={MagnifyingGlass} active onPress={noop} />);
    expect(press('Pretraga').props.accessibilityState).toEqual({ selected: true });
    // Updated 2026-09-24 (critique B2): the fill is on the drawn 44 px circle, no longer on the 48 px touch area.
    expect(flat(circle('Pretraga')).backgroundColor).toBe(sys.color.greenSoft);
    expect(glyph('Pretraga').props).toMatchObject({ weight: 'fill', color: sys.color.green });
    await act(async () => tree.update(<HeaderIconButton label="Pretraga" icon={MagnifyingGlass} onPress={noop} />));
    expect(press('Pretraga').props.accessibilityState).toEqual({ selected: false });
    expect(flat(circle('Pretraga')).backgroundColor).toBe(sys.color.surface);
    // Wave 2, item 2.3 (ON PURPOSE): a chrome glyph is regular24, with short marks handled by the registry; `fill` is still only the on-state.
    expect(glyph('Pretraga').props).toMatchObject({ weight: 'regular', color: sys.color.ink });
  });

  it('places the larger own profile last and preserves its navigation callback', async () => {
    const open = jest.fn();
    await render(<ScreenHeader title="Dogovori" onProfile={open} profileEntry={<ActualUserAvatar onPress={open} />} />);
    expect(flat(control('Moj profil'))).toMatchObject({ width: 56, height: 56 });
    expect(tree.root.findByType('HeaderAvatar' as React.ElementType).props.size).toBe(48);
    const orderedArt = tree.root.findAll(node => typeof node.type === 'string'
      && ['Bell', 'HeaderAvatar'].includes(node.type)).map(node => node.type);
    expect(orderedArt).toEqual(['Bell', 'HeaderAvatar']);
    await act(async () => press('Moj profil').props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
    expect(header().props.accessibilityLabel).toBe('USKOČI, Dogovori');
  });

  it('keeps a data-free profile fallback when a presentation has no injected identity', async () => {
    const open = jest.fn();
    await render(<ScreenHeader title="Dogovori" onProfile={open} />);
    expect(tree.root.findAllByType('HeaderAvatar' as React.ElementType)).toHaveLength(0);
    expect(glyph('Moj profil').type).toBe(User);
    expect(flat(control('Moj profil'))).toMatchObject({ width: 48, height: 48 });
    await act(async () => press('Moj profil').props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('keeps a data-free profile glyph for direct ScreenChrome galleries', async () => {
    await render(<ScreenChrome variant="root" title="Dogovori" onProfile={noop} bell={<React.Fragment />} />);
    expect(glyph('Moj profil').type).toBe(User);
    expect(flat(control('Moj profil'))).toMatchObject({ width: 48, height: 48 });
  });
});

// Round-1 critique B2: five icon-button shapes (a square well, a round well, a green avatar, a round bell, the week's
// bordered arrows) became one. The bell is neutral; only its unread count keeps the orange.
describe('the one chrome icon button', () => {
  it('is a 44 px white circle with the hairline inside an exact 48 px touch area, with a 24 px regular glyph in ink', async () => {
    const back = jest.fn();
    await render(<DetailTopBar title="Kalendar obaveza" onBack={back} />);
    expect(flat(control('Nazad'))).toMatchObject({ width: 48, height: 48 });
    expect(press('Nazad').props.hitSlop).toBe(0);
    expect(flat(circle('Nazad'))).toMatchObject({ width: 44, height: 44, borderRadius: sys.radius.pill,
      backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line });
    expect(glyph('Nazad').type).toBe(ArrowLeft);
    expect(glyph('Nazad').props).toMatchObject({ size: 24, weight: 'regular', color: sys.color.ink });
    await act(async () => press('Nazad').props.onPress());
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('draws a disabled control with a muted glyph and never fades it', async () => {
    await render(<DetailTopBar title="Profil" disabled onBack={noop} />);
    expect(press('Nazad').props.disabled).toBe(true);
    expect(glyph('Nazad').props.color).toBe(sys.color.muted);
    expect(flat(control('Nazad')).opacity).toBeUndefined();
    expect(flat(circle('Nazad')).opacity).toBeUndefined();
    expect(flat(circle('Nazad')).backgroundColor).toBe(sys.color.surface);
  });

  it('has a quiet form without the circle, for a control that ends a row of its own content', async () => {
    await render(<ChromeIconButton quiet label="Kalendar obaveza" icon={CalendarBlank} onPress={noop} />);
    expect(flat(control('Kalendar obaveza'))).toMatchObject({ width: 48, height: 48 });
    expect(flat(circle('Kalendar obaveza'))).toMatchObject({ backgroundColor: 'transparent', borderColor: 'transparent' });
    expect(glyph('Kalendar obaveza').props).toMatchObject({ size: 24, weight: 'regular', color: sys.color.ink });
    expect(press('Kalendar obaveza').props.accessibilityState).toEqual({ disabled: false });
  });

  it('draws original bell art without a chrome circle; the real unread count keeps its orange badge', async () => {
    const { InboxBell } = jest.requireActual('../../InboxBell') as typeof import('../../InboxBell');
    const bellLabel = (count: number) => hosts(node => typeof node.props.accessibilityLabel === 'string'
      && node.props.accessibilityLabel.startsWith(`Obaveštenja, ${count} `))[0].props.accessibilityLabel as string;
    mockUnread = 0;
    await render(<InboxBell />);
    const label = bellLabel(0);
    expect(flat(control(label))).toMatchObject({ width: 48, height: 48 });
    expect(circle(label)).toBeUndefined();
    const art = tree.root.findByType(Image);
    expect(art.props.source).toBe(require('../../../../assets/illustrations/uskoci-notification-bell-v1.png'));
    expect(flat(art)).toMatchObject({ width: 40, height: 40 });
    expect(art.props).toMatchObject({ accessible: false, contentFit: 'contain', transition: 0 });
    expect(hosts(node => flat(node).backgroundColor === sys.color.orange)).toHaveLength(0);
    await act(async () => tree.unmount());
    mockUnread = 3;
    await render(<InboxBell />);
    const spoken = bellLabel(3);
    // The illustration does not invent an unread state; only the real count adds the badge.
    expect(circle(spoken)).toBeUndefined();
    expect(tree.root.findByType(Image).props.source).toBe(require('../../../../assets/illustrations/uskoci-notification-bell-v1.png'));
    expect(hosts(node => flat(node).backgroundColor === sys.color.orange)).toHaveLength(1);
    expect(tree.root.findAllByType(Text).map(node => node.props.children)).toContain(3);
    mockUnread = undefined;
  });
});

describe('detail', () => {
  it('keeps the back label and the disabled state, draws the title as a header and holds one right control', async () => {
    const back = jest.fn();
    await render(<DetailTopBar title="Veštine, alat i tim" backLabel="Nazad na profil" disabled onBack={back}
      right={<HeaderIconButton label="Više radnji" icon={MagnifyingGlass} onPress={noop} />} />);
    expect(press('Nazad na profil').props.accessibilityState).toEqual({ disabled: true });
    expect(header().props.children).toBe('Veštine, alat i tim');
    expect(control('Više radnji')).toBeDefined();
    // The owner's rule: the bar names the content and nothing says where you are.
    expect(texts()).toEqual(['Veštine, alat i tim']);
  });

  it('lets a task screen leave the title to its content and still say its state under the arrow', async () => {
    await render(<ProductHeader back={noop} subtitle="Učitavamo" />);
    expect(hosts(node => node.props.accessibilityRole === 'header')).toHaveLength(0);
    expect(texts()).toEqual(['Učitavamo']);
    expect(press('Nazad').props.accessibilityState).toEqual({ disabled: false });
  });

  it('puts a face before the name when the bar is about a person', async () => {
    await render(<ScreenChrome variant="detail" title="Mila" subtitle="Dogovoreno" onBack={noop} lead={<Text>MI</Text>} />);
    expect(texts()).toEqual(['MI', 'Mila', 'Dogovoreno']);
    expect(header().props.children).toBe('Mila');
  });
});

describe('the title that appears on scroll', () => {
  const title = () => hosts(node => node.props.testID === 'chrome-title')[0];

  it('is hidden from the eye and from a screen reader until the content title has scrolled away, then fades in over 180 ms', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<ProductHeader title="Selidba stana" back={noop} titleVisible={false} />);
    expect(title().props.accessibilityElementsHidden).toBe(true);
    expect(title().props.importantForAccessibility).toBe('no-hide-descendants');
    expect(flat(title()).opacity).toBe(0);
    timing.mockClear();
    await act(async () => tree.update(<ProductHeader title="Selidba stana" back={noop} titleVisible />));
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 180, useNativeDriver: true }));
    expect(title().props.accessibilityElementsHidden).toBe(false);
    expect(title().props.importantForAccessibility).toBe('auto');
  });

  // Review of step 5b (2026-09-24): the faded name stood in the bar at opacity 0, two lines of it, and held the bar at
  // 68 px at normal text and about 84 px at the owner's large font, with an empty band above the large title before any
  // scroll. It now lies over the copy area, one line, capped at 1.3, so the bar is its controls' height at every size.
  it('takes no height, hidden or shown, so the bar keeps one height at every text size', async () => {
    const long = 'Selidba trosobnog stana sa trećeg sprata bez lifta, uz pakovanje i odnošenje starog nameštaja';
    for (const visible of [false, true]) {
      await render(<ProductHeader title={long} back={noop} titleVisible={visible}
        right={<HeaderIconButton label="Više radnji" icon={MagnifyingGlass} onPress={noop} />} />);
      expect(flat(title())).toMatchObject({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center' });
      expect(header().props).toMatchObject({ numberOfLines: 1, maxFontSizeMultiplier: 1.3 });
      expect(header().props.children).toBe(long);
      // The copy area spans the controls' height and holds nothing in the flow: its first element is the laid-over title.
      const copy = hosts(node => flat(node).flex === 1 && flat(node).alignSelf === 'stretch')[0];
      expect(copy.findAll(node => typeof node.type === 'string' && node !== copy)[0].props.testID).toBe('chrome-title');
      // What does stand in the row is two fixed 48 px controls, inside the one 64 px bar.
      expect(flat(control('Nazad'))).toMatchObject({ width: 48, height: 48 });
      expect(flat(control('Više radnji'))).toMatchObject({ width: 48, height: 48 });
      expect(flat(bar())).toMatchObject({ minHeight: 64, paddingVertical: 8 });
      expect(flat(bar()).height).toBeUndefined();
      await act(async () => tree.unmount());
    }
    // A title that is always there is the only name on the screen, so it keeps its two lines and the chosen text size.
    await render(<DetailTopBar title={long} onBack={noop} />);
    expect(header().props.numberOfLines).toBe(2);
    expect(header().props.maxFontSizeMultiplier).toBeUndefined();
    expect(hosts(node => node.props.testID === 'chrome-title')).toHaveLength(0);
  });

  it('is simply there under reduced motion', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    await render(<ProductHeader title="Selidba stana" back={noop} titleVisible={false} />);
    await act(async () => tree.update(<ProductHeader title="Selidba stana" back={noop} titleVisible />));
    expect(timing).not.toHaveBeenCalled();
    expect(flat(title()).opacity).toBe(1);
  });

  it('turns on and off only when the content title crosses the line', async () => {
    let state: ReturnType<typeof useChromeTitleOnScroll> | undefined; let renders = 0;
    function Probe() { state = useChromeTitleOnScroll(72); renders++; return null; }
    await render(<Probe />);
    const scroll = (y: number) => act(async () => state!.onScroll({ nativeEvent: { contentOffset: { x: 0, y } } } as never));
    expect(state!.titleVisible).toBe(false);
    await scroll(40); const before = renders; await scroll(60);
    expect(renders).toBe(before);
    await scroll(80); expect(state!.titleVisible).toBe(true);
    await scroll(10); expect(state!.titleVisible).toBe(false);
  });
});

describe('flow', () => {
  it('has the close X and says where you are in the flow', async () => {
    const close = jest.fn();
    await render(<ScreenChrome variant="flow" title="Novi zadatak" step="Korak 2 od 4" onClose={close} />);
    expect(control('Zatvori').props.accessibilityRole).toBe('button');
    expect(texts()).toEqual(['Novi zadatak', 'Korak 2 od 4']);
    await act(async () => press('Zatvori').props.onPress());
    expect(close).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// UI/UX pass, wave 2, item 2.3 (audits ICO-08, ICO-05, MO-M4): the chrome draws from the Glyph registry, a non-universal command
// can carry a word, and navigation is silent. A Phosphor `icon` is still accepted, so no screen had to change.
// ---------------------------------------------------------------------------------------------------------------------
/** The glyph inside a captioned pill is 20 (the row size), not the 24 of a bare chrome circle. */
const glyphAt = (label: string, size: number) => press(label).findAll(node => node.props.size === size && node.props.weight !== undefined)[0];

describe('a chrome icon button drawn from the Glyph registry', () => {
  it('draws the named glyph at 24, regular, in ink inside the same circle and the same 48 px touch area as a Phosphor icon', async () => {
    await render(<ChromeIconButton label="Filteri" glyph="filters" onPress={noop} />);
    expect(glyph('Filteri').type).toBe(SlidersHorizontal);
    expect(glyph('Filteri').props).toMatchObject({ size: 24, weight: 'regular', color: sys.color.ink });
    expect(flat(control('Filteri'))).toMatchObject({ width: 48, height: 48 });
    expect(flat(circle('Filteri'))).toMatchObject({ width: 44, height: 44, borderRadius: sys.radius.pill });
    expect(press('Filteri').props.hitSlop).toBe(0);
  });

  it('shows a toggle by weight and colour together, and speaks it as selected', async () => {
    await render(<ChromeIconButton label="Filteri" glyph="filters" active onPress={noop} />);
    expect(glyph('Filteri').props).toMatchObject({ weight: 'fill', color: sys.color.green });
    expect(flat(circle('Filteri')).backgroundColor).toBe(sys.color.greenSoft);
    expect(press('Filteri').props.accessibilityState).toEqual({ selected: true });
  });

  it("draws a disabled glyph muted and an explicit action green, exactly as a Phosphor icon is", async () => {
    await render(<ChromeIconButton label="Filteri" glyph="filters" disabled onPress={noop} />);
    expect(glyph('Filteri').props.color).toBe(sys.color.muted);
    await act(async () => tree.update(<ChromeIconButton label="Filteri" glyph="filters" tone="green" onPress={noop} />));
    expect(glyph('Filteri').props.color).toBe(sys.color.green);
  });

  it('draws the arrow back, the close X and the profile from the registry, not from Phosphor imports of its own', async () => {
    await render(<ScreenChrome variant="detail" title="Profil" onBack={noop} />);
    expect(glyph('Nazad').type).toBe(ArrowLeft);
    await act(async () => tree.update(<ScreenChrome variant="flow" title="Novi zadatak" onClose={noop} />));
    expect(glyph('Zatvori').type).toBe(X);
    expect(glyph('Zatvori').props).toMatchObject({ size: 24, weight: 'bold', color: sys.color.ink });
    await act(async () => tree.update(<ScreenChrome variant="root" title="Dogovori" onProfile={noop} bell={null} />));
    expect(glyph('Moj profil').type).toBe(User);
  });

  it('is handed through the header toggle too, so a later wave can say glyph="search" there', async () => {
    await render(<HeaderIconButton label="Pretraga" glyph="search" active onPress={noop} />);
    expect(glyph('Pretraga').type).toBe(MagnifyingGlass);
    expect(glyph('Pretraga').props.weight).toBe('fill');
    expect(press('Pretraga').props.accessibilityState).toEqual({ selected: true });
  });
});

describe('a captioned control: a word beside the glyph for a command nobody can guess', () => {
  const FILTERS = 'Filteri zadataka';

  it('is a 44 px pill with the glyph at 20 and the word in the meta variant, inside a 48 px touch height', async () => {
    await render(<ChromeIconButton label={FILTERS} glyph="filters" caption="Filteri" onPress={noop} />);
    expect(texts()).toEqual(['Filteri']);
    expect(flat(circle(FILTERS))).toMatchObject({ height: 44, minWidth: 44, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
      borderWidth: 1, borderColor: sys.color.line, flexDirection: 'row', alignItems: 'center' });
    expect(flat(control(FILTERS))).toMatchObject({ height: 48, minWidth: 48 });
    // It grows with its word: only the height of the touch area is fixed.
    expect(flat(control(FILTERS)).width).toBeUndefined();
    expect(press(FILTERS).props.hitSlop).toBe(0);
    expect(glyphAt(FILTERS, 20).type).toBe(SlidersHorizontal);
    expect(glyphAt(FILTERS, 20).props).toMatchObject({ weight: 'regular', color: sys.color.ink });
    const word = tree.root.findAllByType(Text)[0];
    expect(flat(word)).toMatchObject({ fontSize: sys.type.meta.fontSize, lineHeight: sys.type.meta.lineHeight, color: sys.color.ink });
    // Never under 12, and one line: a wrapped caption would make the pill taller than its touch area.
    expect(flat(word).fontSize).toBeGreaterThanOrEqual(12);
    expect(word.props.numberOfLines).toBe(1);
  });

  it('keeps the large-text cap of the chrome title, so the pill cannot crush a tab row', async () => {
    await render(<ChromeIconButton label={FILTERS} glyph="filters" caption="Filteri" onPress={noop} />);
    expect(tree.root.findAllByType(Text)[0].props.maxFontSizeMultiplier).toBe(SCROLL_TITLE_MAX_SCALE);
  });

  it('is spoken by its label only: the caption is not a second name', async () => {
    await render(<ChromeIconButton label={FILTERS} glyph="filters" caption="Filteri" onPress={noop} />);
    expect(press(FILTERS).props.accessibilityLabel).toBe(FILTERS);
    expect(press(FILTERS).props.accessibilityRole).toBe('button');
  });

  it("wears the word in the glyph's colour: ink, green when on, muted when disabled; and fills the glyph when on", async () => {
    await render(<ChromeIconButton label={FILTERS} glyph="filters" caption="Filteri" onPress={noop} />);
    const word = () => tree.root.findAllByType(Text)[0];
    expect(flat(word()).color).toBe(sys.color.ink);
    await act(async () => tree.update(<ChromeIconButton label={FILTERS} glyph="filters" caption="Filteri" active onPress={noop} />));
    expect(flat(word()).color).toBe(sys.color.green);
    expect(glyphAt(FILTERS, 20).props).toMatchObject({ weight: 'fill', color: sys.color.green });
    expect(flat(circle(FILTERS)).backgroundColor).toBe(sys.color.greenSoft);
    expect(press(FILTERS).props.accessibilityState).toEqual({ selected: true });
    await act(async () => tree.update(<ChromeIconButton label={FILTERS} glyph="filters" caption="Filteri" disabled onPress={noop} />));
    expect(flat(word()).color).toBe(sys.color.muted);
    expect(flat(circle(FILTERS)).opacity).toBeUndefined();
  });

  it('works on a Phosphor icon as well, and the quiet form drops the circle but keeps the word', async () => {
    await render(<ChromeIconButton quiet label="Raspored obaveza" icon={CalendarBlank} caption="Raspored" onPress={noop} />);
    expect(texts()).toEqual(['Raspored']);
    expect(glyphAt('Raspored obaveza', 20).type).toBe(CalendarBlank);
    expect(flat(circle('Raspored obaveza'))).toMatchObject({ backgroundColor: 'transparent', borderColor: 'transparent', height: 44 });
  });

  it('is handed through the header toggle as well: the same pill, spoken as selected when on', async () => {
    await render(<HeaderIconButton label={FILTERS} glyph="filters" caption="Filteri" active onPress={noop} />);
    expect(texts()).toEqual(['Filteri']);
    expect(flat(circle(FILTERS))).toMatchObject({ height: 44, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft });
    expect(press(FILTERS).props.accessibilityState).toEqual({ selected: true });
    expect(press(FILTERS).props.accessibilityLabel).toBe(FILTERS);
    // Moji zadaci draws it with a Phosphor component (`icon`) and the caption, and the spoken label contains the word on the control.
    await act(async () => tree.update(<HeaderIconButton label="Filteri, aktivni" icon={SlidersHorizontal} caption="Filteri" active onPress={noop} />));
    expect(texts()).toEqual(['Filteri']);
    expect(glyphAt('Filteri, aktivni', 20).type).toBe(SlidersHorizontal);
    expect(glyphAt('Filteri, aktivni', 20).props).toMatchObject({ weight: 'fill', color: sys.color.green });
    expect(press('Filteri, aktivni').props.accessibilityState).toEqual({ selected: true });
  });

  it('is not drawn without a caption: a bare control keeps its 48 by 48 touch area and has no word', async () => {
    await render(<ChromeIconButton label="Pretraga" glyph="search" onPress={noop} />);
    expect(texts()).toEqual([]);
    expect(flat(control('Pretraga'))).toMatchObject({ width: 48, height: 48 });
  });
});

describe('silent navigation (rule R5: a tick is an outcome, not a touch)', () => {
  it('ticks nothing for the arrow back and the close X', async () => {
    await render(<ScreenChrome variant="detail" title="Profil" onBack={noop} />);
    expect(press('Nazad').props.haptic).toBe('none');
    await act(async () => tree.update(<ScreenChrome variant="flow" title="Novi zadatak" onClose={noop} />));
    expect(press('Zatvori').props.haptic).toBe('none');
    await act(async () => tree.update(<ScreenChrome variant="detail" title="Profil" onBack={noop} backLabel="Nazad na profil" />));
    expect(press('Nazad na profil').props.haptic).toBe('none');
  });

  // The rule lives in ChromeIconButton, not at each call site: a screen that later draws `glyph="back"` or `glyph="close"` itself is
  // silent too, and no other name is.
  it('is silent by default for the glyph names back and close wherever they are drawn, and ticks for every other name', async () => {
    await render(<ChromeIconButton label="Nazad" glyph="back" onPress={noop} />);
    expect(press('Nazad').props.haptic).toBe('none');
    await act(async () => tree.update(<ChromeIconButton label="Zatvori" glyph="close" onPress={noop} />));
    expect(press('Zatvori').props.haptic).toBe('none');
    for (const name of GLYPH_NAMES.filter(candidate => candidate !== 'back' && candidate !== 'close')) {
      await act(async () => tree.update(<ChromeIconButton label="Komanda" glyph={name} onPress={noop} />));
      expect([name, press('Komanda').props.haptic]).toEqual([name, 'select']);
    }
  });

  it('lets a caller ask for a tick on a close that IS an outcome, and never guesses from a Phosphor component', async () => {
    await render(<ChromeIconButton label="Gotovo" glyph="close" haptic="success" onPress={noop} />);
    expect(press('Gotovo').props.haptic).toBe('success');
    // A Phosphor component is a component, not a name: nothing is read from which one it is (a week arrow is not "back").
    await act(async () => tree.update(<ChromeIconButton label="Prethodna nedelja" icon={ArrowLeft} onPress={noop} />));
    expect(press('Prethodna nedelja').props.haptic).toBe('select');
  });

  it('keeps the selection tick for the controls that are not navigation back, and ticks nothing when disabled', async () => {
    await render(<ScreenHeader title="Dogovori" onProfile={noop} profileEntry={<ActualUserAvatar onPress={noop} />} />);
    expect(press('Moj profil').props.haptic).toBe('select');
    await act(async () => tree.update(<ChromeIconButton label="Pretraga" glyph="search" onPress={noop} />));
    expect(press('Pretraga').props.haptic).toBe('select');
    await act(async () => tree.update(<ChromeIconButton label="Pretraga" glyph="search" disabled onPress={noop} />));
    expect(press('Pretraga').props.haptic).toBe('none');
  });

  it('lets a caller choose, and a disabled control still ticks nothing', async () => {
    await render(<ChromeIconButton label="Zatvori fotografije" icon={X} haptic="none" onPress={noop} />);
    expect(press('Zatvori fotografije').props.haptic).toBe('none');
    await act(async () => tree.update(<ChromeIconButton label="Zatvori fotografije" icon={X} haptic="light" onPress={noop} />));
    expect(press('Zatvori fotografije').props.haptic).toBe('light');
    await act(async () => tree.update(<ChromeIconButton label="Zatvori fotografije" icon={X} haptic="light" disabled onPress={noop} />));
    expect(press('Zatvori fotografije').props.haptic).toBe('none');
  });
});
