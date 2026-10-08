import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { FactArt } from './FactArt';
import { FactRow } from './FactRow';
import { FlowFooter } from './FlowFooter';
import { ListRow } from './ListRow';
import { OfflineLine } from './OfflineLine';
import { OutcomeUncertain } from './OutcomeUncertain';
import { OUTCOME, cannotLoad } from './outcomeCopy';
import { Section } from './Section';
import { StateView } from './StateView';
import { brandAction, sys } from './tokens';

/**
 * The state scenes of the gallery (`uskociapp://dizajn-sistem?scene=stanja`, UI/UX pass 2026-10-08, F8b): every state the system draws, from
 * fixtures, so the lead can photograph them in the design lab and on the emulator and the next family can see what to import. Nothing here
 * reads or writes data, and every press does nothing (the one that "checks" only shows its spinner for a moment, to be looked at).
 *
 * Each state is a FULL screen under its bar, because where the block lies (a third of the way down) is only what a screen shows when the
 * block has a whole screen. The words are `outcomeCopy.ts`, as the screens will import them; the empty ones are the app's own, as the rules in
 * the header of `StateView` write them: the first time ("Još nemaš ...", a hero: the picture at 144), because of a filter ("... u ovom prikazu") and
 * because everything is done (both at 96).
 */
export type StateSceneKey = 'prazno-prvi' | 'prazno-filter' | 'prazno-gotovo' | 'ucitavanje-redovi' | 'ucitavanje-zapisi' | 'ucitavanje-cinjenice'
  | 'greska' | 'bez-veze' | 'bez-veze-traka' | 'usluga' | 'nije-sigurno' | 'nije-sigurno-provera' | 'nije-sigurno-traka' | 'sekcija' | 'dugi';

export const STATE_SCENES: { key: StateSceneKey; label: string; hint: string; scroll?: boolean }[] = [
  { key: 'prazno-prvi', label: 'Prazno, prvi put', hint: 'Još nemaš zadatak, predmet vrata 144' },
  { key: 'prazno-filter', label: 'Prazno zbog filtera', hint: 'Nema zadataka u ovom prikazu' },
  { key: 'prazno-gotovo', label: 'Prazno, sve je gotovo', hint: 'Bez radnje' },
  { key: 'ucitavanje-redovi', label: 'Učitavanje, redovi', hint: 'Skelet reda: iste mere kao ListRow', scroll: true },
  { key: 'ucitavanje-zapisi', label: 'Učitavanje, zapisi', hint: 'Skelet zapisa: isti okvir kao Surface record', scroll: true },
  { key: 'ucitavanje-cinjenice', label: 'Učitavanje, činjenice', hint: 'Skelet činjenice: iste mere kao FactRow', scroll: true },
  { key: 'greska', label: 'Greška pri čitanju', hint: 'Ne možemo da učitamo Dogovore' },
  { key: 'bez-veze', label: 'Bez veze', hint: 'Nema internet veze, ceo ekran' },
  { key: 'bez-veze-traka', label: 'Bez veze, traka', hint: 'Nema veze, poslednje učitano ostaje', scroll: true },
  { key: 'usluga', label: 'Usluga ne radi', hint: 'Nije do tvog telefona' },
  { key: 'nije-sigurno', label: 'Nije sigurno', hint: 'Ne znamo da li je prijava stigla, dugme Proveri' },
  { key: 'nije-sigurno-provera', label: 'Nije sigurno, provera u toku', hint: 'Dugme pokazuje da radi' },
  { key: 'nije-sigurno-traka', label: 'Nije sigurno, traka u toku', hint: 'Beleška iznad radnje, tok ostaje' },
  { key: 'sekcija', label: 'Unutar odeljka', hint: 'compact: manja slika, bez spuštanja', scroll: true },
  { key: 'dugi', label: 'Dugi nazivi', hint: 'Najduže reči koje stanje sreće' },
];

const noop = () => undefined;
const art = (kind: 'pin' | 'bell' | 'users' | 'agreements' | 'chat') => <FactArt kind={kind} size={32} />;

/** What a screen shows when the read failed but it still has what it loaded before: the rows, and the strip over them. */
function RowsUnderTheStrip() {
  return <>
    <OfflineLine onRefresh={noop} />
    <Section title="Dogovori">
      <ListRow leading={art('agreements')} title="Montaža police u hodniku" subtitle="Sutra · 17:00 · Liman, Novi Sad" onPress={noop} />
      <ListRow leading={art('agreements')} title="Prenos ormana do kombija" subtitle="Petak · 09:00 · Novo naselje" onPress={noop} />
      <ListRow leading={art('agreements')} title="Farbanje ograde" subtitle="Sledeće nedelje · Petrovaradin" onPress={noop} last />
    </Section>
  </>;
}

/** The form a send was made from: it stays on the screen, and the note in its foot says that the send is not known. */
function PendingSend() {
  return <View style={s.flow}>
    <T variant="pageTitle">Tvoja prijava</T>
    <View style={s.facts}>
      <FactRow size="detail" art="pin" value="Montaža police u hodniku, Liman, Novi Sad" />
      <FactRow size="detail" art="clock" value="Sutra · 17:00–19:00" />
      <FactRow size="detail" art="money" value="3.000 RSD" />
    </View>
  </View>;
}

/**
 * The foot of the scene that has one: the note and, under it, the form's green action, which cannot be pressed until the check says. The note
 * has no quiet way out here, as it will not in most flows: the form is the screen and its bar has the arrow back.
 */
export function stateFooter(scene: StateSceneKey): ReactNode | undefined {
  return scene === 'nije-sigurno-traka' ? <PendingFoot /> : undefined;
}

/** The only fixture with a press that does something: "Proveri" starts the spinner and the next press stops it, so both can be looked at. */
function PendingFoot() {
  const [checking, setChecking] = useState(false);
  return <FlowFooter>
    <OutcomeUncertain layout="inline" about="application" checking={checking} onCheck={() => setChecking(value => !value)} />
    <V2Action label="Pošalji prijavu" onPress={noop} disabled style={brandAction} />
  </FlowFooter>;
}

function Checking() {
  return <OutcomeUncertain about="application" checking onCheck={noop} quiet={{ label: 'Nazad na zadatak', onPress: noop }} />;
}

export function StateScene({ scene }: { scene: StateSceneKey }) {
  const load = cannotLoad('Dogovore');
  switch (scene) {
    // The first encounter is a hero: the picture is the object of the door that fulfils it (the paper with the pin of "Objavi zadatak"), at 144.
    case 'prazno-prvi': return <StateView hero art="publish" title="Još nemaš zadatak" body="Reci šta ti treba. Nacrt pregledaš pre objave."
      primary={{ label: 'Objavi prvi zadatak', onPress: noop }} quiet={{ label: 'Pogledaj zadatke', onPress: noop }} />;
    case 'prazno-filter': return <StateView art="map" title="Nema zadataka u ovom prikazu" body="Promeni pretragu ili filtere."
      primary={{ label: 'Poništi filtere', onPress: noop }} />;
    case 'prazno-gotovo': return <StateView art="check" title="Ništa ne čeka tvoju odluku" body="Kad se nešto promeni, javićemo ti." />;
    case 'ucitavanje-redovi': return <StateView kind="loading" title="Učitavamo obaveštenja…" skeleton={{ variant: 'row', count: 5, heading: true }} />;
    case 'ucitavanje-zapisi': return <StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'record', count: 3, rows: 2, foot: true }} />;
    case 'ucitavanje-cinjenice': return <StateView kind="loading" title="Učitavamo zadatak…" skeleton={{ variant: 'fact', count: 3 }} />;
    case 'greska': return <StateView kind="error" art="agreements" title={load.title} body={load.copy} primary={{ label: load.action, onPress: noop }} />;
    case 'bez-veze': return <StateView kind="offline" title={OUTCOME.offline.title} body={OUTCOME.offline.copy} primary={{ label: OUTCOME.offline.action, onPress: noop }} />;
    case 'bez-veze-traka': return <RowsUnderTheStrip />;
    case 'usluga': return <StateView kind="error" title={OUTCOME.unavailable.title} body={OUTCOME.unavailable.copy}
      primary={{ label: OUTCOME.unavailable.action, onPress: noop }} />;
    case 'nije-sigurno': return <OutcomeUncertain about="application" onCheck={noop} quiet={{ label: 'Nazad na zadatak', onPress: noop }} />;
    case 'nije-sigurno-provera': return <Checking />;
    case 'nije-sigurno-traka': return <PendingSend />;
    case 'sekcija': return <>
      <Section title="Pitanja o zadatku">
        <StateView compact art="chat" title="Još nema objavljenih odgovora" body="Odgovoreno pitanje se ovde prikazuje javno." />
      </Section>
      <Section title="Prijave">
        <StateView compact kind="error" art="offers" title="Prijave nisu učitane" body="Proveri vezu." primary={{ label: 'Pokušaj ponovo', onPress: noop }} />
      </Section>
    </>;
    case 'dugi': return <StateView kind="error" art="agreements"
      title="Ne možemo da učitamo Dogovore za montažu nameštaja, selidbu i manje popravke u stanu"
      body="Proveri vezu sa internetom na telefonu. Ono što si uneo ostaje sačuvano dok se veza ne vrati."
      primary={{ label: 'Pokušaj ponovo da učitaš sve Dogovore', onPress: noop }} quiet={{ label: 'Vrati se na Početnu stranu aplikacije', onPress: noop }} />;
  }
}

const s = StyleSheet.create({
  flow: { gap: sys.space.base },
  facts: { gap: sys.space.sm },
});
