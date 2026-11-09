# USKOČI — obavezna uputstva za Codex i agente (09.11.2026)

## POVUCENI UX MASTER — zabrana upotrebe
Vlasnik je izricito POVUKAO `docs/product/USKOCI_PRODUCT_UX_MASTER.md` kao zastareo i los. Fajl je uklonjen iz aktivne grane. **Ne citati, ne otvarati, ne rekonstruisati, ne citirati i ne vracati** ga iz Git istorije, drugih grana, lokalnog cache-a ili ranijih razgovora. Ne praviti novi UX master bez nove vlasnicke odluke. Sve istorijske reference u `docs/plan/CODEX_PLAN_RADA.md` na njega i stare A–J/S01–S18 zahteve nisu validan osnov za UX izmene.

## Stvarni izvori autoriteta
- Poslednje eksplicitne vlasnicke odluke: sta proizvod TREBA da bude, kako izgleda i radi.
- Aktuelni izvorni kod, testovi i server ugovori: sta danas zaista postoji. Nisu sami po sebi saglasnost za novi dizajn.
- `docs/plan/CODEX_PLAN_RADA.md`: tehnicki plan, evidencija i istorija, nije obavezujuci UX master.
- Analiza i predlog za UI nisu dozvola za implementaciju. Pre promene rasporeda, kartica, copy-ja ili ikonica objasniti pre/posle i pribaviti izricitu potvrdu vlasnika. Cuva se ono sto je dobro i vec ispravljeno.

## Potvrdjene odluke vlasnika koje sacuvati
- Pocetna MORA da ima zeljene horizontalne karusele (listaju se levo-desno). Njihovo uklanjanje u QA93 NIJE odobrena UX odluka i ne sme se smatrati pravilom. Uz sledece odobreno UI izvrsavanje vratiti ih pazljivo, bez slepog rollbacka drugih ispravki.
- Primarne akcije: **"Objavite zadatak"** i **"Uskocite i zaradite"**.
- Slogan: **"USKOČI — Vaš partner za svaki zadatak."** Ideja **"MENI TREBA. JA MOGU."** ne daje pravo na samovoljnu izmenu natpisa dugmadi.
- Navigacija: Pocetna, Zadaci, Dogovori, Poruke; Profil preko avatara, bez taba Profil.
- Jedan nalog, jedna zajednicka reputacija; predlog AI nije objava ili potvrda.
- Cene/jedinice i satnica po osobi ne menjaju se bez potvrde. Lokacija pre Dogovora je priblizna, posle tacna samo za ucesnike; REMOTE bez obavezne adrese, prevoz A→B cuva obe tacke.
- Prvo izdanje Srbija, besplatno svima, bez monetizacije platforme; pravni status nije automatski odobren.

## Bezbedan nastavak rada
- Ne pokretati nova masovna placena AI testiranja, ne resetovati AI budzete, ne menjati produkciju ili tajne bez izricitog odobrenja.
- Za UX: prvo pregled svih relevantnih ekrana i objasnjenje sta zadrzati, spojiti ili ukloniti; samo odobrene izmene se primenjuju.
- Za funkcionalni rad: uraditi minimalni potreban zahvat, regresione testove i stvaran readback. Zeleni CI nije dokaz vizuelnog Android, FCM ili 2-korisnickog E2E testa.
- Ne ponavljati stare neuspesne dizajnerske promene pod izgovorom "usaglasavanja sa masterom".

Ovo je pravilo za zastitu proizvoda; nije novi UX master.
