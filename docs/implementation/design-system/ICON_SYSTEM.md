# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI icon system

Current refinement (2026-10-03): persistent navigation and root chrome use the shared Glyph outline family; illustrations remain in content. Original local launch/map/messages artwork is joined by the work-profile tool tote, recorded in assets/illustrations/PROVENANCE.json. These decorative objects are not proof of account skills or equipment. Existing small fact/status semantics remain. The historical wave record below explains its original scope; matching native acceptance is recorded in the current UI/UX report.

UI/UX pass, 2026-10-02, wave 1 item 1.3 (audits ICO-01 to ICO-04, Z8, I1, F01, MZ-I1, DG-F01, HP-02). The owner's complaint
was "generic look, poor icons"; the audit found no icon rules at all, five drawing dialects on one screen, a sticker finish
that is busy at the 16 to 20 dp a card row uses, hue that alternated orange and green by kind, ticks on terms that nobody
had confirmed, and one bubble silhouette that meant three things. This file is the rulebook. The code is
`src/ui/system/FactArt.tsx`, the guards are `src/ui/system/__tests__/fact-art.test.tsx`, and the two cuts of the new system
are on the phone, side by side, at `uskociapp://dizajn-tabla` (internal build only). That board is NOT a before and after:
both cuts are drawn in the new tones. The true before is in the screenshots taken before this pass and in Git history, and
the owner compares with the build already on his phone.

Two things in this item are defaults applied by the team, pending the owner's eye on the phone, not owner decisions: the
single-tone sticker (the old two-tone one of 2026-09-22 is gone and cannot be restored without redrawing it) and the flat
mark for 24 dp and below. Both are reversible.

What this item built: the FactArt register (two cuts, one tone rule, four new drawings, the meaning table) and its guards.
What it did not build, because other files own it: `Glyph`, `StatusMark`, the tab bar, `StateView`, the notification
mapping and the call-site size clean-up (see "Not done here" at the end).

## 1. One family, three registers

A person should be able to answer "what is this picture for?" from its register alone.

| Register | Answers | Drawn by | Rule |
|---|---|---|---|
| FactArt | what a thing IS: a place, a date, a price, a person, a destination | `FactArt` (this file's subject) | the ONE fact-icon API (AGENTS 3.6.4). Facts, destinations, row subjects, empty and success art. |
| Glyph | what you DO: back, close, caret, plus, send, search, filters, more | Phosphor line icons, behind a closed registry (`src/ui/system/Glyph.tsx` exists since 2026-10-02, commit c16f09c4: closed registry of 30 names; the chrome uses it, 63 files still import Phosphor directly and are listed in `glyph-import-guard.test.ts`, which fails for any new importer) | controls only; a primary control carries a word beside it. |
| StatusMark | where a thing STANDS: open, done, waiting, closed, alert | planned `StatusMark.tsx` | shape plus tone, never colour alone. |

`Pictogram` (46 picker scenes, 32 px and up) is not part of the three: it draws a choice in a picker and keeps its own
tones. `HomeIllustration`, the entry assets, the mascot and the map-pin brand mark are untouched by this item.

A fact picture is never used as a control, and a control glyph is never used as a fact. When a screen needs both, the
picture says what the row is about and the glyph says what tapping does.

## 2. The FactArt API

```tsx
<FactArt kind="calendar" size={20} />                 // the common case: the size picks the cut, brand green
<FactArt kind="bell" size={20} />                     // orange by default: the bell and the star mean attention or a score
<FactArt kind="pin" size={20} tone="accent" />        // orange on request: something here needs you
<FactArt kind="clock" size={16} muted />              // deprecated alias of tone="quiet"; every old call site keeps working
<FactArt kind="vehicle" size={48} cut="mark" />       // force a cut (the design board does)
```

| Prop | Values | Default |
|---|---|---|
| `kind` | `FACT_KINDS`, 30 kinds | required |
| `size` | any number; the ladder is `FACT_SIZES` = 16, 20, 24, 32, 48, 64 | 20 |
| `tone` | `brand`, `accent`, `quiet`, `danger` | `brand` (the bell, the star and the alert default to `accent`) |
| `cut` | `auto`, `mark`, `art` | `auto` |
| `muted` | boolean, alias of `tone="quiet"`; it wins over `tone` | false |

`size` stays a plain number on purpose: the 139 existing call sites pass 14, 18, 22, 26, 28, 30, 36, 40, 56 and 72 as
well as the ladder values, and typing it to the ladder would have forced edits in 57 files. New code uses the ladder.

### Which cut a size gets

| Size | Cut | Where it is used today |
|---|---|---|
| 24 and below | `mark`, flat | card rows (16 and 20), chips, fields, Disclosure rows, Dogovor facts, inbox rows |
| 25 and above | `art`, the sticker | Profil rows (26), Home rows (32), the tab bar (30), StateView (56), headers, empty states |

The threshold is `MARK_MAX_SIZE` = 24. A size between the two cuts (26, a Profil row) keeps the sticker, as the audit asked
(ICO-02: "keep the existing art cut for Profile rows"). The call sites pass these literal sizes today (read from the source
on 2026-10-02): 14 (2 sites), 16 (14), 18 (10), 20 (24), 22 (6), 24 (23), 26 (21), 28 (17), 30 (2), 32 (5), 36 (1), 40 (3),
48 (2), 56 (2), 72 (1), plus six computed ones. So 79 literal sites switch to the flat mark, 54 keep the sticker, and none
needed an edit. The kinds used at those sites are all in `FACT_KINDS`, and the 18 sites that pass `muted` still compile and
now draw the quiet tone.

## 3. The two cuts

The same 32-unit canvas, drawn two ways. The mark is not a shrunken sticker: it is the same subject with the finish taken
off. The reason is a design decision, not a legibility emergency: one hue, one weight and fewer details make one consistent
family at the sizes a card row draws, and each picture costs fewer SVG shapes (B22). It is not that the sticker cannot be
read: on the owner's 560 dpi phone a 16 dp picture is 56 device pixels, and the sticker's edge (1.5 units) is about 2.6 of
them, so its finish is readable there. (On a 2x phone a 16 dp picture is 32 device pixels and the same finish does get fine.)
Whether the flat mark is better on the HONOR is not measured: the board draws both cuts at 16, 20 and 24 for the owner's eye.

### The mark (24 px and below)

- One fill tone and white. No ground shadow, no darker edge, no shine, no second hue, no pale "soft" or "light" shape.
- No tone lighter than 3:1 on white (WCAG 1.4.11 for a graphic object), and the white detail is at least 3:1 on the tone.
- No stroke under `MARK_MIN_STROKE` = 2.4 units (1.2 dp at 16 dp, 1.8 dp at 24 dp; 4.2 and 6.3 device pixels at 560 dpi); no
  filled shape (or sub-path) thinner than 2.4.
- At most four SVG shapes per picture, and always fewer than the sticker of the same kind (B22: every `react-native-svg`
  node is a native view that the Reanimated flood can replay). Across the 30 kinds the mark costs 72 shapes and the sticker 203.
- Nothing touches the edge of the canvas: every shape, stroke included, lies at least 0.5 unit inside the 32 by 32 box.
- Where two details sit side by side the gap is aimed at 3 units or more (checked by eye on the rendering, not by a test).
- A detail that must be cut free of a shape of the same tone (the clip of the clipboard, the wheels of the van, the latch of
  the toolbox, the badge of `publish`) gets a 2.4-unit white rim instead of an edge colour.
- A white detail lies on the tone. One that cuts through an edge (the bands of the life ring, the seam of the toolbox, the
  creases of the map) is drawn with butt ends or as a filled slit so it stops where the shape stops: a round cap past the edge
  is invisible on white but shows as a nub on a grey well.

The face of a mark is `factMarkFace(tone)`: the tone's `front`, except `accent`, whose `front` is the action orange at 2.5:1
and so wears its `edge` (3.85:1) instead.

### The sticker (25 px and above)

The look the owner approved on 2026-09-22 and the one the Home rows, the Profil rows, the tab bar and the empty states keep:
a ground shadow (ellipse at 16, 29.4, rx 10.2, ry 1.6), a darker edge 1.5 units under the face, a light shine stroke, white
or ink details. Every sticker starts with its ground shadow and lies inside the canvas. The second hue that the old sticker
carried (the orange calendar header, the orange badge, the orange clock arc) is gone: the sticker is single-tone too.

## 4. One tone rule

A picture is one hue. The tones come from `sys.color.art` in `tokens.ts`, never from a hex in FactArt, so the picture, the
title and the primary action are the same green.

| Tone | Colour | On white | Use |
|---|---|---|---|
| `brand` (default) | `#076E4E` = `sys.color.green` | 6.3:1 | every kind, unless it says otherwise |
| `accent` | face `#FA8229` (2.5:1); the mark wears `#C86821` (3.85:1) | | only where something needs you or is rated: the bell and the star by default; an unread, waiting or urgent mark by the caller's `tone` |
| `quiet` | `#8F8F8F`, edge `#525252` | 3.2:1 | inactive, disabled, historic; what `muted` meant |
| `danger` | `#963F34` | 6.9:1 | something went wrong or cannot be undone, always beside a word |

What changed: the per-kind list that painted the calendar, users, bell, tasks, person, star and support in orange is gone,
and so is the lighter emerald `#079C77` (3.5:1) that sat beside the deep green of the titles. The old light and soft tones
(`#FFF0E2` is 1.1:1 on white, `#6FD0AB` 1.9:1) no longer exist at the small sizes. A guard test fails on any of the old hex
values in either cut.

Two oranges, on purpose. The accent sticker (25 dp and up) is the action orange `#FA8229` on its darker edge; the accent mark
(24 dp and down) is that tone's edge, `#C86821`, because a small graphical object must be 3:1 against white (WCAG 1.4.11) and
`#FA8229` is 2.5:1 with nothing darker under it. So the same bell or star is two oranges at 24 dp and at 26 dp, and the darker
one reads a little brown. Nothing is changed for it here: the board shows both side by side ("Dva narandžasta") and the owner
chooses. What the tones own as hex values, and what they do not: every TONE is a token in `sys.color.art`; the sticker's
neutral paper, ink and shadow greys (19 hexes) are written in `FactArt.tsx` and held tight by `fact-art.test.tsx`.

## 5. No false ticks

A tick says "confirmed". Only `check`, `agreements` (an agreed Dogovor) and `shield` carry one (`FACT_TICK_KINDS`). The
calendar, the task list and the remote screen used to wear a tick although the calendar is the picture of "Termin nije
potvrđen" and the clipboard the picture of "1 od 2 mesta je slobodno". The test finds a tick by its shape (a short stroke
down and a longer one up and to the right, ratio 0.3 to 0.75; an arrow head is symmetric and is not one) and fails if any
other kind draws one, in either cut.

## 6. What each picture means

One phrase per kind, `FACT_MEANING` in the code, and a test that no two kinds share a phrase. A new picture has to say
something that no existing one already says.

| Kind | Means | Kind | Means |
|---|---|---|---|
| `home` | the home screen | `info` | a note or an explanation |
| `pin` | a place on the map | `shield` | protection, a verified or safe state |
| `calendar` | a date or a term in the calendar | `lock` | something private or locked |
| `clock` | a time of day or a duration | `eye` | who can see it |
| `users` | several people, the helpers a task needs | `document` | a document or a written text |
| `person` | one person, a profile | `download` | a file to save |
| `money` | cash, an amount that is paid | `photo` | a photo or the camera |
| `remote` | work done from a distance | `support` | help from support |
| `map` | the map of tasks around you | `vehicle` | a van or a vehicle a task needs |
| `tasks` | your own list of tasks | `tool` | a tool or equipment a task needs |
| `agreements` | an agreement (Dogovor) that two people made | `alert` | a warning: something needs you or went wrong |
| `offers` | a price tag: what a task is priced at or offered for | `publish` | publishing a new task |
| `chat` | a conversation or a message | `send` | sending an application |
| `bell` | a notification | `star` | a rating |
| `phone` | a phone number or a call | `check` | something confirmed or done |

The three speech bubbles are now two: `chat` (a bubble with three dots) and `agreements` (a bubble with a tick, the Dogovor
tab). `offers`, the "Tražim ponude" price mode, is a price tag. The clipboard is only your own list (`tasks`); a new task is
`publish`. A guard test checks that the tag shares no path with either bubble and that `publish` and `tasks` differ.

## 7. The new drawings, in words and coordinates

All coordinates are on the 32-unit canvas, y down. "Rounded polygon" means a closed polygon painted with its own stroke in
the fill colour and round joins, so each corner is rounded to half the stroke width and the painted extent is the polygon
grown by half a stroke.

### `offers`: a price tag (replaces the chat bubble)

A horizontal tag pointing left, with a punched hole near the point and a line for the amount.

- Outline: rounded polygon `M4.6 16 12.2 8.4H27.4V23.6H12.2Z`, stroke 3.6. The tip is at (4.6, 16); the two legs leave it at
  45 degrees up and down to (12.2, 8.4) and (12.2, 23.6); the body runs to x = 27.4. Painted extent x 2.8 to 29.2, y 6.6 to 25.4.
- Mark: tone fill; white hole, circle (12.4, 16) r 2.3; white amount line `M18.4 16h6.4`, stroke 2.6. Three shapes.
- Sticker: ground shadow; edge polygon `M4.6 17.5 12.2 9.9H27.4V25.1H12.2Z` (1.5 down) in the edge tone; face polygon as the
  mark; shine `M14.2 6.9H26` (1.8, light); white hole (12.4, 16) r 2.4; two white amount lines `M18.2 14.2h6.8M18.2 18.6h4.2`
  (2.1), the second shorter, so it reads as a price and not as a label.
- It shows no digit and no currency: a missing price must never look like an amount (AGENTS 3.6).

### `alert`: a warning triangle (replaces `info` as the error picture; defaults to `accent`)

An isosceles triangle with rounded corners and a white exclamation mark.

- Outline: rounded polygon `M16 5.4 28 25.4H4Z`, stroke 4: apex (16, 5.4), base corners (28, 25.4) and (4, 25.4), 24 wide and
  20 high. Painted extent x 2 to 30, y 3.4 to 27.4.
- White mark: one path `M16 12.4v6M16 22h.01`, stroke 3.2, round caps: a bar from y 12.4 to 18.4 and a dot (a zero-length
  round-capped segment) at (16, 22), diameter 3.2. Two shapes in the mark.
- Sticker: ground shadow; edge triangle 1.5 down (`M16 6.9 28 26.9H4Z`); face triangle as the mark; shine `M9.4 20.4 13.2 13.8`
  along the left leg (1.8, light); white mark `M16 12.2v6.2M16 22.2h.01`.
- Colour: `accent` by default ("warning, needs you"). An error picture passes `tone="danger"` or `muted` (StateView passes
  `muted` for a trouble state today).

### `publish`: a sheet with a plus badge (a new task)

The old Home door ("a white sheet with a badge and a plus"), now a kind of its own, so the Home door, the Zadaci menu entry
and any "new task" action share one picture, and the clipboard keeps meaning your own list.

- Sheet: rounded rectangle x 3.6, y 2.8, 20.4 by 25.2, radius 4.2. No clip, no folded corner: that is what tells it from
  `tasks` and `document`.
- Badge: circle centre (23.2, 23), r 6.6, overlapping the sheet's lower right corner; plus `M23.2 19.6v6.8M19.8 23h6.8`.
- Mark: sheet and badge in the tone; white text lines `M8.4 9.6h10.8M8.4 15h6` (2.6); the badge is cut free of the sheet by a
  2.4 white rim (so its painted radius is 7.8); the plus is white, stroke 2.6. Four shapes.
- Sticker: back shadow rectangle at (5.1, 4.3) in grey `#C5CDC7`; white sheet at (3.6, 2.6) with a 1.1 outline `#CCD4CE`; two
  grey lines `M8.4 9.4h10.8M8.4 14.6h6.4`; badge edge circle (23.2, 24.3) and face circle (23.2, 23), r 6.6; white plus
  `M23.2 19.7v6.6M19.9 23h6.6` (2.2); shine `M19.4 19.2a4.4 4.4 0 0 1 2.6-1.2`.

### `send`: a paper plane (an application sent)

A paper plane flying up and to the right, with its fold in white.

- Outline: rounded polygon `M4 14.6 28 4 18.6 28 14 18.4Z`, stroke 2.4: tail point (4, 14.6), tip (28, 4), lower point
  (18.6, 28), inner notch (14, 18.4). Painted extent 2.8 to 29.2 on both axes.
- Fold: white line `M14.2 18.2 23.2 9.2`, 2.4, from the notch towards the tip and stopping about 7 units short of it, so the
  tip stays solid. Two shapes in the mark.
- Sticker: ground shadow; edge polygon `M4 16 28 5.4 18.6 29.4 14 19.8Z` (1.4 down); face as the mark; fold at 2.0.

### Redrawn kinds

| Kind | Before | Now |
|---|---|---|
| `calendar` | white page, header, a checkbox with a tick and two micro lines | Mark: outline body (rect x 4.2, y 6.2, 23.6 by 22.8, r 4.6, stroke 2.6), filled header band from y 6.2 to 13.2, two binder rings `M10.6 3.4v5M21.4 3.4v5`, two text lines `M9.6 18.4h12.8M9.6 23.8h7.2`. Sticker: the same page, header, rings and shine, two grey lines `M8.6 17.2h14.8M8.6 22h8.6`. No checkbox, no tick. |
| `tasks` | clipboard with an orange badge and a tick | Mark: board (rect x 5.6, y 5, 20.8 by 24.4, r 4.2), clip (rect x 10.2, y 2.4, 11.6 by 5.8) cut free by a white rim, two white lines. Sticker: sheet, clip and three grey lines. No badge, no tick. |
| `remote` | monitor with a tick on the screen | Mark: filled monitor x 3.2 to 28.8, y 4 to 22.8, a white head (16, 9.6) r 2.6 and shoulders `M10.4 19.8a5.6 4.6 0 0 1 11.2 0Z` (a video call), a stand `M16 22.8v4M10.6 28.2h10.8`. Sticker: the same person on the white screen in the tone. |
| `users` | orange front figure and a near-invisible pale second figure (1.1 stroke, `#FFF0E2`) | Mark: one path of four sub-paths, side by side and never overlapping: front head (10.4, 9.8) r 5.6, front body x 2.4 to 18.4, back head (25.7, 13.4) r 3.9, back body x 21.4 to 30; both in the full tone, a 3.0 gap between the bodies. Sticker unchanged apart from the tone. |
| `money` | two stacked notes with shine and detail | Mark: one note (rect x 2.4, y 7.2, 27.2 by 17.6, r 4.2) and a white circle (16, 16) r 4.6. |
| `phone` | handset and two thin waves | Mark: the handset and one signal arc `M21.4 3.6a8.4 8.4 0 0 1 7 7` (2.6). |
| `support` | orange life ring | Mark: ring (16, 16) r 10.4, stroke 6, cut into four by white bands along the diagonals, 3 wide with butt ends from radius 7.3 to 13.5 so they stop at the ring's edges (`M10.84 10.84 6.45 6.45` and its three mirror images). |

### The other marks, in one line each

`home`: house body with a peaked top, a 2.6 roof line that overhangs, a white door 5.4 wide. `pin`: teardrop (x 6 to 26,
y 2.4 to 29.5) with a white dot (16, 12.4) r 4. `clock`: ring r 12.4 (stroke 2.8) and two hands `M16 8.8V16l4.8 3.2`. `person`:
head (16, 8.6) r 5.4 and a shoulder shape x 5.4 to 26.6, y 17.4 to 29, a 3.4 gap between them. `map`: a folded map filled,
two white slits (2.6 wide, round at the top, ending at the map's lower edge) for the creases. `agreements`: the bubble with a white tick `m9.6 13.1 3.6 3.7 7.4-7.4` (the only kept tick besides
`check` and `shield`). `chat`: the bubble and three white dots. `bell`: bell and a half-disc clapper. `star`: five points
(centre (16, 17.2), outer 13, inner 5.7) with a 2.4 round-join stroke. `check`: disc r 13, white tick. `info`: disc r 13, a
white dot and bar. `shield`: shield, white tick. `lock`: shackle (stroke 3), body (x 5.4, y 12.8, 21.2 by 16.4), white
keyhole. `eye`: almond, white disc r 5.6, a tone pupil r 2.7. `document`: a sheet whose corner is folded over (a white
triangle), two white lines. `download`: arrow `M16 3.8v10.8M10.6 9.2l5.4 5.4 5.4-5.4` and a tray, a 4.2 gap between them.
`photo`: camera body and bump as one path, a white ring (16, 18.4) r 5.2. `vehicle`: van body, two white windows, two
wheels r 3.8 with a white rim. `tool`: handle, box, a white seam `M3 17.6H29` with butt ends flush with the box, latch with a white rim.

## 8. The guards

`fact-art.test.tsx` (152 tests) turns what a person would see into things a test can measure, because the pictures cannot
be seen from a test:

- the cut per size, the explicit `cut` override, and that every kind draws at every size the call sites use, hidden from
  screen readers on the 32-unit canvas, through the real renderer as well;
- a small SVG path reader (lines, curves, arcs) that computes each shape's bounding box with its stroke: the mark must lie
  at least 0.5 unit inside the canvas, no stroke under 2.4, no filled shape or sub-path under 2.4 in either dimension
  (a clipped or hairline mark fails here); the sticker must lie inside the canvas and start with its ground shadow;
- the colour set of a mark is exactly {the tone face, white}; contrast of every tone against white is at least 3:1; every
  white detail lies inside the box of the tone shapes (a white detail that falls off its shape disappears on a white card);
- the shape count of the mark is at most four and below the sticker's for every kind;
- the tone rule: no orange unless the kind or the caller asks for it; none of the old hex values in either cut; `muted` equals
  `tone="quiet"` and wins over `tone`; the brand face is `sys.color.green`;
- the meaning table is complete and unique; no two kinds draw the same shapes; the tag shares no path with a bubble;
- ticks only on `FACT_TICK_KINDS`, found by shape; the detector is itself tested against the old tick strings.

Mutation-checked: moving the pin out of the canvas, a 1.6 hairline on the clock hands, a tick on the mark calendar, a tick on
the sticker remote, the tag drawn as the chat bubble, a shadow in a mark, a second hue in a mark, orange as the calendar's
default tone, two kinds sharing a meaning and a mark with extra shapes each turned the suite red (ten mutations, ten red). The
white-detail test found three real defects while this item was written (round caps of the toolbox seam, the map creases and
the life-ring bands poking past their shape) and they were fixed.

What no test can see, and the phone must: whether each kind is nameable without its word at 16 dp at arm's length, how the
anti-aliasing of a 1.2 dp stroke looks on the HONOR in daylight, whether the flat mark really beats the sticker there (it is
a design decision, not measured), the 1.3 text scale, and the real tab bar.

## 9. On the phone

Open `uskociapp://dizajn-tabla` in the internal build. The board draws, for every kind: the ladder 16, 20, 24, 32, 48, 64 (the
mark up to 24, the sticker above); then "Dva reza: nalepnica (levo) i oznaka (desno)", the sticker beside the flat mark at 16,
20 and 24, both in the new tones (it is not a before and after); then "Dva narandžasta", the accent kinds as the sticker at 26
beside the mark at 24, so the vivid orange and the darker one can be judged; then the four tones; then the existing 32 dp
ivory row, the 16 dp card row, the pictograms and real task cards.

Verify (wave 1 plan, item 1.3): every card-row icon at 16 and 20 dp is nameable without its word; one hue; no grey blur
under an icon; no tick on a calendar; orange only on counts, waiting and the bell and star; the five pairs that were close
(`tasks` and `publish`, `chat` and `agreements` and `offers`, `calendar` and `document`, `check` and `info`, `money` and
`photo`) can be told apart.

## 10. Not done here

Other items own these files; each is a call-site change on top of this API.

- `Glyph.tsx` and `StatusMark.tsx` (ICO-01) and the guard that no Phosphor import lives outside `Glyph`.
- The tab bar: `muted={!selected}` draws the 30 px sticker in the quiet tone; the plan's P3 gives it a crisp inactive state.
- `StateView` still draws `info` for error and offline; ICO-04(d) moves it to `alert`. `inboxEventArt`, the Home door
  (`publish`), the Zadaci menu entry and the "Termin nije potvrđen" status are likewise still on their old kinds.
- Call-site sizes 14, 18, 22, 26, 28, 30, 36 (the plan's clean-up to the ladder), and the `tone="accent"` calls for unread,
  waiting and urgent marks.
- `Pictogram`, `PickerTile` and `HomeLaunchArt` keep their own tones; they are not FactArt.
- The owner's A/B of the single-tone default against the old two-tone look does NOT exist on the board: both cuts there are in
  the new tones, and the old two-tone sticker (the 2026-09-22 "identical look") cannot be redrawn from this code. The team
  reversed it by default, reversibly, and the owner judges it against the build already on his phone and the screenshots
  taken before this pass (`base_home` and the others), or from Git history.

## 11. Adding a kind

1. Add it to `FACT_KINDS`, to `FACT_MEANING` (a phrase no other kind has) and to both `mark()` and `art()`.
2. Draw the mark first: one tone and white, at most four shapes, strokes 2.4 or more, inside 0.5 to 31.5, no tick unless it
   says "confirmed".
3. Run `fact-art.test.tsx`, then look at the board on the phone at 16 px.
