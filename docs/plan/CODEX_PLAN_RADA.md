# USKOČI — tehnički plan rada i evidencija dokaza

**Checkpoint:** 17.11.2026.  
**Osnovna grana:** `work/uskoci-cist-proizvod-20261104`  
**Osnovni source HEAD:** `f7616ddf611fd5081283948fb823fb2d2258278b`  
**Ovaj dokument je jedini tehnički izvršni plan.** Ne praviti paralelni master ili opšti backlog.

---

## 1. Cilj završetka

Dovršiti postojeći USKOČI bez promene potvrđenog identiteta i poslovne arhitekture:

- dva odvojena AI toka: NEED („Objavi zadatak“) i WORKER („Uskoči i zaradi“);
- jedan nalog, profil i zajednička reputacija;
- AI razume i predlaže; server proverava prava, činjenice, potvrde i trajne promene;
- zadaci, prijave i Dogovori imaju dosledan, proverljiv životni ciklus;
- aplikacija prikazuje autoritativno serversko stanje;
- ukloniti dokazano zastarelu i dupliranu logiku;
- optimizovati promptove, kontekst, modele, SQL/RPC i klijentske tokove bez gubitka ponašanja;
- završiti regresioni QA, pa tek onda razmatrati promociju.

## 2. Nezaobilazne granice

1. PROD je read-only. Nema deploy-a, migracija, upisa, podešavanja ili objave.
2. DEV je read-only u ovom checkpoint-u. Nema Edge deploy-a, SQL write-a, migracije, seed-a ili plaćenog AI poziva bez zasebnog, konkretnog odobrenja.
3. Ne menjati zaključane odluke proizvoda niti vraćati povučene koncepte.
4. Ne prenositi sadržaj između NEED и WORKER разговора. Прелаз улоге је експлицитан и отвара празан разговор са новим `entryKey`.
5. Не уклањати, прескакати или слабити постојеће тестове и заштите ради зеленог QA.
6. Не брисати функције, endpoint-е, миграције или fallback-е само на основу имена, старости или величине фајла. Прво доказати све потрошаче и компатибилност.
7. Свака тврдња о успеху мора бити означена по слоју: SOURCE, локални тест, CI, DEV, Android, PROD.
8. Користити само овај план. `AGENTS.md` остаје оперативни ауторитет.

## 3. Полазни доказани checkpoint

### Git / CI

- Радна грана је потврђена: `work/uskoci-cist-proizvod-20261104`.
- HEAD: `f7616ddf611fd5081283948fb823fb2d2258278b`.
- QA188, run `44136306335`, source исти као HEAD, није успео.
- Job `qa-apk` је пао на кораку `Verify the active clean source`; Android native build и APK кораци су прескочени.
- Логови показују неусаглашене тестне провајдерске fixture-е: NEED позива `generateContent`, док више тестова и даље очекује `streamGenerateContent` и SSE. Последица је `OUTPUT_NOT_JSON`, `AI_PROVIDER_FAILED` и затим `AI_TURN_NOT_CONFIRMED`.
- R06 prepared-runtime fixture и Supabase key compatibility тестови имају исти NEED/stream претпостављени уговор.
- `product-smoke.test.cjs` очекује старо Worker preview-stream понашање, док `ai-stream-display.test.cjs` проверава актуелно server-confirmed-only понашање.
- Ранији QA185 SUCCESS је на другом source SHA `454d91a4f2d719877f6cc769be82ce09ab5af874`; не представља доказ за QA188 HEAD.

### DEV / PROD

- DEV Supabase project ref: `leqcwgzvjsxugfgzdmth`, read-only status `ACTIVE_HEALTHY`.
- DEV Edge versions у претходно документованом read-only checkpoint-у: NEED v209, WORKER v162, Push v49, Speech v32, Media v31, Publication-evaluate v31, Data-export v29, Account-closure v19, Taxonomy-postsave v14.
- PROD project ref: `fvyqqudqvizjrxaflhex`; PROD NEED/WORKER су раније потврђени као v9. Ништа није мењано.
- DEV и source branch нису идентични: NEED/WORKER entrypoint-и и intent модул имају различите верзије/понашање. Разлику третирати као source/DEV drift, не као дозволу за deploy.
- DEV миграциони каталог и source migration директоријум немају директно упоредиве бројеве због version-only marker и операционих SQL пакета. Не проглашавати drift без provenance/manifest поређења.

### Документација

- Овај фајл је био празан на основном HEAD-у; сада се попуњава као једини технички план.
- Не враћати повучени `docs/product/USKOCI_PRODUCT_UX_MASTER.md`.
- Отворени PR #49 је правни RC3 нацрт, не објављивати/мержовати без одобрења.

## 4. Рад у току — QA188 тестни fixture пакет

**Изолована грана:** `fix/qa188-provider-fixtures-20261117`  
**PR:** #50 — https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/50  
**Head:** `67f33c4efca548811fca997907c3614e86b689dc`  
**Base:** `f7616ddf611fd5081283948fb823fb2d2258278b`  
**Статус:** SOURCE измене направљене; CI још није потврђен; PR није merge-ован.

Измењени су само тестни фајлови:

- `scripts/conversation-intent-integration.test.cjs`: mock разликује JSON `generateContent` од SSE `streamGenerateContent`; очекивани endpoint се бира према NEED/WORKER домену.
- `scripts/r06-prepared-runtime.test.cjs`: исти dual-endpoint fixture и бројање једног provider покушаја.
- `scripts/supabase-key-compatibility.test.cjs`: endpoint assertion прати домен.
- `scripts/product-smoke.test.cjs`: проверава одсуство pre-confirmation Worker preview-а и приказ комплетне поруке после ауторитативног completion пута; legacy CORS preflight остаје компатибилан.

Ништа у продукционом Edge коду, prompt-овима, бази, миграцијама, DEV/PROD или буџетима није промењено. Ниједан тест није обрисан или ослабљен. PR #50 не сматрати решеним док се не добије CI доказ на тачном head SHA и док се не прегледају сви преостали падови.

## 5. AI систем — ревизија и оптимизација

### Већ мапирано

NEED prompt assembly у `supabase/functions/uskoci-ai-interview/index.ts`:

- `commonInstruction()` додаје заједнички глас/тон и NEED опште инструкције;
- `v2Instruction()` додаје intent правила, role boundary, NEED пословна правила и динамичке блокове;
- додатни `serviceExecutionInstruction('NEED_SERVICE')`;
- динамички runtime/finish контекст, clarification, location, taxonomy/single-pass, историја и server-owned чињенице.

WORKER prompt assembly у `supabase/functions/uskoci-worker-interview/index.ts`:

- `interviewVoiceInstruction()`;
- `workerConversationInstruction()`;
- `workerConversationIntentInstruction()`;
- `workerServiceChangesInstruction()`;
- inline WORKER intake и правила профила;
- `serviceExecutionInstruction('WORKER_CAPABILITY')`;
- service-mode, taxonomy, runtime, clarification, saved/draft/unresolved services, candidate и history контекст.

### Обавезни следећи рад

1. Направити тачну мапу свих prompt блокова по извору, редоследу и услову укључивања.
2. Раздвојити стабилан system prompt од динамичког runtime/catalog/history контекста.
3. Измерити стварне карактере и provider token usage по делу захтева; не изводити уштеду само из броја линија.
4. Идентификовати дуплирана правила, конфликтне формулације и старе инструкције које више не одговарају потврђеном UX-у.
5. Скратити само доказано редундантне делове; очувати role boundary, price/unit, location/privacy, confirmation, ownership, no-invention, ADD/REMOVE/REPLACE, availability и failure semantics.
6. Проверити да ли је сваки динамички блок потребан сваком turn-у; каталог и историју ограничити на релевантан контекст.
7. Проверити cache key/stability: ниједан динамички део не сме погрешно бити третиран као стабилан.
8. Смањити излазне токене и време до прве корисне реченице без приказа непотврђеног текста.
9. Измерити број модела, latency, input/output/thought/cache tokens и отказе по домену.

**Статус:** делимично мапирано; скраћивање и оптимизација нису имплементирани нити измерени.

## 6. Intent, server guards и WORKER REUSE

Фајл `supabase/functions/_shared/conversationIntent.mjs` има структурирани intent, доказ цитатом текуће поруке, доменске guard-ове и одвојен `serviceChanges` план.

Постојеће заштите које морају остати:

- provider не сме директно писати `patch.skills`;
- ADD/REMOVE/REPLACE захтевају актуелан цитат и одговарајућу intent врсту;
- generic CONTINUE/CORRECTION не дају право за измену списка услуга;
- негативне тврдње, питања, опрема и власништво над возилом не постају услуге;
- safety REVIEW/BLOCK остаје приоритет.

**Отворен ризик / недостајући позитиван тест:** постојећа активна услуга „Превоз“, порука „Нудим превоз, имам комби“, без промене списка услуга, али са легитимном допуном bio. Садашњи guard може одбити bio када је препознат service offer, а `serviceChanges=[]`. Ово још није доказан живи E2E баг. Пре измене дефинисати безбедан REUSE уговор који не дозвољава да нова услуга прође кроз bio. Додати позитивне и негативне тестове за постојећу услугу, ADD, REMOVE, REPLACE, vehicle/tool/capacity facts и независне profile измене.

## 7. Животни циклус — обухват провере

| Домен | Постојећи доказ/тестови | Преостала провера |
|---|---|---|
| NEED разговор и чињенице | AI natural dialogue, intent integration, R06 prepared runtime | пуни разговор -> review -> Save/Publish -> readback |
| Задатак | R13 short publication, R13 dispatch, discovery contracts | сви status transitions, истек, пауза, измена и отказивање кроз Auth/RPC/UI |
| WORKER профил | worker draft activation, shared reuse, taxonomy tests | постојећа услуга + bio REUSE, edit/reopen/save/readback |
| Пријава | R07 application receipt/recovery/price snapshots | submit, повлачење, понуда/измена, прихватање/одбијање и капацитет у два налога |
| Dogovor | incoming lifecycle, outbox lifecycle, R08 cancellation/blind reviews | оба учесника, замена, промена услова, завршетак и readback |
| Поруке/групе | agreement outbox, group conversation lifecycle | редослед, retry, account switch, offline, duplicate и closure |
| Push/dispatch | R09 push capacity, R13 cooperative dispatch | стварна испорука/receipt/опоравак; synthetic тест није device proof |
| Медиа/глас | media handler, voice lifecycle, upload journals | прекид, retry, owner fencing, брисање и Android доказ |
| Налог | Auth/key compatibility, account closure/data export suites | пуна регистрација, verification, logout/session switch, deletion и retention proof |

Тестови су претежно source/synthetic/isolated; не проглашавати их стварним Auth/PostgREST/Android E2E доказом.

## 8. Комплетна ревизија фајлова и уклањање наслеђа

За сваки релевантан фајл евидентирати:

- стварне import/call-site потрошаче;
- runtime/feature flag услове;
- server RPC/SQL уговор;
- тестове и негативне заштите;
- да ли је актуелан према потврђеном производу;
- да ли је дуплиран, мртав, compatibility-only или неопходан;
- одлуку KEEP / SIMPLIFY / REPAIR / DEPRECATE / REMOVE;
- доказ да уклањање не ломи стари клијент, постојеће податке или DEV.

Обавезни слојеви:

1. `src/app`, `src/ui`, `src/data`, `src/contracts`, navigation и local persistence.
2. `supabase/functions` и `_shared`.
3. public/private RPC, SQL functions, triggers, RLS, views и projection.
4. migrations, operational SQL packages, manifests, preflight/postflight/rollback.
5. cron, dispatch, queue, retry, push receipts и worker functions.
6. AI prompt, intent, streaming, prepared input, cache, token accounting.
7. test fixtures, source-executed tests, QA workflows, stale snapshots и docs.

Нема масовног брисања. Прво inventory, затим call graph, затим compatibility proof, па мала груписана измена.

## 9. Извршни редослед

### P0 — затворити QA188 fixture mismatch

- Завршити PR #50 провером тачног head SHA.
- Покренути циљане тестове: `product-smoke`, `conversation-intent-integration`, `r06-prepared-runtime`, `supabase-key-compatibility`, `ai-stream-display`.
- Проверити да NEED JSON и WORKER SSE fixture-и одговарају стварном provider transport-у.
- Проверити да нема нових test oracle слабљења.
- Затим пуни `npm test`, TypeScript и прописани QA workflow.
- Android APK се гради само ако source verification и све претходне капије прођу.

### P1 — AI correctness и prompt optimization

- Завршити prompt assembly map за оба домена.
- Додати WORKER REUSE/bio позитивни тест и негативне ADD/REMOVE/REPLACE случајеве.
- Проверити intent од тренутне поруке до SQL аргумената и readback-а.
- Проверити cancellation, retry, duplicate, lost ACK, prepared input, output bounds и provider errors.
- Измерити стварне токене/латенцију пре и после сваке оптимизације.

### P1 — lifecycle и серверска конзистентност

- Направити табелу свих status enum-а и дозвољених прелаза за Need, Application, Agreement и Worker profile.
- За сваки прелаз упоредити UI command -> Edge/RPC -> SQL guard -> persisted row/event -> readback -> push.
- Проверити идемпотентност, власништво, optimistic concurrency, capacity reservation/release, истек и отказивање.
- Проверити замене учесника само уз ауторизацију и одговарајућу сагласност.
- Потврдити да stale/late response не може преписати новије стање.

### P2 — source inventory и cleanup

- Направити module-by-module инвентар са import/call-site evidence.
- Идентификовати мртве функције, compatibility headers, старе UI copy и застареле feature flag-ове.
- Сваки кандидат за уклањање добија тест који доказује да активни уговор не зависи од њега.
- Уклонити само доказано непотребно, у малим групама.

### P2 — performance и скалирање

- AI: prompt size, tokens, first useful response, total latency, retry rate.
- Database: RPC count, repeated reads, indexes, query plans, pagination beyond 5,000.
- Dispatch: bounded work, cooperative transactions, leases, duplicate protection.
- Push: send/receipt throughput, offline TTL, retries, idempotency.
- Media/voice: upload size, parallelism, cancellation, cleanup, storage readback.
- Client: render, list pagination, cache invalidation, memory and cold restart.

### P3 — release evidence

- DEV controlled E2E само после package-specific preflight/approval.
- Android emulator/device proof одвојено од synthetic CI.
- PROD остаје read-only док не постоји посебан release approval.
- Legal, privacy, Google Play, store identity и data safety су засебне release капије.

## 10. Статусне ознаке

Користити искључиво ове ознаке у checkpoint-има:

- **ANALYZED** — код/уговор прочитан и налаз документован.
- **PROPOSED** — предложена промена, није имплементирана.
- **IMPLEMENTED** — source промена постоји на тачној грани/commit-у.
- **LOCAL_TESTED** — стварно покренут локални тест, са излазом.
- **CI_VERIFIED** — workflow SUCCESS на тачном source SHA.
- **DEV_VERIFIED** — readback на DEV после одобрене примене.
- **ANDROID_VERIFIED** — конкретан build на конкретном emulator/device са доказом.
- **PROD_VERIFIED** — само уз посебно одобрење; иначе N/A.

Непокренут тест никада није PASS. Source-only измена није DEV исправка. Synthetic тест није live-model доказ.

---

## 11. Следећи checkpoint

Наставити са P0 QA188 fixture пакетом на PR #50 и паралелно довршити мапу lifecycle прелаза. Не понављати већ проверене налазе ако се њихови улази нису променили. После сваке повезане целине ажурирати овај фајл кратким доказним checkpoint-ом, без стварања другог плана.
