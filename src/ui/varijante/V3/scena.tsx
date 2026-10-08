import type { ReactNode } from 'react';
import { DogovorenoA } from './DogovorenoA';
import { DogovorenoB } from './DogovorenoB';
import { DogovorenoC } from './DogovorenoC';
import { KandidatiA } from './KandidatiA';
import { KandidatiB } from './KandidatiB';
import { KandidatiC } from './KandidatiC';
import { PrijavaA } from './PrijavaA';
import { PrijavaB } from './PrijavaB';
import { PrijavaC } from './PrijavaC';
import { RazgovorA_Nacrt, RazgovorA_Objavljeno, RazgovorA_Pocetak } from './RazgovorA';
import { RazgovorB_Nacrt, RazgovorB_Objavljeno, RazgovorB_Pocetak } from './RazgovorB';
import { RazgovorC_Nacrt, RazgovorC_Objavljeno, RazgovorC_Pocetak } from './RazgovorC';
import { DogovorenoSada, KandidatiSada, ObjavljenoSada, PrijavaSada, RazgovorSada } from './Sada';
import { KANDIDATI, KANDIDATI_DUGO, NACRT, NACRT_DUG, NACRT_JOS_TREBA, PRIJAVA, PRIJAVA_DUGA, RAZGOVOR, RAZGOVOR_DUG, ZADATAK, ZADATAK_DUG } from './podaci';

/**
 * Scene laboratorije grupe V3, po ekranu i varijanti: `<ekran>-<sada|A|B|C>[-<stanje>]`. Ista ruta (`/dizajn-var-V3?scene=…`) crta scenu
 * preko celog ekrana, bez okvira galerije; bez parametra pokazuje ovaj spisak. `t` (ms) zaustavlja trenutak u kadru.
 */
export type Scena = { id: string; ekran: string; naziv: string; kadrovi?: readonly number[]; draw: (t?: number) => ReactNode };

const EKRAN = { kandidati: 'Kandidati (izbor prijave)', dogovoreno: 'Trenutak „Dogovoreno!“', razgovor: 'AI razgovor · početak',
  nacrt: 'Nacrt je spreman', objavljeno: 'Trenutak „Objavljeno“', prijava: 'Prijava je poslata' } as const;

const KADROVI_TRENUTKA = [0, 150, 400, 900] as const;
const KADROVI_NACRTA = [0, 150, 400, 900] as const;
const KADROVI_PECATA = [0, 240, 300, 380] as const;
const KADROVI_ETIKETE = [0, 400, 480, 900] as const;

export const SCENE: readonly Scena[] = [
  { id: 'kandidati-sada', ekran: EKRAN.kandidati, naziv: 'Sada', draw: () => <KandidatiSada need={ZADATAK} candidates={KANDIDATI} /> },
  { id: 'kandidati-sada-dugo', ekran: EKRAN.kandidati, naziv: 'Sada · dugi nazivi', draw: () => <KandidatiSada need={ZADATAK_DUG} candidates={KANDIDATI_DUGO} /> },
  { id: 'kandidati-A', ekran: EKRAN.kandidati, naziv: 'A · Ponude preko stola', kadrovi: [0, 150, 400], draw: t => <KandidatiA need={ZADATAK} candidates={KANDIDATI} holdAt={t} /> },
  { id: 'kandidati-A-dugo', ekran: EKRAN.kandidati, naziv: 'A · dugi nazivi', draw: () => <KandidatiA need={ZADATAK_DUG} candidates={KANDIDATI_DUGO} /> },
  { id: 'kandidati-A-prazno', ekran: EKRAN.kandidati, naziv: 'A · prazno', draw: () => <KandidatiA need={ZADATAK} candidates={[]} /> },
  { id: 'kandidati-B', ekran: EKRAN.kandidati, naziv: 'B · Tabela odmah', draw: () => <KandidatiB need={ZADATAK} candidates={KANDIDATI} /> },
  { id: 'kandidati-B-dugo', ekran: EKRAN.kandidati, naziv: 'B · dugi nazivi', draw: () => <KandidatiB need={ZADATAK_DUG} candidates={KANDIDATI_DUGO} /> },
  { id: 'kandidati-B-prazno', ekran: EKRAN.kandidati, naziv: 'B · prazno', draw: () => <KandidatiB need={ZADATAK} candidates={[]} /> },
  { id: 'kandidati-C', ekran: EKRAN.kandidati, naziv: 'C · Jedan po jedan', draw: () => <KandidatiC need={ZADATAK} candidates={KANDIDATI} /> },
  { id: 'kandidati-C-dugo', ekran: EKRAN.kandidati, naziv: 'C · dugi nazivi', draw: () => <KandidatiC need={ZADATAK_DUG} candidates={KANDIDATI_DUGO} /> },
  { id: 'kandidati-C-prazno', ekran: EKRAN.kandidati, naziv: 'C · prazno', draw: () => <KandidatiC need={ZADATAK} candidates={[]} /> },

  { id: 'dogovoreno-sada', ekran: EKRAN.dogovoreno, naziv: 'Sada', draw: () => <DogovorenoSada need={ZADATAK} candidate={KANDIDATI[0]} candidates={KANDIDATI} /> },
  { id: 'dogovoreno-A', ekran: EKRAN.dogovoreno, naziv: 'A · Stisak (znak)', kadrovi: KADROVI_TRENUTKA, draw: t => <DogovorenoA need={ZADATAK} candidate={KANDIDATI[0]} holdAt={t} /> },
  { id: 'dogovoreno-A-dugo', ekran: EKRAN.dogovoreno, naziv: 'A · dugi nazivi', draw: () => <DogovorenoA need={ZADATAK_DUG} candidate={KANDIDATI_DUGO[0]} /> },
  { id: 'dogovoreno-B', ekran: EKRAN.dogovoreno, naziv: 'B · Reč i priznanica', kadrovi: [0, 150], draw: t => <DogovorenoB need={ZADATAK} candidate={KANDIDATI[0]} holdAt={t} /> },
  { id: 'dogovoreno-B-dugo', ekran: EKRAN.dogovoreno, naziv: 'B · dugi nazivi', draw: () => <DogovorenoB need={ZADATAK_DUG} candidate={KANDIDATI_DUGO[0]} /> },
  { id: 'dogovoreno-C', ekran: EKRAN.dogovoreno, naziv: 'C · Susret (dva lica)', kadrovi: KADROVI_TRENUTKA, draw: t => <DogovorenoC need={ZADATAK} candidate={KANDIDATI[0]} holdAt={t} /> },
  { id: 'dogovoreno-C-dugo', ekran: EKRAN.dogovoreno, naziv: 'C · dugi nazivi', draw: () => <DogovorenoC need={ZADATAK_DUG} candidate={KANDIDATI_DUGO[0]} /> },

  { id: 'razgovor-sada', ekran: EKRAN.razgovor, naziv: 'Sada', draw: () => <RazgovorSada /> },
  { id: 'razgovor-A', ekran: EKRAN.razgovor, naziv: 'A · Asistent i sto', draw: () => <RazgovorA_Pocetak /> },
  { id: 'razgovor-B', ekran: EKRAN.razgovor, naziv: 'B · Reč vodi', draw: () => <RazgovorB_Pocetak /> },
  { id: 'razgovor-C', ekran: EKRAN.razgovor, naziv: 'C · Pin sleće (pilula u sredini)', draw: () => <RazgovorC_Pocetak /> },

  { id: 'nacrt-sada', ekran: EKRAN.nacrt, naziv: 'Sada', draw: () => <RazgovorSada messages={RAZGOVOR} card={{ summary: NACRT, stillNeeded: NACRT_JOS_TREBA }} /> },
  { id: 'nacrt-A', ekran: EKRAN.nacrt, naziv: 'A · predmeti sleću u nacrt', kadrovi: KADROVI_NACRTA, draw: t => <RazgovorA_Nacrt messages={RAZGOVOR} summary={NACRT} stillNeeded={NACRT_JOS_TREBA} holdAt={t} /> },
  { id: 'nacrt-A-dugo', ekran: EKRAN.nacrt, naziv: 'A · dugi nazivi', draw: () => <RazgovorA_Nacrt messages={RAZGOVOR_DUG} summary={NACRT_DUG} stillNeeded={null} /> },
  { id: 'nacrt-B', ekran: EKRAN.nacrt, naziv: 'B · priznanica', draw: () => <RazgovorB_Nacrt messages={RAZGOVOR} summary={NACRT} stillNeeded={NACRT_JOS_TREBA} /> },
  { id: 'nacrt-B-dugo', ekran: EKRAN.nacrt, naziv: 'B · dugi nazivi', draw: () => <RazgovorB_Nacrt messages={RAZGOVOR_DUG} summary={NACRT_DUG} stillNeeded={null} /> },
  { id: 'nacrt-C', ekran: EKRAN.nacrt, naziv: 'C · traka iznad pilule', kadrovi: [0, 150], draw: t => <RazgovorC_Nacrt messages={RAZGOVOR} summary={NACRT} stillNeeded={NACRT_JOS_TREBA} holdAt={t} /> },
  { id: 'nacrt-C-dugo', ekran: EKRAN.nacrt, naziv: 'C · dugi nazivi', draw: () => <RazgovorC_Nacrt messages={RAZGOVOR_DUG} summary={NACRT_DUG} stillNeeded={null} /> },

  { id: 'objavljeno-sada', ekran: EKRAN.objavljeno, naziv: 'Sada', draw: () => <ObjavljenoSada /> },
  { id: 'objavljeno-A', ekran: EKRAN.objavljeno, naziv: 'A · papir sa pinom i olovkom + pilula', kadrovi: KADROVI_TRENUTKA, draw: t => <RazgovorA_Objavljeno holdAt={t} /> },
  { id: 'objavljeno-B', ekran: EKRAN.objavljeno, naziv: 'B · reč + priznanica', kadrovi: [0, 150], draw: t => <RazgovorB_Objavljeno summary={NACRT} holdAt={t} /> },
  { id: 'objavljeno-C', ekran: EKRAN.objavljeno, naziv: 'C · marker sleće na mapu', kadrovi: KADROVI_TRENUTKA, draw: t => <RazgovorC_Objavljeno holdAt={t} /> },

  { id: 'prijava-sada', ekran: EKRAN.prijava, naziv: 'Sada', draw: () => <PrijavaSada need={ZADATAK} draft={{ price: '4500', people: '2', note: PRIJAVA.poruka, start: null, end: null }} /> },
  { id: 'prijava-A', ekran: EKRAN.prijava, naziv: 'A · Cedulja sa pečatom', kadrovi: KADROVI_PECATA, draw: t => <PrijavaA need={ZADATAK} prijava={PRIJAVA} holdAt={t} /> },
  { id: 'prijava-A-dugo', ekran: EKRAN.prijava, naziv: 'A · dugi nazivi', draw: () => <PrijavaA need={ZADATAK_DUG} prijava={PRIJAVA_DUGA} /> },
  { id: 'prijava-B', ekran: EKRAN.prijava, naziv: 'B · Veliki iznos', kadrovi: [0, 150], draw: t => <PrijavaB need={ZADATAK} prijava={PRIJAVA} holdAt={t} /> },
  { id: 'prijava-B-dugo', ekran: EKRAN.prijava, naziv: 'B · dugi nazivi', draw: () => <PrijavaB need={ZADATAK_DUG} prijava={PRIJAVA_DUGA} /> },
  { id: 'prijava-C', ekran: EKRAN.prijava, naziv: 'C · Etiketa odlazi', kadrovi: KADROVI_ETIKETE, draw: t => <PrijavaC need={ZADATAK} prijava={PRIJAVA} holdAt={t} /> },
  { id: 'prijava-C-dugo', ekran: EKRAN.prijava, naziv: 'C · dugi nazivi', draw: () => <PrijavaC need={ZADATAK_DUG} prijava={PRIJAVA_DUGA} /> },
];

export const EKRANI = [...new Set(SCENE.map(scene => scene.ekran))];
export const scenaPoId = (id: string | undefined) => SCENE.find(scene => scene.id === id) ?? null;
