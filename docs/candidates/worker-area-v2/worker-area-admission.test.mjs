import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyWorkerAreaRequest, guardWorkerAreaOutput } from './workerAreaAdmission.mjs';

const previous = { candidate: { location: { operatingCountryCode: 'RS', city: 'Niš', radiusKm: 20 } } };
const proposed = { assistantMessage: 'Sve je sačuvano za celu Srbiju.', safety: 'ALLOW', patch: {
  location: { operatingCountryCode: 'RS', city: 'Beograd', radiusKm: 200 },
  bio: 'Radim u celoj Srbiji', skills: ['Molerski radovi'],
} };

test('recognizes broad coverage and multiple places without treating locality plus country as multiple cities', () => {
  for (const [input, scope] of [
    ['Cela Srbija', 'COUNTRY'], ['Цела Србија', 'COUNTRY'], ['Radim svuda po Srbiji', 'COUNTRY'],
    ['cela Vojvodina', 'REGION'], ['U celoj Šumadiji', 'REGION'], ['Balkan', 'REGION'],
    ['Novi Sad i Beograd', 'MULTI_LOCALITY'], ['Нови Сад и Београд', 'MULTI_LOCALITY'], ['u Novom Sadu i u Beogradu', 'MULTI_LOCALITY'],
    ['Radim u Novom Sadu i Beogradu', 'MULTI_LOCALITY'], ['Radim Novi Sad i Beograd', 'MULTI_LOCALITY'],
    ['Novi Sad i Beograd za terenski rad, prevod samo online', 'MULTI_LOCALITY'],
    ['Moler u Novom Sadu i Beogradu, ali samo online prevod', 'MULTI_LOCALITY'],
    ['Novi Sad, Beograd', 'MULTI_LOCALITY'], ['više gradova', 'MULTI_LOCALITY'],
    ['Novi Sad i okolina', 'LOCALITY_NEEDS_DISTANCE'],
    ['Prevod samo online; moler Novi Sad i okolina', 'LOCALITY_NEEDS_DISTANCE'],
    ['Ne želim celu Srbiju, samo Novi Sad', 'NONE'],
    ['Radim u celoj Srbiji, ali samo radnim danima', 'COUNTRY'],
    ['Cela Srbija, ali samo ujutru', 'COUNTRY'],
    ['Cela Srbija za molerski rad, ali samo online prevod', 'COUNTRY'],
    ['Živim u Novom Sadu, Vojvodina', 'NONE'],
    ['Radio sam ranije u Novom Sadu i Beogradu, sad radim samo u Nišu', 'NONE'],
    ['Imam porodicu u Novom Sadu i Beogradu, radim samo u Nišu', 'NONE'],
    ['Srbija, Novi Sad', 'NONE'], ['U Srbiji, Beograd', 'NONE'],
    ['Novi Sad i okolina, ali samo za onlajn rad', 'NONE'],
    ['Živim u Novom Sadu i Beogradu, radim samo online', 'NONE'],
    ['Radim samo online u Novom Sadu i okolini', 'NONE'],
    ['Radim po Vojvodini', 'REGION'],
    ['Novi Sad, Srbija, do 30 km', 'NONE'], ['Novi Sad i okolina do 30 km', 'NONE'],
    ['Cela oprema mi je u Novom Sadu, Srbija', 'NONE'],
  ]) assert.equal(classifyWorkerAreaRequest(input), scope, input);
});

test('country/region/multiple-city wish cannot overwrite one active area or enter public bio', () => {
  for (const utterance of ['Cela Srbija', 'cela Vojvodina', 'Novi Sad i Beograd']) {
    const result = guardWorkerAreaOutput(proposed, utterance, previous);
    assert.equal(result.safety, 'CLARIFY');
    assert.equal(result.patch.location, undefined);
    assert.equal(result.patch.bio, undefined);
    assert.deepEqual(result.patch.skills, ['Molerski radovi']);
    assert.match(result.assistantMessage, /ne mogu da sačuvam|mogu da sačuvam samo jedan grad/);
    assert.match(result.assistantMessage, /Dosadašnje područje ostaje isto/);
    assert.deepEqual(proposed.patch.location, { operatingCountryCode: 'RS', city: 'Beograd', radiusKm: 200 });
  }
  const unrelatedBio = guardWorkerAreaOutput({ ...proposed, patch: { ...proposed.patch, bio: 'Molerski radovi.' } },
    'Cela Srbija; bavim se molerskim radovima.', previous);
  assert.equal(unrelatedBio.patch.bio, 'Molerski radovi.');
  const mixedBio = guardWorkerAreaOutput({ ...proposed,
    patch: { ...proposed.patch, bio: 'Moler sam deset godina. Radim u celoj Srbiji.' } },
  'Cela Srbija; moler sam deset godina.', previous);
  assert.equal(mixedBio.patch.bio, 'Moler sam deset godina.');
});

test('unknown radius for a new locality cannot inherit a stale/default radius', () => {
  const result = guardWorkerAreaOutput(proposed, 'Novi Sad i okolina', previous);
  assert.equal(result.safety, 'CLARIFY');
  assert.equal(result.patch.location, undefined);
  assert.match(result.assistantMessage, /Do koliko kilometara/);
  const same = guardWorkerAreaOutput({ ...proposed, patch: { location: { city: 'Niš', radiusKm: 20 } } },
    'Niš i okolina', previous);
  assert.equal(same.safety, 'ALLOW');
  assert.deepEqual(same.patch.location, { city: 'Niš', radiusKm: 20 });
  assert.match(same.assistantMessage, /Za okolna mesta još ne mogu da obećam/);
  const sameWithoutPatch = guardWorkerAreaOutput({ ...proposed, assistantMessage: 'Okolna mesta su aktivna.', patch: { skills: ['Krečenje'] } },
    'Niš i okolina', previous);
  assert.deepEqual(sameWithoutPatch.patch, { skills: ['Krečenje'] });
  assert.doesNotMatch(sameWithoutPatch.assistantMessage, /aktivna/);
  assert.match(sameWithoutPatch.assistantMessage, /približan centar grada/);
  const noPatch = guardWorkerAreaOutput({ ...proposed, assistantMessage: 'Zabeležio sam Novi Sad i okolinu.', patch: { skills: ['Krečenje'] } },
    'Novi Sad i okolina', previous);
  assert.equal(noPatch.safety, 'CLARIFY');
  assert.match(noPatch.assistantMessage, /Do koliko kilometara/);
});

test('explicit single locality and radius remain eligible for the existing signed review', () => {
  const local = guardWorkerAreaOutput(proposed, 'Novi Sad, do 30 km', previous);
  assert.deepEqual(local.patch.location, proposed.patch.location);
  assert.equal(local.patch.bio, undefined, 'unsupported country claim cannot enter biography even with a local request');
  assert.match(local.assistantMessage, /Za okolna mesta još ne mogu da obećam automatske predloge/);
  const remoteOnly = { assistantMessage: 'Koji grad i državu da navedemo na profilu?', safety: 'CLARIFY', patch: { skills: ['Krečenje'] } };
  assert.deepEqual(guardWorkerAreaOutput(remoteOnly, 'Samo onlajn', previous), remoteOnly);
});

test('remote-only area phrase never creates a travel radius question or a radius patch', () => {
  const result = guardWorkerAreaOutput({ assistantMessage: 'Do koliko kilometara od Novog Sada dolaziš?', safety: 'ALLOW',
    patch: { location: { city: 'Novi Sad', radiusKm: 30 }, skills: ['Onlajn časovi'] } },
  'Novi Sad i okolina, ali samo za onlajn rad', previous);
  assert.equal(result.safety, 'ALLOW');
  assert.deepEqual(result.patch.location, { city: 'Novi Sad' });
  assert.doesNotMatch(result.assistantMessage, /kilomet|dokle|radijus|krug/iu);
  assert.match(result.assistantMessage, /onlajn rad/);
});

test('an independent missing-hours question survives area admission', () => {
  const result = guardWorkerAreaOutput({ ...proposed,
    assistantMessage: 'Koji grad? Do koliko sati radnim danima?' }, 'Cela Vojvodina', previous);
  assert.match(result.assistantMessage, /Do koliko sati radnim danima\?/);
  assert.doesNotMatch(result.assistantMessage, /Koji grad\?/);
  const bioScrub = guardWorkerAreaOutput({ ...proposed,
    assistantMessage: 'Zabeležio sam Novi Sad i okolinu. Do koliko sati radnim danima?',
    patch: { ...proposed.patch, bio: 'Radim u celoj Srbiji.' } }, 'Novi Sad i okolina', previous);
  assert.equal(bioScrub.patch.bio, undefined);
  assert.equal(bioScrub.patch.location, undefined);
  assert.match(bioScrub.assistantMessage, /Do koliko kilometara/);
  assert.match(bioScrub.assistantMessage, /Do koliko sati radnim danima\?/);
  const localWithBadBio = guardWorkerAreaOutput({ assistantMessage: 'Do koliko sati radnim danima?', safety: 'CLARIFY',
    patch: { location: { city: 'Novi Sad', radiusKm: 30 }, bio: 'Radim u celoj Srbiji.', skills: ['Krečenje'] } },
  'Novi Sad do 30 km, radnim danima posle 16', previous);
  assert.deepEqual(localWithBadBio.patch, { location: { city: 'Novi Sad', radiusKm: 30 }, skills: ['Krečenje'] });
  assert.match(localWithBadBio.assistantMessage, /Do koliko sati radnim danima\?/);
  assert.match(localWithBadBio.assistantMessage, /Za okolna mesta još ne mogu da obećam/);
});

test('REVIEW and BLOCK keep the DB candidate freeze even for a broad request', () => {
  for (const safety of ['REVIEW', 'BLOCK']) {
    const frozen = { ...proposed, safety };
    assert.equal(guardWorkerAreaOutput(frozen, 'Cela Srbija', previous), frozen);
    assert.equal(guardWorkerAreaOutput(frozen, 'Novi Sad i okolina', previous), frozen);
  }
});

test('candidate is not wired into the active worker Edge function', () => {
  const edge = readFileSync(new URL('../../../supabase/functions/uskoci-worker-interview/index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(edge, /workerAreaAdmission|guardWorkerAreaOutput/);
});
