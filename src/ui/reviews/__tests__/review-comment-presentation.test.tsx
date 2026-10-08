import React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer, type ReactTestRendererJSON } from 'react-test-renderer';

/**
 * The rating screen as it is DRAWN with the optional comment (D12), from its state alone: where the field sits, what the saved
 * receipt shows, and what keeps the save above the keyboard. The screen that reads and writes is tested over the real services in
 * `oceni-dogovor-comment-flag-on.test.tsx`; with no comment in the view the screen is the one recorded in the flag-off baseline.
 */
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../system/SuccessMark', () => ({ SuccessMark: 'SuccessMark' }));
import { AgreementReviewPresentation, SAVE_WARNING, type ReviewView } from '../AgreementReviewPresentation';
import type { ReviewCommentFieldView } from '../ReviewCommentField';
import { REVIEW_COMMENT_NOTICE } from '../ReviewCommentField';

const catalog = { maxTags: 3, tags: ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'] as const };
const field = (patch: Partial<ReviewCommentFieldView> = {}): ReviewCommentFieldView => ({ value: '', open: false, editable: true, maxLength: 500, count: 0,
  invalid: false, onOpen: jest.fn(), onChange: jest.fn(), ...patch });
const eligible = (patch: Record<string, unknown> = {}): ReviewView => ({ kind: 'eligible', catalog, rating: 4, tags: [], editable: true, attempt: false,
  onRate: jest.fn(), onToggleTag: jest.fn(), save: { label: 'Sačuvaj ocenu', loading: false, disabled: false, reason: null, onPress: jest.fn() }, ...patch });
const saved = (patch: Record<string, unknown> = {}): ReviewView => ({ kind: 'saved', rating: 4, tags: ['ON_TIME'], fresh: false, ...patch });
const retry = { label: 'Ponovo učitaj ocenu', disabled: false, onPress: jest.fn() };
let tree: ReactTestRenderer;
const draw = async (view: ReviewView, keyboardAware?: boolean, notice: string | null = null) => {
  await act(async () => { tree = create(<AgreementReviewPresentation backLabel="Nazad na Dogovor" onBack={jest.fn()} view={view} retry={retry}
    notice={notice} person={null} keyboardAware={keyboardAware} />); });
};
afterEach(async () => { await act(async () => tree?.unmount()); });
/** Every piece of text in the order it is drawn. */
const inOrder = () => {
  const out: string[] = [];
  const walk = (node: ReactTestRendererJSON | string | null) => {
    if (node === null) return;
    if (typeof node === 'string') { out.push(node); return; }
    (node.children ?? []).forEach(walk);
  };
  const json = tree.toJSON(); (Array.isArray(json) ? json : [json]).forEach(node => walk(node));
  return out;
};

describe('the layout around the keyboard', () => {
  it('without a comment on screen there is no avoiding view: the layout of before (the frame lets a tap through while a field has the keyboard, as every frame does)', async () => {
    await draw(eligible());
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(0);
    expect(tree.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('with a comment the scroll and the save sit in ONE avoiding view (the bar stays where it is), and a tap on the save works while the keyboard is up', async () => {
    await draw(eligible({ comment: field({ open: true }) }), true);
    const avoiding = tree.root.findAllByType(KeyboardAvoidingView);
    expect(avoiding).toHaveLength(1);
    expect(avoiding[0].findAllByType('DetailTopBar' as unknown as React.ElementType)).toHaveLength(0);
    expect(tree.root.findAllByType('DetailTopBar' as unknown as React.ElementType)).toHaveLength(1);
    expect(avoiding[0].findAllByType(ScrollView)).toHaveLength(1);
    expect(avoiding[0].findAll(node => node.props?.label === 'Sačuvaj ocenu')).toHaveLength(1);
    expect(tree.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('the view stays the same kind of layout through the states of one visit: the saved receipt and the loading are inside it too', async () => {
    await draw(saved({ comment: 'Odlično.' }), true);
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(1);
    await act(async () => tree.update(<AgreementReviewPresentation backLabel="Nazad na Dogovor" onBack={jest.fn()} view={{ kind: 'loading' }} retry={retry}
      notice={null} person={null} keyboardAware />));
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(1);
  });
});

describe('the comment on the rating screen', () => {
  it('sits after the tags and before the note about a frozen choice, once', async () => {
    await draw(eligible({ attempt: true, comment: field({ open: true, value: 'Sve pohvale.' }) }), true);
    const text = inOrder();
    const at = (value: string) => text.indexOf(value);
    expect(at('Šta je obeležilo saradnju?')).toBeGreaterThan(-1);
    expect(at('Komentar')).toBeGreaterThan(at('Šta je obeležilo saradnju?'));
    expect(at('Čuvamo tvoju ocenu dok proveravaš da li je poslata.')).toBeGreaterThan(at(REVIEW_COMMENT_NOTICE));
    expect(text.filter(value => value === REVIEW_COMMENT_NOTICE)).toHaveLength(1);
  });

  it('closed, it is one row and nothing else: the stars-only rating has no extra sentence and no field', async () => {
    await draw(eligible({ comment: field() }), true);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(inOrder()).not.toContain(REVIEW_COMMENT_NOTICE);
    expect(tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Dodaj komentar')).toHaveLength(1);
  });

  it('has no comment at all when the view has none: nothing is drawn for a build or a backend without comments', async () => {
    await draw(eligible());
    expect(inOrder().some(value => /komentar/i.test(value))).toBe(false);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('keeps ONE primary action: the field adds no button, and the grey save says why in the line above it', async () => {
    await draw(eligible({ save: { label: 'Sačuvaj ocenu', loading: false, disabled: true, reason: 'Skrati komentar.', onPress: jest.fn() },
      comment: field({ open: true, count: 501, invalid: true }) }), true);
    const actions = tree.root.findAll(node => String(node.type) === 'Action');
    expect(actions).toHaveLength(1);
    expect(actions[0].props).toMatchObject({ label: 'Sačuvaj ocenu', disabled: true });
    // The reason is the foot's own line, above the button (template T4), and it takes the place of the sentence about saving.
    expect(tree.root.findByProps({ testID: 'flow-footer-reason' }).props.children).toBe('Skrati komentar.');
    expect(tree.root.findAllByProps({ testID: 'review-save-warning' })).toHaveLength(0);
  });
});

describe('before "Sačuvaj" (idea R29)', () => {
  it('says once, above the button, that a saved rating cannot be changed - and says it only while the button can be pressed', async () => {
    await draw(eligible());
    expect(inOrder().filter(value => value === SAVE_WARNING)).toHaveLength(1);
    expect(SAVE_WARNING).toBe('Ocenu posle čuvanja ne možeš da menjaš.');
    expect(tree.root.findAllByProps({ testID: 'flow-footer-reason' })).toHaveLength(0);
    await act(async () => tree.unmount());
    // Grey with a reason: the reason is what the person needs to read.
    await draw(eligible({ save: { label: 'Sačuvaj ocenu', loading: false, disabled: true, reason: 'Izaberi ocenu.', onPress: jest.fn() } }));
    expect(inOrder()).not.toContain(SAVE_WARNING);
    expect(tree.root.findByProps({ testID: 'flow-footer-reason' }).props.children).toBe('Izaberi ocenu.');
  });

  it('says nothing of it after the rating was saved, when it cannot be saved again', async () => {
    await draw(saved());
    expect(inOrder()).not.toContain(SAVE_WARNING);
  });
});

describe('the saved receipt shows the own comment', () => {
  it('after the tags and before the sentence that the rating is final, as plain text', async () => {
    await draw(saved({ comment: 'Sve je proteklo kako treba.' }), true);
    const text = inOrder();
    expect(text).toContain('Tvoj komentar');
    expect(text.indexOf('Tvoj komentar')).toBeGreaterThan(text.indexOf('Na vreme'));
    expect(text.indexOf('Sve je proteklo kako treba.')).toBeLessThan(text.indexOf('Ocena pomaže drugima da biraju i ne može da se menja.'));
    const node = tree.root.findAll(candidate => String(candidate.type) === 'T' && candidate.children[0] === 'Sve je proteklo kako treba.')[0];
    expect(node.props).toMatchObject({ selectable: false, dataDetectorType: 'none' });
  });

  it.each([[undefined], [null], ['']])('draws no comment line when there is none (%p)', async value => {
    await draw(saved({ comment: value }), true);
    expect(inOrder()).not.toContain('Tvoj komentar');
  });

  it('a long own comment is bounded with an honest control, like everywhere else', async () => {
    await draw(saved({ comment: 'a'.repeat(400) }), true);
    expect(tree.root.findByProps({ accessibilityLabel: 'Prikaži ceo komentar' })).toBeDefined();
  });
});

describe('large text and narrow windows: nothing here has a fixed height or caps the letters', () => {
  it('the field, its notice and its counter wrap and grow with the text size', async () => {
    await draw(eligible({ comment: field({ open: true, count: 480 }) }), true);
    const input = tree.root.findByType(TextInput), style = StyleSheet.flatten(input.props.style);
    expect(style).not.toHaveProperty('height');
    expect(style.minHeight).toBeGreaterThanOrEqual(96);
    expect(style.maxHeight).toBeGreaterThan(style.minHeight as number);
    expect(input.props.maxFontSizeMultiplier).toBeUndefined();
    const lines = tree.root.findAll(node => String(node.type) === 'T' && [REVIEW_COMMENT_NOTICE, 'Još 20 znakova', 'Nije obavezno'].includes(String(node.children[0])));
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const line of lines) {
      expect(line.props.numberOfLines).toBeUndefined();
      expect(line.props.maxFontSizeMultiplier).toBeUndefined();
      expect(StyleSheet.flatten(line.props.style) ?? {}).not.toHaveProperty('height');
    }
  });

  it('the closed row wraps its two words under large text instead of cutting them', async () => {
    await draw(eligible({ comment: field() }), true);
    const row = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Dodaj komentar')[0];
    const style = StyleSheet.flatten(row.props.style);
    expect(style).toMatchObject({ flexWrap: 'wrap' });
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style).not.toHaveProperty('height');
  });
});
