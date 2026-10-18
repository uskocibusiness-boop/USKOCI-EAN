> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

# Owner references: spacious discovery, filters and map

Date: 2026-09-25. Documentation-only design refinement following the owner's seven supplied Airbnb screenshots.
App source remains `0f4d764464a33cd248726b46b261e63325fcbd49`; compared with the R10 installed-emulator image
`r10-home-and-discovery-20260925/screens/r10-final-map.png` and the current Discovery presentation bodies.
This is not a new app implementation, native acceptance, provider change or live Airbnb audit.

## Evidence and intent

Owner attachment filenames: `13056.jpg` (date selection), `13057.jpg` (list), `13058.jpg`, `13059.jpg`,
`13060.jpg` (filters), `13061.jpg` (map dominant), `13062.jpg` (map with raised results).
Original images remain in the conversation's local attachments; no Airbnb assets are added to the app.
The owner's stated preference is white, clear, generous and readable: large words and controls without crowding.
Screenshots show composition and two map/list positions. They do not establish animation timing, gestures,
accessibility behavior, data contracts or exact logical dimensions.

## What transfers to USKOCI

| Observed reference | Product interpretation | Current source / work still owed |
| --- | --- | --- |
| One leading search summary and an adjacent filter control | Let search lead Discovery. Keep profile, notifications and task creation reachable while reducing competing top-level chrome. | `DiscoveryPresentation.tsx` renders `ScreenHeader` above `DiscoverySearchBar`; the R10 native capture shows the stacked height. Compose a screen-specific compact header, preserving all entries and selected navigation. |
| Large map with a shallow or raised white results sheet | Search, inspect the area and compare tasks on one surface. Retain context through the same sheet rather than switching screens. | `DiscoveryListSheet.tsx` already uses the approved Gorhom sheet, three snap positions and shared motion. Refine visual proportions; do not rebuild the camera, selection or recovery logic. |
| Subtle ground, distinguishable parks/water and clear labels | A fresh, legible map with USKOCI logo markers and true terms. | Existing branded palette/pins are implemented. Evaluate them with actual pins, selected/grouped points and high density. No Google provider/key change is implied by the reference. |
| Price capsules and smaller background points | Prioritize the selected task and use restrained marker density. | Preserve logo + true amount/offer text, count clusters and native fallback beyond the existing rich-marker budget. Missing prices never become zero. Remote or point-less tasks stay in the list, without invented coordinates. |
| Results grouped with space and quiet separators | Make title, location/time, terms and person easy to scan. | Current TaskCard rows are heavily outlined in the R10 capture. Explore a quieter list treatment before removing borders globally; selected previews and independent cards may need different surface separation. Do not invent or require task photography. |
| Filter sections, readable chips, visible selected values and a stable bottom action | The owner can understand the current conditions and apply a deliberate change. | Existing search draft, reset/apply/cancel, date/work-mode/people/price logic remain. Refine spacing and hierarchy without importing accommodation-only filters or hiding important active conditions. |
| Restrained outline command icons with richer category illustrations | Use simple command glyphs; reserve illustrated FactArt and the brand mark for meaningful identity/facts. | Existing icon libraries suffice. No new icon or animation package is approved by these attachments. |

## Three compositions considered

1. **Independent brand header plus floating search:** preserves the current identity row, but consumes map height
   and gives several elements similar prominence. The R10 capture demonstrates this cost.
2. **Search-led compact header, quick conditions and one results sheet:** makes the task search primary while
   retaining identity/navigation access in a compact screen-specific composition. Selected direction for the next
   Discovery refinement; preserve the owner-requested visible USKOCI identity without dedicating a large separate row.
3. **Map-only mode with controls appearing on demand:** maximizes geography, but hides useful search and navigation
   and adds interactions. Not selected as the default; the shallow sheet already provides a map-dominant view.

## Implementation and acceptance boundaries

- Design targets to validate, not screenshot measurements: 20–24 dp content gutters, 24–32 dp separation between
  unrelated sections, 16–18 sp main reading text and 22–28 sp section/page titles where the hierarchy warrants it.
  All text scales with the user's setting; no visible text below the owner's 12 sp minimum. Keep 48 dp touch targets.
- Use deliberate white surfaces, soft elevation and green accents. Avoid adding a border, shadow or illustration
  to every element. Preserve the current brand rather than copying Airbnb's black/pink identity.
- Mandatory map attribution remains complete, legible and reachable. Its present broad white rail is visually
  prominent; any more compact composition must preserve link targets and enlarged-text behavior. No unverified
  licensing change, hidden credit or provider substitution.
- Counts are the actual loaded/filtered result set, not a claimed server-wide total. Sorting, saved-search alerts,
  pagination and server-side filtering remain separate contract work in control rows B04/B05.
- Keep the existing soft sheet/camera/press motion. Choose motion from the interaction and test it; static
  reference photos are not evidence of spring values or timing. Respect the system's Reduce Motion setting.
- Refine as one coherent Discovery package alongside the continuing app work. Do not build an APK for this
  reference-only update. Application changes need types/full Jest, a source-bound combined APK, and bounded
  normal/large-text, empty/error, selected-pin and list-scroll observations before being marked implemented/accepted.

## Current outcome

Master plan and control next steps record this direction. No runtime, server, dependency, payment, permission or
device setting changed. Prior R10 test/APK evidence remains historical evidence for that exact app source.
Remaining priority work is still the large-text chat keyboard, offers/candidate/public profile, and remaining
screen composition. These references refine that work and the next Discovery pass; they do not restart the project.
