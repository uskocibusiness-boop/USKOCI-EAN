---
name: uskoci-ai-chat-reference-gemini
description: "Owner 2026-09-23 night — Gemini's app is the look reference for USKOČI's AI chat (Novi zadatak, radni profil kroz razgovor): floating pill composer (+, text, mic, voice-mode button), live voice mode, plain large answer text; modernise freely"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-23T21:37:50.736Z
---

> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../../PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

On 2026-09-23 (night) the owner sent two screenshots of the Gemini Android app and wrote: "Ovo neka bude referenca za
izgled dela ovog chata gde se piše, naravno dozvoljavam da modernizuješ i unaprediš, ali tu je i klasični tekst i
pisanje, a tu je i razgovor glasovni."

What the reference shows:
- **Typing mode:** the answer as plain large text on a light ground (no bubble), a row of small outline actions under
  it, a quiet disclaimer line; at the bottom a FLOATING white pill composer: "+" (attach), the placeholder, a mic, and a
  round tinted voice-mode button with a waveform. Header: menu, title, new-chat, "···".
- **Voice mode:** the same answer text; at the bottom a row of round white buttons around a large softly glowing pill
  (voice activity), a mic toggle and a close X.

**Why:** he wants USKOČI's AI conversation (task creation `/nova`, worker profile `/profil/razgovor`) to feel like a
modern assistant, with both classic typing and a voice conversation.
**How to apply:** use it as the reference for step 6 (Novi zadatak) and the worker-profile conversation: floating pill
composer, calm plain assistant text, a voice mode entry. Keep USKOČI's identity (green/orange, Inter, FactArt), never
copy Google's assets. The existing hold-to-talk (sends on release) stays. A voice conversation where the app SPEAKS
back needs a text-to-speech package: `expo-speech` is NOT approved ([[uskoci-design-pass-2026-09-23]]) — ask before
adding any. See [[uskoci-autonomous-perfection-directive]].
