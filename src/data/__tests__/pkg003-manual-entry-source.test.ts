import fs from 'node:fs';
import path from 'node:path';

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const missing = (relative: string) => !fs.existsSync(path.join(process.cwd(), relative));

/**
 * PKG-003 defined one New Task entry with a provider-independent manual branch beside it. The owner
 * retired that branch on 2026-09-18: "+" enters the conversation directly, and manual entry is gone
 * from the client. What PKG-003 was protecting — that nothing else writes Need facts behind the AI's
 * back, and that the entry stays single — is what this file now holds to.
 *
 * The server side of PKG-003 is untouched: `rpc_set_manual_need_fact_v2` and its candidate and
 * runtime proof remain, so the boundary is still proven where it is enforced.
 */
describe('PKG-003 one New Task entry, after the manual branch was retired', () => {
  it('sends the New Task control straight into the conversation from both lists', () => {
    const potrebe = source('src/app/(app)/potrebe.tsx');
    // Public discovery is the Zadaci tab since 2026-09-23 (prilike.tsx only redirects there).
    const prilike = source('src/app/(app)/zadaci.tsx');

    expect(potrebe).toContain("router.push({ pathname: '/nova', params: { entryKey: noviUuidZahtevId() } })");
    expect(potrebe).not.toContain('novi-zadatak');
    // The worker list already asked for the intent switch first, and still does.
    expect(prilike).toContain("router.push({ pathname: '/nova', params: { entryKey: noviUuidZahtevId() } })");
    // There is no mode to switch before a new task any more (owner decision 1, 2026-09-19): one entry, one route.
    expect(prilike).not.toContain("router.replace('/nova')");
  });

  it('leaves no chooser, no manual screen and no second Need-fact writer in the client', () => {
    expect(missing('src/app/(app)/novi-zadatak.tsx')).toBe(true);
    expect(missing('src/app/(app)/rucni-zadatak.tsx')).toBe(true);
    expect(missing('src/data/manualNeedFactClientService.ts')).toBe(true);

    const layout = source('src/app/_layout.tsx');
    const appLayout = source('src/app/(app)/_layout.tsx');
    expect(appLayout).not.toContain('novi-zadatak');
    expect(appLayout).not.toContain('rucni-zadatak');
    expect(layout + appLayout).not.toContain('rpc_set_manual_need_fact_v2');
  });

  it('keeps the conversation as the only client that proposes or writes Need facts', () => {
    const intake = source('src/app/(app)/nova.tsx');
    const client = source('src/data/aiNeedV2Production.ts');

    expect(intake).toContain('aiNeedV2Izvor.sendMessage');
    expect(client).toContain('uskoci-ai-interview');

    const root = path.join(process.cwd(), 'src');
    const writers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.tsx?$/.test(entry.name) || full.includes('__tests__')) continue;
        if (fs.readFileSync(full, 'utf8').includes('rpc_set_manual_need_fact_v2')) writers.push(full);
      }
    };
    walk(root);
    expect(writers).toEqual([]);
  });

  it('still keeps the retired branch proven where it is enforced, on the server', () => {
    const sql = source('supabase/candidates/pkg003_manual_need_fact_v2.sql');
    expect(sql).toContain("v_conv.purpose <> 'NEED_INTAKE'");
    expect(sql).toContain("v_conv.fact_schema_version <> 'NEED_FACT_V2'");
    expect(sql).toContain("v_conv.status <> 'OPEN'");
    expect(sql).toContain("'CONFIRMED', 'EXPLICIT_USER_ANSWER', 'NEED_DRAFT'");
  });
});
