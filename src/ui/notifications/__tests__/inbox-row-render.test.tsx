import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { InboxItem } from '../../../contracts/inbox';

/**
 * The inbox list drawn by the REAL components, press and text included (the route tests stand in named elements): the rows, the clock
 * at the end of each name, where a tap goes (said to a screen reader only), and the swipe command under an unread row, in the real
 * library's own container. Nothing may throw, the touch targets and the words keep their sizes, and a read row has no command.
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

it('draws day groups and the rows with the clock at the end of the name, and says where a tap goes to a screen reader only, with nothing under 12 px', async () => {
  await draw(view([row('a', { eventType: 'MESSAGE_RECEIVED', title: 'Nova poruka', body: 'Imaš novu poruku u Dogovoru.' }),
    row('b', { eventType: 'OPPORTUNITY_AVAILABLE', title: 'Nova prilika koja ti može odgovarati', body: 'Prenos ormana', occurredAt: at(60 * 30) })]));
  expect(words()).toContain('Danas'); expect(words()).toContain('Juče');
  // The owner's phone, 8 Oct 2026: "18:54 · Otvara Dogovor" explained what a row does. The row says the event, the words and the clock; the hint says the rest.
  expect(words()).not.toMatch(/Otvara/); expect(words()).not.toContain(' · ');
  expect(words()).toMatch(/\d\d:\d\d/);
  const hints = tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.accessibilityHint === 'string').map(node => node.props.accessibilityHint);
  expect(hints).toEqual(expect.arrayContaining(['Otvara poruku u Dogovoru.', 'Otvara zadatak.']));
  for (const node of hostTexts()) {
    const size = StyleSheet.flatten(node.props.style)?.fontSize;
    if (typeof size === 'number') expect(size).toBeGreaterThanOrEqual(12);
  }
});

it('puts the clock on the line of the name, and the words or the task under it, in two lines at most', async () => {
  await draw(view([row('a', { title: 'Dogovor je otkazan', body: 'Druga strana je otkazala Dogovor. Razlog je u Porukama.' }),
    row('b', { title: 'Nova prijava', body: 'Imaš novu prijavu za zadatak.', occurredAt: at(60 * 30), ...{ taskTitle: 'Montaža police u hodniku' } })]));
  const first = tree.root.findAll(node => node.props.accessibilityRole === 'button' && String(node.props.accessibilityLabel).startsWith('Nepročitano. Dogovor je otkazan'))[0];
  const lines = first.findAll(node => (node.type as unknown) === 'Text').map(node => [node.props.children, node.props.numberOfLines]);
  expect(lines).toEqual([['Dogovor je otkazan', 2], [expect.stringMatching(/^\d\d:\d\d$/), undefined], ['Druga strana je otkazala Dogovor. Razlog je u Porukama.', 2]]);
  // The task, when the read says which one, takes the place of the sentence under the event.
  expect(words()).toContain('Montaža police u hodniku'); expect(words()).not.toContain('Imaš novu prijavu za zadatak.');
});

it('keeps the picture in its colour when a row is read, and says read by the weight of the name and the dot that goes', async () => {
  await draw(view([row('a'), row('b', { readAt: at(5) })]));
  expect(tree.root.findAllByProps({ muted: true }).filter(node => typeof node.type !== 'string')).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'inbox-unread-dot' }).filter(node => (node.type as unknown) === 'View')).toHaveLength(1);
  const variantOf = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'button' && String(node.props.accessibilityLabel).startsWith(label))[0]
    .findAll(node => (node.type as unknown) === 'Text')[0];
  // The weight is chosen by the face (Inter), never by `fontWeight`.
  expect(StyleSheet.flatten(variantOf('Nepročitano.').props.style)?.fontFamily).toBe('Inter-SemiBold');
  expect(StyleSheet.flatten(variantOf('Pročitano.').props.style)?.fontFamily).toBe('Inter-Regular');
});

it('offers the same command to a screen reader as an action of the row, for an unread row only', async () => {
  const handled = jest.fn();
  await draw(view([row('a'), row('b', { readAt: at(5) })]), handled);
  const unread = tree.root.findAll(node => node.props.accessibilityRole === 'button' && String(node.props.accessibilityLabel).startsWith('Nepročitano.'))[0];
  const read = tree.root.findAll(node => node.props.accessibilityRole === 'button' && String(node.props.accessibilityLabel).startsWith('Pročitano.'))[0];
  expect(unread.props.accessibilityActions).toEqual([{ name: 'markRead', label: 'Označi kao pročitano' }]);
  expect(read.props.accessibilityActions).toBeUndefined();
  await act(async () => unread.props.onAccessibilityAction({ nativeEvent: { actionName: 'markRead' } }));
  expect(handled).toHaveBeenCalledTimes(1); expect(handled.mock.calls[0][0].id).toBe('a');
});

// The white dot of the owner's phone (8 Oct 2026): the Android pull spinner, raised by every read the list started on its own.
it('raises the pull spinner for a pull only, never for a read the screen started by itself', async () => {
  const onRefresh = jest.fn();
  const list = () => tree.root.findByType(FlatList);
  const items = [row('a')];
  const draw2 = async (loading: boolean) => act(async () => { tree.update(<InboxList state={{ ...view(items), loading }} role={null} onRole={noop} onOpen={noop} onReadAll={noop}
    onRefresh={onRefresh} onMore={noop} onSettings={noop} zona="Europe/Belgrade" sada={NOW} />); });
  await draw(view(items));
  await draw2(true);
  expect(list().props.refreshing).toBe(false);
  await draw2(false);
  await act(async () => list().props.onRefresh());
  expect(onRefresh).toHaveBeenCalledTimes(1);
  await draw2(true);
  expect(list().props.refreshing).toBe(true);
  await draw2(false);
  expect(list().props.refreshing).toBe(false);
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
