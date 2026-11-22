const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Owner decision 22.11.2026: the Agreements screen is a clean list; "Čeka Vas" is a filter, never a section heading.
const src = fs.readFileSync(path.join(__dirname, '..', 'src/ui/v2/AgreementCollectionPresentation.tsx'), 'utf8');

test('the active list draws no "Čeka Vas" heading; waiting items stay on top in server order', () => {
  assert.match(src, /upcoming && upcomingStarted \|\| group\.key === 'waiting' \? \[\]/);
  assert.doesNotMatch(src, /group\.key === 'waiting' \? stale/);
});

test('"Čeka Vas" is the filter chip and covers every action that waits for me', () => {
  assert.match(src, />Čeka Vas<\/T>/);
  assert.match(src, /accessibilityLabel="Čeka Vas"/);
  assert.match(src, /!filtering \|\| task\.items\.some\(item => agreementAttention\(item\) !== null\)/);
  assert.doesNotMatch(src, /Čeka Vašu potvrdu/);
});
