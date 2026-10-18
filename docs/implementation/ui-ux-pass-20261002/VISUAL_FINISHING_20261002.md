> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../design-system/PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

# Visual finishing — owner direction and first connected batch, 2026-10-02

The owner's latest message asks for black primary text, gray supporting text, white surfaces, curated premium 2.5D iconography, purposeful cards/open rows, and complete screen/flow critique. This explicitly supersedes green titles and blanket flat marks. Existing W5–W7 are the first implementation slice; W4/Home, remaining W8–W11 and the AI conversation keep their place in the same plan. No new product master or blanket acceptance.

## References recovered

- `outputs/design-v31-v28-20260922/PREDLOG.html` and `TOK.html`; rendered V28 screens in `docs/implementation/v5-ai-first/v28-reference/`.
- Owner's seven Airbnb references: `docs/implementation/design-system/OWNER_AIRBNB_REFERENCES_20260925.md`.
- Original local `C:/Users/user/Downloads/USKOCI_WEB_V59_PREMIUM_MAPA_I_DUBINA.html` and `USKOCI_WEB_V60_PREMIUM_MOTION_CLEAN.html`: inspected HTML/CSS, not accepted native renders. Useful: distinct white task card versus unboxed rows, one white map sheet, quiet assistant reading, accents instead of broad green fields. Their old cream/green text is superseded.
- Existing native `FactArt` has 30 SVG drawings with depth, edge and highlight. Reuse explicit art cuts; no new asset/package required. Rejected pin-reference card remains rejected; Catalog27 is not imported wholesale.
- The older donor design skill was relocated to `C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/donor/CLAUDE 30.08 USKOCI/.claude/skills/design/SKILL.md` and read by the independent visual reviewer.

## Screen purpose and draft agreement

Discovery lets a person find a suitable task, inspect its place/terms and open it. UX_NACRT §5 remains intact: map and list on one screen, search within reach, draft filters with an authoritative result-count action, selected-pin preview and task detail. Differences are visual hierarchy and shorter copy; no new filter, state, count, ordering, permission or business command.

| Before | Implemented direction | Why |
| --- | --- | --- |
| Large green title, price and offer wording compete | Full-width ink title, ink monetary amount, gray terms | Hierarchy comes from role/weight and spacing. |
| Wide separate rows and a footer for capacity alone | Compact logistics, one value/capacity group, footer only for person or useful next step | More of the list can be understood at once. |
| Tiny flat fact symbols dominate every row in green | Selected existing 2.5D illustrations, simple operational glyphs | Brand character with readable controls. |
| Search squeezed by multiple controls | Full-width search; separate labelled Filteri and quick choices | The query and its actions each have room. |
| Five floating filter cards | One white reading surface and divided sections | Current editor and choices lead, without nested card decoration. |
| Repeated 'Dodaj uslove' and technical area phrase | Current conditions only; 'Ova oblast' | Less competing instruction/copy. |

`sys.color.money` becomes ink for shared numeric roles; global green is unchanged. Task detail headings follow the ink direction. Entry/HOME signature, server readers, restore/snap-state logic, real facts, pricing basis and callbacks remain. Tests are existing focused behavior checks; style expectations updated only for the owner's explicit new direction. React component review uses native-relevant React best practices; no fetch/effect/animation engine added.

## Evidence checkpoint

TypeScript passes. Existing focused card/search/panel/token checks: 184/184 pass. Independent read-only source review on parent GPT-6 found no blocker or lost fact/action. The later pin composition correction retains the existing overflow/close/Back checks: 7/7 pass. Quick chips still fold intentionally. Native evidence below closes this bounded composition check only; whole-app and release acceptance remain separate.

## Exact APK and actual screens

First build [37005585355](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37005585355), source `b574e1185d850c8fa5a00aadfa197a7186d3fc72`, APK SHA-256 `ded04ac8d8e141fd6821687fff1ae7f90000f1881cd4c44c0b8b8c2d034588a8`. Native critique identified two actual finishing gaps: the pin preview still reserved a capacity-only footer, and detail artwork was flat beside illustrated cards. Both were corrected.

Correction build [37008069654](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37008069654), source `5bdeef524c90ad066d3e31cacfc8fb928f03ae72`, tree `60b31d6555009057d5a740242f6208fa8202ae3a`, APK SHA-256 `7272c1308a28765b4caa6666a23908733311edb32b020392c7a1d0ccf8b301ad`. Recovery, launcher and Reanimated attestations pass and bind to each artifact's source tree; certificate matches the installed app. Both installed with `adb install -r`; installed hashes match and the signed-in session survives.

Observed on `USKOCI_V5_TEST`, 1264×2728 / 560 dpi (361.14 dp): own active cards at font1.0/1.15/1.3, draft and history at1.15, Discovery half/full list and filter sections at1.15/1.3, corrected pin/detail at1.15/1.3. Full titles/facts wrap; price and capacity group or stack; the own-task applications footer scrolls fully above the gesture area. Pin correction reduced its observed height from880 to660 physical pixels at1.15 for the same task, exposing more map. Detail now shares the24dp art treatment.

Actual navigation: list→detail→Back preserves list; cancel of a draft Today filter preserves the previous8-task/Bilo kada set; pin→detail→Back preserves the selected preview. Two independent reviewers returned scoped UX and VISUAL **PASS WITH LIMITS** after the correction. UID log sampling since correction installation found0 `FATAL EXCEPTION` and0 `Unable to find a viewState`; that is not a full ANR/performance test. Font restored1.15; animations remain1.

Sanitized build/device/capture hashes: [VISUAL_NATIVE_20261002.json](VISUAL_NATIVE_20261002.json). Raw owner screenshots/XML remain private outside Git. No application, rating, completion or message was submitted. Opening an existing conversation used its normal read behavior. No paid AI generation or physical-phone action.

## Connected Home, application and Agreement pass

Actual broader screenshots were critiqued before changes. Profile was already substantially aligned, so it was not redesigned for novelty. The following work stays inside the existing waves and destinations:

| Before | Source change | Why |
| --- | --- | --- |
| Application offer label, amount and people dispersed | One labelled offer group with full amount/basis and wrapping people group; full title/place/time | Read the proposal as one decision, preserving exact facts and guarded footer. |
| Application edge fade weakens labels; underline differs from own tasks | Capsule rail, complete scrollable labels/counts, no edge fade | Consistent selection without tiny text or lost destinations. |
| Agreement title squeezed beside56dp avatar | Full-width title before40dp person block; quieter illustrated logistics | Work, person, terms and next action have distinct roles. |
| Unconfirmed Home/Agreement time strongly green | Gray terms, neutral calendar art; modest Home section spacing reduction | Missing confirmation does not resemble a positive outcome. |
| Conversation is an icon-only control beside a crowded person header | Visible Pregled/Poruke capsules below the person; existing guarded tab transition | The conversation is discoverable. Chat retains its existing overview return. |

Source `c81722a2` includes the independent review's long-amount wrapping correction and explicit reset of flex basis for large text. Existing application/Agreement/recovery checks140/140 pass, plus the Home, overview and paging suites; TypeScript passes. Exact build [37009600771](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37009600771), APK SHA-256 `6a12f186827a41a7bfc84ec75300f5c28dd8e215c26f305d9719f123ae124837`, was installed and reviewed at1.15/1.3. Cards stack naturally without an oversized flex-basis gap. Actual Pregled→Poruke→Back restores the overview; the thread retains the complete m² unit. One initial visual-review concern about the superscript was rejected after full-resolution root inspection and the independent UX review.

Native review found an actual selection defect: choosing Završene loaded the right rows, but loading unmounted the rail and hid the selected capsule after its scroll offset reset. Source `0889c819` keeps the rail mounted during loading and preserves server-owned counts; stale cards still disappear. The same bounded correction lets two Agreement capsules fill their track while four application capsules can overflow. The existing paging test now checks rail identity across a loading cycle;14 focused checks and TypeScript pass. Superseded builds37009527309 and37012040450 were cancelled before acceptance; the latter correction is included in the final connected build below.

## AI opening composition

Actual native review found that a large green invitation and three large green example cards competed with the composer. Source `8d22ce0e` uses a smaller black invitation, compact black example labels,24dp art without a second surrounding well, smaller static brand presence and shorter introductory copy. The voice introduction is black too. Full48dp targets, multiline composer geometry, insertion-and-focus behavior, send guards and real streamed text remain unchanged. No example sends itself. Existing conversation layout/behavior suite40/40 and TypeScript pass; independent source review approved after correcting the art-cut prop.

Final connected build [37012789559](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37012789559), source `8d22ce0e15d1fc952204aad91a4a8818dfb3183f`, is installed and verified on USKOCI_V5_TEST. APK SHA-256 `9f97c49ff4019636271a43e9d4fee437b5983fcdee98d56883a9b90a14a9adbb`, tree `1ed55c50fe2aaedddf147caa2d42bd1dc3a33c98`. All three artifact attestations pass, signer matches, installed hash matches and the session survives. The application/Agreement rail corrections and AI opening were inspected on this exact build; see the sanitized interaction record and separate scoped UX/VISUAL reviews. No paid AI generation was run; opening polish is not proof of AI response quality.

Remaining limits: crowded Discovery quick-control rail/count spacing, broader empty/error/candidate/account flows, AI response quality and remaining whole-app composition, actual large-price native fixture, TalkBack, motion measurements, iOS/HONOR and release. No blanket completion of W4–W10 or all62 control rows is implied.

Next concrete work remains in the same waves: quiet the sparse Agreement thread refresh control; align the unconfirmed term weight across Home/list/overview; finish worker AI summary typography (`WorkerAiPresentation.skillHeading` still green); review existing AI entering/typing motion against B22 and focus/background behavior. The existing worker conversation was opened for inspection of its recorded messages, summary and closed-conversation recovery controls. This does not prove an empty worker opening or a newly generated answer. No new worker conversation, generation, profile update or activation was performed.

Final native health sample: 0 FATAL EXCEPTION and 0 missing-viewState entries since installation, not a full performance/ANR acceptance. Font restored1.15 and animation scales1. Local before/after viewer stays outside Git with private screenshots.

## Existing CI contract reconciliation after native acceptance

Automatic P5 run37012789208 (source8d22ce0e) and PKG006 run37012041861 exposed six existing Jest suites still asserting the previous visual contract. This was caused by this UI batch, not classified as an unrelated baseline failure. TypeScript and their focused checks passed; full Jest did not. The correction changes tests only: current area copy and ink choices, current value/capacity and offer composition, and the reduced glyph allowance. Discovery folding still keeps its48dp Filteri toolbar; the synthetic116dp measured rail leaves68dp to reclaim and the existing8dp hysteresis, preserving both fold and return-at-top assertions.

Obsolete CardHead title/price adjacency estimates were retired because it has no production consumer. Independent review caught a still-live dependency of ownTaskTabs on textWidth: the independent TrueType reader and bundled Inter table, alphabet, proportional/tabular width and unknown-glyph fallback checks were restored. Facts, commands, accessible descriptions, full amounts/basis and responsive composition checks remain. These are structural safeguards, not native pixel-fit evidence.

Validation: the first six-suite local run passed307/309 checks across five passing suites; one Discovery case hit the local5s timeout and its following case suffered timer spill. Discovery alone with a CLI20s timeout passed159/159, without changing test timing assertions. The final card-layout and own-task-tab run passed115/115 including the restored font guard. TypeScript also passed after the final guard restoration. Independent read-only review found no remaining blocker. No full-Jest green claim is made for the final reconciliation commit; earlier failed CI remains visible in the control state. No new APK is required for these test/documentation-only changes, and native acceptance stays bound to8d22ce0e.

## Connected finishing batch — owner-directed source polish

Later owner direction on 2026-10-02: finish existing screens quickly, without new test rounds or rebuilding already working AI/push functionality. The owner explicitly answered “Uključi i HITNO i push obaveštenja”, superseding the earlier R02/A21 deferrals, and then reaffirmed his existing successful Android push experience. The historical provider delivery and Inbox opening remain accepted within their recorded scope. No new push project, proof run, notification or provider activation was started.

The own-task screen now starts with title/state, recovery and applications, then terms/photos/description. Once no further selection is available and places are filled, its primary action opens the existing personal Agreements list; its label does not pretend that list is task-filtered. Application composer, selection and comparison use the same person → amount/basis/people → time → message order, black/gray reading hierarchy, white surfaces and selective24dp dimensional artwork. Full facts and existing commands/recovery remain.

The AI draft card is refined in place, retaining its compact disclosure and complete expanded facts. The existing location confirmation now distinguishes a proposed point, a confirmed point and multiple real matches. A manually moved pin no longer claims the old query as its resolved address. The “Ispravi mesto” action and public approximate/private exact copy are clearer. Existing AI behavior, prompts, map provider and confirmation logic are unchanged. Notification settings more clearly separate OS permission, this device's registration, the role preference and transport status.

HITNO now has an own-task menu entry, server preview, explicit confirmation, guarded activation adapter and persistent uncertainty handling. The policy-off response does not offer activation. No server policy was changed. Existing activation has no durable request receipt or atomic reviewed-policy-version binding: uncertain outcomes stay protected against blind resending; a current active badge alone is not an exact command receipt. These are explicit remaining contract limits, not a claim of live activation or whole-feature completion.

Validation is source review and TypeScript compilation only. No new test suites, Jest run, AI generation, live business write, phone interaction or native acceptance was performed. The previously accepted native source remains8d22ce0e until a new artifact is separately recorded. This batch changes the connected source; it does not declare the app store-ready.

### Artifact and existing CI expectations for this batch

Build [37024029100](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37024029100) succeeded at source `b4f8a2e9393e4138da6b3a8d2be188ce3f15e0f2`, whose runtime source is a49132a8. The downloaded emulator APK is bound to tree `6957cefbd72f458a456be0f4394e256c92a2cb81` and SHA-256 `60b2223d87764a1c6543e5ccd8d41694c8bf650c9d0b91c4e2a6097e7cb21b79`. Recovery, icon and Reanimated patch attestations pass. [Sanitized receipt](FINISHING_APK_37024029100.json). This artifact has not been installed or accepted on a device; native evidence remains at the earlier exact sources.

Automatic PKG006 run37023907809 and P5 run37023907851 failed on stale copy/layout/menu assertions from this change. Ten existing test files have been reconciled with the final source, independently reviewed without removing business, receipt, recovery or no-automatic-send checks. No new test, local Jest run or manually repeated workflow was started. Source review is not a green CI result. [Exact failure classification and correction scope](CI_FAILURES_370239.md).

## Continuation: voice B2 and owner Gemini composer reference

The owner continued the work, supplied a Gemini composer screenshot, then explicitly refined the reference: the microphone must be larger and centered because holding records and release sends. This supersedes a literal small-microphone horizontal copy. Both AI conversations retain a full-width multiline text field in a white rounded surface, with the existing attachment action on the left, a dominant centered microphone and send/voice-mode on the right. Existing controller behavior and paid provider boundaries remain. No unsupported attachment action is invented.

Voice B2 is connected in Android AgreementChat: recording/review/send, local playback, separate durable voice outbox, restored uploads and exact canonical reconciliation. Leaving the thread, backgrounding, account/admission/version changes retire the audio session. A completed press authorizes release-to-send; cancelled/responder-terminated holds cannot lend their authority to a later tap. Accessible mode keeps explicit review. Text/photo drafts retain their own guards and recovery. Support retains the fixed voice label and cannot listen in V1.

The approved expo-audio ~57.0.4 dependency resolved to 57.0.5. One process-wide audio arbiter covers AI speech, recording, preview and playback; failures to release keep ownership fenced. Native AAC recording uses a sub-five-minute cap and actual completed-file duration, private cache cleanup, and source-level background fencing. The DEV APK workflow enables the existing EXPO_PUBLIC_VOICE_MESSAGES flag against already-applied B1. No server package is reapplied.

An Expo AudioStream PCM candidate now exists behind EXPO_PUBLIC_SPEECH_CAPTURE=expo, with mono16kHz PCM16 validation and bounded chunks. The existing custom native AI capture remains the default until the required physical parity is accepted: native audio-focus behavior, interruption handling and buffer lifecycle are not established by TypeScript or source review. There is no mid-session stack fallback.

Bounded independent source reviews covered composer/playback async ownership, native adapter lifecycle and route/gesture integration. No new Jest run, paid AI call, real message or phone interaction was performed. Native acceptance and store readiness remain open. The earlier automatic CI reconciliation completed successfully: P5 run37027853251 and PKG006 run37027853177, both source6c38d343; these do not validate the newer voice/composer source.

Owner resource update: the Personal Google Play account has been created according to the owner; verification is in progress, not confirmed complete. App work continues during verification.

### Later owner correction: compact Gemini input and voice-mode reference

The owner rejected the generated robot/two-row large-center-microphone concept after local source commit9e7fe9b4. This is an explicit supersession of the centered second-row composer direction above. The requested normal composer is one compact horizontal capsule: existing attachment, flexible text, a practical hold microphone, and waveform replaced by a paper-plane send control when text is present. New Gemini screenshots13817/13818 guide the open voice-mode composition: answer above, transcript near the bottom, subtle glowing capsule, microphone and close. Unsupported camera/screen-share controls are not copied.

The owner also explicitly requests AI spoken replies. The existing implementation only transcribes user speech and returns text; the composition change does not implement or claim duplex/realtime audio. Provider/output, interruption, session and privacy integration remain separate concrete work. The generated images remain proposals, not device evidence or accepted final art. The rejected robot is not integrated.

Read-only spoken-output inventory at9e7fe9b4: the current Google speech proxy requests TEXT with manual VAD and NO_INTERRUPTION, and delivers transcription events only. Both AI routes send the transcript through the existing guarded turn pipeline. An installed file player is not a streaming conversational audio queue. The requested true live target requires session audio output, endpointing, barge-in/echo handling, queued-audio cancellation and composite audio-session ownership. A TTS reading of a saved authoritative assistant message could be an intermediate implementation, but is not silently substituted for the requested live conversation. Current budget accounting has LLM/STT only; model/spending, named server application and any paid probe remain concrete gates. No provider call or server change was made.

### Useful profile facts and bounded map clarity

The owner asked for faster connected finishing and useful information such as completed work and earnings. Profile now reads the existing public trust projection for each actual role profile, independently of identity and reputation, in parallel. The summary labels completed Agreements separately for working and publishing roles; it does not count unique tasks. Loading, unavailable and valid zero remain distinct. Profile IDs, role, safe integer count, account revision and focus are checked. No new server query/function or guessed earnings field is introduced. Agreed prices are not confirmed payments; earnings remain unavailable until an actual authoritative contract exists.

The existing list/pin entry already shares the same guarded task-opening path and warm-return state; that flow is retained. The bounded map polish allows long/large-type result and recovery wording to wrap with clearer spacing in the measured results-sheet header. No new P6 proof or functional reopening is implied. The voice-mode glow now uses the reference's discreet blue. These are source changes after c64dc8bd, not evidence for APK37034535430, which builds that earlier exact source.

### Exact emulator layout observation and next source refinement

APK37034535430 atc64dc8bd built successfully, artifact and installed SHA256 match. Recovery/icon/Reanimated attestations pass. Updated only USKOCI_V5_TEST with install-r; the account session survived. Actual opening and idle voice-mode screenshots received separate bounded UX and VISUAL source/still reviews: no clipping or overlap, compact ordinary composer fits, controls/review remain reachable and the text-only reply disclosure is truthful. No microphone, paid generation or message probe was performed. Voice-mode hierarchy extraction failed while the screenshot remained available; no automation/native-functional success is inferred. Sanitized receipt: VOICE_COMPOSER_APK_37034535430.json.

The review identified decoration competing with the actual microphone: subsequent source caps the decorative waveform width at120dp and gives the unchanged52dp microphone a dark primary surface. The ordinary composer remains unchanged. Discovery quick chips now consistently get their own full-width row beneath the persistent48dp Filteri/menu toolbar; folding reclaims the measured rail plus gap. A proposed new window-width breakpoint was rejected in independent review in favor of this one layout. P6 reader, filters, handlers, selection and Back restore remain unchanged. These source refinements, profile counts and blue glow are not included in the observed APK.

Automatic P5 run37034505155 (c64dc8bd) passed419 suites/9222 checks and failed3 existing expectations: previous-answer visibility, generation-specific temporary voice filename, and asynchronous microphone teardown before protocol release. Three minimal expectation corrections retain business/cleanup/finalization assertions. No new test or manual rerun. The worker-exit warning remains unattributed and the failed run is not called green.


### Automatic R20 workflow classification after source5110ed03

Automatic [run37037926592](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37037926592), exact source5110ed036ae8722f396d48a27b1a4804501c838d, stopped in **Focused Discovery lifecycle regressions**:158/159 checks passed. The single failure is discovery-presentation.test.tsx:2300 expecting the selected quick-filter tick to remain green (#076E4E); the intentional current DiscoverySearchBar uses ink (#202020). The minimal correction updates that color expectation and its nearby obsolete palette comment. Selected styling, interaction, 48dp removal targets, mount, scroll, restoration and business assertions stay intact. This log does not demonstrate a retained-mount product regression. Later workflow stages are not accepted by this result.

Earlier [run37035707773](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37035707773), exact sourcee6427075aba969d16fff35a5670b9c21b1154a33, stopped in **Full regression**:418/422 suites and9221/9225 checks passed,6snapshots passed. Three failures are the already classified voice expectation changes (answer remains visible, session-specific playback filename, asynchronous microphone teardown before release). Their corrections are now in current source. The fourth is an actual source-contract violation in ProfileWorkSummary.tsx: its independent width<360 read bypasses the shared layout rule. The source correction uses useLayoutClass(), retaining rounded large-text handling and the shared340dp narrow boundary; ordinary340â€“359dp layouts therefore follow the common compact rule. Counts, role/account/focus/revision validation, requests, recovery and handlers do not change. The one-token-source ratchet is not relaxed.

Review used existing logs and source only. No new tests, manual workflow, device interaction or live call was started. The corrected candidates are not yet a green CI claim; statements after the failing assertions remain unexecuted in those runs. The older log also warns about unfinished asynchronous work after Jest; cause remains unattributed. R20/P6 functional closure is not reopened by these expectation/source-convention findings, and no new native acceptance is asserted.

### Connected hierarchy and source cleanup continuation

Pending Agreement change proposals now lead before the complete current terms, preserving new/old facts, review steps and every handler/guard. Neutral action tone, ink amounts and24dp art align the screen with the owner palette. DiscoverySearchBar removes two constant-true branches and three unused private styles while preserving actual node order, measurements and callbacks. ProfileWorkSummary follows the existing shared narrow/large-type layout rule. TypeScript passed after these four integrated files; no new test run, server write or native acceptance.

RC02 photo-cancellation lock-order correction and exact revert are packaged under `supabase/candidates/ex05-rc02-20261002/`, SOURCE REVIEWED / NOT APPLIED. Read-only preflight at17:12:43UTC matched7/7 pins, live digest and both stored certificates; retention ready. Candidate is not concurrency-executed. See APPROVAL.md for precise impact, wait semantics and named server approval boundary.

The compact source-task context inside Agreement history is now an open row with full readable title and24dp artwork, rather than another floating card competing with messages. The standalone overview keeps its card. All facts, authoritative routes, disabled guards and callbacks remain. TypeScript passed again after this fifth source file; no new Jest or device run.

Build37037950035 succeeded at5110ed03. Downloaded APK SHA256 `b615960eaf26a7076d185beae98209e865a4029609e8ccd6c1f26cdaeb2d2047`, embedded bundle, source/tree bindings and signature match; recovery/icon/Reanimated attestations PASS. It is an x86_64 DEV emulator build, not a store artifact, and has not been installed. Receipt: FINISHING_APK_37037950035.json. The five newer source corrections above are outside that artifact.

Owner subsequently answered **PRIMENI RC02 DEV** to the concrete package, explicitly informed that no new concurrency execution had been performed. This authorizes only that named DEV application; application/readback evidence will follow separately. No production or broader server permission is inferred.


## RC02 DEV application — 2026-10-02 17:25 UTC

Owner explicitly approved PRIMENI RC02 DEV. Applied exact committed candidate7912806f as migration20261002172532 dev_alpha_ex05_rc02_media_cancel_lock_order. Postflight: new target body043f8cfb2cbe68e6f791e1be23ca14cc and six unchanged sibling pins PASS; all seven non-body catalog hashes/comments unchanged; live and both stored certificate digests remain0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431, retention_ready=true. Ledger222/74dev_alpha and stored SQL SHA256 match the committed candidate without final LF. Receipt: supabase/operations/dev-alpha/ledger/20261002_ex05_rc02_application.receipt.json.

This supersedes earlier NOT APPLIED status for RC02 only. The candidate was not run through a new concurrency or device exercise; original EX05-S02 evidence reproduced the old defect. All valid cancellation branches now wait on the conversation lock; existing in-flight transactions can still use the old body. No business RPC/provider/Edge/production/data deletion/certificate rebind. Other packages and owner gates remain.

## Connected location, profile and support finishing — later 2026-10-02

The owner's latest direct location instruction supersedes the earlier conversation-only no-address-adoption/tap-only reverse-lookup UX: one proposed map pin; explicit confirmation; a compact saved item with a green check; correction by moving the pin; one completed task card at the end. No invented point and no unbounded result list. White reading surfaces, ink headings and muted supporting text remain the palette.

In the conversation editor, a committed map tap or drag release immediately changes the draft coordinates, clears the former address, and asks the existing authenticated resolver for an address. It does not issue a request on each movement frame. A reverse result labels that exact chosen point; the provider's nearest coordinates never replace it. Later edits, another point, account revision, blur, disable and unmount retire old results. Manual address entry cancels the lookup; failure leaves the point with an honest unresolved-address message and retry. Confirm remains guarded while lookup is pending. The existing full manual form retains explicit address adoption.

The initially proposed candidate and an explicitly selected alternative populate the private address visible before confirmation. At most three alternative rows appear per page, behind correction; every admitted result remains reachable. Missing position says **Lokacija nije određena** and does not create a marker at the world viewport center. A temporary disabled state now restores saved address and saved coordinates together.

Only a successful canonical save collapses newly confirmed location into the saved summary. The existing account, revision, slot, binding, retry and uncertain-save behavior remains. All route points remain distinct. For a changed STATIONARY/start point, the same confirmation updates the task's private exactAddress and its resolved-location binding atomically through the existing RPC; an unresolved new address clears the old one. Reconfirming an unchanged saved point preserves existing top-level private text. Route/area-wide text is not replaced by one component point.

The map now occupies open white conversation context instead of the recovery panel. When the unchanged readiness checks pass, the single task summary moves to the end of the thread with its real public facts and two entries: **Pregledaj i objavi** and **Izmeni**. Both use the existing guarded editable review; the first accurately names that remaining review step rather than pretending a direct publication happened. Bound-task changes say **Pregledaj izmene**. Missing zone is explicit; actual remote work still says **Na daljinu**. Precise owner/agreement location remains private; public detail/Discovery retain the approximate projection of the saved point.

Worker profile fields now use shared responsive layout, neutral selected controls, actual 48dp term targets and open sections, with warning meaning retained. Support requests lead with topic and show a neutral recorded decision (DECIDED does not imply acceptance). D12 comments fix an actual revocation bug: a successful null on load-more clears all previously displayed comments, while transport failures retain retry. D12 remains flag-OFF; role/blocked-author backend contract is not activated by this client fix.

Existing automatic R20 [run37040460119](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37040460119) passed on **7912806f**:159 focused checks and422 suites/9225 checks/6 snapshots. That result closes the earlier scoped CI reconciliation, not this later source batch. The delayed-Jest-exit warning is still unattributed. Existing expectations are being reconciled to the changed UI/confirmation contract without removing ownership, privacy, navigation or save assertions; no new tests or manual Jest run.

The owner also clarified the two AI controls: the adjacent microphone sends held speech on release for a text reply; the far-right waveform must open a real spoken conversation on a single tap. Current waveform still uses the transcription-only controller. True live spoken AI is not implemented by this location/composition package, and TTS is not being presented as its substitute. No provider probe, new dependency, server deployment, production release or phone acceptance occurred in this source pass.

Typed whole replies **to je to** / **nije tu** (including Cyrillic and optional final punctuation) now invoke the same guarded confirm/correct actions only for the single visible point. The local prompt states which pin they refer to. No missing/loading/disabled/multi-slot point advertises confirmation; stale or invalid activation retains the input and never falls through into an AI turn. Accepted activation retires synchronously. Ordinary messages and existing voice guards remain unchanged. Direct held-speech map confirmation is still open: that route bypasses presentation and currently disables/reset location editing while speech is busy. The compact saved summary uses one wrapping map/edit row and keeps close-overview behind expanded map.

Independent source review found no duplicate final-card mount, callback-registration loop or newly bypassed ownership/save guard. The existing save receipt requires sameNeedLocation; review acceptance retains normalized points; materialize_resolved_location stores E6 coordinates privately and derives public coordinates rounded to two decimals. Public detail reads priblizno/coarse; Discovery only admits the rounded point and task ID. This is source-chain evidence, not a new live publish or native-flow observation.

Final integrated TypeScript compilation passed (`npx tsc --noEmit`), and diff whitespace checks passed. Four existing UI test files received expectation reconciliation; no new tests or manual Jest run. The existing 62-row LIVE plan and control projection were regenerated and consistency check passed; local generation does not claim publication to the external Claude artifact. New APK/native acceptance remains pending.

Runtime source committed and pushed as **4046bae3e4a3516e2eb11c3363919fad54c11052**. The consolidated emulator APK [build37045193094](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37045193094) was dispatched with target=emulator and reanimated_patch=apply; GitHub confirms that exact source. Snapshot18:07UTC: IN_PROGRESS, no new artifact/native acceptance yet. No manual regression workflow was started.

### Natural location replies — source connected, activation pending

The owner's correction supersedes the fixed-phrase bridge above: the person answers naturally to the current place question. That local parser and its phrase instructions are removed. The existing AI interview receives an additive `locationReply` request containing the actual question, active route slot, proposal incarnation and location-review revision. The model never receives or supplies coordinates. It can confirm the displayed proposal, correct ordinary geography/address facts, clarify ambiguity, or continue the conversation. A confirmation requires an actual proposal, ALLOW and zero fact proposals; the client additionally requires the same live one-use map context before invoking its existing guarded point confirmation/save.

Typed replies and held-speech transcripts share the existing command ID, opaque journal and recovery path. Capture binds the map question before permission/capture starts. Temporary speech/AI interaction lock preserves the displayed pin instead of treating speech as a disabled editor reset. Background, account, focus, point or revision changes retire that binding. A restored/retried receipt with no live binding cannot confirm another pin. On terminal failure/cancellation, contextual spoken text remains available for explicit restoration. Accessible reviewed speech retains its existing behavior. Route confirmation applies only to the active point, preserves accumulated points, and awaits the existing save only when all required points are complete.

One geocoder candidate may be proposed. Multiple candidates leave the location unresolved and ask for a city or more precise description; none is automatically selected. The context carries at most three bounded alternative labels for clarification, not as an invitation to select a hidden ordinal. A confirmed point still has its compact saved view, map and edit action. Corrections reuse ordinary validated AI facts and canonical readback, then the existing real geocoder; there is no second search authority or model-created pin.

Fresh read-only DEV source confirms `need_location_review_document` hashes location facts and conversation identity/status/binding, not messages or timestamps. Therefore a no-facts confirmation turn retains the save revision; actual concurrent fact changes still reject the old save. Existing deployed Edge v50 and three AI turn SQL bodies match the baseline code. Zero executing closures, zero processing AI turns and zero location receipts were observed; this is a dated read, not a deployment guarantee.

The client is behind `EXPO_PUBLIC_AI_LOCATION_DIALOGUE`, default OFF. The named **AI-LOCATION-01 DEV** server/technical-certificate candidate is prepared separately under `supabase/candidates/ai-location-01-20261002/`; it is NOT APPLIED. Ordinary map buttons remain available. Activation requires the existing exact owner application gate and matching client build. No new dependency, model/provider, raw-content table, retention policy or production setting is introduced.

Independent client and backend source reviews covered stale replies, ambiguity, command/replay identity, shared budget, receipt recovery and unchanged point-save authority. Integrated `npx tsc --noEmit` passed; no new tests, paid calls or native execution were performed. True live spoken AI remains unfinished and is not claimed by the held-speech integration.

The earlier [APK37045193094](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37045193094) has now succeeded. Its downloaded SHA256 and recovery/icon/Reanimated attestations match exact source4046bae3. Receipt: `LOCATION_APK_37045193094.json`. It is not installed and does not contain this later natural-language package.

### AI-LOCATION-01 owner-approved DEV activation

Owner approved application and requested a phone APK. Migration20261002185306 applied the exact frozen candidate and isolated technical certificate transition; ledger223/75. Readback matches13 candidate bodies,3 unchanged definitions,17 function catalogs/ACLs and the sole readiness-digest replacement. Current certified/live digest3a785d42 agrees in both bindings. Existing AI Edge deployed asv51 with JWT verification retained; all five returned files match frozen hashes. The new client flag is enabled only after that readback. Phone ARM64 APK with Reanimated patch is the next artifact. Application receipt and limits: `supabase/candidates/ai-location-01-20261002/APPLICATION.md`. No paid provider probe, new test, native business mutation or phone acceptance is inferred from deployment.


## AI-LOCATION-01 phone delivery — 2026-10-02 19:19 UTC

Build37051296452 succeeded on exact source6fb39b301888527350701741c659bb32cbe617bd. ARM64 rs.uskoci.dev APK SHA-256 712b157892777b8131745ddf3cf0b88c556d3b6e5139bf8ab68f3f23c1fa0863; recovery/icon/Reanimated attestations PASS. Owner explicitly requested installation; HONOR returned Success for adb install -r and installed SHA matches. Existing UID and firstInstallTime unchanged. No data clear, uninstall, app UI navigation, paid provider probe or whole-flow/native acceptance. [Receipt](AI_LOCATION_PHONE_APK_37051296452.json), [owner guide](PHONE_TRY_AI_LOCATION_20261002.md).

Three existing CI test expectations were reconciled after source review: missing voice-controller subscribe mock, ambiguity-first map presentation, and privacy-null comment withdrawal. No runtime changes in that reconciliation, no new tests or manual rerun; passing suites are not claimed. This documentation/test-only follow-up does not replace the APK source.


## Voice visual follow-up after phone delivery — source only

The person must be able to distinguish speaking, waiting and idle without a decorative loop implying capture. Existing Gemini capsule, hold gesture, separate voice-input mode, 52dp targets, compact 120dp glow and all sending/recovery handlers stay unchanged.

| Before | After | Why |
| --- | --- | --- |
| Voice glow breathes whenever no level is supplied, including idle and permission failures | Only real listening levels drive native transform/opacity timing; idle, missing/non-finite level, background and reduced motion stop it | Show actual capture activity; remove needless continuing animation |
| Review checkbox label cannot shrink alongside its box | Label can shrink and wrap within the existing 48dp target | Keep the option readable on narrow and larger-text screens |

TypeScript `--noEmit` PASS; `git diff --check` PASS. No new tests or manual test runs, no server/provider/controller/gesture change. The phone still has verified source6fb39b30/build37051296452: this follow-up is NOT in that installed APK and has no native acceptance yet. Source review confirms 2.5D FactArt is already used by AI marks/openings, task/application/Agreement facts; the Lottie wrapper has no screen consumer, so an animated robot is not active. The previously rejected robot is not integrated. Real spoken AI remains open.


## Owner screenshot response — own task and speech errors

Owner phone screenshot rejects the installed source's own-task hierarchy and shows real AI/speech failures; read [the incident record](OWNER_PHONE_FAILURE_20261002.md). Keep this distinct from prior scoped visual receipts.

| Before | After in source | Why |
| --- | --- | --- |
| Applications appear as another ruled fact | Separate white rounded action surface with32dp artwork and exact count | Distinguish the next action from reading |
| Small green/gray pictures compete with equally strong full-width facts | One white logistics/price summary, full wrapping text,28–32dp blue/gold/coral artwork | Give facts an intentional grouping and recognizable illustrations |
| Status/section headings compete with the title and price | Quieter status and section typography, same title/price authority | Establish reading order without hiding information |
| Service failures say generic capture failure; transport errors blame microphone | Trusted service refusal and lost connection have different local error messages | Explain known cause without inventing a billing diagnosis or changing retry permissions |

Scope is one own-task presentation plus existing voice presentation/error handling. No shared public-detail redesign, new illustration asset set, robot, spoken AI replies or full-app visual completion. No existing data, callback, price/basis, privacy/map rule, gesture or recovery authority is removed. New source is not the already installed6fb APK until a separate exact build/install receipt says so.


## Continued marketplace review after owner rejection

Latest owner requests whole-app composition, selective material/colorful artwork, cleanup and iterative emulator inspection. This supersedes the prior no-manual-check restriction for the requested emulator review. Existing 62-row registry remains authoritative; this is not a new master. Owner reports provider credit was paid; earlier 402 evidence must not be represented as proof of current unpaid credit or as the cause of every client defect.

Implemented source batch:

- Removed production opening suggestions in both AI interviews: they disappeared during microphone preparation and returned on cancel, causing a visible composition jump. No evidence of a microphone-triggered network reload was found.
- Deduplicated unchanged conversation geometry callbacks and rejected non-finite measurements. This reduces redundant scroll commands; no measured performance improvement is claimed.
- Reset the retired unsaved-pin lookup marker when recovery disables its editor. Existing account/focus/outcome fences still govern the next lookup; saved points are never replaced automatically.
- Public task detail uses account incarnation rather than every auth-token event as its identity. Same-account refresh no longer deliberately remounts the detail/map/profile surface; account changes still retire it.
- Application journal read failures block a new command and offer a reread. Retained-command conflicts no longer falsely instruct users to free disk space; the original durable command remains authoritative.
- Own-task applications are a distinct action card; logistics and amount form one clear group. Discovery list and pin lead with full title and truthful price/capacity, followed by larger blue/gold/teal facts. No fabricated prices, cropped full-list titles or changed callbacks.
- FactArt larger illustrations use cached static light/face/edge gradients with semantic subject colors. Explicit muted/danger/brand tones and small solid-mark contrast remain. Ordinary chat uses people color; AI explicitly uses purple. No raster downloads, new packages, SVG animation or continuous art loops.
- Shared own-message surface is charcoal; agreement-chat controls are ink. Welcome typography is quieter. Recording glow follows measured audio only through native-driver opacity/scale and stops in background/reduced motion.
- Speech service/transport/capture failures now have distinct copy. AI availability diagnostic client remains compatible with live old Edge. The two modified Edge sources are UNAPPLIED; no deployment, billing or budget changes were made.

Research: [Airbnb's official redesigned app](https://news.airbnb.com/product-releases/airbnb-2025-summer-release), [Apple design foundations](https://developer.apple.com/videos/play/wwdc2025/359/), [Apple UI typography](https://developer.apple.com/videos/play/wwdc2020/10175/). Used for hierarchy, reading order and restrained material details, not copied logos/assets.

Explicit remainders: live speech failure root cause not yet proven; true spoken AI replies absent; no animated robot added. Saved map natural correction still requires Izmeni: a scratch lease was rejected because it would re-ask confirmation after a completed save and misuse pending-PROPOSAL semantics. Multi-stop corrections must never guess a slot. Candidate price sorting of partial pages needs separate correction. Account/privacy/operator/review/store work remains as recorded. No complete-app, native, phone or store acceptance is claimed by source edits.

Verification plan: one consolidated exact-source emulator APK, inspect actual AI entry/list/pin/detail and recovery surfaces, then fix observed defects. Baseline emulator image is older source (APK SHA256 1fd629b08bdec7e9e7e02a6a58afba6a157ef5df2fd60430e7359e2506c897d6); it is not new-batch evidence. Owner phone still carries 6fb39b30 / run37051296452 until a new installation receipt exists. No new provider inference, business mutation, new test case or manual regression suite is implied.
