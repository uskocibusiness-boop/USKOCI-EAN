# Fotografije i pitanja — završni paket 10.10.2026.

## URADIO

- Izbor fotografija u AI zadatku ostaje na postojećem višestrukom picker-u, sa prikazom, uklanjanjem i oporavkom. Pregled više ne može da prekine nezavršenu seriju i odbaci ostatak izbora. Završna kartica ostaje vidljiva; privremeni razlog za čekanje ne potiskuje bezbednosnu poruku. Poseban ekran fotografija ima eksplicitno **Gotovo**, uz sinhronu zaštitu od starog/dvostrukog klika.
- Fotografija za privatnu prepisku dobija prikaz iz memorije odmah po trajnom upisu identiteta slanja. Privremena slika nije potvrđen prilog: slanje poruke čeka READY odgovor. Napredak se briše nakon uspeha, a neizvestan ishod čuva oporavak. Bajtovi ne prelaze u trajni journal.
- Fotografije poslate privatnom prepiskom otvaraju zajednički pregled preko celog ekrana, na dodirnutoj slici. Prenose se tačni agreement/message identiteti. Promena konteksta, fotografija ili lokalnog potvrđenog message ID-a zatvara pregled. Prepiska iza pregleda ne dobija potvrdu čitanja. Dugi pritisak za podršku prosleđen je stvarnom unutrašnjem image dugmetu uz iste authorization/focus provere.
- Pitanja/odgovori su već postojali na zadatku. Ispravljeni su odbačen questionId i nedostajuća izmena 1–3 već odgovorenih pitanja. Vlasnik otvara baš izabrano pitanje; obnovljeno slanje ima prednost. Nema automatskog odgovaranja. Javna prazna sekcija pošteno kaže da još nema objavljenih odgovora. Pending pitanja ostaju nejavna.

## DOKAZAO

19 jedinstvenih ciljanih suite-ova / 602 testa PASS, bez FAIL/SKIP, uključujući naknadnu proveru dugog pritiska. Ponovljena dva suite-a nisu sabirana dvaput. Sirovi rezultati ostaju lokalni; hash-evi su u receipt.json. Pokriveni su odloženi zahtevi, zadržani handleri, neizvestan batch, account/focus promene, oporavak pitanja, odgovori starog revision-a, privatni viewer/read-ack i postojeći UI ratchets. TypeScript posle završne long-press izmene PASS (exit 0). Read-only agenti su pregledali tri oblasti, root jedini pisac. Njihovi konkretni nalazi (safety note, unknown copy, retry tokom slanja, unutrašnji long-press) su ispravljeni.

Tačan izvor600efd10: [puna regresija](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37997937008) SUCCESS605suite/13603testa/6snapshot; PRE-P4 obe grane138suite/4022testa/3snapshot; P5 fokus4/225 i puna regresija PASS. CodeQL PASS samoJS/TS/Python/Actions, nemaJava/Kotlin. PRE-P4 migration/devet domain-proof jobova scope-skipped nisu novi DB dokaz. Receipt čuva tačne run ID-eve.

Lokalni arm64 QA APK600efd10 potvrđen po izvornim5961fajlovima, SHA256 `cc4117026822a556865ff12ad9e8a75f4a776d6cf1112630ee140dd86bb10fdf` i prethodnom potpisu. Instaliran `adb install -r` na slobodnom HONOR-u po novom owner handoff-u: isti UID/prvi install i sačuvana prijava. Runtime About pokazuje600efd1. Postojeći AI nacrt i njegove3fotografije očuvani: Galerija otvara ograničeni Android PhotoPicker, cancel vraća iste3slike, fullscreen otvara prvu, Next pokazuje2/3, Back vraća isti nacrt. Privatni screenshot/XML sadržaj nije javno objavljen, samo hash-evi u receipt-u. GPS nije menjan.

## NIJE DOKAZANO

Novi izbor/upload/uklanjanje fotografije, mrežni prekid pri pravom Storage upload-u, slanje u privatnom četu dva naloga, stvarno javno odgovaranje na zadatak drugog naloga. APK je lokalni inkrementalni QA build sa zadržanim native cache-om i bez lintVitalAnalyzeRelease, nije CI/store paket. Nije menjana baza, RPC, RLS, Storage/retention autoritet, push red ili produkcija. Privatne fotografije nisu uključene u grupnu prepisku: postojeći grupni text-only ugovor ostaje. UI i unit testovi ne dokazuju serverski kapacitet ili završen store paket. Postojeći NO-GO i pauzirana30-minutna automatizacija ostaju.

## SLEDEĆE

Preostali odobreni sintetički foto izbor/upload/uklanjanje i pitanja/privatni čet dva naloga na tačnom APK-u. Zatim postojeći završni paket AI-only radnog profila; legal/privacy/performance/production/store kriterijumi ostaju zasebni. Owner-ov najnoviji email zahtev ima zaseban dokaz u signup-email-return-20261010, istim redovimaN01–N03 registra. Bez novog paralelnog plana.
