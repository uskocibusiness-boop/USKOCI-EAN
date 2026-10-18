# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](../implementation/design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI Design Rules

## Product character

USKOČI feels like a capable person who arrives on time: clear, warm, direct and calm. It is a consumer marketplace, not an enterprise dashboard. The system should feel young and distinctive without sacrificing trust.

Brand line: **USKOČI — Meni treba. Ja mogu.**

Keep the original U/handshake/pin mark and its intro motion. Refine its color treatment per direction, but do not redraw its semantics.

## Experience principles

1. **One dominant next action.** The user should know what happens next within one second.
2. **Compact summaries, full details.** Cards support scanning; the full screen supports decisions.
3. **Truth before decoration.** Never invent a rating, verified badge, exact address, success, price, active HITNO state or delivery confirmation.
4. **Progressive disclosure.** Show advanced controls when the user's current decision requires them.
5. **Preserve work.** Network failure, Back, role switch and app restart should not erase unsent or editable input.
6. **Server authority is visible through states.** Stale, deadline-closed and conflict states explain that the latest data must be reviewed.

## Layout

- Mobile source frames: 390×844, verify at 360×800 and 430×932.
- Use a 4pt base grid; common gaps 8, 12, 16, 24 and 32.
- Minimum interactive target 44×44; primary action belongs in the lower thumb zone.
- Page content uses 16–20 horizontal padding. Cards use 16–20 internal padding.
- Respect safe areas and keyboard. Composer remains above IME.
- Cards do not scroll internally. A task detail is a full screen.

## Typography

- Use one primary family. Test Manrope against a warmer humanist alternative before lock.
- Maximum four functional sizes per screen and two weights in ordinary content.
- Price and time use tabular figures.
- Headings are sentence case. Avoid all-caps labels except very short contextual eyebrows.
- Serbian Latin is primary interface copy; preserve Č/Ć/Š/Ž/Đ correctly.

## Color

- Light-first neutral ground and high-contrast ink.
- Forest/teal communicates trust and orientation.
- Orange is a precise action/brand signal, not a blanket fill.
- Semantic states always pair color with icon and text.
- Meet WCAG AA for meaningful text. Do not use the current bright orange as body text on light backgrounds.

## Navigation

Owner-confirmed correction, 8 September 2026: this three-zone decision supersedes the earlier five-tab design brief. The current canonical three-zone shell is aligned with it.

- MENI TREBA (Naručilac): Zadaci | U / Novi | Dogovori.
- JA MOGU (Uskočer): Prijave | U / Zadaci | Dogovori.
- The selected tab uses icon, label and shape/weight, not color alone.
- Bell → Notifications / Inbox. Avatar → Profile, including the intent switch. No permanent Home or Profile tab. Map/List are modes inside Zadaci, accessible in both intents; access to public discovery does not grant Application or private-data permissions.
- Preserve per-role navigation history.

## Marketplace cards

A compact Need/Opportunity card answers:

- what;
- where;
- when;
- fixed price or “traži ponude”;
- people required/covered;
- critical requirements;
- status when relevant;
- requester avatar/name/rating on worker discovery when real;
- one hero thumbnail or up to three small thumbnails with `+N` when media exists.

Owner drafts use a subtle Draft status and **Nastavi uređivanje**. They do not show zero Applications or candidate actions before publication.

## Full Need / Opportunity detail

Use an editorial full-screen hierarchy: gallery, title, status, price, time, people, description, requirements, requester trust, map/route and sticky contextual CTA. Public workers see approximate location; owner and authorized participants may see exact location according to the backend projection.

## AI creation

- Conversation is the primary input, not a wizard of tiny confirmations.
- Show a live compact marketplace card near the conversation.
- Ask one short question at a time only for missing or ambiguous required facts.
- Permit direct correction of visible facts.
- Offer voice and photo affordances as disabled/gated states until implemented.
- One final **Objavite Zadatak** expresses acceptance of the summary, followed by server validation.
- Loading shows immediate acknowledgement and streamed progress; never leave a silent spinner.

## Dogovor

Dogovor is a calm workspace, not a dense settings page. Lead with current status and next action. Price, schedule, route and participants are scan blocks. Chat is first-class. Timeline is embedded. Changes, cancellation and problem reporting live under contextual actions with consequences stated plainly.

## Motion

- Preserve the original intro choreography and wordmark timing.
- Press response 100–140ms; state transitions 180–260ms; sheets use a damped physical spring.
- Motion communicates continuity: card → detail, pin → sheet, selection → Dogovor.
- No decorative perpetual motion. Respect reduced motion.
- Success may use one restrained U-signal pulse or handshake settle.

## State language

- Loading: skeleton matching final geometry.
- Empty: explain why and provide one useful CTA.
- Error: concrete message, Retry, preserved user input.
- Offline: cached data labelled with age; writes require explicit retry.
- Stale/conflict: explain what changed and reload before committing.
- Success: show the object created and the next destination.
- Destructive: state consequence; confirm only when the action cannot be easily reversed.

## Accessibility

- 44pt targets, visible focus, scalable text, screen-reader order matching visual order.
- All icons have labels when actionable; decorative vectors are hidden from accessibility APIs.
- Map has list equivalent. Status never relies on color alone.
- Voice has text transcript and cancel. Images have useful alt descriptions where user-authored context supports them.

