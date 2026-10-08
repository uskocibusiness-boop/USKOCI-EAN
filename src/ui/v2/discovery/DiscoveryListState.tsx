import { StateView } from '../../system/StateView';

/**
 * What the list of Zadaci says when it has no cards to show, in one place (composition spec 2026-10-07, T7): reading, not read, nothing here,
 * nothing for these conditions, nothing at all. Every state has a sentence and a way on, and the words are the family's: "ti", no machine
 * words, no "server". The map and the list always show every published task (owner, 2026-10-07), so an empty list is never about the
 * person's profile, only about where the map stands and what is searched.
 *
 * - `loading`   the first read is on its way: the placeholders have the shape of the cards that are coming.
 * - `error`     the read did not come back: one way on, to try again.
 * - `place`     the map's own area or one point leaves nothing, and the tasks are elsewhere on the map: one move, or one tap, away.
 * - `filtered`  the conditions leave nothing: take them away.
 * - `forMe`     "Za mene" leaves nothing: say what it looks at, and the way back to every task.
 * - `none`      nobody has published a task: read again, or publish one. It is the FIRST encounter of the screen, so it is a `hero` (the owner's pick of
 *               8 Oct 2026, "Predmet vrata"): the map at 144, the object of the screen's own door, and a promise of what will be here. The states that
 *               are about a view (`place`, `filtered`, `forMe`) keep the picture at 96.
 */
export type DiscoveryListStateKind =
  | { kind: 'loading' }
  | { kind: 'error'; onRetry: () => void }
  | { kind: 'place'; point: boolean; onShowAll: () => void }
  | { kind: 'filtered'; onClear: () => void }
  | { kind: 'forMe'; onShowAll: () => void }
  | { kind: 'none'; onRefresh: () => void; onNew?: () => void };

export const LIST_STATE_WORDS = {
  loading: 'Učitavamo zadatke…',
  error: 'Ne možemo da učitamo zadatke',
  errorBody: 'Proveri internet vezu i pokušaj ponovo.',
  retry: 'Pokušaj ponovo',
  showAll: 'Prikaži sve zadatke',
  pointTitle: 'Nema zadataka na ovom mestu', pointBody: 'Pomeri mapu ili prikaži sve zadatke.',
  areaTitle: 'Nema zadataka u ovoj oblasti', areaBody: 'Umanji mapu ili je pomeri da vidiš zadatke u okolini.',
  filteredTitle: 'Nema zadataka u ovom prikazu', filteredBody: 'Nijedan zadatak ne odgovara ovim uslovima.',
  forMeTitle: 'Za sada nema zadataka za tebe', forMeBody: 'Gledamo tvoj radni profil: vrstu posla, područje i vreme. Prikaži sve zadatke da vidiš i ostale.',
  noneTitle: 'Još niko nije tražio pomoć', noneBody: 'Čim neko objavi zadatak, pojaviće se ovde i na mapi.',
  refresh: 'Osveži', publish: 'Objavi zadatak',
} as const;

export function DiscoveryListState({ state, clearAllLabel }: {
  state: DiscoveryListStateKind;
  /** The one label of "take every condition away", shared with the search panel's foot. */
  clearAllLabel: string;
}) {
  const w = LIST_STATE_WORDS;
  switch (state.kind) {
    case 'loading': return <StateView kind="loading" title={w.loading} skeleton={{ variant: 'task' }} />;
    case 'error': return <StateView kind="error" art="tasks" title={w.error} body={w.errorBody} primary={{ label: w.retry, onPress: state.onRetry }} />;
    case 'place': return <StateView art="map" title={state.point ? w.pointTitle : w.areaTitle} body={state.point ? w.pointBody : w.areaBody}
      primary={{ label: w.showAll, onPress: state.onShowAll }} />;
    case 'filtered': return <StateView art="map" title={w.filteredTitle} body={w.filteredBody} primary={{ label: clearAllLabel, onPress: state.onClear }} />;
    case 'forMe': return <StateView art="tasks" title={w.forMeTitle} body={w.forMeBody} primary={{ label: w.showAll, onPress: state.onShowAll }} />;
    case 'none': return <StateView hero art="map" title={w.noneTitle} body={w.noneBody} primary={{ label: w.refresh, onPress: state.onRefresh }}
      quiet={state.onNew ? { label: w.publish, onPress: state.onNew } : undefined} />;
  }
}
