# USKOČI zvučni signali — v1

Ova tri kratka signala nastala su originalnom matematičkom sintezom u
`scripts/notification-audio-assets.cjs`. Ne sadrže preuzete audio uzorke,
snimke, glasove ili tuđe melodije. Ponovno pokretanje skripta proizvodi
iste WAV bajtove. Resursi pripadaju ovom projektu.

| Resurs | Namena | Trajanje |
|---|---|---:|
| `uskoci_message_v1.wav` | Nova poruka | 0,24 s |
| `uskoci_opportunity_v1.wav` | Nova prilika ili obaveštenje | 0,42 s |
| `uskoci_confirm_v1.wav` | Korisna potvrda radnje, kandidat | 0,46 s |

Format: mono PCM, 16 bit, 22.050 Hz, sa blagim početkom i završetkom.
Nema dodatne biblioteke, provajdera ili plaćenog generisanja.

## Stanje integracije

Preview runtime `uskoci-v1-preview-r2` ugrađuje ove resurse kroz
`expo-notifications` config plugin. Production konfiguracija nije izmenjena.
Stari runtime r1 ne sme OTA izmenom da tvrdi da poseduje nove native resurse.

Aktivni server i dalje koristi kanal `default`. Njegove postojeće zvukove,
vibraciju i korisnikove sistemske izbore aplikacija ne menja. Nema automatskog
prebacivanja starih instalacija na novi kanal, media-player reprodukcije niti
zaobilaženja režima „Ne uznemiravaj”.

Pre aktiviranja novih sistemskih zvukova obavezni su dokaz ugrađenih resursa,
potvrđen kanal/capability za konkretan token, bezbedan postupak nadogradnje koji
čuva ranije utišavanje, i proba na telefonu. Nazive budućih kanala treba
verzionisati zajedno sa ovim resursima. Do tada su ovo **SOURCE IMPLEMENTIRANI
resursi**, a čujnost, glasnoća i Android foreground/background/DND ponašanje su
**NIJE POTVRĐENO**. Zvuk potvrde se ne pušta pri svakom kliku.
