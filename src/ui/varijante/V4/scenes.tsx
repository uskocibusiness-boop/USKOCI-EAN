import type { ReactNode } from 'react';
import { DetaljA, ListaA } from './DogovoriA';
import { DetaljB, ListaB } from './DogovoriB';
import { DetaljC, ListaC } from './DogovoriC';
import { DETALJ_BEZ_TERMINA, DETALJ_CEKA, DETALJ_DOGOVOREN, DETALJ_DUGO, DETALJ_POTVRDJEN, LIST, LIST_DUGO, PROFILE_DUGO, PROFILE_ME, PUBLIC, PUBLIC_DUGO, PUBLIC_NOV,
  RATED, REVIEW_PERSON, REVIEW_PERSON_DUGO, STATS, STATS_NOV, TRUST, TRUST_NOV, UNRATED } from './fixtures';
import { FRAME_TIMES } from './lab';
import { OcenaA, SacuvanoA } from './OcenaA';
import { OcenaB, SacuvanoB } from './OcenaB';
import { OcenaC, SacuvanoC } from './OcenaC';
import { JavniA, ProfilA } from './ProfilA';
import { JavniB, ProfilB } from './ProfilB';
import { JavniC, ProfilC } from './ProfilC';
import { DetaljSada, JavniSada, ListaSada, OcenaSada, ProfilSada } from './Sada';
import type { Who } from './profilShared';

/**
 * Every scene of the V4 variants, by its key: `<ekran>-<A|B|C|sada>[-<stanje>][-k<kadar>]`. A frame (`k0`…) freezes the scene's motion at
 * `t` ms after the trigger (`LabClock`), so the lab can photograph a movement it cannot film. The route draws a key; the test draws them all.
 */
export type Scene = { key: string; naziv: string; t?: number; draw: () => ReactNode };
export type Ekran = { id: string; naziv: string; scenes: Scene[] };

const frames = (base: string, naziv: string, draw: () => ReactNode, times: readonly number[] = FRAME_TIMES): Scene[] =>
  times.map((t, index) => ({ key: `${base}-k${index}`, naziv: `${naziv} · kadar ${index} (${t} ms)`, t, draw }));

const ME: Who = { ...PROFILE_ME };
const NOV: Who = { name: null, initials: null, place: null, email: 'novi.nalog@example.com' };
const DUGO: Who = { ...PROFILE_DUGO };
const NO_REPUTATION = { averageRating: UNRATED.averageRating, reviewCount: UNRATED.reviewCount };
const REPUTATION = { averageRating: RATED.averageRating, reviewCount: RATED.reviewCount };

export const EKRANI: Ekran[] = [
  { id: 'lista', naziv: 'Dogovori (lista)', scenes: [
    { key: 'lista-sada', naziv: 'Sada', draw: () => <ListaSada items={LIST} /> },
    { key: 'lista-sada-dugo', naziv: 'Sada · dugi nazivi', draw: () => <ListaSada items={LIST_DUGO} /> },
    { key: 'lista-A', naziv: 'A · Par u traci', draw: () => <ListaA items={LIST} /> },
    { key: 'lista-A-dugo', naziv: 'A · dugi nazivi', draw: () => <ListaA items={LIST_DUGO} /> },
    { key: 'lista-A-prazno', naziv: 'A · prazno (isto za B i C)', draw: () => <ListaA items={[]} /> },
    { key: 'lista-B', naziv: 'B · Vreme vodi', draw: () => <ListaB items={LIST} /> },
    { key: 'lista-B-dugo', naziv: 'B · dugi nazivi', draw: () => <ListaB items={LIST_DUGO} /> },
    { key: 'lista-C', naziv: 'C · Potez kao kartica', draw: () => <ListaC items={LIST} /> },
    { key: 'lista-C-dugo', naziv: 'C · dugi nazivi', draw: () => <ListaC items={LIST_DUGO} /> },
  ] },
  { id: 'detalj', naziv: 'Dogovor (detalj)', scenes: [
    { key: 'detalj-sada', naziv: 'Sada · čeka tvoju potvrdu', draw: () => <DetaljSada item={DETALJ_CEKA} brand="Potvrdi završetak" /> },
    { key: 'detalj-sada-dugo', naziv: 'Sada · dugi nazivi', draw: () => <DetaljSada item={DETALJ_DUGO} brand="Potvrdi završetak" /> },
    { key: 'detalj-A', naziv: 'A · Par u traci', draw: () => <DetaljA item={DETALJ_CEKA} phase="ceka" /> },
    { key: 'detalj-A-dugo', naziv: 'A · dugi nazivi', draw: () => <DetaljA item={DETALJ_DUGO} phase="ceka" /> },
    { key: 'detalj-A-mir', naziv: 'A · ništa ne čeka tebe', draw: () => <DetaljA item={DETALJ_DOGOVOREN} phase="dogovoren" /> },
    { key: 'detalj-A-bez', naziv: 'A · bez termina', draw: () => <DetaljA item={DETALJ_BEZ_TERMINA} phase="bez-termina" /> },
    { key: 'detalj-B', naziv: 'B · Vreme vodi', draw: () => <DetaljB item={DETALJ_CEKA} phase="ceka" /> },
    { key: 'detalj-B-dugo', naziv: 'B · dugi nazivi', draw: () => <DetaljB item={DETALJ_DUGO} phase="ceka" /> },
    { key: 'detalj-B-mir', naziv: 'B · ništa ne čeka tebe', draw: () => <DetaljB item={DETALJ_DOGOVOREN} phase="dogovoren" /> },
    { key: 'detalj-B-bez', naziv: 'B · bez termina', draw: () => <DetaljB item={DETALJ_BEZ_TERMINA} phase="bez-termina" /> },
    { key: 'detalj-C', naziv: 'C · Potez kao kartica', draw: () => <DetaljC item={DETALJ_CEKA} phase="ceka" /> },
    { key: 'detalj-C-dugo', naziv: 'C · dugi nazivi', draw: () => <DetaljC item={DETALJ_DUGO} phase="ceka" /> },
    { key: 'detalj-C-mir', naziv: 'C · ništa ne čeka tebe', draw: () => <DetaljC item={DETALJ_DOGOVOREN} phase="dogovoren" /> },
    { key: 'detalj-C-bez', naziv: 'C · bez termina', draw: () => <DetaljC item={DETALJ_BEZ_TERMINA} phase="bez-termina" /> },
  ] },
  { id: 'potvrdjeno', naziv: 'Trenutak „Potvrđeno“', scenes: [
    { key: 'potvrdjeno-sada', naziv: 'Sada · posle potvrde', draw: () => <DetaljSada item={DETALJ_POTVRDJEN} ownRating="DUE" brand="Oceni saradnju" /> },
    { key: 'potvrdjeno-A', naziv: 'A · linija do kvačice', draw: () => <DetaljA item={DETALJ_POTVRDJEN} phase="potvrdjeno" /> },
    ...frames('potvrdjeno-A', 'A', () => <DetaljA item={DETALJ_POTVRDJEN} phase="potvrdjeno" />),
    { key: 'potvrdjeno-B', naziv: 'B · rečenica i vreme', draw: () => <DetaljB item={DETALJ_POTVRDJEN} phase="potvrdjeno" /> },
    ...frames('potvrdjeno-B', 'B', () => <DetaljB item={DETALJ_POTVRDJEN} phase="potvrdjeno" />),
    { key: 'potvrdjeno-C', naziv: 'C · zapis uskače odozgo', draw: () => <DetaljC item={DETALJ_POTVRDJEN} phase="potvrdjeno" /> },
    ...frames('potvrdjeno-C', 'C', () => <DetaljC item={DETALJ_POTVRDJEN} phase="potvrdjeno" />),
  ] },
  { id: 'ocena', naziv: 'Ocena saradnje', scenes: [
    { key: 'ocena-sada', naziv: 'Sada', draw: () => <OcenaSada /> },
    { key: 'ocena-sada-prazno', naziv: 'Sada · bez izabrane ocene', draw: () => <OcenaSada initial={0} /> },
    { key: 'ocena-A', naziv: 'A · Zvezde 2.5D', draw: () => <OcenaA person={REVIEW_PERSON} /> },
    { key: 'ocena-A-prazno', naziv: 'A · bez izabrane ocene', draw: () => <OcenaA person={REVIEW_PERSON} initial={0} /> },
    { key: 'ocena-A-dugo', naziv: 'A · dugi nazivi', draw: () => <OcenaA person={REVIEW_PERSON_DUGO} /> },
    { key: 'ocena-B', naziv: 'B · Broj i reč', draw: () => <OcenaB person={REVIEW_PERSON} /> },
    { key: 'ocena-B-prazno', naziv: 'B · bez izabrane ocene', draw: () => <OcenaB person={REVIEW_PERSON} initial={0} /> },
    { key: 'ocena-B-dugo', naziv: 'B · dugi nazivi', draw: () => <OcenaB person={REVIEW_PERSON_DUGO} /> },
    { key: 'ocena-C', naziv: 'C · Punjenje', draw: () => <OcenaC person={REVIEW_PERSON} /> },
    ...frames('ocena-C', 'C · punjenje', () => <OcenaC person={REVIEW_PERSON} />, [0, 60, 120, 400]),
    { key: 'ocena-C-prazno', naziv: 'C · bez izabrane ocene', draw: () => <OcenaC person={REVIEW_PERSON} initial={0} /> },
    { key: 'ocena-C-dugo', naziv: 'C · dugi nazivi', draw: () => <OcenaC person={REVIEW_PERSON_DUGO} /> },
  ] },
  { id: 'sacuvano', naziv: '„Ocena je sačuvana“', scenes: [
    { key: 'sacuvano-sada', naziv: 'Sada', draw: () => <OcenaSada saved /> },
    { key: 'sacuvano-A', naziv: 'A · pilula pada, sjaj', draw: () => <SacuvanoA person={REVIEW_PERSON} /> },
    ...frames('sacuvano-A', 'A', () => <SacuvanoA person={REVIEW_PERSON} />),
    { key: 'sacuvano-B', naziv: 'B · „Hvala, Ana.“', draw: () => <SacuvanoB person={REVIEW_PERSON} /> },
    { key: 'sacuvano-B-bez-imena', naziv: 'B · bez imena', draw: () => <SacuvanoB person={REVIEW_PERSON} myName={null} /> },
    { key: 'sacuvano-C', naziv: 'C · naslov se menja u mestu', draw: () => <SacuvanoC person={REVIEW_PERSON} /> },
    ...frames('sacuvano-C', 'C', () => <SacuvanoC person={REVIEW_PERSON} />),
  ] },
  { id: 'profil', naziv: 'Moj profil', scenes: [
    { key: 'profil-sada', naziv: 'Sada', draw: () => <ProfilSada /> },
    { key: 'profil-A', naziv: 'A · Lice i tri broja', draw: () => <ProfilA who={ME} stats={STATS} reputation={REPUTATION} /> },
    { key: 'profil-A-nov', naziv: 'A · nov nalog', draw: () => <ProfilA who={NOV} stats={STATS_NOV} reputation={NO_REPUTATION} /> },
    { key: 'profil-A-dugo', naziv: 'A · dugo ime', draw: () => <ProfilA who={DUGO} stats={STATS} reputation={REPUTATION} /> },
    { key: 'profil-B', naziv: 'B · Brojevi vode', draw: () => <ProfilB who={ME} stats={STATS} reputation={REPUTATION} /> },
    { key: 'profil-B-nov', naziv: 'B · nov nalog', draw: () => <ProfilB who={NOV} stats={STATS_NOV} reputation={NO_REPUTATION} /> },
    { key: 'profil-B-dugo', naziv: 'B · dugo ime', draw: () => <ProfilB who={DUGO} stats={STATS} reputation={REPUTATION} /> },
    { key: 'profil-C', naziv: 'C · Kartica poverenja', draw: () => <ProfilC who={ME} stats={STATS} reputation={REPUTATION} /> },
    { key: 'profil-C-nov', naziv: 'C · nov nalog', draw: () => <ProfilC who={NOV} stats={STATS_NOV} reputation={NO_REPUTATION} /> },
    { key: 'profil-C-dugo', naziv: 'C · dugo ime', draw: () => <ProfilC who={DUGO} stats={STATS} reputation={REPUTATION} /> },
  ] },
  { id: 'javni', naziv: 'Javni profil', scenes: [
    { key: 'javni-sada', naziv: 'Sada', draw: () => <JavniSada /> },
    { key: 'javni-A', naziv: 'A · Lice i tri broja', draw: () => <JavniA profile={PUBLIC} trust={TRUST} /> },
    { key: 'javni-A-nov', naziv: 'A · bez ocena', draw: () => <JavniA profile={PUBLIC_NOV} trust={TRUST_NOV} /> },
    { key: 'javni-A-dugo', naziv: 'A · dugo ime', draw: () => <JavniA profile={PUBLIC_DUGO} trust={TRUST} /> },
    { key: 'javni-B', naziv: 'B · Brojevi vode', draw: () => <JavniB profile={PUBLIC} trust={TRUST} /> },
    { key: 'javni-B-nov', naziv: 'B · bez ocena', draw: () => <JavniB profile={PUBLIC_NOV} trust={TRUST_NOV} /> },
    { key: 'javni-C', naziv: 'C · Kartica poverenja', draw: () => <JavniC profile={PUBLIC} trust={TRUST} /> },
    { key: 'javni-C-nov', naziv: 'C · bez ocena', draw: () => <JavniC profile={PUBLIC_NOV} trust={TRUST_NOV} /> },
    { key: 'javni-C-dugo', naziv: 'C · dugo ime', draw: () => <JavniC profile={PUBLIC_DUGO} trust={TRUST} /> },
  ] },
];

export const SCENES: Scene[] = EKRANI.flatMap(ekran => ekran.scenes);
export const sceneByKey = (key: string | undefined): Scene | undefined => key ? SCENES.find(scene => scene.key === key) : undefined;
