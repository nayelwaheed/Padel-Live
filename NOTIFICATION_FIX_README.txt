PADEL LIVE v2.1 — NOTIFICATION FIX

If your GitHub repository already has v2, you only need to replace these files:

1. app.js
2. sw.js
3. manifest.webmanifest
4. index.html

Then commit the changes and let GitHub Pages redeploy.

IMPORTANT ON IPHONE:
- Open the GitHub Pages site in Safari once after the update.
- If your existing Home Screen copy still behaves like the old version, delete ONLY the Padel Live Home Screen icon and add it again from Safari.
- Your favourites are normally website data/localStorage, but reinstalling/clearing Safari site data can remove them.

TEST:
1. Launch Padel Live FROM ITS HOME SCREEN ICON.
2. Settings -> Test notification.
3. Allow notifications if iOS asks.
4. Check Settings -> Notifications -> Padel Live if needed.
5. Also check Notification Center, because iOS can suppress/soften banners while the same web app is open.

This test only proves the iPhone can display notifications.
Automatic match alerts while Padel Live is closed require the Web Push subscription/server phase.
