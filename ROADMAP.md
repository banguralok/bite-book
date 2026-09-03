# Bite Book — Product Roadmap

A living record of what's shipped, what's on hold, and what's proposed but not yet planned — kept in sync as work happens, so there's always one place that answers "did we build that, and when." Maintained by Claude alongside the code; update it in the same session as any feature that ships, gets paused, or gets newly proposed.

## How to read this

- **Version** = a deploy batch to Netlify (the `multiuser-edition` branch), not a formal semver release — numbered in the order they actually shipped.
- **Status:** ✅ Shipped · 🚧 Built, not yet deployed · ⏸️ On hold (deliberately paused) · 💡 Proposed (discussed, not planned) · ❓ Needs a decision before it can be planned
- Each shipped/built item links back to its commit(s) for traceability.

## Version history

### v1.0 — Local Edition (`main` branch, pre-pivot)
Single-user, `localStorage`-only static site. Superseded by the multi-user pivot below but kept on `main` as a fallback. See `FEATURES.md` for the full feature list as of this version.

### v2.0 — Multi-User Foundation — deployed 2026-09-02
The pivot from local-only to a real backend. `f83b9fc`..`3f64143`.
- Supabase-backed auth: invite-only signup, password + magic-link sign-in, page gating
- Profile synced to Supabase (`f83b9fc`, `2177874`)
- Entries and photos/videos migrated to Supabase + Storage (`e0d9eab`)
- HEIC photo upload support, incl. libheif-format-limit guidance (`a773ab7`..`fb7cf34`)
- Step navigator — jump to any wizard step directly instead of clicking through all 9 (`3f64143`)

### v2.1 — Family Features — deployed 2026-09-03 ("deploy all")
`59daa66`..`ae22379`.
- **Sharing**: pick people from your circle to share an entry with (`59daa66`)
- **Rankings → collections**: Hall of Fame, Most Loved, Family Favorites, Places Worth Returning To, Taste Evolution, replacing manual-only ranking as the primary view (`64e8106`)
- **Stats → "Your Food Story"**: narrative observations above the existing tiles/bars (`64e8106`)
- **Clean Up Places → automatic**: free client-side heuristic + dismissible banner, AI check now opt-in (`64e8106`)
- **Cross-user duplicate detection**: catches two people logging the same real-world meal, with a notifications inbox to resolve it (`95415c7`)
- **AI proxy**: Gemini calls moved behind a Supabase Edge Function with one shared key, so invited users don't need their own (`2ecd9d2`)
- **Landing page**: before/after "scrapbook card" section (`75653f7`)
- **Smart Entry as the default** entry path everywhere; full wizard demoted to a fallback link (`197ccaf`)
- **On This Day**: resurfaces a past entry matching today's date from a prior year (`197ccaf`)
- **Trips**: group entries into their own story, with a small stats strip (`ed224e2`)
- **Smart Entry photo-first**: GPS location tagging + an inline confirm-or-fine-tune card instead of always routing through the full wizard (`ae22379`)

### v2.2 — in progress, not yet deployed
- **Logo & app icon**: real logo replacing the 🍜 emoji placeholder across favicon, PWA icons, and the header (`72d1aa8`)
- **Roadmap**: this document (`88ea599`)
- **Bug fixes**: AI proxy CORS + real error surfacing, logo flash-redirect, Ask Your Journal shared-entry attribution (`c8421e4`)
- **Self-signup**: password-based account creation replaces invite-by-email on the login page for the beta round (`eb44f9a`) — ⚠️ blocked from being truly email-independent until "Confirm email" is turned off in Supabase Auth settings; see On Hold below

## On hold

- **Gamification** (points, levels, incentives) — paused explicitly by the user, 2026-09-03. Revisit once there's a concrete answer to "what's the actual incentive" (see Proposed, below).
- **Invite-by-tag with on-the-fly invite** — the sharing picker already works like a "tag" UI; the new part (inviting someone not yet on Bite Book straight from the share screen) is on hold while the user hand-invites a small beta group and keeps email invites off for now (2026-09-03).
- **Invite-by-email (magic link)** — deliberately disabled on the login page (code kept, just not wired to the UI — see `js/login.js`) in favor of self-signup for the beta round, 2026-09-03. Bring back post-beta.
- **Bulk test-user + demo data seeding** — requested 2026-09-03 (a test family, friends, colleagues, and a few international users, all password-based, then entries spanning the app's functionality). Blocked: confirmed live that Supabase currently requires email confirmation on signup, so creating ~15 accounts right now would hit the exact same email rate limit this was meant to avoid. Needs "Confirm email" turned off in Supabase Dashboard → Authentication → Sign In / Up → Email before this can proceed.

## Proposed — needs discussion before planning

- 💡 **Roles (admin / general / power user)** — access-control change, needs the exact admin-visibility boundary and promotion threshold agreed before it's planned. Starting proposal on the table: `profiles.role`, admin sees aggregates only (never another person's private text), power-user promotion at ~30 complete entries or 21 distinct days logged.
- 💡 **Icon/graphic overhaul** — emoji icons read as generic next to the new logo. Scope decision needed: full custom icon set vs. a targeted pass on the highest-visibility spots.
- 💡 **Admin knowledge graph** of users' food journeys (special days vs. everyday, travel patterns, grouped/linked) — needs a decision on what "see it" actually means (a page of grouped insights vs. an actual graph visualization) before a data model can be designed.
- 💡 **Power-user heat map** of eating/drinking patterns — depends on Roles landing first.
- 💡 **Notifications — occasion reminders & location-based** — partly feasible now (an in-app "last time on this date" banner, extending On This Day), partly needs infrastructure that doesn't exist (Web Push + a server scheduler for true push; background geolocation isn't realistically available to a PWA at all).
- 💡 **Richer "memories"** (Google-Photos-style resurfacing, photo-forward, company/occasion-aware) — an evolution of On This Day rather than a new feature from scratch.
- 💡 **Landing page / retention redesign** — "why would they come back" — the user has separately flagged wanting to redo the current landing page.
- 💡 **Location-based restaurant recommendations from other users' data** — the most ambitious item on the list; a real recommendation-engine feature (taste-similarity across users + live location matching), treated as a later-phase idea.
- ❓ **Gender/ethnicity as optional profile fields** — small, just needs a green light.
