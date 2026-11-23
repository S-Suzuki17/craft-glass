# Craft Glass — Task & Verification Tracker

- [x] Step 1: Scaffold `D:\Development\craft-glass`, `.gitignore`, `package.json`, `tools/sync-assets.mjs`
- [x] Step 1b: Document `docs/architecture.md` & verify clean asset budget (< 6 MB)
- [x] Step 2: Implement core domain ES modules (`i18n.js`, `catalog.js`, `weekly-pool.js`, `rpg-engine.js`, `fsrs.js`, `proof-ledger.js`, `pro-entitlements.js`, `storage.js`) and pass 100% of `node --test tests/*.test.mjs` (17/17)
- [x] Step 3: Build Web UI (`web/index.html`, `web/styles/app.css`, `web/src/app.js`, `pixel-renderer.js`, `timelapse.js`, `proof-card.js`, `audio.js`, `native-bridge.js`, Craft Pro dialog) and pass mobile/desktop browser verification (EN & JA, 0 console errors)
- [x] Step 4: Build Native Android Shell (`MainActivity.java` with API 36 predictive back, `BillingManager.java` with Play Billing `8.3.0`, `ShareFileProvider.java`), hourglass app icon, store graphics, keystore, and validate signed `.aab` (`com.craftglass.app`, `vc=2`, `v=1.0.1`, `targetSdk=36`, `4.44 MB`)
- [x] Step 5: Create GitHub repo `S-Suzuki17/craft-glass`, push `main`, publish GitHub Pages (`privacy.html` & live `app/`)
- [/] Step 6: Play Console App Content (10/10), testers list, Store Settings & `en-US` text saved; release prepare/review page open for replacing `vc1` with `craft-glass-1.0.1-vc2-release.aab` -> rollout -> `Monetize → Products` SKU setup (`craft_pro_yearly`, `craft_pro_monthly`, `craft_pro_lifetime`)
