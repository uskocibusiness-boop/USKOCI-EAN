import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { BuildIdentity } from '../../../data/buildIdentity';

/**
 * "Prijavi grešku u aplikaciji" (R23, UI/UX pass 2026-10-08): the new-request screen of support, started with the title and the line that
 * names the build the report is about, so whoever tests the app does not look the version up and type it. Nothing about the person, their
 * account or their device goes in; the request cannot be sent until the person has written under the words they were given.
 */
const mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { uskociBuild: { schemaVersion: 1, version: '2.3.4',
  sourceCommit: '0123456789abcdef0123456789abcdef01234567', sourceDirty: true, backendTarget: 'canonical', runtimeVersion: '2.3.4', updateChannel: 'preview' } } } } }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../SupportNewScreen', () => ({ SupportNewScreen: 'SupportNew' }));
import PrijavaGreske from '../../../app/(app)/profil/prijava-greske';
import { bugReportPreset, buildLine } from '../bugReportPreset';

const build = (patch: Partial<BuildIdentity> = {}): BuildIdentity => ({ version: '1.4.2', sourceCommit: 'abcdef0123456789abcdef0123456789abcdef01', sourceDirty: false,
  backendTarget: 'canonical', runtimeVersion: '1.4.2', updateChannel: 'preview', ...patch });

describe('the line that names the build', () => {
  it('says the version and the first seven letters of the source it was built from', () => {
    expect(buildLine(build())).toBe('Verzija aplikacije: 1.4.2 (abcdef0)');
  });

  it('leaves out the source when it is not known, and says the version is not recorded when it is not', () => {
    expect(buildLine(build({ sourceCommit: null }))).toBe('Verzija aplikacije: 1.4.2');
    expect(buildLine(build({ version: null, sourceCommit: null }))).toBe('Verzija aplikacije: nije zabeležena');
  });
});

describe('the preset', () => {
  it('is a title and the first words of the description, ending where the person starts to write', () => {
    expect(bugReportPreset(build())).toEqual({ title: 'Greška u aplikaciji', body: 'Verzija aplikacije: 1.4.2 (abcdef0)\n\nŠta se desilo:\n' });
  });

  it('carries only the app\'s public version and the short name of its source: nothing about the person, the account, the device or the server', () => {
    const { title, body } = bugReportPreset(build({ backendTarget: 'local', runtimeVersion: 'secret-runtime', updateChannel: 'production', sourceDirty: true }));
    const everything = `${title}\n${body}`;
    expect(everything).not.toMatch(/local|canonical|secret-runtime|production|preview|dirty|email|@|telefon|uređaj|nalog|account/i);
    expect(everything.split('\n').filter(Boolean)).toEqual(['Greška u aplikaciji', 'Verzija aplikacije: 1.4.2 (abcdef0)', 'Šta se desilo:']);
  });

  it('reads the build of this app by itself when it is not handed one', () => {
    expect(bugReportPreset()).toEqual({ title: 'Greška u aplikaciji', body: 'Verzija aplikacije: 2.3.4 (0123456)\n\nŠta se desilo:\n' });
  });
});

describe('the route', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => { await act(async () => tree?.unmount()); });

  it('opens the new-request screen with the preset and no reference', async () => {
    await act(async () => { tree = create(<PrijavaGreske />); });
    const screen = tree.root.findByType('SupportNew' as React.ElementType);
    expect(screen.props.reference).toBeNull();
    expect(screen.props.preset).toEqual({ title: 'Greška u aplikaciji', body: 'Verzija aplikacije: 2.3.4 (0123456)\n\nŠta se desilo:\n' });
  });

  it('builds the preset once, not at every render', async () => {
    await act(async () => { tree = create(<PrijavaGreske />); });
    const first = tree.root.findByType('SupportNew' as React.ElementType).props.preset;
    await act(async () => tree.update(<PrijavaGreske />));
    expect(tree.root.findByType('SupportNew' as React.ElementType).props.preset).toBe(first);
  });
});
