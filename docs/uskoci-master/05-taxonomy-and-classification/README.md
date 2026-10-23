# 05 — Taxonomy & Classification System

## 1. Kako funkcioniše dinamička taksonomija u USKOČI

Taksonomija u USKOČI nije statična lista od 10 opštih kategorija, već **živo, hijerarhijsko stablo konkretnih usluga** (`private.work_taxonomy_categories`) u kome svaki čvor ima:
- Jedinstveni `id` (UUID),
- Roditelja `parent_id` (organizacioni čvor ili koren),
- Kanonski naziv na srpskom `label_sr` i normalizovani ključ `normalized_label` (`private.taxonomy_normalize_v1`),
- Registrovane sinonime/alijase u `private.work_taxonomy_aliases`,
- Dozvoljene načine izvršenja u `private.work_taxonomy_category_modes` (`ON_SITE`, `REMOTE`).

---

## 2. Četiri kanonske akcije klasifikacije

| Akcija | Kada se koristi | Šta radi pri potvrdi (`uskoci-taxonomy-postsave-worker`) |
|---|---|---|
| **`REUSE_EXISTING`** | Usluga već postoji u `work_taxonomy_categories` (po nazivu ili registrovanom alijasu) i već ima potvrđen traženi način rada (`ON_SITE` ili `REMOTE`). | Direktno povezuje zadatak (`needs.category_id`) ili radnika (`taxonomy_confirmed_worker_modes_v1`) sa postojećim `categoryId`. Ne menja `catalog_version`. |
| **`EXTEND_MODE`** | Konkretna usluga već postoji u katalogu (npr. *Popravka mehaničkih pisaćih mašina* ili *Poliranje dragog kamenja* postoji kao `ON_SITE`), ali korisnik traži ili nudi izvršenje na drugi legitiman način (`REMOTE` uz slanje kurirom). | Zadržava **isti `categoryId`** (sprečava duplikate!), upisuje novi `execution_scope` u `work_taxonomy_category_modes` i inkrementira `catalog_version`. |
| **`CREATE_CHILD`** | Nova, legitimna vrsta posla koja još ne postoji u katalogu, ali pripada postojećoj grani (npr. pod *Zanatstvo i popravke* ili *Kreativne i digitalne usluge*). | Kreira novi čvor (ili putanju čvorova `proposedPath`) pod izabranim `parentId`, dodeljuje mu traženi `execution_scope` i inkrementira `catalog_version`. Organizacioni roditelj ne mora da ima isti `execution_scope` kao dete (`20261019104047`). |
| **`CREATE_NEW_BRANCH`** | Potpuno nova oblast rada koja nema odgovarajućeg korenskog roditelja u postojećem stablu. | Kreira novu korensku granu (`parent_id = NULL`) i podčvorove iz `proposedPath`, uz inkrementiranje `catalog_version`. |

---

## 3. Pravila kvaliteta i sprečavanje zagađenja kataloga

1. **Zabrana generičkih „kontejner" naziva (`FORBIDDEN_GENERIC_LABELS`):**
   - Katalog i `classificationEngine.mjs` odbijaju nazive kao što su `Razno`, `Ostalo`, `Opšte usluge`, `Posao`, `Pomoć`, `Usluga`. Svaki čvor mora označavati konkretnu vrstu posla.
2. **Stroga srpska latinica sa dijakriticima:**
   - Svi kanonski nazivi čuvaju se sa ispravnim slovima (`č, ć, ž, š, đ`), dok funkcija normalizacije (`private.taxonomy_normalize_v1` i `normalizedClassificationIdentity`) izjednačava ćirilicu, latinicu i ošišanu latinicu pri pretrazi kako nikada ne bi nastale dve kategorije za isti pojam.
3. **Bezbednosni filter (`private.taxonomy_risk_triage_v1`):**
   - Automatsko dodavanje u katalog dozvoljeno je samo za `LOW_RISK_CANDIDATE`. Nezakonite, opasne ili nejasne usluge se nikada ne upisuju u katalog.
4. **Nikada pre ljudske potvrde:**
   - Tokom AI razgovora predlozi žive isključivo u `private.work_taxonomy_gemini_turn_hints_v1` (`authority = 'NONE'`). Tek kada korisnik u Pregledu klikne **„Objavi zadatak"** ili **„Sačuvaj profil"**, potpisani pregled ulazi u `private.work_taxonomy_postsave_outbox_v1` i vrši stvarni upis i povezivanje (`bind`).
