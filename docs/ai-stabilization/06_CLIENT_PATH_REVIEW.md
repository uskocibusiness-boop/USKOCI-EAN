# Client AI tok: NEED, WORKER, pregled i oporavak — 2026-10-27

Status: LOCAL VERIFIED za opisanu malu izmenu; nije DEPLOYED niti live E2E potvrda.
Polazni commit: 5e7790e8, grana feature/uskoci-cisto. Pregled i lokalne izmene: conversation_path_review.

## 1. Šta je stvarno završeno

Sadržinski su pročitani aktivni NEED i WORKER klijenti, sva tri glavna ekrana, review/publication servis, owned receipt/stream/journal/session zaštite i navedeni testovi. Manifest review-client-20261027.json sadrži putanju, SHA256, stvarni pročitani opseg i konkretan zaključak po fajlu. U ovom prolazu je 36 FULL i 3 PARTIAL zapisa; broj obuhvata i 3 pomoćna CI/dependency fajla. FULL se odnosi na čitanje sadržaja, ne na dokaz da je svaka funkcija ispravna. Izvršen test nije automatski FULL pročitan test.

Lokalno je reprodukovana i zatvorena C01 granica nastavka objave: nakon što je određena kanonska komanda već izabrana, odgovor posle evaluacije i završna potvrda objave ne smeju je zameniti komandom sa drugim clientRequestId. Zadržani su owner/review/need/revision/digest dekoderi, kanonsko čitanje i idempotentnost.

Nije menjan UI, prompt, SQL, konfiguracija, arhitektura niti broj poziva. Nisu brisane stare funkcije. Ovaj agent nije pravio commit/push, pozivao živi provider, pisao u DEV/produkciju, deployovao ili slao obaveštenja.

## 2. C01 — nalaz preciziran proverom stvarnog ugovora

### Dokazivi problem

U src/data/aiTaskReviewClientService.ts:

- resumeFor je proveravao ključ samo pre evaluacije; readback posle nje mogao je pod istim review-om vratiti drugi ključ, nakon čega bi klijent objavio taj drugi command.
- rpc_publish_accepted_ai_task_review odgovor proveravao je review/need/revision, ali ne i ključ upravo poslate komande.
- Prvobitna provera u resume koristila je case-sensitive poređenje UUID-a.

Sintetički testovi pre popravke pokazali su prihvatanje promenjenog ključa na ova dva mesta. Ovo je dokaz nedostajuće klijentske granice, a NE dokaz da živi SQL trenutno vraća takav neispravan odgovor.

### Važan izuzetak: prihvatanje pregleda NIJE ova greška

Početni predlog da i accept mora da vrati baš poslati ključ bio je preširok. Nezavisni SQL review je na vreme pokazao:

- Isti review + novi request key legitimno vraća već postojeću kanonsku komandu sa ranijim ključem.
- Zadržana migracija 20260912213702_clean_v5_review_acceptance.sql:230–232 eksplicitno implementira taj replay.
- publication_contract_review je nezavisno potvrdio istu granu u živom read-only SQL telu rpc_accept_ai_task_review (MD5 535fa065c24b514423af8d04a8a58574).
- Publish je drugačiji ugovor: u istoj migraciji:330 klijent mora koristiti ključ već izabrane komande.

Zato je stroga direct-accept provera povučena PRE završetka. Nije dodat novi reconciliation RPC ni drugi sloj. Accept ostaje originalno review-bound kanonsko prihvatanje. Peer review je sprečio regresiju idempotentnosti; acceptance se ne vodi kao popravljena greška.

### Konačna mala izmena

- expectedKey se kopira kao skalar na početku resumeFor; mutacija ulaznog objekta dok traje await ne pomera izabranu komandu.
- Početni i post-evaluation readback porede UUID preko sameId.
- Publish dekoder proverava ključ poslat tog puta.
- Read i readLatest i dalje smeju otkriti bilo koju stvarnu kanonsku komandu pripadajućeg pregleda.
- Direct accept sme vratiti raniji kanonski ključ. acceptAndPublish dalje radi baš s tom komandom.

Test fajl client-ai-path-20261027.test.ts ima 12 slučajeva: identičan/case UUID, legalni novi-key/isti-review replay, safe acceptAndPublish sa starim kanonskim ključem, odbijanje drugog review-a pre evaluatora, promena ključa posle evaluacije bez publish poziva, neispravan publish ack, ACCEPTED/EVALUATED/PUBLISHED recovery i ponovljeni read-only resume, readLatest discovery i zamrznuti početni ključ.

## 3. Stvarne klijentske putanje i pozivi

### NEED

Ulaz je src/app/(app)/nova.tsx; src/data/index.ts:79 vezuje aiNeedV2Izvor za aiNeedV2Production. Stari izvor.ai adapter nije taj aktivni razgovor.

| Radnja | Poziv | Bitna granica |
| --- | --- | --- |
| Prva poruka / eksplicitno otvaranje govora ili fotografije | rpc_ai_open_need_conversation_owned_v2 | Stabilan open ključ; samo prikaz praznog ekrana ne pravi razgovor. |
| Obična poruka | POST Edge uskoci-ai-interview preko aiNeedTurnStream | conversationId + clientRequestId; journal pre slanja; stream receipt mora odgovarati pokušaju. |
| Odgovor na lokaciono pitanje | SDK invoke uskoci-ai-interview preko locationDialogueClientService | Isti owned turn sa konkretnim locationContext; nije poseban proizvoljan writer činjenica. |
| Provera ishoda | rpc_ai_recover_need_turn_v2; zasebno postoji rpc_ai_read_need_turn_v2 | Oporavak ne šalje ponovo poruku niti poziva model. |
| Kanonski prikaz | REST ai_conversations, zatim paralelno REST ai_messages + rpc_ai_need_review_v2 | Provereni nalog, purpose, schema, redosled i oblik facts/message podataka. |
| Eksplicitno odustajanje od pokušaja | rpc_ai_cancel_need_turn_v2 | Potvrda otkazivanja pre uklanjanja neizvesnog lokalnog stanja. |
| Napuštanje razgovora | rpc_ai_abandon_need_conversation_v2 | Eksplicitna akcija, ne prećutno brisanje pending pokušaja. |

Nova prikazuje kanonski odgovor posle readback-a: onText callback običnog slanja je namerno prazan (nova.tsx:285). To znači da server streaming sam po sebi ne garantuje raniju vidljivu rečenicu na ovom ekranu. Kod nije menjan u ovom prolazu.

Posle uspešnog stream-a, dok postoji pending komanda, tipičan readback ima četiri zahteva u tri serijske faze: recover RPC → conversation header → messages i facts RPC paralelno. To je mapa koda, ne izmerena latencija.

Dodatni servisni API-ji confirmFact/correctFact, saveDraft, openEditConversation i confirmEdit i dalje postoje. Aktivni pregled zadatka koristi review/accept servis u nastavku; nisu uklonjeni ostali API-ji na osnovu odsustva jednog caller-a.

### WORKER

Ulaz je src/app/(app)/profil/razgovor.tsx; direktno koristi workerAiClientService.

| Radnja | Poziv | Bitna granica |
| --- | --- | --- |
| Otvaranje | rpc_open_worker_ai | activationRequest/openKey; journal restore pre eventualnog novog otvaranja. |
| Poruka | POST Edge uskoci-worker-interview, zajednički stream transport | Provisional delte nisu trajna potvrda; slede recovery i canonical snapshot. |
| Read / recovery | rpc_read_worker_ai_taxonomy ili rpc_read_worker_ai; rpc_read_worker_ai_turn_recovery | Signed flag menja read shape; recovery nosi expected user i tačan request key. |
| Ograničena izmena | rpc_patch_worker_ai | expectedRevision i kloniran patch. |
| Review | rpc_prepare_worker_ai_review_taxonomy ili rpc_prepare_worker_ai_review | Tačna source revision. |
| Eksplicitno potvrđeni modovi | rpc_prepare_worker_ai_review_taxonomy_confirmed | Poseban flag; odabrani modovi nisu automatski zaključeni iz kataloga. |
| Save OBE review verzije | rpc_save_worker_ai_review | Isti RPC naziv; reviewId + displayed digest + idempotency key. Nema posebnog taxonomy Save naziva u ovom klijentu. |
| Otkazivanje / napuštanje | rpc_cancel_worker_ai_turn / rpc_abandon_worker_ai | Kanonski ishod pre čišćenja lokalne neizvesnosti. |

Posle signed Save-a nema drugog global mode upisa. Jedino unsigned legacy review, prepoznat odsustvom classificationState, posle Save-a poziva inferWorkerExecutionModes i odvojeni best-effort workerExecutionModeClientService.save (razgovor.tsx:282–284). Ovo je stvarna preostala legacy grana; nije dokaz da je aktivna u trenutno instaliranom APK-u i nije bez dokaza obrisana.

U pregledanom lokalnom .env/.env.local i oba relevantna eas.json profila signed NEED/WORKER i worker confirmed modes imaju true. To nisu dokazi sadržaja već instaliranog bundle-a.

### Review → nacrt / evaluacija → objava

Ulaz src/app/(app)/pregled-zadatka.tsx:

1. Read postojećeg pending review-a ili rpc_read_latest_ai_task_review; ako komanda već postoji, ne priprema se druga.
2. Bez komande, pregled lokacije mora biti potvrđen; prepare pravi server-owned immutable review.
3. acceptAsDraft poziva samo rpc_accept_ai_task_review: čuva privatni nacrt, ne radi provider evaluaciju niti objavu.
4. acceptAndPublish prihvata kanonsku komandu pa resume: rpc_read_ai_task_review → ako ACCEPTED, auth.getSession + Edge uskoci-publication-evaluate → ponovo review read.
5. Samo EVALUATED/ALLOW ide u rpc_publish_accepted_ai_task_review. EVALUATING/UNKNOWN_OUTCOME/PUBLISHED recovery ne ponavlja provider.
6. UI posle PUBLISHED čita stvarni owner need pre success handoff/navigation. URL sam nije dokaz objave.

Bound replacement review čuva source/target/revision/fingerprint vezu. Lokacioni pregled ne sme prepisati semantički sadržaj zadatka neprimetnom drugom putanjom. Pending command ref nije trajni privatni dnevnik: posle restart-a readLatest vraća kanonsku komandu.

## 4. Retry, zastarelost i gubitak podataka

| Situacija | Postojeće ponašanje i granica |
| --- | --- |
| Prekid stream-a ili izgubljen ACK | Read-only recovery. Nema automatskog ponavljanja plaćenog AI poziva. |
| Eksplicitni retry | Samo isti ključ/telo, kada server kaže retryAllowed; restore bez tela ne izmišlja novu poruku. |
| Smrt procesa | AsyncStorage journal čuva samo account/conversation/request UUID, ne tekst, lokaciju ili slike. Server je autoritet trajnih poruka. Neposlati tekst u React state-u nije trajno sačuvan: privatnosni kompromis, ne dokaz da je upisana poruka izgubljena. |
| Korisnik menja draft dok stara poruka završava | Samo odgovarajuća typed draft revision sme se očistiti. Novi unos se ne briše potvrdom prethodnog pokušaja. |
| Drugi nalog, uključujući A→B→A | accountRevision + owned editor/request identity odbacuju zakašnjele odgovore. Token refresh sam ne menja identitet naloga. |
| Timeout | Shared wrapper ograničava čekanje klijenta (15s običan RPC, 55s AI), ne tvrdi da server nije završio. Write timeout nije dozvola za novu komandu. |
| Stari snapshot | NEED zadržava last-good prikaz sa zaključanim radnjama; WORKER ima uži transport-only fallback. Ne treba izjednačiti svaku server grešku sa offline stanjem. |
| Govorni tekst pri terminalnoj grešci | Lokacioni govor ima retainedLocationSpeech put. Običan govor zahteva zasebnu behavior reprodukciju pre tvrdnje o gubitku; nije menjan. |
| Terminal stream event pre transport EOF | Decoder čeka EOF, proverava ukupan limit i zabranjuje događaje posle terminala. Može doprineti čekanju, ali u ovom prolazu nije izmereno kašnjenje niti menjan protokol. |

## 5. Otvoreno i ograničenja

- Conditional deadline/signed kombinacija: prepare bira rpc_prepare_ai_task_review_deadline_taxonomy samo kada su i signed review i EXPO_PUBLIC_USKOCI_TASK_AI_APPLICATION_DEADLINE_V1 true (servis:359–362). Deadline flag nije pronađen u pregledanom lokalnom/build config-u. publication_contract_review read-only metadata nije našao taj RPC u DEV-u; nema ni SQL definicije u repozitorijumskoj pretrazi. To je prepreka budućem uključivanju kombinacije, ne dokaz da trenutno aktivni prepare ne radi. Flag nije uključen.
- SDK supabaseClient ima fallback DEV URL/key i configured() true; direktni stream send zahteva eksplicitne env URL/key. Potencijalna konfiguraciona nedoslednost nije reprodukovana kao živi incident i nije popravljana usput.
- Stari AI adapters ostaju komponovani u izvor; u pregledanim app/ui/features caller pretragama nisu pronađeni kao glavni NEED/WORKER razgovor. Odsustvo rg hita nije dovoljan dokaz za brisanje.
- Generički app_profiles.skills REST writer nije sadržinski pregledan od ovog agenta. publication_contract_review zasebno proverava workerProfileClientService i njegove caller-e. AI signed Save nije jedini potencijalni skills writer u celom sistemu.
- Testovi ai-owned-intake-screen (1–190) i worker-ai-conversation-recovery (1–200) samo su PARTIAL pročitani; oba kompletna suite-a izvršena su uspešno. v5-review-screen suite je izvršen, ne predstavljamo ga kao sadržinski FULL pročitan u ovom prolazu.
- Nije pročitana svaka voice/photo/geocoder/history UI zavisnost. Nije urađena nova provider, telefon, geocoder ili pune Review→Save→matching→push→Dogovor E2E provera. Nema novih tvrdnji o brzinama u milisekundama ili kvalitetu odgovora Geminija.

## 6. Provere konačnih bajtova

- 4 ciljana Jest suite-a: 256/256 PASS (client-ai-path, ai-task-review-client, worker-ai-client, w03-ai-need-client); novi fajl ima 12/12.
- Širi izbor 32 client AI/review/recovery suite-a: 1200/1200 PASS, 0 snapshots, 26.222s, posle vraćanja kanonskog accept ugovora.
- npx --no-install tsc --noEmit: PASS, exit 0, posle konačne izmene.
- Nezavisni CI source guard: 3/3 PASS.
- Sedam novih dynamic_taxonomy fajlova iz CI komande: 114/114 PASS.
- Parent je dodatno prijavio konačni full Jest: 622/622 suite-a, 14143/14143 testova, 3 snapshots PASS; parent TypeScript i Deno PASS. To je njegov puni run, ne drugi puni run ovog agenta.

Širi client izbor može se ponoviti u PowerShell-u:

```powershell
$clientPathTests = @(rg --files src/data/__tests__ | Where-Object { $_ -match '(ai-|aiNeedV2|worker-ai|w03-ai-need|v5-review|review-fact|reviewFactProblem|review-exits|intake-review|ai-conversation|client-ai-path)' })
npx --no-install jest --runInBand --runTestsByPath $clientPathTests
npx --no-install tsc --noEmit
```

CI pregled: sva tri Edge entrypoint-a i svih sedam dodatih dynamic test fajlova nalaze se u izvršnim komandama; lokalni PG characterization test je takođe povezan. Ipak, NEED index.ts ima @ts-nocheck, pa Deno prolaz nije dokaz potpune type-safety tog handlera. Workflow setup i npm ci koriste mrežu; source guard protiv secrets/deploy nije dokaz potpune mrežne izolacije/transitivne sigurnosti. Ovaj agent nije nezavisno pokrenuo Deno jer nije na njegovom PATH-u.

## 7. Vlasništvo nad ovom izmenom

Izmenjeni runtime: src/data/aiTaskReviewClientService.ts.
Novi regresioni test: src/data/__tests__/client-ai-path-20261027.test.ts.
Nova evidencija: ovaj izveštaj i review-client-20261027.json.

Centralni reviewed-files.json, status i ledger nije menjao ovaj agent. Nema subagent commit-a; parent bira finalnu integraciju i evidentira commit/push.
