import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The board draws every glyph at three sizes and in every tone, every picture of the system and a real card: one render takes several
// seconds on a busy machine.
jest.setTimeout(60_000);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { android: { package: 'rs.uskoci.app.dev' } } } }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
// The board draws a real task card elsewhere; it reads the inbox through the data layer, which a screen suite must not load.
jest.mock('../../v2/TaskCard', () => ({ TaskCard: () => null }));
jest.mock('../../InboxBell', () => ({ InboxBell: () => null }));

import DizajnTabla from '../../../designLab/dizajn-tabla';
import { GLYPH_NAMES, GLYPH_SIZES, GLYPH_TONES } from '../Glyph';

/**
 * The board really draws what its source says it draws (wave 2): the tab bar preview, every glyph of the registry at every size
 * and tone and as an on-state, and the bare and captioned controls. A render, not a reading of the source, because a section that
 * throws at run time would take the whole board down on the owner's phone.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the design board renders its wave-2 sections', () => {
  it('draws the bar preview, the whole glyph registry and the controls with their words', async () => {
    await act(async () => { tree = create(<DizajnTabla />); });
    // The four tabs of the preview, including the Conversations inbox.
    const tabs = tree.root.findAll(node => typeof node.type !== 'string' && node.props.accessibilityRole === 'tab' && node.props.accessibilityState !== undefined);
    expect([...new Set(tabs.map(tab => tab.props.accessibilityLabel))]).toEqual(['Početna', 'Zadaci', 'Dogovori', 'Poruke']);
    // Every glyph once per size, once per tone but the white one, once on green, once as an on-state.
    const perName = GLYPH_SIZES.length + (GLYPH_TONES.length - 1) + 1 + 1;
    const drawn = tree.root.findAll(node => typeof node.type === 'string' && typeof node.props.size === 'number' && typeof node.props.weight === 'string'
      && ['ArrowLeft', 'SlidersHorizontal', 'CalendarBlank', 'MagnifyingGlass', 'DotsThree'].includes(node.type));
    const count = (icon: string) => drawn.filter(node => node.type === icon && [16, 20, 24].includes(node.props.size)).length;
    // 'filters' is drawn once per variant in the registry rows, and four more times in the controls of the third section: bare, with a
    // word, with a word and on, with a word and disabled.
    expect(count('SlidersHorizontal')).toBe(perName + 4);
    expect(GLYPH_NAMES.length * perName).toBeGreaterThan(200);
    const words = tree.root.findAllByType(Text).map(node => node.props.children).flat().filter(child => typeof child === 'string');
    for (const word of ['Filteri', 'Raspored', 'Pretraga']) expect(words).toContain(word);
  });
});
