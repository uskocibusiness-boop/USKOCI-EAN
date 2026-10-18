# Home: own task in worker preview — 18 October 2026

On the signed-in `emulator-5554` running `rs.uskoci.preview`, the Home carousel **Zadaci za tebe** showed `Montaža ormara` from the same account (`Milos`). Opening it showed **Tvoj zadatak**. This was a presentation error: the public task reader intentionally includes all open tasks, while Home's worker-oriented carousel failed to remove the account's own items.

The Home route already reads the complete owner-scoped `rpc_list_my_tasks` result in parallel with public tasks. `homeOpportunityPreview` uses that owner list to exclude own task IDs before sending cards to the presentation. When that read is unavailable, it withholds preview cards; the normal `Uskoči i zaradi` and `Pogledaj sve` navigation remains available. The public Zadaci map/list and the authoritative server reader are unchanged. Empty preview chrome is omitted, and the two primary Home actions render before any available preview.

Evidence: before, native UI hierarchy and screenshot showed two own cards under **Zadaci za tebe**. After Metro refresh, native UI hierarchy and screenshot showed no own cards. After the empty-state polish, the native Home showed neither the carousel heading nor its blank space. The scope is a local debug bundle on the emulator, not a release APK or physical-phone acceptance. No DEV state, Edge function, push setting, AI conversation or business record was changed.

Focused Jest: `home-opportunity-preview.test.ts` and `v3-home-screen.test.tsx`, 110/110. TypeScript `npx tsc --noEmit` and `git diff --check` pass. These checks cover the owned/unavailable-list cases and the existing Home contract. The broader test suite was not rerun for this UI-only change.
