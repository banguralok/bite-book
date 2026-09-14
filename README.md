# Bite Book

A personal food-journaling app for a family and their close circle: capture meals as memories — the dish, the place, who was there, why it mattered — then browse, share, rank, and reflect on everything logged over time.

Private beta. Not published anywhere public yet — see [Status](#status) below.

## What this actually is

- **The web app** — plain HTML/CSS/vanilla JS, deliberately no build step, no framework, no bundler. Every page is a real `.html` file; every script is a plain `<script>` tag.
- **The backend** — [Supabase](https://supabase.com) (Postgres, Auth, Storage, one Edge Function for AI calls). Privacy is enforced at the database layer with Row Level Security, not just in app code — an entry is visible only to its owner, or to someone it's been explicitly shared with.
- **The native mobile app** — an in-progress Android build (iOS to follow), wrapping this exact same web app in a native shell via [Capacitor](https://capacitorjs.com) rather than a separate rewrite. See [Mobile app](#mobile-app) below.

For what the app can actually do today, see **[FEATURES.md](FEATURES.md)**. For what shipped when, what's on hold, and what's proposed but not built, see **[ROADMAP.md](ROADMAP.md)**. For the why behind the what, see **[VISION.md](VISION.md)**.

## Status

Deployed to Netlify from the `multiuser-edition` branch, shown only to people the owner knows personally. Not on the App Store, Play Store, or any public listing — see `ROADMAP.md`'s "Legal and compliance gaps" and "Naming" sections for what's deliberately deferred until that changes, and `VISION.md` for why a real published app is the actual destination.

The original single-user, `localStorage`-only version is preserved on the `main` branch as a fallback; everything above describes `multiuser-edition`, which is where all current work happens.

## Running it locally

No build step, no `npm install` needed for the website itself — it's just static files.

```bash
python3 scripts/dev-server.py            # the real app, talking to Supabase
python3 scripts/dev-server.py 5173 --demo  # seeded demo data, no network — see dev/seed.js
```

You'll need your own Supabase project's URL and anon key filled into `js/supabase-config.js`, and the migrations in `supabase/` run in order (see the table in `ROADMAP.md` for which ones already have been, for the project this was built against).

## Mobile app

The `android/` directory (Capacitor-generated) wraps the same web app as a real native Android project — no separate codebase, no rewrite. It needs Node for the wrapper tooling only, not for the website:

```bash
npm install
npx cap sync android
npx cap run android          # requires Android Studio + SDK installed, and a connected device/emulator
```

`capacitor.config.json` controls where the app loads its content from. During development this pointed at a local dev server via live-reload; the deployed app points `server.url` at the real Netlify site instead, so it works standalone without a laptop in the loop. iOS support (`ios/`) follows the same pattern once Android reaches a shareable state — see `ROADMAP.md`'s "In progress" section for exactly where this stands.

## Project layout

```
*.html, js/*.js       the web app (no build step — edit and reload)
css/style.css         all styling; color/design tokens as CSS custom properties
supabase/             schema.sql + numbered migrations, run by hand in the Supabase SQL editor
supabase/functions/   one Edge Function (Gemini AI proxy)
dev/                  seeded demo-data harness for local development only, never deployed
scripts/dev-server.py the local dev server (plain Python, no dependencies)
android/              Capacitor-generated native Android project
www/                  placeholder web root for the native build (the real content loads from a URL, see above)
```

## Documentation

- **[FEATURES.md](FEATURES.md)** — what the app can do, and how each part works, page by page. Nothing in it is aspirational; if a mockup or pitch deck shows something not in here, it doesn't exist yet.
- **[ROADMAP.md](ROADMAP.md)** — what shipped in which batch, what's on hold and why, what's proposed but not planned, and the running list of database migrations and whether each has actually been run.
- **[VISION.md](VISION.md)** — the product's reason for existing, short enough to actually re-read.
