import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { read, repo } from '../../system/__tests__/ratchetKit';

/**
 * Every screen of the profile family is REGISTERED in the tab layout with `href: null` and the flow options (`FULL`: no bottom bar), like
 * the thirty before them. The tab navigator lists a route that is not registered as one more tab of the bottom bar, and a flow
 * (a form, a password) must not show the bar. A new screen file under `src/app/(app)/profil/` that is not in `_layout.tsx` is a screen
 * that works in a test and misbehaves in the app (R22 "Promeni lozinku" and R23 "Prijavi grešku u aplikaciji" were the first to be
 * forgotten).
 */
const LAYOUT = 'src/app/(app)/_layout.tsx';
const PROFILE_DIR = 'src/app/(app)/profil';
const routes = readdirSync(join(repo, PROFILE_DIR)).filter(file => /\.tsx$/.test(file) && !file.startsWith('_')).map(file => `profil/${file.replace(/\.tsx$/, '')}`).sort();
const layout = read(LAYOUT);
const registered = (name: string) => new RegExp(`<Tabs\\.Screen\\s+name="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+options=\\{\\{\\s*href:\\s*null,\\s*\\.\\.\\.FULL\\s*\\}\\}\\s*/>`).test(layout);

describe('the profile family in the tab layout', () => {
  it('looks at the real folder and at the real layout, so an empty sweep cannot pass for a clean one', () => {
    expect(existsSync(join(repo, LAYOUT))).toBe(true);
    expect(routes.length).toBeGreaterThanOrEqual(15);
    expect(routes).toEqual(expect.arrayContaining(['profil/radnik', 'profil/ocene', 'profil/lozinka', 'profil/prijava-greske']));
  });

  it('registers every screen file of the family with href null and the flow options', () => {
    const missing = routes.filter(name => !registered(name));
    expect(missing.map(name => `${name}: add <Tabs.Screen name="${name}" options={{ href: null, ...FULL }} /> to ${LAYOUT}`)).toEqual([]);
  });

  it('registers nothing that is not a screen file any more', () => {
    const named = [...layout.matchAll(/<Tabs\.Screen\s+name="(profil\/[a-z-]+)"/g)].map(match => match[1]);
    expect(named.filter(name => !routes.includes(name))).toEqual([]);
  });
});
