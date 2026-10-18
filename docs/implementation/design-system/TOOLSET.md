# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI standard toolset

Decided 2026-09-23 (night) under the owner's master UI/UX directive, step B: inventory every available skill, plugin,
connector and tool, read its instructions, and keep only the ones that permanently improve USKOČI. The goal is the best
relevant set, used every time in its phase, not the largest set.

## The standard set (use every time in its phase)

| Phase | Tool | What it owns | Notes |
| --- | --- | --- | --- |
| Design audit | **impeccable** (critique, audit; harden and polish before release) | React Native audit from source: screen-reader labels, 48 dp targets, text scaling, list performance; critique scoring | Its "be bold" stance yields to "refine, don't replace". Its automatic post-edit scan found nothing in the app code, so it only adds delay. |
| Pictograms, accessibility checks | **ui-ux-pro-max** (search and checklists only) | RN rules checked against 0.86, native touch/contrast/large-text/reduced-motion checklist | Never use its design-system generator (it proposes new colours and fonts). |
| Design system | **expo:expo-design-system** | Extend the existing tokens (`src/ui/system/tokens.ts`, `src/theme/tokens.ts`, `motion.ts`); find hard-coded colours, spacing and fonts | Never create a second `src/theme/` next to the existing one. |
| Screen implementation | **vercel-react-native-skills** (MIT, linked into `~/.claude/skills` on 2026-09-23 from `~/.agents/skills`) | List performance, Pressable, expo-image, safe-area scroll, native modals, Text rules | Available to Claude from the moment it was linked. |
| Motion (building) | **animate-expo** | Should-this-animate check, UI-thread motion (Reanimated 4), springs, haptics, reduced motion | `expo:expo-animation` is the same content; use one. Ignore its package suggestions unless approved. |
| Motion (review) | **review-animations** | Block/approve review of any change that moves | Its values are web; convert with animate-expo's tables. |
| Device QA | **maestro-mobile-testing** within `.maestro/README.md` (look-only flows, never signs in, never writes) and **adb** on the owner's HONOR phone | Screens on the real device, logcat crash check | The README wins over the skill's sign-in templates. No Maestro Cloud. |
| Code review | **pr-review-toolkit** (code-reviewer, silent-failure-hunter, pr-test-analyzer, type-design-analyzer) | Every package before its checkpoint | The silent-failure hunter matters here: swallowed errors hid the notification-settings defect. |
| Every phase end | **superpowers:verification-before-completion** | No "done" without fresh tsc, Jest and phone evidence tied to a commit | |
| Any failure | **superpowers:systematic-debugging** | Root cause before a fix (worked for the dead stars and the push-provider defect) | |
| Backend and database | **supabase** + **supabase-postgres-best-practices**, and the Supabase connector (read-only queries, logs) | RLS, grants, migrations, edge functions | DEV changes still need a disposable proof and the owner's "primeni". |
| Security and release gate | **claude-security** (scan changes), **security-guidance** (always on) | Scan before merge and before release | claude-security writes a `CLAUDE-SECURITY-<date>/` folder; keep it out of commits. |

**Always on, nothing to start:** typescript-lsp (live type errors; `npx tsc --noEmit -p tsconfig.json` stays the real
check), security-guidance.

**Checks run at every unit end:** `npx tsc --noEmit -p tsconfig.json`; `npx jest` (full at milestones, focused during a
unit); CI "Build Android development APK" (`-f target=phone`); `adb install -r` on the HONOR phone (serial …1205, data
kept); a read-only screenshot walk (`phone.py`: acts only while USKOČI is in the foreground); logcat crash count.

## Connectors and environment tools

| Tool | Use | Verdict |
| --- | --- | --- |
| Claude Docs connector | Owner-facing documents (the forensic analysis, the master design doc) | STANDARD for owner documents |
| Artifacts (HTML) | Visual boards (icon and pictogram board), control table | STANDARD for visual review pages |
| Built-in browser | Owner's HTML prototypes (V41, V46) through the local static server on port 8097; reference research | STANDARD for references |
| Supabase connector | Read-only logs and catalog queries while debugging; never writes without the owner | SITUATIONAL |
| Expo connector | EAS build status, Play/App Store reviews and crashes after release | SITUATIONAL (release) |
| Context7 | Current docs for Reanimated, worklets, gesture-handler, supabase-js, Expo 57 | SITUATIONAL (API doubt) |
| Figma (owner has a Pro seat) | Optional home for the design system as a Figma file; Weave is not linked | SITUATIONAL; the repo tokens stay the source of truth |
| gh CLI | CI dispatch, artifacts, run status (a wait loop must request `status,conclusion`) | STANDARD |
| adb + Python | Phone install, screenshots, uiautomator labels | STANDARD |

## Situational (only when the condition holds)

apple-design (a new drag, swipe or sheet gesture), emil-design-eng (polish review of a finished screen, before/after
table), find-animation-opportunities (when a new screen lands), improve-animations (once per release),
prototype (an open visual choice between genuinely different versions; delete the prototype route afterwards),
superpowers:brainstorming (a genuinely new product decision), superpowers:writing-plans (work handed to Codex or agents),
thermo-nuclear-code-quality-review (large refactors), expo-router, expo-ui, expo-dev-client, eas-app-stores,
expo-upgrade, expo-module (the voice module), feature-dev, claude-code-setup.

## Skipped, with the reason

- **Website clones:** airbnb-design, airtasker-design, gojek-design, linear-design, taskrabbit-design, thumbtack-design,
  wolt-design. They copy another company's web homepage, start on any UI task and pull away from USKOČI's own language.
  The owner's rule is originality: references are a quality bar, never an identity.
- **Web-only:** animate, ask-sonner, design-system (CSS/Tailwind), mobile-app-ui-design (Tailwind output, glow/glass),
  pick-ui-library, ui-styling (shadcn/Tailwind), slides.
- **Wrong fit:** banner-design (marketing, remote image calls), brand (writes a second brand system),
  write-swift (no Swift in the repo), animation-vocabulary (naming only), code-review and code-simplifier (duplicate
  pr-review-toolkit; code-review posts public PR comments), frontend-design (V28 already fixes the look).

## Nothing new is installed

No npm package was added for this toolset. The only activation was linking the already-downloaded
vercel-react-native-skills folder. Optional, the owner's call:

- `npx expo lint` would add eslint and eslint-config-expo and write `eslint.config.js` (catches hook mistakes and unused
  imports that tsc and Jest miss).
- Two script names without packages: `"typecheck": "tsc --noEmit"`, `"e2e": "maestro test .maestro/walkthrough.yaml"`.

## Settings the owner should decide (not changed by the agent)

- Remove `apply_migration` (and ideally `execute_sql`) from the auto-allow list in `.claude/settings.local.json`, so a
  DEV write always asks.
- Turn off impeccable's automatic checks for this repo (`/impeccable hooks off`); they found nothing in app code.
- Disable the seven website-clone design skills listed above.
- Add `CLAUDE-SECURITY-*/`, `plans/` and `docs/superpowers/` to `.gitignore`.
- The Expo and Supabase *plugin* servers need sign-in through `/mcp` in an interactive terminal; the claude.ai
  connectors already cover both.
