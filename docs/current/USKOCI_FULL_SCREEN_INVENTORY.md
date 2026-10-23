# USKOČI — Kompletan registar svih ekrana (Full Screen Inventory)

Ažurirano: 23.10.2026.  
Status: Zvanični registar svih 56 ruta u klijentskoj aplikaciji  
Canon: `docs/implementation/design-system/PREMIUM_WHITE_CANON.md`

---

## 1. Pregled arhitekture navođenja i raspodele

Aplikacija je strukturirana u Expo Router file-based rute podeljene na tri glavne grupe:
1. **Korenske rute (`src/app/`)**: Autentifikacija, oporavak naloga, obaveštenja, sistemski modali.
2. **Glavna aplikacija (`src/app/(app)/`)**: 5 glavnih tabova (Početna, Zadaci, Novi zadatak, Dogovori, Profil) i pripadajući podtokovi.
3. **Kontekstualni i duboki tokovi (`src/app/dogovor/`, `src/app/(app)/profil/`, `src/app/(app)/podrska/`)**: Detalji dogovora, grupni čet, radni profil, podešavanja, korisnička podrška.

---

## 2. Tabelarni registar svih 56 ruta

| # | Ruta (Fajl) | Tip prikaza | Korisnička uloga | Svrha i primarna akcija | Ključni RPC / Izvor podataka |
|---|---|---|---|---|---|
| 1 | `+native-intent.tsx` | Intent Handler | Svi | Obrada deep linkova, push notifikacija i spoljnih linkova | In-memory router |
| 2 | `_layout.tsx` | Root Stack | Svi | Root provajderi (Theme, Auth, QueryClient, Toast, GestureHandler) | Supabase Auth State |
| 3 | `auth.tsx` | Stack Ekran | Gost | Prijavljivanje / Registracija putem emaila i lozinke | `supabase.auth.signInWithPassword` |
| 4 | `oporavak.tsx` | Stack Ekran | Gost | Oporavak zaboravljene lozinke putem email koda | `supabase.auth.resetPasswordForEmail` |
| 5 | `obavestenja.tsx` | Stack Ekran / Modal | Svi | Centralni centar obaveštenja sa bedževima nepročitanog | `notifications`, `rpc_mark_notification_read` |
| 6 | `prijave.tsx` | Stack Ekran | Radnik / Naručilac | Brzi pregled svih aktivnih prijava | `need_applications` |
| 7 | `(app)/_layout.tsx` | Bottom Tabs | Prijavljeni | 5 kanonskih tabova: Početna, Zadaci, Novi (+), Dogovori, Profil | Supabase Session |
| 8 | `(app)/index.tsx` | Tab 1 (Početna) | Svi | Home feed: preporuke, aktivni zadaci u toku, brzi AI ulaz | `rpc_get_home_feed`, `needs` |
| 9 | `(app)/zadaci.tsx` | Tab 2 (Zadaci) | Svi | Istraživanje zadataka sa filterima, lista + dugme za mapu | `needs`, Geo filteri, Taxonomy filteri |
| 10 | `(app)/mapa.tsx` | Stack / Fullscreen | Svi | Interaktivna mapa sa 2.5D pinovima, klasterovanjem i preview karticom | `rpc_get_tasks_geo_cluster` |
| 11 | `(app)/nova.tsx` | Tab 3 (Centralni +) | Naručilac | AI razgovor za kreiranje zadatka sa 64dp pulsirajućim mikrofonom | `uskoci-ai-interview` Edge Function |
| 12 | `(app)/pregled-nacrta.tsx` | Stack Ekran | Naručilac | Jedini završni pregled zadatka pre objave („Izmeni kroz razgovor“ / „Potvrdi objavu“) | `ai_conversations`, `ai_structured_facts` |
| 13 | `(app)/pregled-zadatka.tsx` | Stack Ekran | Svi | Detaljan javni prikaz zadatka sa slotovima (npr. 2/3) i autorom | `needs`, `profiles`, `need_applications` |
| 14 | `(app)/mesto-zadatka.tsx` | Modal / Mapa | Naručilac | Izbor lokacije na mapi: prevlačenje 2.5D pina, adresa, tačka | `ResolvedPinMap.tsx`, `LocationPointEditor.tsx` |
| 15 | `(app)/fotografije-zadatka.tsx` | Stack Ekran | Naručilac | Dodavanje i pregled slika uz zadatak (do 5 fotografija) | Supabase Storage (`task-media`) |
| 16 | `(app)/pitanja-zadatka.tsx` | Stack Ekran | Svi | Javna pitanja i odgovori ispod zadatka pre prijave | `need_public_questions` |
| 17 | `(app)/potrebe.tsx` | Stack Ekran | Naručilac | „Moji objavljeni zadaci“ sa statusima (otvoren, popunjava se, završen) | `needs` WHERE author_id = me |
| 18 | `(app)/potrebe/[id]/pregled.tsx` | Stack Ekran | Naručilac | Autorski kontrolni panel zadatka sa statistikom i akcijama | `needs`, `need_applications` |
| 19 | `(app)/potrebe/[id]/kandidati.tsx` | Stack Ekran | Naručilac | Pregled prijavljenih radnika, prihvatanje po slotovima (`2/3`), odbijanje | `rpc_accept_application`, `rpc_reject_application` |
| 20 | `(app)/prilike.tsx` | Stack Ekran | Radnik | Prilike za uskakanje prilagođene veštinama i zoni radnika | `rpc_match_worker_opportunities` |
| 21 | `(app)/prilike/[id].tsx` | Stack Ekran | Radnik | Detalji zadatka za radnika sa procenom udaljenosti i cene | `needs`, `worker_profiles` |
| 22 | `(app)/prilike/[id]/prijava.tsx` | Modal Sheet | Radnik | Slanje ponude/prijave sa unetom cenom, porukom i vremenom | `rpc_apply_to_need` |
| 23 | `(app)/moje-prijave.tsx` | Stack Ekran | Radnik | Praćenje statusa poslatih prijava (na čekanju, prihvaćeno, odbijeno) | `need_applications` WHERE applicant_id = me |
| 24 | `(app)/moje-aktivnosti.tsx` | Stack Ekran | Svi | Objedinjeni pregled svih tekućih obaveza (i kao naručilac i kao radnik) | `agreements`, `needs` |
| 25 | `(app)/dogovori.tsx` | Tab 4 (Dogovori) | Svi | Centralna lista aktivnih, završenih i otkazanih dogovora | `agreements`, `profiles` |
| 26 | `dogovor/[id].tsx` | Stack Ekran | Učesnici | Kontrolna tabla dogovora: deljenje kontakta/adrese, završetak, otkazivanje | `agreements`, `rpc_share_contact`, `rpc_complete_task` |
| 27 | `dogovor/[id]/grupa.tsx` | Stack Ekran | Učesnici | Čet za dogovor (1-na-1 ili grupa kod više izvršilaca) | `conversations`, `messages`, Realtime |
| 28 | `dogovor/[id]/izmene.tsx` | Modal Sheet | Učesnici | Predlaganje izmene cene ili termina unutar dogovora | `agreement_amendments` |
| 29 | `(app)/oceni-dogovor.tsx` | Modal Ekran | Učesnici | Dvostrano ocenjivanje (zvezdice 1-5 + tekstualni utisak) | `reviews`, `rpc_submit_review` |
| 30 | `(app)/poruke.tsx` | Tab 5 (Poruke) | Svi | Spisak svih razgovora (dogovori, podrška, AI konsultacije) | `conversations`, Realtime presence |
| 31 | `(app)/profil.tsx` | Tab 5 (Profil) | Svi | Lični profil, statistika, rejting, prečica za radni profil | `profiles`, `worker_profiles` |
| 32 | `(app)/profil/radnik.tsx` | Stack Ekran | Svi | Radni profil (Premium White izgled, usluge, gradovi, rejting) | `worker_profiles`, `worker_capabilities` |
| 33 | `(app)/profil/razgovor.tsx` | Stack Ekran | Radnik | AI razgovor za kreiranje/izmenu radnog profila sa 64dp dugmetom | `uskoci-worker-interview` Edge Function |
| 34 | `(app)/profil/dostupnost.tsx` | Stack Ekran | Radnik | Sedmični kalendar radnog vremena i prekidač „Dostupan odmah“ | `worker_availability_rules`, `windows` |
| 35 | `(app)/profil/lokacija.tsx` | Stack Ekran | Radnik | Definisanje radijusa rada (gradovi u Srbiji, km oko grada, cela Srbija) | `worker_work_areas` |
| 36 | `(app)/profil/ocene.tsx` | Stack Ekran | Svi | Prikaz svih dobijenih ocena i komentara od drugih korisnika | `reviews` |
| 37 | `(app)/profil/fotografija.tsx` | Modal Sheet | Svi | Izmena profilne fotografije (kamera / galerija sa crop-om) | Supabase Storage (`avatars`) |
| 38 | `(app)/raspored.tsx` | Stack Ekran | Radnik | Lični raspored dogovorenih poslova po danima | `agreements` WHERE worker_id = me |
| 39 | `(app)/profil/podesavanja.tsx` | Stack Ekran | Svi | Postavke aplikacije: jezik, tema, zvuci, smanjeno kretanje | Local Settings Storage |
| 40 | `(app)/profil/podaci.tsx` | Stack Ekran | Svi | Osnovni lični podaci: ime, telefon, email, grad | `profiles` |
| 41 | `(app)/profil/obavestenja.tsx` | Stack Ekran | Svi | Podešavanje push i in-app obaveštenja po kategorijama | `user_notification_preferences` |
| 42 | `(app)/profil/privatnost.tsx` | Stack Ekran | Svi | Pravila privatnosti, vidljivost telefona i adrese | `profiles.privacy_settings` |
| 43 | `(app)/bezbednost.tsx` | Stack Ekran | Svi | Bezbednost naloga, aktivne sesije, odjava sa svih uređaja | `supabase.auth` sessions |
| 44 | `(app)/profil/lozinka.tsx` | Stack Ekran | Svi | Promena lozinke uz potvrdu stare lozinke | `supabase.auth.updateUser` |
| 45 | `(app)/profil/blokirani.tsx` | Stack Ekran | Svi | Spisak blokiranih korisnika sa opcijom deblokade | `blocked_users` |
| 46 | `(app)/profil/izvoz.tsx` | Stack Ekran | Svi | GDPR izvoz svih ličnih podataka u JSON formatu | `rpc_export_user_data` |
| 47 | `(app)/profil/prijava-greske.tsx` | Stack Ekran | Svi | Slanje povratnih informacija i screenshot-a greške | `feedback_reports` |
| 48 | `(app)/profil/pravna.tsx` | Stack Ekran | Svi | Uslovi korišćenja, politika privatnosti i pravne napomene | Static Markdown / Legal |
| 49 | `(app)/profil/o-aplikaciji.tsx` | Stack Ekran | Svi | Verzija aplikacije, OTA release hash i autorska prava | App Metadata |
| 50 | `(app)/arhiva.tsx` | Stack Ekran | Svi | Arhivirani završeni zadaci i stari dogovori | `needs`, `agreements` WHERE archived=true |
| 51 | `(app)/ai-istorija/index.tsx` | Stack Ekran | Svi | Spisak prethodnih AI razgovora sa mogućnošću nastavka | `ai_conversations` |
| 52 | `(app)/ai-istorija/[conversationId].tsx` | Stack Ekran | Svi | Pregled toka konkretnog istorijskog AI razgovora | `ai_messages`, `ai_structured_facts` |
| 53 | `(app)/podrska/index.tsx` | Stack Ekran | Svi | Tiketi korisničke podrške sa statusima | `support_tickets` |
| 54 | `(app)/podrska/novi.tsx` | Stack Ekran | Svi | Otvaranje novog zahteva podršci sa kategorijom problema | `support_tickets` INSERT |
| 55 | `(app)/podrska/[id].tsx` | Stack Ekran | Svi | Čet sa operaterom korisničke podrške u realnom vremenu | `support_ticket_messages` |
| 56 | `(app)/podrska/operator.tsx` | Stack Ekran | Admin | Panel za administratore i agente podrške | `support_tickets` Admin RPCs |

---

## 3. Standardi ekrana prema Premium White Canon-u

Svaki od ovih 56 ekrana poštuje 5 obaveznih kanonskih pravila:
1. **Minimalističko zaglavlje (`ScreenChrome`)**: Bela pozadina `#FFFFFF`, tanka linija razdvajanja `#F3F4F6`, diskretan `←` naslov bez teških blokova boja.
2. **Čista prazna stanja (`EmptyState`)**: Ilustracija 2.5D, razumljiva poruka na srpskom jeziku i jedno primarno dugme za akciju.
3. **Stanje greške i oporavka (`ErrorState`)**: Jasno objašnjenje šta se desilo (nema tehničkih SQL kodova) uz dugme „Pokušaj ponovo“.
4. **Responzivna tastatura i Safe Area**: Svi unosi koriste `KeyboardAvoidingView` prilagođen Androidu i iOS-u sa `keyboardVerticalOffset`.
5. **Fluidne tranzicije**: Native animacije pomoću `react-native-reanimated` koje automatski poštuju sistemsku opciju `Reduce Motion`.
