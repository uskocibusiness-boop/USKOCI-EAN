'use strict';
// Owner, 26.11.2026: a person who named only a day reads only that day; a from-to keeps its times; only "do" or "od" stay as said.
const test=require('node:test'),assert=require('node:assert/strict');
const {createHarness}=require('./ux-component-harness.cjs');
const h=createHarness();
const {needScheduleText:text}=h.load('src/data/needDetailPresentation.ts');
const {fixedRange}=h.load('src/ui/v2/draftSummary.ts');
const now=new Date('2026-11-26T12:00:00Z');
test('a named day alone is that day, never 00:00 - 00:00 or an invented whole day',()=>{
  const v=text({kind:'FIXED_WINDOW',startsAt:'2026-11-28T00:00:00+01:00',endsAt:'2026-11-29T00:00:00+01:00'},'Europe/Belgrade',now);
  assert.ok(!v.includes('00:00'),v); assert.ok(!/ceo dan/.test(v),v); assert.match(v,/28\. nov/);
  const card=fixedRange('2026-11-28T00:00:00+01:00','2026-11-29T00:00:00+01:00');
  assert.ok(card && !card.includes('00:00') && /28\. nov/.test(card),card);
});
test('a day with hours keeps its hours',()=>{
  const v=text({kind:'FIXED_WINDOW',startsAt:'2026-11-28T09:00:00+01:00',endsAt:'2026-11-28T13:00:00+01:00'},'Europe/Belgrade',now);
  assert.match(v,/09:00/); assert.match(v,/13:00/);
});
