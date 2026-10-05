---BUILD REPORT---

**Goal:** The approved hard hat SVG (assets/branding/jobcore-icon-hardhat.svg) becomes the default Android launcher icon for the next APK.

**Changes:**
- Added app/apps/mobile/assets/icon-1024.png and adaptive-foreground-1024.png.
- app.json: icon and android.adaptiveIcon (foreground png, background #1B2A41).
- In the gitignored main-checkout android/app/src/main/res: deleted 10 old ic_launcher*.webp, added 15 PNGs across mipmap-*, created mipmap-anydpi-v26/ic_launcher.xml and ic_launcher_round.xml; drawable/ic_launcher_background.xml is now solid #1B2A41.
- Docs updated: README, deployment.md.

**Verification:** Nestor PASS on file counts; 0 webps left. APK NOT built (Jeff builds via npm run build:apk in the main checkout).

**Forward contracts:** Jeff must run npm run build:apk from main-checkout app/apps/mobile to see the icon; android/ res changes are uncommitted by design.

## Deviations / Defects

none
