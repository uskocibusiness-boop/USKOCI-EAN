import React from 'react';
import { StyleSheet } from 'react-native';
import { Circle } from 'react-native-svg';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { STATUS_CHIPS, STATUS_TONES } from '../../system/StatusChip';
import { AWAITING_WORD, AgreementStatusChip, agreementChipWord } from '../AgreementStatusChip';

jest.mock('../../Text', () => ({ T: 'T' }));

/**
 * A Dogovor wears ONE state chip (plan 2.2): "Dogovoren", "U toku", "Završen" and "Otkazan" are the shared chip's own states, and
 * "Čeka potvrdu" - which the shared table has no key for - is drawn from the same mark and tones, in the same chip. Shape and word
 * together; orange only when the confirmation is mine.
 */
let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { await act(async () => tree?.unmount()); });
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const chip = () => tree.root.findByProps({ testID: 'status-chip' });
const word = () => tree.root.findByType('T' as unknown as React.ElementType);
const mark = () => tree.root.findByProps({ testID: 'status-mark' });

describe('the states the shared chip knows', () => {
  it.each([['task.agreed', 'Dogovoren'], ['task.now', 'U toku'], ['task.completed', 'Završen'], ['task.cancelled', 'Otkazan']] as const)(
    '%s is drawn by the shared chip with its word %s', async (key, expected) => {
      await render(<AgreementStatusChip chip={{ kind: 'status', key }} />);
      expect(word().props.children).toBe(expected);
      expect(chip().props.accessibilityLabel).toBe(expected);
      expect(flat(chip()).backgroundColor).toBe(STATUS_TONES[STATUS_CHIPS[key].tone].ground);
      expect(agreementChipWord({ kind: 'status', key })).toBe(expected);
    });

  it('keeps "izmenjeni uslovi" after a dot for the eye and after a comma for the ear', async () => {
    await render(<AgreementStatusChip chip={{ kind: 'status', key: 'task.agreed' }} detail="izmenjeni uslovi" />);
    expect(word().props.children).toBe('Dogovoren · izmenjeni uslovi');
    expect(chip().props.accessibilityLabel).toBe('Dogovoren, izmenjeni uslovi');
  });
});

describe('"Čeka potvrdu", the Dogovor\'s own state', () => {
  it('is orange with a dot when the confirmation is mine: it waits for me', async () => {
    await render(<AgreementStatusChip chip={{ kind: 'awaiting', mine: true }} />);
    expect(word().props.children).toBe(AWAITING_WORD); expect(AWAITING_WORD).toBe('Čeka potvrdu');
    expect(chip().props.accessibilityLabel).toBe('Čeka potvrdu');
    expect(flat(chip()).backgroundColor).toBe(STATUS_TONES.attention.ground);
    expect(flat(word()).color).toBe(STATUS_TONES.attention.word);
    // A dot: something is going on, and it is for me. A ring is for what waits on someone else.
    expect(mark().findAllByType(Circle).map(node => node.props.fill)).toEqual([STATUS_TONES.attention.mark]);
  });

  it('is quiet with a ring when the other side has to give it', async () => {
    await render(<AgreementStatusChip chip={{ kind: 'awaiting', mine: false }} />);
    expect(flat(chip()).backgroundColor).toBe(STATUS_TONES.neutral.ground);
    expect(flat(word()).color).toBe(STATUS_TONES.neutral.word);
    const circle = mark().findAllByType(Circle);
    expect(circle).toHaveLength(1); expect(circle[0].props.fill).toBe('none'); expect(circle[0].props.stroke).toBe(STATUS_TONES.neutral.mark);
  });

  it('is the shared chip\'s own measure and type, so the two never sit side by side with different heights', async () => {
    await render(<AgreementStatusChip chip={{ kind: 'awaiting', mine: true }} />);
    expect(flat(chip())).toMatchObject({ alignSelf: 'flex-start', flexDirection: 'row' });
    expect(word().props.variant).toBe('label');
    await act(async () => tree.update(<AgreementStatusChip chip={{ kind: 'status', key: 'task.agreed' }} />));
    const shared = flat(chip());
    await act(async () => tree.update(<AgreementStatusChip chip={{ kind: 'awaiting', mine: false }} />));
    const own = flat(chip());
    for (const property of ['alignSelf', 'flexDirection', 'alignItems', 'gap', 'paddingVertical', 'paddingLeft', 'paddingRight', 'borderRadius'] as const) {
      expect([property, own[property]]).toEqual([property, shared[property]]);
    }
  });

  it('says its detail the same way', async () => {
    await render(<AgreementStatusChip chip={{ kind: 'awaiting', mine: true }} detail="izmenjeni uslovi" />);
    expect(word().props.children).toBe('Čeka potvrdu · izmenjeni uslovi');
    expect(chip().props.accessibilityLabel).toBe('Čeka potvrdu, izmenjeni uslovi');
  });
});
