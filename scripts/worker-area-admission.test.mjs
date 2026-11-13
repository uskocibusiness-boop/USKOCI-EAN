import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { guardWorkerAreaOutput } from '../supabase/functions/_shared/workerAreaAdmission.mjs';

const area = city => ({ kind: 'CITY', countryCode: 'RS', query: city, radiusKm: null });

describe('Worker area admission respects the five-area limit without silent loss', () => {
  it('asks which cities to keep when the user names six but the model proposes only five', () => {
    const output = {
      safety: 'ALLOW',
      assistantMessage: 'Zabeležio sam gradove.',
      patch: {
        bio: 'Radim selidbe u Novom Sadu, Beogradu, Nišu, Kragujevcu, Subotici i Pančevu.',
        skills: ['Selidbe'],
        areaRequests: ['Novi Sad', 'Beograd', 'Niš', 'Kragujevac', 'Subotica'].map(area),
      },
    };
    const context = { candidate: { skills: ['Selidbe'], workAreas: [] } };
    const result = guardWorkerAreaOutput(output,
      'Radim u Novom Sadu, Beogradu, Nišu, Kragujevcu, Subotici i Pančevu.', context);

    assert.equal(result.safety, 'CLARIFY');
    assert.equal(Object.hasOwn(result.patch, 'areaRequests'), false);
    assert.equal(Object.hasOwn(result.patch, 'bio'), false);
    assert.deepEqual(result.patch.skills, ['Selidbe']);
    assert.match(result.assistantMessage, /najviše pet gradova/u);
  });

  it('asks which existing city to replace instead of silently dropping an added sixth city', () => {
    const existing = ['Novi Sad', 'Beograd', 'Niš', 'Kragujevac', 'Subotica'].map(city => ({
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
    assert.match(result.assistantMessage, /Koji grad želite da zamenite/u);
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
