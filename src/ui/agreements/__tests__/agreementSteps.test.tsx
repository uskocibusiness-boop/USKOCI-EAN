import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../../contracts/projections';
import { sys } from '../../system/tokens';
import { agreementStepModel, deadlineNote, STEP_LABELS, stepsSummary, type OwnRating, type StepStatus } from '../agreementStepsModel';

jest.mock('../../Text', () => ({ T: 'T' }));
import { AgreementSteps } from '../AgreementSteps';

/**
 * The step bar says where a Dogovor STANDS (plan 2.6), whatever its history holds: Dogovoreno -> Zadatak je gotov -> Potvrđeno ->
 * Ocena. A step behind is a green check, the step it is at a filled green dot, the ones ahead a grey outline; a cancelled Dogovor is
 * grey as a whole and says so in one line. The deadline under the second step is the server's, never a number written in the code.
 */
type State = DogovorProjekcija['stanje'];
const statuses = (state: State, rating?: OwnRating): StepStatus[] => agreementStepModel(state, rating).map(step => step.status);

describe('the model: one answer for every state the Dogovor can be in', () => {
  it('has the four steps of the plan, in their words', () => {
    expect(agreementStepModel('CONFIRMED').map(step => step.label)).toEqual(['Dogovoreno', 'Zadatak je gotov', 'Potvrđeno', 'Ocena']);
    expect(STEP_LABELS).toEqual({ agreed: 'Dogovoreno', done: 'Zadatak je gotov', confirmed: 'Potvrđeno', rated: 'Ocena' });
    expect(agreementStepModel('CONFIRMED').map(step => step.key)).toEqual(['agreed', 'done', 'confirmed', 'rated']);
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
    expect(agreementStepModel('CANCELLED').map(step => step.label)).toEqual(['Dogovoreno', 'Zadatak je gotov', 'Potvrđeno', 'Ocena']);
  });

  it('has at most one current step in any state', () => {
    for (const state of ['CONFIRMED', 'AWAITING_REQUESTER', 'COMPLETED', 'CANCELLED'] as const) {
      for (const rating of ['DUE', 'GIVEN', 'CLOSED', 'UNKNOWN', 'NOT_APPLICABLE'] as const) {
        expect(statuses(state, rating).filter(status => status === 'current').length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is spoken as each step and where it stands, and a cancelled Dogovor as one sentence', () => {
    expect(stepsSummary(agreementStepModel('CONFIRMED'))).toBe('Dogovoreno: urađeno. Zadatak je gotov: trenutni korak. Potvrđeno: na redu. Ocena: na redu.');
    expect(stepsSummary(agreementStepModel('CANCELLED'))).toBe('Dogovor je otkazan.');
  });
});

describe('the line under the second step', () => {
  it('is the real deadline the server gave, in Serbian time, only while the confirmation is awaited', () => {
    // The phone in Jest is in UTC, so the zone is named; on a phone in Serbia the note is the time alone.
    const note = deadlineNote({ state: 'AWAITING_REQUESTER', deadlineIso: '2026-09-18T10:00:00Z', problemOpen: false });
    expect(note).toMatch(/^Potvrda do 18\. sep( 2026)? · 12:00/);
    expect(note).not.toMatch(/48/);
    expect(deadlineNote({ state: 'CONFIRMED', deadlineIso: '2026-09-18T10:00:00Z', problemOpen: false })).toBeNull();
    expect(deadlineNote({ state: 'COMPLETED', deadlineIso: '2026-09-18T10:00:00Z', problemOpen: false })).toBeNull();
    expect(deadlineNote({ state: 'CANCELLED', deadlineIso: '2026-09-18T10:00:00Z', problemOpen: false })).toBeNull();
  });

  it('says nothing about a deadline the server did not give', () => {
    expect(deadlineNote({ state: 'AWAITING_REQUESTER', deadlineIso: null, problemOpen: false })).toBeNull();
    expect(deadlineNote({ state: 'AWAITING_REQUESTER', deadlineIso: undefined, problemOpen: false })).toBeNull();
    expect(deadlineNote({ state: 'AWAITING_REQUESTER', deadlineIso: 'tomorrow', problemOpen: false })).toBeNull();
  });

  it('says that the automatic completion is stopped while a problem is open', () => {
    expect(deadlineNote({ state: 'AWAITING_REQUESTER', deadlineIso: '2026-09-18T10:00:00Z', problemOpen: true }))
      .toBe('Automatski završetak je zaustavljen zbog prijavljenog problema.');
    expect(deadlineNote({ state: 'AWAITING_REQUESTER', deadlineIso: null, problemOpen: true })).toBe('Automatski završetak je zaustavljen zbog prijavljenog problema.');
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
  const checks = () => tree.root.findAll(node => String(node.type) === 'Check');
  const green = () => tree.root.findAll(node => typeof node.type === 'string' && [flat(node).backgroundColor, flat(node).borderColor].includes(sys.color.green));

  it('draws the four steps as one thing for a screen reader, at the step the Dogovor is at', async () => {
    await render(<AgreementSteps state="AWAITING_REQUESTER" ownRating="NOT_APPLICABLE" deadlineIso="2026-09-18T10:00:00Z" />);
    // Not "Tok Dogovora": that is the name of the history row on the page, and two controls must not share a name.
    expect(bar().props.accessibilityLabel).toBe('Koraci Dogovora');
    expect(bar().props.accessibilityValue).toEqual({ min: 1, max: 4, now: 3,
      text: 'Dogovoreno: urađeno. Zadatak je gotov: urađeno. Potvrđeno: trenutni korak. Ocena: na redu.' });
    expect(texts().filter(text => Object.values(STEP_LABELS).includes(text))).toEqual(['Dogovoreno', 'Zadatak je gotov', 'Potvrđeno', 'Ocena']);
    // The marks are drawing only: a screen reader hears the summary, not each mark.
    expect(step('agreed').props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  });

  it('draws a check behind the current step and none ahead of it', async () => {
    await render(<AgreementSteps state="CONFIRMED" />);
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
    await render(<AgreementSteps state="COMPLETED" ownRating="GIVEN" />);
    expect(checks()).toHaveLength(4);
    expect(bar().props.accessibilityValue.now).toBeUndefined();
  });

  it('puts the real deadline under the second step, and no hard-coded hours anywhere', async () => {
    await render(<AgreementSteps state="AWAITING_REQUESTER" deadlineIso="2026-09-18T10:00:00Z" />);
    const note = tree.root.findByProps({ testID: 'agreement-steps-note' });
    expect(note.props.children).toMatch(/^Potvrda do 18\. sep( 2026)? · 12:00/);
    expect(texts().join(' ')).not.toMatch(/48\s?h/);
    await act(async () => tree.update(<AgreementSteps state="CONFIRMED" />));
    expect(tree.root.findAllByProps({ testID: 'agreement-steps-note' })).toHaveLength(0);
  });

  it('is grey all through when cancelled, with one line that says so and invents no date, person or reason', async () => {
    await render(<AgreementSteps state="CANCELLED" ownRating="DUE" deadlineIso="2026-09-18T10:00:00Z" />);
    expect(checks()).toHaveLength(0);
    expect(green()).toHaveLength(0);
    expect(bar().props.accessibilityValue).toEqual({ text: 'Dogovor je otkazan.' });
    expect(tree.root.findByProps({ testID: 'agreement-steps-cancelled' }).props.children).toBe('Otkazano');
    expect(tree.root.findAllByProps({ testID: 'agreement-steps-note' })).toHaveLength(0);
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
});
