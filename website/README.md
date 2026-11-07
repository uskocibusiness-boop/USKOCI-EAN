# USKOČI — zvanični sajt, kandidat za objavu (7.11.2026)

**Status:** kompletan izvorni sadržaj i interna provera veza; još NIJE objavljeno na produkcionom domenu.

## Sadržaj

15 HTML stranica: Početna, Kako radi, Aplikacija, Dokumentacija, Privatnost, Uslovi, Brisanje naloga, Prava i izbori, Bezbednost podataka, Bezbednost zajednice, Reklamacije, Podrška, Operater, Kolačići i 404.

Web kod: statički HTML + CSS + lokalni SVG, bez analitičkih skripti, reklamnih piksela ili tajnih API ključeva. Mobilni prikaz i pristupačna navigacija. Clean URL putanje. Pre objave je aktivan `noindex` i `Disallow: /` da nepotpuna pravna verzija ne bude indeksirana.

## Autoritet dokumenata

Izvedeno iz USKOCI_LEGAL_RELEASE_CANDIDATE_MASTER_RC2_2026-08-18.docx i USKOCI_LEGAL_RC2_OWNER_RECONCILED_2026-09-10, uz novije odluke vlasnika: Srbija, 18+, jedan nalog/dve mogućnosti, besplatna prva faza, tačna adresa tek posle Dogovora, satnica po osobi po satu, bez platformskog čuvanja novca, bez zapošljavanja u smenama.

## P0 pre legal/public launch-a

1. Konačno utvrditi i objaviti podatke operatera u onom obimu koji propisuje primenljivo srpsko pravo. Ne izmišljati PIB, firmu ili adresu, ne otkrivati kućnu adresu bez odluke vlasnika i pravne provere.
2. Potvrditi da uskoci.support@gmail.com može PRIMATI i OBRAĐIVATI stvarne zahteve, s tragom postupanja. Na sajtu je pošten mailto zahtev; nije automatsko brisanje.
3. Fizički ispitati backend brisanje naloga + dati javni tok bez aplikacije i tok iz aplikacije, uklanjanje podataka, legal-hold, evidenciju i potvrdu izvršenja. Postojanje interne Edge funkcije account-closure-worker nije dokaz da javni tok funkcioniše.
4. Uskladiti sve navode sa stvarnim produkcionim AI, lokacijskim i push procesorima, DPA ugovorima, retention politikom i pravilima AI treniranja. Proveriti server prema objavljenim rokovima.
5. Proveriti politiku u odnosu na instalacioni paket Google Play: dozvole, fotografije, mikrofon, lokacija, push SDK, tip podataka i prenos. Popuniti Data safety u Play Console, deklarisati https://uskoci.rs/privacy i https://uskoci.rs/delete-account.
6. Pravni pregled Terms/Privacy/Safety/Complaints uključujući operatora, potrošačka prava i konkretne procesore.
7. Pre cutover-a: skinuti noindex iz HTML, prebaciti robots.txt na Allow, proveriti ispravnost svih ruta na pravom HTTPS javnom domenu, e-poštu, responsive mobilni test, preusmerenja i Play Console review.
8. Zadržati razliku: Vercel PRODUCTION projekt `uskoci-web` (uskoci.rs) i Vercel PREVIEW projekt `uskoci-preview-20261009`. PR ne menja produkcioni domen ili mobilni runtime sam po sebi.

## Povezane putanje

- https://uskoci.rs/privacy
- https://uskoci.rs/terms
- https://uskoci.rs/delete-account
- https://uskoci.rs/data-safety
- https://uskoci.rs/support

URL-ovi gore su KONAČNA namera za objavu; ne tvrditi da živa verzija postoji dok se Vercel production ne potvrdi.

## Rezultati kontrole izvora

7.11.2026: provereno 20 fajlova, 15 HTML stranica i sve lokalne `href`/`src` reference; 0 prekinutih internih ruta; prisutna tabela rokova čuvanja i mailto brisanje; nema tajnih ključeva po testiranim obrascima. Vercel pokušaj kreiranja preview deploy-a odbijen je sa 403 (nema prava za Preview Deployment). Nije rađen produkcioni deploy.
