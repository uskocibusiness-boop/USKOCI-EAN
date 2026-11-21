---
name: uskoci-dizajn
description: Use for any USKOČI screen, component, copy or animation change (Expo/React Native). Holds the owner's fixed wording, navigation, Vi/Vam/Vas tone and the per-screen state checklist.
---

# USKOČI dizajn i tekst

## Fiksne odluke vlasnika
- Slogan tačno: „USKOČI — Vaš partner za svaki zadatak.“ (ne menjati oblik, ne vraćati stare slogane).
- Primarne akcije tačno: „Objavi zadatak“ i „Uskoči i zaradi“.
- Četiri taba: Početna, Zadaci, Dogovori, Poruke. Profil se otvara preko avatara.
- „Čeka Vas“ je uklonjeno sa Početne (20.11.2026) — ne vraćati.
- Reč za posao je „zadatak“. Obraćanje uvek Vi/Vam/Vas (i u porukama o greškama: „Pokušajte ponovo“, „Osvežite“, „Prijavite se“), bez pretpostavke roda.
- Veća promena rasporeda ili navigacije: pripremi pre/posle predlog, ne menjaj samovoljno.

## Kod
- Koristi postojeće: `src/ui/system/*` (tokens `sys`, `layout`, `Screen`, `Section`, `ListRow`, `Surface`, `Appear`), `src/ui/Text` (`T`), `V2Action`, `Press`.
- Animacije: Reanimated, poštuj reduced motion (`useSystemReducedMotion`). Za odluke o pokretu koristi skilove `animate-expo` / `emil-design-eng`.
- RN performanse i liste: skil `vercel-react-native-skills`.

## Kontrolna lista za svaki promenjen ekran
Sadržaj, učitavanje, prazno stanje, greška (unos se ne gubi), prekid mreže (nema duplog slanja), tastatura ne pokriva unos, Android „Nazad“, pristupačnost (accessibilityLabel), veliki tekst.
