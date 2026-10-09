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

**N02 ostaje otvoren / release blocker za registraciju stvarnih korisnika.** Novi izgled nije aktivan. Povratak na kanonskom serveru još nije omogućen. Nema novog email slanja, realnog tap-a iz sandučeta, nove native instalacije ovog email patch-a, promene DNS-a, SMTP-a, naloga ili ključeva. Instalirani600efd10 je prethodni media paket i ne sadrži ove nove callback poruke. Puna CI regresija novog izvora tek sledi.

Podrazumevani Supabase email servis ograničen je na članove tima i nije namenjen produkciji. Samo otključavanje dizajna preko plaćenog plana ne dokazuje javnu email dostavu. Globalni SiteURL i ponašanje na uređaju bez instalirane aplikacije zahtevaju stvarno proverenu web destinaciju; nije izmišljena nova adresa.

## SLEDEĆE

Owner prijava za tačan Auth config, postojeći ili posebno izabran SMTP servis sa verifikovanim pošiljaocem, snapshot/rollback njegovih konkretnih podešavanja, zatim bounded apply i readback. Jedna registracija odobrenog testnog naloga, stvarno slanje, resend, istek/iskorišćen link i tap→USKOČI→prijava na novom APK-u. Lozinku/ključ korisnik ne šalje u razgovor. Do tada kandidat ostaje lokalni izvor; NO-GO i pauzirana automatizacija ostaju.

Zvanični izvori: [template ograničenje, 03.06.2026](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier), [SMTP i ograničenja podrazumevanog pošiljaoca](https://supabase.com/docs/guides/auth/auth-smtp), [email verification šabloni](https://supabase.com/docs/guides/auth/auth-email-templates).
