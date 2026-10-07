import type {
  Cinjenica,
  IzvorCinjenice,
  KljucCinjenice,
  NacrtPotrebeProjekcija,
  OdlukaBezbednosti,
  PorukaRazgovora,
  StatusCinjenice,
} from '../contracts/projections';
import type { Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type AiOverrides = Pick<Izvor, 'otvoriRazgovor' | 'razgovor'>;

const PODRZANI_KLJUCEVI = new Set<KljucCinjenice>([
  'naslov', 'opis', 'kategorija', 'datum', 'vreme',
  'polaziste', 'odrediste', 'osoba', 'vozilo', 'uslovi',
]);

const MINIMALNO_OBAVEZNO: KljucCinjenice[] = ['naslov', 'opis', 'kategorija'];
const SAFETY = new Set<OdlukaBezbednosti>(['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK']);

function prikaziVrednost(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(prikaziVrednost).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['text', 'value', 'label', 'name']) {
      if (typeof record[key] === 'string') return record[key] as string;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

function mapStatus(status: string, source: string): StatusCinjenice {
  if (status === 'CONFIRMED') return 'POTVRDJENO';
  if (status === 'NEEDS_CONFIRMATION' || status === 'PROPOSED') return 'TRAZI_POTVRDU';
  if (status === 'INFERRED' || source === 'AI_INFERENCE') return 'ZAKLJUCENO';
  return 'NEPOZNATO';
}

function mapSource(source: string): IzvorCinjenice {
  if (source === 'EXPLICIT_USER_ANSWER' || source === 'USER') return 'KORISNIK';
  if (source === 'CONFIRMED_PROFILE' || source === 'PROFILE') return 'PROFIL';
  if (source === 'AI_INFERENCE' || source === 'AI') return 'AI_ZAKLJUCAK';
  return 'SISTEM';
}

function mapFact(raw: any): Cinjenica | null {
  if (!PODRZANI_KLJUCEVI.has(raw.fact_key as KljucCinjenice)) return null;
  const prikaz = prikaziVrednost(raw.fact_value).trim();
  if (!prikaz) return null;
  return {
    id: raw.id,
    kljuc: raw.fact_key as KljucCinjenice,
    prikaz,
    status: mapStatus(String(raw.status ?? ''), String(raw.source ?? '')),
    izvor: mapSource(String(raw.source ?? '')),
    citat: typeof raw.evidence_excerpt === 'string' && raw.evidence_excerpt.trim()
      ? raw.evidence_excerpt.trim()
      : null,
  };
}

export const aiProductionOverrides: AiOverrides = {
  async otvoriRazgovor() {
    return { ok: false, kod: 'OWNED_CONVERSATION_REQUIRED',
      poruka: 'Otvori novi zadatak da započneš razgovor.' };
  },

  async razgovor(razgovorId) {
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_conversations')
      .select('id, purpose, status, bound_need_id')
      .eq('id', razgovorId)
      .eq('purpose', 'NEED_INTAKE')
      .maybeSingle();

    if (conversationError) throw new Error('AI_CONVERSATION_READ_FAILED');
    if (!conversation) return null;

    const [factsResult, messagesResult] = await Promise.all([
      supabase
        .from('ai_structured_facts')
        .select('id, fact_key, fact_value, status, source, evidence_excerpt, created_at')
        .eq('conversation_id', razgovorId)
        .is('superseded_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('ai_messages')
        .select('id, role, body, safety, proposed_fact_ids, sequence_no')
        .eq('conversation_id', razgovorId)
        .order('sequence_no', { ascending: true }),
    ]);

    if (factsResult.error) throw new Error('AI_FACTS_READ_FAILED');
    if (messagesResult.error) throw new Error('AI_MESSAGES_READ_FAILED');

    const latest = new Map<KljucCinjenice, Cinjenica>();
    for (const row of factsResult.data ?? []) {
      const fact = mapFact(row);
      if (fact) latest.set(fact.kljuc, fact);
    }
    const cinjenice = [...latest.values()];
    const prisutni = new Set(cinjenice.map((fact) => fact.kljuc));
    const nedostaje = MINIMALNO_OBAVEZNO.filter((key) => !prisutni.has(key));

    const poruke: PorukaRazgovora[] = (messagesResult.data ?? []).map((row: any) => ({
      id: row.id,
      odAI: row.role === 'ASSISTANT',
      telo: row.body,
      predlozene: Array.isArray(row.proposed_fact_ids) ? row.proposed_fact_ids : [],
    }));

    let bezbednost: OdlukaBezbednosti = 'REVIEW';
    let bezbednostPoruka: string | null =
      'Nacrt je sačuvan. Objava još nije otvorena — pokušaj ponovo kasnije.';

    for (let i = (messagesResult.data?.length ?? 0) - 1; i >= 0; i -= 1) {
      const row: any = messagesResult.data?.[i];
      if (row?.role !== 'ASSISTANT' || !SAFETY.has(row?.safety as OdlukaBezbednosti)) continue;
      bezbednost = row.safety as OdlukaBezbednosti;
      bezbednostPoruka = bezbednost === 'ALLOW' ? null : String(row.body ?? '').trim() || null;
      break;
    }

    const nacrt: NacrtPotrebeProjekcija = {
      razgovorId,
      cinjenice,
      nedostaje,
      bezbednost,
      bezbednostPoruka,
      // Human-confirmed facts are persisted, but rpc_ai_publish_need is still
      // deliberately fail-closed. UI cannot promote itself to publish authority.
      spremnoZaObjavu: false,
    };

    return { poruke, nacrt };
  },
};
