# 12 — Visual Design System: USKOČI Premium White

Kanonski vizuelni ugovor je `docs/implementation/design-system/PREMIUM_WHITE_CANON.md` i implementacija u `src/theme/colorTokens.ts` i `src/ui/system/tokens.ts`.

---

## 1. Paleta boja i površina (`colorTokens.ts`)

| Uloga | Token | Hex | Upotreba |
|---|---|---|---|
| **Glavno platno** | `surface` | `#FFFFFF` | Primarna pozadina ekrana i kartica |
| **Topla podloga** | `ground` | `#F7F8F7` | Sekundarna pozadina ispod belih površina |
| **Meka ispuna** | `wash` | `#F2F4F2` | Polja unosa, neaktivne pilule i unutrašnje sekcije |
| **Primarni tekst** | `ink` | `#111613` | Naslovi, cene, glavni sadržaj |
| **Sekundarni tekst** | `muted` | `#525B55` | Podnaslovi, meta informacije, opisi |
| **Tihi tekst** | `subtle` | `#7A847E` | Pomoćne oznake i vremenske odrednice |
| **Primarni brend (Zelena)** | `green` / `greenSoft` | `#1B6B4A` / `#E6F2EC` | Glavna akcija (CTA), potvrđen status, sopstvene poruke u chatu |
| **Sekundarni akcenat (Narandžasta)** | `orange` / `orangeSoft` | `#E26D2D` / `#FDF0E6` | Hitno, nova obaveštenja, „Objavi zadatak" akcenat, čekanje odluke |
| **Opasnost / Greška** | `danger` / `dangerSoft` | `#B93829` / `#FDECEC` | Otkazivanje, greške, zatvaranje naloga |
| **Ivica kartice** | `cardLine` / `hairline` | `#E2E7E3` / `#E8ECE9` | Čiste 1px ivice umesto teških crnih senki |

---

## 2. Tipografska skala (`src/ui/system/tokens.ts` — Plus Jakarta Sans)

- `hero`: **30px / 36px** (`700`, `-0.6` tracking) — Uvodni ekrani i glavni fokus
- `pageTitle`: **24px / 30px** (`700`, `-0.4` tracking) — Naslov ekrana
- `heading`: **20px / 26px** (`700`, `-0.3` tracking) — Naslov sekcije ili modala
- `title`: **18px / 24px** (`600`, `-0.2` tracking) — Naslov kartice zadatka/dogovora
- `body` / `bodyStrong`: **16px / 22px** (`400` / `600`) — Glavni tekst i polja unosa
- `copy` / `note`: **15px / 21px** (`400` / `500`) — Opisi i sistemske poruke
- `label`: **14px / 18px** (`600`) — Dugmad, tabovi, čipovi
- `meta`: **13px / 18px** (`500`) — Vreme, udaljenost, statusne oznake (minimum u aplikaciji je 12px; sve cifre koriste `tabular-nums`).

---

## 3. Utvrđena odstupanja od kanona i plan vizuelne konsolidacije

1. **Ukidanje preostalih sivih skeletona (`QuietReadState` pravilo):**
   - `src/ui/system/StateView.tsx` (`kind === 'loading'`), `src/ui/notifications/ListSkeleton.tsx`, `src/ui/reviews/ReceivedReviewsList.tsx` i `ReviewCommentsSection.tsx` još uvek prikazuju sive lažne kartice (`Skeleton.tsx`).
   - **Akcija:** Preusmeriti sve `loading` prikaze na `<QuietReadState />` i ukloniti `Skeleton.tsx` / `ListSkeleton.tsx`.
2. **Ujednačavanje `AccountSettingsPresentation.tsx`, `AiHistoryListScreen.tsx` i `ProfileHubPresentation.tsx`:**
   - Prebaciti `AccountSettingsPresentation.tsx` i `AiHistoryListScreen.tsx` sa `background="wash"` i uokvirenih boksova na kanonski `SettingsScreen` + `SettingsGroup` + `Segmented` na belom platnu.
   - Zameniti hardkodovane veličine fontova u `ProfileHubPresentation.tsx` i `EntryWelcome.tsx` tokenima iz `sys.type`.
3. **Konsolidacija ikona i ilustracija:**
   - Zadržati `Glyph.tsx` (Phosphor 16/20/24px) za kontrole i navigaciju, i `FactArt.tsx` (2.5D dvobojne ilustracije 32–64px) za hero/prazna stanja. Ukloniti penzionisani `src/ui/v2/RadarIcon.tsx`.
