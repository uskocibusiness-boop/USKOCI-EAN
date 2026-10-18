> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../design-system/PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

# The V28/V31 prototype look, transferred into the app (2026-09-22)

## Owner decision

On 2026-09-22 the owner supplied two HTML prototypes and asked for them to be compared. The request
was to say which is better where, and whether they can be used in the app. The review found:
- V31 is V28 with three density layers on top.
- V28 reads better but is too large: a task card is about 280 px tall at 412 px width.
- V31 fits three to four cards on a screen, but gets there by shrinking secondary text to 9.5 px and
  adds noise ("0 prijava", "Bez recenzija").
- The five Lottie animations are hidden in both prototypes by a background circle drawn over them.

The owner then asked, verbatim: "a generalno možeš li identičan izgled i ceo sve dizajn slova i to da
preneseš u app". The answer listed:
- what transfers exactly;
- what cannot be identical (blurred glass, the OpenStreetMap raster tiles, fixed width);
- what should not be copied (prototype defects).

It also asked three questions: which version is the model, whether to bundle Inter, and who does the
work. The owner answered **"može"**. It is recorded here as:

1. **Model: the recommended proposal.** V28's anatomy at V31's size ("V32"): cards around 150–190 px,
   the price as the strongest element, and secondary text never below 12 px. Zeros and missing ratings
   are not drawn. The slot counter is calm and turns orange only when it needs the owner's attention.
2. **Letters: Inter**, bundled so every phone draws the same letters.
3. **Who: Claude** does the visual transfer in this worktree. Codex should not edit the same UI files
   concurrently.

This supersedes two earlier records:
- The 2026-09-20 note that the HTML is "a starting direction, not a pixel lock". The look is now to
  match the prototype, except for the defects listed below.
- The colour and font line in `DESIGN_SKILLS.md`.

It does not change the locked entry, the mascot or its motion, business rules, or any server
contract.

## Sources

| file | SHA256 |
| --- | --- |
| `C:/Users/user/Downloads/USKOCI_V31_BALANCED_PREMIUM.html` | `6870214a7b728830521932a4de7feef9c3003c6e8629bfa69b3212d133a63945` |
| `C:/Users/user/Downloads/USKOCI_V28_PREGLED (1).html` | `29fbe6cbdcf333fc9594ab3c552871b444ea9e16bb9884f13d0ba36c35337314` |

The measurements were taken on both files rendered at 412×900, with computed styles read in the browser:
- **Task card** (Zadaci / Prilike list): V28 is 283 / 278 px, title 22 px, price 21 px. V31 is 165 /
  121 px, title 19.5 px, price 18 px.
- **Task detail:** V28 title 29 px, V31 24 px. Everything else is identical: price label 28 px, body
  15 px, section heading 17 px.
- **Smallest text on list screens:** V28 11 px, V31 9.5 px ("popunjeno"). The app's floor stays 12 px.
- **Lottie assets** (`V24_ASSETS`): success, signal, thinking, empty and connection. Each is 160×160,
  60 fps, 1.5 s and one layer. Their background circle is painted over the artwork, so each renders as
  a pale disc. Hiding the disc shows the checkmark, voice bars, three dots, empty box and two joining
  dots.

## What was not copied, on purpose

- Text below 12 px, and the zero and empty chips ("0 prijava", "Bez recenzija").
- The Lottie layer-order defect. The five motions will be drawn natively with react-native-svg and
  Reanimated, which are already installed. No Lottie package.
- Demo-only concepts: "Organizovao", "Čuvanje i lokalna kopija", "Vraćeni nacrti", "Termin nije
  sačuvan u prijavi", and inconsistent demo counts.
- Buttons without an accessible name.
- OpenStreetMap raster tiles. The app keeps its MapLibre/OpenFreeMap map; tile policy forbids the
  other.

## Slice 1: foundation (this change)

- **Inter 4.001** (SIL OFL 1.1) in `assets/fonts/inter/`, with the licence beside the files:
  - Regular, Medium, SemiBold, Bold and ExtraBold, with PostScript names equal to the file names.
  - The files are from the owner's local design-reference package. Name table: "Version
    4.001;git-66647c0bb", 2,850 code points, č ć š ž đ Č Ć Š Ž Đ present.
  - Embedded natively by the `expo-font` config plugin in `app.json`. The CI APK runs `expo prebuild`.
  - Loaded at runtime on web only (`src/ui/loadInterWeb.web.ts`).
  - `T` draws every word in the Inter face its weight asks for (`src/ui/interFont.ts`) and removes
    the weight key. Otherwise Android and the browser embolden a bold face a second time, and iOS
    resolves an explicit weight back to the regular face.
- **Palette** (`src/ui/system/tokens.ts`) takes V28's colours as they render, not V31's.
  - **Why:** the owner told Codex the same day that V28's colours, coloured illustrated icons and
    inset navigation must survive (`DESIGN_V31_V28_EXECUTION_20260922.md`).
  - **Measured** from computed styles at 412 px:

    | role | value | where it was measured |
    | --- | --- | --- |
    | ink | `#202723` | screen title "Zadaci" |
    | muted | `#5E6D64` | the note under the price |
    | action green | `#076E4E` | primary button with white text, 16 px corner, 52 px tall; the big price on the detail screen |
    | money | `#087B57` | card price |
    | selected tab | `#EFF6F0` | |
    | orange | `#FA8229` | the "+", with dark `#30200F` on it |
    | orange-soft | `#FFF5E9` | |
    | hairline | `#EBEEEA` | |
    | card edge | `#D8DED7` | card with a 21 px corner and shadow `0 5 18 rgba(23,59,39,.063)` + `0 1 2 rgba(23,59,39,.027)` |

  - Every text pair meets WCAG AA, with the ratios recorded in the file. White on the orange is 2.5,
    so text on orange stays dark.
  - V31's palette differs from V28's only slightly (ink `#172F27`, green `#087957`, orange `#F27619`).
    It was the first attempt and was replaced within this slice.
- **`FactArt`** (`src/ui/system/FactArt.tsx`): the prototype's twelve two-tone icons (`v17ArtPaths`),
  transcribed path for path.
- **`TaskCard`**, the V32 anatomy:
  - title, then where and when on one wrapping line, then a hairline;
  - the price in 20 px with its basis underneath ("po osobi · ukupno 6.000 RSD", "ukupno za ceo
    zadatak"), a missing price in quiet text, and places as "x/y popunjeno";
  - a condition chip with "+N", and "N prijava za pregled" only when applications wait;
  - the publisher with a rating only when one exists.
  - V28's surface: the corner, edge and two-layer shadow above, drawn with `boxShadow` (RN 0.86).
  - The rendered card is 140–175 px at 412 px width.
  - **Relation to Codex's card study** (`outputs/design-v31-v28-20260922/PREDLOG.html`):
    - This card follows its "Balans" family: a full-width title, facts, then the price with its basis
      and the people, then who or what comes next.
    - It keeps V28's artwork, as that document requires.
    - Its alternative wording for places ("Još 2 mesta") and for a missing rating ("Još nema ocena")
      is an open choice for the owner. This card shows "x/y popunjeno" as both prototypes do, and draws
      nothing when there is no rating.

### Verification

- `npx tsc --noEmit`: clean.
- Jest: the marketplace, discovery-map and PKG-011 presentation suites pass. The full run is recorded
  in the commit message.
- **Web smoke:**
  - It runs Expo web with `EXPO_PUBLIC_USE_FAKE_SOURCE=1` against an unreachable local Supabase
    address and a local-only fake session, so canonical DEV is never contacted.
  - `document.fonts` reports the Inter faces loaded, and "Objavi zadatak" computes as `Inter-Bold` at
    weight 400 (no synthetic bold).
  - Six card states render as intended: fixed total, offers, per-person with urgency, own task with
    applications waiting, draft, and remote with an application sent.
- **APK:** run 35722071004 built commit `040c073b`. The APK's SHA256 is
  `2d27cffa1375a14e761e1da75c4771a61e45bea252256630f447d28ccfc82b32`, and it contains
  `assets/fonts/Inter-{Regular,Medium,SemiBold,Bold,ExtraBold}.ttf`, where React Native resolves
  `fontFamily: 'Inter-Bold'`.
- **Not yet verified:** the phone render. The APK is not installed. Install it only with
  `adb install -r`, when the owner is ready.

## Open owner decisions (asked, not assumed)

1. **Tabs.** The prototype has Zadaci | Mapa | Dogovori, and opens the map after sign-in. The app has
   Početna | Mapa | Dogovori, with the two large start tiles on Početna. Matching the prototype
   replaces Početna with the "Zadaci" hub (Objavljeni / Moje prijave).
2. **Primary button colour.** V31 draws the main action green with white text, and keeps orange for
   "+" and attention. The app draws its one brand action orange with ink text.
3. **Card corner.** V31 uses 18 px. The owner asked for 26 px, "okrugla i mekana", on 2026-09-20.
   Task cards now use 18 px as in V31; other cards keep 26 px until decided.

## Next slices

Each slice is measured against the prototype screen, checked in the web smoke, then on the phone.
1. Tab bar and list screens: Zadaci / Prilike / Moje prijave and the map card.
2. Task detail.
3. Applications and candidate.
4. Dogovor list and workspace.
5. Profile and settings family.
6. AI conversation.
7. Notifications and support.
8. The five native motions and card arrival.

## Update, later on 2026-09-22: design freedom

The owner compared Codex's native screens with V28 and changed the rule:
- **His words:** some things are better solved than in V28, and green titles are "lepa i jasna".
- **What he wants:** the designer should explore every possibility to the maximum (Wolt/Airbnb
  quality, adapted to USKOČI users) and then decide design and layout per screen.

This document's layout rule ("identical to V28") is therefore superseded. What stays:
- the foundation of slice 1: Inter, the V28 palette, `FactArt` and `TaskCard`;
- the list of prototype defects not to copy;
- the V28 reference screens in `v28-reference/`, as a starting point and inspiration.

**Roles:** Codex composes the screens. Claude verifies each one (types, Jest, pictures next to V28)
and reports differences to the owner.

**Non-negotiable:**
- server, guards and recovery stay;
- no invented data;
- text is at least 12 px;
- a missing price never looks like an amount;
- the bottom navigation always shows where you are;
- tests pass;
- new packages need the owner's approval.
