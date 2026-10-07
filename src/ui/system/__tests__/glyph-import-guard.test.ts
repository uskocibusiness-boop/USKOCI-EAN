import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * ONE PLACE FOR A CONTROL ICON (UI/UX pass, wave 2, item 2.3; audit ICO-08). A screen that imports `phosphor-react-native` itself
 * chooses its own size, weight and colour, which is how 47 icons came to be drawn at ten sizes in three weights. `Glyph.tsx` is
 * the one file that may import the package; every other file asks it for a name.
 *
 * This is a RATCHET, tight both ways like the wave-1 ratchets in `one-token-source.test.ts`: the list below names TODAY's importers
 * so the suite is green now, and it can only shrink. A file that is not on it and imports the package fails ("ask Glyph for a name");
 * a file that is on it and no longer imports the package fails too ("delete the entry"), so the change that moves a file onto
 * `Glyph` is the change that removes its line. Never add one.
 *
 * Wave 2 moved the two system components that draw the chrome, `ScreenChrome` and `ScreenHeader`, off the list. Every later wave
 * deletes the lines of the files it touches. LOCKED: `src/ui/entry/EntryWelcome.tsx` is the V4.9 entry; it keeps its own icons
 * and its line is never deleted by this pass.
 *
 * A test double that mocks the package (`jest.mock('phosphor-react-native', ...)`) is a test and is not read here.
 */
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

/** TODAY'S importers (54 files). It only shrinks. */
const PHOSPHOR_IMPORTERS = new Set([
  'src/app/(app)/profil/izvoz.tsx',
  'src/app/auth.tsx',
  'src/app/dizajn-dodaci.tsx',
  'src/app/dizajn-dogovori.tsx',
  'src/app/dizajn-kalendar.tsx',
  'src/app/dizajn-obavestenja.tsx',
  'src/app/dizajn-pocetna.tsx',
  'src/app/obavestenja.tsx',
  'src/app/oporavak.tsx',
  'src/ui/AgreementChat.tsx',
  'src/ui/agreements/AgreementActionsPresentation.tsx',
  'src/ui/agreements/AgreementWorkspace.tsx',
  'src/ui/aiFirst/AiConversationShell.tsx',
  'src/ui/aiFirst/FactValueEditors.tsx',
  'src/ui/aiFirst/VoiceComposer.tsx',
  'src/ui/auth/AuthControls.tsx',
  'src/ui/calendar/AvailabilityForm.tsx',
  'src/ui/entry/EntryWelcome.tsx', // LOCKED entry
  'src/ui/groups/GroupConversationPresentation.tsx',
  'src/ui/location/LocationControls.tsx',
  'src/ui/location/LocationMapPreview.tsx',
  'src/ui/media/ContextPhotos.tsx',
  'src/ui/notifications/InboxPresentation.tsx',
  'src/ui/objava/ReviewPresentation.tsx',
  'src/ui/privacy/ExportPresentation.tsx',
  'src/ui/product/ProductDetails.tsx',
  'src/ui/profile/ProfileHubPresentation.tsx',
  'src/ui/qa/TaskQaPresentation.tsx',
  'src/ui/reviews/AgreementReviewPresentation.tsx',
  'src/ui/settings/SettingsPresentation.tsx',
  'src/ui/support/SupportPresentation.tsx',
  'src/ui/system/Detail.tsx',
  'src/ui/system/Disclosure.tsx',
  'src/ui/system/PillComposer.tsx',
  'src/ui/system/SuccessMark.tsx',
  'src/ui/v2/AgreementPresentation.tsx',
  'src/ui/v2/AgreementThreadPresentation.tsx',
  'src/ui/v2/ApplicationComposerPresentation.tsx',
  'src/ui/v2/ApplicationSelectionPresentation.tsx',
  'src/ui/v2/CandidateFace.tsx',
  'src/ui/v2/DiscoveryMap.tsx',
  'src/ui/v2/DiscoveryPresentation.tsx',
  'src/ui/v2/IntakePresentation.tsx',
  'src/ui/v2/MarketplacePresentation.tsx',
  'src/ui/v2/NeedUrgencyBadge.tsx',
  'src/ui/v2/TaskFace.tsx',
  'src/ui/v2/V2Action.tsx',
  'src/ui/v2/detail/TaskDecision.tsx',
  'src/ui/v2/discovery/DateRangeGrid.tsx',
  'src/ui/v2/discovery/DiscoveryPeek.tsx',
  'src/ui/v2/discovery/DiscoverySearchBar.tsx',
  'src/ui/v2/discovery/PricePill.tsx',
  'src/ui/workerProfile/WorkerAiPresentation.tsx',
  'src/ui/workerProfile/WorkerProfilePresentation.tsx',
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

  it('no file outside Glyph imports the package unless it is on the shrinking list, and every listed file still does', () => {
    const importers = sourceFiles('src').filter(path => path !== THE_GLYPH_FILE && importsPhosphor(read(path)));
    expect(importers.filter(path => !PHOSPHOR_IMPORTERS.has(path))
      .map(path => `${path}: imports phosphor-react-native and is not listed; ask Glyph for a name (add the name to the registry if it has none)`)).toEqual([]);
    expect([...PHOSPHOR_IMPORTERS].filter(path => existsSync(join(repo, path)) && !importers.includes(path))
      .map(path => `${path}: no longer imports phosphor-react-native; delete this entry`)).toEqual([]);
    expect([...PHOSPHOR_IMPORTERS].filter(path => !existsSync(join(repo, path)))).toEqual([]);
  });

  it('the list has the size it says, never lists Glyph itself, and Glyph really is the importer', () => {
    expect(PHOSPHOR_IMPORTERS.size).toBe(54);
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
