import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { sys } from '../../ui/system/tokens';

/**
 * The swipe on an inbox row (T4a, 2026-10-07): a row that a finger pulls to the left to show one command, "Pročitano". The library's
 * own gesture is not re-tested here; what is pinned is what this wrapper asks of it and what it does with the answer: the command
 * exists only for a row that can be settled, runs once and slides the row back, tells the list which row opened, lands on the one
 * spring no carried text overshoots (and at once under reduced motion), and gives a mostly vertical drag to the list.
 */
const mockClose = jest.fn();
let mockReduced = false;
jest.mock('react-native-gesture-handler/Swipeable', () => {
  const React = require('react');
  return { __esModule: true, default: class FakeSwipeable extends React.Component<any> {
    close = mockClose;
    render() { return React.createElement('Swipeable', this.props, this.props.children, this.props.renderRightActions?.()); }
  } };
});
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
import { SwipeToRead, type SwipeableRowHandle } from '../../ui/notifications/SwipeToRead';

let tree: ReactTestRenderer;
const draw = async (props: Partial<React.ComponentProps<typeof SwipeToRead>> = {}) => {
  await act(async () => { tree = create(<SwipeToRead enabled label="Pročitano" hint="Označava obaveštenje kao pročitano." busy={false} onRead={jest.fn()} {...props}>
    <></></SwipeToRead>); });
};
const swipeable = () => tree.root.findByType('Swipeable' as React.ElementType);
const command = () => tree.root.findAllByType('Press' as React.ElementType)[0];
beforeEach(() => { jest.clearAllMocks(); mockReduced = false; });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('has the command under an unread row only: a row that cannot be settled is the same wrapper without it', async () => {
  await draw();
  expect(command().props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Pročitano', accessibilityHint: 'Označava obaveštenje kao pročitano.' });
  await act(async () => tree.unmount());
  await draw({ enabled: false });
  expect(swipeable().props.renderRightActions).toBeUndefined();
  expect(tree.root.findAllByType('Press' as React.ElementType)).toHaveLength(0);
});

it('draws the command big enough to hit, green on a neutral well, hidden from a screen reader (the row offers it as an action)', async () => {
  await draw();
  const panel = tree.root.findByProps({ testID: 'swipe-read-panel' });
  expect(panel.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  expect(StyleSheet.flatten(panel.props.style).backgroundColor).toBe(sys.color.control);
  expect(StyleSheet.flatten(command().props.style)).toMatchObject({ flex: 1, minWidth: 104 });
  expect(command().props.hitSlop).toBe(0);
  // No tick on a touch: the outcome is said by the screen once the server confirmed it.
  expect(command().props.haptic).toBe('none');
  const word = tree.root.findAllByType('T' as React.ElementType)[0];
  expect(word.props).toMatchObject({ variant: 'action', numberOfLines: 1 });
  expect(StyleSheet.flatten(word.props.style).color).toBe(sys.color.green);
});

it('runs the command once and slides the row back', async () => {
  const onRead = jest.fn();
  await draw({ onRead });
  await act(async () => command().props.onPress());
  expect(onRead).toHaveBeenCalledTimes(1); expect(mockClose).toHaveBeenCalledTimes(1);
});

it('waits while another command runs: the button is disabled and says so', async () => {
  await draw({ busy: true });
  expect(command().props.disabled).toBe(true); expect(command().props.accessibilityState).toEqual({ disabled: true });
});

it('tells the list which row opened, and the handle it hands over closes that row', async () => {
  const opened: SwipeableRowHandle[] = [];
  await draw({ onOpen: row => opened.push(row) });
  await act(async () => swipeable().props.onSwipeableWillOpen('right'));
  expect(opened).toHaveLength(1);
  opened[0].close();
  expect(mockClose).toHaveBeenCalledTimes(1);
  // The same row hands over the same handle every time, so the list can tell "this row opened again" from "another row opened".
  await act(async () => swipeable().props.onSwipeableWillOpen('right'));
  expect(opened[1]).toBe(opened[0]);
});

it('lets a mostly vertical drag scroll the list, and keeps the row on its own white so the command does not show through', async () => {
  await draw();
  expect(swipeable().props.failOffsetY).toEqual([-16, 16]);
  expect(swipeable().props.overshootRight).toBe(false);
  expect(StyleSheet.flatten(swipeable().props.childrenContainerStyle).backgroundColor).toBe(sys.color.surface);
});

it('lands on the one spring a row of text uses, which never overshoots; the library\'s own bounciness is cleared so it can be named', async () => {
  await draw();
  const options = swipeable().props.animationOptions;
  expect(options).toMatchObject(sys.motion.sheetSpring);
  expect(options.overshootClamping).toBe(true);
  expect('bounciness' in options && options.bounciness).toBeFalsy();
  expect(options.bounciness).toBeUndefined();
});

it('under reduced motion the row still follows the finger and lands where it is going at once', async () => {
  mockReduced = true;
  await draw();
  const options = swipeable().props.animationOptions;
  expect(options.overshootClamping).toBe(true);
  expect(options.stiffness).toBeGreaterThan(sys.motion.sheetSpring.stiffness * 10);
  expect(options.damping).toBeGreaterThan(sys.motion.sheetSpring.damping * 5);
  expect(options.bounciness).toBeUndefined();
});
