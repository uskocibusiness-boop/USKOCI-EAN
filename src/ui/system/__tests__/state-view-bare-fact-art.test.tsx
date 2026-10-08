import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Twenty suites of other screens stand in for FactArt with a bare component, `jest.mock('.../system/FactArt', () => ({ FactArt: 'FactArt' }))`,
// and a state has to draw under that stand-in: it must not read anything of FactArt but the picture itself. (A first version read
// `FACT_TICK_KINDS` and broke three suites of the Moji zadaci and Moje prijave galleries: this holds that it stays independent.)
jest.mock('../FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../motion', () => ({ useReducedMotion: () => false }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

import { StateView } from '../StateView';

let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const pictures = () => tree.root.findAll(node => node.type === ('FactArt' as unknown)).map(node => node.props);

describe('a state draws under a FactArt that is only a name', () => {
  it.each(['error', 'offline', 'uncertain'] as const)('%s: a failure that names a picture with a tick falls back to the quiet sign, and one that names another keeps it', async kind => {
    await render(<StateView kind={kind} art="agreements" title="Nije uspelo" />);
    expect(pictures()).toEqual([expect.objectContaining({ kind: 'info', size: 96, muted: true })]);
    await act(async () => tree.update(<StateView kind={kind} art="chat" title="Nije uspelo" />));
    expect(pictures()).toEqual([expect.objectContaining({ kind: 'chat', muted: true })]);
  });

  it('an empty list and a loading state draw as they do with the real art', async () => {
    await render(<StateView art="agreements" title="Još nemaš Dogovor" />);
    expect(pictures()).toEqual([expect.objectContaining({ kind: 'agreements', size: 96, muted: false })]);
    await act(async () => tree.update(<StateView kind="loading" title="Učitavamo…" skeleton={{ variant: 'task' }} />));
    expect(pictures()).toEqual([]);
  });

  it('reads nothing of FactArt but the picture: its source imports no other name from it', () => {
    const source = readFileSync(join(__dirname, '../StateView.tsx'), 'utf8');
    const imports = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/FactArt'/g)].flatMap(match => match[1].split(',').map(name => name.trim()))
      .filter(name => name && !name.startsWith('type '));
    expect(imports).toEqual(['FactArt']);
  });
});
