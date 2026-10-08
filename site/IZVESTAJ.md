# USKOČI sajt — izveštaj, 8. oktobar 2026

Grana `sajt/cinematic-20261008` (worktree `USKOCI-SAJT-20261008`, nastala iz `integration/spoj-20261006` @ f1ddd54d). Aplikacija, Supabase, AI servisi, OTA, DNS i Vercel NISU dirani.

## Šta je napravljeno

- **Generator** `site/build.py` (Python + mistune) → `site/public/` (produkcija, čisti URL-ovi, `vercel.json`, sitemap, robots) i `site/preview/` (relativne veze, za pregled bez servera). Jedan CSS (`src/site.css`), jedna skripta (`src/site.js`, ~8 KB), Inter sa diska aplikacije (latinica + ćirilica, WOFF2), bez spoljnih zahteva.
- **18 stranica:** Početna, Kako radi, Meni treba, Ja mogu, Aplikacija, Bezbednost, Pitanja (sa FAQ strukturiranim podacima), Dostupnost, O proizvodu, Podrška i kontakt, Preuzimanje, Pravni centar + 6 pravnih dokumenata (`/privatnost/`, `/uslovi-koriscenja/`, `/pravila-zajednice/`, `/brisanje-naloga/`, `/podrska-i-reklamacije/`, `/operater-i-kontakt/`); tekst „Kako radi“ iz paketa je deo `/kako-radi/`.
- **Scena maskota (početna):** Ana sa zadatkom → robot za zadatke (bez šlema) ulazi i trepne → robot sa šlemom ulazi („Petak mi odgovara. Uskačem!“) → namig → „Dogovoreno“ → znak USKOČI i „Neko ima zadatak. Neko može da uskoči.“ Jednom, ~11 s, kad je scena vidljiva; dugmad „Pogledaj ponovo“ i „Zaustavi pokret“; smanjeni pokreti / bez skripte / skrivena kartica → mirni poslednji kadar.
- **Prikaz aplikacije:** lepljivi telefon čiji se ekran menja pri skrolu (Početna, AI razgovor, Pregled pre objave, Zadaci na mapi, Prijava, Dogovor); na telefonu svaki korak ima svoj mali prikaz.
- **Brisanje naloga i podrška:** obrazac koji sastavlja imejl u programu za poštu posetioca (ništa se ne šalje sa sajta, to piše na stranici), dugme „Kopiraj adresu“.
- **Google Play materijal:** `site/play/` — ikona 512×512 (32-bit PNG sa alfom), feature graphic 1024×500 (24-bit), `PLAY_OPIS_ZA_KOPIRANJE.txt` iz paketa; OG slika 1200×630.

## Statusi

### IMPLEMENTED
Sve gore navedeno postoji u kodu i gradi se bez greške.

### VERIFIED (lokalno, `python -m http.server`, ugrađeni Chromium; NE Vercel, NE telefon)
- 18/18 stranica generisano; 679 internih veza i 14 veza između dokumenata — 0 pokvarenih.
- Konzola bez grešaka; nema horizontalnog skrola na 375 px; 1 `h1` po stranici; sve slike imaju `alt`.
- Merenje početne (lokalni server, desktop): FCP 160 ms, LCP 160 ms, CLS 0,0000, 13 zahteva, JS 8 KB; ukupna težina početne sa svim slikama ≈ 612 KB (slike ispod prvog ekrana se učitavaju lenjo). Lokalni broj — stvarni rezultat meri se na Vercel preview-u (Lighthouse/PageSpeed).
- Scena i mobilni raspored pregledani snimcima na 375 px i desktopu.

### NEEDS USER ACTION (tvoja reč ili podatak)
1. **Potvrdi `uskoci.support@gmail.com`** kao javni kontakt koji prima poruke (paket ga nije preuzeo: „Privatni Gmail nije preuzet“). Do potvrde je na sajtu, ali sajt nije objavljen.
2. **25 podataka iz paketa v4.3** (`podaci/cinjenice.json`): svojstvo operatera, adresa, registracioni podaci, datum primene, rokovi čuvanja (zvuk, izvoz, rezervne kopije, glasovne poruke…), kolačići, primaoci obrade, kopija Dogovora, obrazac za odustanak, objašnjenje rangiranja, putevi u aplikaciji. Svako prazno polje je na stranici vidljivo kao žuta oznaka „nedostaje: …“ (privatnost 15, operater 7, uslovi 6, podrška 2, brisanje 1, kako radi 1).
3. **Zvaničan zapis imena operatera** — namerno NIJE prikazan dok ga ne potvrdiš (`_odobrenje.zvanicno_ime_i_javni_podaci_potvrdjeni`).
4. **Brisanje naloga u aplikaciji:** u kodu ekran „Zatvaranje naloga“ kaže „trenutno nije dostupno. Potpuna pravila zatvaranja i čuvanja još nisu objavljena.“ Google traži stvaran put u aplikaciji i na webu — ovo je blokada za Play, ne za sajt.
5. **Vercel:** postojeći projekat PRONAĐEN — `C:\Users\user\Desktop\USKOCI-SAJT\.vercel\project.json`: `uskoci-web` (tim `team_17J08X8dOmNyHIMQiK8RtGZm`); CLI je prijavljen na ovom računaru (20. 9.). Taj folder ima jedan `index.html` (4,9 MB, 20. 9.) — verovatno sadašnja početna; NIJE diran. Preview deploy (bez `--prod`) ne menja produkciju ni domen, ali daje javnu vezu — čeka tvoju reč.
6. **Stvarni snimci ekrana** iz izdanja (4 kadra 1080×1920 po `07_slike_i_opis.md`) — za Play i da zamene složene prikaze na sajtu.
7. **Domen `uskoci.rs`** — DNS ne diram bez tvoje reči.

### LEGAL REVIEW
- Svih 7 dokumenata je **NACRT v4.3** sa trakom „još nije na snazi“; paket sam kaže „UREĐENO — ČEKA POTVRĐENE ČINJENICE; NIJE OBJAVLJENO“. Ne objavljivati kao finalne.
- Model operatera (fizičko lice/preduzetnik, registracija delatnosti) — nije razrešen; lični Google nalog nije odgovor.
- Granica posredovanja u radnom angažovanju i dozvoljenih kategorija.
- Javne tvrdnje na sajtu (besplatno, bez provizije, bez novčanika, direktno plaćanje, Srbija, 18+, nije poslodavac) uzete su iz paketa i AGENTS odluka R03/R06; proveriti pre objave.

### NOT VERIFIED
- Ponašanje na Vercel-u (zaglavlja, čisti URL-ovi), HTTPS, domen.
- Lighthouse/PageSpeed brojke; čitač ekrana (VoiceOver/TalkBack); stvarni telefon.
- Da li adresa podrške prima poruke.
- Da li su prikazi aplikacije verni konačnom izdanju (složeni su po izvornom kodu i ekranima od 8. 10.; nisu snimci ekrana).

## Prepoznata ograničenja dizajna (iskreno)
- Telefonski prikazi na sajtu su **složeni u HTML-u** po ekranima aplikacije, sa oznakom na stranici. Paket za Play izričito traži stvarne kadrove — za Play ih ne koristiti.
- Roboti: korišćeni su postojeći `task-face-base`/`worker-face-base` i LED lice iz studije izraza (v2, `robot-motion.html`); animacija lica (treptaj, namig) je stvarna, ali **ruke/mahanje ne postoje** u materijalu i nisu izmišljeni.
- Fotografije Ane i Marka su originalne fotografije iz ulaza V4.9; imena su primer.

## Kako do Vercel preview-a (bez diranja domena)
```bash
cd site/public
mkdir .vercel; copy C:\Users\user\Desktop\USKOCI-SAJT\.vercel\project.json .vercel\   # isti projekat uskoci-web
npx vercel@latest deploy           # BEZ --prod: samo preview URL; produkcija i domen ostaju
```
Preview URL je javan svakome ko ima vezu; `X-Robots-Tag: noindex` i `robots.txt Disallow` drže ga van pretrage.

## Kako bezbedno povezati `uskoci.rs` (tek posle tvoje reči i pravnih podataka)
1. U `build.py`: `INDEXABLE = True`; u `public/vercel.json` ukloni `X-Robots-Tag`; `python -P site/build.py`.
2. Vercel → Project → Domains → dodaj `uskoci.rs` i `www.uskoci.rs` (www preusmeri na apex).
3. Kod registra (RNIDS ovlašćeni registrar): A zapis `@` → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com` (tačne vrednosti prepiši iz Vercel ekrana, one važe).
4. Sačekaj HTTPS sertifikat, proveri `https://uskoci.rs/privatnost/` i `/brisanje-naloga/` bez prijave, pa te dve veze upiši u Play Console.
