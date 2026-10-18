> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../../design-system/PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

# V28 reference screens (rendered, not reconstructed)

These screens show the owner's V28 prototype as it actually runs. They were rendered in headless Edge
at 412×(900–1500) CSS px and a device scale of 2 on 2026-09-22:
- source: `C:/Users/user/Downloads/USKOCI_V28_PREGLED (1).html`, SHA256
  `29fbe6cbdcf333fc9594ab3c552871b444ea9e16bb9884f13d0ba36c35337314`;
- each screen was opened through the prototype's own `go()`, `openTask()` and `state` calls;
- the data is the prototype's local demo data, not USKOČI records.

| file | screen |
| --- | --- |
| `v28-00-ulaz.png` | entry after the intro: Objavi zadatak / Uskoči i zaradi |
| `v28-01-zadaci.png` | Zadaci: Objavljeni / Moje prijave, attention, own task cards |
| `v28-02-prilike-lista.png` | discovery list: search, Mapa/Filteri, sort, cards |
| `v28-03-detalj-zadatka.png` | task detail: facts, price block, "Važno za ovaj zadatak", place, Q&A, publisher, one button |
| `v28-04-prijave.png` | the applications for one task |
| `v28-05-jedna-prijava.png` | one application: total offer, task link, message, confirm-to-select button |
| `v28-06-dogovori.png` | Dogovori list |
| `v28-07-dogovor.png` | one Dogovor: next action, accepted terms, contact/place, history, help |
| `v28-08-profil.png` | own profile |
| `v28-09-ai-razgovor.png` | new task conversation (start) |
| `v28-10-obavestenja.png` | notifications |

The measured colours, sizes and card values are in `../V31_IDENTICAL_LOOK_20260922.md`.
The prototype's defects are listed there too: text under 12 px, the five Lottie animations hidden by
their own background circle, "0 prijava" noise, and demo-only concepts.

These are a starting point, not a pixel lock. The owner accepts better solutions where they serve the
user.
