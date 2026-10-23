# USKOČI — Detaljna specifikacija ekrana po ekran (Final UX)

Ažurirano: 23.10.2026.  
Status: Izvršna UX specifikacija  
Canon: `docs/implementation/design-system/PREMIUM_WHITE_CANON.md`

---

## 1. Globalni principi vizuelnog sistema (USKOČI Premium White)

- **Platno**: Čisto belo (`#FFFFFF`), neutralne pozadine sekcija (`#F8FAFC`, `#F1F5F9`).
- **Tekst**: Glavni naslovi i telo tamno sivi/crni (`#0F172A`, `#1E293B`), prateći tekst (`#64748B`).
- **Primarna boja (USKOČI Deep Green)**: `#0E4D3C` (poverenje, stabilnost, završeni koraci, CTA).
- **Akcentna boja (USKOČI Warm Orange)**: `#FF7908` (hitnost, akcija, novi zadatak, obaveštenja).
- **Tipografija**: Sistemski fontovi (San Francisco / Roboto / Inter), hijerarhija: H1 28sp bold, H2 20sp semibold, Body 15sp regular, Caption 13sp medium.
- **Ikone i pinovi**: Originalne 2.5D ikone sa blagim uglom i mekom senkom (elevation: 4).

---

## 2. Ključni tokovi i ekrani — Specifikacija izgleda

### 2.1 AI razgovor za unos zadatka (`nova.tsx` & `IntakePresentation.tsx`)
- **Zaglavlje**: Minimalističko, ultra-čisto. Samo strelica nazad `←` i naslov `USKOČI Asistent`. Uklonjen je teški tamno-zeleni banner koji je zauzimao gornju trećinu ekrana.
- **Oblast poruka**: Čiste bele i blago sive oblačiće poruka sa mekim zaobljenjem (radius: 16dp). Prikaz poruka korisnika i asistenta u prirodnom ritmu.
- **Kartica rezimea (Live Draft Card)**:
  - Ne skače pri svakom unosu niti guši razgovor.
  - Prikazuje se diskretno na samom kraju razgovora kada je nacrt spreman za pregled (`readyForReview === true`).
- **Voice Composer — Vlasnički glasovni UX**:
  - **Dugme**: Veliko centralno dugme prečnika **64dp**, pozicionirano u dnu ekrana.
  - **Boja i senka**: USKOČI duboko zeleni gradijent (`#0E4D3C`), meka senka sa elevacijom.
  - **Pulsirajuća animacija**: Glatki "breathing" prsten (ciklus od 1100ms) koji pulsira dok korisnik govori.
  - **Prikaz govora u realnom vremenu (Real-time Speech Preview)**: Iznad dugmeta se u diskretnom polu-providnom balonu ispisuje tekst koji korisnik izgovara.
  - **Morfovanje u dugme za slanje**: Čim korisnik završi govor ili postoji unet tekst, mikrofon glatko morfuje u veliku ikonu strelice za slanje (`Send`) na istom mestu (one-thumb reach).
  - **Prebacivanje na tastaturu**: Diskretna ikonica tastature levo od mikrofona omogućava korisniku da kuca ako ne želi da govori.

---

### 2.2 Pregled i mapa lokacije zadatka (`ResolvedPinMap.tsx` & `LocationPointEditor.tsx`)
- **Interakcija prevlačenja (Supreme Authority)**:
  - Bez obzira na lokaciju izrečenu u razgovoru, **tačka koju korisnik potvrdi ili prevuče na mapi je vrhovni autoritet**.
  - Ako korisnik u razgovoru kaže „Treba mi u Nišu“, a zatim prevuče pin u Beograd na Knez Mihailovu, sistem usvaja Knez Mihailovu kao zvaničnu lokaciju.
- **2.5D Pin sa Thumb-Lift elevacijom**:
  - Prilagođeni 2.5D pin sa dubinom i senkom.
  - **Thumb-Lift**: Tokom dodira i prevlačenja, pin se automatski podiže za **-18dp (`translateY: -18`)** i skalira na **1.2x (`scale: 1.2`)**. Korisnikov palac više ne zaklanja ulicu, raskrsnicu ili kućni broj ispod igle!
- **Kartica potvrđene adrese**:
  - Uklonjeni su sirovi GPS brojevi (npr. `44.812543, 20.461234`).
  - Prikazuje se čista geokodirana kartica: `📍 Knez Mihailova, Stari Grad, Beograd`.

---

### 2.3 Kartica zadatka u listi i pretrazi (`TaskFace.tsx` & `TaskRecordBody.tsx`)
- **Prikaz popunjenosti slotova (Multi-worker Capacity)**:
  - U gornjem delu kartice prikazuje se tačan status traženih radnika:
    ```
    2/3 nađeno (još 1 slobodno)
    ```
    ili `1/1 nađeno (popunjeno)` / `0/2 nađeno (još 2 slobodna)`.
  - Korisnik jednim pogledom odmah zna koliko još ljudi nedostaje za zadatak.
- **Podaci o autoru (Dole desno)**:
  - U donjem desnom uglu kartice smešten je autor sa avatarom, imenom i zvezdicama:
    ```
    👤 Marko P.  ⭐ 4.8 (12)
    ```
  - Ovo unosi poverenje (Airbnb disciplina) i omogućava brzu odluku radnika.
- **Statusna traka i bedževi**:
  - Način rada: zeleni bedž za `Rad na lokaciji` uz naziv grada, plavi za `Na daljinu`.
  - Cena: krupno istaknuta levo u dinarima (`8.000 RSD` ili `Po ponudi`).

---

### 2.4 Radni profil radnika (`WorkerProfilePresentation.tsx` & `radnik.tsx`)
Otklonjeno je 19 P0 nedostataka:
1. **Aktivacija profila**: Popravljen hardkodovani bag `readyToActivate={false}` — dugme „Aktiviraj radni profil“ sada pouzdano aktivira profil kada su definisani veština i grad.
2. **Vidljivost rasporeda**: Popravljen bag gde je raspored bio sakriven kada je uključeno `availableNow=true`. Radnik sada može imati i instant dostupnost i definisan nedeljni kalendar.
3. **Dugme za mapu i područje rada**: Dugme više ne nestaje kada nema definisanih poligona — radnik uvek može dodirnuti „Izaberi grad i radijus rada“.
4. **Izgled usluga**: Usluge su prikazane kao elegantni beli čipovi sa zelenim obrubom i indikatorom moda rada (`Terenski` / `Online`).
5. **Ocene i preporuke**: Zasebna sekcija sa prosečnom ocenom i brojem uspešno završenih zadataka.

---

### 2.5 Dogovori i čet (`dogovor/[id].tsx` & `dogovor/[id]/grupa.tsx`)
- **Stanje dogovora**:
  - Čist vizuelni stepper koraka: `Dogovoreno` → `U toku` → `Završeno` → `Ocenjeno`.
- **Svesno deljenje kontakata**:
  - Broj telefona i tačna adresa se **ne dele automatski**.
  - Dugme „Podeli moj broj telefona sa radnikom“ zahteva svesnu potvrdu jednim dodirom uz jasno obaveštenje.
- **Završetak zadatka i ocenjivanje**:
  - Obe strane imaju jasno dugme „Označi kao završeno“.
  - Nakon bilateralne potvrde, automatski se otvara modal za ocenjivanje (1-5 zvezdica i kratak komentar).
