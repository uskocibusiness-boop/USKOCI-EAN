# Persistent owner design skill selection

Owner instruction: 2026-09-13, load all nine skills and use them throughout
USKOČI app work. Each SKILL.md below was read in this session. This registry
persists that preference for future sessions; it does not claim model memory
outside this workspace or that every skill workflow runs on every code edit.

| Skill | Local SKILL.md read | Application |
| --- | --- | --- |
| frontend-design | C:/Users/user/.agents/skills/frontend-design/SKILL.md | USKOČI visual identity, hierarchy, purposeful copy and tokens |
| emil-design-eng | C:/Users/user/.agents/skills/emil-design-eng/SKILL.md | Input feedback, polish, Before/After/Why review table |
| animate-expo | C:/Users/user/.agents/skills/animate-expo/SKILL.md | Native motion gate, Reanimated/UI runtime, cancellation, reduced motion |
| review-animations | C:/Users/user/.agents/skills/review-animations/SKILL.md | Read-only motion review and explicit scoped verdict |
| find-animation-opportunities | C:/Users/user/.agents/skills/find-animation-opportunities/SKILL.md | Read-only frequency/purpose/speed/function gate before proposing motion |
| prototype | C:/Users/user/.agents/skills/prototype/SKILL.md | Isolated alternatives when a new design choice is actually being explored; no prototype imports into production |
| apple-design | C:/Users/user/.agents/skills/apple-design/SKILL.md | Immediate feedback, physical continuity, typography and accessible alternatives |
| ui-ux-pro-max | C:/Users/user/Desktop/codex sizajn/.agents/skills/ui-ux-pro-max/SKILL.md | Focused local UX/React Native searches, accessibility and responsive review |
| vercel-react-native-skills | C:/Users/user/.agents/skills/vercel-react-native-skills/SKILL.md | Native performance, rendering, navigation and component conventions |

## Authority and application

The owner's V5 decisions and supplied identity/reference remain authoritative.
Skills are implementation/review guidance, never permission to remove features,
reopen accepted choices, change provider/privacy/cost or alter the entry,
mascot, signature animation and HOME. The task is an existing Expo57/RN0.86
application; web CSS recipes are adapted only where native behavior supports
them. No framework/dependency upgrade follows merely from a skill example.

Apply constructive skills while implementing. Run review/opportunity skills in
their read-only mode, then make authorized fixes as implementation work. The
prototype picker workflow applies to a concrete unresolved visual exploration;
the owner's chosen V5 conversation/review/publication flow is already selected.
New product decisions still require the owner. No unnecessary variant-selection
pause is introduced into the current integration.

## Current UI direction and motion gate

Keep original brand assets; use white surfaces. The colours and letters are the owner's V28
prototype as of 2026-09-22 (superseding the earlier green #176B55 / orange #FF850F / ink #183A30
/ secondary #586B62 and "existing font family"). Use `sys.color` in `src/ui/system/tokens.ts` and
bundled Inter; see `V31_IDENTICAL_LOOK_20260922.md`. Live card remains outside the independent conversation scroll;
keyboard and large text compact the card without covering the composer.
One primary final action publishes from the complete review. All inputs remain
editable through explicit manual controls or conversation.

Frequent typing, card data updates and streamed text receive no decorative
entrance/typewriter motion. Microphone level is measured audio data, never
random animation. Press feedback reflects the actual gesture. Accessible
start/stop and cancel controls supplement holding. Reduced motion and large
font checks accompany new surfaces; release-device feel stays unverified until
actually exercised on hardware.

Local ui-ux-pro-max searches checked touch gesture conflicts, accessible dragging
alternatives and native keyboard handling. Results were inspected as guidance,
not promoted into a competing product design master.

## UI/UX pass 2026-10-02: the foundations (plan item 1.2)

The owner ordered the UI/UX pass on 2026-10-02 ("kreni sad"). His complaints were a
generic look, poor motion, poor icons, weak legibility and unclear screens, and the
audit traced a large part of them to values every screen chose for itself. This
section is the written rulebook; the values live in `src/ui/system/tokens.ts` (colour
and motion), `src/ui/system/textScale.ts` (layout class) and `src/ui/system/motion.ts`
(reduced motion), and `src/ui/system/__tests__/one-token-source.test.ts` guards them.
It adds to the system and restyles nothing that existed. Two defaults were applied by
the team in this wave, pending the owner's eye on the phone (they are not owner
decisions, and both are reversible): a single brand tone in the small icon cut, with
orange only for what waits or needs attention (the tone is the UI green, so icons,
titles and the primary action agree); and no haptic tick on touch-down for navigation
(ticks only for toggles and confirmed outcomes, on release).

### Colour meaning (one table)

A colour that means two things means nothing. Green used to mean the action, the
selection, the price and a term nobody had confirmed. A new use of a colour has to fit
a row of this table:

```
green  = do / selected / money    the one primary action, the chosen tab or chip, a title that
                                  opens something, a price, a fact that IS confirmed
ink    = content                  what a person wrote and what a thing is called
muted  = unknown / meta           a term that is not set ("Termin nije potvrđen"), a flexible or
                                  absent value, a caption, something inactive or historic (7.8:1)
warn   = waits for you            warn on warnSoft: a thing that needs your answer or your move
orange = attention counts only    the unread dot, the count of what waits, the urgent badge, the
                                  rating star, and the accent surfaces AGENTS 3.6.4 fixes (the
                                  Home publish tile, the map "+"); never decoration
```

`danger` says something went wrong or cannot be undone, and always sits beside a word or
an icon. Fact pictures follow the same table through `sys.color.art`: four tones,
`brand` (the UI green, the default for every kind), `accent` (the orange, only where it
means attention), `quiet` (inactive, disabled, historic) and `danger`. Each tone is
`front`, `edge`, `light` and `soft`, derived from the tokens above in `tokens.ts`, so no
picture TONE is a hex of its own. (The sticker's neutral paper, ink and shadow greys, 19
hexes, are written in `FactArt.tsx`: the known remainder, listed and held tight by
`fact-art.test.tsx`.) `sys.color.art` is not `sys.art`: the second is the Home drawing's
own colours. The accent is 2.5:1 on white and so never carries a small picture alone; use
its `edge` (3.8:1) or put ink words beside it. That is why the same bell is the vivid
orange `#FA8229` at 26 dp (the sticker) and the darker `#C86821` at 24 dp (the flat mark,
3:1 for a small graphic): two oranges, on purpose, shown side by side on the board.

The calendar mark follows the table: green only when the term IS a confirmed instant (a
fixed window that names a start or an end); a flexible range or a term the read did not
carry is drawn quiet (`scheduleConfirmed` in `TaskFace.tsx`, on the task card and the pin's
card).

### Motion rules R1 to R8

```
R1 Only transform and opacity move: never height, width, top or an SVG prop (the locked
   V4.9 entry scene is the one exception). An SVG draw pass is what the B22 Reanimated
   flood replays.
R2 Enter decelerates and is longer than exit; easeOut is passed explicitly to every React
   Navigation, Reanimated entrance or Animated.timing spec (a spec without a curve runs on
   the library's own ease-in-out, which spends the first tenth of the time at 3 % of the
   way). enter 240, exit 160, push 240, toggle 180, press 120 in and the spring out.
   (Done 2026-10-08, B0: `(app)/_layout.tsx` passes push 240 AND easeOut; `Appear` uses
   easeOut and an 8 dp start.)
R3 Sheets and anything the finger carries settle on ONE critically damped spring,
   sys.motion.sheetSpring (stiffness 300, damping 30, overshootClamping). Nothing that
   carries text overshoots.
R4 B22: mounted-forever views; no `exiting` or layout animation anywhere; a row's animated
   wrapper is decided at mount and never switches; at most two Reanimated views per list
   row; an `entering` only for a genuinely new id, capped at six rows; loops (skeleton
   breath, typing dots, glow) run only on the focused screen, stop in the background and
   under reduced motion, never more than four at once. New motion is RN Animated on the
   native driver.
R5 Haptics are outcomes, not touches: a tick belongs to a toggle or a confirmed result,
   never to a finger that has only gone down on navigation.
R6 Warm is still; cold after a skeleton arrives once; photos cross-dissolve (180 ms);
   a spinner lives only inside a button.
R7 One reduced-motion source (ui/system/motion): movement off, state changes instant,
   Lottie on its first frame, navigation 'none'.
R8 The press-scale ladder: 0.97 a button, 0.985 a row or card, none for a big surface.
```

The motion tokens, all in `sys.motion` and nowhere else:

| Token | Value | Used for |
| --- | --- | --- |
| `press` / `toggle` / `enter` / `exit` | 120 / 180 / 240 / 160 ms | a response, a switch, something arriving, something leaving |
| `push` | 240 ms (with `easeOut`, R2) | a screen pushed onto the stack |
| `camera` / `stagger` | 360 / 40 ms | the map camera, rows arriving together (six at most) |
| `tickGap` | 120 ms | the least time between two haptic ticks of the same weight or a lighter one (`ui/system/haptics.ts`, R5): a heavier tick, an outcome after a touch, is never held back |
| `scale` | button 0.97, row 0.985, none 1 | the press ladder (`pressScale` is its button rung) |
| `spring` | 400 ms, damping ratio 0.85 | the settle after a press |
| `sheetSpring` | stiffness 300, damping 30, clamped | every sheet (the older `springSheet`, `tab`, `fade`, `easeInOut` and `sheet` tokens were deleted on 2026-10-08: nothing read them) |
| `loop` | breath 700, typing 520, glow 1600 ms | loops, per half-turn |
| `arrive` | 800 ms, the arrive bezier | an empty state's picture settling in once |

### Layout class

`useLayoutClass()` in `textScale.ts` returns `{ cls, stacked }`. `cls` is `large` when the
text scale is 1.3 or more, `narrow` when the window is under 340 dp, otherwise `compact`
(large wins when both are true); `stacked` is true for `large` and `narrow`. A component
stacks its head, foot or actions when `stacked` is true and in no other case. Design the
default layout for `compact` at text scale 1.0 to 1.15 (the owner's phone is 361 dp);
stacking is the resilience fallback, not the look. AGENTS says ordinary text is the
baseline and 1.3 is a bounded resilience check, so judge a screen at 1.0 first.

`useWindowRoom()` (same file) hands the width in dp and the rounded text scale to the one
rule that needs to know HOW MUCH room there is. Today that is the task card's head
(`v2/cardHeadFit.ts`): from 380 dp up the price stands beside the title under the old gate
(a title of 42 characters at most, an amount of 12), unchanged; from 340 to 379 dp it
stands beside the title only if the title, measured with the Inter Bold advance widths in
the column the price leaves, breaks no word and takes two lines at most (so the head is
never taller than the stacked one); under 340 dp and from text scale 1.3 up it is always
stacked. An amount is never cut. The limits of that estimate are written in the header of
`cardHeadFit.ts` (kerning, letter spacing and Android's non-linear font scale are ignored,
all on the wide side; the card's list geometry is assumed; it is arithmetic, not a render).

### Press feel

A tick is an outcome and comes on release, inside `onPress`, in every control (a
`Segmented` included: a finger that lands on a segment and turns into a scroll ticks
nothing). Only a toggle whose tick IS the change may ask for `hapticOn="in"`. The 60 ms
press delay belongs to a row or a card (the row rung of the ladder and above, and a
surface that does not give itself); a button or a sheet command gives the instant the
finger lands (`pressDelayFor` in `Press.tsx`).

### Guards

`one-token-source.test.ts` holds four guards. The first two are ratchets: each names today's
offenders so the suite is green now, and each can only shrink. They are EQUALITIES, not
ceilings (wave-1 review): a file that is not on a list, or that spells more than its entry
allows, fails ("use the token, do not raise the entry"), and a file that spells LESS than
its entry fails too ("lower the entry, or delete it"), so an entry made stale by the work
it was waiting for cannot stay green. When a change moves a literal onto a token, lower or
delete that file's entry in the same change; never add one.

- no component reads the window width itself (10 files are listed today, two of them the
  locked entry; the files move onto `useLayoutClass()` wave by wave). An aliased import of
  `useWindowDimensions` or `Dimensions`, a namespace access and a width read from
  `useWindowRoom()` count as reads. Not seen: a width handed on as a value;
- no `duration:` (or `.duration(`), spring (`damping`, `dampingRatio`, `stiffness`) or
  press-scale literal outside `tokens.ts` (29 files listed today; `duration: 0` is "no
  motion" and is allowed). A press scale is found in any expression handed to `scaleTo`
  (`scaleTo={list ? 0.99 : 0.97}` is two), in a `*PRESS_SCALE` constant and in a literal
  handed to `usePressLift(...)`. Not seen: a press scale under another name that reaches
  `withTiming` by some other road;
- the motion tiers and the one sheet spring have their agreed values;
- the colour-meaning table and rules R1 to R8 stay written in `tokens.ts` and here.

### Open items carried by wave 1

Wave 1 (items 1.2 to 1.5) knowingly left these behind. Each is explained in the code and
each is meant to be removed by a named later item, so none is forgotten:

- (Closed 2026-10-08, B0: `sys.motion.push` is 240 ms with `easeOut`, and `springSheet`
  and the other dead tokens are deleted. Haptics: `ui/system/haptics.ts` `tick(kind)`;
  `Press` goes through it; `Poruka.tsx` and `SuccessMark.tsx` still call `expo-haptics`
  directly and move to `tick('success')` with the system pass.)
- `PRESS_DELAY` (60 ms) lives in `Press.tsx` and not in `sys.motion` (it was added with
  the press rework, when `tokens.ts` was another item's file). It moves to
  `sys.motion.pressDelay` with the next change to `Press.tsx`.
- `SHEET_SPRING` in `ProductSheet.tsx` is an alias of `sys.motion.sheetSpring`, kept so
  `DiscoveryListSheet` and `PeekSheet` compile unchanged. The sheet item imports the token
  and drops the alias.
- The three copies of give, settle and lift (`TaskCard`, `ApplicationFace` and
  `AgreementCollectionPresentation` each still write them out, with `CARD_PRESS_SCALE`
  0.986 beside the ladder's 0.985) move onto `usePressLift` in the card and Agreement items.
- Every `haptic="select"` call site (about 100) now ticks on release. The toggles that
  should answer on touch-down ask for `hapticOn="in"` in their own items (the search bar and
  panel, `DateRangeGrid`, the review and support toggles, the availability form and the
  settings switches).
- The ordinary press scales that are still literals (the 29 files in the motion ratchet)
  move onto `sys.motion.scale` wave by wave.

Behaviour changes to confirm on the HONOR before wave 1 is called done (SOURCE and CI only
until then, AGENTS 3.2.4): the entry buttons (`EntryWelcome` is locked and untouched, but
its `Press scaleTo={1} haptic="light"` now ticks on release instead of on touch-down);
the Home rows (the calendar and people marks went from orange to green); a quick tap on a
card (the give begins 60 ms after the finger lands); the flat marks at 16, 20 and 24 dp
against the stickers on the board; the compact task card head at 340 to 379 dp.
