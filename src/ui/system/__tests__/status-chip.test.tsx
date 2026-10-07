import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';
import { Circle, Path } from 'react-native-svg';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { STATUS_CHIPS, STATUS_KEYS, STATUS_MARK, STATUS_TONES, StatusChip, StatusMark, type StatusKey, type StatusShape, type StatusTone } from '../StatusChip';
import { sys } from '../tokens';

jest.mock('../../Text', () => ({ T: 'T' }));

/**
 * One chip for where a thing stands (plan 2.2). A state is a SHAPE and a WORD, never a colour alone; the tone says whose move
 * it is. These cases pin the table (so a word cannot drift from screen to screen), the rule that the shape and the word are
 * always drawn, and the contrast of every pair the chip is built from.
 */
let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { await act(async () => tree?.unmount()); });
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const chip = () => tree.root.findByProps({ testID: 'status-chip' });
const word = () => tree.root.findByType('T' as unknown as React.ElementType);
const mark = () => tree.root.findByProps({ testID: 'status-mark' });

// WCAG relative luminance and contrast, for #RRGGBB.
const channel = (value: number) => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => { const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const TASKS: StatusKey[] = ['task.draft', 'task.published', 'task.choosing', 'task.agreed', 'task.now', 'task.completed', 'task.cancelled', 'task.expired'];
const APPLICATIONS: StatusKey[] = ['application.sent', 'application.seen', 'application.selected', 'application.notSelected', 'application.withdrawn'];

describe('the table of states', () => {
  it('has exactly the plan\'s task and application states, each with its one word', () => {
    expect([...STATUS_KEYS].sort()).toEqual([...TASKS, ...APPLICATIONS].sort());
    // "U toku" is the owner's word for the agreed time having arrived (decision d01, 2026-10-07), not "Termin je sada".
    expect(TASKS.map(key => STATUS_CHIPS[key].word)).toEqual(['Nacrt', 'Objavljen', 'Bira se', 'Dogovoren', 'U toku', 'Završen', 'Otkazan', 'Istekao']);
    expect(STATUS_KEYS.map(key => STATUS_CHIPS[key].word)).not.toContain('Termin je sada');
    expect(APPLICATIONS.map(key => STATUS_CHIPS[key].word)).toEqual(['Poslata', 'Viđena', 'Izabrana', 'Nije izabrana', 'Povučena']);
  });

  it('never gives two states of one object the same word, and every word is a real word', () => {
    for (const family of [TASKS, APPLICATIONS]) {
      const words = family.map(key => STATUS_CHIPS[key].word);
      expect(new Set(words).size).toBe(words.length);
    }
    for (const key of STATUS_KEYS) expect([key, STATUS_CHIPS[key].word.trim().length > 1]).toEqual([key, true]);
  });

  it('says the phase by the shape and whose move it is by the tone, the same way for every state', () => {
    const shapes: StatusShape[] = ['dot', 'ring', 'check', 'dash'], tones: StatusTone[] = ['neutral', 'green', 'attention', 'grey'];
    for (const key of STATUS_KEYS) {
      const { shape, tone } = STATUS_CHIPS[key];
      expect([key, shapes.includes(shape), tones.includes(tone)]).toEqual([key, true, true]);
    }
    const of = (tone: StatusTone) => STATUS_KEYS.filter(key => STATUS_CHIPS[key].tone === tone);
    // The orange is the one state that waits for the person; it is never spent on a state that does not.
    expect(of('attention')).toEqual(['task.choosing']);
    // What is over is grey and is either settled or ended; a state that ended without a result is always a dash.
    for (const key of of('grey')) expect([key, ['check', 'dash'].includes(STATUS_CHIPS[key].shape)]).toEqual([key, true]);
    for (const key of STATUS_KEYS.filter(k => STATUS_CHIPS[k].shape === 'dash')) expect([key, STATUS_CHIPS[key].tone]).toEqual([key, 'grey']);
    // Not live yet, or sent and waiting for someone else: a ring, and never green or orange.
    for (const key of STATUS_KEYS.filter(k => STATUS_CHIPS[k].shape === 'ring')) expect([key, STATUS_CHIPS[key].tone]).toEqual([key, 'neutral']);
    // Something going on is a dot and a settled agreement a check, so the shape alone tells a live thing from a done one.
    expect(STATUS_CHIPS['task.published'].shape).toBe('dot'); expect(STATUS_CHIPS['task.agreed'].shape).toBe('check');
    expect(STATUS_CHIPS['task.completed'].shape).toBe('check'); expect(STATUS_CHIPS['task.cancelled'].shape).toBe('dash');
    // Every shape is used, so the four shapes are four meanings and not a decoration.
    expect(new Set(STATUS_KEYS.map(key => STATUS_CHIPS[key].shape))).toEqual(new Set(shapes));
  });
});

describe('the chip', () => {
  it.each(STATUS_KEYS)('%s draws its word AND its shape, and a screen reader hears the word alone', async key => {
    const { word: said, shape, tone } = STATUS_CHIPS[key];
    await render(<StatusChip status={key} />);
    // The word is drawn, in the label type, never under 12.
    expect(word().props.children).toBe(said);
    expect(word().props.variant).toBe('label');
    expect(sys.type.label.fontSize).toBeGreaterThanOrEqual(12); expect(sys.type.label.fontSize).toBeLessThanOrEqual(13);
    expect(flat(word()).color).toBe(STATUS_TONES[tone].word);
    // The shape is drawn: a mark of the chip's own tone, one of the four drawings, and it is not read aloud.
    expect(mark().props).toMatchObject({ width: STATUS_MARK, height: STATUS_MARK, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
    const drawn = { dot: mark().findAllByType(Circle).filter(node => node.props.fill !== 'none'), ring: mark().findAllByType(Circle).filter(node => node.props.fill === 'none'),
      check: mark().findAllByType(Path).filter(node => node.props.d.includes('L5 9')), dash: mark().findAllByType(Path).filter(node => node.props.d === 'M3 6 L9 6') };
    for (const candidate of ['dot', 'ring', 'check', 'dash'] as const) expect([key, candidate, drawn[candidate].length]).toEqual([key, candidate, candidate === shape ? 1 : 0]);
    const drawing = drawn[shape][0];
    expect(drawing.props.fill === 'none' ? drawing.props.stroke : drawing.props.fill).toBe(STATUS_TONES[tone].mark);
    // One thing for a screen reader, named by the word.
    expect(chip().props).toMatchObject({ accessible: true, accessibilityRole: 'text', accessibilityLabel: said });
    expect(flat(chip()).backgroundColor).toBe(STATUS_TONES[tone].ground);
  });

  it('adds a detail after a dot for the eye and after a comma for the ear, without changing the word, the shape or the tone', async () => {
    await render(<StatusChip status="task.choosing" detail="3" />);
    expect(word().props.children).toBe('Bira se · 3');
    expect(chip().props.accessibilityLabel).toBe('Bira se, 3');
    expect(STATUS_CHIPS['task.choosing']).toEqual({ word: 'Bira se', shape: 'dot', tone: 'attention' });
  });

  it('is a small chip that sits in a row and never takes more than its words, and takes the caller\'s style last', async () => {
    await render(<StatusChip status="task.draft" style={{ marginTop: 4 }} />);
    expect(flat(chip())).toMatchObject({ alignSelf: 'flex-start', flexDirection: 'row', borderRadius: sys.radius.pill, marginTop: 4 });
  });

  it('draws a mark alone for a caller that has its own words', async () => {
    await render(<StatusMark shape="check" tone="green" />);
    expect(mark().findAllByType(Path)).toHaveLength(1);
  });
});

describe('what it is built from', () => {
  it('reads its words at 4.5:1 or better on their ground, and its marks at 3:1', () => {
    for (const tone of ['neutral', 'green', 'attention', 'grey'] as const) {
      const { ground, mark: markColour, word: wordColour } = STATUS_TONES[tone];
      expect([tone, 'word', contrast(wordColour, ground) >= 4.5]).toEqual([tone, 'word', true]);
      expect([tone, 'mark', contrast(markColour, ground) >= 3]).toEqual([tone, 'mark', true]);
    }
  });

  it('uses only colours of the system: no colour of its own is spelled in the file', () => {
    const sysColours = new Set<unknown>(Object.values(sys.color));
    for (const tone of Object.values(STATUS_TONES)) for (const value of Object.values(tone)) expect(sysColours.has(value)).toBe(true);
    const source = readFileSync(join(__dirname, '../StatusChip.tsx'), 'utf8');
    expect(source.match(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_])/gi) ?? []).toEqual([]);
  });

  it('keeps the label type at 12 px, and no word is drawn smaller anywhere in it', () => {
    expect(sys.type.label.fontSize).toBe(12);
    const source = readFileSync(join(__dirname, '../StatusChip.tsx'), 'utf8');
    expect(source.match(/fontSize:\s*\d+/g) ?? []).toEqual([]);
  });
});
