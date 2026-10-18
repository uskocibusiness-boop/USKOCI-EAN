---
name: uskoci-ship-mode-skills
description: "Owner's 2026-09-23 ship-mode mandate — which local skills/agents apply permanently to USKOČI work, and the work rhythm (big units, checks at unit ends, builds only for device-level confirmation)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-23T13:07:35.158Z
---

> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../../PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

On 2026-09-23 the owner (garbled Serbian, then a clear restatement) asked to check every available skill/tool and
apply permanently all that help finish the app: clean code, RN/Expo, UI/UX, accessibility, performance,
navigation, animation, testing, security, release. Priority: 1 strong coding and real finishing, 2 UI/UX and
complete flows, 3 removing bugs and dead ends, 4 performance/stability, 5 release polish. Work in large logical
units; run tsc/Jest at the end of a unit, not after each edit; build APKs only when a change needs the device.
Do not only analyse — fix on the spot. Decide small things alone; existing direction/decisions are the source of
truth. One full regression at the end.

**Skills that apply (local, `~/.claude/skills`, listed in docs/implementation/v5-ai-first/DESIGN_SKILLS.md):**
mobile-app-ui-design, animate-expo, animation-vocabulary, improve-animations (read-only audit), review-animations,
find-animation-opportunities, emil-design-eng, apple-design, wolt-design/airbnb-design (reference quality bar),
ui-ux-pro-max, vercel-react-native-skills, design-system, maestro-mobile-testing,
thermo-nuclear-code-quality-review at unit ends. Plugin agents: pr-review-toolkit code-reviewer /
silent-failure-hunter at milestones; impeccable hook already scans writes. Superpowers: systematic-debugging for
device-only defects (worked for the dead-stars bug: reproduce on device, discriminate with probes, then fix).

**Why:** the owner's stated goal is a FINAL premium fluid app for Google Play, not a prototype; repeated small
preview/build cycles were wasting his evening.

**How to apply:** at the start of a unit, name the skills used in one line; at the end, one tsc + focused Jest;
full Jest + both APKs + emulator Maestro sweep only at the milestone. Assets: only commercially safe licences
(Phosphor MIT, Inter OFL, Lottie Simple License); prefer on-brand Reanimated/SVG motion over downloaded packs;
every download still needs a stated filename/source/size. See [[uskoci-design-pass-2026-09-23]],
[[uskoci-v28-identical-look]], [[uskoci-control-table]].

**V41 clarification (owner, 2026-09-23 evening):** V41 HTML is the DIRECTION for the look (header, cards, strips,
underlined tabs, liveliness, depth), not a new layout: "velika dugmad ostaju, ovo su samo usmerenja". Početna with
the two big tiles stays; do not replace the first tab with V41's "Zadaci" list. The forensic UI/UX analysis doc
(Claude Doc 447394ea…) is the rulebook the owner points at ("šta ona kaže?"): one ORANGE primary per screen, every
other action white with a green label, grey only with a reason, two headers, FactArt for facts, skeleton/empty/error
states. When V41 and the doc differ (V41 green buttons), the doc wins.

**Primary colour, later the same evening (supersedes the orange line above):** looking at the orange "Oceni saradnju"
on his phone the owner said the button "nije ove boje … loš fazon". V28 (his measured prototype) and V41 both draw the
primary green with a white label, so `brandAction` is now green + `sys.color.onGreen` (commit dcdcbb88). Orange stays
an accent only: the Home publish tile, what waits for you (strips, dots, counts), the map "+". Do not switch it back
to orange from the doc alone; ask him first. Same pass: one FactArt icon system for every fact, one card look
(`card`/`cardCompact` with the V28 TaskCard shadow, `inset` for notes), one voice without grammatical gender, one
`vreme()` time format. See [[uskoci-design-pass-2026-09-23]].
