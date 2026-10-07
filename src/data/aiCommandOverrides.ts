import { legacyRpcFailure } from './legacyRpcFailure';
import type { Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type AiCommandOverrides = Pick<Izvor, 'posaljiKorisnikovuPoruku' | 'ispraviCinjenicu'>;

async function edgeFailure(_error: unknown) {
  // This historical adapter has no bounded trusted envelope decoder. Do not
  // consume an unbounded provider/auth error body merely to display its text.
  return { ok: false as const, kod: 'AI_EDGE_FAILED',
    poruka: 'Obrada nije potvrđena. Otvori novi zadatak i proveri stanje razgovora.' };
}

export const aiCommandOverrides: AiCommandOverrides = {
  async posaljiKorisnikovuPoruku(razgovorId, telo) {
    const text = telo.trim();
    if (!text) return { ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesi poruku.' };
    if (text.length > 4000) {
      return { ok: false, kod: 'MESSAGE_TOO_LONG', poruka: 'Poruka može imati najviše 4000 znakova.' };
    }

    const { data, error } = await supabase.functions.invoke('uskoci-ai-interview', {
      body: { conversationId: razgovorId, text },
    });

    if (error) return edgeFailure(error);
    if (!data || typeof data.predlozeno !== 'number' || !Number.isFinite(data.predlozeno)) {
      return {
        ok: false,
        kod: 'AI_EDGE_INVALID_RESPONSE',
        poruka: 'AI nije vratio ispravan rezultat.',
      };
    }

    return { ok: true, podatak: { predlozeno: Math.max(0, Math.trunc(data.predlozeno)) } };
  },

  async ispraviCinjenicu(cinjenicaId, novaVrednost) {
    const value = novaVrednost.trim();
    if (!value) return { ok: false, kod: 'FACT_VALUE_REQUIRED', poruka: 'Unesi vrednost.' };
    if (value.length > 2000) {
      return { ok: false, kod: 'FACT_VALUE_TOO_LONG', poruka: 'Vrednost može imati najviše 2000 znakova.' };
    }

    const { data, error } = await supabase.rpc('rpc_ai_correct_fact', {
      p_fact_id: cinjenicaId,
      p_value: value,
    });
    if (error || typeof data !== 'string' || !data) {
      return legacyRpcFailure(error, 'AI_FACT_CORRECTION_FAILED', 'Ispravka nije potvrđena. Učitaj pregled ponovo.');
    }
    return { ok: true, podatak: { novaCinjenicaId: data } };
  },
};
