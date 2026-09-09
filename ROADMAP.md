# Bite Book — Product Roadmap

A living record of what's shipped, what's on hold, and what's proposed but not yet planned — kept in sync as work happens, so there's always one place that answers "did we build that, and when." Maintained by Claude alongside the code; update it in the same session as any feature that ships, gets paused, or gets newly proposed. See `VISION.md` for the why behind this list, and `FEATURES.md` for what each shipped item actually does today.

## How to read this

- **Version** = a deploy batch to Netlify (the `multiuser-edition` branch), not a formal semver release — numbered in the order they actually shipped.
- **Status:** ✅ Shipped · 🚧 Built, not yet deployed · ⏸️ On hold (deliberately paused) · 💡 Proposed (discussed, not planned) · ❓ Needs a decision before it can be planned
- Each shipped/built item links back to its commit(s) for traceability.

## Database migrations — what exists, and what has been run

Every one of these is run by hand in the Supabase SQL editor; nothing runs them automatically, so this is the only record of which are done. Keep it current — the cost of getting it wrong is a page that looks broken for reasons nothing in the code explains.

| File | What it does | Run? |
|---|---|---|
| `supabase/schema.sql` | Profiles, entries, shares, invites, trips stub, RLS | ✅ |
| `002_ranking_and_photos.sql` | Ranking order, `eat_again_frequency`, the private photos bucket | ✅ |
| `003_duplicate_detection.sql` | `entry_signatures` view, notifications, cross-user duplicate reporting | ✅ |
| `004_trips.sql` | Links entries to a trip | ✅ |
| `005_events.sql` | The analytics `events` table | ✅ |
| `006_admin_insights.sql` | `admins` table + six aggregate-only reporting functions | ✅ 2026-09-09 |
| `007_count_trip_shares.sql` | Replaces `admin_funnel()` so trip shares count as shares | ❌ **not yet run** |

A note for whoever runs the next one: the SQL editor reports **"0 rows"** after a successful `insert`, because an insert returns no rows. That is not a failure. Check the table itself, not the row count.

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

### v2.4 — Batch 1 of the "simplest first" run — built 2026-09-09, **committed but not yet pushed**
Ordered cheapest-to-build first, deliberately. The gender/ethnicity profile fields that headed the list were **dropped, not deferred**: nothing in the app reads them, so collecting sensitive personal data would have added a privacy obligation with no product behind it.
- **Trip Story sharing** — a whole trip as one shareable card (adaptive 1–4 photo collage, date range, meal/place counts, top cuisine, best bite). The entry and trip cards now share one module, `js/share-card.js`; `js/entry-view.js` lost its private copy of that canvas code
- **Occasion reminders** — birthdays and anniversaries already on the Profile page, surfaced up to 14 days ahead with "here's what you ate for it last time", dismissible per occasion (`js/occasions.js`). This is the feasible half of the Notifications item below; real push still needs Web Push and a scheduler, which do not exist
- **Logging streaks** — consecutive days with a logged meal, food-named milestones, one-off milestone toast (`js/streak.js`). **See the note under "On hold" — this narrows the gamification hold on purpose**
- **Admin Insights** — `insights.html`, `js/insights.js` and migration `006_admin_insights.sql`: an `admins` table (deliberately *not* a column on `profiles`, which any user could write to) plus six aggregate-only `security definer` functions. Day-7/day-30 return rates, a drop-off funnel, per-person and weekly tables. Turns the `events` data shipped in v2.3 into something anyone actually looks at
- **Icon pass** — `js/icons.js`: 22 drawn outline icons replacing emoji in the header nav, the main action buttons and the empty states. Scoped on purpose to the furniture; emoji inside meal cards, story sections and streak badges stay, because there they are the voice rather than a placeholder

**Database side: done, 2026-09-09.** Migration `006_admin_insights.sql` has been run in the Supabase SQL editor and the owner's row is in `public.admins`. Worth recording for the next person who runs an insert here: the SQL editor reports "0 rows" for a successful `insert`, because an insert returns no rows — it is not a failure signal. Check the table, not the row count.

**One follow-up migration, `007_count_trip_shares.sql` — needs running.** Trip Story sharing logs a `trip_shared` event, but `admin_funnel()` was written before that existed and counted only `entry_shared`, so anyone who shared a whole trip and never a single meal was invisible at exactly the step the funnel measures. 007 replaces that one function; it drops nothing and changes no data, and is safe to run twice. Found during the doc audit, not by the tests — the tests exercised the code, and this was a gap between two pieces of correct code.

**Still to do:** push `multiuser-edition` so Netlify rebuilds. Four commits are unpushed as of writing. Nothing in v2.4 is on the live site until that happens.

**How the code behaves if the migration had NOT been run:** the Insights link never appears and nothing else changes — `js/profile.js` treats a missing `admins` table as "not an admin". Deploy order therefore never mattered.

## On hold

- **Gamification** (points, levels, incentives) — paused explicitly by the user, 2026-09-03. Revisit once there's a concrete answer to "what's the actual incentive" (see Proposed, below). **Narrowed 2026-09-09:** logging streaks with food-named milestones shipped in v2.4, at the user's explicit direction and with the trade-off stated at the time ("not great of a feature to boast about, but it would make things a little more fun"). The hold now covers points, levels and competitive scoring — not a private, self-directed streak. Recorded here rather than left implicit, because the same question decides the Dish Duel below.
- **Invite-by-tag with on-the-fly invite** — the sharing picker already works like a "tag" UI; the new part (inviting someone not yet on Bite Book straight from the share screen) is on hold while the user hand-invites a small beta group and keeps email invites off for now (2026-09-03).
- **Invite-by-email (magic link)** — deliberately disabled on the login page (code kept, just not wired to the UI — see `js/login.js`) in favor of self-signup for the beta round, 2026-09-03. Bring back post-beta.

## Proposed — needs discussion before planning

*Two sources feed this list. The first group came out of a 2026-09-08 VC-style evaluation of Bite Book's path to scale — two things from that conversation are deliberately **not** here, since "target one obsessed group of families first" and "get 10 real families using it for 3 months" are go-to-market moves, not product features, and no code fixes either one. The second group (2026-09-09) was reverse-engineered from two design artefacts that now exist ahead of the product: the family pitch deck `BiteBook_Pitch_002.pptx` and the landing-page mockup `bitebook_site_014.html`, both in `~/Downloads/BiteBook`. Neither is deployed; nothing in either one is in the codebase. See "Where the story runs ahead of the product" below.*

- ❓ **Physical printed yearbook** — auto-compile a year's entries into a print-ready book. The product half (layout/compilation) is a normal feature; the commerce half (payment processing, a print-on-demand vendor, pricing, shipping/reprints) is a separate, much bigger decision that needs to be made explicitly before any code — this is not "add a feature" in the same sense as the rest of this list. **Update 2026-09-09:** the pricing half is now decided and is printed in the family deck — $119 for the yearbook, $189 as a gift with the year included. The commerce and fulfilment half is untouched, and the deck is being shown to people before any of it exists.
- 💡 **Deeper "irreplaceable" mechanics** — On This Day, Trips, and the Rankings collections already lean this direction; a "Year in Review" recap once a family has a full year logged would be a natural, incremental extension rather than a new feature.
- 💡 **Roles (admin / general / power user)** — access-control change, needs the exact admin-visibility boundary and promotion threshold agreed before it's planned. Starting proposal on the table: `profiles.role`, admin sees aggregates only (never another person's private text), power-user promotion at ~30 complete entries or 21 distinct days logged.
- 💡 **Icon/graphic overhaul — remainder.** The targeted pass shipped in v2.4 (header, main buttons, empty states). Still open, and now an actual choice rather than a scope question: whether the ~40 emoji still used inside meal cards, story sections, wizard steps and chip labels should also become drawn icons. The argument for leaving them is in v2.4's note.
- 💡 **Memory Graph** (previously "admin knowledge graph") of a food journey — special days vs. everyday, travel patterns, grouped and linked. The mockup settles the question that was blocking this: it draws a real interactive node graph ("drag any node, click to explore"), scoped to a single trip ("Lake Harmony · Sep 4–7") and shown to the **user**, not to an admin. That is a different and considerably more useful feature than the admin-analytics view originally proposed, and it makes Trips the natural place for it to live. Still needs a data model — what counts as a node (entry, person, place, dish?) and what an edge means — before it can be planned.
- 💡 **Power-user heat map** of eating/drinking patterns — depends on Roles landing first.
- 💡 **Notifications — the half that still needs infrastructure.** The in-app occasion banner shipped in v2.4. What remains genuinely needs things the app does not have: Web Push plus a server-side scheduler for a notification that arrives when Bite Book is *closed*, and location-triggered reminders, which a PWA cannot do at all. Overlaps the native-app item below — push is the honest reason to go native.
- 💡 **Richer "memories"** (Google-Photos-style resurfacing, photo-forward, company/occasion-aware) — an evolution of On This Day rather than a new feature from scratch.
- 💡 **Landing page / retention redesign** — "why would they come back". No longer an abstract intention: `bitebook_site_014.html` (2026-09-08) is a complete, self-contained redesign of `index.html`, roughly three times the current page. Beyond a visual refresh it introduces four things the app does not have — a header search box, the Dish Duel, the "Want to Try" wishlist, and the Memory Graph (each listed separately below). Shipping the page as drawn would therefore mean either building those four first, or cutting them from the page. Deciding which is the actual open question here.
- 💡 **Location-based restaurant recommendations from other users' data** — the most ambitious item on the list; a real recommendation-engine feature (taste-similarity across users + live location matching), treated as a later-phase idea.
- ~~**Gender/ethnicity as optional profile fields**~~ — **dropped 2026-09-09.** No feature reads them and no report groups by them, so the only certain outcome was a privacy obligation and one more field on the profile page. Revisit if and when something actually needs them.

### From the pitch deck and landing-page mockup — added 2026-09-09

*Everything in this group is currently a picture. None of it exists in the codebase; `grep` across the repo returns nothing for any of it.*

- ❓ **Family Dish Duel** — two dishes head to head, the family votes, and the result is weighted by who cooked it and who was there ("Family picked Butter Chicken · 9 of 14 votes"). Needs a decision before it can be planned, and not only a technical one: **this is a voting-and-scoring mechanic, and Gamification is explicitly on hold.** Either the hold is narrower than it reads, or this item is inside it. Worth resolving deliberately rather than letting a mockup quietly overturn a decision that was made on purpose.
- 💡 **Smarter "Want to Try"** — a wishlist that keeps *who recommended a place and why* alongside the place itself, nudges you when a trip to that area is being planned, and pre-fills the entry the moment you actually go. The wishlist half is a small feature; the "nudges you when the family plans a trip" half needs Trips to know about future dates, which today it does not — a trip is a container for meals already eaten.
- 💡 **Search across meals, people and places** from the header, on every page. My Entries already has live search over entries; this is a wider index (people and places as first-class results) surfaced globally rather than on one page.
- 💡 **Restaurant menu lookup** — pull a restaurant's real menu from the web so an entry uses the restaurant's own dish name, description and, where published, recipe, instead of a paraphrase. Called out as a near-term item on the deck.
- 💡 **Reservation agent** — say where and when; it books the table, puts it on your calendar, and half-writes the entry in advance. The largest single item anywhere on this roadmap: it needs a booking integration, calendar write access, and an agent loop, none of which the app has any foundation for today.
- 💡 **Tiered recommendations** — "where should we eat?" answered from your own circle first, then from other Bite Book users, then from the open web with an explicit caveat that the answer came from the web. This is the specific shape of the "location-based restaurant recommendations" item above, and the two should be merged when either is planned.
- 💡 **Native mobile app with push notifications** — "a real app on your phone, so it can tap you on the shoulder." Overlaps the Notifications item above: the honest reason to go native is push, which a PWA cannot do reliably on iOS.
- 💡 **Your food life, drawn out** — everyday meals plotted against special occasions across years, in one view. A more ambitious sibling of the power-user heat map, and it becomes possible only once a family has a genuine multi-year history.
- ❓ **Pricing and packaging** — now written down in the deck: Free forever for one person; $12.99/month or $99/year for up to 8 people; Yearbook $119; Yearbook as a gift $189. No billing, no plan enforcement, and no seat limit exists in the code — every account today has everything. Nothing here is a feature request yet; it is recorded so the number in the deck and the number in the product don't drift apart unnoticed.

## Where the story runs ahead of the product

Kept deliberately, because both artefacts are about to be shown to real people who will then open the app.

- The deck's "What's coming next" slide lists **voice capture** and **share straight to Instagram** as upcoming. Both shipped in v2.3 on 2026-09-07 — the voice button is live in Smart Entry, and the share action already hands the card to the OS share sheet, which is how it reaches Instagram. The deck undersells what is actually finished.
- The mockup shows **four features that do not exist**: header search, Dish Duel, Want to Try, and the Memory Graph. Anyone who reads the page and then signs up will go looking for them. The page's own line — "this is just the beginning, new pages are coming soon" — softens it but does not cover a screenshot of a vote tally that has never been cast.
- Neither artefact is deployed. `index.html` in this repo is still the older, shorter landing page.
