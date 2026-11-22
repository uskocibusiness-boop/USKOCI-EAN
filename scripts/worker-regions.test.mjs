import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WORKER_REGIONS, WORKER_AREA_LIMIT } from '../supabase/functions/_shared/workerRegions.mjs';
import { WORKER_REGIONS as APP_REGIONS, WORKER_AREA_LIMIT as APP_LIMIT } from '../src/contracts/workerRegions.ts';
import { parseWorkerAreaRequests, resolveWorkerAreas, workerAreaRequestSchema } from '../supabase/functions/_shared/workerAreaResolver.mjs';
import { decodeWorkerAreas } from '../src/contracts/workerAreas.ts';

const migration = fs.readFileSync(new URL('../supabase/migrations/20261122084958_worker_regions_districts_unlimited_areas.sql', import.meta.url), 'utf8');
const region = code => ({ kind: 'REGION', countryCode: 'RS', label: WORKER_REGIONS[code], city: null, sourceRef: `region:${code}`, latitude: null, longitude: null, radiusKm: null });
const noLookup = { token: null, requestJson: () => { throw Error('a region never calls the geocoder'); }, signal: new AbortController().signal };

describe('Worker regions (owner decision 22.11.2026)', () => {
  it('app, server and database use the same region codes and labels', () => {
    assert.deepEqual(APP_REGIONS, WORKER_REGIONS);
    assert.equal(APP_LIMIT, WORKER_AREA_LIMIT);
    for (const [code, label] of Object.entries(WORKER_REGIONS)) {
      assert.ok(migration.includes(`when '${code}' then '${label}'`), `label ${code}`);
      const district = /^RS-(0[1-9]|1[0-9]|2[0-4])$/.test(code);
      assert.ok(district || migration.includes(`when '${code}' then array[`), `districts ${code}`);
    }
    assert.ok(migration.includes('jsonb_array_length(areas)>' + WORKER_AREA_LIMIT));
  });

  it('a region is parsed and resolved locally, without the geocoder', async () => {
    assert.ok(workerAreaRequestSchema.items.properties.kind.enum.includes('REGION'));
    const resolved = await resolveWorkerAreas([
      { kind: 'REGION', countryCode: 'RS', query: 'RS-VO', radiusKm: null },
      { kind: 'REGION', countryCode: 'RS', query: 'RS-08', radiusKm: null },
      { kind: 'CITY', countryCode: 'RS', query: 'Beograd', radiusKm: null },
    ], noLookup);
    assert.deepEqual(resolved.slice(0, 2), [region('RS-VO'), region('RS-08')]);
    assert.equal(resolved[0].label, 'Cela Vojvodina');
    assert.ok(decodeWorkerAreas(resolved));
  });

  it('an unknown code, a radius on a region or a duplicate region is rejected', async () => {
    for (const bad of [{ query: 'RS-XX', radiusKm: null }, { query: 'Vojvodina', radiusKm: null }, { query: 'RS-VO', radiusKm: 20 }])
      assert.throws(() => parseWorkerAreaRequests([{ kind: 'REGION', countryCode: 'RS', ...bad }]), /WORKER_AREA_INVALID/);
    await assert.rejects(resolveWorkerAreas([
      { kind: 'REGION', countryCode: 'RS', query: 'RS-VO', radiusKm: null },
      { kind: 'REGION', countryCode: 'RS', query: 'RS-VO', radiusKm: null }], noLookup), /WORKER_AREA_INVALID/);
  });

  it('the app accepts a region and many places, and rejects a forged label', () => {
    assert.deepEqual(decodeWorkerAreas([region('RS-SREM')]), [region('RS-SREM')]);
    assert.equal(decodeWorkerAreas([{ ...region('RS-VO'), label: 'Vojvodina' }]), null);
    assert.equal(decodeWorkerAreas([{ ...region('RS-VO'), sourceRef: 'region:RS-XX' }]), null);
    const many = Object.keys(WORKER_REGIONS).map(region);
    assert.equal(decodeWorkerAreas(many)?.length, many.length);
    assert.equal(decodeWorkerAreas(Array.from({ length: WORKER_AREA_LIMIT + 1 }, () => region('RS-VO'))), null);
  });
});
