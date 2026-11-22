import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { guardWorkerAreaOutput } from '../supabase/functions/_shared/workerAreaAdmission.mjs';
import { WORKER_AREA_LIMIT } from '../supabase/functions/_shared/workerRegions.mjs';

const area = city => ({ kind: 'CITY', countryCode: 'RS', query: city, radiusKm: null });
// Distinct capitalized place names, more than the area limit.
const many = Array.from({ length: WORKER_AREA_LIMIT + 1 }, (_, i) => `Mesto${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`);

describe('Worker area admission respects the area limit without silent loss', () => {
  it('six cities are a normal list now (owner decision 22.11.2026: no five-city limit)', () => {
    const six = ['Novi Sad', 'Beograd', 'Niš', 'Kragujevac', 'Subotica', 'Pančevo'];
    const output = { safety: 'ALLOW', assistantMessage: 'Zabeležio sam gradove.', patch: { skills: ['Selidbe'], areaRequests: six.map(area) } };
    const result = guardWorkerAreaOutput(output, 'Radim u Novom Sadu, Beogradu, Nišu, Kragujevcu, Subotici i Pančevu.',
      { candidate: { skills: ['Selidbe'], workAreas: [] } });
    assert.deepEqual(result, output);
  });

  it('a region is kept as a region and never widened to all of Serbia', () => {
    const output = { safety: 'ALLOW', assistantMessage: 'Zabeležio sam celu Vojvodinu.', patch: { skills: ['Krečenje'],
      areaRequests: [{ kind: 'REGION', countryCode: 'RS', query: 'RS-VO', radiusKm: null }] } };
    const result = guardWorkerAreaOutput(output, 'Radim po celoj Vojvodini', { candidate: { skills: ['Krečenje'], workAreas: [] } });
    assert.deepEqual(result, output);
    const silent = guardWorkerAreaOutput({ safety: 'ALLOW', assistantMessage: 'U redu.', patch: { skills: ['Krečenje'] } },
      'Radim po celoj Vojvodini', { candidate: { skills: ['Krečenje'], workAreas: [] } });
    assert.equal((silent.patch.areaRequests ?? []).some(a => a.kind === 'COUNTRY'), false);
  });

  it('asks which places to keep when the user names more than the limit but the model proposes fewer', () => {
    const output = {
      safety: 'ALLOW',
      assistantMessage: 'Zabeležio sam gradove.',
      patch: {
        bio: 'Radim selidbe u Novom Sadu, Beogradu, Nišu, Kragujevcu, Subotici i Pančevu.',
        skills: ['Selidbe'],
        areaRequests: many.slice(0, WORKER_AREA_LIMIT).map(area),
      },
    };
    const context = { candidate: { skills: ['Selidbe'], workAreas: [] } };
    const result = guardWorkerAreaOutput(output, 'Radim u ' + many.join(', ') + '.', context);

    assert.equal(result.safety, 'CLARIFY');
    assert.equal(Object.hasOwn(result.patch, 'areaRequests'), false);
    assert.equal(Object.hasOwn(result.patch, 'bio'), false);
    assert.deepEqual(result.patch.skills, ['Selidbe']);
    assert.match(result.assistantMessage, new RegExp(`najviše ${WORKER_AREA_LIMIT} mesta`, 'u'));
  });

  it('asks which existing place to replace instead of silently dropping one over the limit', () => {
    const existing = many.slice(0, WORKER_AREA_LIMIT).map(city => ({
      kind: 'CITY', countryCode: 'RS', city, radiusKm: null,
    }));
    const output = {
      safety: 'ALLOW', assistantMessage: 'Dodat je Novi Pazar.',
      patch: { displayName: 'Milan', bio: 'Pouzdan sam.' },
    };
    const context = { candidate: { skills: ['Selidbe'], location: { city: 'Novi Sad' }, workAreas: existing } };
    const result = guardWorkerAreaOutput(output, 'Dodaj i Novi Pazar', context);

    assert.equal(result.safety, 'CLARIFY');
    assert.equal(Object.hasOwn(result.patch, 'areaRequests'), false);
    assert.deepEqual(result.patch, { displayName: 'Milan', bio: 'Pouzdan sam.' });
    assert.match(result.assistantMessage, /Koje želite da zamenite/u);
  });

  it('keeps an explicit valid multi-city proposal unchanged', () => {
    const output = { safety: 'ALLOW', assistantMessage: 'Ažurirano.', patch: {
      areaRequests: ['Novi Sad', 'Beograd'].map(area),
    } };
    const result = guardWorkerAreaOutput(output, 'Radim u Novom Sadu i Beogradu',
      { candidate: { skills: ['Selidbe'], workAreas: [] } });
    assert.deepEqual(result, output);
  });
});
