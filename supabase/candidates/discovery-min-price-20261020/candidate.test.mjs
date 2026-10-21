import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyEdits, beforeBody, beforeDefinition, buildCandidate, digest, edits, predecessor } from './build-candidate.mjs';

test('candidate has the exact captured DEV predecessor and reproducible guarded payload', () => {
  assert.equal(digest(beforeBody), predecessor.body_md5);
  assert.equal(readFileSync(new URL('./candidate.sql', import.meta.url), 'utf8').replace(/\r\n/g,'\n'), buildCandidate());
  assert.equal(predecessor.security_definer, false);
  assert.deepEqual(predecessor.proconfig, ['search_path=pg_catalog']);
  assert.equal(predecessor.acl, '{postgres=X/postgres,authenticated=X/postgres}');
});

test('six targeted edits are reversible with no unrelated function-body changes', () => {
  let body = applyEdits(beforeBody);
  for (const edit of [...edits].reverse()) {
    assert.equal(body.split(edit.after).length, 2, edit.name);
    body = body.replace(edit.after, edit.before);
  }
  assert.equal(body, beforeBody);
  assert.throws(() => applyEdits(beforeBody.replace(edits[0].before, 'changed declaration')), /ANCHOR_DRIFT/);
  assert.throws(() => applyEdits(beforeBody + edits[4].before), /ANCHOR_DRIFT/);
});

test('EXACT_PUBLIC request handling and old base-filter serialization remain unchanged', () => {
  const after = applyEdits(beforeBody);
  const exact = body => body.slice(body.indexOf(" if request_mode='EXACT_PUBLIC' then"),body.indexOf(" elsif request_mode='PAGE' then"));
  assert.equal(exact(after), exact(beforeBody));
  const canonical = body => body.slice(body.indexOf(" f:=jsonb_build_object('text',query_text"),body.indexOf(' if for_me then f:='));
  assert.equal(canonical(after), canonical(beforeBody));
  assert.ok(after.includes("if min_budget_rsd is not null then f:=f||jsonb_build_object('minBudgetRsd',min_budget_rsd); end if;"));
  assert.equal(beforeDefinition.includes('SECURITY DEFINER'),false);
});

test('both independent memberships use the same inclusive numeric predicate before aggregate/paging', () => {
  const after = applyEdits(beforeBody);
  assert.equal(after.split('requester_price_rsd>=min_budget_rsd').length-1,2);
  assert.ok(after.indexOf('n.requester_price_rsd>=min_budget_rsd') < after.indexOf('), place_wanted as'));
  assert.ok(after.indexOf('b.requester_price_rsd>=min_budget_rsd') < after.indexOf("'priceMode',s.mode"));
  assert.ok(after.indexOf("if jsonb_typeof(f->'minBudgetRsd') is distinct from 'number'") < after.indexOf("min_budget_rsd:=(f->>'minBudgetRsd')::integer"));
  assert.ok(after.includes("or f->>'price' not in ('all','MY_PRICE')"));
  assert.ok(after.includes("(f->>'minBudgetRsd')::numeric not between 1 and 2147483647"));
});

test('PLACES and PAGE/MAP retain offers in all mode and apply the same minimum only to fixed prices', () => {
  const after = applyEdits(beforeBody);
  for (const alias of ['n','b']) {
    assert.ok(after.includes(`(price='all' or ${alias}.mode=price)`));
    assert.ok(after.includes(`(min_budget_rsd is null or ${alias}.mode='OFFERS' or (${alias}.mode='MY_PRICE' and ${alias}.requester_price_rsd>=min_budget_rsd))`));
  }
});
