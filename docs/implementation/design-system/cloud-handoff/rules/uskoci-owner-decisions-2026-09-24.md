---
name: uskoci-owner-decisions-2026-09-24
description: Owner answers 2026-09-24 — voice notice approved; street names before a Dogovor; no skill labels in offers; Mogu odmah saves on press; wordings/renames approved; photos only in task detail; geocoder and payments later
metadata:
  node_type: memory
  type: project
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-24T05:18:30.726Z
---

> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../../PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Stari „Mogu odmah“ direktni upis nije cilj novog AI toka. „Samo u Dogovoru“ ne znači automatsko deljenje: potrebna je svesna smerna dozvola; opoziv ne povlači već pročitane ili obične poruke. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

On 2026-09-24 the owner answered two open questions from the UI unification work:

1. The rewritten voice privacy notice (`VOICE_PROCESSING_NOTICE` in `src/features/voice/useHoldToTalk.ts`, commit
   0846abf1: released mic / second tap in voice mode sends at once; review toggle or screen reader puts text in the
   field first) is approved — "Je okej".
2. A stranger's task detail may show the route/place at street level without a house number before any Dogovor —
   "Sme da prikaže ulicu". The exact address stays Dogovor-only. Current behaviour confirmed, no change.

**Why:** both were privacy calls reserved for the owner by [[uskoci-autonomous-perfection-directive]].
**How to apply:** do not re-ask these; keep the notice text and the street-level public route as they are. Recorded in
`docs/implementation/design-system/OWNER_DECISIONS_20260924.md`.

Later the same day (cloud session) the owner answered "1 DA … 7 DA" and one more rule:
3. No skills as labels in the offer sheet; 4. "Mogu odmah" saves on its own (joins other unsaved edits; draft-only in
the profile conversation); 5. wordings approved as written; 6. renames "Izvoz podataka", "Zatvaranje naloga",
"Pravila i saglasnosti" approved; 7. export NOT_AVAILABLE step reads "Ova kopija se ne može sačuvati." (the approved
proposal described another situation — told to the owner); 8. geocoder chosen before a public release; 9. payments
after the core flows pass on a phone; 10. task photos only inside the task detail, never in lists, map previews or
cards. Open: "U blizini" (expo-location + permission). Details in `OWNER_DECISIONS_20260924.md`.
