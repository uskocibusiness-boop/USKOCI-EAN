import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Resolve the real dependency selected by Expo Router in Node, without Jest's
// module transforms or a copied decoder. This proves the component boundary;
// the active Router path parser uses WHATWG searchParams, so this is not a
// claim that an installed Android app exposes this parser to arbitrary links.
const result = JSON.parse(execFileSync(process.execPath, ['-e', String.raw`
  const { createRequire } = require('node:module');
  const { dirname, join } = require('node:path');
  const fs = require('node:fs');
  const routerRequire = createRequire(require.resolve('expo-router/package.json'));
  const queryRequire = createRequire(routerRequire.resolve('query-string'));
  const query = routerRequire('query-string');
  const decoder = queryRequire('decode-uri-component');
  const adapterRequire = createRequire(queryRequire.resolve('decode-uri-component'));
  const installed = JSON.parse(fs.readFileSync(join(dirname(adapterRequire.resolve('decode-uri-component-upstream')), 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const manifest = JSON.parse(fs.readFileSync('vendor/decode-uri-component-compat/package.json', 'utf8'));

  function measure(input) {
    const original = String.prototype.replace;
    let scannedCharacters = 0;
    String.prototype.replace = function (...args) {
      scannedCharacters += this.length;
      return Reflect.apply(original, this, args);
    };
    try {
      return { output: query.parse('value=' + input).value, scannedCharacters, inputLength: input.length };
    } finally {
      String.prototype.replace = original;
    }
  }
  let distinct = '';
  for (let index = 0; index < 2048; index++) {
    distinct += '%' + (index >> 8).toString(16).padStart(2, '0') + '%' + (index & 255).toString(16).padStart(2, '0') + 'x';
  }
  distinct += '%zz';
  process.stdout.write(JSON.stringify({
    callable: typeof decoder,
    plain: query.parse('naziv=USKO%C4%8CI+zadatak&plus=%2B&cena=0&empty='),
    fragment: query.parseUrl('uskociapp://zadatak?opis=rad+od+ku%C4%87e#deo+%2B', { parseFragmentIdentifier: true }),
    malformed: ['%25C2%zz', '%25%41%zz', 'a%FE%FFb', '%C2', '%E0%A4%A', '%', '%GG', '%252525'].map(decoder),
    typeError: (() => { try { decoder(null); } catch (error) { return error.name; } })(),
    distinct: measure(distinct),
    incomplete: measure('%C3'.repeat(4096) + '%zz'),
    installed: installed.version,
    locked: lock.packages['node_modules/decode-uri-component-upstream'].version,
    manifest: manifest.dependencies['decode-uri-component-upstream'],
    lockAlias: lock.packages['vendor/decode-uri-component-compat'].dependencies['decode-uri-component-upstream'],
  }));
`], { cwd: resolve(__dirname, '../../..'), encoding: 'utf8', timeout: 15000 }));

describe('locked URI decoder boundary (GHSA-qr28-fpjm-wq7f)', () => {
  it('preserves the callable adapter, Unicode, plus-to-space and encoded plus', () => {
    expect(result.callable).toBe('function');
    expect(result.plain).toEqual({ naziv: 'USKOČI zadatak', plus: '+', cena: '0', empty: '' });
    expect(result.fragment).toEqual({ url: 'uskociapp://zadatak', query: { opis: 'rad od kuće' }, fragmentIdentifier: 'deo +' });
    expect(result.typeError).toBe('TypeError');
  });

  it('decodes one level even when a malformed tail forces the fallback', () => {
    expect(result.malformed).toEqual(['%C2%zz', '%A%zz', 'a��b', '�', '%E0%A4%A', '%', '%GG', '%2525']);
  });

  it('does bounded replacement work for many distinct malformed percent runs', () => {
    expect(result.distinct.output.endsWith('%zz')).toBe(true);
    // Count scanned characters instead of wall time: the vulnerable decoder
    // rescans the entire input once per distinct run. A single pass, including
    // query-string and the compatibility adapter, stays within this margin.
    expect(result.distinct.scannedCharacters).toBeLessThan(result.distinct.inputLength * 10);
  });

  it('preserves long incomplete UTF-8 runs without recursive decoding', () => {
    expect(result.incomplete.output).toBe('%C3'.repeat(4096) + '%zz');
    expect(result.incomplete.scannedCharacters).toBeLessThan(result.incomplete.inputLength * 10);
  });

  it('loads the exact patched alias pinned in both manifest and lock', () => {
    expect(result.installed).toBe('0.5.1');
    expect(result.locked).toBe(result.installed);
    expect(result.manifest).toBe('npm:decode-uri-component@0.5.1');
    expect(result.lockAlias).toBe(result.manifest);
  });
});
