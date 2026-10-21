# Worker Area V2 admission study — local source only

The runtime helper now lives at `supabase/functions/_shared/workerAreaAdmission.mjs` and is called by the local `uskoci-worker-interview` source after provider and availability validation, before the existing worker-turn completion RPC. This directory retains the isolated test fixtures and a re-export for them.

The helper is an additive V1 safety measure. For recognized country, region, corridor and multiple-city wishes it removes a proposed one-city `location` patch and an unsupported broad public biography claim, while keeping independent service and availability facts. A new locality with “okolina” but no distance prompts for a distance. A model radius different from the person's explicit distance is also rejected. `REVIEW` and `BLOCK` still freeze the candidate. The signed review, Save, matcher, dispatch and push paths are unchanged.

The actual-handler fixtures cover an older Niš area versus remote-only Novi Sad wording, “u okolini Beograda” with an omitted or stale provider area patch, an online translation clause alongside explicit on-site Novi Sad (including a comma separator), country/corridor phrasings, independent experience joined to a wide-area claim by a comma, personal or colleague names joined by “i”, and a corrected “nije 30 km, nego 50 km” distance. They also reject provider Beograd/30 when the person said Novi Sad/30, broader “po/u Srbiji”, standalone “Srbija”, “po celom Balkanu”, and an on-site area change from “Samo online. Živim u Novom Sadu.” A unitless or partly unitless “nije 30 nego 50” correction is ambiguous about what the number measures, so it blocks an area patch and asks for kilometres. Independent skills remain in the draft. Its place comparison is a narrow Serbian inflection heuristic, not a resolved place identity.

Run the isolated and exact-handler synthetic checks:

```sh
node --test docs/candidates/worker-area-v2/worker-area-admission.test.mjs
node --test supabase/proofs/ai/v5_worker_edge.test.mjs
```

This is **not Area V2** and it does not make “cela Srbija”, “Vojvodina”, “Balkan” or several cities active coverage. It is deliberately bounded natural-language recognition. The provider instruction and this guard can still miss an unanticipated phrasing, a lowercase or inflected place, a cross-turn correction, an ambiguous comma, or a mixed service relation. A city name match is heuristic and not a server-resolved place ID. Do not treat this as a complete authorization boundary for broad area support. The authoritative V1 database continues to accept exactly one city/radius; no DEV deployment, migration or native run is evidenced here.

The next functional package must introduce a versioned, server-resolved `areas[]` candidate and saved receipt; sign the entire displayed selection in both worker review paths; save it atomically and read it back; route on-site matching, “Za mene”, dispatch and push through the same effective area source; requeue open tasks idempotently; and keep remote/handoff logic independent. See `docs/current/WORKER_AI_AREA_MVP_GAP_20261021.md`.

The three independently reproduced lowercase examples — `radim u novom sadu i beogradu`, `novi sad i beograd`, `radim u nišu i kragujevcu` — now return `MULTI_LOCALITY` in the **local source**. A small explicit alias set for Novi Sad, Beograd, Niš and Kragujevac catches these chat forms and their listed inflections without treating arbitrary words joined by „i” as places. Isolated 24/24 checks include remote-only use of those cities, personal names, unrelated „i”, and rejection of a one-city V1 location and public bio for all three examples. This remains source-only and is still a bounded heuristic: other lowercase towns, unexpected inflections, cross-turn wishes and ambiguous mixed clauses may escape it. Finite green fixtures do not prove arbitrary speech coverage or Area V2 authorization.
