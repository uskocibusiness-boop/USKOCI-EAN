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

  // Owner, 23.11.2026: the server no longer counts places in the person's words; Gemini sends the complete list.
  it('asks which places to keep when the area list itself is over the limit', () => {
    const output = {
      safety: 'ALLOW',
      assistantMessage: 'Zabeležio sam gradove.',
      patch: { bio: 'Radim selidbe u Novom Sadu i Beogradu.', skills: ['Selidbe'], areaRequests: many.map(area) },
    };
    const result = guardWorkerAreaOutput(output, 'Radim u ' + many.join(', ') + '.', { candidate: { skills: ['Selidbe'], workAreas: [] } });
    assert.equal(result.safety, 'CLARIFY');
    assert.equal(Object.hasOwn(result.patch, 'areaRequests'), false);
    assert.equal(Object.hasOwn(result.patch, 'bio'), false);
    assert.deepEqual(result.patch.skills, ['Selidbe']);
    assert.match(result.assistantMessage, new RegExp(`najviše ${WORKER_AREA_LIMIT} mesta`, 'u'));
  });

  it('a distance nobody said is not saved; a said distance is', () => {
    const output = km => ({ safety: 'ALLOW', assistantMessage: 'Zabeležio sam.', patch: { skills: ['Selidbe'],
      areaRequests: [{ kind: 'RADIUS', countryCode: 'RS', query: 'Novi Sad', radiusKm: km }] } });
    const context = { candidate: { skills: ['Selidbe'], workAreas: [] } };
    const invented = guardWorkerAreaOutput(output(50), 'Novi Sad i okolina', context);
    assert.equal(invented.safety, 'CLARIFY');
    assert.equal(Object.hasOwn(invented.patch, 'areaRequests'), false);
    const said = guardWorkerAreaOutput(output(30), 'Novi Sad i 30 km oko njega', context);
    assert.equal(said.patch.areaRequests[0].radiusKm, 30);
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

describe('Live round 23.11.2026: words that are not places never become cities', () => {
  it('"Radim i SEO optimizaciju" adds no areas', () => {
    const output = { safety: 'ALLOW', assistantMessage: 'Dodao sam SEO optimizaciju.', patch: { skills: ['Izrada sajtova', 'SEO optimizacija'] } };
    const result = guardWorkerAreaOutput(output, 'Radim i SEO optimizaciju', { candidate: { skills: ['Izrada sajtova'], workAreas: [] } });
    assert.equal(Object.hasOwn(result.patch, 'areaRequests'), false);
  });
  it('places come from Gemini\'s list; the server does not build them from words', () => {
    const fromText = guardWorkerAreaOutput({ safety: 'ALLOW', assistantMessage: 'Zabeležio sam.', patch: { skills: ['Krečenje'] } },
      'Sombor i Apatin', { candidate: { skills: ['Krečenje'], workAreas: [] } });
    assert.equal(Object.hasOwn(fromText.patch, 'areaRequests'), false);
    const listed = { safety: 'ALLOW', assistantMessage: 'Zabeležio sam Sombor i Apatin.', patch: { skills: ['Krečenje'], areaRequests: [area('Sombor'), area('Apatin')] } };
    assert.deepEqual(guardWorkerAreaOutput(listed, 'Sombor i Apatin', { candidate: { skills: ['Krečenje'], workAreas: [] } }), listed);
  });
});
