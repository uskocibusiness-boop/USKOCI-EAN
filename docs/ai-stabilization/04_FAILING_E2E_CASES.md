# Regresije i E2E granice

| Lokalno reprodukovan problem | Popravka |
| --- | --- |
| S09: HTTP429/503, abort, invalid/truncated JSON postaje pitanje | Tehnički status odvojen od prave semantičke nejasnoće; nema izmišljenog pitanja. |
| S10: katalog/workAreas/provider guess pretpostavlja mode | Saved izbor ili USER-quote predlog; nepoznato ostaje nepoznato, handoff se čuva. |
| Samo mode/handoff promena ne pokreće klasifikaciju | Postojeći mode helper/schema uključen u dual tok; metadata uklonjena pre completion RPC-a. |
| Provider outage propušta nov mode koji katalog podržava | Nova scope promena ne prolazi bez validne odluke; nepromenjeni saved izbor opstaje. |
| Biografija produžava obavezan razgovor | Opciono; eksplicitno tražen predlog ide u isti završni review. |
| Writer vreme pogrešno nazvano Gemini latencijom | PROVIDER wrapper i stvarni handler testovi success/failure, bez sadržaja poruka. |
| CHECK blokira pending objavu i stare izmene | Kandidat povučen/arhiviran; 6 izvršnih PG testova čuva FK i scope granice. |

Ranije: welcome assertion 0fff6e4c, worker safety pravila 8cacf889, BG labels 8967ee21. Njihovi raniji test brojevi su istorijski, ne novi E2E.

## Nije potvrđeno

- Stvarni Gemini kvalitet/latencija, geocoder, telefon i DEV deploy: nisu izvršeni novi pozivi.
- S07/S08 semantički REUSE različitog naziva i signed SQL admission nisu rešeni.
- S06/F4 durable retry i kompletna 70+30 golden matrica nisu završeni.
- Review→Save→objava→matching→push→prijava→Dogovor nije izvršen.
- EUR korekcija ranije aktivnog RSD fakta ostaje postojeći TODO: potreban atomski writer/review ugovor.
- HOURLY/downstream cene zahtevaju poslovni ugovor; nema tihe konverzije.
- Objavljeno bez kategorije nije samo po sebi zabranjeno; nije dozvola za automatski matching.

Tačni testovi i commitovi su u glavnom status fajlu u korenu. Lokalne popravke nisu DEPLOYED niti E2E_PASS.
