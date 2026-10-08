import type { StanjeProfila } from '../../contracts/projections';
import { cityLabel } from './cityLabel';

/** The longest stretch of one skill said in the summary line; the whole list is one tap away, in the work profile. */
const SKILL_CLIP = 32;
const clip = (text: string): string => {
  const letters = Array.from(text.replace(/\s+/g, ' ').trim());
  return letters.length <= SKILL_CLIP ? letters.join('') : `${letters.slice(0, SKILL_CLIP).join('').trimEnd()}…`;
};

/** What the profile's row needs of a work profile: its state, its skills, its city and its radius. Anything it does not hold is not said. */
export type WorkProfileFacts = { stanje: StanjeProfila | null; vestine?: readonly string[]; grad?: string | null; radijusKm?: number | null };

/** The words of a state, as the adjective of "profil" (no grammatical gender of the person: "Aktivan" belongs to "radni profil"). */
const STATE_WORD: Record<StanjeProfila, string> = { ACTIVE: 'Aktivan', DRAFT: 'Nacrt', SUSPENDED: 'Suspendovan' };

/**
 * What the work profile says about itself in the ONE line under its row on the profile (owner's phone, 8 Oct 2026: "Profil je aktivan."
 * and two rows under it for the area and the week said less than this): "Aktivan · Moleraj · Novi Sad, 100 km", that is, its state, its first
 * skill (and how many more there are) and its area. A part that does not exist is not said: a draft with no skills yet is "Nacrt · Novi Sad,
 * 100 km", and one with nothing at all is "Nacrt". No profile is "Još nije podešen"; a suspended one says what to do; a state the app does
 * not know says nothing (never "Aktivan").
 *
 * The long explanations that used to stand here ("Dok je nacrt, zadaci ti se ne nude.", "Bez njega ne možeš da se prijaviš na zadatak.") are
 * said where the profile is, on its own screen, and the orange dot on the row says that something waits.
 */
export function workProfileSummary(profile: WorkProfileFacts | null): string | undefined {
  if (!profile) return 'Još nije podešen';
  if (profile.stanje === null || STATE_WORD[profile.stanje] === undefined) return undefined;
  if (profile.stanje === 'SUSPENDED') return `${STATE_WORD.SUSPENDED}. Obrati se podršci.`;
  const skills = (profile.vestine ?? []).map(skill => skill.trim()).filter(Boolean);
  const city = profile.grad?.trim() ? cityLabel(profile.grad) : '';
  const radius = typeof profile.radijusKm === 'number' && Number.isFinite(profile.radijusKm) && profile.radijusKm > 0 ? `${profile.radijusKm} km` : '';
  const parts = [STATE_WORD[profile.stanje],
    skills.length ? `${clip(skills[0])}${skills.length > 1 ? ` +${skills.length - 1}` : ''}` : '',
    city ? (radius ? `${city}, ${radius}` : city) : ''];
  return parts.filter(Boolean).join(' · ');
}
