import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../../contracts/projections';
import { sys } from '../../system/tokens';
import { agreementStepModel, STEP_LABELS, stepsFitInRow, stepsSummary, type OwnRating, type StepStatus } from '../agreementStepsModel';

let mockReduced = false;
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => mockReduced }));
import { AgreementSteps } from '../AgreementSteps';

/**
 * The step bar says where a Dogovor STANDS (plan 2.6), whatever its history holds: Dogovoreno -> Gotovo -> Potvrđeno -> Ocena. A step
 * behind is a green check, the step it is at a filled green dot, the ones ahead a grey outline; a cancelled Dogovor is grey as a whole
 * and says so in one line. The words are one short word each and are never broken in the middle (phone, 2026-10-08): in one row when the
 * four fit it, in a column when they do not.
 */
type State = DogovorProjekcija['stanje'];
const statuses = (state: State, rating?: OwnRating): StepStatus[] => agreementStepModel(state, rating).map(step => step.status);

describe('the model: one answer for every state the Dogovor can be in', () => {
  it('has the four steps of the plan, in their short words', () => {
    expect(agreementStepModel('CONFIRMED').map(step => step.label)).toEqual(['Dogovoreno', 'Gotovo', 'Potvrđeno', 'Ocena']);
    expect(STEP_LABELS).toEqual({ agreed: 'Dogovoreno', done: 'Gotovo', confirmed: 'Potvrđeno', rated: 'Ocena' });
    expect(agreementStepModel('CONFIRMED').map(step => step.key)).toEqual(['agreed', 'done', 'confirmed', 'rated']);
  });

  it('is one word per step: nothing in a label can break anywhere but in the middle of a word', () => {
    for (const label of Object.values(STEP_LABELS)) expect(label).toMatch(/^\S+$/);
  });

  it('stands at the second step while the work is agreed and the third while the confirmation is awaited', () => {
    expect(statuses('CONFIRMED')).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(statuses('CONFIRMED', 'NOT_APPLICABLE')).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(statuses('AWAITING_REQUESTER')).toEqual(['done', 'done', 'current', 'upcoming']);
  });

  it('stands at the rating once the work is confirmed and my rating is due, or could not be read (the footer keeps it on offer too)', () => {
    expect(statuses('COMPLETED', 'DUE')).toEqual(['done', 'done', 'done', 'current']);
    expect(statuses('COMPLETED', 'UNKNOWN')).toEqual(['done', 'done', 'done', 'current']);
  });

  it('finishes with a check on the rating once it is given, and leaves it grey when it can no longer be given', () => {
    expect(statuses('COMPLETED', 'GIVEN')).toEqual(['done', 'done', 'done', 'done']);
    expect(statuses('COMPLETED', 'CLOSED')).toEqual(['done', 'done', 'done', 'upcoming']);
    expect(statuses('COMPLETED', 'NOT_APPLICABLE')).toEqual(['done', 'done', 'done', 'upcoming']);
    expect(statuses('COMPLETED')).toEqual(['done', 'done', 'done', 'upcoming']);
  });

  it('is grey as a whole when the Dogovor is cancelled, whatever the rating read says', () => {
    for (const rating of ['DUE', 'GIVEN', 'CLOSED', 'UNKNOWN', 'NOT_APPLICABLE'] as const) expect(statuses('CANCELLED', rating)).toEqual(['cancelled', 'cancelled', 'cancelled', 'cancelled']);
    expect(agreementStepModel('CANCELLED').map(step => step.label)).toEqual(['Dogovoreno', 'Gotovo', 'Potvrđeno', 'Ocena']);
  });

  it('has at most one current step in any state', () => {
    for (const state of ['CONFIRMED', 'AWAITING_REQUESTER', 'COMPLETED', 'CANCELLED'] as const) {
      for (const rating of ['DUE', 'GIVEN', 'CLOSED', 'UNKNOWN', 'NOT_APPLICABLE'] as const) {
        expect(statuses(state, rating).filter(status => status === 'current').length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is spoken as each step and where it stands, and a cancelled Dogovor as one sentence', () => {
    expect(stepsSummary(agreementStepModel('CONFIRMED'))).toBe('Dogovoreno: urađeno. Gotovo: trenutni korak. Potvrđeno: na redu. Ocena: na redu.');
    expect(stepsSummary(agreementStepModel('CANCELLED'))).toBe('Dogovor je otkazan.');
  });
});

describe('whether the four words stand in one row', () => {
  const words = Object.values(STEP_LABELS);

  it('does on the owner\'s phone (361 dp) at his text size, 1.15, with room left for the lines between the steps', () => {
    expect(stepsFitInRow(words, { width: 361, scale: 1 })).toBe(true);
    expect(stepsFitInRow(words, { width: 361, scale: 1.15 })).toBe(true);
    expect(stepsFitInRow(words, { width: 361.14, scale: 1.15 })).toBe(true);
  });

  it('does not at 1.3 on that phone, where the words would not leave 12 dp between two of them: the bar becomes a column', () => {
    expect(stepsFitInRow(words, { width: 361, scale: 1.3 })).toBe(false);
    expect(stepsFitInRow(words, { width: 361, scale: 1.5 })).toBe(false);
  });

  it('follows the room: a wider phone keeps the row at 1.3, and a narrower one gives it up at 1.15', () => {
    expect(stepsFitInRow(words, { width: 412, scale: 1.3 })).toBe(true);
    expect(stepsFitInRow(words, { width: 340, scale: 1.15 })).toBe(false);
    expect(stepsFitInRow(words, { width: 320, scale: 1 })).toBe(true);
  });

  it('measures the words it is given, and claims nothing for a room that is not a measurement', () => {
    expect(stepsFitInRow(['Zadatak je gotov', ...words.slice(1)], { width: 361, scale: 1.15 })).toBe(false);
    expect(stepsFitInRow(words, { width: Number.NaN, scale: 1 })).toBe(false);
    expect(stepsFitInRow(words, { width: 361, scale: Number.NaN })).toBe(false);
  });
});

describe('the bar', () => {
  let tree: ReactTestRenderer;
  const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
  afterEach(async () => { await act(async () => tree?.unmount()); });
  const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
  const bar = () => tree.root.findByProps({ accessibilityRole: 'progressbar' });
  const step = (key: string) => tree.root.findByProps({ testID: `agreement-step-${key}` });
  const texts = () => tree.root.findAll(node => String(node.type) === 'T').map(node => node.children.join(''));
  const labelNodes = () => tree.root.findAll(node => String(node.type) === 'T' && Object.values(STEP_LABELS).includes(node.children.join('')));
  // Host elements only: a View is two nodes.
  const joins = () => tree.root.findAll(node => typeof node.type === 'string' && typeof node.props.testID === 'string' && node.props.testID.startsWith('agreement-join-'));
  const checks = () => tree.root.findAll(node => String(node.type) === 'Check');
  const green = () => tree.root.findAll(node => typeof node.type === 'string' && [flat(node).backgroundColor, flat(node).borderColor].includes(sys.color.green));
  const PHONE = { width: 361, scale: 1.15 }, LARGE = { width: 361, scale: 1.3 };

  it('draws the four steps as one thing for a screen reader, at the step the Dogovor is at', async () => {
    await render(<AgreementSteps state="AWAITING_REQUESTER" ownRating="NOT_APPLICABLE" room={PHONE} />);
    // Not "Tok Dogovora": that is the name of the history row on the page, and two controls must not share a name.
    expect(bar().props.accessibilityLabel).toBe('Koraci Dogovora');
    expect(bar().props.accessibilityValue).toEqual({ min: 1, max: 4, now: 3,
      text: 'Dogovoreno: urađeno. Gotovo: urađeno. Potvrđeno: trenutni korak. Ocena: na redu.' });
    expect(texts().filter(text => Object.values(STEP_LABELS).includes(text))).toEqual(['Dogovoreno', 'Gotovo', 'Potvrđeno', 'Ocena']);
    // The marks are drawing only: a screen reader hears the summary, not each mark.
    expect(step('agreed').props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  });

  it('draws a check behind the current step and none ahead of it', async () => {
    await render(<AgreementSteps state="CONFIRMED" room={PHONE} />);
    expect(checks()).toHaveLength(1);
    expect(step('agreed').findAllByType('Check' as unknown as React.ElementType)).toHaveLength(1);
    expect(step('done').findAllByType('Check' as unknown as React.ElementType)).toHaveLength(0);
    // The current step wears the green edge and the green dot; the ones ahead wear neither. (Host elements only: a View is two nodes.)
    const drawn = (root: ReactTestInstance, key: 'borderColor' | 'backgroundColor') =>
      root.findAll(node => typeof node.type === 'string' && flat(node)[key] === sys.color.green);
    expect(drawn(step('done'), 'borderColor')).toHaveLength(1);
    // Two green fills in the current column: the dot, and the line that arrives from the step behind it, which is finished.
    expect(drawn(step('done'), 'backgroundColor')).toHaveLength(2);
    for (const ahead of ['confirmed', 'rated']) {
      expect(drawn(step(ahead), 'borderColor')).toHaveLength(0);
      expect(drawn(step(ahead), 'backgroundColor')).toHaveLength(0);
    }
  });

  it('draws a check on every step of a finished and rated Dogovor', async () => {
    await render(<AgreementSteps state="COMPLETED" ownRating="GIVEN" room={PHONE} />);
    expect(checks()).toHaveLength(4);
    expect(bar().props.accessibilityValue.now).toBeUndefined();
  });

  it('is grey all through when cancelled, with one line that says so and invents no date, person or reason', async () => {
    await render(<AgreementSteps state="CANCELLED" ownRating="DUE" room={PHONE} />);
    expect(checks()).toHaveLength(0);
    expect(green()).toHaveLength(0);
    expect(bar().props.accessibilityValue).toEqual({ text: 'Dogovor je otkazan.' });
    expect(tree.root.findByProps({ testID: 'agreement-steps-cancelled' }).props.children).toBe('Otkazano');
  });

  it('adds to the cancelled line exactly what the Dogovor carries, in the order date, person, reason', async () => {
    await render(<AgreementSteps state="CANCELLED" now={new Date('2026-10-07T10:00:00Z')}
      cancellation={{ at: '2026-10-05T12:00:00Z', by: 'Marko', reason: 'Promenio se termin' }} />);
    expect(tree.root.findByProps({ testID: 'agreement-steps-cancelled' }).props.children).toBe('Otkazano 5. okt · 14:00 · Marko · Promenio se termin');
  });

  it('draws no cancelled line for a Dogovor that is not cancelled', async () => {
    await render(<AgreementSteps state="COMPLETED" ownRating="DUE" cancellation={{ reason: 'ne' }} />);
    expect(tree.root.findAllByProps({ testID: 'agreement-steps-cancelled' })).toHaveLength(0);
  });

  it('adds no line about the deadline or a stopped completion: the head of the Dogovor says it once', async () => {
    await render(<AgreementSteps state="AWAITING_REQUESTER" room={PHONE} />);
    expect(tree.root.findAllByProps({ testID: 'agreement-steps-note' })).toHaveLength(0);
    expect(texts().join(' ')).not.toMatch(/Potvrda do|Automatski završetak|48\s?h/);
  });

  describe('in one row, at the owner\'s phone and text size', () => {
    it('gives every step the width of its own word, on one line, and joins the steps with the three lines that share what is left', async () => {
      await render(<AgreementSteps state="CONFIRMED" room={PHONE} />);
      expect(labelNodes().map(node => node.children.join(''))).toEqual(['Dogovoreno', 'Gotovo', 'Potvrđeno', 'Ocena']);
      // A word is never cut and never wrapped: one line each, and a step that does not shrink under its word.
      for (const node of labelNodes()) expect(node.props.numberOfLines).toBe(1);
      for (const key of ['agreed', 'done', 'confirmed', 'rated']) expect(flat(step(key)).flexShrink).toBe(0);
      expect(joins()).toHaveLength(3);
      for (const join of joins()) expect(flat(join)).toMatchObject({ flex: 1, minWidth: sys.space.md });
    });

    it('joins in green what is behind the current step, and in grey what is ahead', async () => {
      await render(<AgreementSteps state="AWAITING_REQUESTER" room={PHONE} />);
      const colours = joins().map(join => flat(join).backgroundColor);
      expect(colours).toEqual([sys.color.green, sys.color.green, sys.color.line]);
    });
  });

  describe('in a column, where the four words do not fit one row', () => {
    it('puts each step on its own line, its mark first, and never cuts or wraps a word', async () => {
      await render(<AgreementSteps state="CONFIRMED" room={LARGE} />);
      expect(joins()).toHaveLength(0);
      expect(labelNodes().map(node => node.children.join(''))).toEqual(['Dogovoreno', 'Gotovo', 'Potvrđeno', 'Ocena']);
      for (const node of labelNodes()) expect(node.props.numberOfLines).toBeUndefined();
      expect(bar().props.accessibilityValue).toEqual({ min: 1, max: 4, now: 2, text: 'Dogovoreno: urađeno. Gotovo: trenutni korak. Potvrđeno: na redu. Ocena: na redu.' });
    });

    it('keeps the marks and the green of the row: a check behind, the dot where it stands, the line between them green only where it has been', async () => {
      await render(<AgreementSteps state="AWAITING_REQUESTER" room={LARGE} />);
      expect(checks()).toHaveLength(2);
      const stackLines = tree.root.findAll(node => typeof node.type === 'string' && flat(node).width === 2 && flat(node).minHeight === sys.space.base);
      expect(stackLines.map(line => flat(line).backgroundColor)).toEqual([sys.color.green, sys.color.green, sys.color.line]);
      expect(tree.root.findByProps({ testID: 'agreement-step-dot' })).toBeTruthy();
    });

    it('is what a narrower window than the phone gets too', async () => {
      await render(<AgreementSteps state="CONFIRMED" room={{ width: 320, scale: 1.3 }} />);
      expect(joins()).toHaveLength(0);
    });
  });

  it('chooses the row or the column from the window itself when the screen hands no room (the jest window is 750 dp wide)', async () => {
    await render(<AgreementSteps state="CONFIRMED" />);
    expect(joins()).toHaveLength(3);
  });
});

/**
 * M-09 (motion spec 2026-10-07): the dot of the step the Dogovor has just come to stand at settles from 0.6 to its size over `enter`, on
 * `easeOut`, but only when the state changed while the person was looking - never at the first drawing, never again on a repeat render,
 * and never under reduced motion.
 */
describe('the dot of the current step moves only when the Dogovor moved on while it was open', () => {
  let tree: ReactTestRenderer;
  const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
  const timing = () => jest.spyOn(Animated, 'timing');
  afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); mockReduced = false; });

  it('is still at the first drawing and on a repeat render of the same state', async () => {
    const run = timing();
    await render(<AgreementSteps state="CONFIRMED" />);
    await act(async () => tree.update(<AgreementSteps state="CONFIRMED" />));
    expect(run).not.toHaveBeenCalled();
  });

  it('settles from 0.6 once, over the enter time on the one decelerating curve and on the native driver, when the state changes', async () => {
    await render(<AgreementSteps state="CONFIRMED" />);
    const run = timing();
    await act(async () => tree.update(<AgreementSteps state="AWAITING_REQUESTER" />));
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: sys.motion.enter, useNativeDriver: true });
    // The dot that was current and is not any more is a check now; the one that is current starts at 0.6.
    const dot = tree.root.findByProps({ testID: 'agreement-step-dot' });
    expect(Number(JSON.stringify(dot.props.style.find((entry: { transform?: unknown }) => entry.transform).transform[0].scale))).toBeLessThanOrEqual(1);
    await act(async () => tree.update(<AgreementSteps state="AWAITING_REQUESTER" cancellation={null} />));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not move under reduced motion: the state changes at once', async () => {
    mockReduced = true;
    await render(<AgreementSteps state="CONFIRMED" />);
    const run = timing();
    await act(async () => tree.update(<AgreementSteps state="AWAITING_REQUESTER" />));
    expect(run).not.toHaveBeenCalled();
  });
});
