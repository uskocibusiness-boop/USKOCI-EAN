import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkerAreas } from '../../functions/_shared/workerAreaResolver.mjs';

const city = (query) => ({ kind: 'CITY', countryCode: 'RS', query, radiusKm: null });
const places = [city('Novi Sad'), city('Beograd'), city('Cacak')];
const detail = {
  'Novi Sad': { city: 'Novi Sad', id: '10001', lat: '45.267', lon: '19.833' },
  Beograd: { city: 'Beograd', id: '10002', lat: '44.817', lon: '20.467' },
  Cacak: { city: 'Čačak', id: '10003', lat: '43.891', lon: '20.349' },
};
function responseFor(url) {
  const u = new URL(url);
  assert.equal(u.origin, 'https://eu1.locationiq.com');
  assert.equal(u.pathname, '/v1/search');
  assert.equal(u.searchParams.get('key'), 'SYNTHETIC_TOKEN');
  assert.equal(u.searchParams.get('countrycodes'), 'rs');
  const p = detail[u.searchParams.get('q')];
  assert.ok(p, 'lookup only the user-stated localities');
  return { ok: true, status: 200, data: [{ type: 'city', class: 'place', osm_type: 'relation',
    osm_id: p.id, lat: p.lat, lon: p.lon, address: { country_code: 'rs', city: p.city } }] };
}
const execute = (requests, requestJson, opts = {}) => resolveWorkerAreas(requests, {
  token: 'SYNTHETIC_TOKEN', requestJson, signal: opts.signal ?? new AbortController().signal,
  ownedAreas: opts.ownedAreas ?? [],
});

test('three declared cities resolve atomically without a 3-request LocationIQ burst', async () => {
  const starts = [];
  const provider = async (url) => {
    const now = Date.now();
    starts.push(now);
    if (starts.filter(start => now - start < 1000).length > 2) return {ok: false, status: 429, data: {error: 'Rate Limited Second'}};
    return responseFor(url);
  };
  const areas = await execute(places, provider);
  assert.deepEqual(areas.map(a => a.city), ['Novi Sad', 'Beograd', 'Čačak']);
  assert.deepEqual(areas.map(a => a.sourceRef), ['osm:relation:10001','osm:relation:10002','osm:relation:10003']);
  assert.deepEqual(areas.map(a => a.radiusKm), [null,null,null]);
  assert.equal(starts.length, 3, 'no model or extra provider calls');
  assert.ok(starts[1] - starts[0] >= 520, 'second provider call must be spaced');
  assert.ok(starts[2] - starts[1] >= 520, 'third provider call must be spaced');
});

test('one transient provider HTTP 429 receives one bounded geocoder-only retry', async () => {
  const started = [];
  const area = await execute([city('Beograd')], async (url) => {
    started.push(Date.now());
    return started.length === 1 ? {ok: false, status: 429, data: {}} : responseFor(url);
  });
  assert.equal(area[0].city, 'Beograd');
  assert.equal(started.length, 2);
  assert.ok(started[1] - started[0] >= 1000);
});

test('non-rate-limit provider refusal fails closed without retries or partial work areas', async () => {
  let calls = 0;
  await assert.rejects(execute([city('Novi Sad'),city('Beograd')], async () => {
    calls++;
    return {ok: false, status: 401, data: {}};
  }), /WORKER_AREA_UNAVAILABLE/);
  assert.equal(calls, 1);
});

test('an already-owned canonical city is reused without new provider traffic', async () => {
  const owned = [{kind:'CITY',countryCode:'RS',city:'Novi Sad',label:'Novi Sad',sourceRef:'osm:relation:10001',latitude:45.27,longitude:19.83,radiusKm:null}];
  const result = await execute([city('Novi Sad')], async () => {throw Error('Must not make provider request');}, {ownedAreas: owned});
  assert.deepEqual(result,owned);
});

test('an aborted wait makes no further lookup and never admits a partial city list', async () => {
  const abort = new AbortController();
  let calls = 0;
  await assert.rejects(execute(places, async (url) => {
    calls++;
    if(calls===1) {setTimeout(()=>abort.abort(),40); return responseFor(url);}
    return responseFor(url);
  },{signal:abort.signal}),/WORKER_AI_CANCELLED/);
  assert.equal(calls,1);
});

test('country-only scope stays free of LocationIQ lookup and location guessing', async () => {
  const result=await execute([{kind:'COUNTRY',countryCode:'RS',query:'',radiusKm:null}],
    async()=>{throw Error('No provider call allowed');});
  assert.deepEqual(result,[{kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null}]);
});
