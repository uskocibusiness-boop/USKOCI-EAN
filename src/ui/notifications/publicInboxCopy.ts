import type { Notification } from 'expo-notifications';
import { publicPushTarget } from './pushTarget';

// Exact A1 transport title/body pairs, including its urgent opportunity variant
// and both previously shipped generic copies for queued pushes. The runtime
// tests execute the shared Edge formatter to detect any contract drift.
const publicInboxCopies = Object.freeze([
 ['Novi zadatak za tebe', 'Pojavila se nova prilika koja može da ti odgovara.'],
 ['HITNO — nova prilika', 'Pojavila se nova prilika koja može da ti odgovara.'],
 ['Nova prijava', 'Stigla je nova prijava na tvoj zadatak.'],
 ['Prijava je izmenjena', 'Jedna prijava na tvoj zadatak je ažurirana.'],
 ['Prijava je pregledana', 'Tvoja prijava je pregledana.'],
 ['U užem si izboru', 'Tvoja prijava je izdvojena za dalji izbor.'],
 ['Izabran si', 'Tvoja prijava je prihvaćena. Otvori Dogovor.'],
 ['Prijava je završena', 'Za ovaj zadatak je izabrana druga osoba.'],
 ['Proveri prijavu', 'Zadatak je promenjen nakon tvoje prijave.'],
 ['Prijava je povučena', 'Jedna prijava više nije aktivna.'],
 ['Prijava je istekla', 'Ova prijava više nije aktivna.'],
 ['Zadatak je izmenjen', 'Promenjeni su podaci zadatka koji pratiš.'],
 ['Zadatak je otkazan', 'Zadatak više nije aktivan.'],
 ['Dogovor je ažuriran', 'Promenjeni su uslovi Dogovora.'],
 ['Predložena je izmena Dogovora', 'Proveri predložene uslove.'],
 ['Izmena nije prihvaćena', 'Predlog izmene Dogovora nije prihvaćen.'],
 ['Dogovor je otkazan', 'Otvori Dogovor da vidiš trenutno stanje.'],
 ['Status Dogovora je promenjen', 'Otvori Dogovor da vidiš sledeći korak.'],
 ['Potvrdi završetak', 'Druga strana je označila posao kao završen.'],
 ['Nova poruka u Dogovoru', 'Imaš novu poruku.'],
 ['Podaci Dogovora su dostupni', 'Otvori Dogovor da vidiš podatke kojima sada imaš pristup.'],
 ['Oporavak naloga', 'Otvoren je postupak oporavka naloga.'],
 ['Stigla ti je nova ocena', 'Pogledaj novu ocenu saradnje.'],
 ['Novo pitanje za zadatak', 'Stiglo je novo pitanje.'],
 ['Stigao je odgovor', 'Na pitanje za zadatak je odgovoreno.'],
 ['USKOČI', 'Imate novo obaveštenje. Otvorite aplikaciju.'],
 ['USKOČI', 'Imaš novo obaveštenje. Otvori aplikaciju.'],
].map(([title, body]) => Object.freeze({ title, body })));

/**
 * The words the owner decided on (2026-10-07): "ti", no grammatical gender, "zadatak" and never "posao". Three of the pairs above
 * break that rule and the Edge formatter still sends them: "Izabran si" (a masculine participle), "označila posao kao završen"
 * (the banned word) and "Oporavak naloga" for a problem that was reported in a Dogovor (the wrong subject).
 *
 * These are their replacements, ACCEPTED HERE BEFORE THE SERVER SENDS THEM. A pair that is not in this file is not shown
 * while the app is open, so the client has to know the new words first; then the push package (S6) can change
 * `supabase/functions/_shared/pushNotificationCopy.mjs` to exactly these pairs in any order of roll-out, and an old build
 * keeps recognising the old ones until it is retired. No pair here names a person, a task or a place (rule A20: nothing of
 * the task on the lock screen). Nothing in this file sends, registers or enables a push.
 */
export const PLANNED_PUBLIC_INBOX_COPIES = Object.freeze([
 ['Tvoja prijava je izabrana', 'Otvori Dogovor.'],
 ['Potvrdi završetak', 'Zadatak je označen kao gotov.'],
 ['Prijavljen je problem u Dogovoru', 'Otvori Dogovor da vidiš prijavljeni problem.'],
].map(([title, body]) => Object.freeze({ title, body })));

export function isPublicInboxCopy(title: unknown, body: unknown): boolean {
 return typeof title === 'string' && typeof body === 'string'
  && [...publicInboxCopies, ...PLANNED_PUBLIC_INBOX_COPIES].some(copy => copy.title === title && copy.body === body);
}

/** Shared unchanged foreground admission: neither presentation nor a read hint
 * accepts task/chat content, payload routing or arbitrary native decoration.
 */
export function isPublicInboxNotification(notification: Notification): boolean {
 const request = notification?.request, content = request?.content, trigger = request?.trigger;
 if (!request || typeof request.identifier !== 'string' || request.identifier.length < 1 || request.identifier.length > 256
  || !trigger || typeof trigger !== 'object' || !('type' in trigger) || trigger.type !== 'push' || !content || typeof content !== 'object' || Array.isArray(content)) return false;
 const data = content.data, value = content as unknown as Record<string, unknown>;
 if (!isPublicInboxCopy(content.title, content.body)
  || !publicPushTarget(data)) return false;
 if (publicPushTarget(data)?.kind === 'MESSAGE_EVENT'
  && (content.title !== 'Nova poruka u Dogovoru' || content.body !== 'Imaš novu poruku.')) return false;
 if (['subtitle', 'categoryIdentifier', 'summaryArgument', 'launchImageName', 'targetContentIdentifier', 'threadIdentifier']
  .some(key => value[key] != null && value[key] !== '')) return false;
 if (value.attachments != null && (!Array.isArray(value.attachments) || value.attachments.length !== 0)) return false;
 if (content.sound != null && content.sound !== 'default') return false;
 if (value.interruptionLevel != null && value.interruptionLevel !== 'active' && value.interruptionLevel !== 'passive') return false;
 // Android can render a remote image that is not part of content.attachments.
 if (trigger.remoteMessage?.notification?.imageUrl != null) return false;
 return true;
}

/** Identifier is bounded deduplication only; it is never a route, account or message identity. */
export function publicInboxNotificationId(value: unknown): string | null {
 const notification = value as Notification;
 return isPublicInboxNotification(notification) ? notification.request.identifier : null;
}
