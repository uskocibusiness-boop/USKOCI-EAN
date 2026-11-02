// Offline body-only projection of a frozen, read-only hosted catalog capture.
// This calculates postconditions; it never certifies, deploys or admits R01.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const hash = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex');
const bodyHash = definition => {
  const marker = 'AS $function$';
  const start = definition.indexOf(marker);
  const end = definition.lastIndexOf('$function$');
  assert.ok(start >= 0 && end > start, 'R04_CLOSURE_FUNCTION_BODY_MISSING');
  return hash(definition.slice(start + marker.length, end), 'md5');
};
const replaceOnce = (text, before, after) => {
  assert.equal(text.split(before).length, 2, 'R04_CLOSURE_REPLACEMENT_NOT_UNIQUE');
  return text.replace(before, after);
};

export function deriveClosurePostimage({ evidence, originals, postimages, preimageClosure }) {
  const { capture } = evidence;
  assert.equal(capture.read_only, 'on', 'R04_CLOSURE_CAPTURE_NOT_READ_ONLY');
  assert.equal(capture.project_ref, 'leqcwgzvjsxugfgzdmth', 'R04_CLOSURE_CAPTURE_WRONG_PROJECT');
  for (const key of ['source', 'erasure']) {
    assert.equal(capture.actual[key], preimageClosure[key], 'R04_CLOSURE_PREIMAGE_CHANGED');
    assert.equal(hash(capture[key + '_input']), capture.actual[key], 'R04_CLOSURE_INPUT_DIGEST_MISMATCH');
  }

  // PostgreSQL produced this exact JSONB text, including key order and whitespace.
  // Preserve its bytes; JSON.parse is only used to check the precise field delta.
  let erasureInput = capture.erasure_input;
  let sourceInput = capture.source_input;
  const erasureAfter = JSON.parse(erasureInput);
  const sourcePrefix = sourceInput.slice(0, 260);
  assert.match(sourcePrefix, /^(?:[a-f0-9]{64}:){4}$/, 'R04_CLOSURE_SOURCE_PREFIX_INVALID');
  assert.equal(sourcePrefix.split(':')[0], preimageClosure.schema, 'R04_CLOSURE_SCHEMA_CHANGED');
  assert.equal(sourcePrefix.split(':')[1], preimageClosure.erasure, 'R04_CLOSURE_ERASURE_COMPONENT_CHANGED');
  assert.equal(sourceInput, sourcePrefix + capture.source_roster.map(f => f.signature + ':' + f.body_md5).join('\n'),
    'R04_CLOSURE_SOURCE_ROSTER_MISMATCH');
  assert.deepEqual(Object.keys(postimages).sort(), Object.keys(originals).sort(), 'R04_CLOSURE_PATCH_SCOPE_CHANGED');

  for (const [key, post] of Object.entries(postimages)) {
    const original = originals[key];
    assert.equal(post.signature, original.signature, 'R04_CLOSURE_SIGNATURE_CHANGED');
    const live = evidence.changed_function_preimages.find(f => f.signature === post.signature);
    assert.ok(live, 'R04_CLOSURE_LIVE_FUNCTION_MISSING');
    assert.equal(original.body_md5, live.body_md5, 'R04_CLOSURE_FUNCTION_PREIMAGE_CHANGED');
    assert.equal(bodyHash(original.definition), live.body_md5, 'R04_CLOSURE_ORIGINAL_BODY_MISMATCH');
    assert.equal(bodyHash(post.definition), post.body_md5, 'R04_CLOSURE_POSTIMAGE_BODY_MISMATCH');

    const erasure = erasureAfter.functions.find(f => f.signature === post.signature);
    if (erasure) {
      assert.equal(erasure.source, live.body_md5, 'R04_CLOSURE_ERASURE_ROSTER_MISMATCH');
      erasureInput = replaceOnce(erasureInput, live.body_md5, post.body_md5);
      erasure.source = post.body_md5;
    }
    const source = capture.source_roster.find(f => f.signature === post.signature);
    if (source) {
      assert.equal(source.body_md5, live.body_md5, 'R04_CLOSURE_SOURCE_BODY_MISMATCH');
      sourceInput = replaceOnce(sourceInput, post.signature + ':' + live.body_md5, post.signature + ':' + post.body_md5);
    }
  }

  assert.deepEqual(JSON.parse(erasureInput), erasureAfter, 'R04_CLOSURE_UNEXPECTED_METADATA_DELTA');
  const erasure = hash(erasureInput);
  sourceInput = replaceOnce(sourceInput, preimageClosure.erasure, erasure);
  // Retain the existing certificate, false readiness and NULL bindings verbatim.
  return { ...preimageClosure, erasure, source: hash(sourceInput) };
}
