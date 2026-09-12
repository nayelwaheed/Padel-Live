# Padel Live — $0 Personal iPhone Web App

This is a no-framework Progressive Web App (PWA) for Windows + iPhone with no paid Apple account and no paid hosting.

## Already working
- Installable Home Screen web app
- Full-screen iPhone layout
- Matches screen
- Tournament snapshot
- Men's and women's ranking snapshot
- Follow/unfollow favourite players
- Favourites saved on-device
- Notification permission + test notification
- Offline app shell

## Not connected yet
The current sports data is a snapshot. Automatic live scores, automatic schedule updates, and reliable background match alerts need a live public data connection and a push sender. A PWA cannot provide Apple's native Live Activity / Dynamic Island scoreboard.

## Preview on Windows
Open this folder in Terminal and run:

    python -m http.server 8080

Then open http://localhost:8080

## Free hosting with GitHub Pages
1. Create a free GitHub account.
2. Create a PUBLIC repository called `padel-live`.
3. Upload every file and folder from this project.
4. Open Settings > Pages.
5. Under Build and deployment choose Deploy from a branch.
6. Select `main` and `/ (root)`, then Save.
7. GitHub will give you a free HTTPS address.

Do not put passwords, private tokens, or secret API keys in a public repository.

## Install on iPhone
1. Open the GitHub Pages address in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Tap Add.
5. Open Padel Live from the new icon.

## Notifications
Install the app to the iPhone Home Screen first. Then use Following > Match alerts or Settings > Test notification. The current build can request permission and send a test notification. Reliable alerts while fully closed are a later push-service step.

## Current snapshot
Rankings are from the official FIP ranking dated 07 Sep 2026. Paris Major semi-final schedule reflects official information available 12 Sep 2026.
