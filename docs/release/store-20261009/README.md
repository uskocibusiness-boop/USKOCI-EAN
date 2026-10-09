# USKOČI — Google Play i App Store paket

**Datum:** 9. oktobar 2026. **Status: dokumentacija pripremljena; javna objava još NO-GO.**

Snimak izvora: `uskocibusiness-boop/USKOCI-EAN`, canonical branch `work/uskoci-ui-unification-20260924`, commit `ce7ce465b38109e4b2be6705532d5a7a25656dea`. Ova dokumentacija nastaje na izolovanoj grani `work/uskoci-store-release-pack-20261009`, ne menja Android/iOS aplikaciju, backend, Play nalog ni ijednu korisničku sesiju.

| Datoteka | Namena |
|---|---|
| [00-STATUS.md](00-STATUS.md) | Tačno stanje i blokade |
| [01-PLAY-LISTING-SR.md](01-PLAY-LISTING-SR.md) | Copy-ready srpski Play listing |
| [02-APPLE-LISTING-EN.md](02-APPLE-LISTING-EN.md) | English App Store listing |
| [03-DATA-DECLARATIONS.md](03-DATA-DECLARATIONS.md) | Radna Google Data Safety / Apple App Privacy matrica |
| [04-LEGAL-DELETION-WEB.md](04-LEGAL-DELETION-WEB.md) | Javni URL-ovi, operater, brisanje naloga |
| [05-TESTERS-REVIEW-ASSETS.md](05-TESTERS-REVIEW-ASSETS.md) | Review nalozi, tester plan, screenshotovi |
| [06-SUBMISSION.md](06-SUBMISSION.md) | Tačan redosled koraka i vlasničke odluke |

**Read-only izvorna provera:** `node scripts/check-store-release.cjs`. Ne donosi PASS dok nema stvarnih dokaza.

Ranija detaljna baza ostaje `docs/implementation/release-prep-20260930` i `docs/implementation/legal-drafts-20260930`. Forenzički NO-GO: `docs/implementation/ui-ux-pass-20261002/evidence/forensic-20261009/release/store-matrix.json`.

Nema poslovnih tajni, korisničkih podataka, signing ključeva ni izmišljenog legal identiteta u ovom paketu.
