'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['__tests__', 'designLab'].includes(entry.name) ? [] : sources(file);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
  });
}
test('development scenes cannot become Expo product routes or runtime imports', () => {
  const routes = sources(path.join(root, 'src/app'));
  assert.equal(routes.filter(file => path.basename(file).startsWith('dizajn-')).length, 0);
  for (const file of sources(path.join(root, 'src'))) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /(?:from\s*|require\(\s*|import\(\s*)['"][^'"]*(?:designLab|\/dizajn-)/, path.relative(root, file));
  }
  assert.equal(fs.readdirSync(path.join(root, 'src/designLab')).filter(file => file.endsWith('.tsx')).length, 21);
});
