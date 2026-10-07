# USKOČI — kompozicija i ritam (dizajn-vođa, 7.10.2026)

Samo čitanje + ovaj dokument; kod, server, DEV, telefon i emulator nisu dirani. Predlog je za agente koji sprovode ekrane, ne novo odobrenje; pravila AGENTS.md 3.5–3.6 važe (ulaz V4.9 zaključan, bez nove zavisnosti). Podela rada: tokovi i šta se dodaje su u `POTREBE_KORISNIKA_20261007.md` (R-id), reči u `TEKSTOVI_REVIZIJA_20261007.md` + `TEKSTOVI_PREDLOZI_20261007.json` (po `screen`/`category`); ovde su samo mesto, razmak i oblik, pa se na njih zovem po id-u. **Snimci:** `scratchpad/emu/phone2` (telefon, 23 h: p02 Početna, p03 Zadaci, p04 Dogovori, p05 Poruke, p07 Moji zadaci, p09–p11 Profil, p16 Izvoz, p18 Pravila, p32 O aplikaciji, p33 Privatnost, p40 Obaveštenja, p41 Raspored, p52 Nacrt, p53 Pregled) i `emu/pre` (ujutru). Snimak je 420 px = 361 dp, 1 dp = 1,163 px; razmaci sa snimaka su ±1 dp (bela traka između redova teksta), mere iz koda su tačne. Putanje su `fajl:red` u `src/ui` (osim `app/…`).

**Zaključak.** Utisak „izdeljeno, isprekidano, bez reda“ nema jedan ekran kao uzrok, nego sistem bez mreže. Ivica ekrana ima četiri vrednosti (16/20/22/24 dp), razmak između blokova sedam (12/14/16/20/24/28/32), razdelnik 104 mesta u dve debljine (1 dp = 3,5 px na telefonu, `hairlineWidth` = 1 px), kontejner šest vrsta, a svaki ekran ima svoju varijantu istog reda, naslova odeljka i podnožja. Uveče je dodato više komada (filteri, pilule, čipovi, odeljci), nijedan iz zajedničkog kalupa. Lek je jedan ritam, ne drugi izgled: lestvica 4/8/12/16/24/32/48, ivica 20, odeljke razdvaja razmak, redove inset linija, kartica samo za zapis koji se dodiruje, i šest primitiva koji to nose.

## 1. Dijagnoza

| # | Uzrok | Gde | Mera |
|---|---|---|---|
| U1 | Ivica ekrana nije jedna | 20: `home/HomePresentation.tsx:328`, `notifications/InboxPresentation.tsx:285`, `system/ScreenChrome.tsx:29`. 24: `settings/SettingsPresentation.tsx:202`, `v2/NeedPresentation.tsx:260`, `v2/PublicNeedPresentation.tsx:148`. 22: `auth/AccountClosingState.tsx:150`. 16: `v2/AgreementThreadPresentation.tsx:101`, `v2/discovery/DiscoverySearchBar.tsx` | Tekst skače 4 dp pri prelazu Nacrt→Pregled (24→20, p52→p53) i Pregled→Poruke (20→16). Na istom ekranu sadržaj 24, dugme 20 (`NeedPresentation.tsx:292`, `PublicNeedPresentation.tsx:155`) |
| U2 | Razmak između blokova nema pravila | Početna 20 (`HomePresentation.tsx:340`), Settings 28 (`SettingsPresentation.tsx:202`), Nacrt/Detalj/Pregled 24, Dogovor 16 + unutrašnjih 4–18 (`app/dogovor/[id].tsx:607`), Kandidati 14 i 20 (`v2/ApplicationSelectionPresentation.tsx:402,423`), Prijava 20 (`v2/ApplicationComposerPresentation.tsx:481`), Raspored 24/32 | Bela traka između blokova, Početna (p02): 45,6·34,4·42,1·20,6·20,6·59,3 dp; Raspored (p41): 32,7·39,5·29,2·34,4·49·202 dp. Popis: 238 od 740 brojčanih razmaka (32 %) van lestvice (2×57, 10×46, 14×42, 6×37, 28×8); tokeni 906 puta |
| U3 | Linije kao lepak, u dve debljine | 104 definicije u 50 fajlova: 81 × 1 dp, 23 × `hairlineWidth`. Mešaju ih `HomePresentation.tsx:347/372`, `v2/AgreementPresentation.tsx:217/232/238/250`; inbox: `messages/ConversationInboxPresentation.tsx:182` (hairline) naspram `InboxPresentation.tsx:296` (1 dp); Profil `profile/ProfileHubPresentation.tsx:176` naspram `SettingsPresentation.tsx:217`. Najviše: Kandidati 6, Prijava 6, `AgreementPresentation` 5, Settings 5 | Dogovor detalj: 9 blokova, svaki sa svojom gornjom linijom; iznad nje 16 dp, ispod 0–18 |
| U4 | Šest vrsta kontejnera + isprekidana ivica | `raisedItem` (`system/tokens.ts:303`), `card`/`cardCompact` (:297-299, ivica cardLine), `floating` (:309), vrata Početne wash+senka (`HomePresentation.tsx:332`), `inset` (`tokens.ts:334`), grupa sa hairline ivicom (`NeedPresentation.tsx:283`), isprekidana (`calendar/AgendaRow.tsx:106`) | Isti „zapis“ ima tri izgleda: zadatak/Dogovor (senka), termin u Rasporedu i na Početnoj (ivica cardLine), profil (samo senka) |
| U5 | Redovi liste nemaju jednu mrežu | Tekst počinje 0/44/46/48/52/56/68 dp od ivice (`system/Disclosure.tsx:14`, `ProfileHubPresentation.tsx:178`, `HomePresentation.tsx:350`, `InboxPresentation.tsx:300`, `ConversationInboxPresentation.tsx:183`); min. visine 56/60/64/72; padding 12/14/16 | Profil (p10): tekst skače sa x=84 na x=28 px u jednom skrolu |
| U6 | Zapisi su visoki i gusti | `v2/OwnTaskCard.tsx:103-108` (razmak 16, tri činjenice sa 3D 28), `agreements/AgreementListCard.tsx:137-158` (5 kombinacija veličine/težine), `v2/TaskFace.tsx:389-466` (6 veličina), `ConversationInboxPresentation.tsx:181`, `InboxPresentation.tsx:295` | Kartica zadatka 304 dp (p07), Dogovor 174 dp (p04), red Poruka 132 dp (p05), Obaveštenja 125 dp (p40), sve pri 1,15; po ekranu 2–5 stavki |
| U7 | Kontrole se odsecaju | `Segmented contentSized scroll`: `v2/AgreementCollectionPresentation.tsx:141`, `calendar/AgendaScreen.tsx:199`, `calendar/ArchiveScreen.tsx:75`, `v2/MyApplicationsPresentation.tsx:140` | „Istorija 7“ (p04) i „Moje pr…“ (p41) odsečeni pri 1,15 |
| U8 | Prazno tamo gde ne treba | `AgendaScreen.tsx:52,254` (prazan dan 192 dp), `HomePresentation.tsx:367` (usamljen link 48 dp), `v2/MarketplacePresentation.tsx:238-251` (traka + tabovi + alatna = 172 dp pre sadržaja) | Raspored (p41): 202 dp bele pre „Bez tačnog termina“; Početna (p02): 59,3 dp posle linka |
| U9 | Zaglavlja i naslovi se menjaju | Traka korena: znak (`app/(app)/index.tsx:67`, `dogovori.tsx:97`), reč „Poruke“ (`poruke.tsx:55`), pilula (Zadaci). Zaglavlja (`accessibilityRole=header`): `heading` 28×, `bodyStrong` 27×, `title` 21×; naslov odeljka ručno: `copy`/600 (`NeedPresentation.tsx:277`), `meta`/700 (`SettingsPresentation.tsx:214`), `meta`/600 (`InboxPresentation.tsx:293`). Ime stvari: 28 (`v2/detail/TaskDecision.tsx:135`), 30 (`auth/AuthPresentation.tsx:35`, `v2/ApplicationComposerPresentation.tsx:514`), 20 (`profile/ProfileHubPresentation.tsx:172`, `v2/AgreementPresentation.tsx:126`) | Ista uloga, različit stil; 14 zaglavlja bez varijante tokena |
| U10 | Podnožje se pomera | Gore/dole 12/8 (`NeedPresentation.tsx:292`), 12/14 (`PublicNeedPresentation.tsx:155`), 12/12 (`AgreementWorkspace.tsx:224`, `system/FlowFooter.tsx:23`), 20/20 (`objava/ReviewPresentation.tsx:242`), strane 24 (`SettingsPresentation.tsx:203`) | Zeleno dugme skače 2–8 dp između Nacrta i Pregleda |

**Ujutru → uveče (dodato):** Raspored: filter od 4 (odsečen), blok dana 192 dp, odeljak sa karticama. Dogovori: pilula „Raspored“ (tabovi odsečeni), grupno zaglavlje, čip. Obaveštenja: red „kuda vodi“ ispod svakog. Poruke: bez zaglavlja dana, lice 40→56. Početna: vrata ~136→88 dp + odeljak „Raspored“ + usamljen link.

## 2. Šabloni ekrana

**A — Lestvica.** 4 · 8 · 12 · 16 · 24 · 32 · 48 (`sys.space` xs…huge; `lg` = 20 više nije razmak nego ivica `sys.layout.gutter`). Ništa drugo (6, 10, 14, 18, 22, 28 idu na najbližu). Razmak raste sa daljinom odnosa: red u bloku 4–8 · blok u kartici 12 · naslov→sadržaj 12 · kartica↔kartica 12 · odeljak↔odeljak 24 · zona↔zona 32 · prvi sadržaj ispod trake 8 · dno skrola 32 (24 iznad podnožja).

**B — Grupisanje: jedno sredstvo po nivou** (razmak, kontejner ili razdelnik, kao u HIG Layout).
- Odeljke razdvajaju razmak i naslov; linija nikad između odeljaka.
- Redove iste vrste razdvaja inset linija: 1 dp, boja `line`, od teksta do desne ivice, poslednji red bez nje.
- Kartica (`record`) je zapis koji se dodiruje: zadatak, Dogovor, prijava, termin, kandidat. Senka znači „dodirni“. Što se samo čita je odeljak ili `panel` (ivica, bez senke). Nikad kartica u kartici, oko liste redova ili oko jednog reda; nikad isprekidana ivica; rečenica koju treba istaći je `note`, ne kartica.
- Jedine pune linije: iznad podnožja i na granici dve dodirne zone u zapisu („noga“).

**C — Leva ivica.** Jedna (20 dp). Unutra tri uvlake: Fact = art 24 + 12 = 36, Row = slot 40 + 12 = 52, Osoba = slot 56 + 12 = 68 (samo spiskovi ljudi i razgovora); jedna po ekranu, ne mešaju se (ekran sa slikom u redovima ima je u svim redovima ili ni u jednom). Lica: 32 (u kartici), 40 (red), 56 (osoba je glavna stvar), 96 (profil). Art: 24 činjenica, 32 red, 96 prazno stanje.

**D — Uloge teksta** (samo postojeći tokeni `sys.type`; najviše 5 stilova po ekranu).

| Uloga | Token | Uloga | Token |
|---|---|---|---|
| naslov u traci | `title` 21/26 | rečenica pod naslovom | `copy` 15/22 muted |
| ime stvari (detalj) | `pageTitle` 28/33 (ne `hero` 30) | sporedno, činjenica u kartici | `note` 14/20 |
| naslov odeljka i kartice u listi | `heading` 18/24 | pečat, zona | `meta` 13/18 |
| grupa u listi (Danas, dani) | `bodyStrong` 16/24 | čip | `label` 12/16 |
| red (veza / tekst) | `bodyStrong` / `body` 16/24 | iznos | `priceRow` 16/700 u kartici i redu, `priceLarge` 24/30 u detalju |

Zabranjeno: literali 17, 19, 22 (osim naslova vrata Početne), 26, 34; iznos 14/700; naslov odeljka 15/600 ili 13/700.

**E — Gustina i bezbedne zone.** Širina 361 dp, sadržaj 321; između statusne i tab trake je ≈ 660 dp. Pri 1,15: traka 64 + 8 + kontrolni red 56 + 12 = 140, ostaje ≈ 520 dp: zapis ≤ 200 dp (≥ 2,5 na ekranu), red ≤ 96 dp (≥ 5). Pri ≥ 1,3 (`useLayoutClass().stacked`): sve u kolonu, naslovi bez elipse, segment u 2 reda; jedino `chips` skroluje bočno. Dno: tab traka `max(12, inset)`, plutajuće „Mapa“ 16 iznad nje. Dodir ≥ 48 dp, susedne kontrole 8 dp (HIG: ≈ 12 oko kontrola sa okvirom). Priznati izuzeci ivice: preko mape 16 (`sys.layout.mapInset`), lista poruka 16 i composer 12 u razgovoru.

**F — Radnja.** Jedna zelena po ekranu, u `FlowFooter`; sve ostalo beli ili zeleni tekst; „retko“ u „···“; neaktivno je siva podloga sa razlogom iznad, nikad providno.

**T1 Koren (Početna, Dogovori, Poruke; Zadaci je mapa sa istom ivicom).** Traka root 64 (znak · ≤ 1 kontrola · zvonce · lice; ime ekrana se ne crta) → 8 → jedan kontrolni red (Segmented jednake širine, 56, ili `chips`, 48) → 12 → sadržaj: `Section`i (24) ILI lista zapisa (12) ILI lista redova (inset linije) → dno 32. Bez podnožja.

**T2 Lista (Moji zadaci, Moje prijave, Arhiva, Podrška, Blokirani).** Traka detalj (strelica + naslov 21) → 8 → jedan kontrolni red → `note` „7 zadataka“ (20) + 8 → stavke → grupna zaglavlja `bodyStrong` 24 gore / 12 dole → „Prikaži još“ tiho 48. Zapisi i redovi se ne mešaju u listi.

**T3 Detalj (zadatak, Dogovor, osoba).** Traka detalj (strelica + „···“; naslov u traci tek posle skrola) → 8 → čip stanja → 8 → ime stvari 28 → 8 → rečenica `copy` → 16 → sažetak (3–4 `FactRow`/`KeyValueRow`) → 24 → `Section`i (24, bez linija) → dno 24 + `FlowFooter` sa jednom zelenom radnjom ili jednom sivom rečenicom stanja (nikad prazna traka).

**T4 Tok/forma (AI razgovor, pregled, prijava, izmene, ocena, zatvaranje naloga).** Traka tok (× · naslov · „Korak 2 od 4“) → 16 → polja 52 (labela 8 iznad, greška 4 ispod; polja 16 razmaka; odeljci 24) → `FlowFooter` (jedna zelena + ≤ 1 tiha; razlog `note` iznad); tastatura podiže podnožje; nema plutajućeg dugmeta.

**T5 Panel odozdo** (`ProductSheet`). Uglovi 28, rukohvat 36×4 samo kad se vuče, naslov 21 + ×, ivica 20, razmak sadržaja 16, `FlowFooter` unutra (12 + safe area), jedan panel odjednom, scrim 0,3. **T6 Dijalog:** centar, uglovi 24, padding 24, širina min(320, ekran−48); naslov `heading`, ≤ 2 rečenice `copy`; dugmad naslagana (zelena + tiha) razmak 8; scrim 0,35.

**T7 Stanja.** Učitavanje: skelet iste geometrije kao stvarni red (isti padding, razmak, visina), 3 stavke + jedna rečenica. Prazno/greška: centrirana kolona: art 96, `title` 21, `copy` muted ≤ 280 širine, ≤ 1 zelena + ≤ 1 tiha, na ≈ 1/3 visine. Bez veze (R31): `note` traka ispod trake, ne ekran.

## 3. Sistemski sastojci

**3.1 Postojeće što već nosi šablone**

| Komponenta | Nosi | Šta proširiti |
|---|---|---|
| `system/ScreenChrome` (+`ScreenHeader`, `DetailTopBar`, `ProductHeader`) | T1/T3/T4 trake | `chrome.paddingHorizontal` = `sys.layout.gutter`; Poruke root = znak (`poruke.tsx:55`); traka razgovora 16→20 |
| `system/FlowFooter` | podnožje toka | postaje jedino podnožje: `note` razlog iznad, ≤ 1 zelena + ≤ 1 tiha, 20/12/12 + safe area; zameni 6 ručnih (U10) |
| `system/StateView`, `Skeleton` | T7 | centrirano (art 96); skelet = geometrija stvarnog reda |
| `system/StatusChip` | stanje: oblik + reč | jedini nosilac stanja i u Rasporedu (umesto isprekidane ivice) i na zapisima |
| `system/Segmented` | izbor skupa | ukloni `contentSized`+`scroll` za ≤ 3 (jednake širine; 2 reda reči pri velikom tekstu); novi mod `chips` (≥ 4, jedini bočni skrol); broj samo za „čeka tebe“ |
| `ProductSheet`, `ConfirmSheet`, `ActionSheet`, `PeekSheet`, `Poruka`, `TabBarItem`, `Press`, `Appear`, `Glyph`, `FactArt`, `Avatar` | T5, T6, dodir, pokret, ikone | bez izmena API-ja; ivica 20 i `FlowFooter` u panelu; pravilo C |
| `v2/TaskCard`, `OwnTaskCard`, `AgreementListCard`, `AgendaRow`, `PrijavaCard`, `CandidateFace` | zapisi | svi na `Surface record` + `FactRow`; budžet visine (E) |
| `settings/SettingsPresentation` | redovi Profila i podekrana | tanak sloj nad `ListRow`/`Section`; 24→20 |
| mrtav kod | — | `system/Detail.tsx` (NextStrip, FactGrid, SectionTitle, DisclosureGroup, DetailPairs, QuietNote) i u `ProductDetails.tsx` DetailFact(s), DetailLink, ProductPerson, ProductRequirements, ProductTitle nemaju korisnika van testova: obrisati uz N3/N4 da niko ne ugradi „treću verziju“ |

**3.2 Šest novih primitiva (specifikacija, bez koda; novi fajlovi u `src/ui/system/`)**
- **N1 `Screen`**: `kind: 'root'|'detail'|'flow'`, `header`, `footer?`, `scroll?`. SafeArea; ivica = `gutter`; gore 8; dno 32 (24 sa podnožjem); deca razmaknuta 24; `maxWidth 640`; ne crta kartice. Zamenjuje ručne `content:{}` u 20+ ekrana.
- **N2 `Section`**: `title?`, `action?: {label, onPress}`. Naslov `heading` ink; trailing akcija 15/600 zeleno, 48 dp dodir, desno; naslov→sadržaj 12; bez linije i bez margina (razmak daje `Screen`); `accessibilityRole=header`. Zamenjuje: Home `Section`, `SettingsGroup` naslov, `DetailSection`, `TaskDecisionSection`, `ReviewSection`, `GroupHeader`, naslove u Rasporedu.
- **N3 `ListRow`**: `leading?` (art ili lice), `title`, `subtitle?`, `meta?`, `trailing?` (strelica ili čvor), `onPress?`, `tone?`, `last?`. Min. 64 (56 bez podnaslova i slike), padding 12, razmak 12, slot 40 (56 za lice 56); donja inset linija; skala 0,99; strelica samo uz `onPress` (info red nema strelicu ni press). Zamenjuje: `ProfileUtilityRow`, `SettingsRow`, `MineRow`, `AttentionRow`, `WorkspaceRow`, `OwnTaskLink`, `LinkRow`, `DetailLink`; `Disclosure` uzima istu metriku.
- **N4 `FactRow`**: `art`, `value`, `note?`, `size: 'card'|'detail'`. Art 24, razmak 12; `card`: `note` 14/20 boja `fact`; `detail`: `body` 16/24 ink; zalom, nikad elipsa. Zamenjuje: `CardFact`, `OwnTaskFact`, `AgreementFact`, `TaskDecisionLogistics`, `ProductFact`.
- **N5 `KeyValueRow`**: `label` (`meta` muted) levo, `value` (`body`, iznos `priceLarge`) desno, pri `stacked` ispod; opcioni „Izmeni“ 15/600 zeleno; padding 12, inset linija. Za „Uslove“, `ReviewFactRow`, statistiku profila.
- **N6 `Surface`**: `kind: 'record'|'panel'|'float'|'note'`. `record` = `raisedItem`, uglovi 24, padding 16, skala 0,986; `panel` = ivica 1 dp `cardLine`, bez senke; `float` = `floating` + ivica `line` (pilule, mapa, composer); `note` = `inset` (wash/warnSoft/dangerSoft). `__DEV__` upozorenje na ugnežđavanje; test: `raisedItem`, `card`, `cardCompact`, `floating`, `inset` se ne koriste van `Surface`.

**Menjaju se:** `system/tokens.ts` (`sys.layout` = gutter 20, mapInset 16, chat 16/12, section 24, group 12, card 16, zone 32; `sys.rule` = 1 dp `line`), `Segmented.tsx`, `FlowFooter.tsx`, `StateView.tsx`, `Skeleton.tsx`, `ScreenChrome.tsx`, pa po timu iz `TALASI_REDOSLED_20261007.md` (tamo piše „samo Edit na postojećim fajlovima“: šest novih fajlova traži izuzetak za tim S).

## 4. Ekran po ekran

**4.1 Početna · P0** · `home/HomePresentation.tsx`
- Danas (p02; `HomePresentation.tsx:321-383`): vrata 88 dp (wash + senka, razmak 16, :330-333), „Čeka te“, „Raspored“ sa karticom (ivica cardLine) ili sivom rečenicom + usamljen „Ceo raspored“ (:367), grupa redova sa linijom 1 dp gore (:372). Četiri vrste kontejnera; laboratorij sa terminom: isti obrazac (46·38·42·60 dp).
- Radi: vrata ostaju 88 dp, razmak među njima 12 · `Section` „Čeka te“ → `Section` „Raspored“ → „Moji zadaci / Moje prijave“ kao `ListRow` (bez naslova i gornje linije), sve 24 · „Ceo raspored“ je trailing akcija u zaglavlju „Raspored“ (nestaje red 48 dp + 59 dp praznine) · sledeći termin je isti `record` kao u Dogovorima, ne sopstvena kartica · „Ništa ne čeka tvoju odluku“ ostaje jedan sivi red 48 dp · novi redovi iz R02 („Dogovorite vreme“) i R18 („Nastavi nacrt“) su `ListRow` sa narandžastom tačkom u „Čeka te“, ne kartice.
- Mera: razmaci ∈ {12, 24}; ≤ 2 vrste kontejnera (zapis i red); nema usamljenog linka.

**4.2 Zadaci (mapa + lista) · P1** · `v2/DiscoveryPresentation.tsx`, `v2/discovery/*`, `v2/TaskCard.tsx`
- Danas (p03; `DiscoverySearchBar.tsx`, `DiscoveryChipRow.tsx`, `DiscoveryPresentation.tsx:1362`): nad mapom pilula 56 + 3 čipa 48 + zum + „U blizini“ + list sheet = pet različito senčenih belih objekata; ivica 16 preko mape, 20 u listi; kartica zadatka ≈ 285 dp (proračun), 6 veličina teksta i 3 reda 28-dp ikona (`v2/TaskFace.tsx:435-466`, `TaskCard.tsx:129-133`).
- Radi: sve nad mapom je `Surface float` (bela, ivica 1 dp, jedna senka), inset 16 · jedan gornji red = pilula pretrage (flex) + „Filteri“ 48 + zvonce 48 (R13); čipovi ispod tek kad ima primenjenih, „Svi zadaci / Za mene“ (R28) je prvi u redu (UX plan 2.19) · zum +/− sa telefona (štipanje), ostaje „U blizini“ **[odluka vlasnika]** · zaglavlje liste „N zadataka · Najnovije prvo“ 48 dp, ivica 20 · kartica `record`: [čip] → naslov 18/24 + iznos desno → „Tražim ponude · 0/1“ u istom redu → 2 `FactRow` (mesto · vreme) → osoba 40 + ocena.
- Mera: ≤ 3 plutajuća objekta u mirovanju; kartica ≤ 220 dp pri 1,15; ≤ 4 veličine teksta u kartici.

**4.3 Pretraga i filteri · P1** · `v2/discovery/DiscoverySearchPanel.tsx`, `SearchSection.tsx`, `SearchSheet.tsx`
- Danas i Radi (po UX planu 2.19; kod panela nisam otvarao, pa samo kompozicija): odeljci Gde/Kada/Šta/Cena/Ljudi/Način; zatvoren = `ListRow` 56 dp (naslov 16/600, izbor `note` muted + caret-down), inset linija između; otvoren: sadržaj 12 ispod, jedan odjednom; podnožje `FlowFooter` („Obriši sve“ tiho + zeleno „Prikaži N zadataka“), 2 reda pri ≥ 1,3; rukohvat 36×4, uglovi 28, ivica 20.
- Mera: 4 zatvorena odeljka + 1 otvoren bez skrola pri 1,15.

**4.4 Detalj zadatka · P0** · `v2/PublicNeedPresentation.tsx`, `v2/detail/TaskDecision.tsx`, `product/ProductDetails.tsx`
- Danas (kod, nema snimka): ivica 24, razmak 24 (`PublicNeedPresentation.tsx:148`), podnožje 20/12/14 (:155); „O zadatku“ i „Važno“ bez linije, ali „objavio“ (:152) i „Mesto“ (`ProductDetails.tsx:309`) sa linijom i padingom 20/24; činjenice 15/22 boja `fact` (`TaskDecision.tsx:160`).
- Radi (T3): čip stanja → naslov 28 → iznos `priceLarge` → 3 `FactRow` `detail` (mesto, vreme, ljudi) → `Section` „O zadatku“ → „Važno za ovaj zadatak“ → pitanja → „Objavio“ (`ListRow`, lice 56 kao glavna osoba, ime, ocena) → „Mesto“ (mapa 160 + napomena o privatnosti); sve 24, nijedna linija; `FlowFooter` sa jednom zelenom i razlogom iznad.
- Mera: 0 linija između odeljaka; ivica 20; podnožje na istoj visini kao u Nacrtu i Pregledu.

**4.5 Moji zadaci · P0** · `v2/MarketplacePresentation.tsx`, `v2/OwnTaskCard.tsx`
- Danas (p07; `MarketplacePresentation.tsx:238-251`, `OwnTaskCard.tsx:101-110`): traka 64 + tabovi 56 + alatna 52 = 172 dp pre sadržaja; kartica 304 dp: čip, naslov, „Tražim ponude“ i „0/1 popunjeno“ u dva reda, mesto, vreme (2 reda), rečenica; ikone 28, razmak 16.
- Radi: jedan kontrolni red = tabovi jednake širine; „7 zadataka“ je `note` zaglavlje liste; pretraga i „Filteri“ idu u traku (`right`, jedna kontrola) · kartica `record`: čip + naslov 18/24 → „Tražim ponude · 0/1“ jedan red → 2 `FactRow` → rečenica `note`; razmak u kartici 12; „noga“ samo kad čeka tvoju odluku.
- Mera: kartica ≤ 200 dp pri 1,15 (sa 304); ≥ 3 kartice vidljive; razmak između kartica 12.

**4.6 Nacrt i pregled pre objave · P0** · `v2/NeedPresentation.tsx`, `objava/ReviewPresentation.tsx`, `app/(app)/pregled-zadatka.tsx`, `nova.tsx`
- Danas (p52, p53): Nacrt ivica 24 / dugme 20 (`NeedPresentation.tsx:260,292`), Pregled ivica 20 (`ReviewPresentation.tsx:241`); u Pregledu kartica + usamljen „Izmeni naslov“ (:263), „Još treba“ redovi sa linijom (:267), sivo dugme sa rečenicom ispod; naslov u kartici odsečen („No…“; u izvoru ispravljeno, :44-61, snimak je stariji); naslov odeljka u Nacrtu 15/600 (`NeedPresentation.tsx:277`), u Pregledu 18/600.
- Radi: oba su T3/T4, ivica 20, isti `FlowFooter` · „Izmeni naslov“ postaje red u „Još treba“ ili `KeyValueRow` sa „Izmeni“ · „Još treba“ = `Section` + `ListRow` (narandžasta tačka ostaje jedini akcenat, strelica samo kad vodi) · „Mesto“ ostaje `Section` sa „Uredi mesto“ u zaglavlju (već tačno) · neaktivno dugme: siva podloga + razlog IZNAD · R16 (savet posle 24 h) = `Section` + `ListRow`ovi (Dodaj fotografiju, Proširi termin), ne kartica sa 4 dugmeta · AI razgovor (`v2/IntakePresentation.tsx:433+`): kartica nacrta je `panel`; primeri iz R18 su `ListRow`ovi, ne čipovi kategorija.
- Mera: leva ivica i dugme se ne pomeraju pri prelazu Nacrt→Pregled; jedan stil naslova odeljka.

**4.7 Prijave i izbor ljudi · P1** · `ApplicationComposerPresentation.tsx`, `ApplicationSelectionPresentation.tsx`, `MyApplicationsPresentation.tsx`, `CandidateFace.tsx`, `PrijavaCard.tsx` (svi `v2/`)
- Danas (kod): Prijava 6 linija (`ApplicationComposerPresentation.tsx:483,498,499,517,523,525`) + razmak 20; Kandidati: razmak kartica 20 (`ApplicationSelectionPresentation.tsx:423`), `band` i `offerTerms` sa linijom gore i dole (:432,:441); Moje prijave: lista gore 16 (`MyApplicationsPresentation.tsx:176`), drugde 4/12.
- Radi: Prijava = T4: zaglavlje zadatka (naslov 18 + 2 `FactRow`, bez linije) → `Section` „Tvoja ponuda“ (polje 72, iznos 28) → „Koliko vas dolazi“ (stepper 48) → „Termin“ (`ListRow`) → „Poruka“ (polje 96); razmak 24, linija 0 · Kandidati = T2: `record` (lice 56, ime, ocena `note`, iznos `priceRow`, poruka 2 reda), razmak 12, zeleno „Izaberi“ tek u otvorenoj ponudi (`Section`i 24 umesto `band`) · Moje prijave isti `record` i razmak 12.
- Mera: ≤ 1 linija po ekranu (podnožje); razmak kartica 12; lice 56 samo na glavnoj osobi.

**4.8 Dogovori, lista · P0** · `v2/AgreementCollectionPresentation.tsx`, `agreements/AgreementListCard.tsx`, `system/Segmented.tsx`
- Danas (p04; `AgreementCollectionPresentation.tsx:138-166`, `AgreementListCard.tsx:135-159`): tabovi `contentSized scroll` + pilula „Raspored“ → „Istorija 7“ odsečeno pri 1,15; `bodyStrong` grupno zaglavlje; kartica 174 dp, iznos 14/700 manji od naslova 16, uz njega „ukupno“ 13/500 (5 kombinacija veličine/težine).
- Radi: dve opcije jednake širine (`flex: 1`, bez skrola), broj samo uz „Aktivni“ kad nešto čeka · „Raspored“ = `ChromeIconButton` (kalendar, 48) u istom redu desno, reč u pristupačnoj oznaci · grupno zaglavlje `bodyStrong` 16, 24/12 (isto u Rasporedu i Obaveštenjima) · kartica: lice 40 + naslov 18/24 (2 reda) → `note` „ime · uloga“ → jedan red „kada · gde“ → čip levo + iznos `priceRow` 16/700 desno; narandžasta „noga“ ostaje jedini akcenat.
- Mera: 0 odsečenih kontrola pri 1,15 i 1,3; ≤ 4 stila u kartici (18/600, 14/500, 16/700, 12/600); kartica ≤ 160 dp.

**4.9 Dogovor, detalj · P0** · `app/dogovor/[id].tsx`, `agreements/AgreementWorkspace.tsx`, `v2/AgreementPresentation.tsx`, `agreements/AgreementContactPlace.tsx`
- Danas (kod, `[id].tsx:529-587`): 9 blokova (koraci, veza ka zadatku, sledeći korak, uslovi, ljudi, grupa, kontakt+mesto, 3 reda radnji, tok), svaki sa svojim vrhom: `AgreementWorkspace.tsx:210,217`, `AgreementPresentation.tsx:217,232,238,250`, `AgreementContactPlace.tsx:47`; razmak 16 (:607).
- Radi (T3): `AgreementSteps` → `Section` „Dogovoreno“ (tačka stanja + naslov + rečenica; topla `note` samo kad čeka tebe) → `Section` „Uslovi“ (`KeyValueRow`: Termin · Dogovoreno ukupno 24/30 · Ljudi · Obim) → „Kontakt i mesto“ → jedna grupa `ListRow`ova (Zadatak: naslov, Izmene i otkazivanje, Bezbednost, Tok Dogovora kao `Disclosure`); sve 24, bez gornjih linija; `FlowFooter` (jedna zelena ili jedna siva rečenica). Iz R01/R03 („Pozovi“, „Kopiraj“, „Zatraži adresu“) dolaze `ListRow`ovi u „Kontakt i mesto“; iz R02 („Dogovorite vreme“) ista `Section` „Dogovoreno“ + jedna zelena radnja u podnožju, ne nova kartica.
- Mera: linije između blokova 0; razmak 24; strelica nazad na istom mestu u Pregledu i Porukama.

**4.10 Raspored · P1** · `calendar/AgendaScreen.tsx`, `AgendaRow.tsx`
- Danas (p41; `AgendaScreen.tsx:52,199,254,258,261`, `AgendaRow.tsx:12,101-106`): filter od 4 `Segmented scroll` odseca „Moje pr…“; prazan dan 192 dp (202 dp bele); stavka dana = šina 56 + vertikalna linija + kartica + isprekidana kartica za prijavu; link-redovi sa gornjom linijom.
- Radi: filter = mod `chips` (ili nema reda kad postoji jedna vrsta) · ukloni `DAY_FLOOR`: prazan dan = jedan `note`, sledeći odeljak 24 ispod · stavka dana = `record`, vreme je prvi red unutra (`note`, tabular), bez šine i linije · prijava = `StatusChip` „Prijava poslata“ (prsten), ne isprekidana ivica · „Moja dostupnost“ i „Arhiva“ = `ListRow` odvojeni 32, bez gornje linije · „Danas“ u red nedelje.
- Mera: ≤ 1 kontrolni red nad danom; prazan dan ≤ 48 dp; 0 isprekidanih ivica.

**4.11 Poruke, lista · P1** · `messages/ConversationInboxPresentation.tsx`, `app/(app)/poruke.tsx`
- Danas (p05; `ConversationInboxPresentation.tsx:175-200`, `poruke.tsx:55`): traka sa rečju „Poruke“ (ostali koreni: znak); red 132 dp (lice 56, ime, zadatak, pregled do 2 reda, pečat); linija hairline.
- Radi: znak + zvonce + lice kao Početna/Dogovori (bez `showTitle`) · red = `ListRow`: ime 16/600 + pečat desno → `meta` naslov zadatka (1 red) → `note` pregled (1 red, 2 samo kad je nepročitano); nepročitano = zelena tačka kod pečata; inset linija; R17 (Aktivni / Završeni, brava) = jedan kontrolni red, brava uz `meta`.
- Mera: red ≤ 96 dp pri 1,15; ≥ 6 redova vidljivo.

**4.12 Poruke, razgovor · P1** · `v2/AgreementThreadPresentation.tsx`, `ui/AgreementChat.tsx`
- Danas (kod: `AgreementThreadPresentation.tsx:101,103,108`, `AgreementChat.tsx:643+`): traka 16, tabovi i „čeka te“ 20, lista 16, composer 12; kontekst sa linijom 1 dp.
- Radi: traka, tabovi i „čeka te“ na 20 (strelica ne skače pri prelazu Pregled/Poruke); lista 16 i composer 12 su jedini priznati izuzetak; prazno/greška T7; bez dodatnih linija.
- Mera: strelica nazad na istom x (≈ 22 dp) u oba taba.

**4.13 Obaveštenja · P1** · `notifications/InboxPresentation.tsx`
- Danas (p40; `InboxPresentation.tsx:284-308`): podvučeni tabovi + red „N nepročitanih · Označi sve“ (48), dan `meta` 13/600, slot 44, naslov 16, telo 14 (2 reda), `meta` „18:19 · Otvara…“, linija do ivice 1 dp; 125 dp po redu.
- Radi: dan = grupno zaglavlje `bodyStrong` 16 (24/8); „Označi sve“ = trailing akcija u zaglavlju prvog dana · red = `ListRow` (slot 40, art 32), naslov + jedan red tela, meta („vreme · kuda vodi“) 13; inset linija.
- Mera: red ≤ 96 dp pri 1,15; jedan stil zaglavlja grupe.

**4.14 Profil · P0** · `profile/ProfileHubPresentation.tsx`, `settings/SettingsPresentation.tsx`
- Danas (p09–p11; `ProfileHubPresentation.tsx:156-182`, `SettingsPresentation.tsx:200-217`): ivica 24; identitet = plutajuća kartica (lice 96) + red „Završeni Dogovori“ + dve kolone; tri grupe sa naslovom `meta` 13/700; redovi sa slotom 56 („Radni profil“), 36 (ostali) i bez slota („Privatnost“) → tekst na 68/48/0 dp; razmak grupa 28; razdelnik hairline (Profil) i 1 dp (ostali Settings).
- Radi: ivica 20 · identitet bez kartice: lice 80 levo, ime 28/33, grad `note`, ocena u istom redu · „Kako mogu da uskočim“, „Nalog i pomoć“, „Privatnost“ = `Section` (`heading`) · svi redovi `ListRow` slot 40/art 32 (i „Privatnost“: ista slika u mirnoj varijanti `tone="quiet"`), jedna ivica teksta (52), inset 1 dp · „Završeni Dogovori“ = `Section` + 2 `KeyValueRow` („Kad ti radiš“, „Kad ti objavljuješ“) · „Odjavi se“ = `ListRow` crvenog teksta · verzija 13 muted · iz R30: „Moja statistika“ = `KeyValueRow`ovi, „Primljene ocene“ = `ListRow`.
- Mera: ivica teksta jedna u celom skrolu; razmak 24; 0 `hairlineWidth` u Profilu.

**4.15 Podekrani Profila · P1** · `settings/*`, `privacy/*`, `legal/*`, `support/*`, `notifications/PushPreferences.tsx`
- Danas (p16 Izvoz, p18 Pravila, p32 O aplikaciji, p33 Privatnost): Izvoz = kartica (cardLine) + čip + šina + usamljen „Osveži stanje“; Pravila = prazno stanje levo (art 80 + naslov 21) na belom ekranu; O aplikaciji = redovi sa slikom pa redovi bez nje (isti skok ivice); Privatnost = informativni redovi liče na veze (slika + naslov 16/600); „Rokovi čuvanja“ na drugoj ivici (x 33 naspram 28 px).
- Radi: info = `Section` + pasus (bez slike i strelice), veza = `ListRow` sa strelicom · Izvoz bez kartice (šina je sadržaj odeljka; „Osveži stanje“ u zaglavlju odeljka; status `note`; dugme u `FlowFooter`) · Pravila = T7, art 96 · O aplikaciji: znak centriran + `Section` sa 2 `FactRow` + `ListRow`ovi sa istom slikom · PushPreferences razmak 20→24.
- Mera: svaki red sa strelicom vodi dalje; info red nema strelicu ni sliku.

**4.16 Prijava / Registracija · P2** · `app/auth.tsx`, `auth/*` (ulaz V4.9 zaključan, ne dira se)
- Danas (`auth/AuthPresentation.tsx:19-44`, `AccountClosingState.tsx:150`): sopstvena tema, ivica 22, vrednosti 5/9/17/20 van lestvice, naslov `hero` 30. Radi (bez dodira kompozicije ulaza): ivica 20, razmaci na lestvicu (17→16, 9→8, 5→4), jedan naslov `pageTitle`, polje 52, jedno zeleno dugme u `FlowFooter`, jedna strelica nazad.
- Mera: 0 vrednosti van lestvice u `auth/*`.

## 5. Svetski uzori (pročitano; HIG preko `developer.apple.com/tutorials/data/design/human-interface-guidelines/<strana>.json`, jer HTML vraća samo naslov)

| Obrazac | Izvor | Na USKOČI |
|---|---|---|
| Važnije gore i na početku reda; poravnanje i uvlačenje nose odnose; grupisanje prostorom, kontejnerom ili razdelnikom; postepeno otkrivanje | HIG `layout` | B i C: jedno sredstvo po nivou, jedna leva ivica; „···“ i `Disclosure` |
| Hijerarhija težinom/veličinom/bojom; tekst se prilagođava svim veličinama, manje skraćivanja, naslagati u uskom; 11 stilova | HIG `typography` | D (≤ 5 stilova) i E |
| Kratki redovi; grupisan stil = zaglavlja + razmak; strelica samo za dublji nivo | HIG `lists-and-tables` | `ListRow` + `Section`; strelica samo uz `onPress` |
| Segmenti ≤ 5 na iPhone-u, jednake širine, tekst ILI slika; tab traka samo odredišta, bez radnji, značke za kritično | HIG `segmented-controls`, `tab-bars` | Segmented jednake širine, ≥ 4 = `chips`; 4 taba, značka samo „čeka te“ |
| Traka: kratki naslovi, standardno Nazad, ≤ 3 grupe; jedno istaknuto dugme po prikazu, 44×44 | HIG `toolbars`, `buttons` | strelica + ≤ 1 kontrola, „retko“ u „···“; jedna zelena, 48 dp |
| Panel: ograničen zadatak, rukohvat, jedan odjednom, ne za duge tokove | HIG `sheets` | T5; tok = ceo ekran |
| 44×44; razmak ≈ 12 pt oko kontrola sa okvirom; tekst do 200 % | HIG `accessibility` | razmak 8–12; provera pri 1,3 |
| Pokret i haptika sa svrhom, kratko, prekidivo; staklo za kontrole, ne za sadržaj | HIG `motion`, `playing-haptics`, `materials` | ritam pokreta prati ritam razmaka; bez zamućenja u sadržaju |
| Lista kartica + mapa sa pinovima; većina klikne samo nekoliko pinova | Airbnb Tech: `airbnb.tech/ai-ml/improving-search-ranking-for-maps/` | Zadaci: ≤ 3 plutajuća objekta; kartica je jedini oblik rezultata |
| Poruke: Priority/Recent/Past + brzi filteri + pretraga | Airbnb Help: `airbnb.com/help/article/3558` | Poruke: 1 red filtera, „Čeka te“ gore (plan 2.8) |
| Trips = itinerar (raspored, dom, usluge) u jednom tabu | Airbnb: `news.airbnb.com/product-releases/airbnb-2025-summer-release` | Raspored = jedno mesto za sve moje (plan 2.7) |
| Ukupna ocena je zasebna, vidi se tek posle 3 ocene | Airbnb Help: `airbnb.com/help/article/1257` | Profil: ocena jednom (zvezda + broj + N) |
| 11 kartica konfiguriše 16 ekrana; jedan raspored po kartici; spacer fiksne visine | Uber: `uber.com/in/en/blog/developing-the-actioncard-design-pattern/` | N1–N6; razmak samo preko `Screen`/`Section` |
| Status po fazama, ne sve odjednom; Activity Hub = prošlo + predstojeće | Uber: `uber.com/us/en/newsroom/seamless-pickups/`, `…/were-redesigning-the-uber-app-just-for-you/` | Dogovor: jedan sledeći korak + koraci; Dogovori + Raspored |
| Skala 4/8/16/24/32/48 (native), „vizuelni ritam“; slojevi tokeni→atomi→komponente | Thumbprint: `thumbprint.design/guidelines/spacers`; `figma.com/blog/how-thumbtack-structures-their-design-system/` | lestvica A; test koji čuva lestvicu |
| Poređenje po ceni, veštinama, recenzijama + sažetak pre potvrde (TaskRabbit); ponude: profil, ocena, stopa završetka (Airtasker) | `support.taskrabbit.com/hc/en-us/articles/46260422073755-How-Do-I-Hire-a-Tasker`, `taskrabbit.com/how-it-works`, `airtasker.com/us/how-it-works/sign-up/` | kandidat `record` ≤ 4 reda: lice, ocena, iznos, 1 rečenica; potvrda sa sažetkom |
| Razdelnik: pun za velike odeljke, uvučen za srodne stavke, 1 dp; kartica oko jedne teme, 16 dp padding | Material Components Android: `docs/components/Divider.md`, `Card.md` (GitHub, grana master) | B: odstupamo od punog razdelnika među odeljcima (vlasnik: „isprekidano“); inset u listi, `record` padding 16 |

**Nedostupno (nije dokaz):** Airbnb Ghost Platform članak (`medium.com/airbnb-engineering/…842244c5f5`, 403; samo isečak pretrage o „sections/screens“), `airbnb.design` (preusmerenje na 404), `support.airtasker.com` (403), `help.thumbtack.com` (prazan naslov), `blog.thumbtack.com` (403), `base.uber.com` Dimensions/Divider (prazan naslov), `m3.material.io` spacing (prazan naslov), Airbnb Help 363 (bez naziva statusa).

## 6. Prvih 10 poteza (po uticaju na „uređeno i jedinstveno“)

| # | Potez | Veličina | Vlasnik fajlova |
|---|---|---|---|
| 1 | Jedna ivica i lestvica: `sys.layout` + `sys.rule` u `tokens.ts`; 24→20 (Settings, Nacrt, Detalj), 22→20 (auth), traka razgovora 16→20; razmaci van lestvice u fajlovima koje tim već menja; test koji čuva lestvicu i ivicu (kao `one-token-source`) | S + M | tim S (tokeni), pa svaki tim svoje |
| 2 | `Section` (N2) umesto 8 zaglavlja odeljka (U9) | M | S gradi; H, T3a, T3b, T4a, Q usvajaju |
| 3 | Jedan razdelnik `sys.rule`; skini gornje linije odeljaka, `hairlineWidth`, isprekidane ivice (50 fajlova) | M | po timu; zaštitni test |
| 4 | Segmented bez odsecanja: jednake širine ≤ 3, `chips` ≥ 4, broj samo za „čeka tebe“ (U7) | S | S (`Segmented.tsx`); T3a, T3b, T2a |
| 5 | `ListRow` (N3), jedna ivica teksta: Profil, Settings (12 fajlova), Početna, radnje Dogovora | M | T4a, H, T3a |
| 6 | Porodica „zapis“: `Surface` (N6) + `FactRow` (N4) + budžet visine (zadatak ≤ 220, Moji zadaci ≤ 200, Dogovor ≤ 160) | L | T1-map2, T2a, T3a, T3b |
| 7 | Jedno podnožje: proširi `FlowFooter`, prebaci 6 ručnih (U10) | S + M | S; Q, T2b, T3a |
| 8 | Jedna korenska traka: Poruke = znak (`poruke.tsx:55`) | S | vlasnik `ui/messages/**` |
| 9 | Raspored: bez `DAY_FLOOR`, šine i isprekidane ivice; filter kao `chips` | M | T3b |
| 10 | Prazna/greška stanja centrirana, skeleti prave geometrije (T7); info red ≠ veza (4.15) | S + M | S; T4a |

## Šta nisam mogao da proverim
- Dizajn-laboratorij (8081): posle prvog snimka (23:49) nije vraćao HTML (zasićen), a posle restarta u 00:38 nije slušao ni u 00:41–00:42 (ERR_CONNECTION_REFUSED; drugi Metro ne pokrećem). Uspeo je samo `/dizajn-pocetna?scene=upcoming`, galerije nisu snimljene. Detalj zadatka, Dogovor detalj, Kandidati, Prijava i razgovor zato nemaju snimak i rade se iz koda (označeno „kod“).
- Snimci su umanjeni, pa debljina 1 dp (3,5 px) naspram `hairlineWidth` (1 px) je izvedena iz koda i gustine 3,5, ne izmerena sa slike. Visine posle predloga (≤ 200/160/96 dp) su proračun iz tokena; potvrditi na emulatoru 1264×2728, font 1,15 i 1,3.
- Otvara odluke vlasnika: zum +/− na telefonu (4.2), „Raspored“ kao ikona bez reči (4.8), mirne slike u grupi „Privatnost“ (4.14).
