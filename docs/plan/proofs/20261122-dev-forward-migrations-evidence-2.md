# DEV prenos 22.11.2026 — prijava bez kontakata

Projekat: `leqcwgzvjsxugfgzdmth` (DEV). PROD nije diran. Izdanje: NO-GO.

| Verzija | Naziv | Ledger md5 | Postimage (md5 prosrc) |
|---|---|---|---|
| 20261122105256 | application_note_without_contacts | c10dc54542c12a8a7bc1127ed3cf6284 | rpc_submit_response 37371ad30f802d6b69a8f25fc33f77a7, private.text_has_contact_v1 f71ffbd4ceec715932de039a7ea429b2 |

- Odluka vlasnika: poruka uz prijavu ne sme da sadrži telefon, mejl, link ili nalog; kontakti se razmenjuju posle Dogovora. Prepoznavanje oblika (8+ cifara koje nisu datum, mejl, link, @nalog), bez liste reči.
- Preimage rpc_submit_response dc49b5ad5382f5877644b4b6cddcc119 proveren; izmena je jedno umetanje posle provere INVALID_CLIENT_REQUEST_ID, postimage = md5 tačne zamene.
- Probni prolaz (ROLLBACK) i probni prolaz izmena+rollback u istoj transakciji prošli; zatim primena preko `supabase db query --linked -f` sa upisom u ledger iz istog fajla.
- Readback: telefon → TRUE, „Dolazim 1.12. u 9h, 4.500 dinara“ → FALSE. Ledger posle primene: 385.
- Rollback: `scripts/sql/rollback_application_note_contact_preimage_20261122.sql`.
