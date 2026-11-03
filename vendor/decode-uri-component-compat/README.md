# Temporary query-string 7 compatibility adapter

Expo Router 57 currently calls query-string 7 through its named CommonJS API. That package requires decode-uri-component as a function. Patched decode-uri-component 0.5.1 exports an ESM default instead; overriding it directly breaks parsing. Upgrading query-string to 9 directly also breaks Router's named CommonJS calls.

This local adapter uses the official npm 0.5.1 decoder, pinned in the lockfile. It only bridges the export shape and preserves the old plus-to-space behavior, including fragment parsing. It contains no fork of the decoding algorithm and does not patch node_modules during installation. Version 0.5.1 also removes the quadratic replacement loop that remained in 0.5.0 and keeps decoded output from being decoded a second time.

Scope is the query-string dependency. Remove the adapter when the installed Expo Router accepts a query-string version that natively uses the patched decoder, after checking real Router parse/stringify callers and native bundling.

Upstream security advisories: https://github.com/advisories/GHSA-vcc3-ghjq-m6fr and https://github.com/advisories/GHSA-qr28-fpjm-wq7f

Patched upstream source: https://github.com/SamVerschueren/decode-uri-component/tree/v0.5.1
