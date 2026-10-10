# Potvrda emaila — 10.10.2026.

## URADIO

Pripremljen `supabase/templates/confirmation.html`: stvarni USKOČI znak, bela kartica, tamnozeleno dugme, srpska latinica i jedan verification link `{{ .ConfirmationURL }}`. Naslov kandidata: **Potvrdi email za USKOČI**. Nema zamene verification linka direktnim app linkom, izmišljenog roka važenja ili korisničkih podataka u slikama.

Signup povratak dobija bezbednu jednokratnu kategoriju: nastavak prijave, nevažeći/istekao link ili neupotrebljiv link. Tokeni se uklanjaju pre Router-a i ne ulaze u novi store, URL parametre, istoriju web navigacije ili poruke. Ovaj callback NE usvaja sesiju i ne tvrdi da je nalog potvrđen: obična prijava lozinkom ostaje autoritet. Recovery parser i njegov credential handoff nisu prepravljeni. Aktivan nalog ne menja se zbog tuđeg signup linka.

Postojeći Auth ekran pokazuje rezultat i ponovnu potvrdu uz validan email, bez zahteva da se opet unese lozinka samo radi resend-a. Ponovljeni isti link je novi događaj; poruka se vraća u vidljiv deo ekrana. Skriven Auth ekran čuva događaj do povratka fokusa. Aktivna Auth komanda zadržava svoj ishod; događaj se ne odlaže da joj naknadno resetuje formular. Tekst posle resend-a uslovan je jer provider može prihvatiti zahtev bez nove poruke za već potvrđen nalog.

## DOKAZAO

- 14 jedinstvenih suite-ova / 281 test PASS, bez skip/fail; TypeScript exit0. Receipt čuva hash svakog sirovog lokalnog rezultata i ne sabira ponovljene testove dvaput. Obuhvaćeni su realni Auth handleri, Router cold/warm put, recovery, session runtime, splash i UI ratchets.
- Read-only stručni pregled našao je tri konkretna problema: zastareo confirmationRequired, skriven rezultat pri warm povratku i prerano brisanje događaja dok je Auth prekriven. Sve tri ispravke imaju test; završni ograničeni pregled nema novog nalaza.
- Desktop HTML screenshot pregledan u Chrome-u; javni brand image stvarno učitan. DOM prikaza u okvirima390px i320px nema horizontalno prelivanje. Mobilni screenshot nije sačuvan zbog greške browser capture-a. Ovo nije Gmail/Outlook rendering dokaz.
- Stvarni canonical DEV preflight: potvrda emaila uključena, redirect allowlist **prazan**, SiteURL **http://localhost:3000**, custom SMTP **isključen**, podrazumevani engleski subject. Predloženi tačni redirect-i: `uskociapp://auth?form=login` i `uskociapp://oporavak`; bez wildcard-a.
- Pripremljen zaseban ograničeni CLI config i rollback na prethodni prazan allowlist. Diff je pokazao samo jedan declared update. Pokušaj primene odbijen je HTTP403 zbog prava trenutnog naloga; readback je i dalje pokazao prazan allowlist. Nema uspešne serverske promene.
- Dashboard pokazuje eksplicitno ograničenje custom template-a bez SMTP-a. Šablon nije slat drugim kanalom radi zaobilaženja tog uslova.

## NIJE DOKAZANO

**N02 ostaje otvoren / release blocker za registraciju stvarnih korisnika.** Novi izgled nije aktivan. Povratak na kanonskom serveru još nije omogućen. Nema novog email slanja, realnog tap-a iz sandučeta, nove native instalacije ovog email patch-a, promene DNS-a, SMTP-a, naloga ili ključeva. Instalirani600efd10 je prethodni media paket i ne sadrži ove nove callback poruke. Puna CI regresija novog izvora je prošla; stvarno slanje i telefon ostaju nepotvrđeni.

Podrazumevani Supabase email servis ograničen je na članove tima i nije namenjen produkciji. Samo otključavanje dizajna preko plaćenog plana ne dokazuje javnu email dostavu. Globalni SiteURL i ponašanje na uređaju bez instalirane aplikacije zahtevaju stvarno proverenu web destinaciju; nije izmišljena nova adresa.

## SLEDEĆE

Owner prijava za tačan Auth config, postojeći ili posebno izabran SMTP servis sa verifikovanim pošiljaocem, snapshot/rollback njegovih konkretnih podešavanja, zatim bounded apply i readback. Jedna registracija odobrenog testnog naloga, stvarno slanje, resend, istek/iskorišćen link i tap→USKOČI→prijava na novom APK-u. Lozinku/ključ korisnik ne šalje u razgovor. Do tada kandidat ostaje lokalni izvor; NO-GO i pauzirana automatizacija ostaju.

Zvanični izvori: [template ograničenje, 03.06.2026](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier), [SMTP i ograničenja podrazumevanog pošiljaoca](https://supabase.com/docs/guides/auth/auth-smtp), [email verification šabloni](https://supabase.com/docs/guides/auth/auth-email-templates).


## CI dopuna za7440be36

[OTA source proof38003407101](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38003407101) i P7 signup38003398451 SUCCESS:606suite/13627testa/6snapshots. P7 fokus4/117. Oba PRE-P4 run-a38003398618/38003398487 SUCCESS sa istom punom regresijom; migration/domain DB poslovi su preskočeni, ne predstavljaju novi serverski dokaz.

[EX07S03 run38003398495](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38003398495): offline159Python+22Jest PASS; isolated GoTrue/Mailpit HTTP14PASS/3OBSERVATION/0FAIL. Opažanja: resend zamenjuje raniji link, pet sličnih redirect-a odbijeno i vraćeno na SiteURL, recovery opoziva stari refresh dok recovery sesija ostaje upotrebljiva. Ovo nije live canonical SMTP/allowlist dokaz. x86_64 proofAPK buildSUCCESS. Dopuna po završetku: native-emulator job114069591595 FAILURE / HARNESS_BROKEN; prvobitni IN_PROGRESS više nije aktuelan.

CodeQL38003398209 izvršen SUCCESS zaJS/TS/Python/Actions, bezJava/Kotlin. Rezultati22JS/TS+3Python+0Actions: izvršena analiza nije tvrdnja da nema bezbednosnih nalaza.

## Native CI neuspeh i uska dijagnostička dorada

**Originalni7440 Android rezultat nije prošao:**6PASS/2OBSERVATION/3ERROR/5NOT_RUN (artifact11650736698; zbirni11651235280). Prelaz Prijava→Napravi nalog nije stigao do SIGNUP_FORM; prvi unos emaila nije prihvaćen. Zavisni resend/warm callback/other-account scenariji nisu izvršeni. Oporavak lozinke i kasnija prijava potvrđenog testnog naloga jesu prošli, ali ne zatvaraju ranije praznine. E01 je prvobitno prepoznao LOGIN_FORM, pa je greška kasnijeg E02 koraka pogrešno prepisala i njegov status. Sačuvani originalni rezultat se ne prepravlja u PASS.

Lokalno je instaliran tačan x86_64 CI APK (SHA256 `051c27afadedb9ab0905a9456cc52d44786075bc2f0e0aece91812bb06667cd5`, izvor7440be36) u zaseban paket `rs.uskoci.ex07s03proof`. Postojeći emulator USKOCI_V5_TEST/API36.1: isti stari driver uspešno je prešao na registraciju i uneo sintetički `probe@example.invalid` bez slanja; screenshot-i pregledani. CI koristi API35, pa ovo **nije reprodukcija istog okruženja ni dokaz uzroka**. Nema aplikacionog patch-a zasnovanog na nagađanju.

Dijagnostička dorada proverava izlazni kod input komandi, stvarni fokus nameravanog EditText polja pre brisanja/kucanja i snima samo katalog oznaku, geometriju, stanje fokusa i broj kandidata. Ne snima unose, lozinke, URL-ove, opise ili resource ID-jeve. Fokus neuspeh razlikuje od odbijenog unosa. E01 i E02 imaju odvojene faze; višedelni E06 i dalje propada ako padne njegov kasniji deo. Fokus ima tri pokušaja i polling budžet3s; pojedinačni ADB poziv može trajati duže, pa3s nije tvrd wall-clock limit.

**DOKAZAO za doradu:**164Python testova +22Jest routing testa PASS, bez preskočenih; lokalni novi focus guard takođe je uneo sintetički email i proverio readback. Negativni testovi dokazuju da bez fokusa ili uz fokus drugog polja nema ni brisanja ni teksta, odbijena input komanda vraća samo kod greške, odložen fokus se čeka i stvarni mismatch ostaje neuspeh. Nezavisan read-only pregled nema blokirajući nalaz. Jedan lokalni pokušaj testova je prvo pao zbog CRLF ui_labels.json; primenjeno je već postojeće eol=lf pravilo i cela164 grupa je zatim prošla. To nije serverski/provider test.

**NIJE DOKAZANO:** uzrok originalnog API35 pada, novi puni API35 signup/resend/other-account prolaz, live email ili povratak iz stvarnog sandučeta. **SLEDEĆE:** isti izolovani CI sa konkretnom dijagnostikom, zatim Owner/SMTP i jedno stvarno slanje po prethodnom planu. N02 ostaje otvoren; NO-GO i PAUSED ostaju.


## Naknadni tačan API35 rezultat — 10.10, 05:39UTC

Run38006112748, HEAD07bc81e0e78d697b5bfa926b781fca516fd7d235 sada je SUCCESS, nakon drugog pokušaja. Offline164Python +22Jest PASS. Provider14PASS/3OBSERVATION, nativeAPI35 x86_64 14PASS/2OBSERVATION; zbir28PASS/5OBSERVATION,0FAIL/ERROR/NOT_RUN. Izolovani proof paket rs.uskoci.ex07s03proof, APK SHA256090591f883aae343471767700b715aa3380c98ce623badf7a66e12a690ef07e9.

Prošli su signup/confirmation bez sesije, odbijanje login-a pre potvrde, resend/rate-limit, warm/cold callback, nevažeći/istekao/iskorišćen link, očuvanje drugog naloga, recovery/mismatch i promena samo odgovarajuće lozinke. Pregledani lokalni dokazi nisu sadržali callback tokene. Ovo zamenjuje raniji pending status novog API35 prolaza; originalni7440 HARNESS_BROKEN i nepoznat uzrok ostaju istorija.

Provenance: native artifact11661026624/job114141967144/attempt2; provider artifact11651362344/attempt1. Najnoviji aggregate11660563644 netačno nosi runAttempt1; stariji istoimeni11650738989 se ne koristi. Zato se ne tvrdi first-attempt fullPASS. Privatni native-report.json SHA256bcac38a8a62fe5854a9e7997b2b398b72516d1f822114f9aa2d85dae99067122. Evidence nije javno objavljen.

N02 ostaje otvoren: canonical SMTP/redirectallowlist, stvarno sanduče/emailklijent, fizički telefon/iOS još nisu dokazani. E12/P14 beleže retained recovery sesiju posle promene lozinke; ponovni link pokazuje isti nalog, drugi upis lozinke nije pokušavan. Nema live auth promene iz ovog dokaza.
