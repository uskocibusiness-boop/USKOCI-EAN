# Worker saved-draft activation entry — 2026-11-09

Status: SOURCE tested; not installed-Android activation acceptance.

The root executor observed a deliberately saved DRAFT profile on the phone, with a Novi Sad work area and an empty legacy city. The saved-profile route offered only “Nastavite kroz razgovor”, which reopened the completed Save conversation. This source fix addresses that route entry; this proof does not assert a new phone result.

## Cause and change

- `src/app/(app)/profil/radnik.tsx` previously required the legacy city to offer the separate signed activation review. Its area checklist required legacy city plus radius.
- The route now recognizes valid saved CITY/RADIUS/COUNTRY territories through the existing `decodeWorkerAreas` contract, and confirmed REMOTE-only execution modes through the existing owned reader. An empty city is no longer a blocker for those saved profiles.
- The entry sends a fresh `activationRequest` to the existing conversation route. It does not invoke the profile writer, grant a capability, set ACTIVE, or claim that every server activation requirement is satisfied. The signed preparation and explicit confirmation stay authoritative.
- The existing city-only review entry remains available even if the old radius is incomplete; the checklist still reports that incomplete area correctly. The legacy direct writer retains its original city/radius gate.
- No new database column or table is assumed. Work areas are consumed through the existing owned profile projection. No schema, writer, consent, mode inference, prompt or review implementation changed.
- Suspended profiles, unsaved edits, pending outcomes and ownership/focus guards retain their existing boundaries.

## Verification

- Three direct regression cases failed against the previous route: saved CITY, saved COUNTRY/RADIUS, and confirmed REMOTE-only without a city.
- `node --test scripts/ux-navigation-copy.test.cjs scripts/ux-saved-availability.test.cjs`: **47/47 PASS**, zero skipped.
- After explicitly preserving the old city-only review entry: `node --test scripts/ux-navigation-copy.test.cjs`: **34/34 PASS**, zero skipped.
- Six added tests mount the actual route and actual owned editor using the existing component harness. Native widgets, profile reader and execution-mode hook boundary are fixtures. They cover valid territories, confirmed REMOTE, malformed/missing areas, unknown/ON_SITE/BOTH modes, missing skills, legacy city, dirty/suspended state, stale account/background callbacks, and zero activation writes.
- `npx tsc --noEmit`: PASS. `git diff --check`: PASS.

## Remaining acceptance

Build/install the updated client, read the saved profile through the actual owned projection, tap “Pregled za aktivaciju”, and verify a fresh signed activation review rather than the completed Save. Confirm activation only through the normal explicit review action, then read ACTIVE and the matching capability from the server. That device/Auth acceptance is not established by these mounted tests.
