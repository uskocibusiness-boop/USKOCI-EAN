> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Stari „Mogu odmah“ direktni upis nije cilj novog AI toka. „Samo u Dogovoru“ ne znači automatsko deljenje: potrebna je svesna smerna dozvola; opoziv ne povlači već pročitane ili obične poruke. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

# Owner decisions — 2026-09-24

Recorded from the owner's answers in the UI unification session (branch `work/uskoci-ui-unification-20260924`).

1. **Voice notice wording approved.** `VOICE_PROCESSING_NOTICE` (`src/features/voice/useHoldToTalk.ts`), as rewritten in
   0846abf1 to match the rule that held speech sends on release: when the microphone is released, or tapped again in
   voice mode, the spoken text goes straight into the conversation; with "Pregledaj tekst pre slanja" on, or with a
   screen reader, it first lands in the message field and is sent only on Pošalji. Owner: "Je okej".
2. **Street names may be shown before a Dogovor.** A task detail may show the public route and place at street level
   without a house number (for example "Lenke Dunđerski · Novi Sad → Dositejeva · Novi Sad"), as the server's public
   projection returns it. The exact address (house number, entrance, private notes) stays revealed only inside a
   Dogovor. Owner: "Sme da prikaže ulicu". No code change was needed; this confirms the current behaviour.
3. **Offer sheet: no skills as labels.** The applicant's self-declared skills ("Sposobnosti") are not shown to the task
   owner as labels; what the applicant wants to say goes in the application note. Owner: "1 DA" (afternoon answers,
   same day). Applied after round 6 integrates (the offer sheet file is inside a round-6 unit).
4. **"Mogu odmah" saves on its own.** Pressing the switch saves the status at once, carrying the saved week unchanged;
   while other edits on the screen are unsaved, it joins them and Save saves both. In the profile conversation, where the
   whole profile is saved in one final step, it stays a draft change. Owner: "2 DA".
5. **Wording approved as written:** "Obaveštenja na telefon su uključena/isključena za …", "Sačekaj da se čuvanje
   završi.", "Učitavamo tvoje Dogovore…". Owner: "3 DA".
6. **Renames approved:** "Izvoz podataka", "Zatvaranje naloga", "Pravila i saglasnosti". Owner: "4 DA".
7. **Export step for a copy that cannot be saved.** The owner approved the proposed sentence ("5 DA"), but reading the
   code showed that the proposal described a different situation (the phone failing to save), while the step is the
   server's NOT_AVAILABLE answer (a copy that expired or was never verified; the one action is "Zatraži novu kopiju").
   Applied instead, as the round-5b verifier suggested: "Ova kopija se ne može sačuvati." The owner was told; open to
   the owner's correction.
8. **Geocoder:** none for internal testing; the choice (state address register vs LocationIQ) is made before a public
   release. Owner: "6 DA".
9. **Payments:** the payment UX waits until the core flows are verified on a phone; the architecture stays prepared.
   Owner: "7 DA".
10. **Photos only inside the task detail.** Task photos are never shown in the list, the map preview or any card; they
    appear only once the task detail is opened. Owner: "slike ne prikazuj dok se ne uđe u detaljan prikaz zadatka".

Still open: "U blizini" (device location, a new `expo-location` dependency and a location permission) — recommended yes,
after the core flows pass on a phone.
