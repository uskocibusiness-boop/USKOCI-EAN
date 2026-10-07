import { Children, createElement, type ReactElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Tabs } from 'expo-router';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useWindowDimensions } from 'react-native';
import TabLayout from '../src/app/(app)/_layout';
import { TabLabel, tabBarHeight } from '../src/ui/system/TabBarItem';
import { PorukaHost } from '../src/ui/system/Poruka';
import { sys } from '../src/ui/system/tokens';
import { textWidth } from '../src/ui/v2/cardHeadFit';
let mockReducedMotion = false;
jest.mock('../src/hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => mockReducedMotion }));

// Component configuration tests, not rendered Android/Router or device proof.
jest.mock('expo-router', () => {
  const Tabs = () => null;
  Tabs.Screen = () => null;
  return { Tabs };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: jest.fn() }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'useWindowDimensions' ? mockDimensions : Reflect.get(target, key) });
});
const mockDimensions = jest.fn();
jest.mock('../src/ui/referenceEntry/ReferenceEntryHero', () => ({ CanonicalMark: () => null }));
jest.mock('phosphor-react-native', () => ({
  House: () => null, Package: () => null, Plus: () => null, Handshake: () => null,
  User: () => null, PaperPlaneTilt: () => null, MapTrifold: () => null,
}));

/** The phones the bar is judged on, and the text sizes: the owner's is 361 dp at 1.15. */
const WIDTHS = [320, 340, 361, 411];
const SCALES = [1, 1.15, 1.3];

type ScreenProps = { name: string; options: { href?: string | null; title?: string } };
const detailRoutes = [
  'potrebe', 'moje-prijave', 'moje-aktivnosti', 'profil',
  'pregled-nacrta', 'profil/radnik', 'potrebe/[id]/kandidati',
  'potrebe/[id]/pregled', 'prilike/[id]', 'prilike/[id]/prijava',
];

function configuration(bottom = 0, fontScale = 1, width = 390) {
  jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 24, left: 0, right: 0, bottom });
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 844, scale: 3, fontScale });
  // Layout now measures native label heights with hooks. Read its configuration through React,
  // rather than invoking a component as an ordinary function outside the hook lifecycle.
  let tree!: ReactTestRenderer;
  act(() => { tree = create(createElement(TabLayout)); });
  const layout = tree.root.findByType(Tabs);
  const screens = (Children.toArray(layout.props.children) as ReactElement<ScreenProps>[])
    .map((screen) => screen.props);
  const route = { name: 'index', key: 'home' };
  const options = layout.props.screenOptions({ route, navigation: {
    getState: () => ({ index: 0, routes: [route], history: [{ type: 'route', key: route.key }] }),
  } });
  // The options of each of the three tabs, with Početna on show, read while the layout is mounted: the tabs side by side (their
  // widths, their room for a label).
  const tabs = ['index', 'zadaci', 'dogovori'].map(name => layout.props.screenOptions({ route: { name, key: name }, navigation: {
    getState: () => ({ index: 0, routes: [route], history: [{ type: 'route', key: route.key }] }),
  } }));
  // Where the layout tells the one outcome bar ("Poruka") the navigator's bottom chrome ends, read while the layout is mounted.
  const clearances = tree.root.findAllByType(PorukaHost).map((host) => host.props.clearance as number);
  act(() => tree.unmount());
  return { screens, options, tabs, clearances };
}

function visible() {
  return configuration().screens.filter((screen) => screen.options.href !== null);
}

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(path)
      : entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx' ? [path] : [];
  });
}

describe('V3 one-shell navigation and system navigation clearance', () => {
  afterEach(() => { mockReducedMotion = false; });
  it('disables detail shifts with reduced motion while retaining instant peer tabs', () => {
    mockReducedMotion = true;
    const { screens, options } = configuration();
    expect(options.animation).toBe('none');
    for (const name of detailRoutes) {
      expect(screens.find(screen => screen.name === name)?.options).toMatchObject({ animation: 'none' });
    }
  });
  // Owner decision 1 (2026-09-19) supersedes the two intent-shaped shells of 2026-09-16: the same
  // account owns tasks, applies to others and holds Dogovori on both sides, under one set of tabs. Since the owner's
  // information architecture of 2026-09-23 the middle tab is Zadaci (it replaced the Mapa tab and the `/prilike` root).
  it('exposes Početna, Zadaci and Dogovori, in that order, for every account', () => {
    expect(visible().map((screen) => screen.name)).toEqual(['index', 'zadaci', 'dogovori']);
    expect(visible().map((screen) => screen.options.title)).toEqual(['Početna', 'Zadaci', 'Dogovori']);
  });

  it('keeps my tasks, my applications, every detail route and the two retired addresses registered, but not as tabs', () => {
    const { screens } = configuration();
    for (const name of [...detailRoutes, 'mapa', 'prilike']) {
      const matches = screens.filter((screen) => screen.name === name);
      expect(matches).toHaveLength(1);
      expect(matches[0].options.href).toBeNull();
    }
  });

  it('shows the tab bar only on the three root screens', () => {
    // Owner's master UI/UX directive, 2026-09-23, supersedes the lists of 2026-09-18 and 2026-09-20: a detail, a flow, a
    // conversation or a setting is "in this job", not in the main menu, so it hides the bar. The last documented
    // exception, profil/razgovor, waited for its composer's keyboard-aware bottom inset; the AI conversation shell has it
    // now (round 4 review ra), so this list pinned the exception until then and hides that conversation too. prilike (a
    // root-like copy of Mapa) is a redirect to Zadaci since 2026-09-23 and hides the bar like mapa.
    const { screens } = configuration();
    const shown = screens.filter((screen) => (screen.options as { tabBarStyle?: { display?: string } })
      .tabBarStyle?.display !== 'none').map((screen) => screen.name).sort();
    expect(shown).toEqual(['dogovori', 'index', 'zadaci']);
    for (const name of ['mapa', 'prilike', 'potrebe', 'moje-prijave', 'moje-aktivnosti', 'profil', 'profil/obavestenja', 'profil/razgovor', 'podrska/index', 'oceni-dogovor', 'raspored']) {
      const screen = screens.find((candidate) => candidate.name === name)!;
      expect((screen.options as { tabBarStyle?: { display?: string } }).tabBarStyle?.display).toBe('none');
    }
  });

  it('covers every existing leaf route so Router cannot append unnamed extra tabs', () => {
    const directory = resolve(__dirname, '../src/app/(app)');
    const files = routeFiles(directory).map((path) => relative(directory, path)
      .replace(/\\/g, '/').replace(/\.tsx$/, '')).sort();
    expect(configuration().screens.map((screen) => screen.name).sort()).toEqual(files);
  });

  // The ONE outcome bar (plan 2.4, "Poruka") has a single host, mounted beside the navigator. The layout tells it where its own
  // bottom chrome ends (the bar and the margin under it, which is the system inset or 12), so a message floats above the bar on
  // the three roots and, where the bar is hidden, above a flow's own footer.
  it.each([[0, 1], [34, 1], [34, 1.15], [48, 1.3]])('mounts the one Poruka host beside the navigator, clear of the bar and its margin (inset %i, text %f)', (bottom, scale) => {
    const { options, clearances } = configuration(bottom, scale);
    expect(clearances).toEqual([options.tabBarStyle.height + options.tabBarStyle.marginBottom]);
    expect(clearances[0]).toBeGreaterThanOrEqual(tabBarHeight(sys.type.navLabel.lineHeight, 0) + 12);
  });

  it('keeps usable controls above the system navigation clearance and no-slide navigation', () => {
    const { options } = configuration();
    expect(options.animation).toBe('none');
    expect(options.tabBarStyle.height - 2 * options.tabBarStyle.padding).toBeGreaterThanOrEqual(48);
    expect(options.tabBarStyle.marginBottom).toBeGreaterThanOrEqual(12);
  });

  it.each([18, 24, 34, 48, 64])('reserves the %s-point bottom inset without shrinking controls', (bottom) => {
    const style = configuration(bottom).options.tabBarStyle;
    expect(style.marginBottom).toBeGreaterThanOrEqual(bottom);
    expect(style.height - 2 * style.padding).toBeGreaterThanOrEqual(48);
  });

  it('gives enlarged labels more space without consuming the system navigation inset', () => {
    const normal = configuration(34).options.tabBarStyle;
    const large = configuration(34, 2).options.tabBarStyle;
    expect(large.height).toBeGreaterThan(normal.height);
    expect(large.marginBottom).toBeGreaterThanOrEqual(34);
    expect(configuration(34, 2).options.tabBarAllowFontScaling).toBe(true);
  });

  // Existing layout contract: actual icon host + measured label + preserved system navigation clearance.
  it('makes the bar exactly as high as the icon and the label need: 61 at ordinary text, 64 on the owner\'s phone at 1.15, 67 at 1.3', () => {
    const height = (fontScale: number, width = 390) => configuration(0, fontScale, width).options.tabBarStyle;
    expect(height(1).height).toBe(tabBarHeight(sys.type.navLabel.lineHeight, height(1).padding));
    expect(height(1).height).toBe(61);
    expect(height(1.15, 361).height).toBe(64); // the owner's phone: 361 dp at font scale 1.15
    expect(height(1.3, 361).height).toBe(67);
    expect(height(1.15, 361).height - 2 * height(1.15, 361).padding).toBeGreaterThanOrEqual(48);
  });

  it('draws the tab label in the `tab` variant, and keeps navigator selection fill disabled', () => {
    const { options } = configuration();
    expect(options.tabBarActiveBackgroundColor).toBeUndefined();
    const label = options.tabBarLabel({ children: 'Početna' });
    expect(label.type).toBe(TabLabel);
    expect(label.props).toMatchObject({ children: 'Početna', selected: true });
    expect(label.props.variant).toBeUndefined(); // the variant lives in TabLabel, not at the call site
  });

  it('keeps the root navigation a full-width white rail with a quiet top separator', () => {
    const style = configuration().options.tabBarStyle;
    expect(style).toMatchObject({ backgroundColor: sys.color.surface, borderColor: sys.color.line, borderWidth: 0, borderRadius: 0, padding: 0, marginTop: 0 });
    expect(style.marginHorizontal).toBe(0);
  });

  // The bar holds on every phone it is judged on: 320 dp (narrow), 340 (the edge of narrow), 361 (the owner's HONOR) and 411 (a large
  // phone), each at text 1.0, 1.15 (what the owner chose) and 1.3 ("Large", where the labels get more room and the bar more height).
  // The height is one function of the text size at every width, the 48 px control stays whole inside it, and each of the three Serbian
  // labels fits on one line in the room its tab gives it. The fit is ARITHMETIC from the advance widths of Inter (`textWidth`, Bold, which
  // is wider than the SemiBold the label is drawn in, so on the safe side; kerning and Android's non-linear font scale are ignored, both
  // on the wide side): an estimate, not a render. Only a phone shows a pixel.
  describe.each(WIDTHS.flatMap(width => SCALES.map(scale => [width, scale] as const)))('at %i dp and text %f', (width, scale) => {
    it('is as high as the icon and one line of the label need, whatever the width, and the 48 px control stays whole', () => {
      const { options } = configuration(0, scale, width);
      expect(options.tabBarStyle.height).toBe(tabBarHeight(sys.type.navLabel.lineHeight * scale, options.tabBarStyle.padding));
      expect(options.tabBarStyle.height - 2 * options.tabBarStyle.padding).toBeGreaterThanOrEqual(48);
      // The Zadaci sheet and every screen above the bar are sized by what is left: the bar never takes more than the 3 tabs need.
      expect(options.tabBarStyle.height).toBeLessThanOrEqual(80);
    });

    it('gives Početna, Zadaci and Dogovori one line each: no word is wider than the room its tab leaves it', () => {
      const { tabs } = configuration(0, scale, width);
      const bar = tabs[0].tabBarStyle;
      const inner = width - 2 * bar.marginHorizontal - 2 * bar.borderWidth - 2 * bar.padding;
      const flexes: number[] = tabs.map(options => options.tabBarItemStyle.flex);
      const side: number = StyleSheet.flatten(tabs[0].tabBarButton({ children: null }).props.style).paddingHorizontal;
      const rooms = flexes.map(flex => inner * flex / flexes.reduce((sum, value) => sum + value, 0) - 2 * side);
      // Room to spare, not a hair: the estimate is of one font on one machine.
      const tooTight = ['Početna', 'Zadaci', 'Dogovori'].map((title, index) => ({ title, spare: Math.floor(rooms[index] - textWidth(title, sys.type.navLabel.fontSize * scale)) }))
        .filter(({ spare }) => spare < 12);
      expect(tooTight).toEqual([]);
    });
  });

  it('has no mode to switch: the shell reads no role store and keys nothing on one', () => {
    // `Tabs key={intent}` remounted every screen under the navigator whenever the mode changed.
    const source = readFileSync(resolve(__dirname, '../src/app/(app)/_layout.tsx'), 'utf8');
    expect(source).not.toMatch(/store\/uloga/);
    expect(source).not.toMatch(/<Tabs\s+key=/);
  });
});
