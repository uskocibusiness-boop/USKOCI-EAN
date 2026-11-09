# AI payload i putanja poziva — 09.11.2026

Source: `2d8ada07cc4e10616cc9c15619b9d87319cd0479`. Read-only izvršenje stvarnih builder-a i završnog `geminiRequestBody` adaptera, bez mreže ili plaćenih poziva. Fixture ima **5 čvorova**, šest prethodnih poruka, uključen application-deadline flag i nema slike/geokodiranja. Ovo nije merenje punog DEV kataloga, modelskih tokena ili odziva.

| HTTP JSON body | UTF-8 bajtovi |
|---|---:|
| Need sa katalogom | 23.694 |
| Need nastavak, kategorija poznata | 21.134 |
| Worker sa katalogom | 27.320 |

Glavna instrukcija Need/Worker iznosi 15.578/15.270 bajtova; izlazna šema 2.793/5.355 bajtova. Broj bajtova nije broj tokena. Zanatska matrica i primeri (15.994 bajta) nisu u aktivnom payload-u: njihov builder pripada neaktivnom explicit-cache putu. `getOrCreateGeminiContextCache` vraća `null`. Jednočasovni RAM keš kataloga smanjuje čitanja baze; provider cache/token ušteda nije potvrđena.

Normalan uspešan tekstualni potez, bez geokodiranja/replay-a/greške, koristi **jedan Gemini poziv**. Need: Auth HTTP, conversation SELECT, claim RPC sa kontekstom, budget RPC, dispatch RPC, katalog 0/1 RPC, model, completion RPC, asinhroni usage RPC. Worker: Auth HTTP, claim RPC, context RPC, katalog 0/1 RPC, budget RPC, dispatch RPC, model, completion RPC, asinhroni usage RPC. Ukupno oba imaju 7/8 Supabase HTTP poziva za topao/hladan uspešan snapshot; snapshot fallback može dodati paginirane pozive. Recovery completion-a ne ponavlja model.

Istorija je ograničena na 30 poruka × 4.000 karaktera. Need trenutnu poruku dodaje posebno; Worker je već dobija u kontekstu. To su gornje granice, ne izmerena veličina svakog razgovora.

## Aktuelni DEV katalog

Read-only SELECT je ponovio kompletan tree/modes/aliases izbor iz pročitane žive funkcije `public.rpc_taxonomy_fetch_snapshot_v1(integer)`, bez menjanja Auth claims-a ili podataka. Na projektu `leqcwgzvjsxugfgzdmth` dobijeno je **56 prihvatljivih čvorova**, verzija 17. Ovo je izbor koji RPC izlaže modelu, ne tvrdnja o ukupnom broju svih redova u taksonomiji. Stvarna source funkcija `formatFullCatalogHierarchy` formatirala je ceo rezultat u **5.904 karaktera / 6.114 UTF-8 bajtova / 56 linija**. Staru pretpostavku „153 čvora / 27KB“ ne koristiti kao merenje sadašnjeg DEV-a. Ovo proverava SQL izbor i formatter; ne predstavlja Auth/HTTP poziv snapshot RPC-ja niti stvarni provider payload konkretnog korisnika.

Moguće kasnije skraćenje redundantnog Need ROLE BOUNDARY pasusa štedi 397 bajtova (1,68% ovog fixture zahteva). Nije primenjeno: nema dokaza značajnog ubrzanja i ne opravdava prekid već proverenog telefonskog build-a. Stvarno razumevanje, prirodnost i brzina ostaju Android/model prihvat.
