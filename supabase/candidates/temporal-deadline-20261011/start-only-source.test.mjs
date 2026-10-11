import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(repo,path),'utf8');
const dir = 'supabase/candidates/temporal-deadline-20261011/';
test('AI fixed beginning never demands a made-up ending', () => {
  const ai = read('supabase/functions/uskoci-ai-interview/index.ts');
  assert.ok(ai.includes('FIXED_WINDOW zahteva potvrđen starts_at'));
  assert.ok(ai.includes('ends_at je opcion'));
  assert.ok(ai.includes("['need.starts_at'] : []"));
  assert.ok(!ai.includes('FIXED_WINDOW zahteva i starts_at i ends_at'));
});

test('typed task projections allow a missing end, human copy says so', () => {
  const projection = read('src/contracts/projections.ts');
  assert.ok(projection.includes('endsAt: string | null'));
  const copy = read('src/data/aiNeedV2Production.ts');
  assert.ok(copy.includes('Kraj je opcioni'));
  const presentation = read('src/data/needDetailPresentation.ts');
  assert.ok(presentation.includes("'Početak' : 'Od'"));
  const evaluation = read('supabase/functions/uskoci-publication-evaluate/index.ts');
  assert.ok(evaluation.includes('(value.endsAt !== null && !time(value.endsAt))'));
});

test('existing SQL APIs all have isolated source-pinned candidates', () => {
 const bodies = [
  ['start-only-save.candidate.sql','START_ONLY_SAVE_SOURCE_DRIFT','v_ends_at is not null'],
  ['start-only-edit.candidate.sql','START_ONLY_EDIT_SOURCE_DRIFT','v_ends_at is not null'],
  ['start-only-submit.candidate.sql','START_ONLY_SUBMIT_SOURCE_DRIFT','n.ends_at is not null'],
  ['start-only-select.candidate.sql','START_ONLY_SELECT_SOURCE_DRIFT','v_need.ends_at is not null'],
  ['start-only-stale.candidate.sql','START_ONLY_STALE_SOURCE_DRIFT','v_need.ends_at is not null'],
  ['start-only-candidate-states.candidate.sql','START_ONLY_CANDIDATE_STATES_SOURCE_DRIFT','s:=null; e:=null;'],
  ['start-only-candidate-states-batch.candidate.sql','START_ONLY_CANDIDATE_STATES_SOURCE_DRIFT','s:=null; e:=null;']
 ];
 for(const [file,guard,semantic] of bodies){
  const src = read(dir+file);
  assert.ok(src.includes(guard),file+' missing predecessor guard');
  assert.ok(src.includes(semantic),file+' missing start-only semantic gate');
  assert.ok(src.includes('BEGIN;') && src.includes('COMMIT;'),file+' lacks one-transaction guard');
  assert.ok(!/\\b(?:create|alter|drop|truncate)\\s+table\\b/i.test(src),file+' cannot change schema');
 }
});

test('Dogovor snapshots the declared start without fabricating a booking', () => {
  const sql = read(dir+'start-only-select.candidate.sql');
  const ui = read('src/data/agreementClientService.ts');
  assert.ok(sql.includes("jsonb_build_object('declared_start_at',v_need.starts_at)"));
  assert.ok(sql.includes("WORKER_CALENDAR_CONFLICT"));
  assert.ok(sql.includes("interval '1 microsecond'"));
  assert.ok(sql.includes("v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null"));
  assert.ok(ui.includes("terms.declared_start_at"));
  assert.ok(ui.includes("trajanje po dogovoru"));
  assert.ok(read('src/data/__tests__/agreement-exact-window-mapping.test.ts').includes('preserves a declared start-only task'));
});

test('matching proves exact start instant without manufacturing duration', () => {
 const matcher=read(dir+'worker-time-tier.candidate.sql');
 const revert=read(dir+'worker-time-tier.revert.sql');
 const assertSql=read(dir+'worker-time-tier.assert.sql');
 assert.ok(matcher.includes("n.schedule_kind='FIXED_WINDOW' and n.starts_at is not null and n.ends_at is null"));
 assert.ok(matcher.includes("periods @> n.starts_at"));
 assert.ok(matcher.includes('PARTIAL_PERIOD_START_AVAILABLE'));
 assert.ok(matcher.includes("n.starts_at<ws or n.starts_at>=we"));
 assert.ok(matcher.includes("greatest(n.starts_at,at_now),we"));
 for(const marker of ['TOMORROW_PARTIAL_NO_SCHEDULE_REFUSED','TOMORROW_PARTIAL_BEFORE_START_REFUSED','TOMORROW_PARTIAL_AFTER_START_ADMITTED','TOMORROW_PARTIAL_OUTSIDE_DAY_REFUSED']){
  assert.ok(assertSql.includes(marker),marker);
 }
 assert.ok(matcher.includes("interval '1 second'"));
 assert.ok(matcher.includes('e93886f2bcd48cc287c713f74e797224'));
 assert.ok(revert.includes('e93886f2bcd48cc287c713f74e797224'));
 for(const marker of ['START_ONLY_AVAILABLE_NOW_NOT_FUTURE_PROOF','START_ONLY_KNOWN_FREE_INSTANT','START_ONLY_BLOCKED_AT_BEGINNING','START_ONLY_PAST_START_CLOSED']){
  assert.ok(assertSql.includes(marker),marker);
 }
});

test('time-elapsed direct API guard closes expired start-only offers and candidates',()=>{
 const submit=read(dir+'start-only-submit.candidate.sql');
 const select=read(dir+'start-only-select.candidate.sql');
 assert.ok(submit.includes("n.starts_at<=statement_timestamp()"),'submit cannot allow past start');
 assert.ok(select.includes("v_need.starts_at<=statement_timestamp()"),'selection cannot allow past start');
 for(const file of ['start-only-candidate-states.candidate.sql','start-only-candidate-states-batch.candidate.sql']){
  const sql=read(dir+file);
  assert.ok(sql.includes("and n.starts_at<=statement_timestamp()) then 'CLOSED'"),file+' must show CLOSED after the start');
 }
});
