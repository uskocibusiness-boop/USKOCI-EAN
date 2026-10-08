import { existsSync } from 'fs';
import { dirname, join, normalize, resolve } from 'path';
import { read, repo, ratchetOffences, sourceFiles, withoutComments } from './ratchetKit';

/**
 * ONE CONTAINER (composition spec 2026-10-07, "U4" and N6; UI/UX pass 2026-10-08, F8a). The app had six kinds of container, and the
 * same record (a task, a Dogovor, an appointment) looked three ways: with a shadow, with an edge, with neither. `Surface`
 * (`record` / `panel` / `float` / `note`) is the one that says what each means, and `Surface.tsx` is the only file that may
 * take `raisedItem`, `card`, `cardCompact`, `floating` or `inset` from `ui/system/tokens`.
 *
 * This is a RATCHET, tight both ways like `one-token-source.test.ts`: the table below names TODAY'S 33 files and the
 * container tokens each takes, so the suite is green now, and it can only shrink. A file that is not on it and takes one fails
 * ("use Surface"); a file that takes one more than its entry fails ("do not raise the entry"); a file that takes fewer than its entry
 * fails too ("lower the entry"), so the change that moves a screen onto `Surface` is the change that lowers its line. Never add one.
 * `tokens.ts` defines the tokens and is not read; a test double is a test and is not read either.
 */
const NAMES = ['raisedItem', 'card', 'cardCompact', 'floating', 'inset'] as const;
const THE_SURFACE_FILE = 'src/ui/system/Surface.tsx';
const THE_TOKEN_FILE = 'src/ui/system/tokens.ts';
const TOKENS = resolve(repo, 'src/ui/system/tokens');

const IMPORT = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
/** The container tokens a source takes from `ui/system/tokens`, by the name they have there (an alias is read through), once each. */
const containersTaken = (source: string, file: string): string[] => {
  const found = new Set<string>();
  for (const match of withoutComments(source).matchAll(IMPORT)) {
    const spec = match[2];
    const target = spec.startsWith('@/') ? resolve(repo, 'src', spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(join(repo, file)), spec) : null;
    if (!target || normalize(target) !== normalize(TOKENS)) continue;
    for (const part of match[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if ((NAMES as readonly string[]).includes(name)) found.add(name);
    }
  }
  return [...found].sort();
};

/** TODAY'S files that take a container token themselves, and which ones. It only shrinks. */
const TAKES_TODAY: Record<string, string> = {
  'src/ui/AgreementChat.tsx': 'floating',
  'src/ui/agreements/AgreementActionsPresentation.tsx': 'inset',
  'src/ui/agreements/AgreementCompletionReview.tsx': 'inset',
  'src/ui/auth/AuthControls.tsx': 'inset',
  'src/ui/calendar/AvailabilityForm.tsx': 'card',
  'src/ui/calendar/CalendarControls.tsx': 'card, cardCompact',
  'src/ui/needs/NeedLifecycleActions.tsx': 'inset',
  'src/ui/system/Skeleton.tsx': 'cardCompact',
  'src/ui/v2/AmountField.tsx': 'inset',
};

describe('the scanner finds a container token taken from system/tokens, and nothing else', () => {
  it('reads each way of taking one: plain, aliased, type-only, several lines, a re-export, the @ alias', () => {
    const from = 'src/ui/v2/Some.tsx';
    expect(containersTaken("import { card, sys } from '../system/tokens';", from)).toEqual(['card']);
    expect(containersTaken("import { cardCompact as compact, raisedItem } from '../system/tokens';", from)).toEqual(['cardCompact', 'raisedItem']);
    expect(containersTaken("import type { floating } from '../system/tokens';", from)).toEqual(['floating']);
    expect(containersTaken("import {\n  brandAction,\n  inset,\n  sys,\n} from '../system/tokens';", from)).toEqual(['inset']);
    expect(containersTaken("export { raisedItem } from '../system/tokens';", from)).toEqual(['raisedItem']);
    expect(containersTaken("import { card } from '@/ui/system/tokens';", from)).toEqual(['card']);
    expect(containersTaken("import { card } from './tokens';", 'src/ui/system/Some.tsx')).toEqual(['card']);
  });

  it('lets through everything that is not a container taken from the system tokens', () => {
    const from = 'src/ui/v2/Some.tsx';
    expect(containersTaken("import { sys, brandAction, field } from '../system/tokens';", from)).toEqual([]);
    // Another module named tokens, another file of the same name: not the system's.
    expect(containersTaken("import { card } from '../../theme/tokens';", from)).toEqual([]);
    expect(containersTaken("import { card } from './tokens';", from)).toEqual([]);
    expect(containersTaken("import { card } from 'some-package';", from)).toEqual([]);
    // A comment is not an import, and a property is not a token.
    expect(containersTaken("// import { card } from '../system/tokens';\nconst x = sys.radius.card;", from)).toEqual([]);
  });
});

// A wave moved some screens onto `Surface`: `RATCHET_PRINT=1 npx jest src/ui/system/__tests__/surface-kinds-ratchet.test.ts` prints the table as it
// stands today (and the count above), to paste over `TAKES_TODAY`. It prints nothing, and the suite does not look at it, otherwise.
if (process.env.RATCHET_PRINT) {
  it('prints the table as it stands today (RATCHET_PRINT)', () => {
    const today = sourceFiles('src').filter(file => file !== THE_TOKEN_FILE && file !== THE_SURFACE_FILE)
      .map(file => [file, containersTaken(read(file), file).join(', ')] as const).filter(([, names]) => names);
    // eslint-disable-next-line no-console
    console.log([`${today.length} files`, ...today.map(([file, names]) => `  '${file}': '${names}',`)].join('\n'));
  });
}

describe('only Surface takes the container tokens', () => {
  const taken = (file: string) => containersTaken(read(file), file);
  const files = sourceFiles('src').filter(file => file !== THE_TOKEN_FILE && file !== THE_SURFACE_FILE);

  it('looks at a real tree, so an empty sweep cannot pass for a clean one', () => {
    expect(files.length).toBeGreaterThan(300);
    expect(Object.keys(TAKES_TODAY).length).toBe(9);
  });

  it('no file outside Surface takes more than its entry, and none takes fewer: it can only shrink, and shrinks with the code', () => {
    const offences = files.flatMap(file => {
      const found = Object.fromEntries(taken(file).map(name => [name, 1]));
      const allowed = Object.fromEntries((TAKES_TODAY[file] ?? '').split(', ').filter(Boolean).map(name => [name, 1]));
      return ratchetOffences(file, found, allowed);
    });
    expect(offences).toEqual([]);
  });

  it('every entry names a real file that is not Surface, and only names real tokens', () => {
    expect(Object.keys(TAKES_TODAY).filter(file => !existsSync(join(repo, file)))).toEqual([]);
    expect(Object.keys(TAKES_TODAY)).not.toContain(THE_SURFACE_FILE);
    expect(Object.keys(TAKES_TODAY)).not.toContain(THE_TOKEN_FILE);
    for (const names of Object.values(TAKES_TODAY)) for (const name of names.split(', ')) expect([name, (NAMES as readonly string[]).includes(name)]).toEqual([name, true]);
  });

  it('Surface really is the file that takes them, and the tokens still exist where it takes them from', () => {
    expect(containersTaken(read(THE_SURFACE_FILE), THE_SURFACE_FILE)).toEqual(['cardCompact', 'floating', 'inset', 'raisedItem']);
    const tokens = read(THE_TOKEN_FILE);
    for (const name of NAMES) expect([name, new RegExp(`export const ${name}\\b`).test(tokens)]).toEqual([name, true]);
  });
});
