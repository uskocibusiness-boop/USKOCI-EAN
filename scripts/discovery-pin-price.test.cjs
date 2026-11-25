'use strict';
// Owner, 25.11.2026 („Dozvoli cenu na pinu“): a task pin shows its price from the list item with the same ID and the same public point.
const test=require('node:test'),assert=require('node:assert/strict');
const {createHarness}=require('./ux-component-harness.cjs');
const h=createHarness();
const {discoveryV1PinPrice:price}=h.load('src/data/discoveryV1ServerMarkerPresentation.ts');
const ID='00000000-0000-4000-8000-000000000001';
const marker=(over={})=>({kind:'TASK',key:`task:${ID}`,taskId:ID,point:{lat:45.25,lng:19.84},...over});
const item=(over={})=>({id:ID,rezimLokacije:'STATIONARY',priblizno:{lat:45.25,lng:19.84},rezimCene:'MY_PRICE',osnovaCene:'TOTAL',
  ponudjenaCena:{iznos:3000,valuta:'RSD',prikaz:'3.000 RSD'},...over});
test('a set price shows its amount, an hourly one says /sat',()=>{
  assert.equal(price(marker(),item()),'3.000 RSD');
  assert.equal(price(marker(),item({osnovaCene:'HOURLY',ponudjenaCena:{iznos:800,valuta:'RSD',prikaz:'800 RSD'}})),'800 RSD/sat');
});
test('a task waiting for offers says Ponude',()=>{assert.equal(price(marker(),item({rezimCene:'OFFERS',ponudjenaCena:undefined})),'Ponude');});
test('no price without the same task, the same point or a valid amount',()=>{
  assert.equal(price(marker(),undefined),null);
  assert.equal(price(marker({taskId:'other'}),item()),null);
  assert.equal(price(marker({point:{lat:44.8,lng:20.4}}),item()),null);
  assert.equal(price(marker({kind:'PLACE'}),item()),null);
  assert.equal(price(marker(),item({ponudjenaCena:{iznos:-5,valuta:'RSD',prikaz:''}})),null);
  assert.equal(price(marker(),item({ponudjenaCena:{iznos:30,valuta:'EUR',prikaz:'30 EUR'}})),null);
});
