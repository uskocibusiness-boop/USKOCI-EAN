import React, { StrictMode } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockPlatform = 'ios';
let mockWindow = { width: 411, height: 844, scale: 1, fontScale: 1 };
const mockAnnounce = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: mockPlatform };
    if (key === 'AccessibilityInfo') return { announceForAccessibility: mockAnnounce };
    if (key === 'useWindowDimensions') return () => mockWindow;
    return ['View', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('phosphor-react-native', () => ({ CaretRight: 'CaretRight' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'V2Action' }));

import { NextStepCard, WorkspaceFooter } from '../../ui/agreements/AgreementWorkspace';

let tree: ReactTestRenderer | undefined;
const mockComplete = jest.fn(), mockRefresh = jest.fn();
const brand = { label: 'Potvrdi završetak', onPress: mockComplete, disabled: true };
const notice = (message: string, refreshing = false) => ({ message, refresh: mockRefresh, refreshing });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const update = async (element: React.ReactElement) => { await act(async () => tree!.update(element)); };
const spoken = () => mockAnnounce.mock.calls.map(([message]) => message);

beforeEach(() => { jest.clearAllMocks(); mockPlatform = 'ios'; mockWindow = { width: 411, height: 844, scale: 1, fontScale: 1 }; });
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

test('VoiceOver hears each changed step once, never the initial title or body-only changes', async () => {
  await render(<StrictMode><NextStepCard title="Dogovoreno" body="Sledeći korak" /></StrictMode>);
  expect(spoken()).toEqual([]);
  await update(<StrictMode><NextStepCard title="Dogovoreno" body="Drugačije objašnjenje" tone="warn" /></StrictMode>);
  expect(spoken()).toEqual([]);
  await update(<StrictMode><NextStepCard title="Čeka se potvrda druge strane" /></StrictMode>);
  await update(<StrictMode><NextStepCard title="Čeka se potvrda druge strane" body="Rok potvrde" /></StrictMode>);
  await update(<StrictMode><NextStepCard title="Dogovor je završen" /></StrictMode>);
  expect(spoken()).toEqual(['Čeka se potvrda druge strane', 'Dogovor je završen']);
});

test('Android retains one persistent live title and does not also announce the step manually', async () => {
  mockPlatform = 'android';
  await render(<NextStepCard title="Dogovoreno" />);
  const title = tree!.root.findByProps({ accessibilityLiveRegion: 'polite' });
  await update(<NextStepCard title="Dogovor je završen" />);
  expect(tree!.root.findByProps({ accessibilityLiveRegion: 'polite' })).toBe(title);
  expect(title.props.children).toBe('Dogovor je završen');
  expect(spoken()).toEqual([]);
});

test.each(['android', 'ios'])('%s announces recovery once per visible message episode, without a competing live region', async platform => {
  mockPlatform = platform;
  await render(<WorkspaceFooter brand={brand} statusText="Učitavamo Dogovor…" />);
  await update(<WorkspaceFooter brand={brand} notice={notice('')} />);
  expect(spoken()).toEqual([]);

  await update(<WorkspaceFooter brand={brand} notice={notice('Radnja nije potvrđena.')} />);
  await update(<WorkspaceFooter brand={brand} notice={notice('Radnja nije potvrđena.', true)} loading />);
  expect(spoken()).toEqual(['Radnja nije potvrđena.']);
  const recovery = tree!.root.findByProps({ testID: 'agreement-action-recovery' });
  expect(recovery.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('Radnja nije potvrđena.');
  expect(recovery.findAll(node => node.props.accessibilityLiveRegion !== undefined)).toHaveLength(0);

  await update(<WorkspaceFooter brand={brand} notice={notice('Dogovor nije osvežen.')} />);
  await update(<WorkspaceFooter brand={brand} notice={null} statusText="Učitavamo Dogovor…" />);
  await update(<WorkspaceFooter brand={brand} notice={notice('Dogovor nije osvežen.')} />);
  expect(spoken()).toEqual(['Radnja nije potvrđena.', 'Dogovor nije osvežen.', 'Dogovor nije osvežen.']);
});

test.each(['android', 'ios'])('%s announces an existing nonempty recovery once even when mount effects replay', async platform => {
  mockPlatform = platform;
  await render(<StrictMode><WorkspaceFooter brand={brand} notice={notice('Najpre osveži status Dogovora.')} /></StrictMode>);
  expect(spoken()).toEqual(['Najpre osveži status Dogovora.']);
});

test('announcements preserve footer recovery callbacks and the separate completion/loading status API', async () => {
  await render(<WorkspaceFooter brand={brand} loading statusText="Čuvamo promenu…" notice={notice('Radnja nije potvrđena.', true)} />);
  const actions = () => tree!.root.findAll(node => String(node.type) === 'V2Action');
  expect(actions().map(node => node.props.label)).toEqual(['Osveži status Dogovora', 'Potvrdi završetak']);
  expect(actions()[0].props).toMatchObject({ onPress: mockRefresh, disabled: true, loading: true });
  expect(actions()[1].props).toMatchObject({ onPress: mockComplete, disabled: true, loading: true });
  await update(<WorkspaceFooter brand={brand} statusText="Učitavamo Dogovor…" />);
  expect(actions()).toHaveLength(1);
  expect(actions()[0].props).toMatchObject({ onPress: mockComplete, disabled: true, loading: false });
  expect(tree!.root.findAll(node => String(node.type) === 'T').map(node => node.props.children)).toEqual(['Učitavamo Dogovor…']);
  expect(spoken()).toEqual(['Radnja nije potvrđena.']);
});

const recoveryScroll = () => tree!.root.findByProps({ testID: 'agreement-action-recovery' });
const messageHeight = () => StyleSheet.flatten(recoveryScroll().props.style).height as number;
const measureMessage = async (height: number) => {
  await act(async () => recoveryScroll().props.onContentSizeChange(mockWindow.width - 64, height));
};

test('keeps Refresh and the guarded primary outside the message scroller without capping their shared footer', async () => {
  await render(<WorkspaceFooter brand={brand} notice={notice('Ishod prethodne radnje još nije potvrđen. Osveži status pre nego što nastaviš.')} />);
  expect(recoveryScroll().findAll(node => String(node.type) === 'V2Action')).toHaveLength(0);
  const refresh = tree!.root.findByProps({ label: 'Osveži status Dogovora' });
  const primary = tree!.root.findByProps({ label: 'Potvrdi završetak' });
  expect(refresh.props).toMatchObject({ disabled: false, onPress: mockRefresh });
  expect(primary.props).toMatchObject({ disabled: true, onPress: mockComplete });
  await act(async () => refresh.props.onPress());
  expect(mockRefresh).toHaveBeenCalledTimes(1); expect(mockComplete).not.toHaveBeenCalled();
  const footer = StyleSheet.flatten(tree!.root.findByProps({ testID: 'agreement-action-footer' }).props.style);
  expect(footer.maxHeight).toBeUndefined(); expect(footer.flexShrink).toBe(0);
});

test('gives the message explicit space before measurement, fits short content, and bounds long scrolling content to the viewport', async () => {
  const message = 'Radnja nije potvrđena. Osveži status Dogovora.';
  await render(<WorkspaceFooter brand={brand} notice={notice(message)} />);
  expect(messageHeight()).toBeGreaterThan(0);
  await measureMessage(60);
  expect(messageHeight()).toBe(60); expect(recoveryScroll().props.scrollEnabled).toBe(false);
  await measureMessage(600);
  const tallViewportLimit = messageHeight();
  expect(tallViewportLimit).toBeLessThan(600); expect(tallViewportLimit).toBeGreaterThan(0);
  expect(recoveryScroll().props.scrollEnabled).toBe(true);
  mockWindow = { ...mockWindow, height: 480 };
  await update(<WorkspaceFooter brand={brand} notice={notice(message)} />);
  expect(messageHeight()).toBeLessThan(tallViewportLimit); expect(messageHeight()).toBeGreaterThan(0);
  expect(recoveryScroll().props.scrollEnabled).toBe(true);
  expect(spoken()).toEqual([message]);
});

test('remeasures new text and enlarged narrow text instead of retaining a stale short message height', async () => {
  await render(<WorkspaceFooter brand={brand} notice={notice('Osveži status Dogovora.')} />);
  await measureMessage(40);
  expect(messageHeight()).toBe(40);
  mockWindow = { ...mockWindow, width: 320, fontScale: 2 };
  await update(<WorkspaceFooter brand={brand} notice={notice('Osveži status Dogovora.')} />);
  expect(messageHeight()).toBeGreaterThan(40);
  await measureMessage(240);
  expect(messageHeight()).toBeLessThan(240); expect(recoveryScroll().props.scrollEnabled).toBe(true);
  await update(<WorkspaceFooter brand={brand} notice={notice('Dogovor nije osvežen.')} />);
  await measureMessage(80);
  expect(messageHeight()).toBe(80); expect(recoveryScroll().props.scrollEnabled).toBe(false);
  expect(spoken()).toEqual(['Osveži status Dogovora.', 'Dogovor nije osvežen.']);
});

// Plan 2.6: when nothing waits for the person there is NO green button - the footer says the state in one grey sentence - and a
// footer with nothing to say draws no padded bar at all.
test('with no action to offer the footer says the state in one grey sentence, and keeps the quiet line above it', async () => {
  await render(<WorkspaceFooter brand={null} quiet="Čeka da Marko potvrdi završetak." statusText="Osvežavamo…" />);
  expect(tree!.root.findAll(node => String(node.type) === 'V2Action')).toHaveLength(0);
  const sentence = tree!.root.findByProps({ testID: 'agreement-quiet-line' });
  expect(sentence.props.children).toBe('Čeka da Marko potvrdi završetak.');
  expect(sentence.props).toMatchObject({ variant: 'note', tone: 'muted' });
  expect(tree!.root.findAll(node => String(node.type) === 'T').map(node => node.props.children)).toEqual(['Osvežavamo…', 'Čeka da Marko potvrdi završetak.']);
});

test('a recovery notice keeps its refresh when there is no action, and the sentence stands below it', async () => {
  await render(<WorkspaceFooter brand={null} quiet="Dogovor je otkazan." notice={notice('Radnja nije potvrđena.')} />);
  expect(tree!.root.findAll(node => String(node.type) === 'V2Action').map(node => node.props.label)).toEqual(['Osveži status Dogovora']);
  expect(tree!.root.findByProps({ testID: 'agreement-quiet-line' }).props.children).toBe('Dogovor je otkazan.');
});

test('a footer with nothing to say draws nothing', async () => {
  await render(<WorkspaceFooter brand={null} quiet={null} />);
  expect(tree!.root.findAllByProps({ testID: 'agreement-action-footer' })).toHaveLength(0);
  await update(<WorkspaceFooter brand={null} />);
  expect(tree!.root.findAllByProps({ testID: 'agreement-action-footer' })).toHaveLength(0);
  await update(<WorkspaceFooter brand={brand} />);
  expect(tree!.root.findAllByProps({ testID: 'agreement-action-footer' })).toHaveLength(1);
});

test('the footer reports its height, so the outcome bar can float above it', async () => {
  const measured = jest.fn();
  await render(<WorkspaceFooter brand={brand} onLayout={measured} />);
  const event = { nativeEvent: { layout: { x: 0, y: 700, width: 411, height: 88 } } };
  await act(async () => tree!.root.findByProps({ testID: 'agreement-action-footer' }).props.onLayout(event));
  expect(measured).toHaveBeenCalledWith(event);
});
