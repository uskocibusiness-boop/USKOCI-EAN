# TRV01 — potpisani pregled prati uslove stvarnog upisa

DEV migracija `20261021103954_task_review_writer_readiness` je primenjena sa tačnim prethodnim definicijama i atomskom rollback probom. Oba pripremna RPC-a sada navode u `missingRequired`: predaju za REMOTE, iznos za MY_PRICE i početak/ispravne granice za FIXED_WINDOW. Nisu uvedeni novi poslovni uslovi: iste uslove je već zahtevao pisac nacrta.

Stari neusklađeni keširani pregled više se ne vraća kao prihvatljiv. Istorijski potpisani redovi se ne menjaju; novi dokument dobija digest tek posle računanja nedostajućih odgovora. Klijentska odbrana ostaje zbog starih pregleda.

Dokaz: `supabase/candidates/task-review-readiness-20261021/proof.sql` poziva oba stvarna RPC-a pod authenticated ulogom: REMOTE bez predaje, MY_PRICE bez iznosa, FIXED_WINDOW bez početka; validan pregled se ponovo dobija bez novog ID-a. Digest se proverava iz sačuvane politike. Svi sintetički podaci se vraćaju u podtransakciji. SQL test nije Gemini, signed HTTP ni telefonska proba.

Regresija LIFE01 u `supabase/candidates/lifecycle-regression-20261021/proof.rollback.sql`: stvaran izbor zamene 3/3→2/3→3/3, prijava problema/replay, bilateralni predlog i prihvatanje izmene, zabrana sopstvenog prihvatanja, označavanje i potvrda završetka/replay, obe ocene/replay i zabrana ocene pre završetka. Izvršeno na DEV-u, PASS; sve vraćeno rollback-om. Početni zadatak/izbori su sintetički. Ovo ne dokazuje grupnu saglasnost svih izvršilaca ili paralelne transakcije.
