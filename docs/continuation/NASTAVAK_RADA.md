# USKOČI — prenos rada i komanda za nastavak

Ovo je ulaz za nastavak, ne novi plan. Jedini izvršni master ostaje [CODEX_PLAN_RADA.md](../plan/CODEX_PLAN_RADA.md), a jedini proizvodni autoritet [USKOCI_PRODUCT_UX_MASTER.md](../product/USKOCI_PRODUCT_UX_MASTER.md). **Aktuelni prenos: 03.11.2026, za čet sa pristupom samo GitHubu.** Istorijski ulazi od 28–30.10. ostaju ispod; njihove početne komande i statusi ne zamenjuju ovaj checkpoint.

## Aktuelni presek — 03.11.2026.

GitHub je dovoljan za nastavak pregleda izvora i, uz odgovarajući alat, izmene koda. Sam GitHub pristup ne daje mogućnost pisanja, terminal, Supabase sesiju ili emulator. Čitanje datiranog DEV dokaza nije nova provera žive baze.

| Predmet | Potvrđeno stanje i granica |
|---|---|
| Repo / grana | `uskocibusiness-boop/USKOCI-EAN`, `work/rev14-review-f17`; repo je javan. |
| PR | [#43](https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/43), OPEN/DRAFT, baza `feature/uskoci-cisto`. |
| HEAD pre ovog prenosa | `982212180e6df47f3c86bcb3dc78200811ce03e0`; lokalni, remote i PR HEAD podudarni. Proveriti noviji HEAD. |
| Runtime source | `c86ab501ba461abd4db1cafe200c4ebe6f09c04e`; dokumentacioni commit nije nova aplikacija. |
| Glavni CI | [41608739552 SUCCESS](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41608739552), isti runtime SHA; 627 mobilnih suite-ova/14.588 testova; glavni AI 1.519 PASS/0 FAIL/1 postojeći TODO; TS/Deno, SQL/integritet, sedam PostgreSQL konkurentnih scenarija i PostGIS PASS. |
| R01 | [41608739621 FAILURE](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41608739621); 8 strict, 49 owner/ACL, 3 managed-net razlike. Captured disposable parity pre poslednjeg prenosa, ne novi puni replay promenjenog DEV-a. |
| DEV | `leqcwgzvjsxugfgzdmth`; tri nove migracije stvarno primenjene, preflight/postflight PASS. |
| Migracija 1 | `20261103092404` / `r08_application_service_review_v1`: dodavanje poznate usluge iz sopstvene prijave u radni profil bez nove AI klasifikacije. |
| Migracija 2 | `20261103092413` / `task_ai_application_deadline_v1`: rok prijava; poznata činjenica iz razgovora ima prednost nad zastarelim klijentskim argumentom. |
| Migracija 3 | `20261103092425` / `r04_r06_single_pass_atomic_first_plan_v1`: povezan single-pass rezultat, trajan upis i ponovno čitanje istog ishoda. |
| Edge | Need interview **164**, Worker interview **116**; oba kompletna paketa preuzeta posle deploy-a i sadržaj svih fajlova odgovara source-u. |
| Post-save | Verzija **13**, dva relevantna fajla jednaka source-u; nije ponovo deploy-ovana. Nema novog modela u tom worker-u. To nije runtime tick/push dokaz. |
| Android | APK iz `c86ab501`, `rs.uskoci.preview`, instaliran na `emulator-5554` uz sačuvanu prijavu. Osnovni ekrani, razgovor/potpisani pregled profila i detalj postojeće objave otvoreni. Bez novog Save/Publish ili modelskog poziva u tom prolazu. |
| Rok u APK-u | SQL podrška je instalirana, ali client flag nije uključen. Edge flag nije menjan niti je njegova vrednost ovim dokazom potvrđena. |
| R10 | Retention readiness false, export/erasure binding NULL; sertifikat netaknut. Ograničen export/erasure-plan nije potpuno brisanje naloga. |

**DEV sintetički prijem:** stvarna šema, transakcioni Worker completion, isti-key replay, lost-ACK readback, potpisani REMOTE Save+Activate bez grada, batch/binder, foreign-owner zabrana, ograničen export i erasure plan. Fixture podaci vraćeni rollback-om; posle commit-a nema tih probnih Auth/conversation redova. Nisu dokazani stvarna GoTrue/PostgREST prijava, novi Gemini razgovor ili saradnja dva naloga.

**HTTP:** šest OPTIONS/missing-auth/invalid-token proba oba Edge-a prolazi. To ne dokazuje validan Auth poslovni tok ili provider.

**Spremnost:** nadzirana interna vlasnička proba CONDITIONAL GO. Samostalna spoljna zatvorena beta i javno izdanje NO-GO dok se ne zatvore relevantne privatnosne, E2E, poslovne i release granice. Nije svaki preostali cleanup obavezan za prve korisnike.

### Dokazi dostupni preko GitHuba

- [DEV receipt](../../supabase/operations/dev-alpha/r04-single-pass-20261103/dev-delivery-20261103.json): verzije, migracije, hash-evi, testni obuhvat i ograničenja.
- [HTTP access dokaz](../../supabase/operations/dev-alpha/r04-single-pass-20261103/edge-postdeploy-access-20261103.json): šest stvarnih proba, bez korisničkih sesija/modela.
- [APK source/identity dokaz](../../supabase/operations/dev-alpha/r04-single-pass-20261103/apk-source-verification-20261103.json): source i hash-evi; nije APK download.
- [Pet dodatnih R08 provera](../../supabase/operations/dev-alpha/r04-single-pass-20261103/application-service-combined-proof-20261103.txt): log izolovanog prolaza postojećeg R08 testa sa novim resolved-hint čitačima. Privremeni lokalni adapter nije prenosiv testni alat; originalni test i dependency izvori jesu u repou.
- [Indeks dokaza](../../supabase/operations/dev-alpha/r04-single-pass-20261103/handoff-evidence-20261103.json): veličine/hash-evi i lokalna ograničenja.
- Paketi: [single-pass](../../supabase/operations/dev-alpha/r04-single-pass-20261103/), [usluga iz prijave](../../supabase/operations/dev-alpha/r08-application-service-20261103/), [rok](../../supabase/operations/dev-alpha/task-ai-deadline-20261103/).
- [Audit 02.11.](deep-audit-20261102/IZVESTAJ.md): polazna R/C/SV/S01–S18 matrica i reprodukcije. **Istorijske preporuke da se zadrži Dual Gemini i tvrdnje da first-plan nije prenet prevaziđene su kasnijom vlasničkom odlukom i ovim dokazom.** Ostale nalaze proveravati po istom ugovoru.
- [Source bridge](source-bridge-20261030/README.md), postojeći payload/manifesti i restore alati ostaju na GitHubu. Čet bez terminala ne sme tvrditi da ih je izvršio.

APK od 123.083.267 bajtova i slike/XML sa ličnim podacima nisu poslati u javni repo. APK SHA-256: `eb533386498e6e4ae4b88b28dec198fbf61ce9c971a3cce1487ada728f21f4d6`. Novi čet nema taj lokalni fajl ili prijavljeni emulator. Preview potpis nije store izdanje. Pre prenosa tracked source je čist; raniji korisnički `.codex-remote-attachments/` nije menjan ili kopiran.

## Komanda za novi ChatGPT čet koji ima samo GitHub

Kopirati ceo blok. Ovo je uputstvo za nastavak istog mastera, ne drugi backlog.

```text
USKOČI — NASTAVAK RADA PREKO GITHUBA, BEZ STAROG LOKALNOG FOLDERA

1. MISIJA I NAČIN RADA

Nastavi stvarno dovršavanje postojeće USKOČI aplikacije prema jednom postojećem planu. Ja nisam programer. Želim jednostavnu, brzu i pouzdanu aplikaciju: korisnik kroz prirodan AI razgovor pravi zadatak ili radni profil, pronađe odgovarajuću osobu/posao, prijavi se, dogovori i završi saradnju. Početno tržište je Srbija; konkretni samostalni zadaci/usluge, ne rad u smenama.

Ne počinji iznova, ne pravi novi master ili generičku arhitekturu. Nastavi od poslednjeg dokaza. Koristi stručne perspektive mobilnog, SQL, AI, UX, sigurnosti i release inženjeringa, ali nemoj izmišljati da je nezavisni tim potvrdio rezultate. Radi konkretne povezane izmene i nastavljaj; ne završavaj samo novim planom.

2. PRVO PROVERI ŠTA ZAISTA MOŽEŠ DA URADIŠ

Ovaj čet ima GitHub pristup, nema stari lokalni folder, Supabase sesiju, Android emulator ili testne prijave iz prethodnog četa. Proveri dostupne alate za čitanje grane/fajlova/PR-a/Actions, pisanje commitova, pokretanje workflow-a i eventualni terminal.

Ako alat dozvoljava pisanje, ovlašćen si za povezane source izmene i commit/push na postojeću radnu granu i Draft PR. Ako je konektor samo za čitanje, jasno reci to i pripremi konkretan pregled/patch; ne tvrdi da si poslao commit. GitHub nije Supabase pristup. Čitanje receipt-a je datirani dokaz, ne tvoj novi live query.

Ne traži stari lokalni folder pre nego što proveriš sačuvane izvore. Ne traži lozinke, JWT ili API ključeve u četu ili repou. Repo je javan. Ne objavljuj privatne slike/profil/podatke. Ne radi force push, reset, automatski merge, produkcioni deploy, izdavanje prodavnice, naplatu ili brisanje podataka.

3. REPOZITORIJUM I AUTORITETI

Repo: uskocibusiness-boop/USKOCI-EAN
Radna grana: work/rev14-review-f17
Draft PR: https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/43
Ciljna integraciona grana: feature/uskoci-cisto

Ne nastavljaj sa default grane. Eksplicitno čitaj radnu granu ili potvrđeni SHA. Proveri najnoviji HEAD, PR bazu/stanje, novije commitove i relevantni CI. Dokumentacioni HEAD pre prenosa 03.11.2026. bio je 982212180e6df47f3c86bcb3dc78200811ce03e0; to nije naredba da vratiš noviji rad.

Jedini izvršni master: docs/plan/CODEX_PLAN_RADA.md
Jedini Product/UX master: docs/product/USKOCI_PRODUCT_UX_MASTER.md
Aktuelni ulaz: docs/continuation/NASTAVAK_RADA.md
Istorijski source bridge: docs/continuation/source-bridge-20261030/
Datirani detaljni audit: docs/continuation/deep-audit-20261102/IZVESTAJ.md
Najnoviji DEV dokaz: supabase/operations/dev-alpha/r04-single-pass-20261103/dev-delivery-20261103.json

Pročitaj izvršni master sistematično od početka do kraja jednom za orijentaciju. Posebno §4, R01–R12, C01–C19, SV01–SV14, §8.1a, §10, §11.2a i §12.6. Razdvoji važeće odluke, istorijski nalaz i noviji dokaz. Product koristi po važećim A–J/S01–S18 ugovorima, ne istorijskim dodatnim kopijama.

Posle početnog učitavanja čitaj relevantan ugovor i stvarnog čitača/upisivača izabranog posla. Ne analiziraj sve arhive iznova pri svakoj izmeni. Ako bez terminala ne možeš raspakovati payload, ne izmišljaj da jesi; prvo koristi dostupne tekstualne registre i aktuelni source.

4. POSLEDNJI POTVRĐENI KOD I CI

Runtime source: c86ab501ba461abd4db1cafe200c4ebe6f09c04e.
Full CI: https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41608739552 — SUCCESS.
R01: https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41608739621 — FAILURE.

Full potvrđuje 627 mobilnih suite-ova/14.588 testova, glavni AI skup 1.519 PASS/0 FAIL/1 postojeći TODO, TS/Deno, SQL/integritet, sedam konkurentnih PostgreSQL scenarija i PostGIS. To važi za taj SHA i taj obuhvat, ne za produkciju. Ne računaj procenat završenosti iz broja testova.

R01 ostaje 8 strict/49 owner-ACL/3 managed-net razlike, captured disposable obuhvat pre poslednjeg DEV prenosa. To nisu 60 pokvarenih korisničkih funkcija. Otkazani run nije PASS. Dokumentacioni commit nije novo testiranje runtime-a.

5. ŠTA JE VEĆ NA DEV-U — NE IMPLEMENTIRAJ PONOVO KAO DA NEDOSTAJE

DEV projekat: leqcwgzvjsxugfgzdmth.
Primene u živom ledger-u:
20261103092404 — r08_application_service_review_v1
20261103092413 — task_ai_application_deadline_v1
20261103092425 — r04_r06_single_pass_atomic_first_plan_v1

Paketi su u:
supabase/operations/dev-alpha/r08-application-service-20261103/
supabase/operations/dev-alpha/task-ai-deadline-20261103/
supabase/operations/dev-alpha/r04-single-pass-20261103/

Tačni preflight/postflight-i prošli su pri primeni. Need interview Edge164 i Worker interview Edge116 stvarno su deploy-ovani i kompletan preuzeti source poređen sa paketom. Post-save13 već odgovara source-u, nije ponovo deploy-ovan i ne poziva novi Gemini.

Ranije odsutni RPC-jevi sada su prisutni:
rpc_ai_complete_need_turn_with_first_plan_service
rpc_ai_complete_need_location_turn_with_first_plan_service
rpc_complete_worker_ai_turn_with_first_plan_service
rpc_ai_read_first_plan_completion_service
rpc_worker_service_from_application
rpc_prepare_ai_task_review_deadline
rpc_prepare_ai_task_review_deadline_taxonomy

Ne mešaj njihovo postojanje sa dokazom svakog poslovnog scenarija. Frozen manifest može imati PREPARED_NOT_APPLIED: to je opis trenutka pripreme. Kasniji delivery receipt dokumentuje primenu. Ne menjaj istorijske hash-eve ili ponavljaj migraciju da bi natpis izgledao ažurno.

Postojeći verify_jwt=false kod dva interview Edge-a ne znači anoniman pristup: Auth se proverava unutar handler-a. Ne menjaj to bez razumevanja stvarne putanje.

6. GRANICE STVARNOG DOKAZA

Na sadašnjoj DEV šemi prošao je transakcioni sintetički Worker completion, isti-key replay/lost ACK, potpisani REMOTE Save+Activate bez grada, batch/binder, foreign-owner odbijanje, ograničen export i erasure plan. Fixture redovi povučeni rollback-om. To nije GoTrue/Auth/HTTP prijava, Gemini ili potpuno brisanje naloga.

Posle deploy-a šest HTTP proba potvrđuje OPTIONS i odbijanje nedostajuće/nevažeće prijave. Nema validnog korisničkog poslovnog toka u tom dokazu.

APK iz c86ab501, rs.uskoci.preview, instaliran je na emulator-5554 uz sačuvanu prijavu. Vidljiv source c86ab50; otvoreni Početna, profil, podešavanja/About, radni profil, razgovor i potpisani pregled, sopstveni zadaci i detalj postojeće PUBLISHED REMOTE objave. Nema novog Save/Publish/Gemini poziva u tom prolazu.

APK hash: eb533386498e6e4ae4b88b28dec198fbf61ce9c971a3cce1487ada728f21f4d6.
Binarni APK i privatni ekranski snimci nisu na javnom GitHubu; bezbedni identity metapodaci jesu. Nemaš pristup tom emulatoru/fajlu samo zato što imaš GitHub. Preview potpis nije produkcioni AAB ili iOS izdanje.

Dokazi su uz dev-delivery-20261103.json:
edge-postdeploy-access-20261103.json
apk-source-verification-20261103.json
application-service-combined-proof-20261103.txt
handoff-evidence-20261103.json

7. NOVIJA VLASNIČKA ODLUKA: SINGLE-PASS AI

Kasnija odluka vlasnika i aktuelni source/DEV superseduju stare Dual Gemini instrukcije. Ne vraćaj drugi pozadinski klasifikator ili tool-calling explorer zato što ih audit od 02.11. preporučuje. Taj audit ostaje koristan za druge datirane nalaze.

Jedan redovni intake odgovor daje razgovornu poruku, strukturisane činjenice i internu semantičku odluku uz dinamički katalog. Server proverava i trajno beleži rezultat; recovery čita isti ishod. Post-save radi sa već sačuvanim planom bez ponovnog modela. Ne pravi novu paralelnu queue tabelu samo zato što stari audit govori o nedostajućem durable first-plan-u.

To ne znači da nijedan drugi deo aplikacije nema legitiman LLM/STT poziv. Provera objave ima odvojen ugovor; ne briši je, safety ili usage obračun radi lepšeg broja poziva.

Ne obećavaj odziv ispod sekunde, prompt-cache popust ili novu cenu bez stvarnog merenja. Karakteri prompta nisu tokeni kompletnog zahteva. Stara Dual merenja nisu single-pass merenja. Katalog od 153 čvora/27 KB bio je istorijski uzorak, ne trajna konstanta. Sačuvaj proveru potpunosti stabla, ID-jeva i roditelja.

8. KAKO AI RAZGOVARA I ŠTA ŠALJE SERVERU

Korisnik ne bira kategorije, ne vidi UUID-jeve i ne administrira stablo. AI razume prirodan srpski tekst, sinonime i ispravke; serveru predlaže postojeći ID ili stvarno novu odgovarajuću granu/potkategoriju. Server daje stvarni novi ID i vezuje ga za odgovarajući rezultat. Korisnik potvrđuje svoj zadatak/profil, ne tehničko uređivanje kataloga.

Ne vraćaj doslovni canonical/alias match kao glavni dokaz značenja. Sačuvaj vlasništvo, digest, reviziju, idempotentnost, safety, važeći ID/parent i mode/handoff. AI ne može zaobići tuđa prava ili sam proglasiti neodobrenu sposobnost potvrđenom.

Iz jedne poruke uzmi sve jasne činjenice. Postavi najviše jedno stvarno potrebno pitanje po odgovoru, bez ponavljanja poznatog. Ne izmišljaj cenu, termin, grad, koordinate, broj ljudi, kvalifikaciju ili korisničku saglasnost. Opcioni podatak ne sme proizvesti nepotreban formular.

Gotova kartica/poziv na pregled tek kada su potrebne činjenice i klasifikacija spremne i pregled važeći. Ako nedostaje poslovni podatak, pitaj za njega. Ako provider/server zakaže, prikaži tehnički oporavak; ne pretvaraj kvar u „korisnik nije dovoljno objasnio”. Ne otključavaj Objavi samo da prikriješ sledeći neuspešan upis.

9. ZADATAK — POVEZAN TOK

Proveri razgovor → činjenice/ispravke → usluga/mode → lokacija/termin/cena/ljudi → pregled → potvrda → Save/Publish → autoritativno čitanje.

Zadatak je jedan smislen konkretan posao. REMOTE nema lažan pin; fizički rad/predaja radionici imaju stvarne prostorne zahteve. Grad/područje nisu potvrđena tačna tačka. AI ne izmišlja koordinate; koristi postojeći geocoder i korisničku potvrdu prikazane tačke kada je obavezna.

Razlikuj ukupnu cenu, cenu po osobi i satnicu po osobi po satu. Ne množi nepoznato trajanje u lažni ukupan iznos. Rok prijava nije termin početka rada. Ispravka čuva reviziju, replacement, edit-resume i readback posle izgubljenog odgovora.

Rok prijava: SQL je prenet, ali EXPO_PUBLIC_USKOCI_TASK_AI_APPLICATION_DEADLINE_V1 u poslednjem APK-u nije uključen. Edge USKOCI_TASK_AI_APPLICATION_DEADLINE_V1 nije tim prenosom menjan/proveren. Aktivacija traži usklađen klijent/Edge i stvarni AI→Save→Publish→readback; edit EAS flag-a sam nije dokaz.

10. RADNI PROFIL, VIŠE USLUGA I UČENJE IZ PRIJAVE

Radnik može navesti više različitih usluga; svaka ima svoj category ID i REMOTE/ON_SITE/BOTH/handoff ugovor. Ne svedi ceo profil na jedan mode. Sačuvaj područja, raspoloživost i stvarno navedenu opremu. REMOTE bez fizičke potrebe ne sme zahtevati izmišljen grad.

Proveri prvi Save+Activate, izmenu bez gubitka starih potvrđenih sposobnosti, novu uslugu, namerno uklanjanje, promenu mode-a, isti Save posle izgubljenog odgovora, istekao pregled i promenjen katalog. Isti potvrđeni ID mora opstati kroz review/Save/batch/binder/aktivaciju/matching.

Posle prijave za novu vrstu posla korisnik može dobrovoljno dodati tu uslugu u profil radi odgovarajućih budućih prilika. Zadatak već ima ID: nema novog Gemini poziva, pogađanja sinonima ili tehničkog objašnjenja korisniku. Kratka profesionalna ponuda i jasan pristanak; postojeći tok priprema/čuva i čita rezultat, bez gubitka drugih usluga.

Aktuelni vlasnici:
src/data/applicationServiceClientService.ts
src/ui/workerProfile/ApplicationServiceOffer.tsx
src/app/(app)/profil/usluga-iz-prijave.tsx
rpc_worker_service_from_application

Server je prenet, ali kompletan dvokorisnički native tok još nije potvrđen. Ne dodaj uslugu bez pristanka niti pogrešan novi mode.

11. MATCHING, PRIJAVA, DOGOVOR I PUSH

REMOTE ne ide svim nalozima: odgovarajuća usluga/mode, aktivnost, vreme, TEST/REAL, blokade, preference i dozvole i dalje važe. Za fizički posao validna udaljenija sačuvana oblast ne sme ispasti iz starog prefiltera pre konačnog fit-a. Ručna prijava ima odvojene dozvoljene uslove od automatske preporuke.

R05 saved-area/TODAY kandidati i PostGIS dokaz postoje na GitHubu; poslednji zaseban DEV audit našao je stare funkcije. Tri nove migracije nisu R05 promocija. Profil i zadatak istog vlasnika ne dokazuju međukorisnički matching.

R07 mora očuvati cenu/jedinicu, reviziju, broj mesta, prijavu/izmenu/povlačenje, izbor, frozen Dogovor i završetak. Poslednji DEV audit reprodukuje HOURLY MY_PRICE → UNKNOWN_PRICE_BASIS; nove kolone same ne zatvaraju writer/version/selection ugovor.

R09 mora povezati događaj→tačnu osobu→preference/tihe sate→uređaj/token→red→provider→dostavu→tap na pravi ekran. Cron success nije push dokaz. Proveri PUSH-only target sa isključenim IN_APP, izgubljeni ACK, odjavu i promenu naloga. Običan preview sa inertnim Firebase putem nije kompletan push build.

12. PREOSTALE OBLASTI PO POSTOJEĆEM PLANU

R01/SV01: poslednji audit potvrđuje široki authenticated SELECT na needs i tri privatna polja. To je aplikaciona privatnost, odvojeno od platform parity. Sačuvaj legitimne javne/sopstvene čitače, pripremi preciznu korekciju i pravi Auth/PostgREST pozitivni/negativni dokaz. Sam grant ne dokazuje anonimnu krađu ili stvarno pročitane tuđe podatke.

R02/R03: usklađena lista/mapa, Za mene/filteri, REMOTE, paginacija bez duplikata/lažno praznih strana, own-detail/povratak/promena naloga. Ne uključuj P6 ako backend ne podržava potrebni MAP/PLACES.

R04: nova grana/EXTEND_MODE, postojeći ID, više usluga/handoff i ceo novi single-pass tok sa stvarnim modelom/krajnjim korisnikom. Ne ponavljaj završeni admission/binder posao naslepo.

R05: saved-area/TODAY retrieval→fit→ForMe→dispatch kroz postojeći kandidat i kontrolisani paket.

R06: atomic first-plan je sada prenet; ostaju stvarni novi provider turn, UNKNOWN/prekidi, izmerena brzina/trošak i odgovarajuće produkcione kvote.

R07: satnica kroz writer/hash/reviziju/izbor/Dogovor/izmene/export, više mesta, konkurencija i oporavak.

R08: multi-service/mode, prvo/kasnije čuvanje, namerno uklanjanje, stvarni matching i availableNow/TTL prema važećoj odluci.

R09: stvarne poruke, foto/glas, push i odredište, delimično čuvanje podešavanja i oporavak.

R10: potpuni izvoz uključujući workAreas i AI projekcije, retention, zatvaranje i brisanje kopija/medija/Auth podataka. Retention false i export/erasure NULL ne menjati u uspeh bez stvarnog zatvaranja ugovora. Ograničena nova export provera nije puna orkestracija.

R11: blind reviews kroz sve čitače/događaje, TEST/REAL izolacija i jedna reputacija naloga. Poslednji audit reprodukuje prerano uključivanje jedne ocene; kandidat nije deploy dokaz. Cleanup tek uz dokaz neaktivnog potrošača i kompatibilnu zamenu.

R12: puna saradnja dva naloga, uređaj/push, UX, potpisivanje/operativa/stores. Preview nije store kandidat.

Proveri novije commitove za isti ugovor pre nego što nalaz smatraš i dalje otvorenim. R/C/SV matricu ažuriraj u postojećem masteru, bez paralelnog backloga.

13. R01 BEZ PONAVLJANJA ISTOG KRUGA

Čitaj poslednje scrubbed diffs, capture, bootstrap pokušaje i tačnu granicu pada. 8 strict je upravljana platform metadata/role/owner oblast; 49 dopunskih extension owner/ACL, 3 managed-net. Ne menjaj naslepo vlasnike/prava cele baze ili checker da dobiješ zeleno.

Odvoji vernost testne platforme, naš ACL/source ugovor i stvarni Auth/HTTP prihvat. Novi pokušaj zahteva novu hipotezu ili relevantnu izmenu. Bez toga ne ponavljaj isti skupi bootstrap.

R01 ne blokira sve source poslove i svaku usku DEV operaciju: poslednje tri su već prenete uz svoje provere. To nije dozvola da javni korisnici preskoče privatnost ili da ukloniš TEST/REAL granice. Platform dokaz ne izmišljaj ako ga nemaš; nastavi nezavisnu važnu celinu.

14. UX I ČIŠĆENJE

Poštuj Product master: ivory/narandžasta/forest, bele premium kartice, postojeći logo i ikonice, slogan „USKOČI — Vaš partner za svaki zadatak.” Četiri taba: Početna, Zadaci, Dogovori, Poruke. Profil preko avatara.

Vi/Vam/Vas dosledno u UI, Edge fallback-u i serverskim porukama; korisnikov originalni tekst ne prepravljati. Kartice razgovora/pregleda/liste/mape/detalja prikazuju iste činjenice i cenu/jedinicu/lokacijsko značenje. Dogovori prate važeći ugovor vremenske liste/prethodnih saradnji, ne stari izgled samo zato što screenshot postoji.

Za pogođeni ekran proveri normalno/loading/prazno/grešku/retry/povratak/tastaturu/mali ekran/veći font gde relevantno. Bez uređaja označi native/visual prihvat otvorenim; čitanje JSX-a nije pregled ekrana.

Veliki fajl nije sam po sebi kvar. Ukloni dokazano dupliran ili mrtav servis/adapter/flag uz očuvane potrošače. Ne briši migracije, dokazne arhive, lifecycle kopije ili negativne bezbednosne testove radi manjeg repoa. Čuvaj postojeće TaskRecord vlasnike i command journal gde rešavaju stvaran problem.

15. ŠTA ODMAH RADIŠ SAMO PREKO GITHUBA

Uporedi najnoviji master/receipt sa granom. Daj kratak presek novih razlika, zatim izaberi prvi nezavršen posao koji možeš stvarno završiti.

Ako nemaš DEV/emulator, nastavi povezanu source celinu sa jasnim postojećim kvarom/dokazom: R01 privatnosna kompatibilnost, R07 HOURLY writer lanac, R11b blind-review čitači ili R05 kandidat prema aktuelnom prioritetu mastera. Ne čekaj uređaj za sve. Ne radi četiri nepovezane promene naslepo; zatvori jednu celinu i nastavi sledeću.

Server kandidat poredi sa sačuvanim preimage/dependencies. Bez nove baze označi fresh capture/preflight/deploy otvorenim. Ne izmišljaj novi hash. UI/copy izmene mogu nezavisno kada ne menjaju poslovni ugovor.

16. PROVERE BEZ NEPOTREBNOG USPORAVANJA

Primeni §8.1a: mala izmena — reprodukcija i komšijska regresija; povezana celina — ceo promenjeni lanac i potrebna tipna/SQL provera; milestone/promocija — puni odgovarajući CI. Ne vrti 14.588 testova posle svake rečenice.

Test ne sme samo potvrditi sadašnji kvar. Mora razlikovati pogrešno od ugovorenog ponašanja. Čuvaj vlasništvo, TEST/REAL, cenu, reviziju, UNKNOWN i idempotentnost. Zastareli test uklonjenog drugog modela zameni dokazom važećeg ugovora, ne brisanjem zaštite.

Sa terminalom koristi postojeće scripts/CI komande. Samo sa Actions proveri workflow i stvarni rezultat tačnog SHA. Bez mogućnosti izvršavanja napiši „nije izvršeno”. Ne koristi skip-ci na runtime kodu. Poveži razumne zahvate pre push-a umesto gomilanja nepotrebnih CI ciklusa.

17. DEV PRENOS I ROLLBACK

Ne primenjuj ceo candidates/ folder ili LOCAL_ONLY SQL direktno. Koristi izvedeni paket sa tačnim preimage, owner/ACL/RLS, kompatibilnošću, preflight/postflight i rollback/forward-repair granicom.

Kod novog single-pass paketa inverse rollback nije dozvoljen naslepo posle stvarnih catalog-resolution/TURN_CATALOG_V1 upisa. Pročitaj guardove i redosled povratka kompatibilnih Edge verzija. Posle stvarne upotrebe može biti potreban forward repair. Ne briši korisničke podatke da rollback prođe.

GitHub-only čet može pripremiti/revidirati paket; ne može potvrditi živu primenu bez pristupa. Budući izvršilac proverava tadašnju bazu i odobreni tačan paket. Produkcija i prodavnice ostaju zasebno kontrolisane.

18. STVARNA PROBA KOJA JOŠ NEDOSTAJE

Vlasnik ima dva testna naloga, jedan Android telefon i ranije otvoren emulator. Nemaš njihove sesije/lozinke. Minimalno: B aktivira profil sa više usluga; A kroz AI objavi zadatak; readback potvrdi ID/mode/cenu/termin; B dobije priliku i prijavi se; A izabere B; nastane Dogovor; razmena teksta i relevantnih medija; završetak; obe ocene; provera trenutka objavljivanja i reputacije.

Kritične varijante: offline/restart/lost ACK, promena naloga, stale revizija, otkazivanje, udaljena sačuvana oblast i REMOTE. Dodavanje usluge iz prijave mora očuvati isti task category ID i stare sposobnosti. Push mora stići na odgovarajući uređaj i tap otvoriti pravilan ekran.

Ranije je odobreno do 1 EUR za ograničenu modelsku probu; potrošnja je postojala. To nije novih 1 EUR po četu. Proveriti preostali odobren budžet pre novog plaćenog poziva. Bez modelskog pristupa nema nove tvrdnje o brzini/ceni/razumevanju.

19. PRODUKCIJA, SRBIJA I PRODAVNICE

DEV se ne pretvara u produkciju gašenjem svih zaštita. Potrebna je odobrena production konfiguracija/migraciona odluka, Auth/domen/mejl, backup/oporavak, nadzor troška/grešaka, podrška, uslovi/privatnost/brisanje i poslovna monetizacija prema važećim zahtevima Srbije.

Vlasnik ima Google Play Console; prema poslednjoj izjavi nema Apple Developer nalog. Android zahteva potpisani AAB, listing, Data Safety, App Access, testne pristupe i native/push dozvole. iOS traži zaseban build/signing/test i Apple nalog. APK nije iOS izdanje.

Pravne i store zahteve proveri na aktuelnim zvaničnim izvorima kada radiš taj deo. Ako nemaš web, to označi neproverenim. Tehnički PASS nije pravno odobrenje.

20. EVIDENCIJA I IZVEŠTAJ VLASNIKU

Jedan kratak checkpoint u isti CODEX master kada se stanje promeni. Detaljan dokaz u odgovarajući postojeći paket. Ovaj continuation nije drugi master.

Navedi kvar, promenjene fajlove, SHA, izvršene provere/rezultat, source/CI granicu, datirani DEV dokaz i stvarni native obuhvat. DONE tek kada je odgovarajući ugovor zatvoren. Jedna funkcija nije ceo R paket.

Objasni jednostavno: šta si popravio, šta poslao na GitHub, šta je na serveru prema dokazu određenog datuma i šta ostaje za telefon. Bez procenata iz utiska, izmišljenih deploy-a i ponavljanja kilometarske istorije.

Počni odmah proverom radne grane i navedenih izvora. Posle kratkog preseka izvrši prvu važnu dostupnu povezanu popravku. Nastavi dok postoji bezbedan konkretan napredak u okviru tvojih alata.
```

## Istorijski prenos 28–30.10.2026. — sačuvan radi porekla dokaza

Sledeći tekst je istorijski. Stari početni prioriteti, Dual pretpostavke i oznake neprimenjenih paketa nemaju prednost nad novijim dokazom za isti ugovor. Stare restore komande zahtevaju terminal i nisu izvršene samim čitanjem ovog dokumenta.

Ovo je ulaz za nastavak, ne novi plan. Jedini operativni plan ostaje [CODEX_PLAN_RADA.md](../plan/CODEX_PLAN_RADA.md), posebno §11.2a i dnevnik `ledger-20261028`. Ovaj presek je napravljen 28.10.2026. Posle novih promena prednost ima noviji provereni zapis u tom planu.


### Tadašnja ulazna tačka — istorijski presek (30.10.2026)

**Istorijski odeljak: današnji početni checkpoint i komanda su u ulazu od 03.11.2026. iznad.** Nema novog mastera. Jedini izvršni dokument je [CODEX_PLAN_RADA.md](../plan/CODEX_PLAN_RADA.md) (§11.2a, §4.2–4.3, §12.5 i novo **§12.6**). Konačan Product/UX autoritet 29.10.2026, prvobitno prenet bajt-identično 29.10, a zatim usklađen sa vlasničkom odlukom 31.10. (jedna zajednička reputacija): [docs/product/USKOCI_PRODUCT_UX_MASTER.md](../product/USKOCI_PRODUCT_UX_MASTER.md), aktuelni Git blob `57340372e8d14036b0e1a5dffe2d6dd29ee74fd1` (istorijski originalni Git blob `1a487caca16d3354f79d0db7c76526893df6e5d7`). U njemu su kanonski odeljci A–J/S01–S18; istorijske sekcije ispod „ISTORIJSKA EVIDENCIJA” nisu konkurentski zahtevi. To je PRODUCT master, a ne paralelni Codex EXECUTION master.

**Proverena početna CI istina PRE ovog dokumentacionog sređivanja:** source `472de27afcdffe86f9da3ad351cb3ff0e113367a`, [Full 41130520059](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41130520059) **FAIL** (10 R06 SQL syntactic + 29 media harness/fixture slučajeva unutar AI/Edge faze); [R01 41130520128](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41130520128) **FAIL** (8 strict, 49 owner/ACL, 3 native helper razlike). Dokumentacioni commitovi nisu kodna popravka i noviji CI se mora pogledati pre tvrdnje da je gate zatvoren.

**Naredni kontrolisani koraci za Codex:**
1. Učitaj **radnu** `work/rev14-review-f17` (ne GitHub default i ne target `feature/uskoci-cisto`), proveri remote HEAD, lokalno stablo, PR #43 i poslednji završen run baš na relevantnom code SHA. Ne resetuj tuđi kod.
2. Pročitaj **jednom** postojeći CODEX master §11.2a + §12.6 + §4.2–4.3, zatim konkretan R/C/SV zadatak. Kada je korisnički UI ili proizvodna logika pogođena, otvori samo odgovarajući S01–S18 deo Product mastera i njegov E/J acceptance; ne čitaj sve istorijske revizije ponovo.
3. U Bridge-u su 208 **istorijskih pokazivača**, ne 208 otvorenih grešaka; 77 puni screen contracts, 44 dodatna nalaza, 13 mikrotokova mapirani su u §12.6. Obnovi i proveri paket jednom; za jedan R posao koristi `kontekst.py` i `drift.py` na tačnim source putanjama.
4. **Prvi tehnički prioritet:** tačna R06 SQL/PGlite sintaksa i medijski testni harness koji se promenio zajedno sa `mediaUploadAdmission.mjs`, bez slabljenja testova. Izvrši fokusirane, zatim puni Full CI. Nastavi nezavisno R01 realan Auth/PostgREST/PG17 i ostale R02–R12 prema §4.2. Ne ponavljaj isti FAIL bez nove hipoteze.
5. Za svaku izmenu zapiši samo u **isti §11.2a**: R/C/SV ID, PRODUCT pravilo, current reader/writer putanju i SHA, dokaz iz Bridge-a, test (pozitivan/negativan), relevantan CI run i DEV/NATIVE readback, pre/posle status i sledeći posao.
6. R01 striktni paritet, R10 data erasure/export, stare klijentske kompatibilnosti i R12 dva Android naloga/uređaja ostaju stvarne RELEASE kapije. Ne raditi SQL/Edge DEV apply, billing aktivaciju, produkciju ili merge automatski samo zato što dokumentacija sada ima ujedinjen redosled.

**Završetak dokumentacionog dela ≠ završetak aplikacije.** Već odlučena pravila (4 root taba bez Profila, max 6 fotografija/1–3 preporuka, bez obaveznog grada na SIGNUP, **jedna zajednička reputacija naloga**, domenska istorija umesto `/arhiva` full ekrana) su navedena u §12.6; ne zahtevaju ponovno pitanje vlasniku, ali zahtevaju stvarnu implementaciju, kompatibilnost i dokaz tamo gde code još odstupa.

> **Obavezno pre nastavka:** ovaj dokument sadrži istorijski presek prenosa od 28.10.2026, a grana je potom napredovala. Brojevi, statusi i „prvi sledeći korak” u kopiranoj komandi ispod nisu zamena za novije zapise glavnog plana. Prvo osveži radnu granu bez gubitka lokalnih izmena, pročitaj najnovije dopune izvršnog dnevnika i proveri rezultat tamo navedenog CI-a. Konkretan naredni zadatak uzmi iz najnovijeg relevantnog zapisa, ne iz istorijske tačke 6 ovog uputstva.
>
> **Bez ponavljanja analize u krug:** sačuvani nalazi, izvorni registri, odluke i završene provere su početna osnova. Za izabrani zadatak pročitaj njegov postojeći izvršni zapis, povezani izvor i uslov prihvatanja. Ponovo proveravaj samo promenjeni kod/okruženje, nedostajući dokaz ili novu regresiju; navedi razlog. Posle provere pređi na implementaciju ili precizno zabeleži blokadu i nastavi nezavisan posao. Opšti ponovni audit svih ZIP-ova nije preduslov svake izmene.

## Dopuna 30.10.2026 — proširena izvorna forenzika, u istom masteru

**Noviji dokazni most je sada na GitHub-u:** [source-bridge-20261030/README.md](source-bridge-20261030/README.md). To nije drugi plan niti nova aplikaciona implementacija. Povezuje 208 istorijskih nalaza/ugovora sa postojećim R/C/SV zadacima, uključujući dodatne funkcionalne REV13/REV14 tekstove koji nisu bili u starom paketu od 305 članova. Izvorni veliki REV14 FULL sa slikama i PDF-ovima nije dodat kao duplirana binarna arhiva; njegove 908 putanje ostaju u inventaru.

Posle uobičajenog `git clone`/osvežavanja grane, **jednom** proveri i obnovi ovaj dopunski tekstualni skup kada radiš konkretne R/C/SV popravke:

```sh
python docs/continuation/source-bridge-20261030/assemble.py
python docs/continuation/source-bridge-20261030/assemble.py --restore ../USKOCI_ANALIZE
python ../USKOCI_ANALIZE/USKOCI_CODEX_BRIDGE_2026-10-30/alati/proveri.py
python ../USKOCI_ANALIZE/USKOCI_CODEX_BRIDGE_2026-10-30/alati/kontekst.py R06 --repo .
```

Na Windowsu `py -3` može umesto `python`. Provera ne menja GitHub, kod aplikacije, Supabase, tajne ni produkciju. Pri svakoj popravci otvaraj samo vezane dokaze, uporedi stari SHA sa stvarnim današnjim kodom i po postojećem §11.2a razdvoji SOURCE, CI, DEV i NATIVE. **Ranija rečenica „REV13 nije dostavljen“ u istorijskom prenosu od 28.10. odnosi se na tadašnju sesiju**, ne na sada raspoloživi prošireni tekstualni most. Ne primenjivati stara vizuelna/cenovna pravila ili brisanja bez novije korisničke odluke i negativnog testa.

## Preuzimanje bez starog računara

Potreban je Git, Python 3.9+ i, za razvoj aplikacije, Node/npm prema repozitorijumu i CI. Za lokalnu bazu potrebna je odgovarajuća Docker okolina; postojeći Windows računar je nema, zato se izolovane serverske provere izvršavaju na GitHub Ubuntu runneru.

U novom praznom radnom folderu izvrši:

```sh
git clone --branch work/rev14-review-f17 --single-branch https://github.com/uskocibusiness-boop/USKOCI-EAN.git uskoci-implementation
cd uskoci-implementation
python docs/continuation/restore.py
python docs/continuation/restore.py --restore ..
git status --short
git log -1 --oneline
npm ci
```

Na Windowsu se umesto `python` može koristiti `py -3`. Na sistemima koji imaju samo `python3`, koristi njega. U postojećem checkoutu prvo pregledaj radno stablo i remote; ne koristi reset/clean i ne prepisuj tuđi rad. Ne kloniraj podrazumevanu GitHub granu umesto navedene radne grane.

Prva Python komanda proverava SHA-256 i veličinu tri arhive i svih 305 unutrašnjih fajlova. Druga obnavlja dokaze pored repozitorijuma. Ne prepisuje različite postojeće fajlove. Ako nađe konflikt, koristi nov prazan radni folder. Ne izvršava SQL, ne povezuje Supabase i ne menja bazu.

`payload/` sadrži oba originalna ZIP-a, neizmenjena, i dodatni paket izvršnih dokaza. [MANIFEST.json](MANIFEST.json) beleži svaki fajl, veličinu, kontrolni otisak, mapiranje i izuzetke. Nakon obnove raspored je:

```text
radni-folder/
  uskoci-implementation/       # Git checkout i aktuelni plan
  review-inputs/
    USKOCI_KOMPLETAN_PLAN_I_DOKAZI_REV10_2026-10-27/
    USKOCI_UX_PRODUCT_MASTER_REV14_2026-10-27/
  evidence/                   # početni read-only i izvršni dokazi
  managed-artifacts/artifacts/ # r01, r07, cleanup i istorija pokušaja
  verification-output/        # izveštaji, logovi i manifesti izvoza
  cleanup-*.json              # lokalne potvrde čišćenja
```

Istorijske apsolutne putanje `C:/Users/user/.codex/state/plugins/codex-security/scans/uskoci-implementation/artifacts-9be0429af3e45ad335d49b22a24513c3767a2f932bfda75c32443ddc86be2941/` zameni pri navigaciji korenom `../managed-artifacts/`. Ne menjaj izvorne dokaze da bi promenio putanje: njihovi bajtovi i hash-evi ostaju istorijski dokaz. Sačuvane `dokazi/...` veze u REV10 otvaraj iz njegovog obnovljenog originalnog foldera; GitHub pregled aktuelnog plana ih ne raspakuje automatski.

Nisu uključeni node_modules, keševi, sesije/pristupni ključevi, generisani Hermes paketi i kopije njihovih asseta. Njihovi izveštaji, source manifesti i hash-evi jesu. Ovo omogućava nastavak razvoja i pregled dokaza, ali ne predstavlja arhivu instalacionog izdanja. Originalni REV13 nije bio dostavljen. Ne tvrdi da ga imaš. Lokalni node_modules je bio junction ka drugom folderu; novi rad mora koristiti `npm ci`.

GitHub repozitorijum je javan. Pre objave paketa urađene su provere obrazaca ključeva, JWT-a i lozinki u URL-ovima i pregled mogućih credential assignment zapisa. Nisu nađeni živi pristupni podaci; ovo nije apsolutna garancija. Nalozi, Supabase secrets, Apple/Google/Firebase/EAS pristup povezuju se kroz odgovarajuće integracije. Ne traži od korisnika da lepi ključeve u čet.

## Istorijska Codex komanda od 28.10.2026. — za novi čet koristiti komandu od 03.11. iznad

```text
Nastavi rad na USKOČI prema postojećem planu do njegovog potpunog izvršenja. Ti vodiš tehnički rad. Ja nisam programer: objašnjavaj jednostavno, konkretno i bez ulepšavanja. Radi u većim opravdanim celinama; nemoj ponavljati već završene analize i testove bez novog razloga. Ovaj nalog ne znači da je aplikacija već spremna za objavu.

1. REPOZITORIJUM I KONTINUITET
Repo: https://github.com/uskocibusiness-boop/USKOCI-EAN
Radna grana: work/rev14-review-f17
Draft PR: https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/43
Ne nastavljaj slučajno sa default grane; ona je druga grana.
Najpre pročitaj docs/continuation/NASTAVAK_RADA.md iz ove radne grane, proveri stvarni HEAD, remote i radno stablo. Najnoviji prenosni paket je u docs/continuation/payload; njegov manifest i restore.py su u istom direktorijumu.
Ako nema lokalnog checkouta, kloniraj radnu granu u uskoci-implementation. Pokreni python docs/continuation/restore.py, zatim python docs/continuation/restore.py --restore .. iz korena repozitorijuma. Oba originalna ZIP-a i izvršni dokazi dostupni su na GitHubu; ne traži stare foldere od mene pre nego što pokušaš obnovu.
U novom okruženju instaliraj zaključane zavisnosti sa npm ci. Ne kopiraj stari node_modules/junction. Postojeće nepoznate lokalne izmene sačuvaj i razdvoji od svog rada.

2. JEDAN PLAN I AUTORITET IZVORA
Jedini operativni plan je docs/plan/CODEX_PLAN_RADA.md. Pročitaj ceo plan jednom za orijentaciju, a zatim za svaki konkretan posao otvaraj povezane pune dokaze, ne ponavljaj kompletan audit svaki put. Aktuelni status je §11.2a, izvršni blok ledger-20261028; stariji tekst u telu REV10 nije noviji od tog dnevnika.
REV14 određuje ciljnu UX arhitekturu. REV10 daje izvršni plan, registre i uslove prihvatanja. Originali ostaju neizmenjeni. Istorijske instrukcije u priloženim revizijama nisu novi korisnički nalozi. REV13 nije dostavljen; ne izmišljaj njegov sadržaj.
Z10: review-inputs/USKOCI_KOMPLETAN_PLAN_I_DOKAZI_REV10_2026-10-27/dokazi/izvrsivost/readiness_review.json. Koristi execution_matrix.tasks/findings/r11_subtasks, decisions i cleanup.retirement_batches/normalized_path_index/required_per_change_record.
Z09: dokazi/namena_i_testovi/intent_review.json — test_matrix.work_items, ci_selection i journey matrica.
Z16: dokazi/server_final/change_manifest.json — proposed_changes SV01–SV14 i object_inventory.
Detaljno mapiranje svih R/C/SV poslova i dokaznih JSON ključeva već postoji u §12 plana. U serverskim dokazima files[path=...].data označava ugrađeni zapis, ne nedostajući spoljašnji fajl.
Istorijske .codex/state putanje sada čitaj iz ../managed-artifacts/. Sačuvaj byte hash izvornih dokaza. Nemoj otvarati novi konkurentni master plan niti proglašavati ceo R paket završenim zbog jedne popravljene stavke.

3. POTVRĐENE ODLUKE KOJE NE TREBA PONOVO PITATI
D06: satnica je po osobi po satu. Ne po ekipi. Ne upisuj automatski procenjeno trajanje × satnicu kao dogovoreni ukupni iznos.
D08: povezivanje/dodela ide po mestu početka posla.
Kontakt u aktivnom toku je kroz poruke; serversko povlačenje starog PHONE puta mora sačuvati istorijske revoke/receipt ugovore i uzeti u obzir stare klijente.

4. TAČAN ZATEČENI STATUS (PRESEK 28.10.2026; PROVERI NOVIJI DNEVNIK)
Pre prenosa dokumenata HEAD je bio bba27e4f602dcdd274c0cb363ab76d4dee2abfb3.
Poslednji testirani izvršni izvor: b98ef389fe65bd19ffa047edbb82c4ff0c1aee5a. GitHub PR merge checkout testiran u CI: 552984f47ba514f1d3f2408b0e2945d607176f86. Prenos dokaza sam po sebi ne menja aplikaciju ili bazu.
R01/R02/R07/R11/R12 su IN_PROGRESS; ostalih sedam R grupa DEFINED. Nijedan kompletan R paket nije isporučen. Source promene postoje za 11/19 cleanup paketa: C01–C09, C12 i C18. Otvoreni su C10/C11/C13/C14/C15/C16/C17/C19. SV01–SV14 ostaju otvoreni. Procenat dovršenosti ne izvodi iz broja fajlova ili testova.
Već obrađeno: F17 bezbedan prikaz read greške; R02/SB11 PLACES continuation/recent retry/fit invalidation; F16 odvojeni PAGE/MAP retry i izbor; F11 readback posle izgubljene abandon potvrde; F13 account/profile-bound CAS sa zamrznutom namerom i unknown ishodom; R07a povlačenje cene/valute; R07b satnica kroz klijent, Edge i čuvani SQL kandidat. Širi acceptance ostaje otvoren.
R07b: postojeći TOTAL/PER_PERSON zadržava agregatno značenje; HOURLY je person-hour. Jedinica ugovora je TOTAL|HOURLY, istorijski null price_basis ostaje TOTAL, nema backfilla. Receipts/request hashes se čuvaju; KEEP odbija promenjenu jedinicu, UPDATE zahteva potvrdu. Stari pending journal ne sme da napravi novu hourly nameru pod istom revizijom.
R01 kandidat rešava 38-column Need SELECT projekciju; izolovani SQL dokaz nije live Auth/PostgREST dokaz. Privatni SELECT u live okruženju ne smatraj zatvorenim.
Cleanup prve grupe: C01/C02/C05/C06/C18. Poslednja grupa: C03/C04/C07/C08/C09/C12. Evidencije su docs/cleanup/20261028-*.json. C09 ima 13 testova stvarnog SQL projekcionog i Edge puta umesto 12 sintetičkih testova; nije ceo Auth/Save/binder dokaz.

5. PROVERE KOJE SU VEĆ URAĐENE
Full CI https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40734402563 je PASS: 614 Jest suites, 14.115 testova, 3 snapshota; TypeScript/Deno, F13 SQL9, hourly SQL25, AI/taxonomy/C09, migration integrity i privacy/bootstrap provere.
Schema CI https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40734402209 je FAIL posle kompletnih dijagnostika: strict8, supplemental49, native hook3 polja. Servisi, stvarni CLI start, aplikacioni DDL, capture i cleanup prolaze. Nema application strict delti. Ne pretvaraj FAIL u PASS.
Android/iOS Expo export uspeo; receipt je ../verification-output/cleanup-second-20261028-165150/CLEANUP_SECOND_BUNDLE_RECEIPT.json. Ovo nisu native build, instalacija na uređaj, store submission ni OTA potvrda. U paketu su receipt/logovi/source manifesti; generisani bundle binarni fajlovi nisu preneti.
Stari neuspešni CI pokušaji i korekcije su zabeleženi. Ne ponavljaj rešene Go-only CLI, net-hook-absence i Glyph allowlist greške. Ne vrti isti skup dijagnostika bez konkretne nove hipoteze/izmene.

6. PRVI SLEDEĆI TEHNIČKI KORAK
Pročitaj supabase/proofs/privacy/runtime/README.md i r01-relevance.md, zatim najnoviji R01 zapis master plana. Nastavi usku native Postgres CREATE EXTENSION helper provenance/dependency proveru. Trenutno native telo odgovara pinned image migraciji; razlika literalne verzije 0.8 prema 0.8.0 odgovara DEV body hash-u, a config je native NULL naspram eksplicitnog praznog search_path u DEV. To je trag koji treba dokazati, ne dozvola za prepisivanje očekivanih hash-eva.
Zatim razreši povezane hosted-role dependency i effective admin search_path preduslove. Storage owner grant-option razlika i 49 extension-routine owner/ACL razlika zahtevaju usko dokazivanje relevantnosti. Efektivna booleanska jednakost nije blanket waiver.
Canonical bootstrap supabase/proofs/privacy/bootstrap/current-application.sql mora ostati SHA-256 1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f. Čuvaj sirove CRLF bajtove. Ne regeneriši bootstrap/fingerprints, ne prepravljaj managed owner/ACL i ne uklanjaj guard da bi CI pozelenio.
Stvarni TS/Bun CLI start već radi. Pinned CLI je 2.116.0, commit 997a1e69a4a83466964ed874d3a604c88a7b3866. Ne vraćaj Go-only put i ne pokušavaj ponovo plaćeno branching rešenje bez promenjenih uslova.
Tek nakon dokazanog runtime admission-a izvrši synthetic Auth + stvarni PostgREST/current-client prolaz: isti svet, tuđi svet, zatvoren objekat, anon, nevažeća/istekla sesija i ostale slučajeve iz plana. Precizno odvoji SQL proveru od stvarnog HTTP/Auth dokaza.

7. NASTAVAK OSTATKA PLANA I ČIŠĆENJA
Ako R01 zavisi od spoljne blokade, zabeleži tačan nedostajući dokaz i nastavi nezavisne R/C poslove po postojećim zavisnostima. Ne troši celu sesiju na ponavljanje istog neuspeha.
C10: aktivne/alternativne AI strategije zahtevaju odluku po potrošaču. C11 je vezan za SV08 i stare klijente. C13 traži ugovor javnog komentara. C14 obrađuje penzionisana pravila/oracle testove. C15 uklanja karakterizacije stvarno otklonjenih kvarova; već rešenu valutu/satnicu ne rešavaj ponovo. C16 katalogizuje proof/candidate/frozen-generatore. C17 usklađuje test/build katalog. C19 obrađuje identične SQL/proof kopije uz očuvanje primenjene migracione istorije.
Pre svakog čišćenja otvori puni retirement_batches zapis: targets, remove_or_rebind_sr, preserve_sr, before_edit_sr, acceptance_sr, pa relevantne normalized_path_index zapise. Odsustvo literalnog poziva nije samo po sebi dokaz da smeš obrisati server/compatibility put. Vodi required_per_change_record i ažuriraj isti plan.
Nastavi preostale R03–R10 funkcionalne grupe, UI/UX J01–J14 i A01–A25 acceptance, R11/R12 i SV01–SV14 prema stvarnim zavisnostima. Ne preskači vizuelni rad, uređaje, bootstrap/upgrade, operativu ili prodavnice zato što unit testovi prolaze.

8. SUPABASE, DEPLOY I GRANICE DOKAZA
Projekat Supabase je leqcwgzvjsxugfgzdmth. Za rad koristi povezani nalog i obavezne relevantne skill instrukcije. Prvo potvrdi ciljno okruženje i stanje. Pristupni podaci nisu deo prenosnog paketa.
GitHub grana i PR nisu isto što i produkcija. R01/R07 SQL kandidati nisu primenjeni na live bazu. Ovaj prenos nije deployment.
Stari Discovery odbija HOURLY stranice, stari Agreement može pogrešno prikazati jedinicu. Schema i dokazani upgrade starih klijenata moraju prethoditi aktivaciji satnice. Ne puštaj samo Edge kao prečicu. LOCAL_ONLY guard u kandidatu nije live rollout plan. Kandidat se promoviše kroz novu migraciju tek uz traženi dokaz i rollout/rollback plan; ne briši istorijske migracije.
Ne traži ponovnu saglasnost za obične već odobrene izmene/provere. Ako je za konkretan neodobren nepovratan korak potrebna odluka, najpre pripremi konkretan pregledljiv rezultat i jasno objasni šta nedostaje. Ne objavljuj tajne ili privatne podatke na javni GitHub.

9. NAČIN RADA I IZVEŠTAVANJE
Pre izmene utvrdi vlasnika i acceptance. Uradi povezanu celinu, izvrši odgovarajuće provere, zapiši rezultat i ograničenje, commit/push u odgovarajuću radnu granu i ažuriraj postojeći PR kada je opravdano. Ne prepisuj granu silom. Proveri da remote zaista sadrži commit.
Posle svake celine ažuriraj docs/plan/CODEX_PLAN_RADA.md u postojećem izvršnom dnevniku: šta je promenjeno, R/F/C/SV oznake, commit, tačne provere/rezultati, preostali rizici i jedan sledeći korak. Vodi razliku: definisano, implementirano, provereno lokalno/CI, provereno sa Auth/na uređaju, objavljeno. Ne stavljaj DONE na osnovu predloga ili izolovanog testa.
Javljaj mi kratko tokom rada i na kraju jednostavno: šta sada radi bolje, šta je dokazano, šta još ne radi/nije provereno, šta sledeće radiš. Nemoj tražiti da ponovo objašnjavam ovaj projekat i potvrđene odluke. Počni stvarni rad posle obnove i ciljane provere stanja, ne završi samo pisanjem novog plana.
```
