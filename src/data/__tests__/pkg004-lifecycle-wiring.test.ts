import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PKG-004 owner lifecycle wiring invariants', () => {
  const route = readFileSync(join(__dirname, '..', '..', 'app', '(app)', 'potrebe', '[id]', 'pregled.tsx'), 'utf8');
  const presentation = readFileSync(join(__dirname, '..', '..', 'ui', 'v2', 'NeedPresentation.tsx'), 'utf8');

  it('mounts lifecycle recovery from route identity instead of requiring a successful Need row', () => {
    expect(route).toContain('need={potreba} needId={id}');
    // Mounted from the route identity alone: the owner-only read and the server settle ownership, no app mode does.
    // HITNO feedback shares the fragment; lifecycle recovery is still gated only by route identity.
    expect(route).toMatch(/lifecycleActions=\{uuid\(id\) \? <>\s*<UrgentActivationActions control=\{urgent\} \/>\s*<NeedLifecycleActions need=\{potreba\} needId=\{id\}[\s\S]*?<\/\> : undefined\}/);
    expect(route).not.toContain("intent === 'narucilac'");
    expect(route).not.toContain('lifecycleActions={potreba && intent');
  });

  it('keeps lifecycle recovery visible while the Need read is loading or unavailable', () => {
    const loading = presentation.indexOf('Učitavamo zadatak…');
    const unavailable = presentation.indexOf('Zadatak nije dostupan');
    const firstRecovery = presentation.indexOf('{props.lifecycleActions}', loading);
    const secondRecovery = presentation.indexOf('{props.lifecycleActions}', unavailable);
    expect(loading).toBeGreaterThan(-1);
    expect(unavailable).toBeGreaterThan(-1);
    expect(firstRecovery).toBeGreaterThan(loading);
    expect(firstRecovery).toBeLessThan(unavailable);
    expect(secondRecovery).toBeGreaterThan(unavailable);
  });

  it('keeps close confirmation on the existing owner read while R3 recovery is a separate authority layer', () => {
    expect(route).toContain('const after = await read()');
    expect(route).toContain('after.podatak.remainingClosed ? after');
    expect(route).toContain('ru4Production.remainingSearchState');
    expect(route).toContain('needSearchRecoveryClientService.read');
    expect(route).toContain('R3 recovery is additive authority');
    expect(route).toContain('REMAINING_SEARCH_CLOSE_NOT_CONFIRMED');
  });

  it('retains one immutable close command per Need revision until the server confirms closure', () => {
    expect(route).toContain("retainRemainingSearchCloseAttempt(closeAttempt.current, potreba.id, potreba.revizija, () => noviZahtevId('zatvori-preostalu-potragu'))");
    expect(route).toContain('ru4Production.closeRemainingSearch(attempt.needId, attempt.revision, attempt.clientRequestId)');
    expect(route).toContain('closeAttempt.current = null');
    expect(route).not.toContain("closeRemainingSearch(potreba.id, potreba.revizija, noviZahtevId(");
  });
});
