// CANCEL-INFO + PROFILE-TRUST order proof against the three still unapplied candidates ZONE-PERF -> MATCH-V1 -> DISCOVERY-ZAMENE.
// Disposable only (loopback guard), real Auth for the seed, every read evaluated as an authenticated account in SQL. Never DEV.
//   A  the chain with the DEV bodies + the D12 read surface (DEV before 2026-10-07 19:22): CANCEL-INFO, PROFILE-TRUST apply; exact revert.
//   D  canonical DEV since 2026-10-07 19:22: ZONE-PERF applied alone; ours apply, answer the same, revert to exactly that state.
//   B  the three first, then CANCEL-INFO + PROFILE-TRUST: the delta is exactly this package's; revert ours -> the three-applied catalog; revert the three -> base.
//   C  CANCEL-INFO + PROFILE-TRUST first, then the three: revert the three -> our catalog; revert ours -> base.
// In every state the four reads answer byte for byte the same (asOf aside), and the closure certificate never moves.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as rtModule from '../pre_v3/closure_runtime.mjs';
import {createFixtures, weeklyRule} from '../ex06/lib/fixtures.mjs';
import {assert, sql, rows, q, randomUUID, CI, PT, ZP, MV, DZ, ciManifest, ptManifest, out, psqlFile, refused, asAccountValue,
  catalog, closure, conflicts40001, applied, absent, makeReport, stripVolatile, firstDifference} from './lib.mjs';

const {report, write, pass, fail, check, bypass} = makeReport('CANCEL_INFO_AND_PROFILE_TRUST_ORDER', 'order-report.json');
const surface = JSON.parse(fs.readFileSync(path.join(out, 'surface-report.json'), 'utf8'));
assert.equal(surface.result, 'PASS');
const zManifest = JSON.parse(fs.readFileSync(ZP + 'manifest.json', 'utf8'));
const mManifest = JSON.parse(fs.readFileSync(MV + 'manifest.json', 'utf8'));
const dManifest = JSON.parse(fs.readFileSync(DZ + 'manifest.json', 'utf8'));
const zApplied = () => zManifest.functions.every(f => sql(`select coalesce(md5(prosrc),'') from pg_proc where oid=to_regprocedure(${q(f.signature)})`) === f.after_md5);
const mApplied = () => mManifest.newFunctions.every(f => sql(`select to_regprocedure(${q(f.signature)}) is not null`) === 't');
const dApplied = () => dManifest.newFunctions.every(f => sql(`select to_regprocedure(${q(f.signature)}) is not null`) === 't');
const fx = createFixtures(rtModule, {needPath: 'direct'});
const ok = async (account, name, args) => { const r = await account.client.rpc(name, args); assert.ok(!r.error, name + ':' + JSON.stringify(r.error)); return r.data; };

let base = null, baseClosure = null;
const applyOurs = () => { psqlFile(CI + 'candidate.sql'); psqlFile(PT + 'candidate.sql'); assert.ok(applied(ciManifest) && applied(ptManifest)); };
const revertOurs = () => { psqlFile(PT + 'revert.sql'); psqlFile(CI + 'revert.sql'); assert.ok(absent(ciManifest) && absent(ptManifest)); };
const applyThree = () => { psqlFile(ZP + 'candidate.sql'); psqlFile(MV + 'candidate.sql'); psqlFile(DZ + 'candidate.sql'); assert.ok(zApplied() && mApplied() && dApplied()); };
const revertThree = () => { psqlFile(DZ + 'revert.sql'); psqlFile(MV + 'revert.sql'); psqlFile(ZP + 'revert.sql'); assert.ok(!zApplied() && !mApplied() && !dApplied()); };
try {
  fx.pauseSchedulers();
  base = catalog(); baseClosure = closure();
  const base40001 = conflicts40001();
  assert.equal(baseClosure.ready, true);
  assert.ok(absent(ciManifest) && absent(ptManifest) && !zApplied() && !mApplied() && !dApplied(), 'A_CANDIDATE_IS_ALREADY_APPLIED_ON_THE_CHAIN');

  // a small realistic seed: one requester, one worker, a completed, a cancelled and an open Dogovor, one commented review
  const skill = 'pto-' + randomUUID().slice(0, 8);
  const ra = await fx.createRequester({label: 'pto-ra'});
  const w = await fx.createWorker({label: 'pto-w', displayName: 'PTO radnik', skills: [skill], radiusKm: 50, location: {city: 'Novi Sad'},
    availability: {timezone: 'Europe/Belgrade', availableNow: true,
      rules: [weeklyRule(randomUUID(), {weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '24:00', label: 'PTO'})], windows: []}});
  const made = [];
  for (let i = 0; i < 3; i++) {
    const need = await fx.createNeedFromFacts(ra, {'need.title': 'PTO zadatak ' + i, 'need.description': 'Sinteticki zadatak PROFILE-TRUST order dokaza.',
      'need.category': 'PTO dokaz', 'need.required_skills': [skill], 'need.required_tools': [], 'need.required_vehicles': [], 'need.minimum_experience_years': 0,
      'need.people_needed': 1, 'need.schedule_kind': 'FLEXIBLE', 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}},
      'need.price_mode': 'OFFERS', 'need.task_country_code': 'RS'}, {path: 'direct'});
    const application = await fx.submitApplication(w, need, {price: 2500});
    assert.ok(application.ok, JSON.stringify(application.error));
    made.push(await fx.selectResponse(ra, need, application.data));
  }
  await ok(w, 'rpc_mark_work_done', {p_agreement_id: made[0]});
  await ok(ra, 'rpc_confirm_completion', {p_agreement_id: made[0]});
  await ok(w, 'rpc_cancel_agreement', {p_agreement_id: made[1], p_reason: 'PTO razlog otkazivanja.'});
  const receipt = await ok(ra, 'rpc_submit_agreement_review', {p_agreement_id: made[0], p_target_account_id: w.id, p_rating: 5, p_tags: ['ON_TIME'], p_client_request_id: randomUUID()});
  const text = 'PTO komentar.';
  sql(`insert into ${surface.d12.base} (review_id, author_account_id, target_account_id, comment, comment_sha256, created_at)
       select id, reviewer_account_id, target_account_id, ${q(text)}, ${q(createHash('sha256').update(text).digest('hex'))}, created_at from private.agreement_reviews where id = ${q(receipt.reviewId)}::uuid`);
  bypass(`${surface.d12.base}: one written comment inserted as the owner`, 'D12 is not replayed by this chain');
  base = catalog();   // the baseline every revert returns to: the chain + surface + seed (the seed writes no function and no config row)
  const smoke = () => stripVolatile({
    trust: asAccountValue(ra.id, `public.rpc_public_work_trust_v1(${q(w.profileId)}::uuid)`),
    trustSelf: asAccountValue(w.id, `public.rpc_public_work_trust_v1(${q(w.profileId)}::uuid)`),
    stats: asAccountValue(w.id, 'public.rpc_my_work_stats_v1()'),
    reviews: asAccountValue(w.id, 'public.rpc_list_received_reviews_v1(20, null)'),
    cancel: asAccountValue(w.id, `public.rpc_agreement_cancellation_v1(array[${made.map(id => q(id) + '::uuid').join(',')}])`),
  });
  const same = (a, b) => firstDifference(a, b) === null;

  // A: today's state
  applyOurs();
  const sA = smoke();
  assert.deepEqual(closure(), baseClosure);
  check('ORDER_A_TODAY_APPLIES_AND_ANSWERS', sA.stats.agreementsMade === 3 && sA.stats.agreementsCompleted === 1 && sA.stats.cancelledByMe === 1 && sA.trust.completedCount === 1
    && sA.reviews.items.length === 1 && sA.reviews.items[0].comment === text && sA.cancel.items.length === 3 && sA.cancel.items[1].cancelledBy === 'WORKER', sA);
  revertOurs();
  check('ORDER_A_TODAY_REVERTS_EXACTLY', catalog() === base && JSON.stringify(closure()) === JSON.stringify(baseClosure), {});

  // D: canonical DEV as it is since 2026-10-07 19:22 (migration 20261007192233): ZONE-PERF applied, MATCH-V1 and DISCOVERY-ZAMENE not
  psqlFile(ZP + 'candidate.sql');
  assert.ok(zApplied() && !mApplied() && !dApplied());
  const zoneOnly = catalog();
  applyOurs();
  const sD = smoke();
  assert.deepEqual(closure(), baseClosure);
  revertOurs();
  const afterOursD = catalog();
  psqlFile(ZP + 'revert.sql');
  check('ORDER_D_TODAYS_DEV_ZONE_PERF_ONLY_SAME_ANSWERS_OUR_REVERT_RESTORES_IT_EXACTLY',
    same(sA, sD) && afterOursD === zoneOnly && catalog() === base && JSON.stringify(closure()) === JSON.stringify(baseClosure), {difference: firstDifference(sA, sD)});

  // B: the three first
  applyThree();
  const three = catalog();
  assert.deepEqual(closure(), baseClosure);
  applyOurs();
  const sB = smoke();
  assert.deepEqual(closure(), baseClosure);
  revertOurs();
  const afterOursB = catalog();
  revertThree();
  check('ORDER_B_THREE_THEN_OURS_SAME_ANSWERS_OUR_REVERT_RESTORES_THE_THREE_STATE_THEIRS_RESTORE_BASE',
    same(sA, sB) && afterOursB === three && catalog() === base && JSON.stringify(closure()) === JSON.stringify(baseClosure), {difference: firstDifference(sA, sB)});

  // C: ours first
  applyOurs();
  const oursOnly = catalog();
  applyThree();
  const sC = smoke();
  assert.deepEqual(closure(), baseClosure);
  refused(fs.readFileSync(CI + 'revert.sql', 'utf8'), 'CANCEL_INFO_REVERT_BLOCKED_BY_PROFILE_TRUST');
  revertThree();
  const afterTheirsC = catalog();
  revertOurs();
  check('ORDER_C_OURS_THEN_THREE_SAME_ANSWERS_THEIR_REVERT_RESTORES_OUR_STATE_OURS_RESTORE_BASE',
    same(sA, sC) && afterTheirsC === oursOnly && catalog() === base && JSON.stringify(closure()) === JSON.stringify(baseClosure) && conflicts40001() === base40001,
    {difference: firstDifference(sA, sC)});
  report.observations.smoke = sA;
  report.observations.zonePerfHelperUntouchedByOurs = true;
} catch (error) {
  fail('ORDER_RUN', String(error?.stack ?? error).slice(0, 2400));
} finally {
  try {
    if (dApplied()) psqlFile(DZ + 'revert.sql');
    if (mApplied()) psqlFile(MV + 'revert.sql');
    if (zApplied()) psqlFile(ZP + 'revert.sql');
    if (applied(ptManifest)) psqlFile(PT + 'revert.sql');
    if (applied(ciManifest)) psqlFile(CI + 'revert.sql');
    if (base) check('ORDER_FINAL_STATE_IS_THE_BASE', catalog() === base && JSON.stringify(closure()) === JSON.stringify(baseClosure), {});
  } catch (error) { fail('ORDER_FINAL_STATE', String(error).slice(0, 600)); }
}
report.result = report.failures.length === 0 ? 'PASS' : 'FAIL';
write();
const lines = ['### CANCEL-INFO + PROFILE-TRUST order proof (ZONE-PERF -> MATCH-V1 -> DISCOVERY-ZAMENE)', '',
  `Result: **${report.result}** - ${report.checks.filter(c => c.result === 'PASS').length} checks passed, ${report.failures.length} failed${report.failures.length ? ': ' + report.failures.map(x => x.name).join(', ') : ''}.`];
fs.writeFileSync(path.join(out, 'order-summary.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exitCode = report.result === 'PASS' ? 0 : 1;
