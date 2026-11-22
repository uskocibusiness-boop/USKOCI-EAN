# DEV prenos 22.11.2026 — vlasnik odbija prijavu (prevlačenje ulevo)

Projekat: `leqcwgzvjsxugfgzdmth` (DEV). PROD nije diran. Izdanje: NO-GO.

| Verzija | Naziv | Ledger md5 | Postimage |
|---|---|---|---|
| 20261122162908 | decline_response_for_task_owner | e26678bbe72e42fb0f237e763dd99fe0 | public.rpc_decline_response prosrc c05689a674079237b35b8ebc3e386374, ACL authenticated+service_role (bez anon); tabela private.response_decline_commands (RLS, bez prava klijentima) |

- Odluka vlasnika 22.11.2026 (novi ekran Dogovora): prevlačenje udesno prihvata kroz postojeći izbor; ulevo odbija i prijava nestaje.
- Obrazac rpc_withdraw_response: idempotentni zahtev, redosled zaključavanja Need -> Response, vezivanje revizije i verzije, istek obaveštenja na čekanju, događaj RESPONSE_NOT_SELECTED radniku, audit. Cena, Dogovor i kapacitet se ne menjaju.
- Probni prolaz (ROLLBACK) sa stvarnim vlasnikom na DEV-u: status NOT_SELECTED, događaj upisan, ponovljeni zahtev = idempotentReplay, tuđi nalog odbijen; zatim rollback skripta u istoj transakciji. DEV posle probe nepromenjen (readback). Ledger posle primene: 387.
- Rollback: `scripts/sql/rollback_decline_response_20261122.sql`.
