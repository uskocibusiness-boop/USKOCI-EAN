import { useMemo } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { placeKey } from '../../../data/marketplaceView';
import { T } from '../../Text';
import { zadataka } from '../../system/plural';
import { sys } from '../../system/tokens';
import { V2Action } from '../V2Action';
import { POPULAR_CITIES, cityStanding, foldPlace, placeMatches, type PlaceRow as PlaceEntry } from './popularCities';
import { GroupTitle, PlaceRow, SearchField } from './SearchParts';
import { quoted } from './discoveryWords';

/** The words of "Gde", in one place. */
export const PLACE_WORDS = {
  field: 'Pretraži mesta', placeholder: 'Grad ili deo grada', clear: 'Obriši pretragu mesta',
  withTasks: 'Mesta sa zadacima', popular: 'Popularni gradovi',
  noTasksYet: 'Još nema zadataka', noneNow: 'Nema zadataka', inParts: 'po delovima grada', partsOnly: 'Zadaci su po delovima grada',
  remote: 'Zadaci na daljinu ne zavise od oblasti mape.',
  facetDown: 'Mesta trenutno nisu dostupna. Pretraga zadataka i dalje radi.',
  nobody: 'Nema takvog mesta.',
  nearbyNote: 'Koristi tvoju lokaciju jednom', nearbyHint: 'Jednom koristi tvoju lokaciju da centrira mapu. Ne čuva je.',
  showParts: 'Prikazuje delove grada.', showPlaces: 'Prikazuje mesta u ovom gradu.',
} as const;

/**
 * What a row says under the place, and what a screen reader says in one go. A place the other conditions leave empty (it was
 * chosen and the days changed) says so plainly; a city nobody has posted in says "Još nema zadataka" instead.
 */
const counted = (text: string, count: number | null) => {
  const note = count === null ? null : count === 0 ? PLACE_WORDS.noneNow : zadataka(count);
  return { note, label: note === null ? text : `${text}, ${note}` };
};

/**
 * The body of "Gde": a field to find a place by letters, then the choices. Typing only finds places; the words that find
 * tasks have their own section ("Šta"), so a letter typed here never silently becomes a search of the tasks' titles.
 *
 * Nothing typed: "Svi zadaci", the map's area and "U blizini", then the places that have tasks (with how many), then the
 * biggest cities of Serbia that have none listed above, each with what the tasks can honestly say about it:
 *   - tasks name exactly the city: it is one of the places above and is not repeated;
 *   - tasks are under parts of the city: the row leads to those parts (the place filter matches the whole text, so it cannot
 *     say "all of Beograd" and never pretends to);
 *   - no task anywhere: "Još nema zadataka", and choosing it is the ordinary place filter, which answers "no tasks yet";
 *   - places not all read: nothing is claimed, and the row leads to the places that contain the name.
 * Letters typed: the same rows, only those that contain them (a letter without its diacritic finds the same place).
 */
export function PlacePicker({ typed, onType, remote, anywhere, area, nearby, places, chosenPlace, ready, complete, more, note, onPlace, onWord }: {
  typed: string; onType: (text: string) => void;
  /** Work done remotely has no place: the choices give way to one sentence. */ remote: boolean;
  anywhere: { checked: boolean; count: number | null; onPress: () => void };
  area: { available: boolean; checked: boolean; count: number | null; onPress: () => void };
  nearby: { available: boolean; checked: boolean; onPress: () => void };
  /** Every place the tasks name, with how many (null while that is not known). */ places: readonly PlaceEntry[];
  chosenPlace: string | null;
  /** Whether the places held answer what is typed now; false while they are still being read (nothing is said missing then). */ ready: boolean;
  /** Whether every place with tasks has been read; false while more are to come. */ complete: boolean;
  /** The server has more places to read. */ more: { label: string; busy: boolean; onPress: () => void } | null;
  /** A quiet line when the places could not be read. */ note: string | null;
  onPlace: (text: string) => void; onWord: (text: string) => void;
}) {
  const typing = foldPlace(typed) !== '';
  const shown = useMemo(() => places.filter(place => placeMatches(place.text, typed)), [places, typed]);
  // A city is listed once: as a place when tasks name it exactly (above), and here otherwise. A city that leads on to its parts is
  // not listed again once its parts are what the list shows (its name is what has been typed).
  const cities = useMemo(() => POPULAR_CITIES.filter(city => placeMatches(city, typed))
    .map(city => ({ city, standing: cityStanding(city, places, complete) }))
    .filter(({ city, standing }) => standing.kind !== 'place'
      && !((standing.kind === 'parts' || standing.kind === 'unknown') && foldPlace(city) === foldPlace(typed))), [places, typed, complete]);
  const chosen = chosenPlace ? placeKey(chosenPlace) : null;
  const anywhereCount = counted('Svi zadaci', anywhere.count), areaCount = counted('Ova oblast', area.count);
  return <View testID="search-place-editor" style={s.editor}>
    <SearchField testID="search-place-field" value={typed} onChangeText={onType} label={PLACE_WORDS.field} placeholder={PLACE_WORDS.placeholder}
      clearLabel={PLACE_WORDS.clear} returnKeyType="search" onSubmit={Keyboard.dismiss} />
    {remote ? <T variant="note" tone="muted">{PLACE_WORDS.remote}</T> : <View accessibilityRole="radiogroup" accessibilityLabel="Mesta" style={s.list}>
      {typing ? null : <>
        <PlaceRow art="tasks" text="Svi zadaci" note={anywhereCount.note} label={anywhereCount.label} checked={anywhere.checked} onPress={anywhere.onPress} />
        {area.available ? <PlaceRow art="map" text="Ova oblast" note={areaCount.note} label={areaCount.label} checked={area.checked} onPress={area.onPress} /> : null}
        {nearby.available ? <PlaceRow art="person" text="U blizini" note={PLACE_WORDS.nearbyNote} label="U blizini" hint={PLACE_WORDS.nearbyHint}
          checked={nearby.checked} onPress={nearby.onPress} /> : null}
      </>}
      {shown.length ? <GroupTitle>{PLACE_WORDS.withTasks}</GroupTitle> : null}
      {shown.map(place => {
        const words = counted(place.text, place.count);
        return <PlaceRow key={placeKey(place.text)} art="pin" text={place.text} note={words.note} label={words.label}
          checked={chosen !== null && chosen === placeKey(place.text)} onPress={() => onPlace(place.text)} />;
      })}
      {more ? <V2Action label={more.label} disabled={more.busy} kind="quiet" onPress={more.onPress} /> : null}
      {note ? <T variant="note" tone="muted">{note}</T> : null}
      {cities.length ? <GroupTitle>{PLACE_WORDS.popular}</GroupTitle> : null}
      {cities.map(({ city, standing }) => {
        if (standing.kind === 'none') {
          return <PlaceRow key={`city:${city}`} art="pin" text={city} note={PLACE_WORDS.noTasksYet} label={`${city}, ${PLACE_WORDS.noTasksYet}`}
            checked={chosen === placeKey(city)} onPress={() => onPlace(city)} />;
        }
        if (standing.kind === 'parts') {
          const line = standing.count === null ? PLACE_WORDS.partsOnly : `${zadataka(standing.count)} · ${PLACE_WORDS.inParts}`;
          return <PlaceRow key={`city:${city}`} art="pin" text={city} note={line} label={`${city}, ${line}`} role="button" hint={PLACE_WORDS.showParts}
            onPress={() => onType(city)} />;
        }
        return <PlaceRow key={`city:${city}`} art="pin" text={city} label={city} role="button" hint={PLACE_WORDS.showPlaces} onPress={() => onType(city)} />;
      })}
      {typing && ready && !shown.length && !cities.length && !note ? <>
        <T variant="note" tone="muted">{PLACE_WORDS.nobody}</T>
        <V2Action label={`Traži ${quoted(typed)} u zadacima`} kind="quiet" onPress={() => onWord(typed.trim())} />
      </> : null}
    </View>}
  </View>;
}

const s = StyleSheet.create({
  editor: { gap: sys.space.md },
  list: { gap: sys.space.xs },
});
