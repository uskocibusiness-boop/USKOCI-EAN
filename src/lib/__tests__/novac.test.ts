import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { iznos, novac } from '../novac';

/**
 * Ten places wrote an amount of money by hand.
 *
 * `${n.toLocaleString('sr-Latn-RS')} RSD` appeared in the application, candidate, need and agreement
 * client services, in both the Supabase and the fake source, in the task presentation twice, and in
 * the intake card. Nine of the ten agreed.
 *
 * The tenth, the fake source's candidate list, was `${k.cenaRsd} RSD` — no grouping at all. One
 * screen said "18000 RSD" while every other screen said "18.000 RSD", and because it was in the
 * fake source nobody looking at real data would ever have seen it.
 *
 * Same shape as the Serbian plural: a rule everybody knows is a rule everybody rewrites, and the
 * copy that drifts is the one nobody is looking at.
 */
const SRC = join(__dirname, '..', '..');
const CANONICAL = ['lib', 'novac.ts'].join('/');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/** An amount and a currency being glued together somewhere other than the one place that may. */
function buildsMoneyByHand(source: string): boolean {
  return /toLocaleString\(\s*'sr-Latn-RS'\s*\)[^;\n]{0,16}RSD/.test(source)
    || /\$\{[^}]{1,40}\}\s*RSD/.test(source);
}

describe('money is written one way', () => {
  const files = sources(SRC);

  it('looks at a real tree, so an empty sweep cannot pass for a clean one', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some(file => file.split(/[\\/]/).join('/').endsWith(CANONICAL))).toBe(true);
  });

  it('builds the string in exactly one file', () => {
    const offenders = files
      .map(file => ({ file, path: file.split(/[\\/]/).join('/') }))
      .filter(({ path }) => !path.endsWith(CANONICAL))
      .filter(({ file }) => buildsMoneyByHand(readFileSync(file, 'utf8')))
      .map(({ path }) => path.slice(path.indexOf('/src/') + 1));
    expect(offenders).toEqual([]);
  });

  it('groups thousands with a full stop, the way Serbian reads them', () => {
    expect(novac(18000)).toBe('18.000 RSD');
    expect(novac(5000)).toBe('5.000 RSD');
    expect(novac(999)).toBe('999 RSD');
    expect(novac(1234567)).toBe('1.234.567 RSD');
    expect(iznos(18000)).toBe('18.000');
  });

  it('keeps a currency it was given while displaying euros by their symbol', () => {
    expect(novac(1500, 'EUR')).toBe('1.500 €');
    expect(novac(1500, 'USD')).toBe('1.500 USD');
  });

  it('says nothing rather than something wrong when the number is not one', () => {
    expect(novac(Number.NaN)).toBe('');
    expect(novac(Number.POSITIVE_INFINITY)).toBe('');
    expect(iznos(Number.NaN)).toBe('');
  });

  it('writes zero as zero, which is a real price to refuse, not a missing one', () => {
    expect(novac(0)).toBe('0 RSD');
  });
});
