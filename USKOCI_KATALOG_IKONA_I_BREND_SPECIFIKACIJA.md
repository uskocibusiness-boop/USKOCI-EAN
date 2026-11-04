# USKOČI — Kompletan katalog vizuelnog identiteta, ikona i 2.5D ilustracija

Ovaj dokument predstavlja jedinstveni izvor istine (Source of Truth) za sve grafičke elemente, ilustracije, logo i ikone mobilne aplikacije **USKOČI**.
Svaka stavka sadrži tačnu ulogu u aplikaciji, trenutni izgled, tehničke dimenzije, kao i **gotov prompt za ChatGPT (DALL-E 3) / Midjourney** spreman za kopiranje.

---

## 1. Globalna stilska pravila za Image Generation (Prompt Master Template)

Sve ilustracije i ikone u aplikaciji USKOČI moraju delovati kao **jedinstven, koherentan set iz iste dizajnerske radionice**.

### Ključne vizuelne odlike stila:
* **Stil**: 2.5D taktilni meki glineni reljef (matte claymorphism / tactile minimal 3D).
* **Tekstura**: Glatka, polumat prirodna glina/guma bez sjajne plastike, bez stakla, bez kiča i bez generičkih 3D crtaća.
* **Ugao kamere**: Izometrijski blagi nagib (oko 15°–20° odozgo) sa prednje strane, centrirana kompozicija.
* **Osvetljenje**: Meko difuzno studijsko svetlo sa gornje-leve strane, blaga kontaktna senka (drop shadow) na dnu.
* **Pozadina**: **Isključivo izolovan objekat na potpuno providnoj pozadini (pure transparent background / alpha channel)**.
* **Paleta boja USKOČI**:
  - **Smaragdno zelena (Primarna)**: `#006B4F` / tamnija `#163D2B`
  - **Topla akcent narandžasta**: `#FF7A1A` / tamnija `#D95A00`
  - **Prirodna bela i krem**: `#FFFFFF` / meka `#F4F6F4`
  - **Ugljen grafit (Neutralna)**: `#102A1E` / siva `#7B887E`

> [!TIP]
> **ChatGPT / DALL-E Master Prompt Sufiks**:
> Svakom pojedinačnom promptu dodajte:
> `3D tactile matte clay illustration, soft ambient occlusion, minimalist modern product design, studio lighting, smooth clay texture, isolated on pure white background (transparent PNG style), premium clean mobile app asset, no text, no words, high resolution.`

---

## 2. Logo i vizuelni brend aplikacije

### 2.1. Glavni Logotip i Amblem (`BrandLockup` & `BrandMark`)
* **Uloga**: Početni ekran (Splash/Welcome), zaglavlja, podešavanja („O aplikaciji“).
* **Trenutni izgled**: Vektorski ispis imena **USKOČI** čistim zaobljenim geometrijskim sans-serif pismom sa karakterističnim skakačkim naglaskom na slovu **Č** u smaragdnoj boji (`#006B4F`), praćen dinamičnim amblemom slova **U** koje asocira na skok i pružanje ruke.
* **Format**: Vektorski SVG i 512×512px transparentni PNG.
* **Prompt za ChatGPT**:
  ```text
  Minimalist modern app logo mark for "USKOČI", a friendly on-demand local task matching service. An elegant, bold geometric letter 'U' sculpted in smooth matte emerald green clay (#006B4F) with a playful upward jumping arc or dot accent in warm orange (#FF7A1A). Premium fintech/service app branding, vector simplicity rendered as tactile 2.5D clay, isolated on pure white background, no clutter.
  ```

### 2.2. Ikona aplikacije za telefon (`app-icon / icon.png`)
* **Uloga**: Google Play Store ikona i ikona na početnom ekranu telefona (512×512px).
* **Trenutni izgled**: Puna smaragdno-zelena kvadratna podloga sa blago zaobljenim uglovima (squircle), u centru reljefni čisti beli USKOČI amblem sa diskretnom unutrašnjom senkom.
* **Prompt za ChatGPT**:
  ```text
  Mobile app icon, squircle shape with deep rich emerald green matte clay background (#006B4F). In the center, an embossed clean white tactile minimalist symbol: an energetic jumping 'U' curve representing jumping in to help and local work. Subtle soft 3D depth, clean edges, premium App Store / Google Play icon design, 4k.
  ```

---

## 3. Glavne 2.5D ilustracije (Ekran dobrodošlice, Početna i Kartice)

Ove ilustracije su nosioci vizuelnog identiteta aplikacije. Koriste se na karticama na početnoj strani (`HomeLaunchArt`), vratima dobrodošlice (`EntryWelcome`) i glavnim karticama zadataka.

| # | Naziv fajla | Uloga u aplikaciji | Opis trenutnog izgleda | ChatGPT / DALL-E Prompt |
|---|---|---|---|---|
| **1** | `money.webp` | **„Uskočite i zaradite“ / Budžet i ponude** | Kaskada diskretnih zelenih novčanica sa dva reljefna zlatno-mesingana novčića u prvom planu. | `A tactile 2.5D clay illustration of a neat stack of crisp paper banknotes in soft emerald green tones, accompanied by two thick minted metallic golden coins resting in front. Smooth matte clay texture, rounded edges, warm studio lighting, cast shadow below, isolated on pure white background.` |
| **2** | `publish.webp` | **„Objavite zadatak“ / Nova potreba** | Čist beli dokument/list sa zaobljenim uglovima, linijama teksta i istaknutim zelenim krugom sa belim plusom (+). | `A 2.5D matte clay illustration of a clean white sheet of paper or task card with soft rounded corners and subtle grey placeholder lines, featuring a vibrant emerald green circular badge with a bold white plus sign (+) on the bottom right corner. Minimalist, tactile, isolated on white background.` |
| **3** | `workbag.webp` | **Zanati / Alat radnika** | Meka kožna majstorska torba sa ručkom, kaišem i mesinganom kopčom u tonovima gline i terakote. | `A minimalist 2.5D tactile clay craftsman workbag or leather tool satchel, warm earthy clay brown with smooth rounded straps and a tiny brass buckle. Friendly, handmade artisan feel, soft shadows, isolated on pure white background.` |
| **4** | `agreements.webp` | **Dogovori / Uspešna saradnja** | Dve stilizovane apstraktne glinene ruke u čvrstom, prijateljskom stisku ruke (handshake). | `A 2.5D clay illustration of two friendly abstract hands shaking in agreement (handshake). One hand in warm soft cream clay, the other in muted terracotta clay. Smooth organic forms, rounded wrists, studio lighting, isolated on pure white background.` |
| **5** | `applications.webp` | **Moje prijave / Slanje ponude** | Geometrijski papirni aviončić od zelene i bele gline u poletu pod uglom od 45 stepeni. | `A 2.5D tactile clay paper airplane soaring upwards towards the right at a 45-degree angle. Clean geometric facets in emerald green and crisp white matte clay, smooth lighting, soft ground shadow, isolated on pure white background.` |
| **6** | `tasks.webp` | **Zadaci / Spisak poslova** | Drvena/glinena podloga sa štipaljkom (clipboard) i listom na kome su kvačice u boji. | `A 2.5D matte clay clipboard with a silver metal clip holding a clean white checklist with three neat rounded task lines and soft green checkmarks. Tactile, friendly, rounded bevels, isolated on pure white background.` |
| **7** | `calendar.webp` | **Datum / Rokovi zadatka** | Stoni blok-kalendar od bele gline sa crvenim/narandžastim zaglavljem i reljefnim spiralama. | `A 2.5D tactile clay desk calendar with soft rounded corners, orange-accent top binding with white spiral rings, showing a clear numeric page. Smooth matte finish, clean drop shadow, isolated on pure white background.` |
| **8** | `clock.webp` | **Vreme / Satnica zadatka** | Okrugli budilnik/sat mekih ivica od bele i zelene gline sa jasnim crnim kazaljkama. | `A 2.5D clay alarm clock or wall clock with a soft emerald green bezel, clean white dial face, and simple rounded hands pointing at 10:10. Tactile claymorphism, friendly round proportions, isolated on pure white background.` |
| **9** | `users.webp` | **Kandidati / Ljudi / Tim** | Dve apstraktne stilizovane biste/siluete ljudi, jedna ispred druge, mekih crta. | `A 2.5D matte clay illustration of two abstract minimalist people busts side by side. Smooth organic geometric heads and shoulders in complementary tones of sage green and warm cream. Soft studio lighting, isolated on pure white background.` |
| **10** | `pin.webp` | **Tačna lokacija / Adresa** | Klasični kapljičasti pin za mapu u jarkoj smaragdnoj boji sa belom kružnom tačkom u sredini. | `A 2.5D tactile clay map location pin in bold emerald green, standing upright with a soft cast shadow below and an indented white circular center. Plump, smooth rounded bevels, isolated on pure white background.` |
| **11** | `map.webp` | **Pretraga / Okolina** | Blago savijena topografska papirna mapa sa ucrtanom mekom putanjom i malom zastavicom. | `A 2.5D matte clay folded map unfolding gracefully, featuring subtle pastel contour lines and an emerald green route line with a tiny flag marker. Clean paper-like clay folds, isolated on pure white background.` |
| **12** | `home.webp` | **Početna / Kućni poslovi** | Simpatična stilizovana kućica sa kosim krovom u zelenoj boji, belim zidovima i vratima. | `A charming 2.5D clay house with an emerald green gable roof, clean white clay walls, a small door, and a tiny square window. Friendly geometric architectural toy style, isolated on pure white background.` |
| **13** | `chat.webp` | **Poruke / Razgovor sa AI** | Dva preklopljena govorna oblačića (speech bubbles) — veći smaragdno-zeleni i manji beli sa tri tačke. | `A 2.5D tactile clay illustration of two overlapping chat speech bubbles: a prominent emerald green message bubble in front with rounded corners, and a smaller soft white bubble behind with three debossed dots. Isolated on pure white background.` |
| **14** | `bell.webp` | **Obaveštenja / Push notifikacije** | Zlatno-narandžasto glineno zvonce sa dinamikom klatna i diskretnim zvučnim talasom. | `A 2.5D matte clay notification bell in warm amber orange (#FF7A1A) with a rounded clapper and smooth circular top ring. Friendly, tactile, soft cast shadow, isolated on pure white background.` |
| **15** | `tool.webp` | **Majstor / Popravke** | Kompaktna kutija za alat u cigla-crvenoj/zelenoj glini sa horizontalnom drškom i metalnom bravicom. | `A 2.5D tactile clay toolbox with a sturdy top handle, clean horizontal seam, and a tiny chrome latch in the center. Minimalist workman craft aesthetic, smooth clay bevels, isolated on pure white background.` |
| **16** | `vehicle.webp` | **Prevoz / Dostava / Selidbe** | Bočni profil simpatičnog kompaktnog kombija/dostavnog vozila sa dva točka i belim prozorima. | `A 2.5D clay utility van or delivery truck seen from side profile, with rounded emerald green body, white pill-shaped windows, and thick dark charcoal clay wheels. Cute, sturdy, isolated on pure white background.` |
| **17** | `remote.webp` | **Rad na daljinu (Online / Remote)** | Moderan desktop monitor na postolju, na ekranu apstraktni video-poziv avatar radnika. | `A 2.5D matte clay desktop computer monitor resting on a small stand, displaying an abstract friendly video call avatar on its screen. Smooth rounded bezel, clean minimalist workspace feel, isolated on pure white background.` |
| **18** | `support.webp` | **Podrška / Pomoć korisnicima** | Pojas za spasavanje (lifebuoy) u beloj boji sa četiri široka smaragdna prstena. | `A 2.5D tactile clay rescue lifebuoy ring in clean white with four emerald green wrap bands. Plump, smooth toroidal shape, soft lighting, isolated on pure white background.` |
| **19** | `document.webp` | **Pravila / Uslovi / Ugovor** | Pravni list sa presavijenim gornjim desnim uglom, pečatom na dnu i paralelnim linijama. | `A 2.5D matte clay formal document sheet with a crisply dog-eared top-right corner, embossed text lines, and a small round official clay stamp seal at the bottom. Isolated on pure white background.` |

---

## 4. Vektorske ikone stanja i provere (`FactArt` & `Glyph`)

Ove ikone se koriste unutar kontrola, dugmadi, filtara i tabela detalja gde je neophodna apsolutna oštrina pri malim veličinama (16dp – 24dp).

* **Zvezdica (`star`)**: Ocena radnika (5 krakova, blago zaobljeni vrhovi, topla jantarna boja `#FF7A1A`).
* **Katanac (`lock`)**: Privatnost adrese i podataka (zatvorena brava, svetlosivi luk, glineni korpus).
* **Oko (`eye`)**: Preglednost profila (zaobljena zenica i bademasti oblik oka).
* **Preuzimanje (`download`)**: Strelica na dole u posudu (izvoz podataka korisnika).
* **Upozorenje (`alert`)**: Zaobljeni trougao sa znakom uzvika u narandžastoj boji.
* **Kvačica (`check`)**: Potvrđeno stanje zadatka ili ponude (smaragdni puni krug sa belom kvačicom).

---

## 5. Tehnički standardi za uvoz novih slika u aplikaciju

Kada ChatGPT / Midjourney izgeneriše slike, pre ubacivanja u kod primenjuje se sledeći jednostavan postupak:

1. **Uklanjanje pozadine**: Slika mora imati providan PNG alpha kanal (bez bele ili sive pozadine).
2. **Format i kompresija**: Konvertovati u **WebP** sa kvalitetom 90–92% (zadržava 100% oštrinu uz 4× manju težinu od PNG-a, tipično 15–25 KB po slici).
3. **Dimenzije**: Slike se skladište u **384×384 px** (optimalno za sve 3x i 4x retina/XXHDPI ekrane Android i iOS uređaja bez usporavanja memorije).
4. **Lokacija u kodu**: Direktno u folder [`assets/illustrations/natural-v1/`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/assets/illustrations/natural-v1/).
5. **Ažuriranje manifesta**: Dodati hash u [`manifest.json`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/assets/illustrations/natural-v1/manifest.json).

---

## 6. Preporučeni redosled generisanja (Batch 1 za ChatGPT)

Ukoliko želite da ChatGPT generiše najvažnije slike odmah, pošaljite mu sledeću instrukciju:

```text
Please generate a cohesive set of 4 mobile app 3D illustrations in a tactile matte claymorphism style (smooth clay texture, soft studio lighting, emerald green #006B4F and warm orange #FF7A1A accents, isolated on pure transparent background):

1. MONEY: A neat stack of paper bills in soft emerald green with two thick golden clay coins in front.
2. PUBLISH: A clean white task card sheet with rounded corners and a vibrant emerald circle with a white (+) plus icon.
3. WORKBAG: An artisan leather craftsman workbag with a soft handle and tiny brass buckle.
4. AGREEMENTS: Two friendly stylized clay hands shaking in a warm agreement handshake.
```
