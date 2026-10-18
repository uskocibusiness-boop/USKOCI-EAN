# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](../implementation/design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI Screen Inventory

Generated 2026-09-08. Evidence boundary: canonical Git HEAD `38e9a38`; live Supabase `leqcwgzvjsxugfgzdmth`; open PR work is listed as pending, never canonical.

Navigation correction, 8 September 2026: MENI TREBA = Zadaci | U / Novi | Dogovori; JA MOGU = Prijave | U / Zadaci | Dogovori. Bell → Inbox; avatar → Profile. Shared List/Map lives inside Zadaci for both intents. R01/W01 are retained historical records; 43 active surfaces remain. The original code/live observation boundary above is unchanged.

## Status vocabulary

- **IMPLEMENTED**: route/component exists on canonical source.
- **PARTIAL**: a useful slice exists but the complete user journey or state coverage does not.
- **BACKEND READY / UI MISSING**: live authority exists without a complete mobile surface.
- **CONFIG-DISABLED**: foundation exists but launch gate is closed.
- **NOT IMPLEMENTED / MISSING**: no honest current product surface.
- **SUPERSEDED**: historical surface concept excluded from active design scope and implementation gaps.

## S01 — Splash / brand introduction

**Role:** SHARED  
**Purpose:** Prepoznatljiv, kratak ulazak u USKOČI i priprema sesije.  
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED  
**Entry points:** cold start; logout  
**Displayed data:** originalni U/handshake/pin znak; USKOČI wordmark  
**Available actions:** preskoči samo ako je povratni korisnik i sesija spremna  
**Primary CTA:** Automatski nastavak  
**Secondary actions:** —  
**Backend objects:** auth session  
**Permissions:** public  
**Statuses:** BOOTING; SESSION_READY; SESSION_MISSING  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** S02 ili S03; active intent tab / preserved target\
**Notifications:** —  
**Edge cases:** spor telefon; reduced motion; session expires tokom animacije  
**Current route/evidence:** /auth; BrandScene.tsx; 12 motion tracks; PR66 canonical

## S02 — Intent / role explanation

**Role:** SHARED  
**Purpose:** Bira trenutnu nameru istog naloga: tražim pomoć ili nudim pomoć.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** entry welcome; Profil role switch  
**Displayed data:** Meni treba; Ja mogu; jedan nalog za obe uloge  
**Available actions:** izaberi nameru; prijavi se  
**Primary CTA:** Meni treba / Ja mogu  
**Secondary actions:** —  
**Backend objects:** app_accounts.active_mode; entry intent local state  
**Permissions:** public or authenticated  
**Statuses:** REQUESTER; WORKER  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** S03; R03 requester Zadaci; W06 worker Prijave; W03 discovery intent\
**Notifications:** —  
**Edge cases:** promena naloga tokom zapisa namere; duboki link čuva cilj  
**Current route/evidence:** /auth; EntryWelcome.tsx; entryIntentClientService.ts

## S03 — Authentication

**Role:** SHARED  
**Purpose:** Prijava i registracija bez gubitka namere i povratnog cilja.  
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED  
**Entry points:** S02; protected deep link; expired session  
**Displayed data:** email; lozinka; ime/prezime/grad pri registraciji; dostupne auth metode  
**Available actions:** login; signup; telefon OTP kada je dostupan  
**Primary CTA:** Prijavite se / Napravite nalog  
**Secondary actions:** —  
**Backend objects:** auth.users; app_accounts; app_profiles  
**Permissions:** public  
**Statuses:** LOGIN; SIGNUP; PHONE; OTP; CONFIRM_EMAIL  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** sačuvani return target; R03 requester Zadaci / W06 worker Prijave\
**Notifications:** email confirmation ako je uključena  
**Edge cases:** dupli submit; account switch; expired target; masked password on mode switch  
**Current route/evidence:** /auth; auth.tsx; authClientService.ts; physical Android proof

## S04 — Password recovery / confirmation

**Role:** SHARED  
**Purpose:** Bezbedan oporavak naloga i povratak u aplikaciju.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** S03 forgot password; email deep link  
**Displayed data:** status linka; novi password form  
**Available actions:** pošalji link; postavi novu lozinku  
**Primary CTA:** Pošaljite link  
**Secondary actions:** —  
**Backend objects:** Supabase Auth recovery  
**Permissions:** public + recovery token  
**Statuses:** REQUESTED; LINK_OPENED; EXPIRED; DONE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** —  
**Notifications:** —  
**Edge cases:** —  
**Current route/evidence:** /auth (gated notice); auth.tsx RECOVERY_UNAVAILABLE

## S05 — Permissions primer

**Role:** SHARED  
**Purpose:** Traži lokaciju, obaveštenja, kameru i mikrofon tek u kontekstu koristi.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** map nearby; enable push; add photo; voice input  
**Displayed data:** zašto je dozvola korisna; system status  
**Available actions:** nastavi; kasnije; otvori Settings  
**Primary CTA:** Dozvoli  
**Secondary actions:** —  
**Backend objects:** device permissions; notification_push_devices  
**Permissions:** OS permission  
**Statuses:** UNKNOWN; GRANTED; DENIED; BLOCKED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** originalni kontekst  
**Notifications:** —  
**Edge cases:** permanent denial; partial permission; web unsupported  
**Current route/evidence:** —

## S06 — Notifications / Inbox

**Role:** SHARED  
**Purpose:** Jedinstven spisak događaja sa pouzdanim deep linkom.  
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED  
**Entry points:** bell; push tap  
**Displayed data:** title; body; time; unread; role context  
**Available actions:** open; mark read; mark all read; load more  
**Primary CTA:** Otvorite događaj  
**Secondary actions:** —  
**Backend objects:** user_activity_events; notification_deliveries; rpc_list_inbox; rpc_resolve_inbox_target  
**Permissions:** recipient only by RLS/RPC  
**Statuses:** UNREAD; READ; TARGET_AVAILABLE; TARGET_UNAVAILABLE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** Need; Applications; Opportunity; Dogovor  
**Notifications:** in-app source; push transport separate  
**Edge cases:** target deleted; role differs; duplicate event; stale cursor  
**Current route/evidence:** /obavestenja; obavestenja.tsx; inboxClientService.ts; N03/N08

## S07 — Settings hub

**Role:** SHARED  
**Purpose:** Podešavanja naloga, obaveštenja, privatnosti, podrške i pravnih podataka.  
**Product canon:** PRODUCT CANON  
**Current implementation:** MISSING  
**Entry points:** Profil  
**Displayed data:** sections; current toggles  
**Available actions:** open settings surface  
**Primary CTA:** Nema globalnog CTA  
**Secondary actions:** —  
**Backend objects:** notification_preferences; app_accounts  
**Permissions:** owner  
**Statuses:** NORMAL  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** S08; S09; S10; S11  
**Notifications:** —  
**Edge cases:** —  
**Current route/evidence:** —

## S08 — Notification preferences

**Role:** SHARED  
**Purpose:** Kontrola in-app/push kategorija i tihih sati po ulozi.  
**Product canon:** PRODUCT CANON  
**Current implementation:** BACKEND READY / UI MISSING  
**Entry points:** S07  
**Displayed data:** channels; event families; quiet hours; HITNO override; role context  
**Available actions:** toggle; set time; save  
**Primary CTA:** Sačuvajte podešavanja  
**Secondary actions:** —  
**Backend objects:** notification_preferences; rpc_get_notification_preferences; rpc_set_notification_preferences  
**Permissions:** owner + expected revision  
**Statuses:** DEFAULT; CUSTOM; CONFLICT  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** S07  
**Notifications:** —  
**Edge cases:** cross-device revision conflict; timezone change; HITNO override  
**Current route/evidence:** N08 migration; notificationPreferencesClientService.ts

## S09 — Privacy & data rights

**Role:** SHARED  
**Purpose:** Objašnjava privatnost lokacije/kontakta i omogućava izvoz/brisanje zahteva.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** S07; legal links  
**Displayed data:** privacy policy; data scopes; download/delete status  
**Available actions:** request export; request deletion  
**Primary CTA:** Preuzmite podatke  
**Secondary actions:** —  
**Backend objects:** account/data lifecycle not present  
**Permissions:** owner + recent auth  
**Statuses:** AVAILABLE; REQUESTED; PROCESSING; READY; FAILED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** S07  
**Notifications:** —  
**Edge cases:** active Dogovor blocks closure; legal retention  
**Current route/evidence:** —

## S10 — Support / report case

**Role:** SHARED  
**Purpose:** Kontakt podrške i bezbednosni slučaj vezan za konkretan Dogovor.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** S07; D05  
**Displayed data:** case category; description; linked entity; status  
**Available actions:** submit evidence; view case  
**Primary CTA:** Pošaljite prijavu  
**Secondary actions:** —  
**Backend objects:** rpc_report_problem; agreement_execution.problem_open  
**Permissions:** participant  
**Statuses:** OPEN; IN_REVIEW; RESOLVED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** Dogovor  
**Notifications:** recovery/account event intended  
**Edge cases:** offline evidence; abuse report without agreement  
**Current route/evidence:** —

## S11 — Account & closure

**Role:** SHARED  
**Purpose:** Upravljanje nalogom, sesijama i zatvaranjem bez gubitka obaveza.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** S07  
**Displayed data:** email/phone; sessions; active obligations  
**Available actions:** sign out; change password; close account  
**Primary CTA:** Upravljajte nalogom  
**Secondary actions:** —  
**Backend objects:** auth.sessions; app_accounts; account lifecycle missing  
**Permissions:** owner + recent auth  
**Statuses:** ACTIVE; CLOSURE_BLOCKED; CLOSURE_PENDING; CLOSED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Zatvaranje blokirati dok postoje aktivni Dogovori; objasniti retention.  
**Next:** S03  
**Notifications:** —  
**Edge cases:** token remains valid after admin delete; multiple devices  
**Current route/evidence:** —

## R01 — Former Naručilac Home (superseded)

**Role:** NARUČILAC  
**Purpose:** Istorijski zaseban Home koncept je ukinut potvrđenom trozonskom navigacijom. Koristan sadržaj pripada postojećim Zadaci/Prijave/Dogovori površinama i Profilu preko avatara.\
**Product canon:** SUPERSEDED\
**Current implementation:** NOT APPLICABLE / SUPERSEDED\
**Entry points:** —\
**Displayed data:** —\
**Available actions:** —\
**Primary CTA:** —\
**Secondary actions:** —  
**Backend objects:** needs; agreements; notification_deliveries  
**Permissions:** owner projections  
**Statuses:** SUPERSEDED\
**Loading:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Empty:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Validation:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Error:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Offline:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Success:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Destructive:** Nema posebne radnje na ukinutom Home ekranu.\
**Next:** R03; W03; R02; D01; P01\
**Notifications:** —  
**Edge cases:** do not recreate a permanent Home tab or count its absence as a gap\
**Current route/evidence:** Owner-confirmed three-zone correction 2026-09-08; former five-tab concept superseded

## R02 — AI Need creation

**Role:** NARUČILAC  
**Purpose:** Prirodan tekst ili glas pretvara u tačan, ljudski potvrđen nacrt.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** U / Novi center zone in MENI TREBA; edit Need\
**Displayed data:** conversation; live compact Need card; missing/ambiguous question; media symbols  
**Available actions:** type; voice target; add photos target; correct fact; review  
**Primary CTA:** Pošaljite / Objavite kada spremno  
**Secondary actions:** dodaj fotografije; otvori structured review  
**Backend objects:** ai_conversations; ai_messages; ai_structured_facts; uskoci-ai-interview  
**Permissions:** authenticated owner; Edge JWT  
**Statuses:** EMPTY; INTERVIEWING; CLARIFY; REVIEW; BLOCK; READY  
**Loading:** Streaming/typing indicator uz odmah vidljiv korisnički unos; card se ažurira atomski.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Čuvati neposlat tekst lokalno; ne predstavljati AI turn kao poslat.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** R07; R04  
**Notifications:** nema push-a za lokalni turn  
**Edge cases:** provider timeout; duplicate send; account switch; conversation restart; unsafe input  
**Current route/evidence:** /nova; nova.tsx; aiNeedV2Production.ts; Edge v11; actual provider success unproven

## R03 — My Needs list

**Role:** NARUČILAC  
**Purpose:** Pregled sopstvenih Need objekata po životnom ciklusu unutar Zadaci; jasno odvojen od javnog discovery prikaza.\
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED / NEEDS REDESIGN  
**Entry points:** Zadaci in MENI TREBA → owner Needs/drafts context; post-auth requester default\
**Displayed data:** title; safe place; time; price/offers; people coverage; applications; status  
**Available actions:** open Need; continue draft; refresh  
**Primary CTA:** Otvorite Need  
**Secondary actions:** —  
**Backend objects:** needs; requester projection  
**Permissions:** owner  
**Statuses:** DRAFT; PUBLISHED; SELECTION; ACTIVE; COMPLETED; CANCELLED; EXPIRED; ARCHIVED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** R04; R07  
**Notifications:** —  
**Edge cases:** draft must not show candidate offer CTA; changed Need with existing responses  
**Current route/evidence:** /potrebe; potrebe.tsx

## R04 — Need full detail / workspace

**Role:** NARUČILAC  
**Purpose:** Full-screen source of truth for one Need, status, content and next action.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** R03 card; Inbox  
**Displayed data:** title; description; schedule; price/offers; slots; requirements; gallery target; map/route; publication state  
**Available actions:** edit; publish; open candidates; close search; cancel  
**Primary CTA:** Contextual: Objavite / Pogledajte prijave / Dogovor  
**Secondary actions:** —  
**Backend objects:** needs; need_geography; need_requirement_details; need_sensitive; marketplace_responses  
**Permissions:** owner; exact address owner  
**Statuses:** DRAFT; PUBLISHED; SELECTION; ACTIVE; TERMINAL; STALE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** R02 edit; R05; D01  
**Notifications:** Need changes may stale Applications  
**Edge cases:** double publish; revision changed; partial slots; offline read  
**Current route/evidence:** /potrebe/[id]/pregled; pregled.tsx; RU4 owner lock

## R05 — Candidates / selection

**Role:** NARUČILAC  
**Purpose:** Poredi stvarne prijave i atomski bira tačnu verziju kandidata.  
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED / NEEDS REDESIGN  
**Entry points:** R04; Inbox response event  
**Displayed data:** candidate profile; rating availability; price; arrival; coverage; note; skills/tools/vehicles evidence; state  
**Available actions:** open public profile; select exact Application; close remaining search  
**Primary CTA:** Izaberite Uskočera  
**Secondary actions:** —  
**Backend objects:** marketplace_responses; marketplace_response_versions; response_application_snapshots; need_selections; agreements  
**Permissions:** Need owner via RPC  
**Statuses:** SELECTABLE; STALE; OVERFILL; SELECTED; WITHDRAWN; CLOSED; FULL  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Ako je Need/Application revizija promenjena, zahtevati ponovno čitanje.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Atomski kreiran CONFIRMED Dogovor; nema treće potvrde.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** R06; D01  
**Notifications:** selected/not-selected events  
**Edge cases:** two taps; parallel selection; partial team capacity; legacy unproven snapshot  
**Current route/evidence:** /potrebe/[id]/kandidati; kandidati.tsx; rpc_list_need_candidates; rpc_select_response

## R06 — Public worker profile

**Role:** NARUČILAC  
**Purpose:** Trust passport kandidata bez internih match podataka.  
**Product canon:** PRODUCT CANON  
**Current implementation:** BACKEND READY / UI PARTIAL  
**Entry points:** R05 candidate  
**Displayed data:** name; avatar; city; headline; bio; rating availability; review count; completed count; identity verification availability  
**Available actions:** back to candidate  
**Primary CTA:** Izaberite iz konteksta prijave  
**Secondary actions:** —  
**Backend objects:** rpc_get_public_profile  
**Permissions:** public-safe profile id  
**Statuses:** AVAILABLE; RATING_UNAVAILABLE; VERIFICATION_UNAVAILABLE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** R05  
**Notifications:** —  
**Edge cases:** never invent stars/badge when null  
**Current route/evidence:** publicProfileClientService.ts

## R07 — Need structured review

**Role:** NARUČILAC  
**Purpose:** Jedna ljudska provera strukturiranih činjenica pre čuvanja/objave.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** R02  
**Displayed data:** title; description; time; route; people; vehicle/tools; pricing; privacy class; safety outcome  
**Available actions:** edit fact; confirm summary; save draft; publish when admitted  
**Primary CTA:** Sačuvajte nacrt / Objavite Zadatak  
**Secondary actions:** —  
**Backend objects:** ai_structured_facts; need_draft_save_commands; needs  
**Permissions:** conversation owner; server review token  
**Statuses:** INCOMPLETE; READY_FOR_DRAFT; REVIEW_REQUIRED; BLOCKED; SAVED; STALE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Jedna završna potvrda; dodatno pitanje samo za stvarno obaveznu/ambiguous činjenicu.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** R03; R04; R02  
**Notifications:** —  
**Edge cases:** stale review token; cross-device save; fact superseded; account switch  
**Current route/evidence:** /pregled-nacrta; pregled-nacrta.tsx; rpc_ai_need_review_v2; rpc_save_need_draft_from_review

## W01 — Former Uskočer Home (superseded)

**Role:** USKOČER  
**Purpose:** Istorijski zaseban Home koncept je ukinut potvrđenom trozonskom navigacijom. Koristan sadržaj pripada postojećim Zadaci/Prijave/Dogovori površinama i Profilu preko avatara.\
**Product canon:** SUPERSEDED\
**Current implementation:** NOT APPLICABLE / SUPERSEDED\
**Entry points:** —\
**Displayed data:** —\
**Available actions:** —\
**Primary CTA:** —\
**Secondary actions:** —  
**Backend objects:** app_profiles; worker_match_preferences; opportunity_deliveries; marketplace_responses; agreements  
**Permissions:** owner projections  
**Statuses:** SUPERSEDED\
**Loading:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Empty:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Validation:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Error:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Offline:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Success:** Nije zaseban ekran; koristiti stanje odgovarajuće aktivne površine.\
**Destructive:** Nema posebne radnje na ukinutom Home ekranu.\
**Next:** W03; W06; W09; D01; P01\
**Notifications:** —  
**Edge cases:** do not recreate a permanent Home tab or count its absence as a gap\
**Current route/evidence:** Owner-confirmed three-zone correction 2026-09-08; former five-tab concept superseded

## W02 — AI Worker profile

**Role:** USKOČER  
**Purpose:** Razgovorom predlaže radni profil, ali čovek potvrđuje capability podatke.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** avatar → Profile → incomplete worker profile; W08\
**Displayed data:** skills; tools; licenses; vehicles; radius; availability; team capacity  
**Available actions:** talk/type; correct; save profile  
**Primary CTA:** Sačuvajte Radni profil  
**Secondary actions:** —  
**Backend objects:** app_profiles; worker_match_preferences; AI profile infrastructure missing  
**Permissions:** owner  
**Statuses:** DRAFT; INCOMPLETE; READY; ACTIVE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** W08; W03  
**Notifications:** —  
**Edge cases:** self-declared evidence label; do not imply verification  
**Current route/evidence:** —

## W03 — Zadaci discovery / opportunities list and map

**Role:** BOTH\
**Purpose:** Otkriva javno bezbedne Need prilike kroz sinhronizovanu listu i mapu.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL / PR67 SOURCE-PROVEN  
**Entry points:** Zadaci in MENI TREBA; U / Zadaci in JA MOGU\
**Displayed data:** Need card; approximate pin; filters; list/map mode; requester public trust  
**Available actions:** toggle list/map; search; filter; open pin/card; refresh  
**Primary CTA:** Otvorite Zadatak  
**Secondary actions:** —  
**Backend objects:** needs public projection; need_geography; opportunity_deliveries  
**Permissions:** public-safe discovery in both intents; current canonical worker entry and shared-discovery PR status remain separately scoped\
**Statuses:** LIST; MAP; LOADING; EMPTY; ERROR  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** W04; W08 when worker readiness is required\
**Notifications:** —  
**Edge cases:** no coordinates; clustered pins; public deadline closes while open; location permission denied; intent switch preserves shared List/Map context without granting Application rights\
**Current route/evidence:** /prilike (canonical list only); prilike.tsx; PR67 pending for map/list

## W04 — Opportunity full detail

**Role:** BOTH\
**Purpose:** Full-screen detalj zadatka sa javno bezbednim podacima i jasnom eligibility odlukom.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL / PR68 SOURCE-PROVEN  
**Entry points:** W03 card/pin; Inbox  
**Displayed data:** title; description; gallery target; approximate map; schedule; price/offers; slots; requirements; requester profile  
**Available actions:** open requester profile; apply only with server-authorized worker eligibility; back\
**Primary CTA:** Pogledajte zadatak / Pošaljite prijavu samo uz worker eligibility\
**Secondary actions:** —  
**Backend objects:** needs; need_geography; need_requirement_details; rpc_get_public_profile  
**Permissions:** public-safe data; no exact address  
**Statuses:** OPEN; DEADLINE_PASSED; FULL; CANCELLED; READ_ERROR  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** W05 when eligible worker; public requester profile\
**Notifications:** —  
**Edge cases:** deadline changes; own Need; already applied; profile incomplete; MENI TREBA may browse; Application action still requires eligible worker context\
**Current route/evidence:** /prilike/[id]; prilike/[id].tsx; W04 recovery proof

## W05 — Application composer

**Role:** USKOČER  
**Purpose:** Sastavlja cenu, pokrivenost i napomenu uz snapshot capability dokaza.  
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED / NEEDS REDESIGN  
**Entry points:** W04  
**Displayed data:** Need revision; remaining slots; price; start/end; note; self-declared capability snapshot  
**Available actions:** edit; submit  
**Primary CTA:** Pošaljite prijavu  
**Secondary actions:** —  
**Backend objects:** rpc_submit_response; marketplace_responses; marketplace_response_versions; response_application_snapshots  
**Permissions:** active worker profile; not owner; deadline open  
**Statuses:** DRAFT; SUBMITTING; SUBMITTED; STALE; INELIGIBLE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Cena >0, slots within remaining, profile readiness and exact Need revision.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** W06  
**Notifications:** response_received to requester  
**Edge cases:** double tap idempotency; Need revised during submit; team capacity  
**Current route/evidence:** /prilike/[id]/prijava; prijava.tsx; atomic application migration

## W06 — My Applications

**Role:** USKOČER  
**Purpose:** Životni ciklus svih sopstvenih prijava i radnje koje traže pažnju.  
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED / NEEDS REDESIGN  
**Entry points:** Prijave tab; Inbox  
**Displayed data:** Need title; state; price; coverage; revision change; Dogovor link  
**Available actions:** open Need; review stale; withdraw; open Dogovor  
**Primary CTA:** Contextual next action  
**Secondary actions:** —  
**Backend objects:** rpc_list_my_applications; rpc_withdraw_response  
**Permissions:** owner  
**Statuses:** SUBMITTED; VIEWED; SHORTLISTED; STALE_REVIEW_REQUIRED; WITHDRAWN; SELECTED; CLOSED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** W04; W05; D01  
**Notifications:** viewed/shortlisted/selected/not-selected/stale  
**Edge cases:** withdraw retry; stale revision resolution  
**Current route/evidence:** /moje-prijave; moje-prijave.tsx; P0C03

## W08 — Worker profile editor

**Role:** USKOČER  
**Purpose:** Uređuje identitet rada, capability i javni opis bez lažne verifikacije.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** avatar → Profile; W03 readiness guidance\
**Displayed data:** name; city; bio; skills; tools; vehicles; radius; available now; profile status  
**Available actions:** save; activate when complete  
**Primary CTA:** Sačuvajte profil  
**Secondary actions:** —  
**Backend objects:** app_profiles; rpc_complete_worker_profile  
**Permissions:** owner  
**Statuses:** DRAFT; ACTIVE; SUSPENDED; INCOMPLETE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** P01; W03; W09\
**Notifications:** —  
**Edge cases:** direct table write currently in client service; activation validation; account switch  
**Current route/evidence:** /profil/radnik; profil/radnik.tsx; workerProfileClientService.ts

## W09 — Availability & calendar

**Role:** USKOČER  
**Purpose:** Upravlja dostupnošću odmah, pravilima i izuzecima uz Dogovor obaveze.  
**Product canon:** PRODUCT CANON  
**Current implementation:** BACKEND PARTIAL / UI MISSING  
**Entry points:** avatar → Profile; W08; C01\
**Displayed data:** available now expiry; weekly rules; one-off windows; Agreement conflicts  
**Available actions:** toggle now; add rule; block time  
**Primary CTA:** Sačuvajte dostupnost  
**Secondary actions:** —  
**Backend objects:** profile_availability_rules; profile_availability_windows; worker_match_preferences; agreements  
**Permissions:** owner  
**Statuses:** AVAILABLE; UNAVAILABLE; CONFLICT  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** P01; C01\
**Notifications:** —  
**Edge cases:** timezone; overlap; stale now flag; cross-Need conflicts  
**Current route/evidence:** —

## D01 — Agreements list / shell

**Role:** BOTH  
**Purpose:** Prikazuje sve Dogovore iz aktivne uloge i vodi u jedinstven workspace.  
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED / NEEDS REDESIGN  
**Entry points:** Dogovori zone in either intent; Inbox\
**Displayed data:** title; counterparty; time; price; coverage; state; attention  
**Available actions:** open; refresh  
**Primary CTA:** Otvorite Dogovor  
**Secondary actions:** —  
**Backend objects:** rpc_list_my_agreements  
**Permissions:** participant  
**Statuses:** CONFIRMED; AWAITING_REQUESTER; COMPLETED; CANCELLED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** D02  
**Notifications:** —  
**Edge cases:** same account switches role; multiple workers per Need  
**Current route/evidence:** /dogovori; dogovori.tsx

## D02 — Agreement overview

**Role:** BOTH  
**Purpose:** Jedan autoritativan pregled prihvaćene verzije, ljudi, vremena, cene, rute i privatnih grantova.  
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED / PARTIAL  
**Entry points:** D01; Inbox  
**Displayed data:** accepted version; scope; price; schedule; participants; coverage; route mode; contact grants; exact location when allowed; timeline  
**Available actions:** share/revoke own phone; reveal exact location when allowed; open chat; propose change; complete/cancel/report  
**Primary CTA:** Contextual execution action  
**Secondary actions:** —  
**Backend objects:** agreements; agreement_versions; need_selections; access_grants; agreement_execution  
**Permissions:** participant; directional grants  
**Statuses:** CONFIRMED; AWAITING_REQUESTER; COMPLETED; CANCELLED; PROBLEM_OPEN  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** D03; D05; D06  
**Notifications:** —  
**Edge cases:** remote has no address; directional phone grant; version changes while open  
**Current route/evidence:** /dogovor/[id]; dogovor/[id].tsx; rpc_get_agreement_workspace

## D03 — Agreement chat

**Role:** BOTH  
**Purpose:** Pouzdana participant-only komunikacija nevezana za deljenje telefona.  
**Product canon:** PRODUCT CANON  
**Current implementation:** IMPLEMENTED  
**Entry points:** D02  
**Displayed data:** messages; sender; time; read receipt when authoritative; outbox state  
**Available actions:** send; retry failed  
**Primary CTA:** Pošaljite poruku  
**Secondary actions:** —  
**Backend objects:** agreement_messages; rpc_send_agreement_message; D03 retry receipts  
**Permissions:** participants only  
**Statuses:** SENDING; SENT; FAILED_RETRYABLE; READ  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Poruka ostaje sa stabilnim client id i eksplicitnim retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** D02  
**Notifications:** MESSAGE_RECEIVED  
**Edge cases:** rapid double tap; IME overlap; account switch; out-of-order read  
**Current route/evidence:** /dogovor/[id] embedded; AgreementChat.tsx; D03 Android proof

## D04 — Agreement timeline

**Role:** BOTH  
**Purpose:** Hronologija značajnih, autoritativnih događaja unutar Pregleda.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** D02 section  
**Displayed data:** time; event text; version/change/completion events  
**Available actions:** open related event where safe  
**Primary CTA:** Nema; informativno  
**Secondary actions:** —  
**Backend objects:** agreement versions; user_activity_events; projection timeline  
**Permissions:** participant  
**Statuses:** NORMAL; EMPTY  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** D02  
**Notifications:** —  
**Edge cases:** timezone; duplicate events  
**Current route/evidence:** /dogovor/[id] embedded

## D05 — Change proposal / cancellation / problem

**Role:** BOTH  
**Purpose:** Bilateral change proposal plus unilateral cancellation and problem reporting.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** D02  
**Displayed data:** current version; proposed deltas; reason; consequence  
**Available actions:** propose change; accept/reject; cancel; report problem  
**Primary CTA:** Pošaljite predlog / Prihvatite  
**Secondary actions:** —  
**Backend objects:** agreement_change_proposals; agreement_versions; rpc_propose_agreement_change_v2; rpc_respond_agreement_change; rpc_cancel_agreement; rpc_report_problem  
**Permissions:** participant; optimistic version  
**Statuses:** OPEN; ACCEPTED; REJECTED; SUPERSEDED; CANCELLED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** D02  
**Notifications:** change proposed/rejected/version changed  
**Edge cases:** simultaneous proposals; stale version; problem blocks auto-complete  
**Current route/evidence:** /dogovor/[id] embedded; agreementClientService.ts

## D06 — Completion & review

**Role:** BOTH  
**Purpose:** Završava posao uz worker mark, requester confirm, 48h window i zatim obostranu ocenu.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL / REVIEW MISSING  
**Entry points:** D02; completion notification  
**Displayed data:** completion state; server deadline; problem state; review eligibility  
**Available actions:** mark work done; confirm completion; report problem; leave review target  
**Primary CTA:** Završeno / Potvrdite završetak  
**Secondary actions:** —  
**Backend objects:** agreement_execution; rpc_mark_work_done; rpc_confirm_completion; review tables missing  
**Permissions:** role-specific participant  
**Statuses:** CONFIRMED; AWAITING_REQUESTER; PROBLEM_OPEN; COMPLETED; CANCELLED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** D02; Review form target  
**Notifications:** COMPLETION_REQUIRED; REVIEW_RECEIVED target  
**Edge cases:** replay must not extend deadline; cancelled must not complete; confirm may precede worker mark  
**Current route/evidence:** /dogovor/[id] embedded; known completion lifecycle gap; no review storage

## M01 — Full-screen map

**Role:** BOTH\
**Purpose:** Spatial browse with approximate pins and synchronized filters.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL / PR67 PENDING  
**Entry points:** W03 map mode inside Zadaci in either intent\
**Displayed data:** approximate pins; clusters; selected Need preview; search area  
**Available actions:** pan; re-search area; select pin; switch list  
**Primary CTA:** Pogledajte Zadatak  
**Secondary actions:** —  
**Backend objects:** need_geography; public opportunities  
**Permissions:** approximate public geography  
**Statuses:** LOADING; READY; NO_RESULTS; LOCATION_DENIED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** M02; W04  
**Notifications:** —  
**Edge cases:** no coordinates; overlapping pins; network loss  
**Current route/evidence:** need_geography live; PR67

## M02 — Map pin compact sheet

**Role:** BOTH\
**Purpose:** Kratak, informativan preview pre punog detalja.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL / PR67 PENDING  
**Entry points:** tap M01 pin  
**Displayed data:** title; where/when; pay/offers; people; requester summary  
**Available actions:** open full detail; dismiss  
**Primary CTA:** Detalji Zadatka  
**Secondary actions:** —  
**Backend objects:** public opportunity projection  
**Permissions:** public-safe  
**Statuses:** OPEN; STALE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** W04  
**Notifications:** —  
**Edge cases:** Need closes while sheet open  
**Current route/evidence:** —

## Q01 — Search

**Role:** BOTH\
**Purpose:** Pretraga prilika uz recent i korisne predloge.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** W03  
**Displayed data:** query; recent searches; result count  
**Available actions:** search; clear; select suggestion  
**Primary CTA:** Prikažite rezultate  
**Secondary actions:** —  
**Backend objects:** opportunity projection/search endpoint missing  
**Permissions:** authenticated  
**Statuses:** IDLE; SEARCHING; NO_RESULTS  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** W03; W04  
**Notifications:** —  
**Edge cases:** —  
**Current route/evidence:** —

## Q02 — Filters

**Role:** BOTH\
**Purpose:** Filtrira bez skrivene promene semantike: kategorija, vreme, udaljenost, cena i capability.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** W03  
**Displayed data:** active filters; result estimate  
**Available actions:** apply; reset  
**Primary CTA:** Prikažite rezultate  
**Secondary actions:** —  
**Backend objects:** worker_match_preferences; opportunity projection  
**Permissions:** authenticated  
**Statuses:** DEFAULT; DIRTY; APPLIED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** W03  
**Notifications:** —  
**Edge cases:** location denied; no matches  
**Current route/evidence:** —

## P01 — Profile hub

**Role:** BOTH  
**Purpose:** Jedan nalog sa jasnim role switch-em i ulazima u profile/settings.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** header avatar\
**Displayed data:** identity; current intent; requester/worker summaries  
**Available actions:** switch role; edit personal profile; edit worker profile; settings; logout  
**Primary CTA:** Promenite ulogu  
**Secondary actions:** —  
**Backend objects:** app_accounts; app_profiles  
**Permissions:** owner  
**Statuses:** REQUESTER; WORKER; PROFILE_INCOMPLETE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** retained active-intent zone; R03 requester Zadaci; W06 worker Prijave; W03 discovery; W08; S07\
**Notifications:** —  
**Edge cases:** role switch during request; preserve per-role tab history  
**Current route/evidence:** /profil; profil.tsx

## P02 — Personal/requester profile edit

**Role:** NARUČILAC  
**Purpose:** Uređuje prikazno ime, grad i avatar za javni requester profil.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** P01  
**Displayed data:** display name; city; avatar; bio/headline target  
**Available actions:** edit; save  
**Primary CTA:** Sačuvajte profil  
**Secondary actions:** —  
**Backend objects:** app_profiles REQUESTER  
**Permissions:** owner  
**Statuses:** DRAFT; ACTIVE  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** P01  
**Notifications:** —  
**Edge cases:** avatar upload missing  
**Current route/evidence:** /profil (limited)

## P03 — Skills, tools, licenses, vehicles

**Role:** USKOČER  
**Purpose:** Strukturisan capability editor sa jasnom razlikom self-declared/verifikovano.  
**Product canon:** PRODUCT CANON  
**Current implementation:** PARTIAL  
**Entry points:** W08  
**Displayed data:** skills; tools; licenses; vehicles; team capacity  
**Available actions:** add/remove; save  
**Primary CTA:** Sačuvajte  
**Secondary actions:** —  
**Backend objects:** app_profiles; response_application_snapshots  
**Permissions:** owner  
**Statuses:** SELF_DECLARED; VERIFIED target  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** W08  
**Notifications:** —  
**Edge cases:** capability changed after application snapshot  
**Current route/evidence:** —

## P04 — Reputation & reviews

**Role:** BOTH  
**Purpose:** Prikazuje ocene tek kada backend može dokazati prosek, broj i sadržaj.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** P01; public profile; post-completion  
**Displayed data:** rating; review count; completed count; review cards  
**Available actions:** leave review; report review  
**Primary CTA:** Ocenite saradnju  
**Secondary actions:** —  
**Backend objects:** review infrastructure missing; public projection exposes availability flags  
**Permissions:** completed participants  
**Statuses:** UNAVAILABLE; ELIGIBLE; SUBMITTED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** P01; public profile  
**Notifications:** —  
**Edge cases:** mutual privacy; duplicate review; moderation  
**Current route/evidence:** —

## P05 — Verification & trust

**Role:** BOTH  
**Purpose:** Pokazuje šta je stvarno verifikovano i šta je samo izjavljeno.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** P01; public profile  
**Displayed data:** identity state; verified items; safety guidance  
**Available actions:** start verification target  
**Primary CTA:** Verifikujte identitet  
**Secondary actions:** —  
**Backend objects:** verification provider/storage missing  
**Permissions:** owner; public sees result only  
**Statuses:** NOT_AVAILABLE; PENDING; VERIFIED; FAILED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** P01  
**Notifications:** —  
**Edge cases:** never fabricate badge  
**Current route/evidence:** —

## H01 — HITNO explanation / activation

**Role:** NARUČILAC  
**Purpose:** Objašnjava ubrzanu distribuciju bez lažne naplate ili obećanja.  
**Product canon:** PRODUCT CANON  
**Current implementation:** CONFIG-DISABLED  
**Entry points:** R02/R04 urgency choice  
**Displayed data:** window; minimum choice floor; availability; price 0 RSD if policy says  
**Available actions:** activate when admitted  
**Primary CTA:** Aktivirajte HITNO  
**Secondary actions:** —  
**Backend objects:** needs.urgent; dispatch_schedule; marketplace_config; policy bundles  
**Permissions:** Need owner + active gate  
**Statuses:** DISABLED; AVAILABLE; ACTIVE; EXPIRED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** R04  
**Notifications:** high urgency opportunity delivery  
**Edge cases:** gate closes; no eligible workers; window expiry  
**Current route/evidence:** urgency/dispatch migrations; no enabled product proof

## C01 — Calendar overview

**Role:** BOTH  
**Purpose:** Jedan pregled Dogovor obaveza; worker additionally sees availability.  
**Product canon:** PRODUCT CANON  
**Current implementation:** BACKEND PARTIAL / UI MISSING  
**Entry points:** Dogovori; avatar → Profile; W09\
**Displayed data:** Agreement schedule; availability windows/rules; conflicts  
**Available actions:** open Agreement; edit availability  
**Primary CTA:** Otvorite Dogovor  
**Secondary actions:** —  
**Backend objects:** agreements; profile_availability_*  
**Permissions:** owner/participant  
**Statuses:** DAY; WEEK; EMPTY; CONFLICT  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** D02; W09  
**Notifications:** —  
**Edge cases:** multi-party same Need; timezone; overlap  
**Current route/evidence:** —

## MEDIA01 — Need photo capture/gallery

**Role:** NARUČILAC  
**Purpose:** Dodaje 0–3 slike tokom AI razgovora ili Need edit-a i prikazuje ih na kartici/detalju.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** R02 composer; R04 edit  
**Displayed data:** thumbnails; upload progress; count  
**Available actions:** camera; library; remove; retry  
**Primary CTA:** Dodajte fotografije  
**Secondary actions:** —  
**Backend objects:** storage bucket/schema missing  
**Permissions:** camera/photos + owner  
**Statuses:** UPLOADING; READY; FAILED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** R02; R04  
**Notifications:** —  
**Edge cases:** EXIF privacy; large files; offline upload  
**Current route/evidence:** —

## VOICE01 — Voice Need input

**Role:** NARUČILAC  
**Purpose:** Govorni unos kao još jedan input u isti AI razgovor.  
**Product canon:** PRODUCT CANON  
**Current implementation:** NOT IMPLEMENTED  
**Entry points:** R02 composer  
**Displayed data:** recording state; duration; transcript review  
**Available actions:** record; stop; discard; send transcript  
**Primary CTA:** Govori  
**Secondary actions:** —  
**Backend objects:** speech/transcription service missing; same AI conversation  
**Permissions:** microphone  
**Statuses:** IDLE; RECORDING; TRANSCRIBING; READY; FAILED  
**Loading:** Skeleton bez promene rasporeda.  
**Empty:** Objasniti stanje i ponuditi sledeću korisnu radnju.  
**Validation:** Greška uz konkretno polje; unos ostaje sačuvan.  
**Error:** Jasna poruka, Retry i bez lažnog uspeha.  
**Offline:** Prikaži poslednje bezbedno stanje; komande čekaju eksplicitni retry.  
**Success:** Potvrda i jasan sledeći korak.  
**Destructive:** Navesti posledicu i tražiti potvrdu samo za nepovratnu radnju.  
**Next:** R02  
**Notifications:** —  
**Edge cases:** permission denied; background interruption; accent/noise; do not upload without consent  
**Current route/evidence:** —
