import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { workProfileSummary } from './workProfileSummary';
import { guardWorkerAreaOutput } from '../../../supabase/functions/_shared/workerAreaAdmission.mjs';
import { withUnresolvedSinglePassReply } from '../../../supabase/functions/_shared/singlePassTaxonomy.mjs';
import { workerReviewPresentable } from '../../features/ai/intake/intakeReviewReadiness';

describe('Celina 1: Radni profil — više gradova (workAreas) i očuvanje opisa (bio)', () => {
  it('workProfileSummary prikazuje sve gradove iz workAreas (Novi Sad · Beograd)', () => {
    const summary = workProfileSummary({
      stanje: 'ACTIVE',
      vestine: ['Selidbe i prevoz', 'Montaža nameštaja'],
      grad: 'Novi Sad',
      radijusKm: 20,
      workAreas: [
        { kind: 'RADIUS', countryCode: 'RS', city: 'Novi Sad', radiusKm: 20, label: 'Novi Sad · do 20 km', sourceRef: 'osm:relation:1', latitude: 45.25, longitude: 19.84 },
        { kind: 'RADIUS', countryCode: 'RS', city: 'Beograd', radiusKm: 30, label: 'Beograd · do 30 km', sourceRef: 'osm:relation:2', latitude: 44.81, longitude: 20.46 },
      ],
    });
    assert.ok(typeof summary === 'string');
    assert.ok(summary.includes('Aktivan'), `Očekivano da sadrži 'Aktivan', dobijeno: ${summary}`);
    assert.ok(summary.includes('Novi Sad · do 20 km · Beograd · do 30 km'), `Očekivano da sadrži oba grada, dobijeno: ${summary}`);
  });

  it('guardWorkerAreaOutput automatski prepoznaje više gradova u jednoj poruci (MULTI_LOCALITY)', () => {
    const output = {
      safety: 'ALLOW',
      assistantMessage: 'Zabeležio sam oba grada.',
      patch: {
        bio: 'Radim selidbe i montažu nameštaja u Novom Sadu i Beogradu.',
      },
    };
    const context = {
      candidate: {
        skills: ['Selidbe i prevoz'],
        location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20 },
        workAreas: [],
      },
    };
    const guarded = guardWorkerAreaOutput(output, 'Radim u Novom Sadu i Beogradu', context);
    assert.equal(guarded.safety, 'ALLOW');
    assert.equal(guarded.patch.areaRequests.length, 2);
    assert.equal(guarded.patch.areaRequests[0].query, 'Novi Sad');
    assert.equal(guarded.patch.areaRequests[1].query, 'Beograd');
  });

  it('guardWorkerAreaOutput automatski dodaje novi grad uz postojeći kada korisnik kaže "Dodaj i Beograd"', () => {
    const output = {
      safety: 'ALLOW',
      assistantMessage: 'Dodat je i Beograd.',
      patch: {
        bio: 'Radim selidbe u Novom Sadu.',
      },
    };
    const context = {
      candidate: {
        skills: ['Selidbe'],
        location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20 },
        workAreas: [{ kind: 'RADIUS', countryCode: 'RS', city: 'Novi Sad', radiusKm: 20 }],
      },
    };
    const guarded = guardWorkerAreaOutput(output, 'Dodaj i Beograd', context);
    assert.ok(Array.isArray(guarded.patch.areaRequests));
    assert.equal(guarded.patch.areaRequests.length, 2);
  });
});

describe('Celina 2 & 3: Spremnost pregleda i single-pass potvrda', () => {
  it('withUnresolvedSinglePassReply potvrđuje sačuvane podatke kada je semantički plan prisutan', () => {
    const turn = {
      safety: 'ALLOW',
      assistantMessage: 'Sve je spremno.',
      dialogue: { next: 'REVIEW', questionKey: 'NONE' },
    };
    const built = { clarifications: [], failures: [], unconfirmedModeServices: [], unresolvedServices: ['Čišćenje'] };
    const plan = { proposals: [{ service: 'Čišćenje', action: 'REUSE_EXISTING' }] };
    const result = withUnresolvedSinglePassReply(turn, built, plan);
    assert.equal(result.assistantMessage, 'Podaci iz razgovora su sačuvani.');
    assert.equal(result.dialogue.next, 'ACK');
  });

  it('workerReviewPresentable potvrđuje spreman pregled sa više područja rada (workAreas)', () => {
    const baseSnapshot: any = {
      status: 'OPEN',
      stale: false,
      safety: 'ALLOW',
      accountId: 'acc-1',
      conversationId: 'conv-1',
      profileId: 'prof-1',
      revision: 3,
      review: {
        accountId: 'acc-1',
        conversationId: 'conv-1',
        profileId: 'prof-1',
        revision: 3,
        canAccept: true,
        missingRequired: [],
        classificationState: 'READY',
        reviewedServiceModes: [{ service: 'Selidbe', mode: 'ON_SITE' }],
        profile: {
          workAreas: [
            { kind: 'CITY', countryCode: 'RS', city: 'Novi Sad', radiusKm: null, label: 'Novi Sad', sourceRef: 'osm:relation:1', latitude: 45.25, longitude: 19.84 },
            { kind: 'CITY', countryCode: 'RS', city: 'Beograd', radiusKm: null, label: 'Beograd', sourceRef: 'osm:relation:2', latitude: 44.81, longitude: 20.46 },
          ],
          location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20 },
        },
      },
    };
    assert.equal(workerReviewPresentable(baseSnapshot), true);
  });
});
