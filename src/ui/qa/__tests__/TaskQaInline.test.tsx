import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import type { OwnerPreselectionQuestion, PublicPreselectionQa } from '../../../contracts/preselectionQa';
import { sys } from '../../system/tokens';
import { TaskQaInline, type TaskQaInlineProps } from '../TaskQaInline';
import { buildQaInline, type TaskQaInlineState } from '../taskQaInlineModel';

/**
 * The questions of a task where the task is read (owner, 2026-10-07: "u pregledu zadatka treba da se vidi pitanja koja je
 * neko postavio, a na koja je odgovorio vlasnik zadatka"). Presentation only: these cases pin what a stranger and the owner
 * SEE, that a failed read never looks like "no questions", that a waiting question has a word and a shape and not a colour
 * alone, and that the section reads and sends nothing itself.
 */
// The first render loads the whole design system behind V2Action and the skeleton; on a machine running other suites that is
// slower than Jest's 5 s, and the cases below are about what is drawn, not how fast.
jest.setTimeout(30_000);
const NOW = new Date('2026-10-07T10:00:00Z'); // 12:00 in Belgrade
const REV = 2;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const waiting = (n: number, patch: Partial<OwnerPreselectionQuestion> = {}): OwnerPreselectionQuestion => ({
  questionId: id(n), needRevision: REV, questionText: `Pitanje ${n}?`, status: 'PENDING_ANSWER', createdAt: '2026-10-04T08:00:00Z',
  answerVersion: null, answerText: null, edited: false, ...patch });
const answeredOwner = (n: number, patch: Partial<OwnerPreselectionQuestion> = {}): OwnerPreselectionQuestion =>
  waiting(n, { status: 'ANSWERED_PUBLIC', answerVersion: 1, answerText: `Odgovor ${n}.`, ...patch });
// A later number is a later answer, so the newest-first order of a stranger's thread is the descending order of the numbers.
const answeredPublic = (n: number, patch: Partial<PublicPreselectionQa> = {}): PublicPreselectionQa => ({
  questionId: id(n), needRevision: REV, questionText: `Pitanje ${n}?`, answerVersion: 1, answerText: `Odgovor ${n}.`, edited: false,
  answeredAt: `2026-10-0${n}T09:00:00Z`, ...patch });
const asStranger = (rows: PublicPreselectionQa[], patch: { canAsk?: boolean } = {}): TaskQaInlineState =>
  ({ phase: 'ready', ...buildQaInline({ mode: 'PUBLIC', needRevision: REV, canAsk: patch.canAsk ?? true, canComposeAnswer: false }, rows) });
const asOwner = (rows: OwnerPreselectionQuestion[], patch: { canComposeAnswer?: boolean } = {}): TaskQaInlineState =>
  ({ phase: 'ready', ...buildQaInline({ mode: 'OWNER', needRevision: REV, canAsk: false, canComposeAnswer: patch.canComposeAnswer ?? true }, rows) });

let tree: ReactTestRenderer;
const handlers = () => ({ onRetry: jest.fn(), onAsk: jest.fn(), onAnswer: jest.fn(), onOpenAll: jest.fn() });
async function render(state: TaskQaInlineState, props: Partial<TaskQaInlineProps> = {}) {
  const on = handlers();
  await act(async () => { tree = create(<TaskQaInline state={state} now={NOW} {...on} {...props} />); });
  return on;
}
afterEach(async () => { await act(async () => tree?.unmount()); });
const T = 'T' as React.ElementType;
const texts = () => tree.root.findAll(node => node.type === T).flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const joined = () => texts().join(' | ');
const presses = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType));
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label);
const chips = () => tree.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.testID === 'task-qa-chip');
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};

describe('before and without anything to show', () => {
  it('draws nothing while there is nothing to read (a draft, a task that is not loaded)', async () => {
    await render({ phase: 'idle' });
    expect(tree.toJSON()).toBeNull();
  });

  it('keeps its title in place while it reads, and says it reads', async () => {
    await render({ phase: 'loading' });
    expect(texts()).toContain('Pitanja i odgovori');
    expect(texts()).toContain('Učitavamo pitanja…');
    // Nothing is claimed about the thread until it is read.
    expect(joined()).not.toMatch(/Još nema pitanja|pitanj[ea] ·|Postavi pitanje/);
    expect(byLabel('Postavi pitanje')).toBeUndefined();
  });

  it('a failed read says so and offers to read again; it is never "Još nema pitanja"', async () => {
    const on = await render({ phase: 'error', message: 'Pitanja trenutno nisu učitana. Proveri vezu i pokušaj ponovo.' });
    expect(texts()).toContain('Pitanja trenutno nisu učitana. Proveri vezu i pokušaj ponovo.');
    expect(joined()).not.toContain('Još nema pitanja');
    const alert = tree.root.findAll(node => node.type === T && node.props.accessibilityRole === 'alert');
    expect(alert).toHaveLength(1);
    await act(async () => byLabel('Učitaj pitanja ponovo')!.props.onPress());
    expect(on.onRetry).toHaveBeenCalledTimes(1);
    expect(on.onAsk).not.toHaveBeenCalled(); expect(on.onOpenAll).not.toHaveBeenCalled();
  });

  it('an empty thread is "Još nema pitanja." and a stranger who may ask can ask', async () => {
    const on = await render(asStranger([]));
    expect(texts()).toContain('Još nema objavljenih odgovora.');
    expect(joined()).not.toMatch(/odgovorena|Prikaži sva pitanja/);
    await act(async () => byLabel('Postavi pitanje')!.props.onPress());
    expect(on.onAsk).toHaveBeenCalledTimes(1);
  });

  it('a stranger who may not ask is not offered to; the rule and its notice stay in the whole thread', async () => {
    await render(asStranger([], { canAsk: false }));
    expect(texts()).toContain('Još nema objavljenih odgovora.');
    expect(byLabel('Postavi pitanje')).toBeUndefined();
    expect(joined()).not.toMatch(/Radni profil/);
  });

  it('questions kept out because the task changed are not "Još nema pitanja"', async () => {
    await render(asStranger([answeredPublic(1, { needRevision: 1 })]));
    expect(texts()).toContain('Zadatak je izmenjen. Ranija pitanja pripadaju starijoj verziji.');
    expect(joined()).not.toContain('Još nema pitanja');
    await act(async () => tree.unmount());
    await render(asStranger([answeredPublic(1), answeredPublic(2, { needRevision: 1 })]));
    expect(texts()).toContain('Neka ranija pitanja pripadaju starijoj verziji zadatka.');
  });
});

describe('what a stranger sees on the task', () => {
  it('the answered questions with the owner\'s answer, who gave it and how long ago, in the thread\'s own order', async () => {
    await render(asStranger([answeredPublic(1, { answeredAt: '2026-10-05T09:00:00Z' }),
      answeredPublic(2, { answeredAt: '2026-10-07T07:00:00Z', edited: true, answerVersion: 2 })]));
    expect(texts()).toContain('2 pitanja · sva odgovorena');
    expect(texts()).toContain('Pitanje 1?'); expect(texts()).toContain('Odgovor 1.');
    expect(texts()).toContain('Odgovor osobe koja je objavila zadatak · pre 2 dana');
    // The newest answer first; an answer that was changed after it was given says so.
    expect(texts()).toContain('Odgovor osobe koja je objavila zadatak · pre 3 sata · izmenjeno');
    expect(joined().indexOf('Pitanje 2?')).toBeLessThan(joined().indexOf('Pitanje 1?'));
    expect(joined().indexOf('Pitanje 2?')).toBeLessThan(joined().indexOf('Odgovor 2.'));
    expect(joined().indexOf('Odgovor 2.')).toBeLessThan(joined().indexOf('Pitanje 1?'));
    // The dot between the parts is for the eye; a screen reader pauses at a comma.
    const line = (text: string) => tree.root.findAll(node => node.type === T && node.props.children === text)[0];
    expect(line('2 pitanja · sva odgovorena').props.accessibilityLabel).toBe('2 pitanja, sva odgovorena');
    expect(line('Odgovor osobe koja je objavila zadatak · pre 3 sata · izmenjeno').props.accessibilityLabel).toBe('Odgovor osobe koja je objavila zadatak, pre 3 sata, izmenjeno');
  });

  it('says "upravo" in lower case in the middle of the line, and gives no age when the moment cannot be read', async () => {
    await render(asStranger([answeredPublic(1, { answeredAt: '2026-10-07T09:58:00Z' }), answeredPublic(2, { answeredAt: 'nije vreme' })]));
    expect(texts()).toContain('Odgovor osobe koja je objavila zadatak · upravo');
    // An unreadable moment is not an age: the line says who answered and nothing more.
    expect(texts()).toContain('Odgovor osobe koja je objavila zadatak');
  });

  it('draws the answer in ink behind the green rule, and no waiting sign and no way to answer', async () => {
    await render(asStranger([answeredPublic(1)]));
    const answer = tree.root.findAll(node => node.type === T && node.props.children === 'Odgovor 1.')[0];
    expect(answer.props.variant).toBeUndefined(); expect(answer.props.tone).toBeUndefined();
    const rule = answer.parent!;
    expect(flat(rule)).toMatchObject({ borderLeftWidth: 3, borderLeftColor: sys.color.green });
    expect(chips()).toHaveLength(0);
    expect(joined()).not.toMatch(/Čeka odgovor|čeka odgovor|čekaju/);
    expect(byLabel('Odgovori')).toBeUndefined();
  });

  it('shows three questions and sends to the rest only when there are more, with their number', async () => {
    const on = await render(asStranger([1, 2, 3].map(n => answeredPublic(n))));
    expect(texts().filter(text => /^Pitanje \d\?$/.test(text))).toHaveLength(3);
    expect(joined()).not.toContain('Prikaži sva pitanja');
    await act(async () => tree.unmount());
    const more = await render(asStranger([1, 2, 3, 4, 5].map(n => answeredPublic(n))));
    expect(texts().filter(text => /^Pitanje \d\?$/.test(text))).toEqual(['Pitanje 5?', 'Pitanje 4?', 'Pitanje 3?']);
    expect(texts()).toContain('5 pitanja · sva odgovorena');
    const link = byLabel('Prikaži sva pitanja (5)')!;
    expect(link).toBeDefined(); expect(texts()).toContain('Prikaži sva pitanja (5)');
    await act(async () => link.props.onPress());
    expect(more.onOpenAll).toHaveBeenCalledTimes(1); expect(on.onOpenAll).not.toHaveBeenCalled();
  });

  it('"Postavi pitanje" is a quiet button, never the green primary, and opens the whole thread to ask', async () => {
    const on = await render(asStranger([answeredPublic(1)]));
    const button = byLabel('Postavi pitanje')!;
    expect(flat(button).backgroundColor).not.toBe(sys.color.green);
    await act(async () => button.props.onPress());
    expect(on.onAsk).toHaveBeenCalledTimes(1);
    // It sits after the questions, not before them.
    expect(joined().indexOf('Pitanje 1?')).toBeLessThan(joined().indexOf('Postavi pitanje'));
  });

  it('no asker is shown, because none is known: the thread is anonymous', async () => {
    await render(asStranger([answeredPublic(1)]));
    const spoken = JSON.stringify(tree.toJSON());
    expect(spoken).not.toMatch(/Anonim|pitao|pitala|korisnik/i);
  });
});

describe('what the owner sees on his own task', () => {
  it('the waiting questions first, each with its word and shape, how long it has waited and the way to answer', async () => {
    const on = await render(asOwner([answeredOwner(1), waiting(2), waiting(3, { createdAt: '2026-10-07T09:58:00Z' })]));
    expect(texts()).toContain('3 pitanja · 1 odgovoreno');
    // Waiting first, the one that has waited longest first; the answered after them.
    const order = ['Pitanje 2?', 'Pitanje 3?', 'Pitanje 1?'].map(text => joined().indexOf(text));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(texts()).toContain('Postavljeno pre 3 dana'); expect(texts()).toContain('Upravo postavljeno');
    expect(chips().filter(chip => chip.props.accessibilityLabel === 'Čeka odgovor')).toHaveLength(2);
    await act(async () => byLabel('Odgovori na pitanje: Pitanje 3?')!.props.onPress());
    expect(on.onAnswer).toHaveBeenCalledTimes(1); expect(on.onAnswer).toHaveBeenCalledWith(id(3));
  });

  it('says how many wait in the section header, and nothing when none does', async () => {
    await render(asOwner([waiting(1), waiting(2), answeredOwner(3)]));
    const header = tree.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.testID === 'task-qa-waiting');
    expect(header).toHaveLength(1);
    expect(header[0].props.accessibilityLabel).toBe('2 čekaju odgovor');
    await act(async () => tree.unmount());
    await render(asOwner([answeredOwner(3)]));
    expect(tree.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.testID === 'task-qa-waiting')).toHaveLength(0);
    expect(texts()).toContain('1 pitanje · odgovoreno');
  });

  it('a waiting question has a word AND a shape, never a colour alone', async () => {
    await render(asOwner([waiting(1)]));
    const [chip] = chips();
    expect(chip.props.accessible).toBe(true); expect(chip.props.accessibilityLabel).toBe('Čeka odgovor');
    // The word is drawn in the label type, not under 12, in the ink made for the waiting ground.
    const word = chip.findAll(node => node.type === T)[0];
    expect(word.props.children).toBe('Čeka odgovor'); expect(word.props.variant).toBe('label');
    expect(sys.type.label.fontSize).toBeGreaterThanOrEqual(12);
    expect(flat(word).color).toBe(sys.color.waitingInk); expect(flat(chip).backgroundColor).toBe(sys.color.orangeSoft);
    // The shape: an open ring, not read aloud.
    const ring = chip.findAll(node => node.type === ('View' as React.ElementType) && flat(node).borderWidth !== undefined)[0];
    expect(flat(ring)).toMatchObject({ width: 10, height: 10, borderRadius: 5, borderColor: sys.color.orangeInk });
    expect(ring.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('the answered ones read as the owner\'s own answer, with the edit mark, and no age that the read does not carry', async () => {
    await render(asOwner([answeredOwner(1), answeredOwner(2, { edited: true, answerVersion: 2, createdAt: '2026-10-05T08:00:00Z' })]));
    expect(texts()).toContain('Tvoj odgovor'); expect(texts()).toContain('Tvoj odgovor · izmenjeno');
    expect(joined()).not.toContain('Odgovor osobe koja je objavila zadatak'); expect(joined()).not.toMatch(/pre \d+ dana/);
    expect(chips()).toHaveLength(0);
    expect(byLabel('Odgovori na pitanje: Pitanje 1?')).toBeUndefined();
  });

  it('offers no answer when the server does not allow answering, and still says the question waits', async () => {
    await render(asOwner([waiting(1)], { canComposeAnswer: false }));
    expect(chips()).toHaveLength(1); expect(joined()).not.toContain('Odgovori');
  });

  it('never offers the owner to ask a question on his own task', async () => {
    await render(asOwner([]));
    expect(texts()).toContain('Još nema pitanja.'); expect(byLabel('Postavi pitanje')).toBeUndefined();
  });

  it('sends to the whole thread when more than three are listed, or when earlier versions are kept out', async () => {
    const on = await render(asOwner([1, 2, 3, 4].map(n => waiting(n))));
    expect(texts().filter(text => /^Pitanje \d\?$/.test(text))).toHaveLength(3);
    await act(async () => byLabel('Prikaži sva pitanja (4)')!.props.onPress());
    expect(on.onOpenAll).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    await render(asOwner([waiting(1), waiting(2, { needRevision: 1 })]));
    expect(byLabel('Prikaži sva pitanja (2)')).toBeDefined();
    expect(texts()).toContain('Neka ranija pitanja pripadaju starijoj verziji zadatka.');
  });
});

describe('the section never acts for the screen', () => {
  it('while the screen is busy no button of the section can be pressed', async () => {
    await render(asOwner([1, 2, 3, 4].map(n => waiting(n))), { disabled: true });
    for (const label of ['Odgovori na pitanje: Pitanje 1?', 'Prikaži sva pitanja (4)']) {
      expect([label, byLabel(label)!.props.disabled]).toEqual([label, true]);
    }
    await act(async () => tree.unmount());
    await render(asStranger([answeredPublic(1)]), { disabled: true });
    expect(byLabel('Postavi pitanje')!.props.disabled).toBe(true);
    await act(async () => tree.unmount());
    await render({ phase: 'error', message: 'x' }, { disabled: true });
    expect(byLabel('Učitaj pitanja ponovo')!.props.disabled).toBe(true);
  });

  it('a long question is named briefly to a screen reader and in full on screen', async () => {
    const long = `${'Da li ima lift u zgradi i može li se ormar prenositi kroz hodnik? '.repeat(3)}`.trim();
    await render(asOwner([waiting(1, { questionText: long })]));
    expect(texts()).toContain(long);
    const label = presses().map(node => node.props.accessibilityLabel).find(value => String(value).startsWith('Odgovori na pitanje: '))!;
    expect(label.startsWith('Odgovori na pitanje: Da li ima lift')).toBe(true);
    expect(Array.from(label).length).toBeLessThan(110); expect(label.endsWith('…')).toBe(true);
  });
});

// UI/UX pass 2026-10-08 (the one divider): the questions of a thread are one list parted by a line of 1 dp between them, not a hairline above each.
describe('the questions are parted by the one line of the system', () => {
  const rules = () => tree.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.testID === 'task-qa-rule');

  it('puts a line of 1 dp between two questions, none above the first and none under the last', async () => {
    await render(asStranger([answeredPublic(3), answeredPublic(2), answeredPublic(1)]));
    expect(rules()).toHaveLength(2);
    for (const rule of rules()) expect(flat(rule)).toEqual({ height: 1, backgroundColor: sys.color.line });
    const rows = tree.root.findAll(node => node.type === ('View' as React.ElementType) && flat(node).paddingVertical === sys.space.md);
    expect(rows).toHaveLength(3);
    for (const row of rows) { expect(flat(row).borderTopWidth).toBeUndefined(); expect(flat(row).borderTopColor).toBeUndefined(); }
  });

  it('draws no line for one question, and the answer stays behind the green rule of the whole thread', async () => {
    await render(asStranger([answeredPublic(1)]));
    expect(rules()).toHaveLength(0);
    const answer = tree.root.findAll(node => node.type === ('View' as React.ElementType) && flat(node).borderLeftWidth === 3)[0];
    expect(flat(answer).borderLeftColor).toBe(sys.color.green);
  });

  it('says who answered without a gender: the person who published the task', async () => {
    await render(asStranger([answeredPublic(1)]));
    expect(joined()).toContain('Odgovor osobe koja je objavila zadatak'); expect(joined()).not.toContain('Odgovorio');
  });
});


it('one answered question still offers its owner a direct edit, without exposing it to a stranger',async()=>{
 const on=await render(asOwner([answeredOwner(1)]));
 await act(async()=>byLabel('Izmeni odgovor na pitanje: Pitanje 1?')!.props.onPress());
 expect(on.onAnswer).toHaveBeenCalledWith(id(1));expect(on.onOpenAll).not.toHaveBeenCalled();
 await act(async()=>tree.unmount());await render(asStranger([answeredPublic(1)]));
 expect(byLabel('Izmeni odgovor na pitanje: Pitanje 1?')).toBeUndefined();
});
