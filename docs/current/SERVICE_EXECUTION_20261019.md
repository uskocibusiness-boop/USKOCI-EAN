# Način rada konkretne usluge i predaja rezultata — 19.10.2026.

## Namena ovog paketa

Vlasnik je odobrio jednostavnije povezivanje usluge i stvarnog načina rada. Ostaju postojeći UUID-jevi i dva režima. Ovo nije novi tok, treći režim ili paralelni ručni editor.

- **ON_SITE**: izvršilac mora da dođe na mesto rada ili obavi traženu rutu. Stvarno krečenje stana nije remote savetovanje.
- **REMOTE**: posao se obavlja bez dolaska izvršioca kod naručioca — digitalno ili kod izvršioca. Slanje kurirskom službom / preuzimanje predmeta nije samo po sebi rad kod naručioca.
- Organizacijski roditelj može imati drugačije sopstvene režime od konkretne podusluge. Ciklusi, nepostojeći/retired roditelji i identitet usluge ostaju provereni.
- Ako ista konkretna usluga već postoji, ali nema opravdani režim, `EXTEND_MODE` predlaže proširenje istog UUID-a. Nema duplikata kategorije ili automatskog proširenja sposobnosti svih radnika.

## Jedan podatak o predaji

Za REMOTE postoji opcioni strukturirani `handoff`: bez fizičke predaje, slanje u potvrđene države, lično preuzimanje u potvrđenom gradu, ili obe izričito podržane alternative. Ne sadrži ulicu, kućni broj, telefon ili pin. Grad profila nije dokaz da se tu može preuzeti predmet.

Novi završni pregled REMOTE zadatka zahteva ovaj podatak. Za očigledno digitalni rezultat AI upisuje „Bez fizičke predaje“, bez dodatnog besmislenog pitanja. Ako fizička predaja nije razjašnjena, pregled ostaje nepotpun. Na radnom profilu je podatak vezan za konkretnu uslugu.

Matching fizičke predaje zahteva zajedničku državu slanja ili isti potvrđeni grad i državu preuzimanja. Gradovi se porede postojećom normalizacijom srpskog pisma; ovo nije novi geografski katalog ili poligonska provera oblasti. Podatak se prikazuje u postojećem pregledu i bitnim uslovima zadatka.

## Granice autoriteta

Razgovor i priprema pregleda čuvaju nacrt i predlog. Ne upisuju kanonsku kategoriju, sposobnost, aktivaciju, objavu ili push. Potpisani pregled, eksplicitno čuvanje, proverena aktuelna revizija i postojeći admission/binding tok ostaju granice. Predaja zadatka je isti tipizirani podatak u pregledu, čuvanju i matching-u. Promena predaje ulazi u materijalni fingerprint.

Pri nepovezanoj izmeni radnog profila sačuvana predaja se čuva. Promena usluge, režima ili predaje zahteva odgovarajući korisnički iskaz i novi pregled. Postojeći radnici ne dobijaju novu sposobnost samo zato što se kategoriji doda režim.

## Šta ovaj paket ne dokazuje

- Fizičku izvodljivost proizvoljnog posla procenjuje AI. SQL proverava identitet, rizik, stanje i potpisani tok; ne postoji deterministički dokaz razumevanja svakog mogućeg opisa.
- Stari zadaci bez strukturirane predaje ostaju sa istorijskom politikom kompatibilnosti. Nedostajući podatak nije prepisan u tvrdnju o slanju svuda. Novi/promenjeni REMOTE zadaci zahtevaju predaju pre prihvatanja pregleda.
- Sačuvani javni radni profil još nema zaseban prikaz predaje po usluzi; novi potpisani pregled je prikazuje. Čitanje tog sažetka na profilu je naredna UI dorada.
- Predaja ne uvodi potvrdu dostave, praćenje kurira, plaćanje, geokodiranje grada ili novu notifikacionu vrstu.
- SQL fixture sa sintetičkim graničnim servisima nije dokaz celog živog toka. Živi razgovor, Save, matching, build i emulator imaju odvojene rezultate.

## Dokazi i primena

**DEV APPLIED / FULL REGRESSION PASS / REAL AI + SAVE + MATCHING PROVEN / EMULATOR VERIFIED.** Produkcioni izvor paketa je `b6f2529a`; klijent i provereni APK/OTA `5f422987`. Kasnije izmene acceptance harness-a, OTA readback provere i ovog izveštaja ne menjaju runtime aplikacije.

- DEV migracije: `20261019111512 taxonomy_parent_navigation_and_mode_admission` i `20261019115240 service_handoff_signed_matching`. Izvorni timestamp-i su `20261019104047` i `20261019104604`. Tačno pročitano 25/25 završnih definicija funkcija.
- Task Edge **106**, Worker Edge **59**; sadržaj svih 16/14 fajlova jednak proverenim Git blobovima. Prethodni paketi 105/58 sačuvani za dijagnostiku; samo vraćanje Edge-a nije dovoljno da stari klijent razume nove podatke.
- Puna regresija na `5f422987`: **621/621 paketa, 13.898/13.898 testova**, bez preskočenih testova; TypeScript, vlasništvo izvora i integritet migracija prolaze. CI `39244025948 SUCCESS`.
- PostgreSQL 16/17: parent-mode CI `39242766132 SUCCESS`; handoff CI `39242765470 SUCCESS`. Početne greške izolovanog SQL fixture-a sačuvane u istoriji i ispravljene, bez slabljenja proizvodnih provera.
- 775 Node provera proizvodnog paketa; završni acceptance/OTA delta 81/81; izolovana worker aktivacija 20/20 offline mock provera.
- Android x86_64 APK napravljen, hash potvrđen i instaliran sa `-r`. Stara emulator sesija sačuvana u Android korisniku 0; QA je izveden u odvojenom korisniku 10. Vraćeni originalni korisnik, rezolucija 1264×2728, density560 i font1.15.
- Android ARM64 APK iz istog izvora takođe je napravljen: CI `39244981498 SUCCESS`, 99.152.676 bajtova, SHA256 `7baf223c249c78b569d54693e38ef52c30cf9b13aa5189c1c0645099cb224e90`. Paket `rs.uskoci.preview`, versionCode35, runtime `uskoci-v1-preview-r1`, preview kanal. Artefakt i receipt su provereni i isporučeni; nije instaliran na telefon. Expo prebuild je promenio samo npm android/ios skripte iz start u run; sačuvan diff nije nepoznata promena proizvodnog izvora.
- Preview OTA grupa `fdd77368-7658-4740-ae62-5cf125556ec1`, update `01a15400-a8a1-7c83-8aa8-f5a03a27b9c2`, source `5f422987`. Pročitan sirov Expo group odgovor i potvrđen isti OTA na emulatoru. CI `39247299339` je objavio paket, ali završio FAILURE zbog čitanja dekorisane list-message poruke. Parser je fizički ispravljen da listu koristi samo za pronalaženje, a `update:view` za strogu proveru identiteta. Nije bilo duple objave.
- EAS preview-u je nedostajalo svih 14 obaveznih javnih build postavki. Usklađene su sa `eas.json` i ponovo pročitane. Preview kanal je aktivan i vodi na preview granu. Tajne nisu deo dokaza.

## Stvarni razgovori i čuvanje

Dva odvojena DEV_ACCEPTANCE_QA naloga; Milošev nalog/razgovor nisu menjani. Sedam scenarija, osam logičkih poruka, 22 stvarna model poziva. Izmereno trajanje zahteva 8,2–23,4s; interni izmereni obračun **0,222529 USD**, bez preostalih rezervacija. To nije potvrda računa dobavljača. Privremeni AI pristupi oba QA naloga su ugašeni po završetku.

| Scenario | Stvaran rezultat |
| --- | --- |
| 3D figurica, samo preuzimanje Novi Sad | REMOTE, postojeći 3D UUID, samo potvrđeni grad RS/Novi Sad; nema slanja ili tačke rada kod naručioca |
| 3D figurica, samo kurirsko slanje Srbija | REMOTE, isti 3D UUID, samo shippingCountries RS |
| Digitalna PowerPoint prezentacija | REMOTE, postojeća usluga, handoff.required=false; bez besmislenog pitanja o kuriru |
| Fizičko krečenje bez dolaska, bez savetovanja | AI objasnio da nije moguće, pitao da li korisnik prihvata dolazak; canAccept=false, bez REMOTE klasifikacije |
| Restauracija mehaničke muzičke kutije | CREATE_CHILD pod Fina mehanika; nakon Save nova ESTABLISHED grana `1496f3ef-89ed-4637-ad23-63409028bc4b` i stvarno vezan nacrt |
| Radnik 3D, predaja prvo nepoznata | AI sam pitao o slanju/preuzimanju; ništa nije izmišljeno. Drugi odgovor potvrdio samo RS slanje; zaseban potpisani Save aktivirao QA radnika |
| Popravka pisaće mašine uz slanje | EXTEND_MODE na istom UUID `11e218ed-e072-4609-bcee-9576aa4c2e16`; posle Save ON_SITE+REMOTE, bez dupliranja kategorije i bez dodeljivanja novog režima drugim radnicima |

Pre čuvanja su nezavisno poređeni otisci kataloga, kanonskih profila, zadataka i oba tipa vezivanja. Ostali su nepromenjeni. Tokom razgovora nastaju poruke, nacrt, potpisani pregledi i evidencija AI potrošnje; ne nastaje objavljeni zadatak.

Četiri zadatka su zatim sačuvana kroz stvarni autentifikovani `rpc_accept_ai_task_review`. Sva četiri su **DRAFT**, sa `published_at=null` i potvrđenim kanonskim UUID vezivanjem. Jedan radni profil aktiviran je zasebnim normalnim `rpc_save_worker_ai_review`, bez direktnog patch-a kanonskih činjenica. Katalog je prešao sa 136 na 137 kategorija: jedan novi stvarni servis, jedno proširenje režima postojećeg servisa.

## Stvarno povezivanje

Proveren je postojeći `worker_need_fit_v1` nad stvarno sačuvanim zadacima i aktiviranim QA profilom. Nisu ubačeni sintetički binding redovi.

- Ista 3D usluga + slanje RS na obe strane: **matches=true**, service=true, area=true, taxonomyTier=EXACT, timeTier=1.
- Ista 3D usluga, radnik samo šalje, zadatak traži samo preuzimanje u Novom Sadu: **matches=false**, service=true, area=false. Grad profila nije protumačen kao dozvola za preuzimanje.
- Za upoređena dva nacrta: 0 dispatch rasporeda, krugova, prilika, prijava, izbora, Dogovora, događaja i push pokušaja. Završna provera sva četiri nacrta takođe nalazi 0 rasporeda/prilika/push pokušaja.
- Ovo je dokaz računanja matching-a i granice objave. Nije dokaz isporuke obaveštenja na telefon. Aktiviranje radnika može legitimno ponovo zakazati proveru drugih već objavljenih zadataka; ne tvrdi se da je cela globalna dispatch baza nepromenjena.

## Provera na emulatoru i preostali posao

Pročitani su stvarni razgovor i review sa novim predajnim podatkom, source i OTA identitet. Pregled pre objave vizuelno je proveren na **361/390/412dp × font1.0/1.3**. Predaja i obe donje akcije čitljive su bez horizontalnog sečenja. Back vraća sadržaj istog zadatka. Prve fotografije nastale tokom Android relaunch-a pokazivale su About ekran i nisu prihvaćene kao review dokaz; pregled je ponovljen nakon stabilnog pokretanja.

Preostale konkretne granice:

1. Prvi radnički review može biti READY iako predaja još nije poznata. U ovoj probi AI je postavio pravo pitanje; nije pretpostavio predaju. Bez potvrđene predaje radnik ne dobija nove fizički ograničene REMOTE zadatke. READY klasifikacija nije dokaz da su razjašnjene sve korisne preferencije.
2. Stari radni profil ne dobija izmišljenu saglasnost za slanje/preuzimanje. To treba potvrditi kroz AI i Sačuvaj. Potreban je jasan prikaz tih podataka na sačuvanom javnom radnom profilu; ovaj paket ih prikazuje u potpisanom pregledu.
3. Tekst `Predaja: Slanje: RS` je tačan, ali tehnički i repetitivan. Sledeća UI celina treba da kaže prirodno „Slanje u Srbiji“, prikaže predaju i u živoj kartici i dovrši AI-only ulaz umesto preostale olovke lokacije. Nije rađen novi masovni redizajn.
4. Nova grana i proširenje jednog režima provereni su uživo; proizvoljno višeslojno grananje i svi višeuslužni razgovori nisu ovim malim uzorkom dokazani. Determinističke SQL/handler provere pokrivaju dodatne granice.
5. Telefon, objava → stvarna push isporuka, svi offline slučajevi i kompletan marketplace/Dogovor tok nisu predmet ove native probe. Preview OTA je objavljen; korisnik starog APK-a mora učitati novi sadržaj/instalirati novi kompatibilan APK. Telefon nije proglašen ažuriranim bez provere.

Mašinski dokaz: [SERVICE_EXECUTION_20261019.json](evidence/SERVICE_EXECUTION_20261019.json). APK/OTA i ARM64 rezultat čitaju se iz tog dokaza; nijedan build se ne izjednačava sa fizičkom proverom telefona.

Izvori: migracije `20261019104047` i `20261019104604`; dokaz `supabase/proofs/dynamic_taxonomy/parent-mode-admission/` i `service-handoff/`; stvarni AI handler testovi i zajednički `serviceHandoff` ugovor. Postojeći master plan i registar tokova ostaju autoritet napretka proizvoda.
