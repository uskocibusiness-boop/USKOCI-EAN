# Development scenes

These 21 retained scenes moved out of Expo Router's `src/app` on 2026-10-18.
Their rendering tests import them here. They are not product routes and their
historical `/dizajn-*` links are not supported by the regular APK.

Use the live product routes for current end-to-end/device acceptance. A scene
renders fixtures and cannot establish backend, account, delivery or phone proof.
Do not import this folder from runtime code or copy it back into `src/app`.

Move hashes: `docs/implementation/ui-ux-pass-20261002/DESIGN_LAB_MOVE_20261018.json`.
