import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The three figures of a profile (owner's pick of 8 Oct 2026, "Lice i tri broja"): rating, finished and reliability in one row, the same
 * on the person's own profile and on the public one. Every figure is the server's or it is not drawn; a figure that does not exist yet is
 * said in words and never as a zero nobody counted. The row keeps the width of one of three for two cells or one.
 */
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../system/Glyph', () => ({ Glyph: 'Glyph' }));
import { FigureCell, FigureCellError, FigureCellPlaceholder, FigureRow, NEW_RATING, RELIABILITY_UNDER, finishedFigure, ratingFigure, ratingText, reliabilityFigure } from '../ProfileFigures';

let tree: ReactTestRenderer;
const draw = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').map(node => node.children.join(''));
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the figures as the server gave them', () => {
  it.each([[4.8, '4,8'], [5, '5,0'], [4.75, '4,75'], [3, '3,0']])('writes the rating %s the Serbian way: "%s"', (average, written) => {
    expect(ratingText(average)).toBe(written);
    expect(ratingFigure(average, 3)).toMatchObject({ value: written, star: true });
  });

  it.each([[1, '1 ocena'], [2, '2 ocene'], [5, '5 ocena'], [12, '12 ocena'], [22, '22 ocene']])('says the count %s under the rating: "%s"', (count, written) => {
    expect(ratingFigure(4.8, count).label).toBe(written);
    expect(ratingFigure(4.8, count).spoken).toBe(`Ocena 4,8, ${written}`);
  });

  it('never makes up a count: without one the word under the rating is just "ocena"', () => {
    expect(ratingFigure(4.8, null)).toMatchObject({ value: '4,8', label: 'ocena', star: true });
    expect(ratingFigure(4.8, 0).label).toBe('ocena');
  });

  it('says a person without a rating in words, with no number and no star', () => {
    expect(NEW_RATING).toEqual({ value: null, word: 'Još nema', label: 'ocena' });
  });

  it.each([[0, '0', 'završenih'], [1, '1', 'završen'], [2, '2', 'završena'], [11, '11', 'završenih'], [21, '21', 'završen'], [1234, '1.234', 'završena']])(
    'says %s finished the Serbian way: "%s" with "%s" under it', (count, figure, word) => {
      expect(finishedFigure(count)).toEqual({ value: figure, label: word });
    });

  it('writes a percentage with its words under it, and says "Još nema procenta" while there is none, never 0 %', () => {
    expect(reliabilityFigure(88)).toEqual({ value: '88 %', label: 'dolazi kako je dogovoreno' });
    expect(RELIABILITY_UNDER).toBe('dolazi kako je dogovoreno');
    expect(reliabilityFigure(null)).toEqual({ value: null, word: 'Još nema procenta', label: 'dolazi kako je dogovoreno' });
  });
});

describe('a cell of the row', () => {
  it('draws the figure at 24/700 with its words at 12 under it, and the star beside the rating only', async () => {
    await draw(<FigureCell figure={ratingFigure(4.8, 12)} testID="cell" />);
    expect(texts()).toEqual(['4,8', '12 ocena']);
    expect(hosts('T')[0].props.variant).toBe('priceLarge'); expect(hosts('T')[1].props).toMatchObject({ variant: 'label', tone: 'muted' });
    expect(hosts('FactArt').map(node => [node.props.kind, node.props.size])).toEqual([['star', 16]]);
    await act(async () => tree.update(<FigureCell figure={finishedFigure(9)} />));
    expect(hosts('FactArt')).toHaveLength(0);
  });

  it('draws the words that stand where a figure does not exist, at 16/600, and never a figure beside them', async () => {
    await draw(<FigureCell figure={NEW_RATING} />);
    expect(texts()).toEqual(['Još nema', 'ocena']);
    expect(hosts('T')[0].props.variant).toBe('bodyStrong');
    expect(hosts('FactArt')).toHaveLength(0);
  });

  it('is one text for a screen reader, with the hint when it has one, and not a control without a way in', async () => {
    await draw(<FigureCell figure={{ ...reliabilityFigure(90), hint: 'Računa se iz završenih Dogovora.' }} testID="cell" />);
    const cell = hosts('View').find(node => node.props.testID === 'cell')!;
    expect(cell.props).toMatchObject({ accessible: true, accessibilityRole: 'text', accessibilityLabel: '90 % dolazi kako je dogovoreno', accessibilityHint: 'Računa se iz završenih Dogovora.' });
    expect(hosts('Press')).toHaveLength(0); expect(hosts('Glyph')).toHaveLength(0);
  });

  it('with a way in is a button of the row rung that says where it goes and ends in the quiet arrow', async () => {
    const open = jest.fn();
    await draw(<FigureCell figure={{ ...finishedFigure(9), hint: 'Otvara završene Dogovore.' }} onPress={open} />);
    const [press] = hosts('Press');
    expect(press.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: '9 završenih', accessibilityHint: 'Otvara završene Dogovore.', haptic: 'select' });
    expect(hosts('Glyph').map(node => [node.props.name, node.props.size, node.props.tone])).toEqual([['caret-right', 16, 'muted']]);
    await act(async () => press.props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('shares the row in thirds: grows and shrinks from nothing, never wider than a third and a bit, and never cuts its words', async () => {
    await draw(<FigureCell figure={ratingFigure(4.8, 12)} testID="cell" />);
    const cell = hosts('View').find(node => node.props.testID === 'cell')!;
    expect(flat(cell)).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, maxWidth: '36%', alignItems: 'center' });
    for (const line of hosts('T')) expect(line.props.numberOfLines).toBeUndefined();
  });
});

describe('the row', () => {
  it('stands its cells side by side, centred as a group, so two or one keep the width of one of three', async () => {
    await draw(<FigureRow testID="row"><FigureCell figure={finishedFigure(9)} /><FigureCell figure={reliabilityFigure(90)} /></FigureRow>);
    const row = hosts('View').find(node => node.props.testID === 'row')!;
    expect(flat(row)).toMatchObject({ flexDirection: 'row', justifyContent: 'center' });
    expect(flat(row).gap).toBeGreaterThan(0);
  });
});

describe('the states of a cell', () => {
  it('is a still shape while it reads, a progress a screen reader can name, with nothing that moves', async () => {
    await draw(<FigureCellPlaceholder label="Učitavanje reputacije" />);
    const shape = hosts('View').find(node => node.props.accessibilityRole === 'progressbar')!;
    expect(shape.props).toMatchObject({ accessible: true, accessibilityLabel: 'Učitavanje reputacije', accessibilityState: { busy: true } });
    expect(texts()).toEqual([]);
  });

  it('says in one short line that it could not be read and offers the one way to read it again, in the same place', async () => {
    const retry = jest.fn();
    await draw(<FigureCellError message="Ocene trenutno nisu dostupne." retryLabel="Osveži ocene" onRetry={retry} />);
    expect(texts()).toEqual(['Ocene trenutno nisu dostupne.', 'Osveži']);
    const [press] = hosts('Press');
    expect(press.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Osveži ocene', accessibilityHint: 'Ocene trenutno nisu dostupne.' });
    await act(async () => press.props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
