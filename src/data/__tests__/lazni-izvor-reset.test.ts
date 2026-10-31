import { izmeniPotrebuMaterijalno, lazniIzvor, resetujLazniIzvor } from '../lazniIzvor';

const prijava = (clientRequestId: string) => ({
  clientRequestId,
  potrebaId: 'ormar',
  potrebaRevizija: 3,
  radnikProfilId: 'moj-profil-1',
  pokrivenaMesta: 1,
  cenaRsd: 2600,
  predlozeniPocetak: null,
  predlozeniKraj: null,
  napomena: null,
});

beforeEach(resetujLazniIzvor);
afterEach(resetujLazniIzvor);

it('X05 resets submitted candidates and their related revision, withdrawal, profile and command state', async () => {
  const original = await lazniIzvor.prijaveZaPotrebu('ormar');
  expect(original).toHaveLength(5);

  const result = await lazniIzvor.podnesiPrijavu(prijava('demo-submit'));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('DEMO_APPLICATION_NOT_SUBMITTED');
  const { prijavaId, verzija } = result.podatak;
  expect((await lazniIzvor.prijaveZaPotrebu('ormar')).filter(item => item.prijavaId === prijavaId)).toHaveLength(1);
  expect((await lazniIzvor.mojePrijave()).map(item => item.prijavaId)).toEqual([prijavaId]);

  expect(await lazniIzvor.povuciPrijavu({ clientRequestId: 'demo-withdraw', prijavaId, potrebaRevizija: 3, prijavaVerzija: verzija }))
    .toMatchObject({ ok: true, podatak: { stanje: 'WITHDRAWN' } });
  expect(await lazniIzvor.azurirajRadnikProfil({ ime: 'Promenjen profil' })).toMatchObject({ ok: true });
  izmeniPotrebuMaterijalno();

  resetujLazniIzvor();
  expect(await lazniIzvor.prijaveZaPotrebu('ormar')).toEqual(original);
  expect(await lazniIzvor.mojePrijave()).toEqual([]);
  expect((await lazniIzvor.mojRadnikProfil())?.ime).toBe('Ti');
  expect(await lazniIzvor.povuciPrijavu({ clientRequestId: 'demo-withdraw', prijavaId, potrebaRevizija: 3, prijavaVerzija: verzija }))
    .toMatchObject({ ok: false, kod: 'RESPONSE_NOT_FOUND' });

  // A fresh demo starts the same sequence again: no stale counter, ID or withdrawal journal.
  expect(await lazniIzvor.podnesiPrijavu(prijava('demo-submit'))).toEqual(result);
});

it('X05 repeated resets do not accumulate candidates from previous demo runs', async () => {
  const initial = await lazniIzvor.prijaveZaPotrebu('ormar');
  for (let i = 0; i < 3; i++) {
    const result = await lazniIzvor.podnesiPrijavu(prijava('run-' + i));
    expect(result.ok).toBe(true);
    expect(await lazniIzvor.prijaveZaPotrebu('ormar')).toHaveLength(initial.length + 1);
    resetujLazniIzvor();
    expect(await lazniIzvor.prijaveZaPotrebu('ormar')).toEqual(initial);
    expect(await lazniIzvor.mojePrijave()).toEqual([]);
  }
});
