# Owner decision 2026-10-07: push notifications are part of V1

**The owner's words (2026-10-07, chat with Claude Code):**
"ja bi push notifikacije svakako sad puštao ... a i hitno bi možda regulisao. ... push obaveštenja su ključ da na vreme bude obavešteno šta gde ima, ko ima, kad ima novi zadatak, stigla poruka i tako dalje. Jer bez toga se vrednost ove same ideje aplikacije pre polovine, znači to mora biti."

## What this decides

1. **Push notifications are IN V1.** This supersedes decision R02 of 2026-10-02 ("no push in the first store release", `OWNER_DECISIONS_20261002_ALL75.md`). Latest explicit owner decision wins (`AGENTS.md` 1.1). Plan R2 phase P06 ("Push od događaja do pravog ekrana") is a V1 requirement, not later work.
   - Minimum V1 events named by the owner: a new task/opportunity ("šta gde ima, ko ima, kad ima novi zadatak") and a new message ("stigla poruka"); the other approved events of `NOTIFICATION_MATRIX.md` follow the same path.
2. **HITNO is NOT decided.** The owner said "možda" (maybe). Decision A21 (HITNO out of V1) stays in force until he confirms it in his own words together with its rules (who is offered an urgent task, how long it waits, what happens if nobody accepts, and whether it costs anything; a price or fee is his decision alone).

## What this does NOT authorize

- No DEV/PROD change: enabling the push transport, registering devices, admitting deliveries or applying the prepared push candidates (single-target admission proof, `push_scheduler_provider_gate_20261004`) each still need the owner's exact `PRIMENI <ime paketa>` after an approval block (`AGENTS.md` 3.1.2, 3.1.7, 3.1.8).
- No global enable of sending; the way to the first real push stays the single-device, single-event proof (`AGENTS.md` 3.1.7), then widening.
- No new account, key or paid service: the Firebase / FCM credentials for the permanent package and the Expo push credentials are the owner's accounts.

## What follows (work order, plan R2)

- P06 moves into the V1 critical path right after P04/P05 (events need a real Dogovor and chat). Preparation can start now: re-read the prepared push candidates and proofs, the provider gate, the stale delivery rows (decision A24: untouched), and the Firebase identity of the Preview package `rs.uskoci.preview` and of the permanent `rs.uskoci`.
- Owner-only inputs for push: Firebase project and `google-services.json` for each package identity, FCM credentials stored in the owner's Expo account, and the exact `PRIMENI` words per package.
