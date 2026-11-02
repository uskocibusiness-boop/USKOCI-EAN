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
  const schemaCapture = evidence.schema_capture;
  assert.ok(schemaCapture, 'R04_CLOSURE_SCHEMA_CAPTURE_REQUIRED');
  assert.equal(schemaCapture.read_only, 'on', 'R04_CLOSURE_SCHEMA_CAPTURE_NOT_READ_ONLY');
  assert.equal(schemaCapture.project_ref, capture.project_ref, 'R04_CLOSURE_SCHEMA_PROJECT_CHANGED');
  assert.equal(schemaCapture.actual_schema, preimageClosure.schema, 'R04_CLOSURE_SCHEMA_PREIMAGE_CHANGED');
  assert.equal(hash(schemaCapture.schema_input), preimageClosure.schema, 'R04_CLOSURE_SCHEMA_INPUT_DIGEST_MISMATCH');
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
  let schemaInput = schemaCapture.schema_input;
  const schemaAfter = JSON.parse(schemaInput);
  const triggers = schemaAfter.flatMap(t => (t.triggers ?? []).map(value => ({ relation: t.table, value })));
  assert.equal(triggers.length, schemaCapture.trigger_roster.length, 'R04_CLOSURE_TRIGGER_ROSTER_INCOMPLETE');
  for (const { relation, value } of triggers) {
    const witnesses = schemaCapture.trigger_roster.filter(t => t.relation === relation && t.trigger === value[0]);
    assert.equal(witnesses.length, 1, 'R04_CLOSURE_TRIGGER_WITNESS_MISSING');
    assert.equal(witnesses[0].body_md5, value[2], 'R04_CLOSURE_TRIGGER_WITNESS_MISMATCH');
  }
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

    // The live schema digest also includes direct trigger-function bodies.
    // Body-only DDL preserves columns/constraints/trigger definitions, but does
    // NOT preserve this digest when one of those trigger bodies changes.
    for (const target of schemaCapture.trigger_roster.filter(t => t.signature === post.signature)) {
      assert.equal(target.body_md5, live.body_md5, 'R04_CLOSURE_TRIGGER_PREIMAGE_CHANGED');
      const table = schemaAfter.find(t => t.table === target.relation);
      const trigger = table?.triggers?.find(t => t[0] === target.trigger);
      assert.ok(trigger, 'R04_CLOSURE_TRIGGER_MISSING');
      assert.equal(trigger[2], live.body_md5, 'R04_CLOSURE_TRIGGER_BODY_MISMATCH');
      // Preserve PostgreSQL's canonical JSONB bytes; change only the exact
      // witnessed trigger tuple, never every occurrence of a shared body hash.
      const tuple = value => '[' + value.map(x => JSON.stringify(x)).join(', ') + ']';
      const before = tuple(trigger);
      trigger[2] = post.body_md5;
      schemaInput = replaceOnce(schemaInput, before, tuple(trigger));
    }

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
  assert.deepEqual(JSON.parse(schemaInput), schemaAfter, 'R04_CLOSURE_UNEXPECTED_SCHEMA_DELTA');
  const schema = hash(schemaInput);
  const erasure = hash(erasureInput);
  sourceInput = replaceOnce(sourceInput, preimageClosure.schema, schema);
  sourceInput = replaceOnce(sourceInput, preimageClosure.erasure, erasure);
  // Retain the existing certificate, false readiness and NULL bindings verbatim.
  return { ...preimageClosure, schema, erasure, source: hash(sourceInput) };
}
