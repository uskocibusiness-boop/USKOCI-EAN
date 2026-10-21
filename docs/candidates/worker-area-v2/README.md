# Worker Area V2 admission candidate — source only

This directory is not imported by the active `uskoci-worker-interview` Edge function. It is an experiment for keeping unsupported broad work-area statements out of the one-city V1 patch. Run its isolated proof with:

```sh
node --test docs/candidates/worker-area-v2/worker-area-admission.test.mjs
```

The recognizer is deliberately bounded. These natural on-site statements currently classify as `NONE` and would not block a mistaken V1 one-city/radius patch if connected to runtime:

- `Radim širom Srbije`
- `Novi Sad do 30 km i Beograd do 30 km`
- `Radim od Vranja do Subotice`

The independent review also found regressions while this candidate was being built. The current isolated test matrix includes these exact phrases, but the failures show why a phrase guard is not a safe production boundary:

- `Radim samo online u Novom Sadu i okolini` was incorrectly treated as a local radius request.
- `Živim u Novom Sadu i Beogradu, radim samo online` was incorrectly treated as two on-site work cities.
- `Prevod samo online; moler Novi Sad i okolina` was incorrectly treated as remote-only, hiding the painter's missing distance question.
- `Moler sam deset godina. Radim u celoj Srbiji.` initially lost the independent ten-year fact when the unsupported public area claim was removed.

The isolated candidate now handles those fixtures. Other natural phrasings remain unbounded, including the three currently failing examples above.

The active signed review/save contract stores one `location`; the matcher, dispatch/push and “Za mene” use that V1 shape. Before Area V2 can be active, the schema, both signed review RPCs, Save, readback, shared matcher and requeue path must agree on a confirmed area source. See `docs/current/WORKER_AI_AREA_MVP_GAP_20261021.md` for the full contract.

Do not deploy this candidate as a stand-alone Edge guard or describe its passing examples as complete natural-language coverage.
