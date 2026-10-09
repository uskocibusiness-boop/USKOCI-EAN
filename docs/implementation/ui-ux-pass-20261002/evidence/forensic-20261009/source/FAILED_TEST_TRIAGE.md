# Aktuelni puni test prolaz i trijaža — 6311804d

TypeScript exit0. Puni Jest exit1:603/604 suite-a PASS;13476 testova PASS,1FAIL,9skipped;6snapshotPASS. Sačuvani sirovi rezultat je lokalni full-jest.json, a deljivi sažetak je full-regression-summary.json. Nijedan izvor/test nije izmenjen da bi rezultat postao zelen.

Jedini FAIL je src/data/__tests__/p5-matching-field-contract.test.ts:355, G04-5. Helper na127 traži marker `const missing = ['need.description'`, koji više ne postoji. Edge supabase/functions/uskoci-ai-interview/index.ts:672–677 sada koristi Set i sve requiredForDraft ključeve radi provere naslova/kategorije pre pregleda. To je zastareo source-text test, ne dokaz ponašajne regresije AI-ja.

Najmanji smisleni repair: stabilniji početak `const missing = `, isti kraj `.filter(key => !facts.has(key));`; nad tim blokom proveriti requiredForDraft. Zasebno proveriti stvarni blok pitanja korisniku, umesto zabrane kategorije u proveri potpunosti. Preimenovati istorijsku tvrdnju „hard for every worker“. Ne vraćati Edge na staru proveru.

minimum_experience_years je opciono AI-proposable polje0–60 (src/contracts/needFactsV2.ts:34; Edge477), ali primenjeni MATCH-V1 uklonio je iskustvo kao uslov/bodovanje (supabase/candidates/match-v1-20261007/candidate.in-transaction.sql:333–349; supabase/operations/dev-alpha/ledger/20261007_match_v1_application.receipt.json, ledger231). Stari baseline nije današnji matching blocker.

supabase/proofs/ai/ai_edge_context.test.mjs:359 sadrži izvršive testove stvarnog transpajliranog handlera u izolovanom VM-u, sa mock fetch/provider vrednostima; ti testovi pokrivaju nedostajući naslov/kategoriju i ograničeno finish-only dopunjavanje. To ostaje transport-mock dokaz, ne poziv pravog AI provajdera. Rezultat novog pokretanja je u edge-context.log i glavnom izveštaju.
