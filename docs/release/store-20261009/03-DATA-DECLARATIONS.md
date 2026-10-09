# Google Data Safety + Apple App Privacy — radni audit

**NE prepisivati kao potvrđene odgovore** u konzole pre pregleda finalnog production builda, SDK-ova, AI proslеđivanja, processor mape i rokova čuvanja.

| Podaci | Dokazana / očekivana funkcija | Play tip (predlog) | Apple tip (predlog) | Rizik |
|---|---|---|---|---|
| Email, Auth ID | Prijava i nalog na Supabase | Personal info, account management | Contact info/identifiers linked | Kanonski backend + brisanje |
| Ime, grad, skills, vozilo, alat, dostupnost | Profil | Personal info | Linked profile/user content | Opcionalno vs obavezno |
| Task/opis, prijava, Dogovor, poruke | UGC i dogovori | User content | User Content linked | Druga strana vidi dozvoljene delove |
| Tačna adresa/koordinate | Privatni radni tok | Precise location | Location linked | Nejasan AI kontekst; RLS |
| Približna lokacija / u blizini | Mapa/pretraga | Approximate location | Location | Nema background praćenja u app configu; final manifest proveriti |
| Fotografije | Zadatak/profil/poruke | Photos/user content | User Content | Storage, EXIF, retention |
| Audio i transkript | Izričita voice funkcija | Audio data kada je skupljen | Audio Data where collected | Stvarni STT retention |
| AI tekst/fotografije | Gemini backend kada aktivan | User content, functionality | Third-party service collection | Prior notice/consent + exact address |
| Push token | Expo/FCM obaveštenja | Device/other IDs | Identifiers | Produkcioni Firebase klijent nedostaje |
| Safety prijave/podrška | UGC moderation | Interactions/user content | Linked user content | Operativni rokovi i izuzeci |
| Crash, analytics | Nije finalno provereno | UNKNOWN | UNKNOWN | Proveriti sve SDK-ove |
| Plaćanja | Nema in-app naplate V1 | Bez tvrdnje o karticama | Bez tvrdnje o karticama | Ne pominjati escrow |

Ne obeležavati "no tracking", "never shared", "all data deleted instantly" niti "no collection" dok to stvarno nije dokazano. Google prikupljanje/deljenje i Apple linked/tracking **nisu iste definicije**.

Pomoćni detaljni izvori: `docs/implementation/legal-drafts-20260930/LEG-09_processing_register.md`, `LEG-10_retention_deletion_matrix.md`, `LEG-11_processor_transfer_register.md`, `LEG-12_ai_audio_location_notices.md`, `LEG-18_sdk_permission_inventory.md`.

Zvanično: https://support.google.com/googleplay/android-developer/answer/10787469 ; https://developer.apple.com/app-store/app-privacy-details/
