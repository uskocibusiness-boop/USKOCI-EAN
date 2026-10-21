# Zadatak AI: valute, 21.10.2026.

## Stvarni ugovor

- Trenutni iznos zadatka je `need.price_rsd` u razgovoru i `needs.requester_price_rsd` u sačuvanom zadatku. `src/data/needClientService.ts` prikazuje ga kao RSD. Ponuda takođe koristi `price_rsd`; potvrđeni uslovi Dogovora proveravaju `currency = RSD` (`supabase/migrations/20260911190000_clean_pre_v3_m05_admitted_source.sql`). Ovo nije viševalutni model.
- `supabase/functions/_shared/serviceExecutionInstruction.mjs` već razlikuje dolazak izvršioca (`ON_SITE`) od rada na daljinu ili u njegovoj radionici (`REMOTE`), kao i fizičku predaju rezultata. `supabase/functions/uskoci-ai-interview/index.ts` već traži grad i orijentir za svaku tačku rute i ne pretvara mesto predaje u pin rada. To je postojeći izvorni ugovor, ne nova potvrda ponašanja Geminija na živom DEV-u.

## Lokalna izmena

`supabase/functions/uskoci-ai-interview/index.ts` sada izričito kaže modelu da razume evre, ali da ih ne upisuje kao dinare i da ne nagađa kurs. Uski serverski guard pre SQL writer-a za eksplicitni iznos sa `EUR`, `€`, `evra/euro` ili `евра` odbacuje pogrešan `need.price_rsd` i cenu koja se ponavlja u naslovu/opisu. Izričit, potvrdan izbor ponuda ostaje čak i kada model uz njega pogrešno predloži EUR broj kao RSD; negiran ili izmišljen izbor ponuda se ne prihvata. ACK bez cenovnog predloga ne sme lažno potvrditi izmenu stare RSD cene. Nezavisni čist opis posla, broj ljudi, mesto i termin ostaju. Korisnik dobija pitanje za iznos u RSD ili izbor ponuda. Policy `REVIEW` zadržava svoj status.

Ovo je funkcionalna izmena C u Edge izvoru. `uskoci-ai-interview` je objavljen **samo na DEV** projektu `leqcwgzvjsxugfgzdmth` kao aktivna verzija 117; produkcija nije menjana. Guard nije opšti parser valute: ne tumači prećutni iznos bez jedinice, negacije i složene alternativne ponude; njih razjašnjava razgovor. Nema konverzije EUR→RSD, čuvanja EUR ili kursa.

## Dokaz i sledeća granica

- `src/data/__tests__/ai-natural-server-guard.test.ts`: 52/52, uključujući zapise evra, mešovit dinar/evro odgovor, ACK bez cenovnog predloga, potvrdan i negiran izbor ponuda, čist opis i `REVIEW` varijante.
- `supabase/proofs/ai/ai_edge_context.test.mjs`: 110/110, izolovani stvarni Edge handler sa sintetičkim Gemini odgovorom; potvrđuje predlog koji bi pogrešno upisao `100 RSD` za korisnikovih `100 evra` ne stiže u SQL writer. Ovo nije živi Gemini test.
- Diff i lokalne provere su pregledani; CLI objava baš `uskoci-ai-interview` na DEV vratila je uspeh, `functions list` zatim pokazuje verziju 117, `ACTIVE`, `verify_jwt=false`, a anonimni HTTP smoke vraća 401. Nije izvršen kontrolisani autentifikovani razgovor kroz nacrt i pregled, pa se ne tvrdi da Gemini u živom toku uvek tačno tumači valutu.
- Ako proizvod treba stvarno da objavljuje i ugovara cene u EUR, potreban je zaseban dogovoren ugovor za valutu na zadatku, prijavi, Dogovoru, filteru, mapi, obaveštenju i svim obračunima. Sam prompt to ne može da obezbedi. Bez definisanog kursa i datuma konverzije ne sme se potajno zapisivati RSD ekvivalent.
