# USKOČI — Sistem komponenti i kartica (Component & Card System)

Ažurirano: 23.10.2026.  
Status: Zvanična biblioteka komponenti  
Canon: `docs/implementation/design-system/PREMIUM_WHITE_CANON.md`

---

## 1. Kartica zadatka (`TaskFace` & `TaskRecordBody`)

Glavna kartica za listu zadataka, pretragu i rezultate na mapi.

### 1.1 Vizuelna struktura
```
┌────────────────────────────────────────────────────────┐
│ 📍 Novi Sad (Centar) • Pre 15 min        Rad na lokaciji│
│                                                        │
│ Krečenje dvosobnog stana (60 m²)                       │
│ Potrebno je osvežiti zidove u belo...                  │
│                                                        │
│ 🏷️ Moleraj   👥 2/3 nađeno (još 1 slobodno)             │
│ ────────────────────────────────────────────────────── │
│ 8.000 RSD                     👤 Marko P. ⭐ 4.8 (12)  │
└────────────────────────────────────────────────────────┘
```

### 1.2 Ključni elementi
1. **Slotovi i popunjenost (`capacityWords`)**:
   - `places.ukupno > 1`: `${places.popunjeno}/${places.ukupno} nađeno (još ${places.preostalo} slobodno)`.
   - `places.preostalo === 0`: `Popunjeno (${places.ukupno}/${places.ukupno})`.
   - `places.ukupno === 1`: `1 izvršilac` (ili `Popunjeno` ako je izabran).
2. **Podaci o naručiocu (Dole desno)**:
   - Avatar prečnika 28dp sa mekim zaobljenjem.
   - Ime i prvo slovo prezimena (npr. `Marko P.`).
   - Zlatna zvezdica `⭐` i ocena uz broj recenzija: `4.8 (12)`.
3. **Cena (Dole levo)**:
   - Krupno ispisan iznos u dinarima: `8.000 RSD` (font: 18sp bold `#0E4D3C`).
   - Ako je izabran režim ponuda: `Po ponudi` (font: 16sp semibold `#475569`).

---

## 2. Glasovni kompozitor (`VoiceComposer`)

Centralna komponenta za komunikaciju sa USKOČI asistentom.

### 2.1 Specifikacija dugmeta
- **Dimenzija**: **64dp × 64dp** kružno dugme.
- **Pozicija**: Savršeno centrirano u dnu ekrana, unutar komforne zone palca.
- **Boje**: USKOČI Deep Green gradijent (`#0E4D3C` → `#13634E`).
- **Elevacija i senka**: `elevation: 6`, `shadowColor: '#0E4D3C'`, `shadowOpacity: 0.25`, `shadowRadius: 10`.

### 2.2 Stanja i animacije
1. **Pulsirajući prsten (Breathing Ring)**:
   - Dok korisnik govori, oko dugmeta se širi suptilni polu-providni zeleni prsten (`rgba(14, 77, 60, 0.2)`).
   - Animacija traje 1100ms u beskonačnoj petlji sa `Easing.bezier(0.4, 0.0, 0.2, 1)`.
2. **Govor u realnom vremenu (`heardBubble`)**:
   - Iznad dugmeta se u realnom vremenu pojavljuje beli oblačić sa tekstom koji korisnik izgovara.
   - Prikazuje do 3 linije teksta, omogućavajući korisniku da vizuelno prati prepoznavanje govora.
3. **Morfovanje u dugme za slanje (`Morph to Send`)**:
   - Čim korisnik zaćuti ili se pojavi prepoznati tekst, ikonica mikrofona se fluidno pretvara u strelicu za slanje (`Send`).
   - Korisnik jednim dodatnim dodirom istog 64dp dugmeta šalje poruku u razgovor.
4. **Prekidač za tastaturu**:
   - Mala ikonica tastature sa leve strane omogućava brzo prebacivanje na standardno kucanje.

---

## 3. 2.5D Pin i mapa (`ResolvedPinMap` & `LocationPointEditor`)

### 3.1 Thumb-Lift interakcija
- **Problem na telefonima**: Kada korisnik drži prst na mapi da pozicionira pin, palac fizički zaklanja tačku, ulicu i kućni broj ispod igle.
- **Rešenje u USKOČI**:
  - Tokom dodira i pomeranja (`onTouchStart` / `onPanResponderMove`), pin se podiže za **-18dp (`translateY: -18`)** i uvećava na **1.2x (`scale: 1.2`)**.
  - Korisnik jasno vidi tačno mesto ispod vrha igle.
  - Prilikom spuštanja prsta, pin se meko vraća na standardnu visinu uz haptički klik (`Haptics.impactAsync(Light)`).

### 3.2 Kartica potvrđenog mesta
- Zamena za sirove koordinate:
  ```
  ┌────────────────────────────────────────────────┐
  │ 📍 Knez Mihailova, Stari Grad, Beograd         │
  │    Tačna lokacija za dolazak radnika           │
  └────────────────────────────────────────────────┘
  ```

---

## 4. Kartica radnika (`WorkerCard`)

- **Avatar i bedž verifikacije**: 48dp avatar sa zelenom kvačicom.
- **Veštine**: Čipovi sa ikonicama alata i modom rada (`Na lokaciji` / `Na daljinu`).
- **Područje rada**: `Novi Sad i okolina do 30 km`.
- **Dostupnost**: Zelena tačka `Dostupan odmah` ili `Po rasporedu`.

---

## 5. Kartica dogovora (`AgreementCard`)

- **Statusni indikator**:
  - `DOGOVORENO` (Plava)
  - `U TOKU` (Narandžasta)
  - `ZAVRŠENO` (Zelena)
  - `OTKAZANO` (Siva)
- **Podaci**: Datum, vreme dolaska, ugovorena cena, ime druge strane.
- **Brze akcije**: Dugme za čet, dugme za deljenje kontakta i dugme za potvrdu završetka.
