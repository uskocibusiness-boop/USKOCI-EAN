import type { WorkerAiProfile } from '../../data/workerAiClientService';

/**
 * What the worker profile may SAY about itself (owner, 2026-10-07: the profile text says truthfully what its data is used for).
 *
 * Every sentence about an effect depends on something the server really does today. Where the owner has decided on a
 * different behaviour that the server does not have yet, the decision is a named switch here, off, so the screens keep
 * saying what is true and the day the server package is applied is a one-line change in this file.
 */

/**
 * Owner 2026-10-07: tools and vehicles are information, never a condition (PUT_RADNIKA_NACRT_20261007, point 5).
 *
 * OFF until the server package that removes the condition is applied (final check 2026-10-07, finding G1): today
 * `private.match_detail_without_calendar` treats a missing required tool or vehicle as a HARD blocker, so such a task is
 * not offered and `rpc_submit_response` refuses the application (`WORKER_NOT_ELIGIBLE`). Turning this on changes only the
 * words of the profile screens; applying the package still needs the owner's exact "PRIMENI".
 */
export const TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY = false;

/**
 * The "Za mene" switch on the map and the list (owner 2026-10-07; final check finding G4). OFF until the server
 * understands the filter (`DiscoveryChipRow` keeps its own `forMeAvailable` off for the same reason): a profile screen
 * must not promise a list that does not exist.
 */
export const FOR_ME_SWITCH_EXISTS = false;

/**
 * What the "Dostupnost" row of the work profile says (UX plan 3.8, 2026-10-07): "Raspored" is the name of the planner now, so
 * the row that opens the availability must not send a person looking for a "raspored". It says what it is.
 */
export const availabilityRowDetail = (availableNow: boolean) => availableNow ? 'Mogu odmah · dostupnost' : 'Pogledaj i uredi dostupnost';

/** The parts of the profile a person can correct in one step. */
export type WorkerAiPart = 'identity' | 'skills' | 'area' | 'time' | 'tools';

/** The group titles of the review, and of the editors they open. */
export const WORKER_PART_TITLE: Readonly<Record<WorkerAiPart, string>> = {
  identity: 'O meni', skills: 'Veštine', area: 'Područje', time: 'Kada imaš vremena', tools: 'Alat i vozilo',
};

/** What the conversation has captured so far, from the draft itself (never from how many questions were asked). */
export type CapturedPart = { key: 'skills' | 'area' | 'time' | 'tools'; label: string; done: boolean };
export function capturedParts(profile: WorkerAiProfile): CapturedPart[] {
  const place = profile.location, week = profile.availability;
  return [
    { key: 'skills', label: 'Veštine', done: profile.skills.length > 0 },
    // Activation needs a country and a city (rpc_complete_worker_profile), so a place is captured only when both are there.
    { key: 'area', label: 'Područje', done: !!place.operatingCountryCode && place.city.trim().length > 0 },
    { key: 'time', label: 'Vreme', done: week.availableNow || week.rules.length > 0 || week.windows.length > 0 },
    { key: 'tools', label: 'Alat', done: profile.tools.length > 0 || profile.vehicles.length > 0 },
  ];
}

/** "veštine, područje i vreme": a list of lower-case words the Serbian way. */
const said = (labels: readonly string[]) => labels.length < 2 ? labels[0] ?? ''
  : `${labels.slice(0, -1).join(', ')} i ${labels[labels.length - 1]}`;
/** The one spoken sentence of the progress strip: what the draft holds and what it does not. */
export function capturedSpeech(parts: readonly CapturedPart[]): string {
  const have = parts.filter(part => part.done).map(part => part.label.toLowerCase());
  const missing = parts.filter(part => !part.done).map(part => part.label.toLowerCase());
  return [have.length ? `U nacrtu profila: ${said(have)}.` : 'U nacrtu profila još nema ničega.',
    missing.length ? `Još nema: ${said(missing)}.` : null].filter(Boolean).join(' ');
}

/** The sentence under "Alat i vozilo": what the two lists really do. */
export function toolsAndVehiclesNote(informationOnly: boolean = TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY): string {
  return informationOnly
    ? 'Samo informacija: ne utiču na pretragu ni na obaveštenja.'
    : 'Ako zadatak traži alat ili vozilo koje nemaš na spisku, taj zadatak ti se ne nudi i ne možeš da se prijaviš na njega.';
}
/** The small tag beside the group title, only when the lists really are information. */
export function toolsAndVehiclesTag(informationOnly: boolean = TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY): string | null {
  return informationOnly ? 'samo informacija' : null;
}

/** One row of "Na šta utiče" in the saved profile. `opens` names the screen a row leads to; no row is a dead control. */
export type ProfileEffect = { key: 'notifications' | 'public' | 'forMe'; title: string; detail: string;
  art: 'bell' | 'eye' | 'tasks'; opens?: 'notifications' };
/**
 * Only effects that exist today:
 * - the notifications about tasks that match the skills, the area and the time (new tasks are queued when they are
 *   published or changed; saving the profile queues the open ones again);
 * - the public profile, which shows the name, "O meni" and the city of the work profile to whoever opens it.
 * "Zadaci · Za mene" joins when the switch exists.
 */
export function profileEffects(forMeSwitchExists: boolean = FOR_ME_SWITCH_EXISTS): ProfileEffect[] {
  const rows: ProfileEffect[] = [
    { key: 'notifications', title: 'Obaveštenja', detail: 'Novi i već otvoreni zadaci koji ti odgovaraju', art: 'bell', opens: 'notifications' },
    { key: 'public', title: 'Javni profil', detail: 'Ime, „O meni“ i grad vide osobe koje otvore tvoj profil', art: 'eye' },
  ];
  if (forMeSwitchExists) rows.push({ key: 'forMe', title: 'Zadaci · Za mene', detail: 'Lista po tvom području i vremenu', art: 'tasks' });
  return rows;
}
