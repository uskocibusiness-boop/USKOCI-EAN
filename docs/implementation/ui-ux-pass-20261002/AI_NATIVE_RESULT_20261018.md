# USKOČI — rezultat šest stvarnih AI poziva, 18.10.2026.

**Status: ograničeni test završen, sa pronađenim greškama. Ceo AI → potvrda → matching tok još nije potvrđen.**

Ovo je dokaz uz postojeći plan i njegovih 62 reda, ne novi master plan. Vlasnik je odobrio do šest tekstualnih Gemini 3.8 Flash poziva i do 1,50 USD ukupne maksimalne rezervacije, za zadatak i radni profil na emulatoru. Svih šest poziva je iskorišćeno. Dodatni plaćeni pozivi nisu izvršeni.

## 1. Šta je stvarno korišćeno

| Sloj | Tačan izvor |
| --- | --- |
| Aplikacija | rs.uskoci.preview, 1.0.0 / 35, x86_64 emulator |
| APK source | b92b55d09e257270016a780e6fc8c057f6a06015 |
| APK SHA-256 | 37293b82b2387952c4f6ee7aa2120c4f820345f0173d3711120791ba53aa574f |
| Ugrađeni update | 2eaa68be-3727-4b3b-bf0a-49a7baa0234f |
| DEV | leqcwgzvjsxugfgzdmth |
| AI zadatak | uskoci-ai-interview v90 |
| AI radni profil | uskoci-worker-interview v45 |
| Vreme testa | 10:50:58–11:05:06 UTC, 18.10.2026. |
| Sačuvani native dokaz | NATIVE_RESULT_20261018.json u ovoj porodici dokumenata |

To je novi emulator APK iz prethodnog paketa. HONOR telefon nije korišćen. Kasnije lokalne ispravke opisane ispod još nisu u ovom APK-u niti u tim živim Edge verzijama.

Oznaka sourceDirty=true ostaje pošteno zabeležena: CI prebuild je prijavio izmenu package.json. Tačan post-prebuild diff nije priložen starom CI artifact-u. Zato nije potvrđeno poreklo iz potpuno čistog checkout-a. Hash instaliranog APK-a i njegov ugrađeni identitet jesu provereni.

Task scenario koristi svoj neobjavljeni razgovor. Worker scenario koristi postojeći prazan razgovor sa revizijom 0; ne tvrdi se da je za ovaj test otvorena sasvim nova worker nit. Završio je kao OPEN nacrt revizije 3.

## 2. Rezultati razgovora

| Korak | Proveravano | Stvarni rezultat |
| --- | --- | --- |
| Zadatak 1 | Izrada kod izvršioca, mogući grad preuzimanja ili slanje | Nacrt prepoznaje 3D izradu i REMOTE. Ne traži adresu naručioca kao uslov. Pita da li se zadaje cena ili traže ponude. |
| Zadatak 2 | Delimičan odgovor; detalji izrade ostaju otvoreni | Nema izmišljenog materijala, količine, budžeta ili roka. Pitanje cene ponovljeno jer na njega nije odgovoreno. Opis nije odmah sasvim sužen samo na preuzimanje: ovo nije potpun prolaz svakog delimičnog podatka. |
| Zadatak 3 | Zamena preuzimanja slanjem | Posle oporavka neuspelih HTTP pokušaja, finalni nacrt sadrži slanje, uz očuvan REMOTE. Ne objavljuje zadatak i ne traži privatnu adresu. |
| Profil 1 | 3D izrada u sopstvenom prostoru | Kandidat uklanja dupliranje naziva usluge. AI posebno pita da li osoba radi i modelovanje; tu kompetenciju nije sam dopisao. |
| Profil 2 | Izričito rad na daljinu, uz moguće preuzimanje | Opis kandidata čuva tu razliku. Stari grad/radijus ostaju prethodni podaci, ne dokaz novog terenskog područja ili potvrđenog režima za matching. |
| Profil 3 | Bez dodavanja alata i vozila, ostalo zadržati | Hash-evi alata, vozila i dostupnosti u kandidatu ostaju isti. Odgovor upućuje na pregled i buduće čuvanje; ne tvrdi da je sačuvao profil. |

U zadatku su činjenice ostale NEEDS_CONFIRMATION. Jedna osoba i RS su AI predlozi za pregled, nisu izričito potvrđeni korisnički podaci. AI je slanje opisao kao poštu/kurira; izbor konkretnog prevoznika nije dogovoren.

Ovaj prolaz nije izazvao slučaj u kome model postavlja tri povezana pitanja. On je birao jedno pitanje. Zato instrukcija koja dopušta do tri pitanja jeste objavljena, ali njeno puno ponašanje nije dokazano ovim scenarijem.

## 3. Granice i evidencija potrošnje

- Tačno 6 novih LLM rezervacija, po najviše 250.000 microusd: ukupno 1.500.000 microusd, odnosno 1,50 USD maksimalnih rezervacija.
- Tri task i tri worker komande imaju SUCCEEDED u bazi.
- Pre toga su postojala još tri neuspešna HTTP pokušaja koji nisu stigli do Gemini-ja: dva za task korekciju i jedan za početnu worker poruku.
- Pre ponovnog slanja provereni su baza i UI oporavak. Neposlati zahtevi su po potrebi otkazani kroz aplikaciju. Nije ponovljen neizvestan plaćeni zahtev.
- Nula novih objavljenih/kreiranih zadataka u posmatranom obuhvatu; bound_need_id ostao null. Nula novih worker Save zapisa.
- Sačuvani profil je neizmenjen, potvrđeno poređenjem pre/posle. Izmene postoje samo u testnom kandidatu razgovora.
- Nije iniciran push ili STT. Nisu menjani katalog, šema, RLS, sertifikat, ključevi ili Edge deployment.
- Worker ima tri zapisa potrošnje, sa obračunom testnog ledgera od ukupno 30.225 microusd, približno 0,030225 USD.
- Task nema token usage zapise za ova tri uspešna odgovora, zbog greške ispod; tri rezervacije ostaju nerazračunate. **Stvarna ukupna cena zato nije potvrđena.**
- Nije ručno vraćan budžet, dopisivana potrošnja ili menjana istorija. Preostali novčani prostor nije dozvola za sedmi poziv.

## 4. Pronađeno i lokalno popravljeno

### F1 — task posle uspešnog upisa prekida završetak odgovora

Promenljiva taxonomyCatalog bila je deklarisana u try bloku, a posle tog bloka korišćena pri opcionalnom beleženju klasifikacionog predloga. To je stvarna greška JavaScript opsega.

Posledica: odgovor može već biti upisan i komanda SUCCEEDED, a završetak handler-a ipak emitovati safe_error. Klijent oporavkom pročita postojeći odgovor, pa na ekranu deluje da je uglavnom uspelo. Evidencija potrošnje i klasifikacioni hint mogu ostati preskočeni.

Dokaz kombinuje tri uspešna task upisa bez usage zapisa u živom testu i test stvarnog izvornog handler-a koji reprodukuje accepted/safe_error umesto final. Lokalna ispravka podiže deklaraciju u opseg izvršavanja. Provereni su put sa katalogom, put bez kataloga i neuspeh opcionalnog capture-a bez kvarenja uspešnog odgovora.

Status: SOURCE + OFFLINE PASS. Nije još primenjeno na DEV.

### F2 — privremena Auth nedostupnost prikazivana kao prijava ili neispravan unos

Task handler je sve izuzetke tokom provere naloga pretvarao u 401. Worker je isti problem hvatao zajedno sa parsiranjem korisničkog zahteva, pa je vraćao 400.

U stvarnom testu task pokušaj je odbijen približno posle pet sekundi iako token još nije istekao. Worker pokušaj takođe je odbijen uz prethodno osvežen, važeći token. To ne dokazuje tačan mrežni uzrok i ne opravdava tvrdnju da je korisnik bio odjavljen.

Lokalno: stvarni Auth 401/403 i dalje odbija nalog; timeout, mrežna greška, Auth 429/5xx ili neispravan identitet vraćaju 503 AUTH_UNAVAILABLE. Takvi zahtevi staju pre rezervacije i provajdera. Provera identiteta nije zaobiđena. Ispravka razdvaja uzroke i poruke; sama po sebi ne uklanja uzrok povremenog Auth kašnjenja.

Status: SOURCE + OFFLINE PASS. Nije još primenjeno na DEV.

### F3 — worker dugme za ponovno slanje nije pratilo dozvoljeni oporavak

Posle potvrđenog neuspelog slanja kartica oporavka može ponuditi retry, dok donje polje za poruku drži akciju isključenom. Korisnik dobija nesaglasne kontrole.

Lokalna ispravka omogućava donju akciju samo kada server oporavak dozvoljava retry, originalni tekst još postoji u memoriji i svi postojeći uslovi vlasništva, writable stanja, zauzetosti i govora važe. Ponovo koristi isti request ID i originalni tekst. Neizvestan ishod ili obnovljen zahtev bez originalnog teksta ne otključava slanje.

Status: SOURCE + OFFLINE PASS. Potreban naredni objedinjeni APK i native provera.

### F4 — puni Jest nije pokrivao stvarno izvršavanje ovih Edge handler-a

Prethodnih 620 zelenih Jest paketa nije dokazivalo ovaj Node runtime put. Njegovi loader-i su zaostali za novim klasifikacionim importima.

Loader-i sada učitavaju stvarne zajedničke module; duplirani worker loader je zamenjen zajedničkim. Dodate su provere Auth granice i završetka task odgovora. Preview APK workflow sada izvršava ovaj Node skup pre Jest-a.

Ovo zatvara konkretnu rupu u proverkama; ne označava sve Edge funkcije kao potpuno pokrivene.

## 5. Otvoreno: prirodni naziv, kanonski ID i režim

Za oba probna razgovora ima 0 sačuvanih Gemini classification hint redova. Task je pogođen F1. Worker log beleži SEMANTIC_IDENTITY_REVIEW_REQUIRED za svoje predloge.

Živa baza ima:
- kategoriju 3D printovanje, ESTABLISHED, pod Digitalne usluge;
- alias 3D štampa i druga dva aliasa.

Trenutni classificationEngine pri REUSE_EXISTING traži isti normalizovani naziv usluge i kategorije. Normalizacija poravnava pismo i razmake, ali ne zna da su različite reči sinonimi. Katalog koji učitava ovaj helper ne nosi alias dokaze. REUSE_ALIAS se zasebno odbija dok nema autoritativnog dokaza.

Zato je u izvoru potvrđen raskorak: opis/veština može koristiti postojeći alias, a Edge predlog se ne zadržava za kasnije povezivanje. Log potvrđuje klasu odbijanja. Sirovi odbijeni modelov predlog nije čuvan u ovom dokazu, pa se ne tvrdi koji je tačno ID ili tekst model poslao u svakom odbijenom predlogu.

Postojeći SQL za potpisano povezivanje poznaje kanonski naziv ili alias uz nezavisne provere usluge i režima. Ovaj test nije pritisnuo Save niti pozvao binder, pa **ne dokazuje da postojeći radnik više ne dobija poklapanja**. Dokazuje da ovaj razgovorni shadow put nije proizveo upotrebljiv zapis i da kompletna veza još nije potvrđena.

Sledeće rešenje treba da prenese autoritativni, verzionisani alias identitet kroz katalog i review, uz istu potvrdu usluge/režima, proveru zastarelog kataloga i zaštitu od semantički pogrešne kategorije. Novi alias se ne sme prihvatiti samo zato što ga model predlaže.

Posebno preispitati postojeći širi alias koji spaja modelovanje i štampu: samo štampanje ne dokazuje veštinu modelovanja. U ovom paketu ništa od kataloga nije menjano i zaštita od pogrešne kompetencije nije oslabljena.

## 6. Šta ekrani pokazuju dobro, a šta još smeta

**Dobro:** task ima kratak sažetak sa Na daljinu; promena slanja ostaje vidljiva u razgovoru. Worker ima jedan istaknut ulaz Pregledaj profil. Oprema nije uslov za nastavak. Odgovori ne tvrde da je poslovni zapis sačuvan.

**Otvoreno:** worker zelene trake Usluge/Područje i poruka da je pregled spreman mogu delovati kao potvrda matching spremnosti. Ovaj test pokazuje da lokalna popunjenost kandidata i kanonska klasifikacija nisu ista stvar. Pregled treba jasno da odvoji nacrt, potvrđen režim i stvarno povezanu uslugu.

Oporavak je vizuelno preopterećen: ponovljen tekst poruke u istoriji i unosu, više objašnjenja, Proveri razgovor, mogući retry i otkazivanje. Sledeća ispravka prikaza treba da bira jednu glavnu akciju prema potvrđenom stanju: proveravanje, siguran retry ili povratak na sačuvan odgovor.

Posle odlaska sa ekrana memorija čuva identitete zahteva, ne sirovi neposlati tekst. To je postojeća granica privatnosti. UI treba razumljivo da objasni kada je ponovno kucanje potrebno; ne uvoditi trajno skladištenje sadržaja samo da bi dugme delovalo jednostavnije.

Donja kartica radnog profila, poslednja poruka i polje za unos zauzimaju mnogo prostora. Naredni dizajnerski korak je kompaktniji sažetak sa proširenjem i stvarnim statusom potvrde. Zadržati razgovor čitljiv i pri povećanom fontu; ne smanjivati ceo tekst da bi sve stalo.

Standardna usidrena Android tastatura nije potvrđena: emulator koristi plivajući IME. Ove slike ne dokazuju konačan keyboard layout ni performanse na HONOR-u.

## 7. Provere lokalne ispravke

| Provera | Rezultat |
| --- | --- |
| Node: stvarni Edge handler-i i istorijski izvor | 73 PASS / 0 FAIL |
| Ciljani klijentski skup | 3 paketa, 141 PASS / 0 FAIL |
| TypeScript --noEmit | izlaz 0 |
| git diff --check | PASS |
| Novi puni Jest/CI/APK | nije izvršen za ovu lokalnu ispravku |

Pre ispravke uži Edge skup imao je 20 PASS / 12 FAIL od 32; uži UI skup 75 PASS / 1 FAIL od 76. Konačni skup je proširen relevantnim regresijama. Ne porediti različite ukupne brojeve kao isti nepromenjeni skup.

Komande za ponavljanje:

```sh
node --test supabase/proofs/ai/interview_auth_preflight.test.mjs supabase/proofs/ai/v5_ai_stream.test.mjs supabase/proofs/ai/v5_worker_edge.test.mjs supabase/proofs/ai/historical_intake_source.test.mjs
npm test -- --runInBand src/data/__tests__/worker-ai-conversation-recovery.test.tsx src/data/__tests__/worker-ai-client.test.ts src/data/__tests__/ai-need-turn-stream.test.ts
npx tsc --noEmit
```

Hash-evi izvora i lokalnih logova su u AI_NATIVE_RESULT_20261018.json. Prethodni puni CI rezultat 620 paketa / 13.829 testova odnosi se na raniji APK kandidat; ne prenosi se na nove ispravke bez novog izvršavanja.

## 8. Konkretan paket i sledeći koraci

1. **Spreman kandidat za Edge:** samo dva index.ts fajla — F1 i F2. Svih ostalih 13 zapakovanih fajlova identično je živom preflight-u. Sačuvani su kompletni v90/v45 paketi za vraćanje i manifest INTERVIEW_RECOVERY_CANDIDATE_20261018.json. Status je SOURCE_TESTED_NOT_DEPLOYED.
2. Za njegovu objavu traži se jedno novo, imenovano odobrenje prema AGENTS.md §3.1.10. Upravo iskorišćena dozvola obuhvatala je šest testnih AI poziva, ne ovaj novi deployment. Objavu zatim potvrditi ponovnim čitanjem svakog fajla. Ne podrazumeva dodatne AI pozive.
3. **Alias/ID tok:** usaglasiti Edge katalog, SQL review i binder sa dokazom iz autoritativne baze. Testirati tačan alias, nepoznat alias, širi alias, pogrešnu kategoriju, dva režima, zastareo katalog i ukinutu uslugu.
4. **Jedan naredni APK:** uključiti F3 uz koherentan paket pregleda/statusa. Potvrditi tipkanje, slanje, grešku, retry, Back/reopen i pregled na emulatoru.
5. Tek uz poseban odobren obuhvat proveriti Save → ID + potvrđeni režim → ponovno čitanje → matching sa drugim nalogom. Ovaj test to nije radio.
6. Zasebno ostaju nove grane/više nivoa, cela Srbija/Vojvodina/više gradova, rute, dispatch i odobreni jednokratni push. To nisu zaključci iz šest razgovornih odgovora.

## 9. Sirovi dokazi i privatnost

Snimci i stvarni razgovorni podaci ostaju lokalno u privatnom radnom/output folderu. U repozitorijum ulaze ovaj sažetak, hash-evi, brojevi i regresioni testovi sa sintetičkim ulazima. Nema tokena, lozinki ni sirovih korisničkih razgovora u Git paketu.

User-facing galerija sadrži devet odabranih snimaka ovog testa, uključujući neuspehe. Oni dokazuju navedena stanja prethodnog instaliranog APK-a, ne izgled novog source patch-a. Sve stare dokaze i otvorene granice čuva postojeći registar.
