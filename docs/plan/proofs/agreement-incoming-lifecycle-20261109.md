# Dogovor — prekid petlje osvežavanja, 09.11.2026

Na stvarnom emulatoru/APK `36dd3bee92160379d1caed89b5c09543b1f9f432` običan izbor i jedna poruka uspeli su i imaju DEV readback. Posle povratka kroz Dogovori listu Pregled je ostajao „Osvežavamo…“, a meni je držao radnje zaključanim. To je sačuvano u [native dokazu](agreement-owner-native-20261109.json), uključujući vremena i hash-eve slika. Nije proglašen potpun E2E uspeh.

`src/app/dogovor/[id].tsx` je imao dva `useAgreementIncomingRefresh` vlasnika. Drugi je pratio `enabled`, izveden iz `!workspace.loading`. Stvarni `subscribeAgreementInvalidations` emituje hint pri `SUBSCRIBED`; hint pokrene čitanje, loading ugasi pretplatu, završetak čitanja je ponovo uključi, novi SUBSCRIBED ponovi krug. Timeout, SQL i permisije nisu uzrok ovog nalaza.

Sada postoji jedan incoming vlasnik za potvrđenog učesnika i otvoren odgovarajući kontekst. Njegov životni vek ne zavisi od sopstvenog loading/busy stanja. Account/session/focus/AppState/source i CANCELLED granice ostaju u postojećem hook-u i servisu. Svaki hint osvežava workspace; u Porukama istovremeno osvežava postojeću dostupnu istoriju. Read ne šalje poruku niti potvrdu čitanja. Akcije i dalje čekaju stvarno završeno autoritativno čitanje. U `AgreementOverview.tsx` skriven je drugi ulaz za termin samo kada postojeća napomena već ima istu radnju; handler i enabled zaštita su sačuvani.

Reprodukcija koristi produkcijski route, `useOwnedEditor`, incoming hook, coalescer i invalidation service. Native/navigation host, RPC/channel transport i nepovezane media/group/history granice su eksplicitne fixture zamene. Asinhroni odgovor je zadržan tako da loading zaista stigne do React efekata; odmah razrešen stub bi sakrio kvar.

```powershell
$env:USKOCI_INCOMING_PREIMAGE='36dd3bee92160379d1caed89b5c09543b1f9f432'
node --test --test-name-pattern='mounted Dogovor keeps one channel' scripts/agreement-incoming-lifecycle.test.cjs
Remove-Item Env:USKOCI_INCOMING_PREIMAGE
node --test scripts/agreement-incoming-lifecycle.test.cjs scripts/agreement-history-refresh.test.cjs
npx tsc --noEmit
```

Preimage reprodukcija: očekivani **FAIL**,5 kanala umesto1 nakon tri ciklusa. Novi source: **32/32 PASS** (7 novih,25 susednih), TypeScript PASS. Jedan kanal ostaje otvoren kroz join/read, uz2 početna workspace čitanja (inicijalno+join), zatim otključane akcije. Pogođene provere uključuju pending menu, Poruke workspace+history bez send/ACK-a, blur, background, obnovljenu sesiju, promenu naloga, strani participant i CANCELLED/neuspešan read.

Ovaj dokument potvrđuje SOURCE i izolovani React rezultat. Ne potvrđuje novi native APK niti produkciju; to sledi odvojeno. Nema nove SQL/Edge promene, izmene budžeta, ponovnog izbora, dodatne poruke ili dovršavanja probnog Dogovora.
