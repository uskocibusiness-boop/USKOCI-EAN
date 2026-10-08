import React from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('../motion', () => ({ useReducedMotion: () => false }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { CHECKING, CHECK_SPOKEN, OUTCOME, UNCERTAIN_ABOUT } from '../outcomeCopy';
import { OutcomeUncertain } from '../OutcomeUncertain';
import { StateView } from '../StateView';
import { stateProblems } from '../stateRules';
import { Surface } from '../Surface';
import { brandAction, sys } from '../tokens';

/**
 * "We do not know whether it worked" as one part (UI/UX pass 2026-10-08, F8b; text revision 2026-10-07, finding 4: about 350 sentences in the
 * engine's words and 36 different buttons for it): an honest title, one sentence, ONE button "Proveri" that reads the state again, and at most
 * one quiet way out. It is the state view for a screen's place and a warm note for a foot, and in both it never says the thing failed.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children).filter(child => typeof child === 'string');
const actions = () => tree.root.findAllByType(V2Action);
const size = (nodes: readonly unknown[]) => nodes.length;

describe('as a screen: the state view with the one button that finds out', () => {
  it('says what is not known, why, and offers "Proveri": the generic words when it is not told what the person did', async () => {
    const check = jest.fn();
    await render(<OutcomeUncertain onCheck={check} />);
    const view = tree.root.findByType(StateView);
    expect(view.props).toMatchObject({ kind: 'uncertain', art: 'info', title: 'Ne znamo da li je uspelo', body: 'Odgovor nije stigao.', compact: false });
    expect(texts()).toEqual(['Ne znamo da li je uspelo', 'Odgovor nije stigao.', 'Proveri']);
    expect(size(actions())).toBe(1);
    expect(actions()[0].props).toMatchObject({ label: 'Proveri', accessibilityLabel: CHECK_SPOKEN });
    await act(async () => actions()[0].props.onPress());
    expect(check).toHaveBeenCalledTimes(1);
  });

  it.each(Object.entries(UNCERTAIN_ABOUT))('about "%s": the title and the picture of the thing the person did', async (about, subject) => {
    await render(<OutcomeUncertain about={about as keyof typeof UNCERTAIN_ABOUT} onCheck={() => undefined} />);
    expect(tree.root.findByType(StateView).props).toMatchObject({ title: subject.title, art: subject.art });
  });

  it('lets the flow say it better: its own title and sentence replace the table\'s, and nothing else changes', async () => {
    await render(<OutcomeUncertain about="application" title="Ne znamo da li je prijava stigla Marku" copy="Neće se poslati dvaput."
      onCheck={() => undefined} />);
    expect(texts()).toEqual(['Ne znamo da li je prijava stigla Marku', 'Neće se poslati dvaput.', 'Proveri']);
    expect(tree.root.findByType(StateView).props.art).toBe('send');
  });

  it('shows the one quiet way out when it is given one, and never a second way to send the same thing', async () => {
    const out = jest.fn();
    await render(<OutcomeUncertain about="publication" onCheck={() => undefined} quiet={{ label: 'Nazad na zadatak', onPress: out }} />);
    expect(actions().map(action => action.props.label)).toEqual(['Proveri', 'Nazad na zadatak']);
    expect(actions()[1].props.kind).toBe('quiet');
    await act(async () => actions()[1].props.onPress());
    expect(out).toHaveBeenCalledTimes(1);
  });

  it('while it checks, the one button keeps its colour and shows its spinner and cannot be pressed twice; the words do not move', async () => {
    await render(<OutcomeUncertain onCheck={() => undefined} checking />);
    expect(actions()[0].props.loading).toBe(true);
    expect(StyleSheet.flatten(actions()[0].props.style)).toMatchObject({ backgroundColor: brandAction.backgroundColor });
    expect(texts()).toEqual(['Ne znamo da li je uspelo', 'Odgovor nije stigao.', 'Proveri']);
  });

  it('is announced as an alert, grey, like every failure, and inside a section it is the compact state', async () => {
    await render(<OutcomeUncertain about="message" onCheck={() => undefined} compact />);
    expect(tree.root.findByType(StateView).props.compact).toBe(true);
    expect(size(tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'alert'))).toBe(1);
  });

  it('follows the rules of a state, with the words of the table and with every subject', async () => {
    for (const subject of Object.values(UNCERTAIN_ABOUT)) {
      expect(stateProblems({ kind: 'uncertain', title: subject.title, body: OUTCOME.uncertain.copy, primary: { label: OUTCOME.uncertain.action } })).toEqual([]);
    }
  });
});

describe('as a note: in a foot, a thread or a sheet, where the form stays', () => {
  it('is a note in the warning tint with the title, and the secondary button: a screen has ONE green action, and in this flow it is the foot\'s', async () => {
    await render(<OutcomeUncertain layout="inline" about="application" onCheck={() => undefined} />);
    expect(tree.root.findByType(Surface).props).toMatchObject({ kind: 'note', tone: 'warn' });
    expect(size(tree.root.findAllByType(Surface))).toBe(1);
  });

  it('does not draw the state view: it draws the title in the strong type as an alert, then the button', async () => {
    await render(<OutcomeUncertain layout="inline" about="application" onCheck={() => undefined} />);
    expect(size(tree.root.findAllByType(StateView))).toBe(0);
    const [title] = tree.root.findAllByType(T);
    expect(title.props).toMatchObject({ variant: 'bodyStrong', accessibilityRole: 'alert', children: 'Ne znamo da li je prijava stigla' });
    expect(actions()[0].props).toMatchObject({ label: 'Proveri', kind: 'secondary', accessibilityLabel: CHECK_SPOKEN });
    // No filled green button anywhere in it.
    for (const action of actions()) expect(StyleSheet.flatten(action.props.style)?.backgroundColor).not.toBe(brandAction.backgroundColor);
  });

  it('asks for balanced lines for its title and its sentence', async () => {
    await render(<OutcomeUncertain layout="inline" onCheck={() => undefined} copy="Neće se poslati dvaput." />);
    expect(tree.root.findAllByType(Text).map(node => node.props.textBreakStrategy)).toEqual(['balanced', 'balanced', undefined]);
  });

  it('draws a sentence only when the flow gives one: the title is already the honest sentence', async () => {
    await render(<OutcomeUncertain layout="inline" onCheck={() => undefined} />);
    expect(texts()).toEqual(['Ne znamo da li je uspelo', 'Proveri']);
    await act(async () => tree.update(<OutcomeUncertain layout="inline" onCheck={() => undefined} copy="Neće se poslati dvaput." />));
    expect(texts()).toEqual(['Ne znamo da li je uspelo', 'Neće se poslati dvaput.', 'Proveri']);
    expect(tree.root.findAllByType(T)[1].props).toMatchObject({ variant: 'note', tone: 'muted' });
  });

  it('presses through, shows the spinner while it checks, and offers the one quiet way out', async () => {
    const check = jest.fn(), out = jest.fn();
    await render(<OutcomeUncertain layout="inline" onCheck={check} quiet={{ label: 'Nazad na zadatak', onPress: out }} />);
    expect(actions().map(action => action.props.label)).toEqual(['Proveri', 'Nazad na zadatak']);
    expect(actions()[1].props.kind).toBe('quiet');
    await act(async () => actions()[0].props.onPress()); await act(async () => actions()[1].props.onPress());
    expect([check.mock.calls.length, out.mock.calls.length]).toEqual([1, 1]);
    await act(async () => tree.update(<OutcomeUncertain layout="inline" onCheck={check} checking quiet={{ label: 'Nazad na zadatak', onPress: out }} />));
    expect(actions()[0].props.loading).toBe(true);
  });

  it('says its words once to a screen reader, and keeps the 8 dp between the words and the button the foot keeps under its reason', async () => {
    await render(<OutcomeUncertain layout="inline" onCheck={() => undefined} />);
    expect(size(tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityLiveRegion === 'polite'))).toBe(1);
    const column = tree.root.findAll(node => typeof node.type === 'string' && flat(node).marginTop === sys.space.sm)[0];
    expect(flat(column)).toMatchObject({ marginTop: sys.space.sm, gap: sys.space.sm });
  });
});

describe('what a screen reader is told while it checks', () => {
  it('hears "Proveravamo…" once when the check starts, and nothing when the state is first drawn or when it stops', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined).mockClear();
    await render(<OutcomeUncertain onCheck={() => undefined} />);
    expect(announce).not.toHaveBeenCalled();
    await act(async () => tree.update(<OutcomeUncertain onCheck={() => undefined} checking />));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(CHECKING);
    await act(async () => tree.update(<OutcomeUncertain onCheck={() => undefined} checking={false} />));
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('says it for the note as well, and the name of the button carries the word that is written on it', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined).mockClear();
    await render(<OutcomeUncertain layout="inline" onCheck={() => undefined} checking />);
    expect(announce).toHaveBeenCalledWith('Proveravamo…');
    expect(actions()[0].props.accessibilityLabel.toLowerCase().includes(actions()[0].props.label.toLowerCase())).toBe(true);
  });
});
