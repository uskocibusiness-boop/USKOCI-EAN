import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('../motion', () => ({ useReducedMotion: () => false }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

import { T } from '../../Text';
import { FACT_TICK_KINDS } from '../FactArt';
import { StateView } from '../StateView';
import { Arrive } from '../Arrive';
import { SkeletonCard, SkeletonList } from '../Skeleton';
import { V2Action } from '../../v2/V2Action';
import { brandAction, cardCompact, sys } from '../tokens';

/**
 * Empty, loading, error, offline and unknown outcome in one look (master design plan 2026-09-24; composition spec T7 and UI/UX pass
 * 2026-10-08, F8b): a centred column with the picture at 96, one title, one sentence and at most one green action and one quiet one, a
 * third of the way down, or, while reading, the placeholders and one sentence.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children).filter(child => typeof child === 'string');
/** FactArt is memoised, so its drawing is found by what it was asked to draw. */
const pictures = () => tree.root.findAll(node => typeof node.type !== 'string' && typeof node.props.kind === 'string' && typeof node.props.size === 'number');
const art = () => pictures()[0];
const role = (value: string) => tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === value);
const actions = () => tree.root.findAllByType(V2Action);
const host = (node: ReactTestInstance) => typeof node.type === 'string';
/** How many: an assertion on a list of instances that fails prints every instance with its whole tree, so a count is compared and never the list. */
const size = (nodes: readonly unknown[]) => nodes.length;
/** The first host element above a node (the test renderer also lists the components that draw a host, and they carry the same style). */
const hostAbove = (node: ReactTestInstance) => { let up = node.parent!; while (!host(up)) up = up.parent!; return up; };
/** The frame of the block: the first host above the picture that fills the room it is given. */
const frame = () => {
  let node = art().parent!;
  while (!(host(node) && flat(node).flexGrow === 1)) node = node.parent!;
  return node;
};
const column = () => {
  let node = art().parent!;
  while (!(host(node) && flat(node).maxWidth !== undefined)) node = node.parent!;
  return node;
};

it('says an empty list with its picture, a heading, one sentence and the one way forward', async () => {
  const makeTask = jest.fn(), all = jest.fn();
  await render(<StateView art="tasks" title="Nema aktivnih zadataka" body="Nacrti i završeni zadaci su u svojim prikazima."
    primary={{ label: 'Objavi novi zadatak', onPress: makeTask }} quiet={{ label: 'Prikaži sve moje zadatke', onPress: all }} />);
  expect(art().props).toMatchObject({ kind: 'tasks', size: 96, muted: false });
  expect(texts()).toEqual(['Nema aktivnih zadataka', 'Nacrti i završeni zadaci su u svojim prikazima.', 'Objavi novi zadatak', 'Prikaži sve moje zadatke']);
  expect(role('header').map(node => node.props.children)).toEqual(['Nema aktivnih zadataka']);
  const [primary, quiet] = actions();
  expect(StyleSheet.flatten(primary.props.style)).toMatchObject({ backgroundColor: brandAction.backgroundColor });
  expect(quiet.props.kind).toBe('quiet');
  await act(async () => primary.props.onPress()); await act(async () => quiet.props.onPress());
  expect(makeTask).toHaveBeenCalledTimes(1); expect(all).toHaveBeenCalledTimes(1);
});

// Composition spec T7: "centrirana kolona: art 96, title 21, copy muted ≤ 280 širine, ≤ 1 zelena + ≤ 1 tiha, na ≈ 1/3 visine". The picture is the
// picture, on white: no well around it (the owner rejected pale panels), and every line is centred.
describe('the look of T7', () => {
  const full = <StateView kind="error" title="Podatke za prijavu trenutno nije moguće učitati." body="Proveri vezu."
    primary={{ label: 'Pokušaj ponovo', onPress: () => {} }} quiet={{ label: 'Nazad', onPress: () => {} }} />;

  it('is one centred column, no wider than 280, with the title in the title type and the sentence in the copy type, both centred', async () => {
    await render(full);
    expect(flat(column())).toMatchObject({ alignItems: 'center', maxWidth: 280, width: '100%' });
    const [title, copy] = tree.root.findAllByType(T);
    expect([title.props.variant, copy.props.variant, copy.props.tone]).toEqual(['title', 'copy', 'muted']);
    for (const words of [title, copy]) expect(flat(words)).toMatchObject({ textAlign: 'center' });
    expect(sys.type.title.fontSize).toBe(21);
  });

  it('draws the picture at 96 with nothing around it: no well, no panel, no card', async () => {
    await render(full);
    expect(art().props.size).toBe(96);
    let node = art().parent!;
    while (!(host(node) && flat(node).marginBottom !== undefined)) node = node.parent!;
    expect(flat(node).backgroundColor).toBeUndefined();
    expect(flat(node).width).toBeUndefined();
    expect(flat(node).borderWidth).toBeUndefined();
  });

  it('lies a third of the way down: a fifth of the free room above the block and four fifths below, and never closer than 48 to what is above', async () => {
    await render(full);
    expect(flat(frame())).toMatchObject({ flexGrow: 1, alignItems: 'center', paddingTop: sys.space.huge });
    const [above, block, below] = frame().children as ReactTestInstance[];
    expect([flat(above).flex, flat(below).flex]).toEqual([1, 4]);
    expect(flat(block).maxWidth).toBe(280);
  });

  it('puts its actions in the column, as wide as the column, the green one in the footer\'s own shape and the quiet one under it', async () => {
    await render(full);
    let node = actions()[0].parent!;
    while (!(host(node) && flat(node).alignSelf === 'stretch')) node = node.parent!;
    expect(flat(node)).toMatchObject({ alignSelf: 'stretch', marginTop: sys.space.xl, gap: sys.space.sm });
    expect(flat(hostAbove(node)).maxWidth).toBe(280);
    const [primary, quiet] = actions();
    expect(StyleSheet.flatten(primary.props.style)).toMatchObject({ backgroundColor: brandAction.backgroundColor, minHeight: brandAction.minHeight });
    for (const action of [primary, quiet]) expect(StyleSheet.flatten(action.props.style)?.alignSelf).toBeUndefined();
  });

  it('keeps the steps of the grid between its parts: 16 after the picture, 8 after the title, 24 before the actions', async () => {
    await render(full);
    let picture = art().parent!;
    while (!(host(picture) && flat(picture).marginBottom !== undefined)) picture = picture.parent!;
    expect(flat(picture).marginBottom).toBe(sys.space.base);
    expect(flat(tree.root.findAllByType(T)[1]).marginTop).toBe(sys.space.sm);
  });

  it('draws no action when the screen offers none, and no sentence when it has none', async () => {
    await render(<StateView art="agreements" title="Još nemaš Dogovor" />);
    expect(size(actions())).toBe(0);
    expect(texts()).toEqual(['Još nemaš Dogovor']);
  });
});

describe('what each kind says and draws', () => {
  it('an empty list\'s picture settles in once; a failure\'s does not', async () => {
    await render(<StateView art="tasks" title="Još nemaš zadatak" />);
    expect(size(tree.root.findAllByType(Arrive))).toBe(1);
    for (const kind of ['error', 'offline', 'uncertain'] as const) {
      await act(async () => tree.update(<StateView kind={kind} title="Nije uspelo" />));
      expect([kind, tree.root.findAllByType(Arrive).length]).toEqual([kind, 0]);
    }
  });

  it('an empty conversation list draws the conversation picture at the same 96', async () => {
    await render(<StateView art="chat" title="Još nema razgovora" />);
    expect(size(pictures())).toBe(0);
    expect(size(tree.root.findAll(node => typeof node.type !== 'string' && node.props.size === 96))).toBeGreaterThan(0);
  });

  it('announces a read that failed as an alert, with the picture gone grey', async () => {
    const retry = jest.fn();
    await render(<StateView kind="error" art="tasks" title="Dogovore trenutno nije moguće učitati" body="Proveri vezu."
      primary={{ label: 'Pokušaj ponovo', onPress: retry }} />);
    expect(art().props).toMatchObject({ kind: 'tasks', muted: true, size: 96 });
    expect(role('alert').map(node => node.props.children)).toEqual(['Dogovore trenutno nije moguće učitati']);
    expect(size(role('header'))).toBe(0);
    expect(actions().map(action => action.props.label)).toEqual(['Pokušaj ponovo']);
  });

  it('never draws a failure with a picture that says "confirmed": a tick (agreements, check, shield) falls back to the quiet sign, an empty list keeps its own', async () => {
    for (const kind of ['error', 'offline', 'uncertain'] as const) for (const ticked of ['agreements', 'check', 'shield'] as const) {
      await act(async () => tree?.unmount());
      await render(<StateView kind={kind} art={ticked} title="Nije uspelo" />);
      expect([kind, ticked, art().props.kind]).toEqual([kind, ticked, 'info']);
    }
    await act(async () => tree.unmount());
    await render(<StateView kind="error" art="chat" title="Nije uspelo" />);
    expect(art().props.kind).toBe('chat');
    await act(async () => tree.update(<StateView art="agreements" title="Još nemaš Dogovor" />));
    expect(art().props.kind).toBe('agreements');
  });

  it('asks the platform for balanced lines, so a centred title is not a long line and a lonely word', async () => {
    await render(<StateView kind="error" title="Nema zadataka u ovom prikazu" body="Promeni pretragu ili filtere." />);
    const [title, copy] = tree.root.findAllByType(Text);
    expect([title.props.textBreakStrategy, copy.props.textBreakStrategy]).toEqual(['balanced', 'balanced']);
  });

  it('says "no connection" the same way, with its own quiet picture when the screen names none', async () => {
    await render(<StateView kind="offline" title="Nema internet veze" body="Uključi Wi-Fi ili mobilne podatke." />);
    expect(art().props).toMatchObject({ kind: 'info', muted: true });
    expect(size(role('alert'))).toBe(1);
  });

  it('says "we do not know whether it arrived" as an alert as well, grey, with the one button that finds out', async () => {
    const check = jest.fn();
    await render(<StateView kind="uncertain" art="send" title="Ne znamo da li je prijava stigla" body="Odgovor nije stigao, pa ne znamo šta je sačuvano."
      primary={{ label: 'Proveri', onPress: check }} />);
    expect(art().props).toMatchObject({ kind: 'send', muted: true });
    expect(role('alert').map(node => node.props.children)).toEqual(['Ne znamo da li je prijava stigla']);
    await act(async () => actions()[0].props.onPress());
    expect(check).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<StateView kind="uncertain" title="Ne znamo da li je uspelo" />));
    expect(art().props).toMatchObject({ kind: 'info', muted: true });
  });
});

// The pictures that say "confirmed" are FactArt's list, and StateView spells them out instead of importing them (the bare stand-ins of other suites
// have no such export): this is what keeps the two from drifting.
it('spells the pictures that say "confirmed" as FactArt does: the list here is the list there', () => {
  const source = readFileSync(join(__dirname, '../StateView.tsx'), 'utf8');
  const listed = /SAYS_CONFIRMED[^=]*=\s*\[([^\]]*)\]/.exec(source)![1].split(',').map(part => part.trim().replace(/'/g, ''));
  expect([...listed].sort()).toEqual([...FACT_TICK_KINDS].sort());
});

// Review r4 item 3: a retry the screen is already running greys out instead of looking pressable. F8b: or, when the screen would rather keep the
// button's colour and say it is at work, it spins inside the button (the one place a spinner lives) and cannot be pressed twice.

describe('an action the screen is already at work on', () => {
  it('greys out with `disabled`, and leaves the other one alone', async () => {
    await render(<StateView kind="error" title="Prijave trenutno nisu dostupne" primary={{ label: 'Pokušaj ponovo', onPress: () => {}, disabled: true }}
      quiet={{ label: 'Nazad', onPress: () => {} }} />);
    const [retry, back] = actions();
    expect(retry.props.disabled).toBe(true);
    expect(back.props.disabled).toBeFalsy();
    expect(retry.props.loading).toBeFalsy();
  });

  it('keeps its colour and shows its spinner with `busy`, as the V2Action does while a write is in flight', async () => {
    await render(<StateView kind="uncertain" title="Ne znamo da li je uspelo" primary={{ label: 'Proveri', onPress: () => {}, busy: true }} />);
    expect(actions()[0].props.loading).toBe(true);
    expect(StyleSheet.flatten(actions()[0].props.style)).toMatchObject({ backgroundColor: brandAction.backgroundColor });
  });
});

describe('inside a section or a sheet', () => {
  it('draws the same state smaller: the picture at 48, the title in heading and the sentence in note, 16 over and under, and no lift', async () => {
    await render(<StateView compact art="chat" kind="error" title="Pitanja nisu učitana" body="Proveri vezu." primary={{ label: 'Pokušaj ponovo', onPress: () => {} }} />);
    expect(size(pictures())).toBe(1);
    const [title, copy] = tree.root.findAllByType(T);
    expect([title.props.variant, copy.props.variant]).toEqual(['heading', 'note']);
    let node = tree.root.findAll(host)[0];
    expect(flat(node)).toMatchObject({ flexGrow: 1, paddingVertical: sys.space.base });
    expect(size(node.children)).toBe(1);
  });

  it('keeps the picture of the kind at 48', async () => {
    await render(<StateView compact kind="error" art="tasks" title="Dogovor nije učitan" />);
    expect(art().props).toMatchObject({ kind: 'tasks', size: 48, muted: true });
  });
});

describe('while reading', () => {
  it('shows the placeholders in the shape of what is coming and one quiet sentence, and nothing to press', async () => {
    await render(<StateView kind="loading" title="Učitavamo Dogovore…" skeleton={{ count: 2, rows: 2 }} primary={{ label: 'Ne', onPress: () => {} }} />);
    expect(tree.root.findByType(SkeletonList).props).toMatchObject({ count: 2, rows: 2 });
    expect(texts()).toEqual(['Učitavamo Dogovore…']);
    expect(tree.root.findAllByType(T)[0].props.variant).toBe('note');
    expect(size(actions())).toBe(0);
    expect(size(pictures())).toBe(0);
  });

  it('never puts a spinner over the screen: the wait is the placeholders, and a spinner lives only inside a button', async () => {
    await render(<StateView kind="loading" title="Učitavamo Dogovore…" skeleton={{ variant: 'row' }} />);
    expect(size(tree.root.findAllByType(ActivityIndicator))).toBe(0);
    await act(async () => tree.update(<StateView kind="uncertain" title="Ne znamo da li je uspelo" primary={{ label: 'Proveri', onPress: () => {}, busy: true }} />));
    // The one spinner there is stands in the button that is at work.
    expect(size(actions()[0].findAllByType(ActivityIndicator))).toBe(1);
    expect(size(tree.root.findAllByType(ActivityIndicator))).toBe(1);
  });

  it('is announced politely, once, by the one sentence', async () => {
    await render(<StateView kind="loading" title="Učitavamo Dogovore…" />);
    expect(size(tree.root.findAll(node => host(node) && node.props.accessibilityLiveRegion === 'polite'))).toBe(1);
  });

  it('waits in rows, records or facts when the screen says which: three of them by default, in the system\'s own shapes', async () => {
    await render(<StateView kind="loading" title="Učitavamo obaveštenja…" skeleton={{ variant: 'row', count: 5, face: true, heading: true }} />);
    expect(tree.root.findByType(SkeletonList).props).toMatchObject({ count: 5, variant: 'row', face: true, heading: true });
    await act(async () => tree.update(<StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'record', foot: true }} />));
    expect(tree.root.findByType(SkeletonList).props).toMatchObject({ count: 3, variant: 'record', foot: true });
    await act(async () => tree.update(<StateView kind="loading" title="Učitavamo podešavanja…" skeleton={{ variant: 'row', switches: true }} />));
    expect(tree.root.findByType(SkeletonList).props).toMatchObject({ variant: 'row', switches: true });
  });
});

// Verifier r3b vc, nit 4: only a task list waits in the task card's shape, with the person's picture in its foot (40 since the task card is a
// `Surface record` with its own face: F8b). Every other card (a Prijava, a Dogovor, a detail, legal documents, the export) waits in the plain
// shape, with no person.
it('waits in the task card\'s shape only where a task list says so; every other card waits plain, with no person', async () => {
  const avatars = () => tree.root.findAll(node => typeof node.type === 'string' && flat(node).width === 40 && flat(node).height === 40);
  await render(<SkeletonCard />);
  expect(size(avatars())).toBe(0);
  await act(async () => tree.update(<SkeletonCard variant="task" />));
  expect(size(avatars())).toBe(1);
  await act(async () => tree.update(<StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'task' }} />));
  expect(tree.root.findByType(SkeletonList).props).toMatchObject({ count: 3, variant: 'task' });
  expect(size(avatars())).toBe(3);
  await act(async () => tree.update(<StateView kind="loading" title="Učitavamo Dogovore…" skeleton={{ count: 2, rows: 2 }} />));
  expect(size(avatars())).toBe(0);
});

// Round 6 on the emulator (b4531ef4): the Q&A thread, the Izmene terms, the composer's task face and the rating screen
// all waited in a card with a person that never arrived. Each flat screen now waits in its own flat shape, and only the
// publish preview keeps a card, without the foot.
describe('the placeholders of the flat screens', () => {
  const frames = () => tree.root.findAll(node => host(node) && flat(node).borderWidth === 1 && flat(node).borderColor === cardCompact.borderColor);
  const avatars = () => tree.root.findAll(node => host(node) && flat(node).width === 32 && flat(node).height === 32);
  const blocks = (size: number) => tree.root.findAll(node => host(node) && flat(node).width === size && flat(node).height === size);

  it.each(['face', 'thread', 'facts', 'person'] as const)('%s draws no card frame and no list person', async variant => {
    await render(<SkeletonCard variant={variant} rows={3} />);
    expect(size(frames())).toBe(0);
    expect(size(avatars())).toBe(0);
  });

  it('the preview keeps the compact card with the head and its facts, and nothing under them', async () => {
    await render(<SkeletonCard variant="preview" rows={3} />);
    expect(size(frames())).toBe(1);
    expect(size(blocks(16))).toBe(3);
    expect(size(avatars())).toBe(0);
  });

  it('the face is the same head and facts, bare, over the composer\'s hairline', async () => {
    await render(<SkeletonCard variant="face" rows={3} />);
    const root = tree.root.findAll(host)[0];
    expect(flat(root)).toMatchObject({ borderBottomWidth: 1, paddingBottom: 20 });
    expect(size(blocks(16))).toBe(3);
  });

  it('a thread item is the question, the answer behind its rule, and a hairline above; the list adds no gap of its own', async () => {
    await render(<SkeletonList count={3} variant="thread" />);
    const items = tree.root.findAll(node => host(node) && flat(node).borderTopWidth === StyleSheet.hairlineWidth);
    expect(size(items)).toBe(3);
    const rules = tree.root.findAll(node => host(node) && flat(node).borderLeftWidth === 3);
    expect(size(rules)).toBe(3);
    expect(flat(tree.root.findAll(host)[0]).gap).toBeUndefined();
  });

  it('the facts are 24 px drawings beside a label and a value, one row per fact', async () => {
    await render(<SkeletonCard variant="facts" rows={3} />);
    expect(size(blocks(24))).toBe(3);
  });

  it('the person is a 56 px face, five star blanks and the tag pills', async () => {
    await render(<SkeletonCard variant="person" />);
    expect(size(blocks(56))).toBe(1);
    expect(size(blocks(40))).toBe(5);
    expect(size(tree.root.findAll(node => host(node) && flat(node).height === 48 && flat(node).borderRadius === sys.radius.pill))).toBe(4);
  });

  it('the state view forwards the variant to the list', async () => {
    await render(<StateView kind="loading" title="Učitavamo pitanja…" skeleton={{ count: 3, variant: 'thread' }} />);
    expect(tree.root.findByType(SkeletonList).props).toMatchObject({ count: 3, variant: 'thread' });
    expect(size(frames())).toBe(0);
  });
});

// "Predmet vrata" (the owner's pick of 2026-10-08, B6): the FIRST encounter of an empty screen is a hero. Its picture stands at 144, the size of a door of
// Početna, and is the same object as the door or the row that fulfils the state, so an empty screen is a promise of its action.
describe('the first encounter: a hero', () => {
  const first = { title: 'Još nemaš zadatak', body: 'Reci šta ti treba. Nacrt pregledaš pre objave.',
    primary: { label: 'Objavi prvi zadatak', onPress: () => {} }, quiet: { label: 'Pogledaj zadatke', onPress: () => {} } };

  it('draws the picture of an empty screen at 144 and everything else as it was: the same column, the same words, the one green action and the one quiet one', async () => {
    await render(<StateView hero art="publish" {...first} />);
    expect(art().props).toMatchObject({ kind: 'publish', size: 144, muted: false });
    expect(size(tree.root.findAllByType(Arrive))).toBe(1);
    expect(flat(column())).toMatchObject({ alignItems: 'center', maxWidth: 280, width: '100%' });
    expect(texts()).toEqual(['Još nemaš zadatak', 'Reci šta ti treba. Nacrt pregledaš pre objave.', 'Objavi prvi zadatak', 'Pogledaj zadatke']);
    expect(role('header').map(node => node.props.children)).toEqual(['Još nemaš zadatak']);
    expect(actions().map(action => action.props.kind)).toEqual([undefined, 'quiet']);
    let picture = art().parent!;
    while (!(host(picture) && flat(picture).marginBottom !== undefined)) picture = picture.parent!;
    expect(flat(picture).marginBottom).toBe(sys.space.base);
  });

  it('is the same state without it: an empty list that is not a hero keeps its 96', async () => {
    await render(<StateView art="publish" {...first} />);
    expect(art().props.size).toBe(96);
    await act(async () => tree.update(<StateView hero={false} art="publish" {...first} />));
    expect(art().props.size).toBe(96);
  });

  it('is only for an empty screen: a failure, a lost connection and an unknown outcome stay grey and still at 96, and a state inside a section stays at 48', async () => {
    for (const kind of ['error', 'offline', 'uncertain'] as const) {
      await act(async () => tree?.unmount());
      await render(<StateView hero kind={kind} art="tasks" title="Nije uspelo" body="Proveri vezu." primary={{ label: 'Pokušaj ponovo', onPress: () => {} }} />);
      expect([kind, art().props.size, art().props.muted, size(tree.root.findAllByType(Arrive))]).toEqual([kind, 96, true, 0]);
    }
    await act(async () => tree.unmount());
    await render(<StateView hero compact art="tasks" title="Nema aktivnih zadataka" />);
    expect(art().props.size).toBe(48);
  });

  it('draws the two panels of a conversation at 144 as well', async () => {
    await render(<StateView hero art="chat" title="Još nema razgovora" />);
    expect(size(pictures())).toBe(0);
    expect(size(tree.root.findAll(node => typeof node.type !== 'string' && node.props.size === 144))).toBeGreaterThan(0);
    expect(size(tree.root.findAll(node => typeof node.type !== 'string' && node.props.size === 96))).toBe(0);
  });

  it('is written where a person building a screen looks: the header names it, and says it is for the first time only', () => {
    const header = readFileSync(join(__dirname, '../StateView.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(header).toMatch(/`hero`/); expect(header).toMatch(/144/); expect(header).toMatch(/cause: 'first'/);
  });
});
