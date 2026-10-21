# Push „Nova prijava” — stvarni cilj i nedostajući ugovor

Datum provere lokalnog izvora: 21.10.2026. Ovo je analiza koda i ranijeg QA dokaza, bez nove DEV/prod ili telefonske probe.

## Šta sada radi

1. Stvarna prethodna HONOR proba potvrdila je prijem push-a i **OS tap → Obaveštenja**. Nije potvrdila automatsko otvaranje prijave. Dokaz: `docs/current/README_USKOCI_LIVE_MASTER_PLAN.md`, odeljak „Zasebna push proba”.
2. `supabase/functions/_shared/pushNotificationCopy.mjs` za `RESPONSE_RECEIVED` šalje javni tekst „Nova prijava”, bez identiteta osobe ili zadatka.
3. `supabase/functions/uskoci-push-transport/index.ts` u provider `data` stavlja samo `{kind:'INBOX'}` za taj događaj. Opaque `eventId` je dopušten samo za `MESSAGE_RECEIVED` i `OPPORTUNITY_AVAILABLE`, uz zasebne uslove za uključivanje.
4. `src/ui/notifications/pushTarget.ts` prihvata upravo te dve vrste preciznog event hinta. `src/ui/notifications/PushRuntime.tsx` generički tap vodi na `/obavestenja` i ne pamti event intent. Identifikator provider zahteva nije event ID.
5. Po dodiru na *konkretan red* „Nova prijava”, `src/data/inboxModel.ts` čita i razrešava taj događaj; `src/app/obavestenja.tsx` za serverov `CANDIDATES` otvara `/potrebe/[id]/kandidati`. `public.rpc_resolve_activity_event` u `supabase/migrations/20260912090000_clean_pre_v3_event_semantics.sql` vlasniku za `RESPONSE` vraća **Need ID**, ne ID prijave. Lista zatim radi svoje čitanje Need-a i kandidata sa proverom revizije (`src/app/(app)/potrebe/[id]/kandidati.tsx`).

Zato trenutni rezultat ima dva dodira: push → Obaveštenja → red „Nova prijava” → prijave za taj zadatak. Ni push ni postojeći resolver ne daju pouzdan cilj *baš te* prijave. Ako u međuvremenu stignu dve prijave, izbor „najnovije” bi mogao da otvori pogrešnu osobu.

Isti prvi korak važi za ostale generičke push događaje: otvaraju Inbox, a pojedinačni red posle server čitanja vodi na zadatak, prijave, Dogovor ili poruku prema svom tipu. Izuzeci su samo `MESSAGE_RECEIVED` i kontrolisani `OPPORTUNITY_AVAILABLE`: kada nose dopušten opaque event hint, vidljivi Inbox radi dodatni autentifikovani readback i može da otvori potvrđenu poruku odnosno zadatak. `OPPORTUNITY_AVAILABLE` i dalje može stići generički ako uslov za precizan hint nije uključen.

## Ugovor potreban za precizan cilj

Ovo je predlog zasebne serverske/klijentske izmene, **nije implementirano**:

1. Server izdaje opaque `eventId` za `RESPONSE_RECEIVED` samo kao hint, nikada `needId`, `responseId`, adresu, ime ili poruku u push payload-u. Edge i klijent dopuštaju novu tačnu kombinaciju `{kind:'INBOX', eventType:'RESPONSE_RECEIVED', eventId}` iza kontrolisanog rollout-a; stari `{kind:'INBOX'}` ostaje važeći.
2. Autentifikovani readback za taj event vraća strogo dekodiran odgovor, npr. `ACTIVITY_APPLICATION_TARGET_V1`: `accountId`, `eventId`, `needId`, `responseId`, `role:'REQUESTER'`, `authoritative:true`, ili `UNAVAILABLE`. Server mora da proveri primaoca, IN_APP isporuku, vrstu događaja, vezu event→response→need, vlasništvo nad zadatkom i trenutnu dozvolu za čitanje. Ne vraćati sadržaj ponude kroz push resolver.
3. Klijent veže intent za `accountId`, `accountRevision`, `sessionEpoch` i posetu Inbox-u; pri promeni naloga, odlasku sa ekrana, timeout-u ili starom odgovoru povlači čitanje. Ne otvara rutu pre potpunog readback-a. Greška nudi ponovni readback, `UNAVAILABLE` ostaje u Inbox-u sa objašnjenjem.
4. Ruta kandidata prima **serverom potvrđen** `responseId` kao fokus, pa posle svog postojećeg čitanja proverava da kandidat pripada istom Need-u i aktuelnoj reviziji. Kod zastarele/povučene prijave ostaje u listi i kaže zašto se konkretna ponuda ne može otvoriti. Sam push tap ne označava event kao pročitan niti bira kandidata.
5. Testovi moraju pokriti hladan/topao tap, dva brza push-a, dva naloga, zastarelu/povučenu prijavu, više prijava za isti zadatak, neuspeo resolver, odbijenu dozvolu, pagination i povratak u Inbox.

Do tog ugovora zadržati bezbednu postojeću putanju. Lokalni regresioni testovi: `src/data/__tests__/push-runtime.test.tsx` (generički „Nova prijava” tap) i `src/data/__tests__/inbox-native.test.tsx` (autorizovani red → lista kandidata). Ti testovi ne potvrđuju novi APK ili stvarni push transport.
