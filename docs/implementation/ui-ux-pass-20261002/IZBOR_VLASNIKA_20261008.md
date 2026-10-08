# Izbor vlasnika, 8. oktobar 2026 (tabla „Izbor izgleda“)

**Izvor.** Vlasnikova privatna tabla https://claude.ai/artifact/CatJJkCwwvCW2wCmcihkNc, zbirka `izbori`, pročitana 8. 10. u 08:59 (26 zapisa: 6 pitanja i 20 ekrana). Svaki zapis je vlasnikov dodir na tabli. Napomene su prepisane doslovno (piše glasom, pa su reči iskvarene); ispod je **moje čitanje**, označeno kao čitanje. Slike svih varijanti su na tabli; kod varijanti je na grani `explore/varijante-20261008` (glava bcc9e87d), pravac u `KREATIVNI_PRAVAC_20261008.md`.

## 1. Pitanja

| Pitanje | Odgovor | Šta to znači |
|---|---|---|
| Znak kao prizor u „Dogovoreno!“ | **DA** | Dozvola. Ali za sam ekran „Dogovoreno!“ vlasnik je kasnije (06:50) izabrao **C, dva lica**, pa se znak tamo ne koristi (konkretan i kasniji izbor važi). Znak ostaje na ulazu i vrhu Početne. |
| Natpis dugmeta na tuđem zadatku | „Uskoči na zadatak“ (06:05) | **Zamenjeno** kasnijom napomenom na „Detalj zadatka“ (06:48): „Pošalji ponudu“, a kad je cena fiksna „Pošalji prijavu“. Vlasniku je rečeno da je uzeta kasnija napomena. |
| Novi crteži | **Prvo samo zvezda** | Zvezdu kao 2.5D sliku ovde nema ko da nacrta (u ovom okruženju nema generatora slika po receptu iz `PROVENANCE.json`); do tada važi postojeća vektorska zvezda-nalepnica (vidi Ocena A). PNG zvezda: vlasnikov alat ili Codex. |
| Mali odskok u trenucima | **NE** | Sve sleže bez preskoka (MOTION D3 zatvoreno). |
| 2.5D na dugmadima, filterima i donjoj traci | **NE** | Kontrole ostaju obične ikonice; 2.5D samo na informacijama, stanjima i trenucima. |
| Plavi crteži | **SMARAGD** | **Urađeno u istom komitu kao ovaj zapis:** pin, osobe, poruke, slušalice i ekran laptopa prebojeni (samo boja, isti crteži; postupak i otisci u `assets/illustrations/PROVENANCE.json` → `emeraldRecolor20261008`), uloga `sys.color.artRole.location` `#3979C4` → `#0F8C61` (prebojeni pin), pa i mali vektorski pinovi, mape i „na daljinu“ prate. Boja asistenta (`artRole.ai`) ostaje plava; dva mesta u glasovnom unosu koja su pozajmljivala plavu od „mesta“ sada uzimaju boju asistenta, pa se tu ništa ne vidi drugačije. |

## 2. Ekrani (20)

| Ekran | Izbor | Napomena vlasnika (doslovno) | Moje čitanje | Varijanta (izvor) |
|---|---|---|---|---|
| Početna | **B** „Danas u 14“ | — | Krupno vreme sledećeg Dogovora odmah ispod vrata, „Čeka te“ ispod; vrata i potpis zaključani. | `src/ui/varijante/V1/PocetnaB.tsx` |
| Moji zadaci | **A** „Papir na stolu“ | — | Grupe po fazi (Čeka tvoj izbor, Objavljeno, …); prazno = krupan papir sa pinom i olovkom. | `V1/MojiZadaciA.tsx`, `OwnTaskCardVarA.tsx` |
| Prazni ekrani (porodica) | **A** „Predmet vrata“ | — | Prvi susret: predmet 144 na sredini, isti kao vrata koja vode dalje (rima), naslov, rečenica, jedno zeleno dugme; filtrirano/greška ostaju 96. | `V1/StateViewVarA.tsx`, `Stanja.tsx` |
| Kartica zadatka | **A** „Etiketa“ + napomena | „Ali nemincenud esni nefo neka budzet(rako greba da se zove) ili grazim ponude bude islod nalsova sa lelom ikinicom kao i sge sktslo“ | „Ali ne cena desno, nego neka budžet (tako treba da se zove) ili ‚Tražim ponude‘ bude ispod naslova sa ikonicom levo, kao i sve ostalo.“ | `V2/KarticaA.tsx` |
| Kartica na mapi | **A** + napomena | „Isto cena d abude islod nalsova s akinocim tj ne cena nego budzet ali neka potrebe da stoji cenanik ibuxet znaju ljuei samo sta je to“ | „Isto: iznos ispod naslova sa ikonicom, tj. ne ‚cena‘ nego budžet; ali nema potrebe da piše ‚cena‘ ni ‚budžet‘, ljudi sami znaju šta je to.“ | `V2/KarticaA.tsx` (peek) |
| Detalj zadatka | **A** „Objavio u okviru“ + napomena | „Ali nekij na dnu doekd a stojicenai i vrne nego sam poslaji ponudu a ako je fiska cena inda neka bude posalji prijavu“ | „Ali neka na dnu (uz dugme) ne stoje cena i vreme, nego samo ‚Pošalji ponudu‘, a ako je fiksna cena, onda neka bude ‚Pošalji prijavu‘.“ | `V2/DetaljA.tsx` |
| Pretraga | **A** „Gradovi brojem“ | — | Broj zadataka vodi red grada, bez ponovljenog pina. | `V2/PretragaA.tsx` |
| Izbor prijave | **A** „Ponude preko stola“ | — | Isti oblik svake ponude: lice, ime, cena desno, termin, „Ima“. | `V3/KandidatiA.tsx` |
| „Dogovoreno!“ | **C** „Susret dva lica“ + napomena | „Samo neka isod avatra bd ei amslv zadatks“ | „Samo neka ispod avatara bude i naslov zadatka.“ | `V3/DogovorenoC.tsx` |
| Razgovor sa asistentom | **A** „Asistent i sto“ | — | Asistent 128, „Reci šta ti treba.“, tri primera kao redovi. | `V3/RazgovorA.tsx` |
| Nacrt zadatka | **A** „Sličice slete u nacrt“ | — | Kad asistent razume činjenicu, njena sličica sleti u nacrt; nepoznato ostaje tiho. | `V3/RazgovorA.tsx` (`RazgovorA_Nacrt`) |
| „Objavljeno“ | **A** „Papir i pečat“ | — | Papir sa pinom i olovkom 144, pilula „Objavljen“ padne uz naslov. | `V3/RazgovorA.tsx` (`RazgovorA_Objavljeno`) |
| „Prijava je poslata“ | **C** „Etiketa odlazi“ | — | Tvoja etiketa sa iznosom uskoči nagore „ka drugoj strani“, ostaje red „Poslata · iznos“, priznanica ispod. | `V3/PrijavaC.tsx` |
| Dogovori (lista) | **Ostaje kako je** | — | Bez promene (osim praznog stanja iz porodice). | — |
| Dogovor (detalj) | **Ostaje kako je** | — | Bez promene. | — |
| „Potvrđeno“ | **Ostaje kako je** | — | Bez promene. | — |
| Ocena saradnje | **A** „Zvezde kao nalepnice“ | — | Lice na sredini, pet zvezda-nalepnica 48. | `V4/OcenaA.tsx` |
| „Ocena je sačuvana“ | **A** „Pilula pada, sjaj“ | — | Pilula „Ocenjeno“ padne na ugao zvezda, jedan sjaj preko punih. | `V4/OcenaA.tsx` / `ocenaShared.tsx` |
| Moj profil | **A** „Lice i tri broja“ | — | Lice 96 centrirano, ime, tri broja u redu (ocena, završeno, dolazi kako je dogovoreno). | `V4/ProfilA.tsx` |
| Javni profil | **A** „Lice i tri broja“ | — | Isti oblik kao moj profil, pa potvrde sa sličicama. | `V4/ProfilA.tsx` (`JavniA`) |

## 3. Pravila za prenos u aplikaciju (talas posle izbora)

1. **Prenosi se izgled izabrane varijante, ne njeni lažni podaci.** Varijante su crtane na izmišljenim podacima. U aplikaciji svaki broj, ime, termin i razlog dolazi iz stvarnog polja; čega nema, ne crta se. Primeri: red razloga „Blizu · oko 1 km“ samo ako udaljenost stvarno postoji u podacima; „dolazi kako je dogovoreno 9 od 10“ samo iz `rpc_public_work_trust_v1` i samo kad prekidač javne pouzdanosti to dozvoljava; inače se izostavlja.
2. **Iznos na kartici i kartici na mapi:** red ispod naslova sa 2.5D sličicom levo (novac), kao mesto i vreme; **bez reči „cena“ ili „budžet“ na ekranu**; čitaču ekrana se kaže „Budžet 6.000 RSD ukupno“. Kad iznosa nema: sličica etikete i „Tražim ponude“. Nepoznat iznos nikad ne liči na broj (AGENTS 3.6.2).
3. **Detalj zadatka, dno:** samo zeleno dugme preko cele širine (bez iznosa i vremena levo). Natpis: „Pošalji ponudu“ kad zadatak nema fiksnu cenu, „Pošalji prijavu“ kad je ima. Dugme i dalje otvara formu prijave (ne šalje odmah). U istom koraku se menjaju testovi i automatske provere koje traže stari natpis „Sastavi prijavu“: `src/data/__tests__/pkg011-slice3-presentation.test.tsx`, `task-detail-screen.test.tsx`, `task-detail-round3.test.tsx`, `scripts/p6_native_journey.py`, `scripts/task_detail_android_journey.py`, `scripts/ru5_android_device_ui_journey.py`, `scripts/test_task_detail_android.py`, `.maestro/send-offer.yaml` (natpis zavisi od vrste cene u njihovom zadatku).
4. **„Dogovoreno!“ = C:** dva lica (ti i izabrana osoba) dođu jedno ka drugom i stanu; ispod lica **naslov zadatka**, pa „Dogovoreno!“, pa tri reda (vas dvoje, termin, iznos), jedno zeleno „Otvori Dogovor“; tik uspeha kad se lica dodirnu; bez odskoka; smanjen pokret = završni kadar odmah.
5. Ekrani „Ostaje kako je“ se ne diraju (Dogovori lista, Dogovor detalj, „Potvrđeno“), osim praznog stanja Dogovora, koje dobija porodicu praznih stanja (A).
6. Kontrole (dugmad, filteri, donja traka) ostaju obične ikonice; 2.5D samo na informacijama, stanjima i trenucima.
7. Pokret: bez odskoka; činjenice (iznos, vreme, broj, reč stanja) se nikad ne animiraju; svaki pokret ima varijantu za smanjen pokret; samo `transform`/`opacity`, bez beskonačnih petlji van fokusa (B22).
8. Sve ostalo iz AGENTS.md 3.5–3.6 važi (bele površine, jedna zelena radnja, tekst ≥ 12, „ti“ bez roda, „zadatak“, bez nove zavisnosti, ulaz V4.9 i potpis Početne zaključani).
