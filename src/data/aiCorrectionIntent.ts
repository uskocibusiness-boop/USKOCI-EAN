import { sesijaSada } from '../store/sesija';
import type { ReceiptAccount } from './serverReceipt';

const WORDS = {
  'task.details': ['Izmena zadatka', 'Napiši šta želiš da promeniš. Ostale podatke možeš da ostaviš iste.'],
  'task.title': ['Naslov zadatka', 'Napiši kakav naslov želiš.'],
  'task.price': ['Cena i ponude', 'Napiši novi budžet ili da želiš ponude. Navedi na šta se iznos odnosi.'],
  'task.time': ['Termin zadatka', 'Napiši novi termin ili da je vreme fleksibilno.'],
  'task.people': ['Broj ljudi', 'Napiši koliko osoba ti je potrebno.'],
  'task.description': ['Opis zadatka', 'Napiši šta u opisu dodaješ, menjaš ili uklanjaš.'],
  'task.requirements': ['Uslovi zadatka', 'Napiši koji uslov želiš da promeniš i kako treba da glasi.'],
  'worker.skills': ['Usluge koje nudiš', 'Napiši koju uslugu dodaješ, menjaš ili više ne nudiš.'],
  'worker.area': ['Područje rada', 'Napiši gde želiš da radiš i da li radiš na lokaciji ili na daljinu.'],
  'worker.time': ['Kada imaš vremena', 'Napiši dane i vreme kada možeš da radiš, ili šta menjaš u dostupnosti.'],
  'worker.tools': ['Alat i vozilo', 'Ako želiš, napiši šta od opreme dodaješ ili uklanjaš. Ovaj podatak nije obavezan.'],
  'worker.identity': ['O meni', 'Napiši kako želiš da te predstavimo drugim ljudima.'],
} as const;
export type AiCorrectionTarget = keyof typeof WORDS;
export type AiCorrectionIntent = Readonly<{ token: string; target: AiCorrectionTarget; title: string; hint: string }>;
type Handoff = Readonly<ReceiptAccount & { conversationId?: string; intent: AiCorrectionIntent }>;
const pending = new Map<string, Handoff>();
let sequence = 0;
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const owns = (owner: ReceiptAccount) => {
  const current = sesijaSada();
  return current.user?.id === owner.accountId && current.accountRevision === owner.accountRevision;
};

/** A local navigation hint, never a user message, fact patch, provider instruction or permission to save. */
export function rememberAiCorrection(owner: ReceiptAccount, target: AiCorrectionTarget, conversationId?: string): AiCorrectionIntent | null {
  if (!owns(owner) || (conversationId !== undefined && !uuid(conversationId))
      || (target.startsWith('task.') && !conversationId)) return null;
  const [title, hint] = WORDS[target];
  const intent = Object.freeze({ token: `ai-correction-${++sequence}`, target, title, hint });
  pending.set(intent.token, { ...owner, conversationId, intent });
  if (pending.size > 20) pending.delete(pending.keys().next().value!);
  return intent;
}

/** One visit, for the same account generation and conversation. Worker entry may resume its server-owned open conversation. */
export function takeAiCorrection(token: unknown, owner: ReceiptAccount, kind: 'task' | 'worker', conversationId: string): AiCorrectionIntent | null {
  if (typeof token !== 'string') return null;
  const handoff = pending.get(token);
  if (!handoff || !owns(owner) || handoff.accountId !== owner.accountId || handoff.accountRevision !== owner.accountRevision
      || !uuid(conversationId) || !handoff.intent.target.startsWith(`${kind}.`)
      || (handoff.conversationId !== undefined && handoff.conversationId !== conversationId)) return null;
  pending.delete(token);
  return handoff.intent;
}

export function taskCorrectionTarget(key: string): AiCorrectionTarget {
  if (key === 'need.title') return 'task.title';
  if (key === 'need.description') return 'task.description';
  if (key === 'need.people_needed') return 'task.people';
  if (/price|budget|currency|amount/.test(key)) return 'task.price';
  if (/schedule|starts|ends|time|date/.test(key)) return 'task.time';
  return 'task.requirements';
}
