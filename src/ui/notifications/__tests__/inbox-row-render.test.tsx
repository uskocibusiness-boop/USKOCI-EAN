import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { InboxItem } from '../../../contracts/inbox';

/**
 * The inbox list drawn by the REAL components, press and text included (the route tests stand in named elements): the rows, the
 * line that says where a tap goes, and the swipe command under an unread row, in the real library's own container. Nothing may
 * throw, the touch targets and the words keep their sizes, and a read row has no command.
 */
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
import { InboxList, type InboxView } from '../InboxPresentation';
import { sys } from '../../system/tokens';

const NOW = new Date('2026-10-07T12:00:00Z');
const at = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const row = (id: string, patch: Partial<InboxItem> = {}): InboxItem => ({ id, eventType: 'RESPONSE_SELECTED', role: 'WORKER', occurredAt: at(10), readAt: null,
  title: `Naslov ${id}`, body: `Telo ${id}.`, family: 'responses', ...patch });
const view = (items: InboxItem[]): InboxView => ({ page: { items, hasMore: false, unreadCount: items.filter(item => !item.readAt).length, asOf: NOW.toISOString() },
  loading: false, paging: false, acting: null, error: null, unavailable: false });
let tree: ReactTestRenderer;
const noop = () => {};
const draw = async (state: InboxView, onMarkRead?: (item: InboxItem) => void) => {
  await act(async () => { tree = create(<InboxList state={state} role={null} onRole={noop} onOpen={noop} onMarkRead={onMarkRead} onReadAll={noop}
    onRefresh={noop} onMore={noop} onSettings={noop} zona="Europe/Belgrade" sada={NOW} />); });
};
const hostTexts = () => tree.root.findAll(node => (node.type as unknown) === 'Text');
const words = () => hostTexts().flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
/** The swipe command's container, once per row that has one (the host node, not the component that made it). */
const panels = () => tree.root.findAll(node => node.props.testID === 'swipe-read-panel' && (node.type as unknown) === 'View');
const buttons = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label);
afterEach(async () => { await act(async () => tree?.unmount()); });

it('draws day groups, the rows and the line under each that says where a tap goes, with nothing under 12 px', async () => {
  await draw(view([row('a', { eventType: 'MESSAGE_RECEIVED', title: 'Nova poruka', body: 'Imaš novu poruku u Dogovoru.' }),
    row('b', { eventType: 'OPPORTUNITY_AVAILABLE', title: 'Nova prilika koja ti može odgovarati', body: 'Prenos ormana', occurredAt: at(60 * 30) })]));
  expect(words()).toContain('Danas'); expect(words()).toContain('Juče');
  expect(words()).toMatch(/\d\d:\d\d · Otvara poruku u Dogovoru/); expect(words()).toMatch(/\d\d:\d\d · Otvara zadatak/);
  for (const node of hostTexts()) {
    const size = StyleSheet.flatten(node.props.style)?.fontSize;
    if (typeof size === 'number') expect(size).toBeGreaterThanOrEqual(12);
  }
});

it('puts the swipe command under an unread row only, big enough to hit, and not under a read one', async () => {
  const handled = jest.fn();
  await draw(view([row('a'), row('b', { readAt: at(5) })]), handled);
  const commands = buttons('Pročitano');
  expect(commands.length).toBeGreaterThan(0);
  expect(new Set(commands.map(node => node.props.accessibilityHint))).toEqual(new Set(['Označava obaveštenje kao pročitano.']));
  // One command: the unread row's; the read row has none.
  expect(panels()).toHaveLength(1);
  expect(StyleSheet.flatten(commands[0].props.style).minWidth).toBeGreaterThanOrEqual(104);
  await act(async () => commands[0].props.onPress());
  expect(handled).toHaveBeenCalledTimes(1); expect(handled.mock.calls[0][0].id).toBe('a');
});

it('without a command to run the rows are plain rows: no panel, no swipe, no actions menu', async () => {
  await draw(view([row('a')]));
  expect(panels()).toHaveLength(0);
  const rowButton = tree.root.findAll(node => node.props.accessibilityRole === 'button' && String(node.props.accessibilityLabel).startsWith('Nepročitano.'))[0];
  expect(rowButton.props.accessibilityActions).toBeUndefined();
});

it('keeps the row\'s own press at 64 dp or more, on the white the revealed command slides under', async () => {
  await draw(view([row('a')]), noop);
  const rowButton = tree.root.findAll(node => node.props.accessibilityRole === 'button' && String(node.props.accessibilityLabel).startsWith('Nepročitano.'))[0];
  expect(StyleSheet.flatten(rowButton.props.style).minHeight).toBeGreaterThanOrEqual(64);
  const surface = tree.root.findAll(node => StyleSheet.flatten(node.props.style)?.backgroundColor === sys.color.surface);
  expect(surface.length).toBeGreaterThan(0);
});
