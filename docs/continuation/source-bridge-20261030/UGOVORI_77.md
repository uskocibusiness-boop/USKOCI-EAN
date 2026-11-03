# Sedamdeset sedam starih ugovora i REV14 konsolidacija

ID-jevi su istovetni u obe mape. Ciljni S-ekran i spojeni tok mogu se razlikovati; poređenje nije dokaz da je zadržan svaki acceptance.

**Izvršni autoritet 30.10:** konačni [Product/UX master A–J/S01–S18](../../product/USKOCI_PRODUCT_UX_MASTER.md) nadređen je istorijskoj REV14 ciljnoj mapi, a [CODEX master `12.6](../../plan/CODEX_PLAN_RADA.md) vodi status i acceptance. Ovde se čuvaju sva 77 stara ID-ja; puni `dizajn/spec/screen_contracts.json` u Bridge arhivi ima detalje, a mapa iz ovog fajla sama po sebi ne dokazuje 77 implementiranih ekrana. Konkretna korekcija: `archive` nije novi root/full-screen cilj, već kompatibilni redirect uz domensku istoriju; sadašnji kod još nije ispravljen.


| ID | Stari ugovor | Stare R/SV veze | Novi cilj | Spojeno u |
|---|---|---|---|---|
| `launch` | Pokretanje i obnova | R11a, R12 | System/infrastructure state | None |
| `welcome` | Dobro došli | R11a, R12 | Full screen | None |
| `login` | Prijavi se | R01, R11, R12 | Full screen | None |
| `signup` | Napravi nalog | R01, R10, R11, R12 | Full screen | None |
| `authConfirm` | Potvrdi kontakt | R11, R12 | Full screen | None |
| `forgot` | Obnova pristupa | R11, R12 | Full screen | None |
| `recovery` | Nova lozinka | R11, R12 | Full screen | None |
| `restricted` | Nalog trenutno nije dostupan | R10, R11, R12 | Full screen | None |
| `home` | Početna | R11a, R12 | Full screen | None |
| `newTaskAI` | Opiši zadatak | J01, J02, J03, R04, R06, R08, R11c, R12 | Full screen | None |
| `aiMedia` | Fotografija ili glas u razgovoru | J01, J05, J13, R06, R11c, SB04, SB15, R12 | Composer capability + bottom sheet | newTaskAI / workerAI |
| `conversationPoint` | Potvrdi mesto u razgovoru | J03, J01, R02, R08, R11e, SB13, R12 | Inline prompt + full-screen map sheet | newTaskAI |
| `taskReview` | Pregledaj zadatak | J03, J04, J02, R04, R07, R08, R12 | Full screen | None |
| `reviewLocation` | Izmeni mesto u pregledu | J03, J02, R08, R11e, SB13, R12 | Full-screen map sheet | taskReview |
| `publicationState` | Zadatak je objavljen | J04, R08, R12 | Success state / receipt | taskReview → ownTask |
| `workerAI` | Opiši šta radite | J05, J07, J06, R04, R06, R08, R12 | Full screen | None |
| `workerReview` | Pregledaj ponudu | J06, J07, R04, R07, R08, R12 | Full screen | None |
| `discovery` | Zadaci | J09, J08, R02, R05, SB11, SB13, R12 | Full screen | None |
| `discoveryFilters` | Pretraga i filteri | J09, J08, R02, R05, R12 | Bottom sheet / full-height sheet | discovery |
| `taskDetail` | Detalji zadatka | J09, J10, J11, R01, F21, R07, R11, R12 | Full screen | None |
| `apply` | Nova prijava | J10, R07, F13, R11, R12 | Full screen | None |
| `applyReceipt` | Prijava je poslata | J10, J13, R07, R12 | Success state / receipt | apply → applicationDetail |
| `applications` | Moje prijave | J10, R03, R07, R11, R12 | Full screen | None |
| `applicationDetail` | Tvoja prijava | J10, J13, R07, R11, R12 | Full screen | None |
| `myNeeds` | Moji zadaci | J10, R03, R11, R12 | Full screen | None |
| `ownTask` | Moj zadatak | J10, J04, R03, R07, R08, R11, R12 | Full screen | None |
| `taskLifecycle` | Status zadatka | J10, J13, R03, R07, R11, R12 | Action sheet + destructive dialog | ownTask |
| `candidates` | Prijave na zadatak | J10, R07, R11, R12 | Full screen | None |
| `candidateDetail` | Ponuda osobe | J10, R07, R11, R12 | Full-height bottom sheet or screen | candidates |
| `selectReview` | Potvrdi izbor | J10, J11, R07, R12 | Full-screen confirmation sheet | candidateDetail |
| `agreements` | Dogovori | J11, R09, R11, R12 | Full screen | None |
| `agreementDetail` | Dogovor | J11, R07, R09, R11, R12 | Full screen | None |
| `completionReview` | Završetak posla | J11, R07, R12 | Full-height confirmation sheet | agreementDetail |
| `amendment` | Predloži izmenu | J11, R11d, SB07, R07, R12 | Full-screen subflow | agreementDetail |
| `amendmentReview` | Pregled izmene | J11, R11d, SB07, R12 | Review screen / full-height sheet | amendment |
| `agreementCancel` | Otkaži Dogovor | J11, R07, R11d, R12 | Destructive full-height sheet + final dialog | agreementDetail |
| `messagesInbox` | Poruke | J11, R09, R11, R12 | Full screen | None |
| `chat` | Privatne poruke | J11, R09, R11c, R12 | Full screen | None |
| `groupChat` | Grupni razgovor | J11, R09, R11, R12 | Full screen | None |
| `groupParticipants` | Učesnici grupe | J11, R01, R09, R12 | Bottom sheet | groupChat |
| `rating` | Oceni saradnju | J11, R11b, SB02, SB09, R12 | Full screen | None |
| `ratings` | Ocene | J11, R11b, SB02, SB09, R12 | Full screen | None |
| `qa` | Pitanja o zadatku | J10, R01, R11, R12 | Embedded section + See all screen | taskDetail / ownTask |
| `qaComposer` | Pitanje ili odgovor | J10, J13, R11, R12 | Bottom sheet composer | qa |
| `calendar` | Raspored | J08, J11, R05, R11e, SB12, R12 | Full screen | None |
| `archive` | Arhiva | J10, J11, R03, R11, R12 | **Compatibility redirect (konačni Product/UX S05/S06/S08)**; stari REV14 cilj `Full screen` je superseded | Dogovori → Prethodne saradnje (siguran cold fallback; čuvati domenska porekla) |
| `profile` | Profil | J06, J14, R11, R12 | Full screen | None |
| `personal` | Lični podaci | R11d, X02, R12 | Full screen | None |
| `avatar` | Fotografija profila | R11c, SB05, R12 | Photo picker/editor sheet | personal / profile |
| `workerProfile` | Radni profil | J06, J07, R04, R08, R12 | Full screen | None |
| `workerLocation` | Područje rada | J08, J05, J07, R04, R05, R08, R12 | Full screen | None |
| `workerAvailability` | Dostupnost | J08, J05, R05, R11e, R12 | Full screen | None |
| `settings` | Podešavanja | R11, R12 | Full screen | None |
| `password` | Promeni lozinku | R11, R12 | Full screen | None |
| `permissions` | Dozvole uređaja | R09, R11c, R11e, R12 | Contextual education + OS settings | settings |
| `notifications` | Obaveštenja | J12, R09, F20, SB10, R12 | Full screen | None |
| `notificationPreferences` | Obaveštenja — podešavanja | J12, R09, SB08, F20, R12 | Full screen | None |
| `privacy` | Privatnost i podaci | J14, R01, R10, R12 | Full screen | None |
| `privacyWho` | Ko šta vidi | J14, R01, F21, R10, R12 | Informational bottom sheet | privacy |
| `retention` | Rokovi čuvanja | J14, R10, R12 | Inline expandable section / detail sheet | privacy |
| `legal` | Pravila i saglasnosti | J14, R10, SB03, R12 | Full screen | None |
| `legalConsent` | Pregled i prihvatanje dokumenta | J14, R10, SB03, R12 | Full-screen document | legal |
| `export` | Kopija Tvojih podataka | J14, J13, R10, F19, R12 | Full screen | None |
| `closure` | Zatvaranje naloga | J14, J13, R10, R12 | Full-screen destructive flow | privacy |
| `blocked` | Blokirane osobe | J14, R10, R11, R12 | Full screen | None |
| `safety` | Prijavi ili blokirajte | J14, R01, R11c, X01, R12 | Full screen | None |
| `help` | Podrška | J13, R11d, SB06, R12 | Full screen | None |
| `supportRequest` | Novi zahtev | J13, R11d, SB06, R12 | Full screen | None |
| `supportDetail` | Zahtev podršci | J13, R11d, R12 | Full screen | None |
| `supportOperator` | Rad podrške | R11, R12 | Internal operator surface | help/supportDetail |
| `about` | O aplikaciji | R11, R12 | Full screen | None |
| `aiHistory` | AI razgovori | J13, J01, J05, R06, R11, R12 | Full screen | None |
| `aiTranscript` | Sačuvani razgovor | J13, R06, R11, R12 | Full screen | None |
| `taskPhotos` | Fotografije zadatka | J01, J03, J13, R11c, SB15, R12 | Full-screen gallery/editor | newTaskAI / ownTask |
| `publicProfile` | Profil saradnika | J10, J11, R01, F21, R11b, SB09, R12 | Full screen | None |
| `exactLocation` | Mesto Dogovora | J11, J14, R01, F21, R11, R12 | Bottom sheet + full-screen map when needed | agreementDetail |
| `deepLink` | Otvaranje dozvoljenog odredišta | J12, J13, R01, R11a, R12 | System/infrastructure state | None |
