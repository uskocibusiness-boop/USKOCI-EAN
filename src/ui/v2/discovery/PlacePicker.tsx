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
  withTasks: 'Mesta sa zadacima', citiesWithTasks: 'Gradovi sa zadacima', parts: 'Delovi grada', popular: 'Popularni gradovi',
  noTasksYet: 'Još nema zadataka', noTasksLead: 'Još nema', noneNow: 'Nema zadataka', inParts: 'po delovima grada', partsOnly: 'Zadaci su po delovima grada',
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
 * "Gradovi brojem" (the owner's pick of 8 Oct 2026): the NUMBER of tasks leads every row and the place stands beside it, so the list is no longer one pin repeated;
 * only the map's area and the person's own position, which have no number to lead with, wear a picture, and a city nobody has posted in says "Još nema" where the
 * number would be. What a screen reader hears is unchanged: the place and its count in one sentence.
 *
 * Nothing typed: "Svi zadaci", the map's area and "U blizini", then the places that have tasks (with how many; with the server's city list they are
 * CITIES, and choosing one lists exactly its count), then the biggest cities of Serbia that have none listed above, each with what the tasks can honestly say about it:
 *   - tasks name exactly the city: it is one of the places above and is not repeated;
 *   - tasks are under parts of the city: the row leads to those parts (the place filter matches the whole text, so it cannot
 *     say "all of Beograd" and never pretends to);
 *   - no task anywhere: "Još nema zadataka", and choosing it is the ordinary place filter, which answers "no tasks yet";
 *   - places not all read: nothing is claimed, and the row leads to the places that contain the name.
 * Letters typed: the same rows, only those that contain them (a letter without its diacritic finds the same place), and under the cities the parts of a city that
 * contain them ("Liman, Novi Sad"), which no city row does.
 */
export function PlacePicker({ typed, onType, remote, anywhere, area, nearby, places, parts = [], cities: byCity = false, serverFiltered = false, chosenPlace, ready, complete, more, note, onPlace, onWord }: {
  typed: string; onType: (text: string) => void;
  /** Work done remotely has no place: the choices give way to one sentence. */ remote: boolean;
  anywhere: { checked: boolean; count: number | null; onPress: () => void };
  area: { available: boolean; checked: boolean; count: number | null; onPress: () => void };
  nearby: { available: boolean; checked: boolean; onPress: () => void };
  /** Every place the tasks name, with how many (null while that is not known). */ places: readonly PlaceEntry[];
  /** The parts of a city that contain the letters typed, with how many (the server's AREA rows). Nothing while nothing is typed. */ parts?: readonly PlaceEntry[];
  /** The rows of `places` are cities (the server's city list): the group is named for them. */ cities?: boolean;
  /**
   * The rows are already the ones that contain the letters typed (the server's prefix, which folds Serbian letters its own way: "dj" for "đ"), so they are not filtered again here, where
   * "đ" folds to "d". Without the server (the loaded rows) every place is held and the letters filter them.
   */
  serverFiltered?: boolean;
  chosenPlace: string | null;
  /** Whether the places held answer what is typed now; false while they are still being read (nothing is said missing then). */ ready: boolean;
  /** Whether every place with tasks has been read; false while more are to come. */ complete: boolean;
  /** The server has more places to read. */ more: { label: string; busy: boolean; onPress: () => void } | null;
  /** A quiet line when the places could not be read. */ note: string | null;
  onPlace: (text: string) => void; onWord: (text: string) => void;
}) {
  const typing = foldPlace(typed) !== '';
  const shown = useMemo(() => serverFiltered ? places : places.filter(place => placeMatches(place.text, typed)), [places, typed, serverFiltered]);
  // A part of a city is listed once, and never as a city of the list above.
  const partsShown = useMemo(() => typing ? parts.filter(part => !shown.some(place => placeKey(place.text) === placeKey(part.text))) : [], [parts, shown, typing]);
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
        <PlaceRow count={anywhere.count} text="Svi zadaci" label={anywhereCount.label} checked={anywhere.checked} onPress={anywhere.onPress} />
        {area.available ? <PlaceRow art="map" text="Ova oblast" note={areaCount.note} label={areaCount.label} checked={area.checked} onPress={area.onPress} /> : null}
        {nearby.available ? <PlaceRow art="pin" text="U blizini" note={PLACE_WORDS.nearbyNote} label="U blizini" hint={PLACE_WORDS.nearbyHint}
          checked={nearby.checked} onPress={nearby.onPress} /> : null}
      </>}
      {shown.length ? <GroupTitle>{byCity ? PLACE_WORDS.citiesWithTasks : PLACE_WORDS.withTasks}</GroupTitle> : null}
      {shown.map(place => <PlaceRow key={placeKey(place.text)} count={place.count} text={place.text} label={counted(place.text, place.count).label}
        checked={chosen !== null && chosen === placeKey(place.text)} onPress={() => onPlace(place.text)} />)}
      {more ? <V2Action label={more.label} disabled={more.busy} kind="quiet" onPress={more.onPress} /> : null}
      {partsShown.length ? <GroupTitle>{PLACE_WORDS.parts}</GroupTitle> : null}
      {partsShown.map(part => <PlaceRow key={`part:${placeKey(part.text)}`} count={part.count} text={part.text} label={counted(part.text, part.count).label}
        checked={chosen !== null && chosen === placeKey(part.text)} onPress={() => onPlace(part.text)} />)}
      {note ? <T variant="note" tone="muted">{note}</T> : null}
      {cities.length ? <GroupTitle>{PLACE_WORDS.popular}</GroupTitle> : null}
      {cities.map(({ city, standing }) => {
        if (standing.kind === 'none') {
          return <PlaceRow key={`city:${city}`} lead={PLACE_WORDS.noTasksLead} text={city} label={`${city}, ${PLACE_WORDS.noTasksYet}`}
            checked={chosen === placeKey(city)} onPress={() => onPlace(city)} />;
        }
        if (standing.kind === 'parts') {
          // The figure leads the row; what the tasks are split by is the line under the city.
          const line = standing.count === null ? PLACE_WORDS.partsOnly : `${zadataka(standing.count)} · ${PLACE_WORDS.inParts}`;
          const under = standing.count === null ? PLACE_WORDS.partsOnly : PLACE_WORDS.inParts.charAt(0).toLocaleUpperCase('sr-Latn-RS') + PLACE_WORDS.inParts.slice(1);
          return <PlaceRow key={`city:${city}`} count={standing.count} text={city} note={under} label={`${city}, ${line}`} role="button" hint={PLACE_WORDS.showParts}
            onPress={() => onType(city)} />;
        }
        return <PlaceRow key={`city:${city}`} text={city} label={city} role="button" hint={PLACE_WORDS.showPlaces} onPress={() => onType(city)} />;
      })}
      {typing && ready && !shown.length && !partsShown.length && !cities.length && !note ? <>
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
