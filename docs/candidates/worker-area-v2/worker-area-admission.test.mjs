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
    ['Radim širom Srbije', 'COUNTRY'],
    ['Radim širom cele Srbije', 'COUNTRY'], ['Na području cele Srbije', 'COUNTRY'],
    ['cela Vojvodina', 'REGION'], ['U celoj Šumadiji', 'REGION'], ['Balkan', 'REGION'],
    ['Novi Sad i Beograd', 'MULTI_LOCALITY'], ['Нови Сад и Београд', 'MULTI_LOCALITY'], ['u Novom Sadu i u Beogradu', 'MULTI_LOCALITY'],
    ['radim u novom sadu i beogradu', 'MULTI_LOCALITY'], ['novi sad i beograd', 'MULTI_LOCALITY'],
    ['radim u nišu i kragujevcu', 'MULTI_LOCALITY'], ['радим у новом саду и београду', 'MULTI_LOCALITY'],
    ['novi sad, beograd', 'MULTI_LOCALITY'],
    ['Novi Sad a Beograd', 'MULTI_LOCALITY'],
    ['Novi Sad do 30 km i Beograd do 30 km', 'MULTI_LOCALITY'],
    ['Radim od Vranja do Subotice', 'MULTI_LOCALITY'],
    ['Radim na relaciji Novi Sad–Beograd', 'MULTI_LOCALITY'],
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
    ['radim samo online u novom sadu i beogradu', 'NONE'],
    ['prevod samo online u novom sadu i beogradu, moler u nišu do 30 km', 'NONE'],
    ['Radim samo online u Novom Sadu i okolini', 'NONE'],
    ['Radim po Vojvodini', 'REGION'],
    ['Novi Sad, Srbija, do 30 km', 'NONE'], ['Novi Sad i okolina do 30 km', 'NONE'],
    ['Cela oprema mi je u Novom Sadu, Srbija', 'NONE'],
    ['Prevod samo online u celoj Srbiji, a moler u Novom Sadu do 30 km', 'NONE'],
    ['Zovem se Ana i Marina, krečim Novi Sad do 30 km', 'NONE'],
    ['Zovem se Ana i Marina', 'NONE'],
    ['Radim po Srbiji', 'COUNTRY'], ['Radim u Srbiji', 'COUNTRY'], ['Srbija', 'COUNTRY'],
    ['po celom Balkanu', 'REGION'],
    ['Samo online. Živim u Novom Sadu.', 'NONE'],
    ['Prevod samo online u celoj Srbiji, moler u Novom Sadu do 30 km', 'NONE'],
    ['Ana i Marina rade sa mnom, Novi Sad do 30 km', 'NONE'],
    ['zovem se Ana i Marina, radim u novom sadu do 30 km', 'NONE'],
    ['radim u novom sadu i vikendom sam slobodan', 'NONE'],
    ['radim u nišu i imam vremena uveče', 'NONE'],
    ['radim u novom sadu i novom sadu', 'NONE'],
  ]) assert.equal(classifyWorkerAreaRequest(input), scope, input);
});

test('lowercase two-city work request cannot become a single V1 circle or public bio', () => {
  for (const utterance of ['radim u novom sadu i beogradu','novi sad i beograd','radim u nišu i kragujevcu']) {
    const result=guardWorkerAreaOutput({assistantMessage:'Jedan grad je sačuvan.',safety:'ALLOW',patch:{
      location:{city:'Novi Sad',radiusKm:200},bio:utterance,skills:['Moler']}},utterance,previous);
    assert.equal(result.safety,'CLARIFY',utterance);
    assert.deepEqual(result.patch,{skills:['Moler']},utterance);
    assert.match(result.assistantMessage,/više gradova/,utterance);
    assert.doesNotMatch(result.assistantMessage,/Jedan grad je sačuvan/,utterance);
  }
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
  const localProposal = { ...proposed, patch: { ...proposed.patch,
    location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 30 } } };
  const local = guardWorkerAreaOutput(localProposal, 'Novi Sad, do 30 km', previous);
  assert.deepEqual(local.patch.location, localProposal.patch.location);
  assert.equal(local.patch.bio, undefined, 'unsupported country claim cannot enter biography even with a local request');
  assert.match(local.assistantMessage, /Za okolna mesta još ne mogu da obećam automatske predloge/);
  const remoteOnly = { assistantMessage: 'Koji grad i državu da navedemo na profilu?', safety: 'CLARIFY', patch: { skills: ['Krečenje'] } };
  assert.deepEqual(guardWorkerAreaOutput(remoteOnly, 'Samo onlajn', previous), remoteOnly);
});

test('a provider radius differing from the stated distance cannot reach the signed candidate', () => {
  const result = guardWorkerAreaOutput({ ...proposed, patch: { location: { city: 'Novi Sad', radiusKm: 200 }, skills: ['Moler'] } },
    'Novi Sad do 30 km', previous);
  assert.equal(result.safety, 'CLARIFY');
  assert.deepEqual(result.patch, { skills: ['Moler'] });
  assert.match(result.assistantMessage, /udaljenost nije ista/);
});

test('an explicit city and radius cannot be silently replaced by a different city with the same radius', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'Beograd do 30 km je u nacrtu.',safety:'ALLOW',
    patch:{location:{city:'Beograd',radiusKm:30},skills:['Moler']}}, 'Novi Sad do 30 km', previous);
  assert.equal(result.safety,'CLARIFY');
  assert.deepEqual(result.patch,{skills:['Moler']});
  assert.doesNotMatch(result.assistantMessage,/Beograd do 30 km je u nacrtu/);
});

test('an explicit on-site city without a distance cannot authorize a different provider city', () => {
  for (const utterance of ['Radim u Novom Sadu','Novi Sad']) {
    const result = guardWorkerAreaOutput({assistantMessage:'Beograd je u nacrtu.',safety:'ALLOW',
      patch:{location:{city:'Beograd',radiusKm:30},skills:['Moler']}},utterance,previous);
    assert.equal(result.safety,'CLARIFY',utterance);
    assert.deepEqual(result.patch,{skills:['Moler']},utterance);
  }
});

test('a different named surrounding city cannot inherit the old city even when provider echoes it', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'Niš i okolina su u nacrtu.',safety:'ALLOW',
    patch:{location:{city:'Niš',radiusKm:20},skills:['Moler']}}, 'Radim u okolini Beograda', previous);
  assert.equal(result.safety,'CLARIFY');
  assert.deepEqual(result.patch,{skills:['Moler']});
  assert.match(result.assistantMessage,/Do koliko kilometara/);
});

test('additional country and region phrases cannot be represented as a V1 circle', () => {
  for (const utterance of ['Radim po Srbiji','Radim u Srbiji','Srbija','po celom Balkanu']) {
    const result = guardWorkerAreaOutput({assistantMessage:'Područje je u nacrtu.',safety:'ALLOW',
      patch:{location:{city:'Beograd',radiusKm:200},skills:['Moler']}},utterance,previous);
    assert.equal(result.safety,'CLARIFY',utterance);
    assert.deepEqual(result.patch,{skills:['Moler']},utterance);
  }
});

test('online work and a separate home address never change the on-site area', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'Novi Sad je novo područje rada.',safety:'ALLOW',
    patch:{location:{city:'Novi Sad',radiusKm:30},skills:['Prevod']}},
    'Samo online. Živim u Novom Sadu.',previous);
  assert.equal(result.patch.location,undefined);
  assert.deepEqual(result.patch.skills,['Prevod']);
  assert.doesNotMatch(result.assistantMessage,/novo područje rada/);
});

test('unitless correction cannot retain the expressly rejected old distance', () => {
  for (const utterance of ['Nije 30 nego 50','Nije 30 km nego 50','Nije 30 nego 50 km']) {
    const result = guardWorkerAreaOutput({assistantMessage:'Ostaje 30 km.',safety:'ALLOW',
      patch:{location:{radiusKm:30},skills:['Moler']}},utterance,previous);
    assert.equal(result.safety,'CLARIFY',utterance);
    assert.deepEqual(result.patch,{skills:['Moler']},utterance);
    assert.doesNotMatch(result.assistantMessage,/Ostaje 30 km/,utterance);
  }
});

test('comma-separated remote service does not erase explicit on-site area', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'Novi Sad je u nacrtu.',safety:'ALLOW',
    patch:{location:{city:'Novi Sad',radiusKm:30},skills:['Prevod','Moler']}},
    'Prevod samo online u celoj Srbiji, moler u Novom Sadu do 30 km',previous);
  assert.equal(result.patch.location?.city,'Novi Sad');
  assert.equal(result.patch.location?.radiusKm,30);
});

test('two colleagues named in the sentence are not mistaken for two work cities', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'Novi Sad je u nacrtu.',safety:'ALLOW',
    patch:{location:{city:'Novi Sad',radiusKm:30},skills:['Moler']}},
    'Ana i Marina rade sa mnom, Novi Sad do 30 km',previous);
  assert.equal(result.patch.location?.city,'Novi Sad');
  assert.equal(result.patch.location?.radiusKm,30);
});

test('the corrected distance wins over the explicitly rejected older distance', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'U nacrtu je sada do 50 km.', safety:'ALLOW',
    patch:{location:{radiusKm:50},skills:['Moler']}}, 'Nije 30 km, nego 50 km', previous);
  assert.equal(result.safety,'ALLOW');
  assert.deepEqual(result.patch.location,{radiusKm:50});
});

test('remote-only place cannot overwrite a distinct saved administrative city', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'Novi Sad je u nacrtu.',safety:'ALLOW',
    patch:{location:{city:'Novi Sad',radiusKm:30},skills:['Onlajn časovi']}},
  'Radim samo online u Novom Sadu',previous);
  assert.equal(result.patch.location,undefined);
  assert.deepEqual(result.patch.skills,['Onlajn časovi']);
});

test('surroundings of a different named city still asks for distance when provider omits location', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'Okolina je u nacrtu.',safety:'ALLOW',patch:{skills:['Moler']}},
    'Radim u okolini Beograda',previous);
  assert.equal(result.safety,'CLARIFY');
  assert.deepEqual(result.patch,{skills:['Moler']});
  assert.match(result.assistantMessage,/Do koliko kilometara/);
});

test('remote country clause does not discard a separate explicit on-site locality', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'U nacrtu je moler u Novom Sadu.',safety:'ALLOW',
    patch:{location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:30},skills:['Prevod','Molerski radovi']}},
  'Prevod samo online u celoj Srbiji, a moler u Novom Sadu do 30 km',previous);
  assert.equal(result.safety,'ALLOW');
  assert.equal(result.patch.location?.city,'Novi Sad');
  assert.equal(result.patch.location?.radiusKm,30);
});

test('comma-linked experience survives removal of an unsupported area claim', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'Opis je u nacrtu.',safety:'ALLOW',
    patch:{bio:'Moler sam deset godina, radim u celoj Srbiji.',skills:['Moler']}},
  'Moler sam deset godina, radim u celoj Srbiji',previous);
  assert.equal(result.patch.bio,'Moler sam deset godina.');
  assert.deepEqual(result.patch.skills,['Moler']);
});

test('names joined by i do not block a later explicit locality and radius', () => {
  const result = guardWorkerAreaOutput({assistantMessage:'Novi Sad do 30 km je u nacrtu.',safety:'ALLOW',
    patch:{location:{city:'Novi Sad',radiusKm:30},skills:['Krečenje']}},
  'Zovem se Ana i Marina, krečim Novi Sad do 30 km',previous);
  assert.equal(result.patch.location?.city,'Novi Sad');
  assert.equal(result.safety,'ALLOW');
});

test('remote-only area phrase never creates a travel radius question or a radius patch', () => {
  const result = guardWorkerAreaOutput({ assistantMessage: 'Do koliko kilometara od Novog Sada dolaziš?', safety: 'ALLOW',
    patch: { location: { city: 'Novi Sad', radiusKm: 30 }, skills: ['Onlajn časovi'] } },
  'Novi Sad i okolina, ali samo za onlajn rad', previous);
  assert.equal(result.safety, 'CLARIFY');
  assert.equal(result.patch.location, undefined);
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

test('admission is wired before the worker turn is committed', () => {
  const edge = readFileSync(new URL('../../../supabase/functions/uskoci-worker-interview/index.ts', import.meta.url), 'utf8');
  assert.match(edge, /guardWorkerAreaOutput\(/);
  assert.ok(edge.indexOf('guardWorkerAreaOutput(') < edge.indexOf("rpc('rpc_complete_worker_ai_turn_service'"));
});
