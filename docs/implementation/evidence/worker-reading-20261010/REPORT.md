# Radna kartica i izbor aktivacije — 10.10.2026.

## URADIO

Sačuvana ACTIVE/SUSPENDED kartica prikazuje ceo opis i dostupne veštine, alat i vozila. Duge liste i opis otvaraju se u mestu preko „Prikaži sve“, bez pisanja i bez otvaranja formulara. Naslov „Tvoj radni profil“ ne obećava javnu vidljivost neaktivnog profila; jasno dugme „Uredi kroz razgovor“ vodi na postojeći AI tok. Postojeće ime, avatar, ocene, informacije o opremi, mapa i raspored nisu zamenjeni novim sistemom.

Izbor aktivacije iz potvrđenog AI pregleda ostaje vezan za razgovor: false se čuva posle Back, izmene predloga i sledeće AI poruke. Novi razgovor ne nasleđuje tuđ izbor. Sačuvaj i dalje koristi konkretan frozen review, digest i postojeći idempotency put.

SUSPENDED više ne otvara AI, ručne poslovne izmene, područje ili promenu dostupnosti; to važi i za callback učitan dok je profil bio ACTIVE. Sinhronizacija imena i novi save takođe čekaju prestanak suspenzije. Ako suspenzija stigne tokom starog ručnog unosa, kartica prikazuje kanonski sačuvane podatke, lokalni unos ostaje zadržan, a pending ishod se čita bez novog upisa. Podrška je dostupna bez nemogućeg zahteva da se prvo sačuva suspendovan profil; nerešen prethodni upis zadržava svoju zasebnu zaštitu.

## DOKAZAO

16 jedinstvenih testnih grupa / 439 testova PASS, bez skip/fail, prema poslednjem rezultatu svake grupe; TypeScript exit0. Provereni su stvarni route handleri, prikaz, proširivanje, povratak u AI pregled, promena razgovora, suspenzija tokom unosa i readback-a, sačuvan draft, podrška, dostupnost, mapa, AI klijent/journal i pet UI pravila. Receipt čuva hash tri sirova rezultata; ponovljeni testovi nisu sabrani dvaput.

Read-only stručni pregled otkrio je preostale ulaze za promenu imena i otvorenog ručnog unosa posle suspenzije, pa nemoguć uslov čuvanja pre podrške. Ispravke imaju regresione testove. Završni ograničeni read-only pregled nema preostalog nalaza. Root je jedini pisac.

## NIJE DOKAZANO

Ovo NIJE završen AI-only worker tok. DRAFT/prazan profil i biografski deep link još imaju stari ručni obrazac; AI razgovor još nudi ručne poslovne panele. Oni se ne uklanjaju bez premeštanja potvrđene mape u AI predlog. Guard testovi starog editora ostaju na komponentnoj granici, dok testovi kartice posebno dokazuju stvarno dostupne UI radnje.

Nema nove native instalacije, screenshot prihvatanja ili stvarnog AI poziva za ovaj patch. Instalirani600efd10 ne sadrži ga. Nema server, provider, privatnost ili sertifikat promene. Prezentacioni test nije dokaz premium kvaliteta na uređaju ili produkcijske spremnosti; NO-GO i PAUSED ostaju.

## SLEDEĆE

Nastaviti isti B00/B01 paket: DRAFT kao sačuvana kartica; AI kao jedini poslovni editor; izbor približne tačke kao kandidat unutar razgovora, bez upisa live lokacije uz otvoren predlog; ručni kalendar ostaje. Sačuvati journal, revision/expiry, name/readback, Back i privacy zaštite. Zatim jedan objedinjeni APK i stvarni create/edit/save/reopen put. Ne širiti redizajn niti novi plan.
