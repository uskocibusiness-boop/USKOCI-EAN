import { readFileSync } from 'node:fs';

// Public discovery is the Zadaci tab since 2026-09-23 (prilike.tsx only redirects there).
const source = readFileSync(require.resolve('../../app/(app)/zadaci.tsx'), 'utf8');

/**
 * Owner decision 1 (2026-09-19) supersedes owner decision 2 of 2026-09-16 here. That decision said
 * "+" and "Moji" must never switch MENI TREBA ↔ JA MOGU silently, so a worker was asked first. There
 * is no mode left to switch: looking for work, opening my own tasks and publishing a new one are
 * three things one account does, and each simply goes where it says. Since the owner's information architecture of
 * 2026-09-23 my own tasks are the "Moji zadaci" door on Početna; discovery wires no switch to them any more (the
 * callback was never drawn).
 */
test('public discovery opens a new task directly, for every account, with no mode to read, ask about or set', () => {
  expect(source).toContain("import { izvorSada, useIzvor } from '../../store/uloga';");
  expect(source).not.toContain('onSwitch');
  expect(source).toContain("onNew={() => navigate(() => router.push({ pathname: '/nova', params: { entryKey: noviUuidZahtevId() } }))}");
  // Navigation is still fenced by the account, its revision, the source and the foreground.
  expect(source).toContain('sesijaSada().accountRevision === accountRevision && izvorSada() === source');
  for (const retired of ['postaviUlogu', 'useUloga', 'ulogaSada', 'IntentTransition', "intent === 'narucilac'", 'ask('])
    expect(source).not.toContain(retired);
});
