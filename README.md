# Dishdex

A shared "Pokédex" of every dish two people know how to cook. Log a dish with a photo, servings, hot or cold, ingredients and a rough method, and tag who can make it. Both phones see the same dex.

Every ten dishes unlocks a medal and a new tier — Stone → Bronze (10) → Silver (20) → Gold (30) → Platinum (40) → Diamond (50) — collected with a little ceremony on each phone.

It's an installable web app (PWA). One codebase runs on Android and iPhone and installs to the home screen like a normal app.

## How sync works

There's no Dishdex server. The two phones sync through a **private GitHub repo you own**:

```
recipes/<id>.json     one file per dish (with a small inline thumbnail)
photos/<id>-<rev>.jpg the full photo, compressed on the phone (~1600px)
profiles.json         the two people (name, emoji, colour)
```

- Each phone keeps a full copy in IndexedDB, so the app opens instantly and works offline. Changes queue up and sync when back online.
- Edits are stored as small operations and replayed onto the latest copy from GitHub, so both phones can edit the same dish without losing each other's changes. "Who can cook it" is merged as a set.
- The app checks for changes when it opens, every 10 seconds while it's open (conditional requests, so idle checks are free against the rate limit), and on pull-to-refresh. A new phone fetches every dish in one GraphQL request.
- Every change is a commit, so the repo history doubles as an undo log and backup.

The access key is a fine-grained GitHub token limited to that one repo (Contents: read and write). It stays on the phones and is only ever sent to `api.github.com`. There are no analytics and no third-party scripts, and the fonts are bundled.

## Setup

1. **Data repo.** A private repo, for example `you/dishdex-data`. The repo variable `DISHDEX_DATA_REPO` pre-fills it in the app.
2. **First device.** Open the app and tap *Start our Dishdex*, then *Open GitHub*. The token form opens pre-filled: Contents read and write, no expiry. Choose *Only select repositories* → the data repo, then generate the token and paste it. A computer is easiest for this step.
3. **Every other phone.** Go to Settings → *Add a phone* and pick who it's for. Scan the QR code with that phone's camera, or send the link.
   - **Android (Chrome):** it joins straight away; tap *Install*. The installed app shares Chrome's storage.
   - **iPhone (Safari):** a guide shows how to *Add to Home Screen*. Home Screen apps on iOS start with empty storage. Safari copies its cookies across when the app is added (iOS 17.2+), so the invite rides along in a short-lived cookie and the installed app signs itself in. *Paste invite* is the fallback.

If GitHub ever stops accepting a key, the app pauses sync, says so, and offers *Reconnect*. Paste a fresh invite or key there; nothing queued is lost.

## Development

```bash
npm install
npm run dev          # http://localhost:5188/dishdex/
npm test             # quantity scaling + merge logic
npm run build
```

In dev, the welcome screen has a **local demo repo** button that fakes GitHub in `localStorage`. Add `?device=a` / `?device=b` to the URL to get two independent "phones" in two tabs, and `&standalone` to act as an installed app (for testing the iPhone invite handoff). Run `dishdexSeed()` in the console to add sample dishes, or open `?device=x&demo=23` for a pre-seeded dex (`&collected=20` skips the medal ceremonies).

`DISHDEX_IT_REPO=owner/repo GH_TOKEN=… npx vitest run github.integration` runs the sync layer against a real repo.

Pushing to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`). The repo variable `DISHDEX_DATA_REPO` pre-fills the repo field on the connect screen.

## Where it could go next

- **App-store builds.** Wrap the same code with Capacitor for a real Android APK or Play listing. iOS needs an Apple Developer account ($99/yr) for TestFlight or the App Store.
- **Push notifications** when the other person logs a dish. Web Push works in installed PWAs on iOS 16.4+ and Android, but it needs a small relay (for example a Cloudflare Worker).
- **"Import from a link":** paste a recipe URL and pre-fill the rough recipe.
- **Shopping list:** tick dishes for the week and merge their ingredients.
- **More than two people:** the data model already supports n people; only the UI assumes a duo.
