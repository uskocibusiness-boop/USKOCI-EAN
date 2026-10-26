# USKOČI — jedan semantički katalog, stvarni ID, jedan matching izvor

## Neupitni poslovni ugovor

Gemini je jedini model koji odlučuje ŠTA usluga znači i gde pripada u katalogu. 
Baza **ne pokušava** da semantički klasifikuje po sličnosti reči. Baza
proverava identitet vlasnika, reviziju, katalog, validnost izabranih ID-jeva,
dobijenu saglasnost korisnika i ograničenja rizika. To nisu paralelni klasifikatori.

Za svaku konkretno potvrđenu uslugu model daje tačno jednu odluku:

- REUSE_EXISTING(categoryId, mode): kategorija istog značenja već postoji.
- EXTEND_MODE(categoryId, mode): ista postojeća kategorija nema potvrđeni način izvršenja.
- CREATE_CHILD(parentId, label, mode): stvarno nova usluga; server generiše UUID čvora.
- NEEDS_CLARIFICATION(question): izgovorena namera je stvarno dvosmislena.

Za BOTH se čuvaju **dve** potvrđene mode veze iste kategorije, ne dve grane.
Za fizičku kupovinu sa naknadnom poštom posao je ON_SITE; način predaje je poseban.
Model nikad ne izmišlja UUID. Server vraća autoritativni categoryId u jednoj
transakciji ili čita već postojeći ID posle idempotentnog ponavljanja.

## Jedina dozvoljena putanja podataka

Korisnička poruka -> razgovorni Gemini (činjenice, samo jedno pitanje) ->
semantički Gemini (sve aktuelne usluge + važne ispravke + kompletno stablo) ->
predlog odabranih čvorova -> serverska validacija -> potpisani ljudski pregled ->
čuvanje -> transakcioni upis/korišćenje categoryId ->
worker/category/mode i need/category/mode veze -> ponovno razmatranje matching-a.

Brz, nedvosmislen postojeći ID може се преузети из каталога; то није семантички
класификатор. Нема јавног categoryId само на основу AI тврдње.

## KonkretnI prekinuti spojevi u DEV 2026-10-26

1. Gemini arhitekta za nerešene nazive nema REUSE_EXISTING/EXTEND_MODE
   u izlaznoj šemi i za zadatak i za profil.
2. Server review_candidate_projection_v2 i commit_reviewed_batch_service
   odbijaju semantički različit naziv čak kada Gemini izabere postojeći ID.
   Ispraviti **oba** u istoj koordinisanoj migraciji, bez isključivanja zaštita.
3. Klassifikator ponekad vrati prekinut JSON ili istekne 9s (1024 output tokena).
   Meriti finishReason i latenciju; Gemini 3.8 Flash low thinking, dovoljan
   output prostor i ograničeni retry; ne označavati grešku kao dvosmislenost.
4. Post-save tick samo obrađuje postojeći ispravan classificationCandidates.
   Kada nedostaje, nema trajnog posla koji ponovo klasifikuje; dodati
   deduplikovanu klasifikacionu obradu vezanu za tačan sačuvani digest/reviziju.
5. Novi profil ne sme sam da izmisli ON_SITE kada je stvarna opcija nepoznata,
   niti da izgubi oba eksplicitno ponuđena načina.
6. Nikad ne dodeljivati radniku uslugu samo zato što je AI naveo kategoriju:
   traži se potvrđeni identitet ponuđene usluge i način rada.

## Neophodni regresioni slučajevi

- 'Kupovina karata za koncert' sa prethodnim širim 'Kupovina i dostava'
  mora reuse ID 'Kupovina karata', bez stvaranja duplikata.
- 'Držim časove šaha uživo i onlajn' vezuje jedan categoryId + dva mode zapisa.
- Radnik 'Podučavanje šaha' i zadatak 'Časovi šaha' mapiraju se na isti ID.
- 'Radim klime' pita jedno pitanje; ne praviti podrazumevanu granu.
- Potpuno nova usluga dobija jedinstven ID i isti ID je dostupan za oba tipa veze.
- Gemini prekid -> persistirano stanje i kontrolisano ponovno pokretanje.
- Stari AI rezultat posle izmene veština/zadatka ne sme se primeniti.
- Ne prikazivati uspešan matching, notifikaciju ili objavu ako nema potvrđenih prava.
- TEST, TypeScript, Deno, SQL rollback i integracioni testovi pre DEV deploy-a.

## Bezbedan redosled

Osnova: test/uskoci-ai-live-smoke-and-taxonomy-recovery-20261026, čiji glavni
Edge fajlovi odgovaraju aktivnim DEV v151 i v104. Ne deploy-ovati trunk na slepo.
Prvo ugraditi ugovor i testove, zatim uskladiti SQL projection/commit/bind,
zatim trajni retry, onda proveriti E2E i tek onda deploy-ovati DEV.
