# Fotografije i pitanja — završni paket 10.10.2026.

## URADIO

- Izbor fotografija u AI zadatku ostaje na postojećem višestrukom picker-u, sa prikazom, uklanjanjem i oporavkom. Pregled više ne može da prekine nezavršenu seriju i odbaci ostatak izbora. Završna kartica ostaje vidljiva; privremeni razlog za čekanje ne potiskuje bezbednosnu poruku. Poseban ekran fotografija ima eksplicitno **Gotovo**, uz sinhronu zaštitu od starog/dvostrukog klika.
- Fotografija za privatnu prepisku dobija prikaz iz memorije odmah po trajnom upisu identiteta slanja. Privremena slika nije potvrđen prilog: slanje poruke čeka READY odgovor. Napredak se briše nakon uspeha, a neizvestan ishod čuva oporavak. Bajtovi ne prelaze u trajni journal.
- Fotografije poslate privatnom prepiskom otvaraju zajednički pregled preko celog ekrana, na dodirnutoj slici. Prenose se tačni agreement/message identiteti. Promena konteksta, fotografija ili lokalnog potvrđenog message ID-a zatvara pregled. Prepiska iza pregleda ne dobija potvrdu čitanja. Dugi pritisak za podršku prosleđen je stvarnom unutrašnjem image dugmetu uz iste authorization/focus provere.
- Pitanja/odgovori su već postojali na zadatku. Ispravljeni su odbačen questionId i nedostajuća izmena 1–3 već odgovorenih pitanja. Vlasnik otvara baš izabrano pitanje; obnovljeno slanje ima prednost. Nema automatskog odgovaranja. Javna prazna sekcija pošteno kaže da još nema objavljenih odgovora. Pending pitanja ostaju nejavna.

## DOKAZAO

19 jedinstvenih ciljanih suite-ova / 602 testa PASS, bez FAIL/SKIP, uključujući naknadnu proveru dugog pritiska. Ponovljena dva suite-a nisu sabirana dvaput. Sirovi rezultati ostaju lokalni; hash-evi su u receipt.json. Pokriveni su odloženi zahtevi, zadržani handleri, neizvestan batch, account/focus promene, oporavak pitanja, odgovori starog revision-a, privatni viewer/read-ack i postojeći UI ratchets. TypeScript posle završne long-press izmene PASS (exit 0). Read-only agenti su pregledali tri oblasti, root jedini pisac. Njihovi konkretni nalazi (safety note, unknown copy, retry tokom slanja, unutrašnji long-press) su ispravljeni.

Prethodni CI: [puna regresija 7f1f5408](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37996116134) SUCCESS; [APK 5ed01f6e](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37994636884) SUCCESS. To nisu dokazi novog media paketa ili njegove instalacije.

## NIJE DOKAZANO

Nova puna udaljena regresija, novi APK i native foto put, mrežni prekid pri pravom Storage upload-u, stvarno javno odgovaranje na zadatak drugog naloga. Nije menjana baza, RPC, RLS, Storage/retention autoritet, push red ili produkcija. Privatne fotografije nisu uključene u grupnu prepisku: postojeći grupni text-only ugovor ostaje. UI i unit testovi ne dokazuju serverski kapacitet ili završen store paket. Postojeći NO-GO i pauzirana 30-minutna automatizacija ostaju.

## SLEDEĆE

Jedan objedinjeni Android kandidat sa prethodnim header/camera/permission i ovim media/QA izmenama: tačan build/potpis, install-r samo na slobodnom odobrenom telefonu, foto izbor/pregled/uklanjanje i pitanja, pa dopuna istog registra. Zatim postojeći završni paket AI-only radnog profila i povezani tok dva naloga; legal/privacy/performance/production/store kriterijumi ostaju zasebni. Bez novog paralelnog plana.
