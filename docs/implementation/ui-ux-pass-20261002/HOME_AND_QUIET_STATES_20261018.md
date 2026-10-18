# Početna i prazna stanja — 18.10.2026.

## Odluka i obim

Vlasnik je posle pregleda 21 snimka tražio da se sa Početne skloni „Bezbedniji dogovor“, da ostanu dva velika ulaza i da stvarni aktuelni zadaci budu dostupni odmah. Ovaj krug menja samo klijentsku prezentaciju. Nema izmene Supabase-a, poslovnih pravila, plaćanja, privatnosti ili zavisnosti. Bezbednosna pravila u toku Dogovora nisu uklonjena.

Polazni izvor: `995c122b` na `feature/unified-qa-master-20261017`. Pre izmene `HomePresentation` je iscrtavao TrustSeal pre dve radnje, pa pregled zadataka. `homeOpportunityPreview` je već uklanjao zadatke istog naloga, ali nije potvrđivao poklapanje sa radnim profilom. Zato je naslov pregleda promenjen iz „Zadaci za tebe“ u tačno „Aktuelni zadaci“. To nije implementacija personalizovanog matching-a.

## Promene

- Početna: uklonjena savetodavna kartica i njeni stilovi. Dve glavne radnje su prvi sadržaj. Sledeći prihvaćeni Dogovor, kada postoji, ostaje odmah iza njih; AI nastavak i pregled zadataka dolaze zatim. Pregled prikazuje najviše tri stvarne kartice, sa ulazom u sve zadatke čija dodirna zona ima najmanje 48 dp.
- Zadaci: brojač prazne liste sada kaže „0 zadataka“, dok stanje ispod objašnjava *zašto* ih nema i daje odgovarajuću radnju. Time nestaje vidljivo ponavljanje „Nema zadataka“ na istom ekranu.
- Dogovori i Poruke: kada drugi tab već ima podatke, prazno stanje aktuelnog taba koristi kompaktan prikaz. Prvi susret sa potpuno praznim skupom zadržava veći uvodni prikaz.

## Provera

- TypeScript `npx tsc --noEmit --pretty false`: PASS.
- Ciljani Jest: 5 paketa, 414/414 testova PASS. Jedno postojeće očekivanje brojača je promenjeno na `0 zadataka`, prema namernoj izmeni UI kopije.
- `git diff --check`: PASS.
- Metro debug APK `rs.uskoci.preview` na `emulator-5554`: viđena Početna bez TrustSeal, kao i kompaktni prazni Aktivni Dogovori i Aktivne Poruke. U Zadacima su viđena dva zadatka označena „Tvoj“; na Početnoj se ispravno ne predstavljaju kao tuđi rad. Snimci su lokalno sačuvani u Codex `outputs`, bez dodavanja fotografije profila u javni Git repozitorijum.
- Metro je tokom prve provere ostao na učitavanju JS bundle-a. Ponovo je pokrenut lokalno, zatim je Android bundle uspešno izgrađen (`6025 modules`) i pregled na emulatoru je nastavljen. To nije dokaz finalnog release APK-a.

## Šta ostaje otvoreno

- Stvarni „Za tebe“ blok zahteva potvrđeno povezivanje Home pregleda sa matching-om i pošteno stanje kada nema poklapanja. Ovaj krug samo ispravlja naziv i odbacuje sopstvene zadatke.
- Veliki skup zadataka na mapi, kretanje kamere, rad filtera na daljinu i performanse nisu promenjeni niti prihvaćeni ovim krugom.
- Novi izgled nije proveravan na fizičkom HONOR telefonu, niti je napravljen novi release APK. Telefon/status kontrole ostaju DELIMIČNO.
- Gostujući ulaz, AI razgovor za zadatak/profil, javni profil druge osobe, ikonice i animacije su sledeći odvojeni UI krugovi.

## Razlika prema ranijem UX nacrtu

Nacrt je čuvao dva velika ulaza, „Sledeće“ i „Čeka te“. Oni ostaju. Najnovija izričita odluka vlasnika uklanja savetodavnu karticu sa Početne. Naslov „Aktuelni zadaci“ ispravlja raniji naslov koji je obećavao personalizaciju bez potvrde u tom čitanju. Prvi susret sa praznim Dogovorima/Porukama zadržava postojeću uvodnu ilustraciju; samo prazan podskup postaje kompaktan.
