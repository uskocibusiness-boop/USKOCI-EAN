# Tri objedinjena vizuelna kruga — 10.10.2026.

Status: **izvor i ciljane provere završeni; zajednički APK/native pregled čeka**. V1 ostaje **NO-GO**. Ovo je dopuna postojećeg plana, ne novi master.

Vlasnik je tražio nekoliko većih krugova, jasne radne kartice, AI podešavanje, mirne bele površine, filtere prema svojim Airbnb referencama, identitet uz poruke i manje ručnih/duplih kontrola. Root je jedini pisac; tri stručna agenta dala su nezavisne read-only preglede.

## Šta je smetalo i šta je promenjeno

| Krug | Pre | Posle | Korist / granica |
|---|---|---|---|
| 1 — radni profil | Novi profil prikazuje uvod i nastavlja u dugačak ručni formular. DRAFT otvara uređivač i više komandi. | Prvi čist ulaz ima AI uvod; sačuvan DRAFT čitljivu radnu karticu i jednu komandu Nastavi kroz razgovor. | Jasniji početak; zadržani prljavi unos i nepoznati ishod upisa ne nestaju. |
| 1 — čuvanje | Veliki switch aktivacije dominira pregledom. | Postojeći pristupačni izbori Aktivan profil / Nacrt, kontrolisani istim pripremljenim stanjem. | Korisnik bira posledicu čuvanja; nema automatske aktivacije. |
| 2 — filteri | Sve grupe u jednom neprozirnom panelu. | Odvojene bele izdignute sekcije na zajedničkoj zamućenoj pozadini; jedna otvorena, ostale prikazuju sažetak. | Manje vizuelne gužve; pretraga, broj rezultata i primena ostaju pod istim serverskim autoritetom. |
| 3 — razgovori | Inicijali uz poruke čak i kada postoji dozvoljena slika; privatne mete odvojene od ljudi. | Postojeći autorizovani čitači slike uz ime pošiljaoca; Privatno neposredno uz dozvoljenog učesnika. | Učesnik privatno samo naručiocu; naručilac svojim pojedinačnim Dogovorima. Nepoznat pošiljalac ostaje na fallback-u. |
| 3 — pregled zadatka | Fotografija sa greškom nema ponuđen postojeći retry; brisanje nema namensku ilustraciju. | Vraćen zaštićen retry i trash ikona uz postojeću potvrdu brisanja. | Bez automatskog ponavljanja upisa, brisanja ili upload-a. |
| 3 — kalendar | Termin blizu ponoći može postati prenizak blok. | Termin koji nema 48dp prostora dobija čitljiv red; kasni dan se otvara na tom redu. | Vreme ostaje stvarno; svaka stavka tačno jednom. Popravljena i ponovna upotreba skrol-offseta između dana. |

## DOKAZANO

- TypeScript exit 0. Petnaest relevantnih test grupa: **475/475 PASS, bez preskočenih**. Posle poslednje korekcije senke/inseta ponovljeno 70 filter testova: PASS, ne sabirati kao dodatnih 70 jedinstvenih testova.
- Sačuvani testovi recovery-ja, suspension/account/focus ograda, aktivacije, disabled i ponovnog izbora, privatnih meta, server preview/cancel filtera, retry fotografije i kalendara. Novi retained-screen slučaj proverava kasni → normalni → kasni dan sa zakasnelim layout merenjem.
- Nezavisni pregledi našli su i ispravili tri konkretna problema: zaostali kalendarski offset, dugačke privatne oznake i nasleđenu senku celog transparentnog okvira. Kratke vidljive oznake zadržavaju puno pristupačno ime.
- Nema promene dependencies, native konfiguracije, backend-a, sertifikata, pravnih tekstova ili podataka. Source hash i hash privatnih test logova su u `source-checks.json`. Prethodni neuspešni test rezultati ostaju sačuvani kao istorija.

## NIJE DOKAZANO

- Izgled i ponašanje ovog paketa na telefonu, širina kalendara i povećani font, TalkBack, broj photo zahteva u dugom razgovoru, nova APK runtime verzija i potpuni povezani tok. Prolaz testova nije dokaz ovih stavki.
- Potpuno AI-only uređivanje profila: legacy ručni paneli i biography deeplink nisu uklonjeni. Kandidatska mapa mora da menja revisioned AI predlog; ne sme prečicom upisivati live profil.
- Email šablon/redirect/SMTP nisu primenjeni; stvarna potvrda emaila ostaje otvorena. Raniji auth CI retry se vodi u svom izveštaju.
- Nisu rešeni numerički budžet kroz PAGE/MAP/PLACES, brži ponovni GPS fix, kompletan two-account media/QA/finish/cancel tok, prirodni opportunity push, privacy/deletion/performance i store paket.

## FREEZE za ovaj krug

Ne prepravljati bez konkretne regresije: bela FULL lista, kapsule/scroll, stabilna kartica pri promeni pina, prazno→prazno bez treperenja, backend autorizacija, sačuvane činjenice i suspension/recovery, stvarne cene i broj ljudi. Postojeći dokazi za njih ostaju vezani za svoje stare APK verzije.

## SLEDEĆE

1. Objaviti ovaj provereni paket na obe kanonske grane i proveriti tačan CI; jedan zajednički QA APK sa istim potpisom.
2. Install-r i ograničen native prolaz samo u slobodnom prozoru telefona: filters/range/Back, radna kartica/AI ulaz, razgovor/identitet, kalendar. Ne dirati aktivnu vlasnikovu upotrebu.
3. Najmanji naredni poslovni paket: revisioned AI mapa područja rada i normalni AI ulazi umesto ručnih, uz očuvan stari pending/dirty recovery i dozvoljenu ručnu dostupnost.
4. Povezani lifecycle/two-account testovi, preostali sigurnosni i release blokatori; postojeći jedini registar ostaje autoritet. Automatizacija 30min ostaje PAUSED. Nema tvrdnje o udaljenoj objavi Claude table.

## Integrisani CI — prvi ishod i korekcija test putanje

Izvor aplikacije `63366e0fb231071d9bcc5a2d8f252aec4682e6ab` objavljen na obe kanonske grane. R20 run **38027742416 FAIL**: TypeScript PASS, fokusirani Discovery 222 PASS / 5 FAIL, puna regresija SKIPPED. Pet testova pokušalo je da direktno pritisne opciju sada zatvorene sekcije. Testovi sada izvode vidljivu korisničku radnju otvaranja sekcije, pa zadržavaju sve tvrdnje o broju rezultata, primeni/otkazivanju nacrta, kapsulama i account-scoped skorašnjoj pretrazi. Lokalni integrisani suite: **227/227 PASS**; dodate su i tvrdnje da je samo jedna sekcija proširena. Nezavisni pregled potvrdio je svih pet mesta. Ovo nije promena aplikacije da bi test prošao. Novi full CI se beleži po stvarnom ishodu.

Otvoren performance detalj: `ProfilePhoto` za tuđu fotografiju trenutno čita pri svakom montiranju; nova slika po nizu poruka povećava broj takvih čitanja. Nema potvrde brzine dugog razgovora. Sledeća ciljana optimizacija mora objediniti čitanja unutar iste autorizovane posete, uz brisanje na blur/background/account promenu; ne uvoditi trajni cache tuđih fotografija bez zaštita. To ostaje razlog da se ovaj paket ne naziva proizvodno spremnim.
