# Home and personal worker continuation — 3–6 October 2026

## Scope and sources

Latest owner direction: finish the dimensional Home action artwork/composition, with text to its right, and continue the existing refinement plan. Existing Expo application, one account, two equally prominent Home intentions; no new prototype or backend behavior.

- Home source `dd25f6983e58276477959d7e59599728a5388826` was pushed before the external GitHub interruption.
- Combined client source `b773da8e2160cd39c7723745b94a4bfea3bc40bc`, tree `e6e87db6879be6d8ae587ee08f9481bec68fe30f`, is committed locally. GitHub API on 6 October returns HTTP403: `Sorry. Your account was suspended`. No later push or remote build success is claimed.
- Native critique produced a first-setup correction in local source `d993ad61999e22c1291ef3107bfe9e99dadaba6f`: one introductory section and one primary conversation action. A further independent Home critique led to `42da3d4028e8f346c34e59da4c5a5c22fe12941a`, reducing excess large-text height and removing an incomplete combined attention count. The d993 build was deliberately interrupted before install to consolidate these corrections; the exact42da APK was subsequently built, installed and reviewed below.
- Requested remote emulator build37160107912 is bound to dd25. Its last readable state was building; the final result/artifact cannot currently be fetched.

## Composition and interaction

| Before | Change | Purpose / preserved behavior |
| --- | --- | --- |
| Home illustrations to the right at80dp | Both original dimensional subjects lead on the left at96dp;64dp in narrow/large-text mode | Text to the right, equal neutral raised surfaces, original actions, loading and account boundaries |
| Large-text actions reserve four lines even when labels occupy two | Minimum follows art plus padding or actual one-line title/body allowance; wrapping may grow naturally | Removes unnecessary empty space without fixed heights or truncation |
| “Čeka te1” visually includes both a server attention row and an independently due rating | Show a numeric count only when the rating read confirms zero due ratings | Keeps all attention/rating rows and remaining count; never invents a combined total |
| Absent pristine worker profile offers an empty manual save | Primary opens the existing guarded AI conversation | Manual changes still offer first save; saved DRAFT activation and unknown-write recovery are unchanged |
| Native first setup starts with a warning/checklist and two conversation entries | Short illustration-led introduction, with a single conversation action in the footer | Existing manual sections remain; saved profiles still receive their real activation checks |
| Back closes the manual AI panel immediately | Toolbar and Android Back ask before discarding a changed local form | Continue retains raw text; clean Back stays direct; busy/unknown write cannot be abandoned |
| Privacy unmount removes local manual fields | Owner/conversation-scoped RAM retains raw values through background/resume | Fields stay hidden in the background; account/conversation changes retire them |
| Refreshed proposal may replace the form revision | Retained old input is shown read-only with a conflict explanation | No silent rebase or patch; explicit discard is required |

The existing internal profile gallery's first-setup label now matches the conversation entry, and its obsolete permanent-team-capacity scene is removed. This gallery is presentation evidence only; its actions do not save or call a provider.

Home remains the decision between posting a task and finding work, followed by actual account attention. The layout changes no navigation targets, task facts, map selection, push setting or provider. Decorative artwork remains outside the accessibility tree; each whole door is a single button. Existing press feedback, haptics on completed taps and reduced-motion behavior remain.

## Focused verification

- Home route and internal Home gallery:55 checks in2 existing suites PASS.
- The final42da Home correction reran those same42+13 cases and TypeScript: PASS. Independent source delta review confirmed zero/positive/unknown rating semantics and preserved routing.
- Personal-profile route and onboarding:60 checks in2 existing suites PASS.
- Worker AI recovery/manual review:81 checks in2 existing suites PASS.
- TypeScript and diff checks PASS for the combined client source.
- For the d993 first-setup correction, TypeScript and independent branch/route review PASS. The first run of the existing profile suite exceeded its5s timeout in the Android initial render (59/60 cases passed across both suites); a focused rerun passed all52 profile cases without changing timeouts or test code. The other8 onboarding cases passed initially.
- Manual coverage includes toolbar/hardware cancel/discard, reverting to pristine, pending/unknown patch, stale callbacks, background/resume values, new candidate revision, account scope and privacy-unmounted form liveness.

These are source-level checks. RAM retention is not process-death persistence. New provider, message, profile save, notification preference write or push send has not been performed.

## Native build and review

Exact b773 was built locally with the existing locked dependencies, JDK17 and Android SDK: Windows release x86_64, DEV package `rs.uskoci.dev`, workflow feature flags, no dependency upgrade. APK SHA256 `5be72d71939ea21b71d7ee8bb7e8119f5cf2eaba4804e6efeb786c8b791f4b55`. Recovery redirect, launcher/monochrome/template absence, compiled Reanimated4.5.1 patch and signing compatibility passed. `adb install -r` preserved UID10227, session and account data. Local source checks compare exact committed content after CRLF/LF normalization and retain both byte hashes; this is not a GitHub build.

Actual Home was inspected at font1.0,1.15 and1.3 on the1264×2728/density560 emulator. Both launch actions have equal widths and heights within one physical pixel of layout rounding. Illustrations lead on the left; titles remain readable without clipping. Large-text mode uses the compact64dp art. Existing avatar, attention counts and four navigation destinations remain. The lower Agreement section scrolls naturally into view.

The actual “Uskoči i zaradi” action opened Discovery and loaded its seven tasks. Android Back returned to Home with the same visible account content. No task was applied to, published, edited or saved. Map/pin implementation was not changed in this slice.

Private native evidence is under the task workspace `native-w2/`:

- Before: `home-before-left-art-100-final.png` (old1a03). Earlier similarly named captures containing a system dialog/loading are excluded.
- b773: `home-b773-100-loaded.png`, `home-b773-115.png`, `home-b773-130.png`.
- Route/back: `home-earn-b773-discovery-loaded.png`, `home-b773-after-earn-back.png`.
- First-setup critique: `worker-b773-first-130.png`. This is the existing inert native gallery, not a live worker save or provider conversation.
- Exact build/install/attestation records are preserved as `local-*-b773.json`; new build records use separate current filenames.

The first-setup fixture exposed an unnecessary warning-first hierarchy and duplicate AI actions. d993 removes those only when no profile exists; DRAFT/ACTIVE/SUSPENDED and manual save logic are unchanged. Independent Home critique accepted unclipped content but rejected excess1.3 height and the ambiguous mixed-action counter;42da corrects both. The final exact APK and visual recheck are recorded below. Manual AI Back/background/revision behavior has source coverage, but has not been newly exercised against a live provider on the emulator.

## Final exact local checkpoint

Source `42da3d4028e8f346c34e59da4c5a5c22fe12941a`, tree `9d585b0cf3aa0bbabb3de6d1fc88f444eeaee12c`, APK SHA256 `27f8ada49fb0fc58aaa5c35058bc341556af7647ea2a2f61cc8cf0c71bff203d`. All four artifact/signing checks passed, including the source identity embedded in `assets/app.config`. Installation preserved UID10227 and account data. The final build reuses the successful d993 native preparation: the exact Git delta contains only Home presentation and its existing test. Native inputs/dependencies are unchanged, and Expo regenerates the embedded config for42da on every build. Interrupted d993 receipts/logs and the installed b773 APK were preserved separately.

Exact42da emulator Home retains equal raised launch actions with dimensional artwork left and text right. Ordinary1.0 action layout was inspected in a partial-read state; loaded1.15 and1.3 were inspected separately. Large-text actions no longer reserve four empty lines, and mixed attention/rating content has no incomplete numeric heading. Actual Uskoči i zaradi opened Discovery: eight tasks and subsequently the map loaded. Hardware Back returned to actual Home, with attention/rating content and the same account. Inert first-worker-profile native scenes at1.0 and1.3 show an open introduction and one sticky AI action; a scrolled1.3 scene preserves manual sections. No business command, AI call or save was issued.

Independent visual/UX review: Separate source and native review accepted the42da Home height/count correction at1.3, final Home at1.15, and first-profile gallery at1.0/1.3: no clipping, overlap or new visual blocker. The final Discovery image shows the map and eight tasks but is not whole-map flow acceptance. Attribution length and cold/partial Home reads remain open. These reviews do not prove provider/save behavior or a loading fix.

Open observation: cold and partial Home reads failed intermittently during font/activity recreation. Manual retry and a later recreation recovered the data. Failure screenshots are preserved in the receipt. The cause is unestablished; successful screenshots do not demonstrate a loading fix or reopen P6 on their own.

Final emulator state: Home, font1.15, motion1. The actual Home read and route/Back check are separate from the inert first-profile fixture. Exact image hashes and bounded limits: [native receipt](HOME_WORKER_NATIVE_20261006.json). No physical phone, provider journey, new push delivery or entire-app acceptance follows from this checkpoint.

## Backend continuation

The isolated workerV2 foundation is committed locally as `38ada0e4` under `supabase/candidates/worker-personal-v2-20261003/`. It adds canonical desired/declined work groups, descriptive notes and urgency preference, a private writer, one dispatch filter for detailed/cheap readers and compatible pause/resume. These files are not a deploy-ready package or a public application endpoint. The full versioned interview/review/save/export/closure rollout remains open.

Independent review found editable-profile status, closure-lock ordering and full helper metadata pin gaps. All three were corrected and passed a separate delta review: closure → profile → preferences lock order, only DRAFT/ACTIVE profiles, exact signature/overload/security metadata checks. Candidate SHA256 `20c4d420642f50731a390c4b11bcf01ab12c03eeaa07ac8d08fccddfd336df65`. Eight source/grammar checks and18 contract cases pass;15 disposable cases and a manual workflow are prepared, but PostgreSQL and CI execution are **NOT RUN**. No DEV/Edge change, certificate admission or live preference/push result is claimed. See `SQL_SOURCE_CHECKS.json` and the V2 contract for exact boundaries.

## Remaining boundaries

Whole-app consistency, physical phone, actual unauthenticated entry, performance and store acceptance remain open. Previous Android push evidence retains its original scope; new interview preferences are not claimed to drive live dispatch yet. Existing remote dashboard file-picker publication issue is not resolved; local generated tracker is not hosted publication. GitHub account recovery is an external owner action, not an application code fix.
