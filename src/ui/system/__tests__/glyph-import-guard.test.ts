import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/** Central icon ownership. Transitional adapters below remain explicit until migrated.
 * A new adapter needs a documented role; this list is not an immutable count or style ban.
 * Source scans retain production dependency boundaries and catch stale exceptions. */
const repo = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');

/** The one file that may import the package. */
const THE_GLYPH_FILE = 'src/ui/system/Glyph.tsx';

/** Every way a source file can take the package in: a static import (value or type), a re-export, a require and a dynamic import. */
const PHOSPHOR_IMPORT = /(?:\bfrom\s*|\brequire\(\s*|\bimport\(\s*|\bimport\s+)['"]phosphor-react-native(?:\/[^'"]*)?['"]/;
const importsPhosphor = (source: string) => PHOSPHOR_IMPORT.test(source);

const sourceFiles = (dir: string): string[] => readdirSync(join(repo, dir), { withFileTypes: true }).flatMap(entry => {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
  return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
});

/** Explicit transitional adapters; review when their owning component changes. */
const PHOSPHOR_IMPORTERS = new Set([
  'src/designLab/dizajn-dodaci.tsx',
  'src/designLab/dizajn-dogovori.tsx',
  'src/designLab/dizajn-kalendar.tsx',
  'src/designLab/dizajn-obavestenja.tsx',
  'src/app/obavestenja.tsx',
  'src/ui/agreements/AgreementActionsPresentation.tsx',
  'src/ui/aiFirst/VoiceComposer.tsx',
  'src/ui/entry/EntryWelcome.tsx', // Entry illustration adapter; not a frozen layout.
  'src/ui/groups/GroupConversationPresentation.tsx',
  'src/ui/product/ProductDetails.tsx',
  'src/ui/system/Disclosure.tsx',
  'src/ui/system/PillComposer.tsx',
  'src/ui/system/SuccessMark.tsx',
  'src/ui/v2/DiscoveryPresentation.tsx',
  'src/ui/v2/NeedUrgencyBadge.tsx',
  'src/ui/v2/TaskFace.tsx',
  'src/ui/v2/V2Action.tsx',
  'src/ui/v2/discovery/DateRangeGrid.tsx',
  'src/ui/v2/discovery/PricePill.tsx',
]);

describe('one place for a control icon: only Glyph imports the Phosphor package', () => {
  it('finds each way of taking the package in, and nothing else', () => {
    for (const source of [
      "import { ArrowLeft } from 'phosphor-react-native';", "import type { Icon } from 'phosphor-react-native';",
      "import { type Icon, X } from \"phosphor-react-native\";", "export { Bell } from 'phosphor-react-native';",
      "const icons = require('phosphor-react-native');", "const icons = await import('phosphor-react-native');",
      "import 'phosphor-react-native';", "import { Bell } from 'phosphor-react-native/lib/module/icons/Bell';",
      "import {\n  Bell,\n  X,\n} from 'phosphor-react-native';",
    ]) expect([source, importsPhosphor(source)]).toEqual([source, true]);
    for (const source of [
      "import { Glyph } from './Glyph';", "// the phosphor-react-native package", "const name = 'phosphor';",
      "import { PhosphorIcon } from './phosphor-react-native-wrapper';", "jest.mock('phosphor-react-nativex');",
    ]) expect([source, importsPhosphor(source)]).toEqual([source, false]);
  });

  it('no file outside Glyph imports the package unless it is on the reviewed adapter list, and every listed file still does', () => {
    const importers = sourceFiles('src').filter(path => path !== THE_GLYPH_FILE && importsPhosphor(read(path)));
    expect(importers.filter(path => !PHOSPHOR_IMPORTERS.has(path))
      .map(path => `${path}: imports phosphor-react-native and is not listed; ask Glyph for a name (add the name to the registry if it has none)`)).toEqual([]);
    expect([...PHOSPHOR_IMPORTERS].filter(path => existsSync(join(repo, path)) && !importers.includes(path))
      .map(path => `${path}: no longer imports phosphor-react-native; delete this entry`)).toEqual([]);
    expect([...PHOSPHOR_IMPORTERS].filter(path => !existsSync(join(repo, path)))).toEqual([]);
  });

  it('the adapters exclude the registry owner, which imports the package', () => {
    expect(PHOSPHOR_IMPORTERS.has(THE_GLYPH_FILE)).toBe(false);
    expect(importsPhosphor(read(THE_GLYPH_FILE))).toBe(true);
  });

  it('the two system components of the chrome are off the list: they ask Glyph', () => {
    for (const path of ['src/ui/system/ScreenChrome.tsx', 'src/ui/system/ScreenHeader.tsx']) {
      expect([path, PHOSPHOR_IMPORTERS.has(path)]).toEqual([path, false]);
      expect([path, importsPhosphor(read(path))]).toEqual([path, false]);
      expect(read(path)).toMatch(/from '\.\/Glyph'/);
    }
  });

  it('the navigation asks Glyph and imports no icon package of its own', () => {
    expect(importsPhosphor(read('src/ui/system/TabBarItem.tsx'))).toBe(false);
    expect(importsPhosphor(read('src/app/(app)/_layout.tsx'))).toBe(false);
  });
});
