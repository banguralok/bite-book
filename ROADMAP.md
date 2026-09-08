# Bite Book — Product Roadmap

A living record of what's shipped, what's on hold, and what's proposed but not yet planned — kept in sync as work happens, so there's always one place that answers "did we build that, and when." Maintained by Claude alongside the code; update it in the same session as any feature that ships, gets paused, or gets newly proposed. See `VISION.md` for the why behind this list, and `FEATURES.md` for what each shipped item actually does today.

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

### v2.2 — deployed 2026-09-03
- **Logo & app icon**: real logo replacing the 🍜 emoji placeholder across favicon, PWA icons, and the header (`72d1aa8`)
- **Roadmap**: this document (`88ea599`)
- **Bug fixes**: AI proxy CORS + real error surfacing, logo flash-redirect, Ask Your Journal shared-entry attribution (`c8421e4`)
- **Self-signup**: password-based account creation replaces invite-by-email on the login page for the beta round (`eb44f9a`) — confirmed working end-to-end once "Confirm email" was turned off in Supabase Auth settings
- **FEATURES.md and VISION.md**: brought FEATURES.md up to date with the whole multi-user pivot (it had been stale since before it started); added VISION.md as a living statement of what Bite Book is for, to be refined alongside the roadmap
- **Netlify credit cleanup**: removed a 1.2MB unreferenced logo-master file from the deployed site, added `robots.txt` (`181b3ae`) — turned out not to be the real cost driver (Netlify bills a flat rate per deploy, not by size or bandwidth), but still real dead weight worth removing

### v2.3 — deployed 2026-09-07
Built in a different session (Claude Opus 5) and reviewed/verified here before pushing. `dd54f8c`.
- **Landing-page gating fix**: signed-in visitors were being bounced off `index.html` on *every* visit, not just when arriving from an actual invite/magic-link — it now only redirects on a genuine auth callback, and otherwise retargets the page's calls-to-action at the journal
- **Header now branches on real session state**, not on whether a page happens to be gated — a logged-out visitor on the public landing page now sees a plain "Sign in / Get Started" nav instead of the full app nav (which only ever bounced them to a login wall)
- **Native share sheet**: sharing an entry now hands the card straight to the OS share sheet (Instagram, WhatsApp, Messages) where supported, falling back to download — with a fix for the case where a private-storage photo taints the canvas
- **Voice capture for Smart Entry**: dictate instead of type, where the browser supports the Web Speech API (feature-detected; hidden on browsers without it, notably iOS Safari, which has its own mic key). Feeds the same text box the existing AI-parse flow already used — not a second entry path
- **Beta usage analytics**: a minimal `events` table + `js/track.js` (session starts, page views, entry creation — never entry content, RLS-scoped to insert/read-your-own) plus `supabase/analytics.sql` with scorecard queries. First real infrastructure for answering "are people actually coming back," see Proposed below
- **Security fix**: `supabase/` (schema + every migration) was publicly fetchable because Netlify serves the whole repo root — blocked via `_redirects`

## On hold

- **Gamification** (points, levels, incentives) — paused explicitly by the user, 2026-09-03. Revisit once there's a concrete answer to "what's the actual incentive" (see Proposed, below).
- **Invite-by-tag with on-the-fly invite** — the sharing picker already works like a "tag" UI; the new part (inviting someone not yet on Bite Book straight from the share screen) is on hold while the user hand-invites a small beta group and keeps email invites off for now (2026-09-03).
- **Invite-by-email (magic link)** — deliberately disabled on the login page (code kept, just not wired to the UI — see `js/login.js`) in favor of self-signup for the beta round, 2026-09-03. Bring back post-beta.

## Proposed — needs discussion before planning

*The four items below came out of a 2026-09-08 VC-style evaluation of Bite Book's path to scale. Two things from that same conversation are deliberately **not** here: "target one obsessed group of families first" and "get 10 real families using it for 3 months" are go-to-market moves, not product features — no code fixes either one.*

- 💡 **Trip Story sharing** — a shareable image/card for a whole trip (photo collage + place/date range + highlights), the same way a single entry already shares. Directly extends `shareEntryAsImage()` and the native share sheet shipped in v2.3 — no new mechanism needed, just a trip-level version of one that already works. Likely the next thing built, given how directly it serves "every share is a recruiting moment."
- 💡 **Retention/analytics view** — v2.3's `events` table has the raw data (session starts, page views, entry creation) but nowhere to look at it. A simple view (day-7/day-30 return rate, a drop-off funnel by page) would turn that into the actual evidence a "people come back for months, not days" claim needs.
- ❓ **Physical printed yearbook** — auto-compile a year's entries into a print-ready book. The product half (layout/compilation) is a normal feature; the commerce half (payment processing, a print-on-demand vendor, pricing, shipping/reprints) is a separate, much bigger decision that needs to be made explicitly before any code — this is not "add a feature" in the same sense as the rest of this list.
- 💡 **Deeper "irreplaceable" mechanics** — On This Day, Trips, and the Rankings collections already lean this direction; a "Year in Review" recap once a family has a full year logged would be a natural, incremental extension rather than a new feature.
- 💡 **Roles (admin / general / power user)** — access-control change, needs the exact admin-visibility boundary and promotion threshold agreed before it's planned. Starting proposal on the table: `profiles.role`, admin sees aggregates only (never another person's private text), power-user promotion at ~30 complete entries or 21 distinct days logged.
- 💡 **Icon/graphic overhaul** — emoji icons read as generic next to the new logo. Scope decision needed: full custom icon set vs. a targeted pass on the highest-visibility spots.
- 💡 **Admin knowledge graph** of users' food journeys (special days vs. everyday, travel patterns, grouped/linked) — needs a decision on what "see it" actually means (a page of grouped insights vs. an actual graph visualization) before a data model can be designed.
- 💡 **Power-user heat map** of eating/drinking patterns — depends on Roles landing first.
- 💡 **Notifications — occasion reminders & location-based** — partly feasible now (an in-app "last time on this date" banner, extending On This Day), partly needs infrastructure that doesn't exist (Web Push + a server scheduler for true push; background geolocation isn't realistically available to a PWA at all).
- 💡 **Richer "memories"** (Google-Photos-style resurfacing, photo-forward, company/occasion-aware) — an evolution of On This Day rather than a new feature from scratch.
- 💡 **Landing page / retention redesign** — "why would they come back" — the user has separately flagged wanting to redo the current landing page.
- 💡 **Location-based restaurant recommendations from other users' data** — the most ambitious item on the list; a real recommendation-engine feature (taste-similarity across users + live location matching), treated as a later-phase idea.
- ❓ **Gender/ethnicity as optional profile fields** — small, just needs a green light.
