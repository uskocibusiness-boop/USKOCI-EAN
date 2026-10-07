// EDGE PUSH COPY V2 (prepared 2026-10-07, NOT deployed): the neutral, gender-free copies of three push events, exactly as the client mirror
// plans them (PLANNED_PUBLIC_INBOX_COPIES). This test applies the six line edits of replacements.json to a TEMPORARY copy of the two files,
// imports the patched formatter, runs the patched N10 suite, and proves that nothing else changes. It never edits the repository files and
// never deploys anything. Run: node --test docs/implementation/product-v1-closure-20260926/finalization-20260927/server-backlog-20261007/edge-push-copy-v2/edge-push-copy-v2.test.mjs
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../../..');
const EDGE = 'supabase/functions/_shared/pushNotificationCopy.mjs', N10 = 'supabase/proofs/notifications/n10_push_copy.test.mjs';
const replacements = JSON.parse(fs.readFileSync(path.join(HERE, 'replacements.json'), 'utf8'));
// The client mirror's planned copies (src/ui/notifications/publicInboxCopy.ts PLANNED_PUBLIC_INBOX_COPIES in the screen teams' work of 2026-10-07).
const PLANNED = {
  RESPONSE_SELECTED: ['Tvoja prijava je izabrana', 'Otvori Dogovor.'],
  COMPLETION_REQUIRED: ['Potvrdi završetak', 'Zadatak je označen kao gotov.'],
  RECOVERY_OPENED: ['Prijavljen je problem u Dogovoru', 'Otvori Dogovor da vidiš prijavljeni problem.'],
};
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

function patchedTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-push-copy-v2-'));
  for (const file of [EDGE, N10]) {
    let text = read(file);
    for (const r of replacements.filter(x => x.file === file)) {
      assert.equal(text.split(r.before).length - 1, 1, 'THE_DIFF_NO_LONGER_APPLIES: ' + r.before);
      text = text.replace(r.before, () => r.after);
    }
    fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true});
    fs.writeFileSync(path.join(dir, file), text);
  }
  return dir;
}

test('the six edits still apply to the committed files, each exactly once, and match the reviewed diff', () => {
  assert.equal(replacements.length, 6);
  const diff = fs.readFileSync(path.join(HERE, 'edge-push-copy-v2.diff'), 'utf8').replace(/\r\n/g, '\n');
  for (const r of replacements) {
    assert.equal(read(r.file).split(r.before).length - 1, 1, r.before);
    assert.ok(diff.includes('\n-' + r.before + '\n') && diff.includes('\n+' + r.after + '\n'), 'DIFF_AND_REPLACEMENTS_DISAGREE: ' + r.after);
  }
});

test('the patched formatter answers the planned copies and leaves every other event, the urgent variant and the generic copy as they are', async () => {
  const dir = patchedTree();
  try {
    const current = await import(pathToFileURL(path.join(ROOT, EDGE)).href);
    const patched = await import(pathToFileURL(path.join(dir, EDGE)).href + '?v2');
    assert.deepEqual([...patched.PUSH_EVENT_TYPES], [...current.PUSH_EVENT_TYPES]);
    for (const eventType of current.PUSH_EVENT_TYPES) {
      for (const urgency of ['NORMAL', 'HITNO']) {
        const now = current.notificationPushCopy(eventType, urgency), next = patched.notificationPushCopy(eventType, urgency);
        if (PLANNED[eventType]) assert.deepEqual(next, {title: PLANNED[eventType][0], body: PLANNED[eventType][1]});
        else assert.deepEqual(next, now, eventType + '/' + urgency + ' must not change');
        assert.ok(next.title.length <= 64 && next.body.length <= 120);
        assert.ok(!/Uskočer|uskočer|Naruči(lac|oc)|naruči(lac|oc)/.test(next.title + next.body), 'no internal side names');
      }
    }
    for (const value of ['NEW_FUTURE_EVENT', '', null, {}]) assert.deepEqual(patched.notificationPushCopy(value), current.notificationPushCopy(value));
    // gender-free: the old RESPONSE_SELECTED title "Izabran si" agreed with a male reader; the planned participles agree with the nouns
    // ("prijava je izabrana", "zadatak je označen"), never with the reader, and "Druga strana je označila" (about the other person) is gone.
    for (const [title, body] of Object.values(PLANNED)) assert.ok(!/\b(izabran si|izabrana si|označio|označila|otvorio|otvorila)\b/i.test(title + ' ' + body));
    assert.ok(!Object.values(PLANNED).flat().some(text => text === 'Izabran si'));
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('the patched N10 suite passes against the patched formatter (the suite the Edge deploy job runs)', () => {
  const dir = patchedTree();
  try {
    // A child of a test run would report to the parent runner (NODE_TEST_CONTEXT); run it as an independent suite with TAP output.
    const env = {...process.env};
    delete env.NODE_TEST_CONTEXT;
    const output = execFileSync(process.execPath, ['--test', '--test-reporter=tap', path.join(dir, N10)], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env});
    assert.match(output, /# fail 0/);
    assert.match(output, /# pass [1-9]/);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
