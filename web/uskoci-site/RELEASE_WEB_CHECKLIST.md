# USKOČI web / store release checklist — 2026-10-09

## Intended public URLs

- Marketing URL: https://uskoci.rs/
- Support URL: https://uskoci.rs/support
- Privacy Policy URL: https://uskoci.rs/privacy
- Apple User Privacy Choices URL: https://uskoci.rs/privacy-choices
- Google Play account deletion URL: https://uskoci.rs/delete-account
- Terms: https://uskoci.rs/terms
- Safety / community rules: https://uskoci.rs/safety

## Store facts checked 2026-10-09

- Apple requires a Privacy Policy URL for all apps.
- Apple App Review 5.1.1(v): apps that support account creation must allow initiation of account deletion in-app.
- Apple App Store version metadata includes a Support URL.
- Google Play requires a privacy policy in Play Console and in-app.
- Google Play account-creation apps require both an in-app deletion path and an external web deletion resource.
- Google says account freezing alone is not deletion; retained data must be justified and disclosed.

## Product facts already present in canonical source

- In-app route: Profil → Privatnost i podaci → Zatvaranje naloga.
- Existing closure flow has preview / blockers / execute / status.
- Existing legal bundle infrastructure can publish Terms + Privacy by HTTPS URL and hash.
- Existing draft LEG-08 says external deletion path was missing; this web package supplies a user-facing external request path by email.
- Existing account closure may enter EXCEPTIONS_PENDING for support/safety evidence. This must be reviewed against store policy so the exception is narrow, justified, disclosed, and not a generic freeze.

## BLOCKERS before production / store submission

1. Confirm final operator/controller legal identity exactly as it will appear on store listings.
2. Confirm postal address and privacy contact details for the final Privacy Policy.
3. Confirm the store developer/display name.
4. Confirm age eligibility / rating language.
5. Freeze retention periods and exception-release procedure (LEG-10 / LEG-08).
6. Freeze processor/provider map and processing regions.
7. Confirm the external deletion operations workflow: who receives email, verifies account ownership, opens the DSR ticket, runs closure, and sends completion notice.
8. Legal review of Terms, Privacy, Safety, deletion page.
9. Remove preview/noindex flags and change robots.txt from Disallow to Allow.
10. Publish final legal document versions in backend legal bundle using the exact production HTTPS URLs and hashes.
11. Verify each public URL anonymously, without app install or login.
12. Verify mobile, reduced-motion, keyboard navigation, contrast, 404, and social metadata.
13. Only then attach uskoci.rs to the Vercel project and submit URLs to Play Console / App Store Connect.

## Working contact used in preview

- uskocibusiness@gmail.com

This is a preview/release-prep package, not final legal advice.
