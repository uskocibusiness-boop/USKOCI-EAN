# USKOČI — povezana izvorna forenzika REV10–REV14 (30. oktobar 2026)

**Ovo NIJE drugi master.** Jedini važeći izvršni plan: [`docs/plan/CODEX_PLAN_RADA.md`](../../plan/CODEX_PLAN_RADA.md), posebno §11.2a (status i dokazi) i §12.5 (poreklo i mapa za nastavak). Ovo je čitljiv indeks **dokaza** i samoproveravajući arhiv za Codex.

## Šta sadrži

- **463 proverljive datoteke** u rekonstruisanoj ZIP arhivi, uključujući **439 izvornih funkcionalno-tehničkih tekstualnih dokaza** iz 908-fajlnog REV14 FULL paketa, plus alatke, indeks i aktuelni kontekst. Istorijske slike, PDF i fontovi nisu ponovo objavljeni; svih 908 putanja je dokumentovano u inventaru.
- **208 ključnih povezivanja**: 12 R zadataka, 42 F/SB/X nalaza, 19 cleanup C, 14 server SV, 77 ekranskih ugovora, 44 dodatna funkcionalna nalaza.
- Istorijski pregledi 3.434 putanje i njihove SHA-256 kontrolne vrednosti; stari izvorni commit `a9692e...` nije današnji source.
- Isti stari tehnički dokazi Z09/Z10/Z16 iz REV10 ostaju neizmenjeni u postojećem `docs/continuation/payload/`; ovaj paket daje proširene REV13 funkcionalne dokaze i **precizne veze** bez dupliciranja operativnog statusa.

## Jedna komanda za proveru, druga za obnovu

Iz korena repozitorijuma:

```bash
python docs/continuation/source-bridge-20261030/assemble.py
python docs/continuation/source-bridge-20261030/assemble.py --restore ../USKOCI_ANALIZE
python ../USKOCI_ANALIZE/USKOCI_CODEX_BRIDGE_2026-10-30/alati/proveri.py
python ../USKOCI_ANALIZE/USKOCI_CODEX_BRIDGE_2026-10-30/alati/kontekst.py R06 --repo .
```

Na Windowsu može `py -3` umesto `python`. Obnova je read-only u odnosu na repozitorijum, kod, bazu i okruženja; odbija prepisivanje različitih fajlova i ne pokreće SQL, Gemini ni deploy. Raspakovani tekstualni izvori su **istorijski dokazi**, nisu zamena za trenutni GitHub source i važeće vlasničke odluke.

## Ključni indeksi koje Codex može odmah da čita bez raspakivanja

- [208 mapiranih poslova](POVEZIVANJA_208.md) i [42+44 dodatnih nalaza](FUNKCIONALNI_NALAZI_44.md)
- [77 upoređenih ugovora](UGOVORI_77.md) i [13 mikrotokova](MIKROTOKOVI_13.md)
- [Proposed usko usaglašavanje i granice](DOPUNA_12_5.md)
- [Codex naredni koraci](KOMANDA_ZA_CODEX.md)
- [JSON indeks 208 jedinica](POVEZANI_NALAZI.json), [inventar 908 izvornih putanja](INVENTAR_908.json)
- [Manifest GitHub delova, byte hash i redosled](BUNDLE_MANIFEST.json)

## Status i bezbednost

Originalni REV10/REV14/evidence prenos od 305 fajlova ostaje u `docs/continuation/`. Novi paket samo povezuje i proširuje izvore. **Tri istorijska dokaza su javno redigovana zbog Gmail adresa**, sa tačnim prethodnim i objavljenim SHA-256 otiscima u `indeksi/REDAKCIJE_JAVNE_OBJAVE.json` unutar ZIP-a. Ostali tekstualni izvori imaju originalne bajtove. Veliki originalni REV14 FULL od 908 fajlova nije postavljen kao 89-MB binarni duplikat; arhivske slike/fontovi i dalje postoje u korisničkom originalu. 

**Uslovi rada:** R01 strict FAIL ostaje blokada za šemski rollout, R10 closure je otvoren, finalni Gemini/DEV/API/native/full CI nisu ovim dokaznim uploadom potvrđeni. Ne menjati aktuelni Product/UX kanon, ne izmišljati isporučene funkcije, ne brisati stari kod/testove/SQL bez stvarnih zavisnosti.

**ZIP SHA-256:** `2119897a6518d923728551a074c41a126c1a0e5dfc7230aa06e46462cb234beb` · **veličina:** 11,354,898 bajtova · **izvor:** 2026-10-30.
