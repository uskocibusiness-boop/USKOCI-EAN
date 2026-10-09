# USKOČI — nezavisni UI/UX forenzički presek

HEAD `6311804dbac2323069e927f9a8dc49f8f0bb1f14`. READ-ONLY. Nalazi nisu dozvola za izmene backend-a, brisanje ili deploy.

## Granice dokaza

- 74 TSX route/layout files structurally indexed, not 74 distinct screens or complete branch tests.
- Every source UI family indexed; targeted deep reads are not exhaustive semantic proof of every component.
- Current-runtime screenshots inspected only ce23 inert application review at font1.0 and1.30.
- Older receipts remain older; no current PHONE acceptance claimed.

Nijedan novi test, server poziv, build ili uređajska radnja nisu izvršeni. Dve ce23 slike stvarno su otvorene kroz view_image: `people-ce23-review.png` i `people-ce23-large-review.png`. Receipt navodi inertne scene, source ce23eb06, font1.0/1.30; one nisu dokaz live prijave. Iznos6667,2osobe, datum, povratak i glavna radnja vidljivi su i čitljivi. Veći font pravilno slaže vrednosti ispod naslova.

## Zaključak

Proizvod više nije zbir nepovezanih vizuelnih eksperimenata: postoji stvarni zajednički sistem. Najveći preostali dizajnerski posao je kontinuitet zadatka i jasnoća stanja/komunikacije, zatim native potvrda mape i pristupačnosti. Ne preporučujem novu navigaciju, novi UI kit ili ponovno crtanje svih ekrana. Četiri taba uključuju Poruke; stari zahtev za tri nije razlog za rollback.

## Nezavisne perspektive — bez zbirnog procenta

| Uloga | Procena /100 | Osnova |
|---|---:|---|
| J · Senior product design | 76 | Cohesive white/ink/art identity and hierarchy, actual ce23 review readable; all-screen visual acceptance missing and route expectation unresolved. |
| K · UX / IA | 69 | Four-tab purpose, distinct roles, progressive sheets exist; unbound draft continuity and inbox first-message expectation remain. |
| L · Design system | 84 | Actual shared sys, tokens, ListRow, FactArt/Glyph, dynamic layout; legacy surfaces and every component state not visually certified. |
| M · Accessibility | 62 | Text scales, stacked review at1.30 inspected, semantic controls/live regions/source guards; no end-to-end TalkBack, focus restoration or effective hit-area proof. |
| N · Product management | 67 | Core value loop exists with concrete gates; release/outcome proof incomplete. More cosmetic redesign cannot close unread/resume/native map gaps. |
| O · Activation | 70 | Two clear intents, first-run HowItWorks dismissible, AI first-send avoids ghost rows; interrupted pre-draft journey and public support condition erode confidence. |
| T · Ordinary first user | 68 | Can understand task, amount, people and primary action in inspected review; cannot reliably find interrupted unbound task or unseen private reply. |

Ocene su stručna procena zrelosti dostupnog izvora i ograničenih dokaza, ne mereni rezultat korisničke studije niti procenat završenosti. Nisu međusobno sabrane.

## Nalazi po prioritetu

**P0:** nijedan potvrđen u ovom dizajnerskom opsegu.

### UX01 · P1 · Unbound task AI conversation has no visible resume after completed turn/process restart

**Rizik:** FLOW_CONTINUITY. **Dokaz:** SOURCE confirmed; restart acceptance still needed.

Only explicit resumeId or pending turn journal restores intake ID. Successful turn clears journal; Home draft links are existing NEED records, not all unbound conversations. This is navigation loss, not evidence of server data loss.

**Izvori:** `src/app/(app)/nova.tsx:49`, `src/app/(app)/nova.tsx:107`, `src/app/(app)/nova.tsx:122`, `src/app/(app)/nova.tsx:138`, `src/data/homeSnapshot.ts:232`

**Minimalna dorada:** Account-scoped explicit Continue previous task affordance, preserve New task; canonical read before opening, never resume foreign/completed/abandoned blindly.

**Gotovo kada:** Successful incomplete turn, process restart, same-account Continue restores transcript/facts; New task remains blank; logout/other account reveals none.

### UX02 · P2 · Inbox promises a conversation before reader includes it

**Rizik:** MISLEADING_MICROCOPY. **Dokaz:** SOURCE confirmed.

Copy says a conversation appears as soon as Agreement exists; inner lateral joins require at least one visible message.

**Izvori:** `src/ui/messages/ConversationInboxPresentation.tsx:140`, `supabase/candidates/messages-inbox-01-20261003/function.sql:67`, `supabase/candidates/messages-inbox-01-20261003/function.sql:90`

**Minimalna dorada:** Explain first-message condition concisely and retain Otvori Dogovore action, or intentionally add empty conversations through separately proven reader change.

**Gotovo kada:** New Agreement without message shows truthful empty copy and route to correct Agreement; after first message one thread appears.

### UX03 · P2 · Private unread is unknown; group unread alone is rendered

**Rizik:** COMMUNICATION_VISIBILITY. **Dokaz:** SOURCE confirmed intentional contract gap.

Returning user cannot distinguish unseen private replies through inbox unread marks. Do not infer unread from last sender or timestamps.

**Izvori:** `src/ui/messages/ConversationInboxPresentation.tsx:190`, `supabase/candidates/messages-inbox-01-20261003/function.sql:63`

**Minimalna dorada:** Separate reliable account-scoped private ACK/unread read-model package; only then expose mark/count and matching tab attention.

**Gotovo kada:** Two accounts/read/reopen/multiple devices; private read ACK and count agree, group visibility remains unchanged.

### UX04 · P1 · Previous native maps had roads but missing place/street text and cluster numbers

**Rizik:** MAP_USABILITY_ACCEPTANCE. **Dokaz:** OLD_EMULATOR observed; current renderer cause NOTVERIFIED.

b52 captures show geometry without labels, reducing exact-pin and dense-city comprehension. This is not proof that style or current phone is broken.

**Izvori:** `src/ui/location/LocationOverviewMap.tsx:97`, `src/ui/location/LocationOverviewMap.tsx:103`, `docs/implementation/ui-ux-pass-20261002/evidence/review-map-finish-20261009/deployed-native-phone.json`

**Minimalna dorada:** Bounded current-APK physical/runtime comparison, isolate native renderer versus glyph/style before production patch.

**Gotovo kada:** Known viewport contains expected street/place names and numbered clusters; exact point can be selected and recovered with working names.

### UX05 · P2 · Route preview is ordered stops, not in-app road navigation geometry

**Rizik:** PRODUCT_SCOPE_EXPECTATION. **Dokaz:** SOURCE confirmed markers; desired road-route acceptance open.

Overview iterates numbered markers; no road polyline/duration computed there. Browser route action exists. Do not call this a complete calculated route in product copy.

**Izvori:** `src/ui/location/LocationOverviewMap.tsx:102`, `src/ui/location/LocationOverviewMap.tsx:103`, `src/ui/location/LocationMapPreview.tsx:15`

**Minimalna dorada:** Name preview as confirmed stops; validate real multi-stop AI flow. If road geometry is required, separate scoped capability with genuine provider result.

**Gotovo kada:** Start/via/end in correct order survive correction/review/publish/detail; exact versus approximate visibility preserved; external route never silently drops stops.

### UX06 · P2 · Restricted-account support disappears without configured public email

**Rizik:** TRUST_RELEASE_CONFIGURATION. **Dokaz:** SOURCE conditional; actual release contact NOTVERIFIED.

A correct no-invented-contact fallback has only exit. For public release, restricted user needs actual reachable public support; private support requires account.

**Izvori:** `src/ui/auth/supportContact.ts:10`, `src/ui/auth/RestrictedAccountPanel.tsx:74`

**Minimalna dorada:** Verify owner-approved release support address and mailto failure path; do not invent a contact or change legal text.

**Gotovo kada:** Restricted sign-in offers working contact on actual release build and handles missing mail client truthfully.

### UX07 · P3 · Offline Home wording can mean never mind

**Rizik:** MICROCOPY_CLARITY. **Dokaz:** SOURCE confirmed.

Nema veze is ambiguous in Serbian.

**Izvori:** `src/ui/home/HomePresentation.tsx:331`

**Minimalna dorada:** Nema internet veze. Prikazano je poslednje učitano. or current accurate connection-neutral wording.

**Gotovo kada:** Stale state retains last data, exposes retry and does not imply successful freshness.

## Šta zamrznuti kao dobru osnovu

- `src/app/(app)/_layout.tsx:47,224–235`: četiri primarna odredišta; pune poslovne forme bez slučajnog dupliranja tabova.
- `HomePresentation` + `HowItWorks`: dve namere istog naloga, kratko objašnjenje koje se može sakriti. Postojeći bound NEED nacrt već ima Nastavi nacrt; to nije isti problem kao unbound AI razgovor.
- `AgreementCollectionPresentation`: grupisanje po zadatku, aktivno/istorija i uloga Tražim pomoć/Uskačem; ne izmišljati još jednu listu istih Dogovora.
- `ConversationInboxPresentation`: očuvati server redosled, grupnu vidljivost, unknown≠0, pošteno ponašanje nad nepotpunom stranicom.
- `ApplicationPeopleInput`/pregled: default1, stvarne granice, unos+±, ista cena/broj u pregledu, sprečavanje invalid slanja. Ce23 slike podržavaju hijerarhiju.
- `PrivacyPresentation` i lokacije: objašnjenja prema stvarnom server ugovoru; ne dodavati lažne privacy prekidače ili tačnu javnu adresu.
- `PushPreferences`: čitljiv status telefona, relevantne kategorije po ulozi, sekundarno upravljanje u disclosure, vremenska zona sa uređaja. Ovo nije ekran koji treba precrtati kao dashboard.
- Focus/account/revision guard-ovi, canonical readback, reduced-motion opcija i pending/unknown zaštite ostaju. Vizuelni polish nije razlog da se oslabe.

## Stvarni vizuelni sistem iz izvora

`src/ui/system/tokens.ts` komponuje `src/theme/tokens.ts`; `layout.ts`, `Glyph.tsx`, `FactArt.tsx`, `ListRow.tsx`, `Segmented.tsx`, `textScale` i `T` su praktični jezik komponenti.

| Sloj | Stvarne vrednosti / pravilo |
|---|---|
| Površine | #FFFFFF; wash #F7F7F7; control #E8E8E8; icon well #F5F5F5 |
| Tekst | ink #202020; muted #525252; fact #404040 |
| Akcija/status | green #00845A / white; orange #FF7A1A, orange text #C23C00; danger #963F34; warn #8A5100 |
| Linije | #EBEBEB, strong #CDCDCD, card #DEDEDE |
| Artwork | lokacija #0F8C61; AI #3979C4; veštine #168579; ljudi #D76B5C; vreme #DBAC35 sa tamnijim edge |
| Razmaci | 4,8,12,16,20,24,32,48 |
| Radius | control/chip/badge12; card24; sheet28; pill999 |
| Tipografija | Inter; display32/37; hero30/35; page28/33; title21/26; heading18/24; body16/24; copy15/22; note14/20; meta13/18; label12/16; speech16/26 |
| Cene | 23/28 bold, varijante24/30,20/26,16/21; tabular brojevi |
| Dodir/lista | canonical48dp; row64/plain56; legacybase44 nije sam po sebi dokaz greške |
| Ikone | Phosphor Glyph16/20/24 za kontrole; FactArt originalni2.5D materijal + manji flat mark; jedna semantička porodica, ne emoji/različiti paketi |
| Motion | press120ms,toggle180,enter240,exit160,push240,camera360; stagger40ms max6; easing(.23,1,.32,1); scale.97/.985; sheet spring300/30; reduced-motion/focus guard |
| Responsive | narrow<340dp, largefont>=1.3; vrednosti prelaze ispod naziva, segmented4+ horizontalno, tekst ostaje čitljiv |

Ovo je source ekstrakcija, ne tvrdnja da su svi legacy ekrani potpuno migrirani ili da su FPS/kontrast svih kombinacija izmereni. Bogatstvo boje već postoji u artwork-u; dodatno bojenje svih dugmadi nije potreban sledeći paket.

## Pristupačnost: konkretna verifikacija, ne izmišljeni kvar

- `InfoButton.tsx:10–11,30–32` računa48dp preko hitSlop oko20dp glyph-a. `ListRow.tsx:126` ima trailing wrapper bez garantovane širine48. Proveriti stvarno efektivno touch područje u svakom parent-u pre tvrdnje o48dp; source arithmetic sama ne dokazuje cilj van granica parent-a. Ovo je **NOTVERIFIED rizik**, ne potvrđen native bug.
- ProductSheet/ConfirmSheet imaju modal/back semantiku; TalkBack fokus pri ulasku, zatvaranju i složenim map-sheet→sources povratcima nije fizički potvrđen u ovom pregledu.
- Ce23 veliki pregled čitljiv je na1.30; to ne pokriva auth, sve profile, kalendar i dugačke privatne/grupne poruke. Završni uzorak: jedan pravi tok po porodici uz TalkBack,1.30 font i otvorenu tastaturu.

## Prvi korisnik: problem → misao → očekivanje → dorada

| Situacija | Misao korisnika | Očekivanje | Dorada |
|---|---|---|---|
| Vrati se posle nedovršenog AI unosa | Gde je ono što sam već rekao? | Nastavi ili započni novo | UX01 eksplicitni resume, account-safe |
| Izabran/a prijava, Poruke prazne | Dogovor nije uspeo? | Jasna putanja do prvog razgovora | UX02 tačna copy + Otvori Dogovore |
| Nova privatna poruka među starim razgovorima | Ko mi je odgovorio? | Pouzdana nepročitana oznaka | UX03 pravi ACK/count, ne guessed badge |
| Mapa bez naziva | Ne znam da li je pravi ulaz/ulica | Nazivi i potvrđen adresni opis | UX04 native dokaz pre style izmene |
| Više adresa | Ovo izgleda kao cela ruta? | Redosled i jasno šta je izračunato | UX05 stanice naspram road-route |
| Ograničen nalog | Kome da se obratim? | Pravi javni kontakt | UX06 release konfiguracija i failure path |

## Ograničen plan završavanja dizajnerskog dela

1. Jeftino i jasno: UX02/UX07 copy, bez novih modala ili funkcija.
2. Jedan funkcionalni paket: UX01 nastavak pre-nacrta; jasno odvojen od unknown-turn recovery.
3. Read-model paket: UX03; UI badge tek posle stvarne potvrde semantike.
4. Jedan current native acceptance ciklus: obe AI namere, izmena, lokacija/start-via-end, prijava/izbor/poruka/povratak; nazivi mape i TalkBack. Kritične rupe rešavati, ne otvarati novi opšti redesign.
5. Release kontakt i trust sadržaj sa stvarnim vlasnikovim podacima; odvojiti APK isporuku od telefonskog prihvata.

## Svi route/source fajlovi i pokrivenost

SOURCE_INDEX znači da su sadržaj/importi/struktura popisani; nije tvrdnja da je svaka grana semantički dokazana. Old-runtime zapis je istorijski; current-runtime NOTVERIFIED znači da nema neposrednog dokaza u ovom pregledu. Redirect/layout fajl nije dodatni korisnički ekran.

| Ruta/fajl | Porodica | Runtime u ovom pregledu |
|---|---|---|
| `src/app/(app)/_layout.tsx` | Navigation shell | NOTVERIFIED in this audit |
| `src/app/(app)/arhiva.tsx` | Agreements/chat/reviews | NOTVERIFIED in this audit |
| `src/app/(app)/bezbednost.tsx` | Support/safety | NOTVERIFIED in this audit |
| `src/app/(app)/dogovori.tsx` | Agreements/chat/reviews | NOTVERIFIED in this audit |
| `src/app/(app)/fotografije-zadatka.tsx` | Task AI/review/location | NOTVERIFIED in this audit |
| `src/app/(app)/index.tsx` | Home/entry/compatibility | NOTVERIFIED in this audit |
| `src/app/(app)/mapa.tsx` | Discovery · redirect | NOTVERIFIED in this audit |
| `src/app/(app)/mesto-zadatka.tsx` | Task AI/review/location | NOTVERIFIED in this audit |
| `src/app/(app)/moje-aktivnosti.tsx` | Home/entry/compatibility · redirect | NOTVERIFIED in this audit |
| `src/app/(app)/moje-prijave.tsx` | Own tasks/applications/candidates | NOTVERIFIED in this audit |
| `src/app/(app)/nova.tsx` | Task AI/review/location | NOTVERIFIED in this audit |
| `src/app/(app)/oceni-dogovor.tsx` | Agreements/chat/reviews | NOTVERIFIED in this audit |
| `src/app/(app)/pitanja-zadatka.tsx` | Own tasks/applications/candidates | NOTVERIFIED in this audit |
| `src/app/(app)/podrska/[id].tsx` | Support/safety | NOTVERIFIED in this audit |
| `src/app/(app)/podrska/index.tsx` | Support/safety | NOTVERIFIED in this audit |
| `src/app/(app)/podrska/novi.tsx` | Support/safety | NOTVERIFIED in this audit |
| `src/app/(app)/podrska/operator.tsx` | Support/safety | NOTVERIFIED in this audit |
| `src/app/(app)/poruke.tsx` | Inbox | NOTVERIFIED in this audit |
| `src/app/(app)/potrebe/[id]/kandidati.tsx` | Own tasks/applications/candidates | NOTVERIFIED in this audit |
| `src/app/(app)/potrebe/[id]/pregled.tsx` | Own tasks/applications/candidates | NOTVERIFIED in this audit |
| `src/app/(app)/potrebe.tsx` | Own tasks/applications/candidates | NOTVERIFIED in this audit |
| `src/app/(app)/pregled-nacrta.tsx` | Task AI/review/location · redirect | NOTVERIFIED in this audit |
| `src/app/(app)/pregled-zadatka.tsx` | Task AI/review/location | NOTVERIFIED in this audit |
| `src/app/(app)/prilike/[id]/prijava.tsx` | Public task/application | NOTVERIFIED in this audit |
| `src/app/(app)/prilike/[id].tsx` | Public task/application | NOTVERIFIED in this audit |
| `src/app/(app)/prilike.tsx` | Discovery · redirect | NOTVERIFIED in this audit |
| `src/app/(app)/profil/blokirani.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/dostupnost.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/fotografija.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/izvoz.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/lokacija.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/lozinka.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/o-aplikaciji.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/obavestenja.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/ocene.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/podaci.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/pravna.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/prijava-greske.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/privatnost.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/profil/radnik.tsx` | Worker AI/profile | NOTVERIFIED in this audit |
| `src/app/(app)/profil/razgovor.tsx` | Worker AI/profile | NOTVERIFIED in this audit |
| `src/app/(app)/profil.tsx` | Profile/settings/privacy | NOTVERIFIED in this audit |
| `src/app/(app)/raspored.tsx` | Calendar | NOTVERIFIED in this audit |
| `src/app/(app)/zadaci.tsx` | Discovery | NOTVERIFIED in this audit |
| `src/app/+native-intent.tsx` | Home/entry/compatibility | NOTVERIFIED in this audit |
| `src/app/_layout.tsx` | Navigation shell | NOTVERIFIED in this audit |
| `src/app/auth.tsx` | Auth/recovery | NOTVERIFIED in this audit |
| `src/app/dizajn-ai-mesto.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-ai.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-dodaci.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-dogovori.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-kalendar.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-kandidati.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-katalog27.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-mapa.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-moji-zadaci.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-obavestenja.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-objava.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-pocetna.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-poruke.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-prijava-forma.tsx` | QA gallery | ce23 INERT review screenshots inspected; production route/live submit NOTVERIFIED |
| `src/app/dizajn-prijava.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-prijave.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-privatnost.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-profil.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-sistem.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-tabla.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dizajn-zadaci.tsx` | QA gallery | NOTVERIFIED in this audit |
| `src/app/dogovor/[id]/grupa.tsx` | Agreements/chat/reviews | NOTVERIFIED in this audit |
| `src/app/dogovor/[id]/izmene.tsx` | Agreements/chat/reviews | NOTVERIFIED in this audit |
| `src/app/dogovor/[id].tsx` | Agreements/chat/reviews | NOTVERIFIED in this audit |
| `src/app/obavestenja.tsx` | Notifications | NOTVERIFIED in this audit |
| `src/app/oporavak.tsx` | Auth/recovery | NOTVERIFIED in this audit |
| `src/app/prijave.tsx` | Auth/recovery · redirect | NOTVERIFIED in this audit |

## Sve source UI porodice

| Porodica | Source fajlovi / linije | sys reference |
|---|---:|---:|
| agreements | 19 / 2542 | 11 |
| aiFirst | 8 / 1269 | 6 |
| auth | 17 / 1393 | 12 |
| calendar | 28 / 3250 | 17 |
| closure | 3 / 429 | 1 |
| entry | 10 / 801 | 1 |
| groups | 7 / 748 | 3 |
| home | 5 / 751 | 3 |
| legal | 2 / 310 | 1 |
| location | 19 / 2897 | 12 |
| media | 12 / 1528 | 8 |
| messages | 7 / 758 | 4 |
| needs | 5 / 622 | 3 |
| notifications | 11 / 1497 | 6 |
| objava | 8 / 1116 | 5 |
| permissions | 5 / 286 | 1 |
| privacy | 3 / 430 | 3 |
| product | 2 / 425 | 2 |
| profile | 18 / 1136 | 7 |
| qa | 7 / 743 | 2 |
| referenceEntry | 2 / 540 | 0 |
| reviews | 13 / 1311 | 7 |
| safety | 4 / 372 | 1 |
| settings | 6 / 467 | 5 |
| support | 12 / 1534 | 7 |
| system | 60 / 5596 | 42 |
| v2 | 73 / 11904 | 49 |
| workerProfile | 6 / 1123 | 4 |

Broj sys referenci nije score i ne dokazuje odsustvo tokena: kompozit može koristiti zajedničke komponente bez direktnog sys importa. Tačni route hashovi/importi i strukturirani nalazi su u pratećem JSON-u.
