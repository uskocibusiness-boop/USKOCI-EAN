# Release URL-ovi, pravni dokumenti i brisanje naloga

**Javni URL-ovi za prodavnice — ne nazivamo ih dostupnim dok ne prođu anonimni HTTPS test.**

| Svrha | URL |
|---|---|
| Marketing | https://uskoci.rs/ |
| Privacy | https://uskoci.rs/privacy |
| Terms | https://uskoci.rs/terms |
| Support | https://uskoci.rs/support |
| Account deletion | https://uskoci.rs/delete-account |
| Privacy choices | https://uskoci.rs/privacy-choices |
| Safety/UGC | https://uskoci.rs/safety |
| Data Safety info | https://uskoci.rs/data-safety |
| Operator | https://uskoci.rs/operator |
| Legal hub | https://uskoci.rs/documents |

**Kritična ispravka 09.10.** Android EAS canonical backend je `leqcwgzvjsxugfgzdmth`; raniji web account-deletion endpoint je pogrešno bio povezan s `wjxilkkyyuxyzbvhgmop` (alpha). Web grana `work/uskoci-web-release-20261009`, commit `2f53224c254153df302df70cce3a09d7c35296f0` menja browser izvor na canonical public API/RPC, čuva samo opaque command identifikatore i prikazuje `CLOSED` samo kada je server autoritativno potvrdi. Na **preview hostu autentikacija i brisanje su namerno blokirani**. Ne postoji E2E dokaz stvarnog brisanja u canonical produkciji.

Za stvarnu objavu zahtevaju se: obostrano testiranje in-app/web na disposable nalogu, proverena Auth/Storage/relational erasure, sesije nevažeće, retention/safety exceptions usko ograničeni i odobreni, podrška operativna, prijava bez instalacije aplikacije, zatvaranje bez poziva podršci kada nema izuzetka.

Postojeći nacrti: `docs/implementation/legal-drafts-20260930/LEG-02` (Terms), `LEG-04` (Privacy), `LEG-05` (UGC), `LEG-07` (Support), `LEG-08` (Deletion), `LEG-09/10/11` (evidencija/retention/processors). Nisu odobreni kao pravno finalni.

Test javnog sajta: privatni/incognito browser, normalna mobilna mreža, HTTP200 bez Vercel SSO, stvarni kontakt operatera, tačno telo dokumenta, 0 placeholder-a, pravilni HTTPS redirects, dostupnost tastaturom, PDF nije zamena za javnu HTML Privacy Policy.

Zvanično: https://support.google.com/googleplay/android-developer/answer/10144311 ; https://developer.apple.com/support/offering-account-deletion-in-your-app/
