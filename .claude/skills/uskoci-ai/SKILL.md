---
name: uskoci-ai
description: Use when changing the USKOČI AI interviews (NEED task posting and WORKER profile), Gemini prompts/schemas, streaming, context cache, speech, or AI budget. Holds the owner's AI rules and the measured latency baseline.
---

# USKOČI AI intervju

## Pravila vlasnika
- Jedan Gemini poziv po korisničkoj poruci, postojeći model (`gemini-3.8-flash`). **Nema drugog modela, klasifikatora ni dodatnih AI poziva.**
- AI ne izmišlja cenu, adresu, vreme, vozilo, alat, broj ljudi ni sposobnost. Prihvata ispravku i čuva je. Postavlja jedno stvarno potrebno pitanje.
- Korisnik ne bira tehničke kategorije; server sam validira taksonomiju.
- Predlog AI-ja nije objava: objava/aktivacija tek posle izričite potvrde korisnika i serverske provere (revizija, idempotentnost, vlasništvo).
- Cena: valuta, jedinica (HOURLY = po osobi po satu, TOTAL, PER_PERSON, OFFERS) i broj ljudi se ne menjaju bez potvrde. REMOTE bez adrese. Prevoz A→B čuva obe tačke. Podrazumevana država RS.
- Tekst za korisnika: Vi/Vam/Vas, bez pretpostavke roda.
- Nema HITNO/NEHITNO, `available_now` ni „Mogu odmah“ kao uslova.

## Gde je šta
- NEED: `supabase/functions/uskoci-ai-interview/index.ts` (`callGemini`, `execute`, stream endpoint na kraju fajla; zaštite koje prepisuju `assistantMessage` ~1145–1562).
- WORKER: `supabase/functions/uskoci-worker-interview/index.ts`.
- Zajedničko: `_shared/geminiTaskStream.ts` (SSE, `onText`, `propertyOrdering` stavlja `assistantMessage` prvo), `_shared/geminiContextCache.mjs`, `_shared/preparedAiInput.ts`, `_shared/aiPhaseTiming.mjs`.
- Klijent: `src/data/aiNeedTurnStream.ts` (prima `accepted`, `text_delta`, `final`, `safe_error`), `src/ui/aiFirst/useStreamDisplay.ts`, `src/app/(app)/nova.tsx`.

## Merenje (DEV logovi, `query_logs`, source `function_logs`)
- `AI_PHASE_MS PROVIDER|NEED_COMPLETE|NEED_FULL_CATALOG`, `AI_FIRST_TEXT_MS`, `AI_USAGE_TOKENS` (gledati `cachedPromptTokens`).
- Osnova 20.11.2026: Gemini 3,3–14,4 s (≈8 s), prvi tekst 2,3–8,8 s, upis 0,1–1,1 s, ≈9.000 ulaznih tokena, keš isključen (`USKOCI_GEMINI_CONTEXT_CACHE_ENABLED`).

## Bezbednost streama
- Sirov tekst modela nije konačan: privremeni prikaz sme samo uz `final` koji ga zamenjuje; ne prikazuj privremeni tekst sa iznosom/valutom ili adresom; stariji `turnId/attemptId` nikad ne pregazi noviji.
- Nikad ne pozivaj Gemini ili druge plaćene API-je u testovima ili bez odobrenja; ne zaobilazi budžet.
