# Owner design direction — 2026-09-22 (current)

## Superseding owner direction — 2026-10-02, visual finishing

Latest explicit instruction: primary text and titles black, supporting text gray; white reading surfaces. Character comes from composed screens, selected premium 2.5D illustrations, icons and restrained accents. This supersedes the green-title preference and blanket small-flat-icon direction below. Green remains a brand/action color, not the default reading color. Use existing FactArt art selectively; navigation/close/filter glyphs stay clear. Distinct cards and open rows each need a purpose; remove redundant headings, helper copy, empty footers and competing emphasis without hiding actual facts or recovery.

Continue the existing app plan by reviewing complete screens and connected flows from the person's perspective. Apple craft principles and the owner's Airbnb search/map/list/filter references guide quality, adapted to USKOČI. Earlier V28/V31 and V59/V60 references are useful evidence, not authority over this instruction. Prioritize visual/native review and coherent batches; targeted checks protect changed behavior, broad regression belongs at major integration/release gates. Do not spend each visual round on expanding test infrastructure. Existing entry/mascot, business, privacy, provider and deployment boundaries remain.

Implementation/evidence for the first connected discovery/card batch: `ui-ux-pass-20261002/VISUAL_FINISHING_20261002.md`. Existing W1–W12 and `docs/control/redovi.json` remain the plan and registry.

Read this before working on each screen. This records the owner's latest clarification, which grants design autonomy and supersedes the stricter message immediately before it. Work on one screen at a time, with one implementation in app code.

## Product and preserved foundation

Clear, concise, easy and capable. Wolt/Airbnb quality adapted to nearby short jobs, people using one hand while moving, Serbian copy addressed as "ti", one account for OBJAVI ZADATAK / USKOČI I ZARADI.

Preserve Inter, colors, colored FactArt illustrations and TaskCard as the foundation. V28 is a starting point, not a restriction: reference images in v5-ai-first/v28-reference/ and measurements in v5-ai-first/V31_IDENTICAL_LOOK_20260922.md. Keep what works and freely improve the rest. The owner explicitly likes the green titles; the preceding dark-title requirement is withdrawn. Research Wolt, Airbnb, Uber, Glovo, TaskRabbit and Airtasker where useful, adapting patterns to USKOČI rather than copying them.

## Per-screen acceptance

1. State one sentence: the decision/action the person must make.
2. Explore multiple solutions and select the best using design judgment. Keep a clear primary action and concise hierarchy.
3. Implement loading, empty, error, offline and success using real state; never invent a successful command or a new server state.
4. Show the actual screen and one sentence explaining the composition. V28 comparisons remain useful evidence, not an automatic approval gate for visual differences.
5. Pass types/tests, build the exact source APK and verify on the phone after each screen.
6. Claude runs tests, captures each screen and reports strengths and defects. Do not edit the same files concurrently. A prepared review record is not a completed independent review.

## Screen requirements

- Map and opportunity list: find a nearby job quickly; selected task card from the bottom, readily reachable search, bottom filter sheet with a real "Prikaži N zadataka" count.
- Task detail: everything needed to decide whether to apply, without wandering. Choose the order of photos/facts/price/requirements/description/place/questions/publisher by usefulness; green titles are explicitly welcomed. Missing price must never resemble an amount.
- Application/offer: price, people, message, review, send; clear statement of what was sent after server confirmation.
- Applications to own task: photo, price and message list; optional comparison; one offer occupies a screen; selecting requires confirming the actual accepted terms.
- Agreement: next action, accepted terms and messages immediately understandable. Progress or task/application links may use only authoritative server information.
- Home: OBJAVI ZADATAK / USKOČI I ZARADI; the four existing attention reasons; upcoming Agreements.
- New task: AI conversation plus a growing draft card, followed by review before publication.
- Profile, notifications, settings: concise, grouped and uncluttered.

## Navigation and motion

Rounded V28 bottom bar, colored illustrations; active destination on pale green, others gray. Nested screens retain their originating destination where navigation permits; do not invent a global role switch.

Motion only for meaning: list arrival, bottom sheet, confirmed success checkmark, empty state, "Dogovoreno!", map movement to a selected point. Respect system reduced motion. A new package requires owner approval. The owner has specifically approved @gorhom/bottom-sheet 5.2.14 and phone testing; that is not blanket approval for other dependencies or purchases.

## Engineering boundaries

For this design work, do not alter the server, validations or recovery. Do not invent counts, ratings, status, eligibility, payment or delivery evidence. Text is readable and never below 12dp. The bottom bar must visibly indicate the active destination; never all gray. Keep all existing hard repository boundaries.

## Current execution — latest owner instruction

Owner approval on 2026-09-22: "odobram sve to" approves the presented functional analysis,
disclosed D1-D10 interpretations and execution order. The analysis wait below is historical.
First bounded package: F01-F04 client foundation; then discovery → detail → offer.
Keep independent server proposals and proof/approval requirements separate.

First complete a whole-app functional analysis and show it to the owner. For every screen record its job, existing capabilities, missing capabilities, placement (screen/sheet/section/message/notification/confirmation), and verified existing server support versus a new contract. Research official Wolt, Airbnb, Uber, TaskRabbit and Airtasker flows. New screen implementation waits for the owner's approval of that analysis. Finish verification of the already approved bottom-sheet slice only. This ordering supersedes the execution order below; design freedom and engineering boundaries remain.

### Previous execution order (paused for analysis)

Additional owner instruction: read v5-ai-first/UX_NACRT_20260922.md and compare every screen with it (agreement, gap, proposed difference). Present conflicts before implementing. The functional audit contains these comparisons and D1-D10; the draft itself is not silently rewritten.

Finish map/list/filter sheet first. Keep the prior native surfaces as implemented history and evaluate each next screen under this clarified direction. Review evidence belongs in DESIGN_NATIVE_CONNECTED_SLICES_20260922.md and the current status index. Screenshots and device checks must be labelled by actual source/build; a browser fixture is not a real phone flow.
