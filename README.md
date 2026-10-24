# Dishdex

A shared "Pokédex" of every dish two people know how to cook. Log a dish with a photo, servings, ingredients and a rough method; tag who can make it; send it to your partner's "to learn" list. Both phones see the same dex.

It's an installable web app (PWA). One codebase runs on Android and iPhone and installs to the home screen like a normal app.

## How sync works

There's no Dishdex server. The two phones sync through a **private GitHub repo you own**:

```
recipes/<id>.json     one file per dish (with a small inline thumbnail)
photos/<id>-<rev>.jpg the full photo, compressed on the phone (~1600px)
profiles.json         the two people (name, emoji, colour)
```

- Each phone keeps a full copy in IndexedDB, so the app opens instantly and works offline. Changes queue up and sync when back online.
- Edits are stored as small operations and replayed onto the latest copy from GitHub, so both phones can edit the same dish without losing each other's changes. "Who can cook it" and "to learn" are merged as sets.
- The app checks for changes when it opens, every 20 seconds while it's open, and on pull-to-refresh.
- Every change is a commit, so the repo history doubles as an undo log and backup.

The access key is a fine-grained GitHub token limited to that one repo (Contents: read and write). It stays on the phones and is only ever sent to `api.github.com`. There are no analytics and no third-party scripts, and the fonts are bundled.

## Setup

1. **Data repo.** Create a private repo, for example `you/dishdex-data`.
2. **Access key.** On the connect screen, tap *Create a key on GitHub*. It opens GitHub's token form pre-filled; choose *Only select repositories*, pick the data repo, and set *Contents* to *Read and write*.
3. **First phone.** Open the app, tap *Start our Dishdex*, then paste the repo name and key. Set up both people and install the app:
   - **Android (Chrome):** tap *Install* in the app's banner, or use ⋮ → *Install app*.
   - **iPhone (Safari):** tap Share → *Add to Home Screen*.
4. **Second phone.** Go to Settings → *Invite …* and share the link. Opening it on the other phone connects it as the second person. On iPhone, add the app to the Home Screen afterwards; if the installed app asks, choose *I have an invite* and paste the message again (iOS keeps home-screen app storage separate from Safari's).

## Development

```bash
npm install
npm run dev          # http://localhost:5188/dishdex/
npm test             # quantity scaling + merge logic
npm run build
```

In dev, the welcome screen has a **local demo repo** button that fakes GitHub in `localStorage`. Add `?device=a` / `?device=b` to the URL to get two independent "phones" in two tabs. Run `dishdexSeed()` in the console to add sample dishes.

Pushing to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`). The repo variable `DISHDEX_DATA_REPO` pre-fills the repo field on the connect screen.

## Where it could go next

- **App-store builds.** Wrap the same code with Capacitor for a real Android APK or Play listing. iOS needs an Apple Developer account ($99/yr) for TestFlight or the App Store.
- **Push notifications** when a dish is sent to you. Web Push works in installed PWAs on iOS 16.4+ and Android, but it needs a small relay (for example a Cloudflare Worker).
- **"Import from a link":** paste a recipe URL and pre-fill the rough recipe.
- **Shopping list:** tick dishes for the week and merge their ingredients.
- **More than two people:** the data model already supports n people; only the UI assumes a duo.
