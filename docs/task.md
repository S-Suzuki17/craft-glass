# Craft Glass — Task & Verification Tracker

- [x] Step 1: Scaffold `D:\Development\craft-glass`, `.gitignore`, `package.json`, `tools/sync-assets.mjs`
- [x] Step 1b: Document `docs/architecture.md` & verify clean asset budget (< 6 MB)
- [x] Step 2: Implement core domain ES modules (`i18n.js` EN default, `catalog.js`, `weekly-pool.js`, `rpg-engine.js`, `fsrs.js`, `proof-ledger.js`, `pro-entitlements.js`, `duel-arena.js`, `storage.js`) and pass 100% of `node --test tests/*.test.mjs` (20/20)
- [x] Step 3: Build Web UI (`web/index.html`, `web/styles/app.css`, `web/src/app.js`, `pixel-renderer.js`, `timelapse.js`, `proof-card.js`, `audio.js`, `native-bridge.js`) with minimal UI copy, Guild Duel Auto-Battler, & Craft Pro/Rewarded HD Pass
- [x] Step 4: Build Native Android Shell (`MainActivity.java` API 36 predictive back, `BillingManager.java` Play Billing `8.3.0`, `AdManager.java` AdMob `25.3.0` + UMP `4.0.0`, `ShareFileProvider.java`), hourglass app icon, store graphics, keystore, and validate signed `.aab` (`com.craftglass.app`, `vc=3`, `v=1.0.2`, `targetSdk=36`, `6.35 MB`)
- [x] Step 5: Create GitHub repo `S-Suzuki17/craft-glass`, push `main`, publish GitHub Pages (`privacy.html` & live `app/`)
- [/] Step 6: Play Console App Content (11/11 including Ads=Yes, Advertising ID=Yes, Data Safety=Device IDs), Store Settings & `en-US` text saved, old `vc1` removed from Internal Testing draft; ready for manual drop of `craft-glass-1.0.2-vc3-release.aab` -> rollout -> `Monetize → Products` SKU setup (`craft_pro_yearly`, `craft_pro_monthly`, `craft_pro_lifetime` `¥8,800 / $59.99`)
