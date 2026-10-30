# Funkcionalni REV11–REV13 nalazi — svih 44, sa mapom i dokazom

Ove oznake MARKET:M01–M24 **nisu** A30-M01–M10 migracione grupe. Istorijski nalaz nije aktuelni bug dok nije reprodukovan.

| Nalaz | Sadržaj | Odgovarajući R/C | Trenutno potvrđeno iz koda |
|---|---|---|---|
| `MARKET:M01` | Obnova poslate prijave mora prethoditi proveri prava za novu prijavu | R07, R11d | Nije ciljano provereno na HEAD-u |
| `MARKET:M02` | Satnica se na prijavi i kandidatu pogrešno naziva ukupnom cenom | R07 | Nije ciljano provereno na HEAD-u |
| `MARKET:M03` | Nazad iz pregleda izmene Dogovora gubi neposlati unos | R11d, R09 | src/ui/agreements/AgreementActionsScreen.tsx |
| `MARKET:M04` | Privatno dugme Proveri trenutno ponavlja idempotentni writer | R09, R11c | src/ui/AgreementChat.tsx; src/data/agreementOutbox.ts |
| `MARKET:M05` | Iz osnovnog map prikaza nema stalno vidljive glavne navigacije | R02, R11a | Nije ciljano provereno na HEAD-u |
| `MARKET:M06` | Početni pregled prijave vodi na vlasnički zadatak i može propustiti aktivne prijave | R11a, R07 | Nije ciljano provereno na HEAD-u |
| `MARKET:M07` | Dogovori iz jednog sopstvenog zadatka gube kontekst zadatka | R03, R09 | Nije ciljano provereno na HEAD-u |
| `MARKET:M08` | Pregled promenjenih uslova pokazuje previše malo za odgovornu potvrdu | R07 | Nije ciljano provereno na HEAD-u |
| `MARKET:M09` | Nove date ocene mogu ostati nevidljive u postojećem hook-u | R11b | Nije ciljano provereno na HEAD-u |
| `MARKET:M10` | Telefon je ostao u izgovorenom hint-u messages-only ekrana | R09, C11 | Nije ciljano provereno na HEAD-u |
| `MARKET:M11` | REV11 pravi paralelnu mapu i gubi tekst pretrage | R02, C08 | Nije ciljano provereno na HEAD-u |
| `MARKET:M12` | Grupni prototip obećava privatne mogućnosti koje grupa nema | R09 | src/ui/groups/GroupConversationScreen.tsx |
| `MARKET:M13` | Poređenje cena treba pokazati i obim ljudi | R07 | Nije ciljano provereno na HEAD-u |
| `MARKET:M14` | Nova prijava u prototipu je skraćena ispod mogućnosti stvarnog composer-a | R07 | Nije ciljano provereno na HEAD-u |
| `MARKET:M15` | Predlog izmene u REV11 izostavlja cenu, obim i kraj termina | R07, R11d | Nije ciljano provereno na HEAD-u |
| `MARKET:M16` | Pet data scope-ova nije razlog za pet stalnih tabova Moji zadaci | R03 | Nije ciljano provereno na HEAD-u |
| `MARKET:M17` | Prototipski lifecycle meni ne sme zameniti kanonsku podobnost | R03, R11 | Nije ciljano provereno na HEAD-u |
| `MARKET:M18` | Javni Q&A prototip preskače obradu, materijalnu izmenu i autorizovan cilj | R11b, R09 | src/ui/qa/TaskQaScreen.tsx |
| `MARKET:M19` | Fleksibilan Dogovor u prototipu dobija izmišljen datum | R11e | Nije ciljano provereno na HEAD-u |
| `MARKET:M20` | Deljenje zadatka trenutno ne daje klikabilan javni link | R12, R11 | src/ui/v2/detail/taskShare.ts |
| `MARKET:M21` | Pomoć kada nema prijava je namerno isključena dok read ne daje činjenice | R03, R11a | Nije ciljano provereno na HEAD-u |
| `MARKET:M22` | Pouzdanost naručioca nema isti owner kao pouzdanost radnika | R11b | Nije ciljano provereno na HEAD-u |
| `MARKET:M23` | Globalni error/unknown wrapper nije dovoljan za stvarne delimične greške | R11f | Nije ciljano provereno na HEAD-u |
| `MARKET:M24` | Tihi privatni chat refresh je vizuelno skriven | R09 | Nije ciljano provereno na HEAD-u |
| `ACCOUNT:ACCOUNT01` | Osvežavanje editora može da ukloni poslednji potvrđen sadržaj | R11d | Nije ciljano provereno na HEAD-u |
| `ACCOUNT:ACCOUNT02` | Podešavanja obaveštenja ne čuvaju ekran samo zato što komentar kaže da ga čuvaju | R09 | src/ui/notifications/PushPreferences.tsx |
| `ACCOUNT:ACCOUNT03` | Lični opis i područje nisu obična polja istog writer-a kao ime | R08, R11d | src/app/(app)/profil/lozinka.tsx |
| `ACCOUNT:ACCOUNT04` | Izvoz mora imati sve stvarne faze | R10 | Nije ciljano provereno na HEAD-u |
| `ACCOUNT:ACCOUNT05` | Objašnjenje dozvole za mikrofon mora odgovarati načinu snimanja | R08, R11c | Nije ciljano provereno na HEAD-u |
| `ACCOUNT:ACCOUNT06` | Podrška zadržava kontekst i odvojene potvrde | R11d, R10 | src/data/supportCaseJournal.ts; src/ui/support/SupportNewScreen.tsx |
| `ACCOUNT:ACCOUNT07` | Jedan jezik aplikacije, uz očuvane istorijske potvrde | R11, R12 | Nije ciljano provereno na HEAD-u |
| `ACCOUNT:ACCOUNT08` | Status dostave, OS dozvola i korisnički izbor su različite činjenice | R09 | src/ui/notifications/PushPreferences.tsx |
| `ACCOUNT:ACCOUNT09` | Avatar ima upload, potvrdu i gubitak lokalne datoteke | R11c | Nije ciljano provereno na HEAD-u |
| `ACCOUNT:ACCOUNT10` | Zatvaranje naloga: početna sumnja u decoder nije potvrđen kvar | R10 | Nije ciljano provereno na HEAD-u |
| `CAL:CAL01` | Tri prikaza moraju stvarno menjati organizaciju vremena | R11e | Nije ciljano provereno na HEAD-u |
| `CAL:CAL02` | Dogovori bez termina moraju imati vidljiv put | R11e, R09 | Nije ciljano provereno na HEAD-u |
| `CAL:CAL03` | Dostupnost je poseban podatak od praznog rasporeda | R05, R11e | Nije ciljano provereno na HEAD-u |
| `CAL:CAL04` | Kalendar mora ostati čitljiv na uskom ekranu i velikom tekstu | R11e | Nije ciljano provereno na HEAD-u |
| `CAL:CAL05` | Arhiva nudi filter za stanje koje ne dobija | R11e, R03 | src/ui/calendar/archive.ts |
| `CAL:CAL06` | Sačuvati postojeće autoritete i civilno vreme | R11e | Nije ciljano provereno na HEAD-u |
| `UI:UI-CONTRACT-01` | Proveri ishod mora da koristi čitanje, a sadašnji privatni chat poziva retry writer | R09 | src/ui/AgreementChat.tsx; src/data/agreementOutbox.ts |
| `UI:UI-CONTRACT-02` | AI word-by-word reveal preko potvrđene poruke | R08 | Nije ciljano provereno na HEAD-u |
| `UI:UI-CONTRACT-03` | Trajnost pending komande nije ista u svim tokovima | R07, R09, R11d | Nije ciljano provereno na HEAD-u |
| `UI:UI-CONTRACT-04` | Novi izgled ne zatvara backend/release zavisnosti REV10 | R12 | Nije ciljano provereno na HEAD-u |
