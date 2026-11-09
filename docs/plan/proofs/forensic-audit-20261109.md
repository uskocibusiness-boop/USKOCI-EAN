# USKOČI — обједињена форензичка ревизија, 9. новембар 2026.

Ово је доказни прилог једином извршном мастеру `../CODEX_PLAN_RADA.md`, не други план пројекта. Product/UX уговор остаје `../../product/USKOCI_PRODUCT_UX_MASTER.md`. Координатор обједињује три стварна паралелна агента: Product/UI, Backend/AI и независни QA/Security/Android. Исти објављени source SHA коришћен је у сва три пролаза. Текст раздваја затечено стање, предлог и накнадно изведену исправку.

## Завршни резултат овог круга

После доле описаног read-only пресека изведен је први безбедни талас и објављен као **`05dcaf18a485bad6af2ce55ebe5ef55bbfffcbf5`** на постојећој радној грани. **QA93 је SUCCESS**, са 1.259/1.259 Node, TypeScript, 231 SQL / 60 integrity и новим native APK-ом. Независно су проверени свих 1.499 source blob-ова и преузети APK, укључујући оригиналне WAV ресурсе. Тачан нови идентитет, актуелна системска матрица и границе су у §16; изведене измене су у §14. Табеле почетног пресека остају датован доказ затеченог b066, не тврдња да је то и даље HEAD.

Завршни DEV readback је **09.11.2026. у 01:46:46 UTC**: миграције, AI евиденција/заставице, Cron, R06/R13 неактивност и свих 15 Edge идентитета непромењени. Нема DEV deployment-а или плаћеног AI позива. AI admission остаје затворен, опозив старог кључа непотврђен, а правни/export/retention и физички Android прихват нису завршени.

## 1. Пресек пре измена

Read-only закључак је сачињен 09.11.2026. у 00:54 UTC (01:54 у Србији), пре прве измене извршног кода овог круга. GitHub и DEV су независно прочитани. Постојећи локални рад у другом checkout-у није преписиван, ресетован или спајан. У форензичкој фази није било SQL/Edge deployment-а, плаћеног provider позива, стварног push слања, промене буџета, тајне или правног статуса.

| Идентитет | Стварно затечено | Граница |
|---|---|---|
| Репозиторијум / радна грана | `uskocibusiness-boop/USKOCI-EAN`, `work/uskoci-cist-proizvod-20261104` | GitHub readback и `git ls-remote`, не само локална ознака |
| Објављени HEAD | `b066aaf9a8f1fd0b5895989fd2d8516abcc5c556` | После QA92 мењано је само пет документарних фајлова |
| QA92 source | `47fc6708ae7e9e8669fb1943f94d63b14647c7eb` | Извршни source објављеног HEAD-а је исти као QA92 |
| Други локални рад | `b20346b1e8e2bcd200c6394379d5826f77a3acee`, 28 локалних commit-а после објављене основе, плус dirty/untracked доказни рад | Није GitHub HEAD, није у QA92; само присуство не доказује Gemini ауторство |
| DEV | `leqcwgzvjsxugfgzdmth`, ACTIVE_HEALTHY, PostgreSQL 17.6.1.165, eu-central-1 | DEV, не production |
| DEV ledger | 368 миграција; последња `20261108230512_r13_hosted_transaction_probe_20261108` | Број ledger редова није број канонских SQL фајлова |
| Објављени SQL source | 228 фајлова, 52 integrity теста у QA92 | Три најновије DEV миграције недостају у b066 |
| Активни marketplace | `select private.marketplace_tick(25);`, сваког минута | Кооперативни R13 није активиран |
| QA92 CI | [run 42533679348](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/42533679348), SUCCESS; ажурирано 08.11. у 23:29:20 UTC | Последњи потврђени успешни run у почетном readback-у; QA93 није затечен |
| CI gate | 1.185/1.185 Node; TypeScript PASS; 228 SQL / 52 Python integrity PASS | Није физички Android E2E |
| APK | `USKOCI-QA-47fc6708a.apk`, 83.460.027 бајтова; SHA256 `d45fb8a99335cd08a77959dcffcbb6dda719b926e790905db696304f79d08669` | Artifact 13639480252; архивски digest и издвојени APK поново проверени |
| Native идентитет | `rs.uskoci.preview.qa`, versionCode 36, minSDK 24 / targetSDK 36, ARM64, DEV, runtime `uskoci-v1-preview-r2`, embedded JS, OTA off, debug потпис | Није production AAB/потпис; нема Firebase конфигурације у пакету |
| Физички Android | Нови независни доказ није доступан | Gemini пријаву о ADB/logcat-у чувамо као пријаву; raw logcat, screenshot и веза са build-ом нису пронађени у доступном доказном материјалу |

### Прочитано, делимично и непроверено

Цео извршни мастер (6.026 линија, 1.208.960 бајтова) прочитан је подељено: координатор 1–946; Backend/AI 947–1676 и 4501–5082; Product/UI 1677–1894 и 5083–5798; QA 1895–4500 и 5799–6026. Важећи Product/UX A–J, линије 1–1692, такође је прочитан у целости: координатор A–C/E–I, Product/UI D, QA J. Додељени опсези су прочитани без ослањања само на претрагу или скраћени излаз. Историјски наставак Product/UX документа није поново прочитан као актуелни уговор. SHA256 Product документа пре измена: `9f1c2385e47f79c0d339bc34ecefc10b75524794e42fbf8642912d17bcf70cdb`.

Прочитани су актуелни власници приказа свих S01–S18, релевантни route/controller/read/write owner-и, конфигурација пакета/QA workflow-а, активна тела кључних DB функција, AI пакети и докази R01/R06/R09/R10/R13/QA92. То није изјава да је свака линија целог репозиторијума семантички ревидирана. Дубина read-only ревизије не замењује извршену матрицу свих подекрана. Нису извршени физички Android тестови, нови плаћени AI сценарији, потпуна двокорисничка E2E сарадња, load тест 300.000 налога, стварни FCM/звукови или правни прихват.

## 2. Извршни закључак

USKOČI је постојећи производ са значајном и употребљивом архитектуром: серверски потврђени исходи, потписани прегледи, идентитет радње, опоравак непознатог исхода, ограничене листе и историја, овлашћени медији, један налог/репутација и постојећи дизајнерски систем. Ово треба довршити и повезати, не поново градити.

**Главна тренутна функционална блокада је AI admission.** False budget flag у стварном SQL-у не отвара неограничену потрошњу: одбија нову резервацију са `AI_TEST_BUDGET_NOT_READY`. Резервисана евиденција истовремено је далеко изнад лимита. Само враћање заставице или брисање старих редова није исправка. **Главна release безбедносна блокада остаје непотврђен опозив раније изложеног привилегованог кључа**, уз Edge legacy equality/fallback пут. **Главна Product слабост је неусклађена хијерархија и доказни статус**: Почетна понавља доменске листе, историја има дупле улазе, стари master delta описује већ решене ствари, а актуелни изглед на телефону није потврђен.

Најважније пре новог APK-а: утврдити коју source целину интегришемо, сачувати локални Home/R10/R13 рад, канонизовати тачне три миграције и проћи регресију. Нов APK са малим UI исправкама може бити користан за проверу, али не решава затворен AI, Firebase/FCM или правне капије. Најважније пре јавног издања: административно затварање кључа, контролисан AI admission, export/retention/closure/правни модел, позитивни двокориснички токови и стварни Android прихват.

## 3. Обједињена матрица система

| Област | GitHub | Тестови | DEV | Android | Стварно стање / следећи корак |
|---|---|---|---|---|---|
| R09 applicant suppression | SOURCE ИМПЛЕМЕНТИРАНО | Претходни 41 PGlite / 45 native; QA92 suite | DEV ПОТВРЂЕНО, не примењивати поново | Нема actual display доказа | ДЕЛИМИЧНО: SQL спречава исту прилику већ пријављеном/изабраном; потребан стварни transport → телефон |
| R09 foreground account | SOURCE/CI ПОТВРЂЕНО | 25/25 у претходном proof-у | Existing reader/ownership | Упаковано QA92, није device тест | ДЕЛИМИЧНО: identified events; legacy generic и OS background нису затворени |
| AI Need/Worker/STT | SOURCE ИМПЛЕМЕНТИРАНО | Budget 26/26 поново у овом кругу | 195/148/33, admission блокиран | 503/неуспех пријављен; текући admission доказ DB | БЛОКИРАНО: ledger/provider reconciliation и ограничен одобрени приступ |
| R06 durable prepared input | SOURCE кандидат | 21 PGlite / 25 native историјски proof | Није активиран; нови R10 preimage га блокира | Нема потпуног restart/provider доказа | ДЕЛИМИЧНО: усагласити постојећи кандидат, затим стварни handler |
| R13 cooperative | SOURCE кандидат | Изоловани wrapper 5/4; новији локални capacity6 33/33 и wake 6/6, видети F06 | Активан стари SELECT owner | Не примењује се | ДЕЛИМИЧНО: интегрисати већ постојећу diagnostics/capacity6 делту, bounded фазе, пуни trigger/FK и hosted acceptance |
| Home bounded summary | Нови сервер, клијент само у другом локалном раду | Локални докази нису QA92 | Summary RPC активан | QA92 има стари Home | ДЕЛИМИЧНО: прво интеграциони преглед b203, не паралелни redesign |
| Discovery | P6/source guards, remote/pinless | Постојећи тестови; b203 има нове cursor guards | Проверити active читач/контракт за сваку претпоставку | Texture source; нема мерења | ДЕЛИМИЧНО: обе remote/list/map истине, paging 5001+, native мерење |
| Applications/candidates | Потписан review, unit-aware цена/термин | Постојећи source/native докази | Existing owners | Позитивни двокориснички ток непотврђен | ДЕЛИМИЧНО: concurrency последњег места и стварни наставак |
| Agreements/messages | Existing canonical workspace/outbox/history | Unknown/replay/anchors у извору и тестовима | Existing owners | Неизвршен media-rich/force-stop тест | ДЕЛИМИЧНО: E2E и мерење 200 приватних порука |
| Task material edit | Guard у source | Guard чува непостојећи contract | `PUBLISHED_TASK_EDIT_NOT_READY` | Не претварати у успех | БЛОКИРАНО: нова верзија, reconfirmation, стари прихваћени услови |
| Photos | Овлашћени reader/cache; inline cover | Постојећи privacy тестови | Media 31 | Crop source доказ; native скок само пријављен | ПОПРАВИ: preserve aspect; затим list loading/error без велике празне плоче |
| Sounds/push | WAV/readback/native resources | APK бајтови потврђени | Custom channels нису активирани | QA92 без Firebase/actual sound | ДЕЛИМИЧНО: нема FCM, background или audible прихвата |
| Privacy/export/closure | Заштитни gate и source постоје | Изоловани/ordinaryAuth негативни докази | Binding NULL, retention false, legal false | Позитивни export/delete непотврђен | БЛОКИРАНО: policy/source/export capacity/оператер, не toggles |
| S01–S18 visual | Уговор дефинисан, реални owner-и прочитани | Статички/component није pixel-final | Није UI доказ | Ниједна фамилија није потпуно native прихваћена овим кругом | ДЕЛИМИЧНО: заједничка visual матрица испод |

## 4. AI — стварни узрок, обрачун и природност

### F01 — P0: затворен admission и неразрешен audit, не доказ неограниченог трошка

Живи `public.rpc_ai_test_budget_reserve_service` има експлицитно одбијање када `reservation_cap_enforced=false`. Need, Worker, STT, publication evaluator и QA користе budget admission; cache не даје посебан плаћени пут, taxonomy post-save не позива Gemini. У 24 h затечена су 4 Need и 1 Worker FAILED са `provider_dispatched=false`. То је застој пре провајдера.

| AI евиденција | Износ / број | Тумачење |
|---|---:|---|
| enabled / cap flag | true / false | False значи NOT_READY, а не unlimited |
| ceiling | 5.000.000 µUSD = 5 USD | Непромењен |
| effective reserved | 65.486.681 µUSD | Audit збир, није Google рачун |
| settled | 10.386.681 µUSD | 9.537.381 measured + 791.274 audio-duration + 58.026 conservative |
| unsettled | 55.100.000 µUSD | 221 резервација: 218 LLM + 3 STT, све старије од 24 h |
| сви reservation редови | 2.324 | Није пронађен дупли operation ID |

Збир settled + unsettled тачно даје effective reserved. Чак и када би постојала основа да се ослободе све непознате резерве, settled део је већ изнад 5 USD. Зато промена flag-а не решава проблем. Код 51 од 218 LLM резервација идентитет клијентског захтева води до FAILED Need команде која је **већ dispatch-ована**; 59 резервација је повезано са publication командама (6 EVALUATED и 53 PUBLISHED), а 5 са QA командама (1 COMMITTED и 4 REJECTED). За 103 LLM и 3 STT резервације није пронађена садашња одговарајућа команда. Ниједан повезани ред нема експлицитан доказ да провајдер није позван. FAILED и старост нису доказ нултог provider трошка. Код 181 историјске MEASURED резервације недостају детаљни usage редови после каскадног брисања Auth налога, али settled ledger остаје; 0,521488 USD тог дела није основа за аутоматски refund.

**Најмања исправна следећа целина:** без мењања старе евиденције ускладити provider billing/export са operation IDs и задржаним usage/log записима; за сваки ред разликовати measured/undispatched/UNKNOWN. Затим припремити посебан затворен admission за тачно одобрене пробе, са ограниченим налозима/бројем покушаја/роком и audit трагом. Нови новчани оквир захтева власничку одлуку; овај круг га није повећао нити предложио брисање заосталих резерви. Техничка припрема може напредовати без плаћеног позива.

### F02 — P1: latency доказ је ограничен; природност није измерена у овом кругу

Последњи задржани измерени LLM usage је од 07.11.2026. у 12:33:15 UTC. За 72 h забележене су 72 операције: input p50/p95 = 4.632/8.365,4 token-а; output 263,5/916,55. За 7 d забележено је 238 операција: input 7.451/18.443,3; output 487,5/1.364,75. Постојећи лог од 7. новембра има само 11 PROVIDER фаза: p50 = 4.170 ms, p95 = 8.803 ms; за 8 Need_COMPLETE фаза p50 = 307 ms, p95 = 1.148 ms. Каталог: за 8 Need фаза p50 = 106 ms, p95 = 466 ms; за 3 Worker фазе p50 = 177 ms, p95 = 401 ms. PROVIDER мера обухвата читав streamGeminiTask позив; није TTFT нити време целог корисничког тока. Нема актуелног резултата мерења перформанси пре и после измене.

Узорак упућује да у том прозору провајдер кошта више времена од catalog фазе; не оправдава нови cache или classifier без мерења. Ниједан нови плаћени разговор није покренут. Шест природних сценарија власника (ношење без возила, превоз без утовара, двоје/троје, HOURLY по особи, понуде, REMOTE) остају обавезни контролисани behavioral прихват: број питања, очуване негативне способности, потписан преглед и стварни draft/readback. Потврђен end-card/streaming source није потврђена интелигенција модела.

### F03 — P1: R06 candidate није активан recovery

Постоји добар текстуални prepare кандидат у истим command редовима. Не треба нови сервис или journal. Нови DEV R10 export projector мења preimage, па је садашње одбијање старог кандидата исправна заштита. Следеће: rebase SQL на тачан нови projector, доказ restart-а са само IDs, једна budget резервација, непромењен dispatch marker, deadline/lease rollback, photo/location и own-export/closure. До тог доказа није дозвољено прогласити „без дуплог Gemini-ја после сваког restart-а“ завршеним.

## 5. Backend, обавештења и скалирање

### F04 — P1: три нове миграције нису канонски објављене

Независно читање живог ledger-а 09. новембра у 00:49:20 UTC потврђује три statement-а идентична локалним SQL фајловима до последњег бајта: R10 `20261108225909`, 7.114 бајтова; Home `20261108230350`, 13.202; R13 probe `20261108230512`, 2.367. Све три су у b203 Git tree-у; committed manifest има само R10, док Home/probe недостају. Изабрана безбедна исправка после овог пресека јесте додати **тачне историјске statement-е** и непроменљив доказ порекла и хеша у канонски source. Не извршавати их поново на DEV-у; не копирати неповезану локалну рекласификацију старих миграција.

### F05 — P1: R09 је добро ојачан, али достављање још није доказано

Suppression за већ пријављеног/изабраног је активан и треба га сачувати. Живи delivery ledger има 88 редова; постоје 2 push покушаја, оба са FATAL/RECEIPT_UNAVAILABLE, transport UNKNOWN, max send count 1. Нема дуплих delivery keys у прочитаном скупу. Ово не доказује ни успешан FCM ни пропуштен пословни догађај; захтева контролисано trace-овање.

Foreground исправка верификује event/recipient/type само за идентификован payload. Legacy generic `kind=INBOX` нема recipient identity, иако дозвољени јавни текст смањује садржински ризик. Push transport шаље eventId само одређеним типовима и иза flag-ова. Следећи owner је постојећи envelope/resolver: компатибилно проширење на све стварне догађаје, два налога, logout/login, multi-device, један дозвољени send, ticket/receipt/FCM/display/tap. UNKNOWN није разлог за аутоматски resend.

### F06 — P1: R13 source није hosted marketplace прихват

Стари SELECT scheduler још извршава фазе у једној трансакцији. Hosted probe доказује да конкретан Cron CALL може имати два txid-а; не доказује цели cooperative graph. Probe job више није активан, а приватни probe објекти остају; cleanup је засебан bounded DB поступак. Новији локални capacity4/5/6/diagnostics рад треба прво рецензирати и тестирати као целину са F20, не преписати старим кандидатом.

Затечени Cron пресек за 24 h: сваки од 3 посла има 1440 успешних извршења. Marketplace p50 = 65,719 ms, p95 = 394,9723 ms, max = 2776,642 ms; Edge scheduler 364,909/1102,65325/max 5149,588 ms; taxonomy 25,156/105,8061/max 428,221 ms. База има 123.849.875 бајтова и у тренутном snapshot-у нема активног lock wait-а. Dispatch schedule има 4 реда; ниједан није био доспео у тренутку читања. То је мала стварна активност, не доказ капацитета за 300.000 корисника.

Накнадни независни преглед локалног b203 потврдио је да capacity6 већ има INOUT JSON резултате свих шест фаза и per-profile/per-Need commit. Сачувани доказ бележи 33/33 native сценарија, 94 SQL тела и 69 табела; овај круг их није поново извршио. Fixture изоставља 90 trigger-а и четири constraint-а. Последњи локални p95 старо→кандидат 310,21→340,27 ms не доказује убрзање; доказана корист је краће задржавање lock-ова и опоравак већ завршених фаза. Зато се diagnostics и per-profile механизам не пишу поново. Пре интеграције треба ускладити installer: committed helper има стари cutoff hash, док кандидат/rollout/rollback имају исправљени; незавршени diff од седам линија то усаглашава. Пре активације остају bounded expire/AI phases, стварни trigger/FK/RLS/ACL граф, concurrent scheduler/crash retry, тачан Cron transition/rollback и hosted acceptance. Групни chat foreground polling сваких 8 s и приватни ScrollView до 200 порука су конкретни кандидати за мерење оптерећења; сами по себи нису доказ leak-а.

### Капацитет који тек треба измерити

300.000 регистрованих корисника раздвојити од истовремених корисника и активних послова. Изолована матрица треба да варира active worker profiles, отворене Need-ове, 100/1000 подобних кандидата, истовремене публикације, chat/Realtime везе, media read/write и AI admission. Метрике p50/p95/p99, query count, lock wait, CPU/RAM/I/O/connection pool, backlog age, throughput/error rate и трошак. Постојећи native fixtures су основа, не production capacity сертификат. Не пуштати масовни тест на живи DEV.

## 6. S01–S18 — актуелни source преглед

За све редове: **SOURCE ПРОЧИТАНО / ФИЗИЧКИ ANDROID НЕПОТВРЂЕНО**. „Нова грешка није доказана“ значи ограничење овог читања, не потпуни PASS. Component тест и CI не затварају TalkBack, font-scale, gesture или pixel-final.

| Фамилија / стварни пут | Шта постоји и треба сачувати | Доказано одступање или ограничење доказа | Конкретан следећи корак / приоритет / обим |
|---|---|---|---|
| **S01 Почетна** `/`; `src/app/(app)/index.tsx`, `src/ui/home/HomePresentation.tsx` | Две намере, наставак разговора, ограничен блок радњи, следећи Договор и делимично неуспели читаоци имају засебно стање. | Четири хоризонталне групе: прилике 365–373, Договори 375–384, сопствени задаци 386–395, пријаве 397–408; затим поново редови Моји задаци/Моје пријаве 412–413. Структура понавља доменски списак упркос уговору о мирној полазној страни. | **P1 UI, ЗАТЕЧЕНА КОНСОЛИДАЦИЈА — накнадно интегрисано у §14**: постоји новији НЕОБЈАВЉЕНИ локални b20346 који мења управо Home, HomeWaitingPanel, index, homeSnapshot и нови bounded Home agreements reader. Не правити конкурентну прераду. Сачувати директне радње/наставак/следећи Договор. |
| **S02 Задаци/Discovery** `/zadaci`, компатибилни `/mapa`, `/prilike`; `DiscoveryPresentation.tsx`, `DiscoveryMap.tsx`, `DiscoveryV1Route` | PEEK/HALF/FULL; сачувана камера и позиција листе; посебан REMOTE и pinless; remote нема лажни пин (`DiscoveryPresentation`: 185, 511–543). Мапна сесија није кључевана сваким филтером (`DiscoveryMap`: 218, 675). | Три мапе и даље `androidView="texture"`: DiscoveryMap: 529, LocationOverviewMap: 97, ResolvedPinMap: 237. Ово доказује извор, не узрок физичког трзања. Избор P6 је build flag (`zadaci.tsx`: 31–32); две читачке путање су намерна компатибилност, не доказ дуплог позива. | **P1 native доказ**, измерити RAM/GC/GPU/frame times, пин/overlay/sheet/Back током 5–15 минута. SQL remote-бројаче проверити на стварном P6 контракту, без старе `rpc_discovery_v1` поправке напамет. Не мењати texture/surface или largeHeap без поређења. |
| **S03 Детаљ задатка** `/prilike/[id]`, `/potrebe/[id]/pregled`; `PublicNeedPresentation`, `NeedPresentation`, `TaskFace`, `NeedPhotos` | Непознат однос корисника fail-closed: поновна провера уместо пријаве (`PublicNeedPresentation`: 113–119). Remote не добија мапу; приватни читаоци су контекстуално овлашћени. Цена има стања amount/offers/unpriced/unverified (`TaskFace`: 23–38). | Фотографије су после описа, не photo-first: PublicNeedPresentation: 152–153 и NeedPresentation: 246–247. Inline PhotoPages: 54 користи `cover`, дакле може да исече фотографију; full viewer је contain. `NeedPhotos`: 35–36 уклања целу галерију док листа није прочитана или су све слике неуспеле. Фиксни 4:3 оквир сам НЕ доказује сабијање. | **P1/P2 UI**: preserve-aspect inline приказ; засебно одлучити loading/error галерије и резервисани простор без празне велике плоче за стварно photo-less задатак. Сачувати овлашћени reader. Проверити photo-first истоветност преглед/јавни/власнички детаљ. |
| **S04 Пријава** `/prilike/[id]/prijava`; `ApplicationComposerPresentation.tsx` | Термин нове пријаве већ је read-only 397–401. Број људи се валидира према местима 77–96; HOURLY је експлицитно по особи 436–443. Потпис прегледа укључује revision/термин/основу/нацрт, линија 277, и поново се проверава при слању, линије 290–297. Засебан opt-in за услугу профила. | Старе тврдње о обавезном уклањању алтернативног термина/сабирању цене више нису актуелне. Мала стварна copy грешка: напомена на линији 406 и даље предлаже „kada možete da dođete“, иако термин није предлог. | **P2 UI copy**: променити пример у опрему/релевантну напомену, не сугерисати алтернативни термин. **P1 доказ**: two-account unknown outcome/replay на Android-у. Не враћати стару форму термина. |
| **S05 Моји задаци** `/potrebe`; `MarketplacePresentation.tsx` | Активни су груписани; нацрти/историја су доменски редови 221–227. FlatList, серверска пагинација, очуван претходни приказ. Несагласност броја и финалне стране је видљива, не лажно „сви“ 142–152, 238, 277. | Нова функционална грешка није доказана статичким пролазом. Појединачни текстови још мешају формални и неформални тон. Дугачки наслови TaskRecordBody: 158 немају ограничење у густим картицама. | **P2 UI + P1 стварни ток**: уједначити copy; дефинисати густу картицу 2–3 реда са пуним детаљем; проверити истек/делимично попуњен/поновно тражење и paging на уређају. Не мењати постојећи server count guard. |
| **S06 Моје пријаве** `/moje-prijave`; `MyApplicationsPresentation.tsx` | Пагинирани серверски скупови; selected води у Договор; задржава преглед промењених услова; unknown има проверу исте радње 274–283. FlatList не одваја активни input (Android keyboard) 248–251. | Четири јавна таба `Čekaju odgovor / Čeka te / Istorija / Sve` 60–61, 243–247, уместо три стања и интерног All приступа по D уговору. Текст меша „Čeka te“/„Vaše“. | **P1/P2 UI**: All задржати у подацима/компатибилном deep link-у, склонити као равноправан јавни таб ако се потврди актуелни контракт. Нема потребе за новом сервисном логиком. |
| **S07 Кандидати** `/potrebe/[id]/kandidati`; `ApplicationSelectionPresentation`, `CandidateFace` | Сортирање већ пореди TOTAL по особи и HOURLY по особи/сат у одвојеним групама; ради тек кад је познат цео серверски скуп 124–145, 273–284. Freeze понуде и провера при потврди 478–499; непознат исход није успех. Durable `selectionCommandJournal` се учитава (`kandidati.tsx`: 146), чува пре RPC-а, на линији 261 и чисти после потврђеног исхода, на линији 274. | Стари delta „укупан износ се пореди као цена по особи“ и RAM-only requester нису актуелни. Caller trace отклања сумњу на двоструко одузимање преосталих места: route: 386 намерно предаје замрзнути `pending.need`. Стварно concurrency/capacity понашање више уређаја још није доказано. | **P1 E2E/DB доказ**: истовремени избор и отказивање/поновна места, restart док исход није познат. **P2** поређење дугих имена, опреме и текста на 360 dp. Сачувати unit-aware sort, journal и замрзнуте услове. |
| **S08 Договори** `/dogovori`; `AgreementCollectionPresentation`, `src/app/(app)/dogovori.tsx` | Претрага већ постоји (87–90, 252–254) и параметар query улази у серверски pager (`dogovori.tsx`: 99–107), није само локално филтрирање прве стране. Улога/исход и временске групе; Back најпре затвара претрагу, затим историју 41–49. | Почетни приказ има и сегмент Active/Previous 241–250 и доњи ред Previous: 299–302. Два улаза воде у исто стање, супротно важећем D уговору без трајног history switch-а. | **P1/P2 UI**: један доменски улаз у историју, сачувати претрагу, улогу и Back. Не правити нову претрагу ни други календар. |
| **S09 Група сарадњи** `/dogovor/[id]/grupa` и GroupConversationEntry у приватном Договору; `GroupConversationScreen`, `GroupConversationPresentation` | Групни контекст даје дозвољене приватне изборе. Приватни услови су експлицитно одвојени (`AgreementOverview`: 74–90); group navigation валидира membership (`dogovor/[id]`: 529–538). Group list је FlatList са anchor: 173–180. | Групни екран проверава стање сваких 8 s у foreground (`GroupConversationScreen`: 36), а не доказан end-to-end Realtime. То је workload за мерење, не већ доказан пад. Групне поруке су текстуалне; не означавати приватни media као групни доказ. | **P1 интеграција/scale**: два изабрана радника + један отказ + поновно попуњавање, проверити private isolation/чланство/прочитано. Измерити број reads по отвореном разговору пре замене polling-а. |
| **S10 Појединачни Договор** `/dogovor/[id]`, `/dogovor/[id]/izmene`; `AgreementOverview`, `AgreementWorkspace` | Замрзнути услови, приватна локација тек преко овлашћеног читања; стања измена/завршетка/проблема; actual step власник одлучује. Поруке и преглед припадају истом Договору. CompletionReview постоји (`dogovor/[id]`: 540–542). | Стару тврдњу да једна путања порука недостаје није потврдио извор: `openMessages` постоји и у overview и problem exits. Потпун Android ток/две стране нису изведени овим агентом. | **P1 E2E**: приватни контакт после/пре губитка права, двострани завршетак, term change/unknown. Не мењати canonical workspace ради лепшег изгледа без outcome регресије. |
| **S11 Поруке** `/poruke`, `/dogovor/[id]?tab=poruke`, `/dogovor/[id]/grupa`; `ConversationInboxPresentation`, `AgreementChat`, group presentation | Приватна историја је ограничена на 200 (`agreementHistoryModel`: 6, 31–64); merge по id, anchor се чува, старе/новије стране имају cursor. followLatest условљен намером читања, не сваким доласком (`AgreementChat`: 313–318). Outbox и state потврде су засебни. | Приватни приказ је ScrollView са до 200 порука; то је мерљив performance кандидат за media-rich историју, не „неограничен render“ и не доказан memory leak. Групни приказ већ користи FlatList. | **P1 Android**: 100+/200 порука, дугачак текст, photos/voice, скрол док долази ново, timeout/restart без дупликата. Виртуализовати приватни приказ само ако мерење оправда и anchor остане тачан. |
| **S12 Распоред** `/raspored`; `AgendaScreen`, planner, serbianDays | Месец/недеља/дан већ постоје; петомесечни cache прозор (`raspored.tsx`: 13–38). Договори обе улоге, доступност само ACTIVE; непознате дане не зове слободним (AgendaScreen: 125–187). Означава разлику зоне телефона, на линији 124. Без термина је засебан избор. | Не постоји доказ физичке приступачности/преклапања на великим фонтовима. Сви прикази користе време Србије; не прелазе прећутно на време уређаја. То је намерно за почетно тржиште, не аутоматски bug. `mojiDogovori` читач није у овом пролазу дубински профилисан. | **P1/P2 native/интеграција**: DST Србије, device зона, remote deadline, overlapping послови, 360 dp/1,3×. Не градити други календар. |
| **S13 Профил** `/profil`, `/profil/podaci`, `/profil/fotografija`, `/profil/ocene`; `ProfileHubPresentation` | Један налог/обе могућности, линија 90; стварна репутација и завршене сарадње, линије 95–97; независни failure/retry радног профила, линије 102–104; нема лажне локације ако city није прочитан (`profil.tsx`: 131–133). Јавни профил је засебна акција, линија 98. | Нови hub користи 13 px помоћни текст и fixed стилове, линија 159, али подржава системски T; читљивост треба проверити, није доказана недоступност. Спецификација S07 има контрадикторну стару account-blended забрану. | **P2 UI**: визуелни pass дугог имена/великих слова/без слике, сачувати једну јавну репутацију. Не враћати два глобална score-а. |
| **S14 Радни профил** `/profil/radnik`, `/profil/razgovor`, `/profil/lokacija`, `/profil/dostupnost`; `WorkerProfileSaved`, `ApplicationServiceOffer` | Потврђени execution modes; remote и onsite области не мешају се. Пасивно читање услуге не уписује ништа, Save се извршава само после explicit add радње. `Mogu odmah` feature је намерно false новијом одлуком власника од 07. новембра. | Преостала UI gate у `profil/radnik.tsx`: 260–261 захтева град и радијус и за generic activation пут; DRAFT review: 273–275 условљен са grad >= 2. Live backend подржава cityless signed REMOTE (потврдио backend агент). У `profil/razgovor.tsx`: 515 постоји алтернативни `WorkerAiActivation` избор: ово је погрешан директни shortcut/додатни корак, **не потпуна немогућност активације**. Пасивни ALREADY_PRESENT notice `ApplicationServiceOffer`: 69–70, 87–91, 108–119 се стално приказује. | **P1 UI контракт**: усагласити директни shortcut са потврђеним серверским modes, не уклањати location gate свим профилима. **P2 UI**: сакрити само пасивни already-present блок; сачувати explicit success/pending/errors. |
| **S15 Подешавања/приватност/подршка** `/profil/podesavanja`, `/profil/privatnost`, `/profil/izvoz`, `/podrska`; `AccountSettingsPresentation`, `PrivacyPresentation` | Права читљива подела налога/искуства/подршке. Retention ready/execution разликује published/unknown/off, не лаже „обрисано“ (`PrivacyPresentation`: 90–127). Logout failure видљив (`AccountSettings`: 39). | Copy недоследан: „Sačekaj/Odjavi se/Prijavi grešku“ уз „Vaše/Pokušajte“ (`AccountSettings`: 34, 40–44; privacy: 98–99). Legal/export/closure readiness зависи од стварног backend-а, не само овог приказа. | **P0 release gate** QA/backend legal/export/closure; **P2 UI** формализовати copy. Не уносити ready=true нити сакрити warning. |
| **S16 AI разговор/преглед/објава** `/nova`, `/pregled-zadatka`, `/pregled-nacrta`, `/ai-istorija`; `IntakePresentation`, `AiConversationShell` | Прво отварање не ствара AI ред нити покреће плаћени позив (`nova`: 146–149); fixed welcome није AI turn (`IntakePresentation`: 505–510). Request journal recovery: 125–160. Реални streaming deltas, no typewriter shell: 98–99. End-card/keyboard: 488; локација доступна преко експлицитног scroll/toolbar: 451–465. Провера потписаног review-а и location readiness-а блокира објаву (`pregled-zadatka`: 501). | UI није доказ природности модела/правилне класификације. Budget/503 и prepared input R06 остају backend приоритет. Стари D progressive-card пасуси су замењени 02. новембра — не треба вратити превремену draft картицу. | **P0 AI guard/опоравак**, потом **P1** измерити шест природних сценарија, број питања/latency/cost, slow network/restart/потврђену објаву. Не плаћати нове load тестове пре budget решења. |
| **S17 Регистрација/обавештења** `/auth`, `/oporavak`, `/obavestenja`, `/profil/obavestenja`; `AuthFormStep`, `PushPreferences`, `NotificationAudioPreferences` | Регистрација већ нема град, само име/презиме/email/password (`AuthFormStep`: 91–99). Google/Apple дугмад нису измишљена; други метод само phone ако постоји capability, линије 116–123. Push settings су један екран, са unsaved Back и write guard заштитама (`profil/obavestenja`: 23–69). Android системски аудио се стварно чита, UNKNOWN се тако именује (`NotificationAudioPreferences`: 39–67). | Нема физичког background/killed/FCM доказа; QA92 intentionally isolated/no Firebase по QA агенту. Звукови као ресурси нису активна server-channel потврда. Текстови формалног/неформалног тона су мешани у shared auth copy. | **P1 native E2E** login/logout два налога/два уређаја, receipt → FCM → display → tap. Не означавати QA92 као пуш спреман. Сачувати ownership foreground поправку. |
| **S18 Повезани токови** `/oceni-dogovor`, `/bezbednost`, `/profil/blokirani`, `/podrska/*`, стари redirect-и | Rating: 5 stars/tag/comment; saved view одвојен од notice/read failure (`AgreementReviewPresentation`: 81–104); коментар и рок од 14 дана видљиви су на линијама 144, 184. Safety invalid/self route: 15–29 не покушава блокирање. Blocked list не зове празну страницу са nextCursor „нема блокираних“, линије 27–54; unknown закључава writes, линија 37. Support објашњава приватност, линије 91–94 и провера није resend, линије 120–129. | Главна доказана UI недоследност је copy „Proveri/Zaustavi/Odblokiraj“ уз формално „Vaše“. Није изведен читав enforcement/closed-account/API доказ; legacy URL компатибилност треба проверити end-to-end. | **P1 integration/privacy**, **P2 copy**. Сачувати server-confirmed saved rating, приватну пријаву и unknown controls; не мешати блокирање са legal readiness. |


## 7. Визуелна матрица и кориснички путеви

За сваку S01–S18 фамилију остаје исти обавезни native пакет: нормално/празно/један/много/дугачко/без слике/више слика/недостајући необавезни подаци; loading/slow/offline/timeout/server-error/retry/stale/unknown; 360 dp и 430 dp на 1×/1,15×/1,3×; тастатура/Back/deep link/scroll/sheet/TalkBack/Reduce Motion/permissions. За сваки изведени случај треба build SHA, route, fixture/state, screenshot/video и резултат. **У овом кругу ниједна од тих комбинација није лажно означена физичким PASS-ом.** Статус S01–S18 visual QA је НЕПОТВРЂЕНО до стварног снимка; source налази из претходне матрице јесу стварно проверени. Старе Design Lab сцене и screenshot-и нису нови APK.

| Пут | Прочитан ланац / позната заштита | Шта још спречава пун доказ | Приоритет/следећи доказ |
|---|---|---|---|
| А: тражим помоћ | citylessAuth → Home → NeedAI → signed review → publish → candidates → agreement → completion/rating | AI admission блокиран; нема новог позитивног двокорисничког Android круга | P0: AI; затим P1: два налога, један стварни задатак, серверски исход сваке фазе |
| Б: нудим помоћ | WorkerAI → confirmed modes/services/area → activate → discovery → application → agreement | remote city UI gate на једној путањи; budget; телефон | P1: cityless REMOTE trace и одвојено physical-no-vehicle прихват |
| В: три места | count/unit-aware application → server capacity → group/private agreement | стварни concurrent last-slot и отказ/поновно попуњавање нису изведени | P1: три актора/два телефона, без overfill-а и мешања цена |
| Г: AI мрежни прекид | request journal, old UNKNOWN guards; prepare кандидат | prepared input није live/handlers нису интегрисани | P0/P1: restart/replay са истим IDs и једним admission-ом |
| Д: порука timeout | исти outbox key, read-only status check, explicit retry | нема force-stop/два уређаја/прилози доказа | P1: server readback пре retry-а, једна порука и очуван anchor |
| Ђ: материјална измена задатка | guard спречава недовршену измену | contract још NOT_READY | P1: нова верзија/поновна потврда/стари snapshot остаје |
| Е: приватност | јавна приближна пројекција, contextual media/location grants | позитиван приступ па revoke на истом токену/физички уређај | P0/P1: ordinary auth, direct API и cache after revocation |
| Ж: први корисник | две намере, welcome, contextual guide | нема посматрања стварног новог корисника; Home redundancy | P1: један човек без спољног упутства, време/погрешни кораци без измишљеног процента |

## 8. Већ решено — не отварати поново

- R09 applicant suppression је DEV активан; поновна миграција би била погрешна. R09 identified foreground је у QA92; стварни background је засебан задатак.
- S08 претрага Договора је серверска и постоји. S04 нова пријава већ прихвата објављени термин. S07 сортирање цене је unit-aware и условљено потпуним скупом; избор већ има durable `selectionCommandJournal`, тако да је стари R11h RAM-only опис застарео. S12 већ има месец/недељу/дан. S17 регистрација већ не захтева град.
- Unknown message/application recovery није аутоматско поновно слање. Read-only провера и експлицитан retry са истим идентитетом треба да остану.
- Фото cache је ограничен; приватни agreement/case media поново проверава приступ. `AuthorizedPhoto` већ подразумева contain; стварни inline crop је override у PhotoPages.
- Need/Worker/Speech late-budget-response cleanup у другом локалном commit-у није нова недостајућа логика: одговарајући објављени source/живи пакети већ су исти.
- Дијагностичке Edge руте sbfenv 10 / schema-smoke 11 / provider-probe 12 прочитане су на живом серверу као HTTP 410 (disabled) без читања env/import/provider позива. ACTIVE у dashboard-у не значи активну дијагностику.
- WAV бајтови су стварно упаковани. То није исто што и активан channel/чујни звук.

## 9. Дуплирања, контрадикције и нешто што није дуплирање

| Налаз | Исправан третман |
|---|---|
| Home: 4 карусела + доменске пречице | Свести хијерархију у постојећем Home owner-у након прегледа локалног рада |
| S08 Active/Previous + Previous row | Један улаз у историју; задржати претрагу/улогу/Back |
| S06 три стварна стања + All јавни таб | All може остати интерни/compatibility; не додавати нови pager |
| Цена amount/offers/unpriced/unverified | Различите истине су потребне; loading не сме да се претвори у unpriced. Постојање fallback-а само не доказује flicker у сваком caller-у |
| P6/legacy Discovery readers | Намерна feature/compatibility граница; доказати active route пре уклањања, није аутоматски дупли позив |
| Need/Worker single-pass vs стари taxonomy докази | Сачувати динамички каталог/стабилни service ID; не враћати стари паралелни classifier |
| Product H/J, snapshot од 29. октобра | Историјски доказ. Не претварати старе city/search/pricing делте у нови backlog |
| S07 једна репутација и стари account-blended пасус | Важећа власничка одлука је један налог/једна репутација |
| S14 Mogu odmah стари/нови пасуси | Новембарски pause и source flag false имају предност |
| S16 стари progressive-card пасуси | Новији end-card уговор од 02. новембра важи; нема враћања превремене картице |
| Execution 11.2 satnica/multiple locations „чека одлуку“ | Застарело у односу на потврђене D06/D08; не питати власника поново |
| Стари 14k/1.5k тест бројеви | Други архитектурски обим; нису пад са данашњих 1.185 нити мера готовости |
| Локални b203/Home/R10/R13 | Реалан одвојен рад; не називати објављеним или аутоматски Gemini-јевим |

## 10. Безбедност и release gate

**F07/P0 — историјски привилеговани кључ:** претходни zero-row HTTP доказ од 08. новембра у 20:30 показује прихватање старог token-а; у овом кругу опозив није потврђен и стари token није поново коришћен. `_shared/supabaseKeys.mjs` има legacy equality/fallback подразумевано укључен без изричите env заставице. Зато само platform revoke не доказује затварање сваког Edge пута. Потребни су овлашћени admin приступ, dependency inventory, rollout/rollback и негативан readback старог кључа и позитиван modern/Auth/Cron readback. Ниједна тајна није у извештају.

**F08/P0 release — export/retention/legal:** live retention source readiness=false, export policy binding=NULL, 0 активних retention policy sets / 0 rules, 0 активних legal/processor пакета. Export inventory има 73 dataset-а; R10 projector је проширен, али капија није тиме завршена. Existing closure/data export механизам не сме да прикаже завршетак без стварног server outcome-а. Нема правног одобрења променом речи „Нацрт“ или ready=true. Власник: физичко лице, бесплатан почетак у Србији, подршка: uskoci.support@gmail.com; није потребно поново питати то, али правни модел/обавезни јавни подаци/рокови/Play declaration захтевају стварну проверу.

RLS, ownership, SecurityDefiner/grants/Storage и private reads треба верификовати позитивним и негативним ordinaryAuth примером. Постојећи 24/24 доказ са празним grants/voice/export скуповима није позитиван доказ свих права. Нема основа да се из тог ограничења измишља конкретан leak; release gate остаје прецизно отворен.

## 11. Извршење по зависностима у истом мастеру

| Целина | Носилац и зависност | Најмањи резултат / доказ завршетка | Ризик |
|---|---|---|---|
| 0 — Консолидација | Координатор + QA; b066 / живи ledger / b203 | Тачне 3 канонске миграције, непроменљив доказ порекла, integrity провера; посебан преглед новијег Home/R10/R13 рада пре интеграције | Низак за копирање само у source; висок за спајање без провере |
| 1 — P0: истина и приступ | Backend + QA; provider/admin/legal улази | Budget audit без брисања; контролисан admission само уз одобрење; стари кључ одбијен, modern пут ради; policy није фалсификован | Висок; конкретно одобрење за DEV/secret/budget/legal промену |
| 2 — Backend токови | Постојећи носиоци R09/R06/R07/R10/R13 логике | Identified event envelope; prepared input + нови export; task edit revision; diagnostics + bounded Cron; ordinaryAuth readback | Средњи/висок; preimage + rollback |
| 3 — Кориснички токови | Product/controllers, backend уговори | Два обична налога завршавају А/Б; В/Д/Ђ/Е пролазе без лажног успеха | Средњи |
| 4 — Visual/product | Постојеће S01–S18 компоненте | Једна хијерархија; доследни текстови, цене, фотографије, празна стања и грешке; стварно снимљена матрица | Низак за UI, уз проверу регресије |
| 5 — Android перформансе | Native носилац; тачан APK и уређај | 5–15 min мапе и чета/медија; frame/RAM/GC/cold start, батерија/глас, push channels | Без мерења нема преласка на surface/largeHeap |
| 6 — Release QA | Координатор + независни QA | CI, APK → два телефона / два налога, crash trace, privacy/legal, стварни потписани AAB | Јавно издање нема одобрење |

**Први безбедни рад планиран на овом checkpoint-у, накнадно изведен у §14:** тачна source канонизација 3 DEV миграције и изолована исправка очувања пропорција фотографија у постојећој компоненти; затим мале доказане исправке текста и пасивног дуплираног обавештења, ако не мењају потврду стварне радње. Home/budget/secret/Cron/legal се не мењају као споредни ефекат. Извршни резултат и тестови биће додати у овај исти доказ и постојеће мастере.

### 11.1. Конкретне P0 капије за следећи активни рад

**Привилеговани приступ.** Недостаје нови негативан доказ за раније изложени кључ. Постојећи `supabaseKeys.mjs` већ подржава прелаз; није потребан нови систем кључева. Безбедна припрема обухвата попис mobile public, Edge service/public, Cron/Vault, push, taxonomy, export и closure потрошача, матрицу њихове аутентификације без вредности тајни, тачан rollout и проверу опоравка. Опоравак мора задржати нове исправне кључеве и искључен legacy пут.

Активна промена захтева одговарајуће административно одобрење и приступ: нови кључеви → проверени потрошачи → `USKOCI_LEGACY_SUPABASE_KEYS_ENABLED=false` у релевантним Edge пакетима → платформски опозив старог кључа. Завршетак значи да нови service/public и обични кориснички JWT раде у дозвољеним правима, док стари и неисправан token добијају одбијање и на REST-у и на релевантним Edge улазима. Scheduler аутентификација мора остати исправна. Празан HTTP 200 одговор није доказ опозива. У доказ се уписују време, верзије и исходи, никада тајне.

**AI трошак.** Недостаје provider billing/usage извод и поуздан исход спорних операција. Безбедна припрема је приватна reconciliation табела по операцији, затим guarded SQL пакет са тачним preimage-ом, бројем очекиваних редова и readback-ом. Јавни доказ остаје агрегатан. Тестира се постојећи admission owner: плафон, истек тарифе, други/затворени налог, исти operation ID, исправан reserve/settle и timeout/replay. Старост, FAILED и недостајући usage нису основа за refund.

Враћање cap заставице уз непромењен ledger и лимит јесте засебна конфигурациона промена, али не отвара AI јер је settled већ изнад 5 USD. Свака оправдана корекција резерве тражи свој доказ и audit траг. Плаћени наставак захтева изричито одобрен износ, ограничен скуп налога/сценарија и услов заустављања. Не повећавати плафон на 65+ USD само да би admission прошао.

Прихват после одобреног ограниченог наставка: један дозвољени request → једна резерва → највише један provider позив → usage и settlement исте операције. Понављање не позива провајдера други пут; исцрпљен буџет, истек тарифе и недозвољен идентитет заустављају позив пре провајдера. UNKNOWN остаје видљив до доказа исхода. Оба пакета могу се припремати паралелно у извору; активан привилеговани приступ затвара се пре новог плаћеног AI круга. Овде је дефинисана капија, није изведена административна промена или provider усаглашавање.

## 12. Границе закључка

Нема процента готовости. Нема тврдње о 60 FPS, капацитету за 300.000 корисника, стварном push звуку, правном одобрењу, стварном Gemini понашању или pixel-final прихвату S01–S18. Извештај доказује затечено source/DEV/CI стање и конкретна одступања. Недоступни спољни докази не оправдавају заустављање независног безбедног рада; исто тако, зелени тестови не оправдавају лажни статус ЗАВРШЕНО.

## 13. Допунски независни налази после почетног пресека

### Edge пакети и граница source parity

| Edge | Активна DEV верзија | Стварно поређење |
|---|---:|---|
| Need / Worker / Speech | 195 / 148 / 33 | Главни handler-и и функционални budget/provider пут одговарају објављеном source-у; Need/Worker cache разлика су коментари и неискоришћен Map, оба враћају null |
| Publication evaluator / QA classify | 32 / 31 | Entry фајлови исти, али shared bundle није потпуно исти: старији request/output лимити и неки provider параметри |
| Push / Media / Location | 47 / 31 / 32 | Верзије потврђене; то није тврдња о новом потпуном bundle или device E2E прихвату |
| Export worker / download / closure | 29 / 29 / 19 | Верзије потврђене; policy/export/closure gate остаје отворена ставка |
| Taxonomy post-save | 14 | Три фајла идентична, без моделског позива |
| sbfenv / schema-smoke / provider-probe | 10 / 11 / 12 | HTTP 410 stub-ови, без читања тајни или provider позива |

Publication/QA live helper има 256 KiB request bound и 8.192 output cap, док заједнички source има 10 MiB и 2.048. То је стварна разлика коју треба појединачно усагласити тестовима. Не радити слепи redeploy свих пакета. `verify_jwt=false` код Need/Worker није сам доказ отвореног API-ја: handler-и имају сопствену Auth и admission проверу.

### Модели, цене и историјска usage граница

Званични [Gemini ценовник](https://ai.google.dev/gemini-api/docs/pricing), прочитан 9.11.2026, наводи за `gemini-3.8-flash` Standard 0,75 USD за милион input и 3,75 USD за милион output токена до 31.12.2026, укључујући thinking. Од 1.1.2027. наводи 1,50/7,50 USD. Live SQL множиоци одговарају садашњој тарифи и `price_valid_until=2027-01-01T00:00:00Z`; после истека admission се затвара. То није доказ ефективне environment вредности, Google фактуре или credits-а. Живи handler guard и свих 1.227 retained usage редова користе тај моделски ID.

Глас користи `gemini-3.5-transcribe-live`: званично 3,50 USD/милион audio input и 21 USD/милион text output токена; приближна објављена процена је 0,009 USD/минут. Локални duration/character settlement остаје процена, не provider receipt.

Девет старих usage редова (23.9–19.10) има total различит од input+output, са остатком 2.429 токена; у последњих седам дана таквих редова нема. Садашњи decoder захтева тачан збир. Ово не ремети утврђени ledger збир, али јесте граница историјске евиденције: токене не дописивати као thinking нити произвољно наплаћивати/враћати.

### Auth, RLS и уски cleanup налази

Свеж readback у 01:01 UTC није нашао application табелу у public/private/rls_private која истовремено нема RLS и даје anon/authenticated table-wide SELECT. Needs има RLS и нема table-wide SELECT нити authenticated приступ приватном close actor/reason. Hosted probe нема anon/authenticated/service_role EXECUTE. То је каталогски доказ, не цео семантички permission E2E.

Supabase advisor: leaked-password protection је disabled — конкретан P1 Auth hardening пре јавног издања, без тврдње о компромитованој лозинци. 124 RLS-enabled/no-policy INFO ставки нису 124 рањивости; приватне guard-only табеле намерно могу бити затворене. Mutable search_path упозорење припада приватном probe-у. Performance INFO инвентар има 88 unindexed FK, 7 no-PK, 16 unused-index и 5 multiple-permissive-policy упозорења; свако захтева конкретан workload/план, не масовно додавање или брисање индекса.

Стари `rpc_delete_abandoned_intake_conversation` проверава Auth/ownership, али позива две retired непостојеће табеле и нема активног mobile caller-а. То је неисправан legacy endpoint за controlled cleanup; није доказ анонимног брисања. Не испробавати destructive call на стварном налогу.

### Отворени PR-ови и сајт

Прочитано је 90 branch head-ова и 30 отворених PR-ова. PR43/44 су ancestors b066; PR46 shared journal већ постоји у новијем коду; PR47 је стари diverged AI кандидат. Ниједан враћени remote head није b203. Ниједан стари PR није спојен овим кругом.

PR48 на `e06766bd2f44352bb33e8c395a7e905f3b1958da` је издвојен static/legal кандидат: свих 23 Git blob hash-а потврђено, 15 страница прочитано, checker PASS и независно 0 покварених локалних рута/anchor-а. Добро су описани бесплатан почетак у Србији, један налог, приватна тачна локација и захтев за брисање који се не представља као извршен. Сајт није интегрисан или објављен.

Конкретне преостале исправке: privacy/Data Safety помиње LocationIQ/MapLibre, али актуелни app чита OpenFreeMap плочице; треба пописати стварне мрежне примаоце и раздвојити их од библиотека. Оператер/правни модел и retention периоди немају потврђену активну основу; подршка и брисање немају извршен позитивни ток. CSS прорачун контраста даје око 2,943:1 за белу на наранџастој и 2,725:1 за мали наранџасти текст на ivory — поправити читљивост пре визуелног прихвата. Нема browser/Android pixel доказа из те рачунице.

## 14. Извршено после форензике — први безбедни source талас

Овај одељак мења статус конкретних горњих налаза; горње табеле описују затечени b066. Објава, QA93 и независно проверени APK сада су потврђени у §16 и посебним source/CI receipt-има.

| Исправка | Кориснички резултат | Где / доказ | Статус у тренутку интеграционог теста |
|---|---|---|---|
| Три канонске миграције | Извор више не изоставља три стварно примењене DEV промене | 3 exact SQL + manifest/provenance/immutable guard; 231 фајл, 60/60 Python | SOURCE ИМПЛЕМЕНТИРАНО / ЛОКАЛНО ТЕСТИРАНО; без DEV replay-а |
| Постојећи локални Home | Почетна више нема четири карусела; задржава следећи Договор, важне радње, две намере, AI наставак и доменске пречице | Тачних 13 runtime фајлова из b203; summary читање, prompt странице по 20 тек када се отвори преглед | ИНТЕГРИСАН ПОСТОЈЕЋИ РАД; нови full suite, није нови redesign |
| Постојећи P6 paging guards | Понављање истог cursor-а или туђи anchor не праве лажан бесконачан наставак листе | 2 runtime фајла из b203, P6 pagination tests | SOURCE ИМПЛЕМЕНТИРАНО; preview/QA користи P6, production flag остаје 0 |
| Цела фотографија | Portrait и panorama се у малом прегледу уклапају без исецања; full viewer задржава исти reader | `PhotoViewer.tsx`, `contentFit=contain`; component resize/Back/context тестови | ЛОКАЛНО ТЕСТИРАНО; физички приказ још није потврђен |
| Истинито стање галерије | Учитавање/грешка се разликују од потврђеног „нема фотографија“; постоји изричит retry | `ContextPhotos.tsx`; празно, failure→retry, account switch, failed bytes | ЛОКАЛНО ТЕСТИРАНО; потпуни layout jump није проглашен решеним |
| Стварни photo retry | Поновни покушај не узима поново исти неисправни cached URI | `AuthorizedPhoto.tsx` + `photoMemoryCache.ts`; failure→remount тест прво FAIL, потом PASS | ЛОКАЛНО ТЕСТИРАНО; остале слике и private reauthorization очувани |
| Пасивна већ сачувана услуга | Сувишан блок не стоји стално; после изричитог додавања остаје потврда | `ApplicationServiceOffer.tsx`; 16/16 focus/recovery/owner тестова | ЛОКАЛНО ТЕСТИРАНО; нема новог prepare/save аутоматизма |
| Напомена пријаве | Пример више не наговештава други термин; говори о опреми и важној напомени | `ApplicationComposerPresentation.tsx`; постојећа форма и readonly термин | SOURCE ИМПЛЕМЕНТИРАНО |

**Нова заједничка регресија: 1.259/1.259 Node PASS, 0 fail/skip/todo; TypeScript exit 0; 231 SQL / 60 Python PASS.** Први уски талас пре Home интеграције имао је 1.198/1.198. Додатни run је изведен због стварно нове интеграције, не ради повећавања броја тестова. Ниједан број не замењује физички Android.

Home backend је засебно проверен на DEV-у: сва три тела и ACL одговарају миграцији; само authenticated користи два јавна read RPC-а, auth.uid је selector, closure је проверен. Нема адресе, координата, цене или порука у summary-ју. Cursor је account-bound, **није криптографски потписан**. Ограничени су одговор и странице; SQL агрегати и даље читају све Договоре власника. Own-task Home read и календар ALL reader остају performance ставке. Позитиван Home ordinary-Auth HTTPS прихват и стварни Android приказ нису изведени у овом кругу.

Нова Home целина не мења постојећу навигациону одлуку: „Uskočite i zaradite“ отвара Задатке; AI радни профил доступан је преко профила. Зато власников сценарио Б не треба описати као већ извршен директан пут једним притиском на AI. Први кориснички прихват треба да провери да су обе могућности јасне без спољних објашњења.

Остали b203 R10/R13 кандидати, недовршени dirty cutoff sync и сајт нису слепо спојени. Сачувани су и њихов новији доказ је унет у редослед даљег рада. Није било промене DEV шеме, буџета, тајни, правне капије, native map режима или production-а.

## 15. Јединствени индекс доказа

- [Форензички readback](forensic-readback-20261109.json): source/DEV/Edge/Cron/QA92/ACL/границе.
- [Комплетна агрегатна budget реконцилијација](forensic-budget-reconciliation-20261109.json): тачан read-only упит и групни резултати, без приватних операционих ID-ова.
- [AI метрике и тарифни уговор](forensic-ai-metrics-20261109.json): usage прозори, мали latency узорак и price functions.
- [Пренос постојећег локалног Home/Discovery рада](forensic-local-integration-20261109.json): сваки тачан Git blob/SHA256 и обим који није пренет.
- [Консолидација локалних кандидата и PR48](forensic-consolidation-20261109.json): тачни source hash-еви, зависности и границе.
- [Интеграциони тестови](forensic-integration-20261109.json): команде, резултати и извршни source hashes.
- [Објава изворног стања](forensic-source-publication-20261109.json): стварни commit/tree, GitHub readback, QA93 и APK идентитет.
- [QA93 CI/source receipt](qa93-ci-readback-20261109.json): успешан run, checks, сви source blob-ови и native build receipt.
- [QA93 независни APK verifier](qa93-local-verifier-20261109.json): стварни ZIP/APK SHA256, logical WAV ресурси, DEV/OTA/source и прецизне границе.

## 16. Актуелно стање после објаве и QA93

**Извршни source:** `05dcaf18a485bad6af2ce55ebe5ef55bbfffcbf5`; Git tree `4d14335af68e1e2e0e66d412bef0808de01b823d`. Објављене су 52 датотеке са тачним очекиваним parent-ом b066 и `force=false`; remote blob/tree readback је једнак тестираном индексу. Завршна допуна мења само документацију и доказе, па се не представља као нови извршни APK source.

**QA93:** [run 42545521019](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/42545521019), 01:25:43–01:45:37 UTC, оба job-а SUCCESS. Node 1.259/1.259, 0 fail/skip/todo; TypeScript PASS; 231 SQL / 60 integrity PASS. Оригинални CI source архив има 1.499/1.499 тачних Git blob-ова, без недостајућих или различитих датотека. То није reproducible rebuild доказ.

**APK:** `USKOCI-QA-05dcaf18a.apk`, 83.492.735 бајтова; SHA256 `1163838887059478424af9f0deebe38c48e5bb14f580f7ca4ce72875a05a21a8`. Оригинални ZIP artifact 13642919867 има 48.865.156 бајтова, SHA256 `f13cf5073132583eee5b06541ddea4a6d54ab234e4b2ab45d680f7c08284eacb`. Package `rs.uskoci.preview.qa`, DEV `leqcwgzvjsxugfgzdmth`, runtime `uskoci-v1-preview-r2`, ARM64, versionCode 36, minSDK 24 / targetSDK 36, embedded bundle, OTA off, QA/debug потпис. Firebase конфигурација није присутна.

Локални verifier је exit 0 / `LOCAL_ARTIFACT_AND_NATIVE_AUDIO_BYTES_CONFIRMED_NOT_NATIVE_E2E`. AAPT2 је независно разрешио три logical raw audio ресурса и потврдио тачне Git WAV бајтове према оба CI receipt-а. Manifest/signature детаљи ослањају се на digest-bound CI aapt/apksigner receipt-е; није измишљена независна локална apksigner провера. Bounded Hermes преглед није нашао service-role JWT или literal модерног тајног кључа, и има само канонски DEV host; то није потпун native binary security audit.

`sourceDirtyFlag=true` је очуван: pinned workflow намерно мења app.json за изоловани QA пакет пре native build-а. Зато exact source архив не значи непромењено native-build радно стабло. Звукови су упаковани, али серверски default channel је задржан; нема стварног audible/FCM/device доказа.

### 16.1. Обавезна системска матрица — текући статус

| Област | GitHub | Тестови | DEV | Android | Стварно стање | Проблем | Следећи корак |
|---|---|---|---|---|---|---|---|
| Source/миграције | 05dc, 231 SQL | 60/60 integrity, CI | 368 ledger; три нова фајла су exact већ активни SQL | Није применљиво | CI ПОТВРЂЕНО / DEV ПОТВРЂЕНО у наведеном обиму | Ledger број није број SQL фајлова; остали локални кандидати су одвојени | Чувати provenance; не replay-овати миграције |
| S01 Home | Проверена b203 целина интегрисана | Home/component/contract + 1259 CI | Summary тела/ACL проверени | QA93 уграђено, телефон непотврђен | SOURCE ИМПЛЕМЕНТИРАНО / CI ПОТВРЂЕНО | Own-task read и calendar ALL; first-user/ordinaryAuth прихват | Један стварни корисник, обе намере, велика слова/Back |
| S02 Discovery | P6 cursor/anchor guards објављени | CI, paging регресија | Постојећи читачи, без deployment-а | QA93, texture остаје | ДЕЛИМИЧНО | Preview/QA P6=1, production=0; native map и 5001+ прихват | Број листе/пинова/REMOTE, очување камере, мерење |
| Фото / пријава | Contain/retry/cache/copy/passive duplicate поправке | 6 gallery, 7 cache, 16 focus; CI | Без промене | QA93 уграђено | CI ПОТВРЂЕНО; ANDROID НЕПОТВРЂЕНО | Распоред после спорог медија и физичка приступачност | Portrait/panorama, retry, account switch, keyboard |
| AI Need/Worker/STT | Постојећи single-pass/provider owners | Budget/component suite; нема новог provider теста | 195/148/33, admission затворен | QA93 не откључава сервер | БЛОКИРАНО | 221 UNKNOWN; settled изнад 5 USD; стварни billing непознат | §11.1: audit и изричито ограничен одобрени наставак |
| R09 | Постојећа suppression/recipient логика очувана | Историјски 41/45 SQL и 25 foreground; QA93 Node | Suppression активан, Push47 | Нема FCM/background/звука | ДЕЛИМИЧНО | Legacy generic envelope, multi-device/OS исход | Проширити постојећи идентитет догађаја; контролисан device доказ |
| R06 | Source кандидат, нови R10 контекст канонизован | Претходни 21/25; не нов live replay | Prepared input није активан | Restart/provider прихват недостаје | ДЕЛИМИЧНО | Стари export preimage, нема пуне handler интеграције | Rebase кандидата, један provider admission, restart доказ |
| R13 | Стари source кандидат; нови capacity6 локално очуван | Ранији 33/33 + 6/6 локални докази, не QA93 активација | Стари SELECT Cron | Није применљиво | ДЕЛИМИЧНО | Installer drift, пуни trigger/FK/ACL и hosted overlap | Ускладити installer; bounded фазе; прихват и rollback пре активације |
| Измена објављеног задатка | Guard очуван | Нема лажне зелене потврде | NOT_READY | Пун ток неизведен | БЛОКИРАНО | Недовршена материјална ревизија/поновна потврда | Серверска верзија + заштита старих прихваћених услова |
| Пријаве/Договори/поруке | Постојећи journal/outbox/accepted snapshot owners | Source/CI заштите, не двокориснички native E2E | Постојећи owners | QA93 пакет; пун ток непотврђен | ДЕЛИМИЧНО | Конкурентно место, media/restart, grant→revoke | Сценарији А–Ђ/Е са стварним серверским readback-ом |
| Export/closure/legal | Постојећи механизам и нови R10 projector | Изоловани/негативни докази | Retention false, binding NULL, legal/processor 0 active | Позитиван исход непотврђен | БЛОКИРАНО | Нема одобрене активне основе и пуног прихвата | Политике/оператер/рокови + позитиван export/closure, без ready toggle-а |
| S01–S18 visual/native | J1 матрица усклађена са 05dc | Component/source/CI, не pixel proof | Није UI доказ | APK бајтови потврђени; телефон није извршен | ДЕФИНИСАНО / ДЕЛИМИЧНО | Нема 360/430 dp, font/Back/TalkBack/FPS пакета | Постојећа J матрица и два телефона, тачан build SHA |

### 16.2. Завршни DEV и стварни p99

У 01:46:46.356959 UTC потврђено је непромењено стање према 01:20: 368/latest230512, budget/ledger/usage, marketplace Cron, R06/R13 неактивност и свих 15 Edge верзија/status/JWT/bundle идентитета. У [форензичком readback-у](forensic-readback-20261109.json), `delivery_dev_recheck`, сачуван је тачан агрегатни SQL, резултат и поређење.

| Cron SQL позив, последња 24 h | Успешно / грешке | p50 | p95 | p99 | Максимум |
|---|---:|---:|---:|---:|---:|
| Marketplace | 1.440 / 0 | 65,69 ms | 392,62 ms | 531,16 ms | 2.776,64 ms |
| Edge worker tick | 1.440 / 0 | 365,33 ms | 1.065,73 ms | 1.451,58 ms | 5.149,59 ms |
| Taxonomy postsave | 1.440 / 0 | 25,16 ms | 105,21 ms | 162,08 ms | 428,22 ms |

Прозор је 08.11.2026. 01:46:46 → 09.11.2026. 01:46:46 UTC, `percentile_cont`, 1.440 завршених узорака по послу. Ово је трајање SQL Cron позива, не успех асинхроног Edge/провајдера/FCM, Android latency или капацитет за 300.000 корисника. Нема измишљеног пре/после убрзања, CPU/RAM или физичког мерења. Нема нових DEV промена, плаћених позива, јавног издања или прихвата на телефону.
