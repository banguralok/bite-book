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
| `007_count_trip_shares.sql` | Replaces `admin_funnel()` so trip shares count as shares | ✅ 2026-09-09 |
| `008_wishlist.sql` | The "Want to Try" table | ✅ 2026-09-09 |
| `009_roles.sql` | `user_roles` table, `bb_my_access()`, admin role controls | ✅ 2026-09-09 |
| `010_menu_and_patterns.sql` | Menu provenance columns; `drinks`, `city`, `country` | ✅ 2026-09-10 |
| `011_recommendations.sql` | `place_reputation` view (3-household floor), `bb_recommend_places()`, `wishlist.city` | ❌ **not yet run** |

A note for whoever runs the next one: **the SQL editor reports "0 rows" for almost everything in this list, and that is success, not failure.** An `insert` returns no rows; so does `create table`, `create function` and `create policy`. A real failure shows up as a red error message, not a row count. To confirm a table actually exists, list them:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```

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

**Follow-up migration `007_count_trip_shares.sql` — run 2026-09-09.** Trip Story sharing logs a `trip_shared` event, but `admin_funnel()` was written before that existed and counted only `entry_shared`, so anyone who shared a whole trip and never a single meal was invisible at exactly the step the funnel measures. 007 replaces that one function; it drops nothing and changes no data, and is safe to run twice. Found during the doc audit, not by the tests — the tests exercised the code, and this was a gap between two pieces of correct code.

**Still to do:** push `multiuser-edition` so Netlify rebuilds. Four commits are unpushed as of writing. Nothing in v2.4 is on the live site until that happens.

**How the code behaves if the migration had NOT been run:** the Insights link never appears and nothing else changes — `js/profile.js` treats a missing `admins` table as "not an admin". Deploy order therefore never mattered.

### v2.5 — Batch 2 of the "simplest first" run — built 2026-09-09, **committed but not yet pushed**
- **Year in Review** — `year.html`, `js/year-review.js`. A calendar-year recap: six tiles plus highlight cards that each appear only if the data supports them, a photo strip, and a share card. **Surfacing was the real decision here** — it appears on its own only between 15 December and 31 January, chosen over a rolling twelve months because a year should feel like a moment. The page stays openable any time at `year.html?year=NNNN`, which is not a hedge against that decision but the thing that makes it testable and demonstrable in September rather than three months of nothing
- **Header search** — `js/search.js`. Meals, people and places, from every page. The part that did not exist before is people and places as results in their own right: clicking a person shows every meal they were at. Backed by `?person=` / `?place=` filters on My Entries with a clearable pill. The index is built on first keystroke, never on page load — a search box on every page must not mean a query on every page
- **Want to Try** — `wishlist.html`, `js/wishlist.js`, migration `008_wishlist.sql`. Places and dishes, kept with who recommended them and why. Marking one tried creates a linked draft entry rather than deleting the row, so the list keeps the evidence that a recommendation paid off

**Two of the four mockup gaps are now closed.** `bitebook_site_014.html` drew a header search box and a "Want to Try" wishlist that did not exist; both now do. Still drawn but not built: the **Family Dish Duel** and the **Memory Graph**. Anyone shown that page will still go looking for those two.

### v2.6 — Plans and roles — built 2026-09-09, **committed but not yet pushed**
`user_roles`, `bb_my_access()`, `admin_list_roles()`, `admin_set_role()` (migration `009_roles.sql`), `js/roles.js`, a plan strip on Profile and a plan table on Insights.

**The definition changed, and that matters.** The original proposal made Power User something you *earn* (~30 entries logged). The user's decision on 2026-09-09 makes it something you *buy*: General = free, Power = paid, Admin = the owner. That turns this from an access-control feature into the front half of the pricing item — which is why the boundary had to be settled before any code.

**The boundary**, chosen to match the pricing already printed in the deck so the product and the pricing page agree: free is a solo journal — logging, browsing, search, stats, trips, rankings, Year in Review, all of it, forever. Paid is *other people*: sharing a meal, family members, the circle, up to 8 seats. The journal itself is never paywalled.

**Enforcement is off, deliberately.** `js/roles.js` holds one flag, currently false, and every `can()` returns true. The reason is not caution: gating a beta group of relatives would degrade the app for exactly the people whose honest feedback is worth more than their $12.99. The flag is a variable with a setter rather than a constant, because an inactive code path is where bugs hide — `BiteBookRoles.setEnforce(true)` in the console shows the free experience, and the tests exercise both states rather than only the one that ships.

**Still absent: any billing whatsoever.** Nobody can pay. An admin marks someone Power by hand from the Insights page. Until that changes, "paid" means "the owner clicked a dropdown", and the roadmap should not pretend otherwise.

### v2.7 — Menu lookup and Your Patterns — built 2026-09-10, **committed but not yet pushed**
`js/menu-lookup.js`, grounded search in `js/ai.js`, `patterns.html` + `js/patterns.js`, migration `010_menu_and_patterns.sql`.

**Menu lookup.** The requirement was to read the restaurant's *actual* menu and match it to the photo or the description, then let the person pick exactly one. The risk that shaped the build: there is no menu database, so this can only be an AI reading the web, and an ungrounded model asked what is on a menu will invent dishes with total confidence. In a memory app an invented dish name is worse than the paraphrase it replaces — it becomes a permanent family record that nobody can tell is false. Three things answer that: Google Search grounding, so every candidate traces to a real page; those pages listed under the options; and `food_source='menu'` on the entry, so the archive itself knows which names came off the web. Nothing is auto-filled — the options are radio inputs, and typing over a chosen name clears the provenance because the words are the person's again.

**Your Patterns.** All three of the offered options, merged as asked, plus the drinks field the "ate/drank" framing needed and which nothing recorded before. Seven charts behind three tabs, one filter row scoping all of them.

**The suggestion asked for, and what it changed:** every mark links through to the meals behind it. That is the difference between a report *about* the archive and a way *into* it, and it is the one thing here that serves `VISION.md`'s test — that someone opens Bite Book to remember rather than to maintain a list. The charts are the index; the meals are the point.

Colour was computed, not chosen: one orange ramp for magnitude (validated for monotone lightness, step gaps, and a light end that clears the cream page at 2.11:1), five fixed hues for cuisine identity (worst adjacent pair 14.0 ΔE under protanopia, 16.5 under normal vision), a grey "Other" past five rather than a sixth hue. Ranked bars are deliberately all one colour — length already carries the comparison.

**Honest limits.** `city` and `country` are only captured for meals logged from here on; older entries fall back to a guess parsed from their saved address, and anything unresolvable is left out rather than invented. `drinks` starts empty for every existing entry, so that chart says so instead of showing zero.

### v2.8 — Ideas, Across the years, and Where should we eat — built 2026-09-11, **committed but not yet pushed**
`js/nudges.js`, the years lens in `js/patterns.js`, `recommend.html` + `js/recommend.js`, migration `011_recommendations.sql`, and a seeded demo harness in `dev/`.

**The seeded harness came first, and it is the reason the rest exists.** These three features need a history a three-week-old beta cannot have: three years, several countries, and enough households logging the same restaurants for an aggregate to mean anything. `dev/seed.js` invents ~1,200 meals across three years, four countries, seven towns, five trips and five households, on a fixed random seed so the dataset is identical every run. It loads only through `scripts/dev-server.py --demo`, which injects it server-side on the way out — so no page in the repo mentions the harness, there is no flag in the shipped app to flip by accident, and `/dev/*` is blocked at the CDN as a second line. Every demo page carries a DEMO DATA banner. **Nothing goes near the real database**: 1,200 invented meals in production would land in the Insights numbers that exist to measure whether real people come back.

**Where should we eat (12).** Three tiers that never blend — your circle, other households in aggregate, then the open web — because those are three different kinds of claim and one ranked list would misprice all of them. The privacy boundary is the three-household floor, enforced in SQL rather than in the browser.

**Ideas for you (8).** Four rules, each with a stated reason, on the Want to Try page as chosen. Shows nothing when nothing fires; a suggestion engine guaranteed to always have something to say is how an app becomes naggy.

**Across the years (9).** A fourth lens on Patterns: year rows by month, everyday against occasions, and a year-by-year table.

**Three bugs this round, and where each was caught — worth recording, because they argue for different kinds of testing:**
1. *Only running the real SQL found it.* `min(place_name)` picked the alphabetically smallest spelling, so one sloppy row logged as `"  saffron "` made a 195-meal restaurant display in lower case with a leading space. Now `mode()` — the most common spelling. A browser test against the JavaScript stand-in would never have seen this; it took a throwaway Postgres, the real migration, and a deliberately messy row.
2. *Only looking at the screen found it.* The circle tier recommended **Home** — your own kitchen, top of the list, because it is the most-visited place in any journal. Every test passed.
3. *Only looking at the screen found it.* Two Ideas cards printed a word-for-word identical reason, because one occasion was being pinned to the top two wishes. De-duplication now covers reasons as well as wishes.

**The SQL was verified by execution, not by reading.** A throwaway Postgres, the real migration file, the seeded rows, plus hand-built edge cases: two households stay hidden, exactly three appear, one household logging five times stays hidden, drafts and unrated meals don't count toward the floor, and the town filter tolerates case and whitespace.

## On hold

- **Gamification** (points, levels, incentives) — paused explicitly by the user, 2026-09-03. Revisit once there's a concrete answer to "what's the actual incentive" (see Proposed, below). **Narrowed 2026-09-09:** logging streaks with food-named milestones shipped in v2.4, at the user's explicit direction and with the trade-off stated at the time ("not great of a feature to boast about, but it would make things a little more fun"). The hold now covers points, levels and competitive scoring — not a private, self-directed streak. Recorded here rather than left implicit, because the same question decides the Dish Duel below.

  **Kept under review, 2026-09-09.** The user's decision: keep streaks for now, revisit once a few real users have given feedback. Worth writing down plainly, because there is a specific tension to watch and it would otherwise be forgotten. `VISION.md` says: *"If the app is only ever opened to add something, it has failed at the thing it's actually for."* A streak rewards opening the app **to add something**. Meanwhile the headline number on the new Insights page is *days someone opened Bite Book and logged nothing* — the measure of exactly what the vision cares about. **The trigger to revisit: if logging goes up while that number goes down, the streak is working against the product, not for it.** Insights is the instrument; the data now exists to settle it rather than argue about it.
- **Invite-by-tag with on-the-fly invite** — the sharing picker already works like a "tag" UI; the new part (inviting someone not yet on Bite Book straight from the share screen) is on hold while the user hand-invites a small beta group and keeps email invites off for now (2026-09-03).
- **Invite-by-email (magic link)** — deliberately disabled on the login page (code kept, just not wired to the UI — see `js/login.js`) in favor of self-signup for the beta round, 2026-09-03. Bring back post-beta.

## Proposed — needs discussion before planning

*Two sources feed this list. The first group came out of a 2026-09-08 VC-style evaluation of Bite Book's path to scale — two things from that conversation are deliberately **not** here, since "target one obsessed group of families first" and "get 10 real families using it for 3 months" are go-to-market moves, not product features, and no code fixes either one. The second group (2026-09-09) was reverse-engineered from two design artefacts that now exist ahead of the product: the family pitch deck `BiteBook_Pitch_002.pptx` and the landing-page mockup `bitebook_site_014.html`, both in `~/Downloads/BiteBook`. Neither is deployed; nothing in either one is in the codebase. See "Where the story runs ahead of the product" below.*

- ❓ **Physical printed yearbook** — auto-compile a year's entries into a print-ready book. The product half (layout/compilation) is a normal feature; the commerce half (payment processing, a print-on-demand vendor, pricing, shipping/reprints) is a separate, much bigger decision that needs to be made explicitly before any code — this is not "add a feature" in the same sense as the rest of this list. **Update 2026-09-09:** the pricing half is now decided and is printed in the family deck — $119 for the yearbook, $189 as a gift with the year included. The commerce and fulfilment half is untouched, and the deck is being shown to people before any of it exists.
- 💡 **Deeper "irreplaceable" mechanics** — the "Year in Review" half of this shipped in v2.5. What remains is the harder half the phrase was really pointing at: an archive that is worth more the longer it runs. That is not one feature, and it will not be built in a batch.
- 💡 **"Want to Try" nudges — the trip half only.** Shipped in v2.8 as "Ideas for you", driven by upcoming occasions, the town you have been eating in, cuisine rhythm and how long a wish has waited. What is still not possible: nudging you when a trip to that area is being *planned*, because Trips only holds meals already eaten. That remains a Trips change before it is a wishlist one.
- 💡 **Icon/graphic overhaul — remainder.** The targeted pass shipped in v2.4 (header, main buttons, empty states). Still open, and now an actual choice rather than a scope question: whether the ~40 emoji still used inside meal cards, story sections, wizard steps and chip labels should also become drawn icons. The argument for leaving them is in v2.4's note.
- 💡 **Memory Graph** (previously "admin knowledge graph") of a food journey — special days vs. everyday, travel patterns, grouped and linked. The mockup settles the question that was blocking this: it draws a real interactive node graph ("drag any node, click to explore"), scoped to a single trip ("Lake Harmony · Sep 4–7") and shown to the **user**, not to an admin. That is a different and considerably more useful feature than the admin-analytics view originally proposed, and it makes Trips the natural place for it to live. Still needs a data model — what counts as a node (entry, person, place, dish?) and what an edge means — before it can be planned.
- ~~**Power-user heat map**~~ — **shipped in v2.7** as Your Patterns, and deliberately NOT gated: the paid boundary agreed in v2.6 is sharing and family, not insight into your own food. Left visible to everyone.
- 💡 **Notifications — the half that still needs infrastructure.** The in-app occasion banner shipped in v2.4. What remains genuinely needs things the app does not have: Web Push plus a server-side scheduler for a notification that arrives when Bite Book is *closed*, and location-triggered reminders, which a PWA cannot do at all. Overlaps the native-app item below — push is the honest reason to go native.
- 💡 **Richer "memories"** (Google-Photos-style resurfacing, photo-forward, company/occasion-aware) — an evolution of On This Day rather than a new feature from scratch.
- 💡 **Landing page / retention redesign** — "why would they come back". No longer an abstract intention: `bitebook_site_014.html` (2026-09-08) is a complete, self-contained redesign of `index.html`, roughly three times the current page. Beyond a visual refresh it drew four things the app did not have. **Two now exist** (header search and Want to Try, v2.5). **Two still do not**: the Dish Duel and the Memory Graph. The open question has narrowed usefully — ship the page with those two cut, or build them first. It is no longer a four-feature blocker.
- 💡 **Recommendations — the taste-similarity half.** The three tiers shipped in v2.8. What did not: matching on *taste similarity* ("families who like what you like also rate this"), which needs enough households for a similarity score to be more than noise, and live location matching. The aggregate tier is the honest version available at this size.
- ~~**Gender/ethnicity as optional profile fields**~~ — **dropped 2026-09-09.** No feature reads them and no report groups by them, so the only certain outcome was a privacy obligation and one more field on the profile page. Revisit if and when something actually needs them.

### From the pitch deck and landing-page mockup — added 2026-09-09

*Everything in this group is currently a picture. None of it exists in the codebase; `grep` across the repo returns nothing for any of it.*

- ❓ **Family Dish Duel** — two dishes head to head, the family votes, and the result is weighted by who cooked it and who was there ("Family picked Butter Chicken · 9 of 14 votes"). Needs a decision before it can be planned, and not only a technical one: **this is a voting-and-scoring mechanic, and Gamification is explicitly on hold.** Either the hold is narrower than it reads, or this item is inside it. Worth resolving deliberately rather than letting a mockup quietly overturn a decision that was made on purpose.
- 💡 **Reservation agent** — say where and when; it books the table, puts it on your calendar, and half-writes the entry in advance. The largest single item anywhere on this roadmap: it needs a booking integration, calendar write access, and an agent loop, none of which the app has any foundation for today.
- ~~**Tiered recommendations**~~ — **shipped in v2.8** exactly as described: circle, then other households, then the open web with the caveat stated on the page.
- 💡 **Native mobile app with push notifications** — "a real app on your phone, so it can tap you on the shoulder." Overlaps the Notifications item above: the honest reason to go native is push, which a PWA cannot do reliably on iOS.
- ~~**Your food life, drawn out**~~ — **shipped in v2.8** as the "Across the years" lens. It needs years of real history to say anything true, which no account has yet; the seeded harness is how it was built and verified in the meantime.
- ❓ **Pricing and packaging** — the deck says: Free forever for one person; $12.99/month or $99/year for up to 8 people; Yearbook $119; Yearbook as a gift $189. **Half of this now exists.** v2.6 built the plans, the boundary and the admin controls, and the seat numbers in `js/roles.js` are the deck's numbers. What is still entirely absent is **money**: no payment provider, no checkout, no subscription state, no renewal or failure handling, and no enforcement (deliberately off). The remaining decision is not what to charge — that is settled — but whether to take payments at all before there are users who want to pay.

## Where the story runs ahead of the product

Kept deliberately, because both artefacts are about to be shown to real people who will then open the app.

- **Menu lookup, called out as near-term on the deck, shipped in v2.7.** The deck's "What's coming next" slide lists **voice capture** and **share straight to Instagram** as upcoming. Both shipped in v2.3 on 2026-09-07 — the voice button is live in Smart Entry, and the share action already hands the card to the OS share sheet, which is how it reaches Instagram. The deck undersells what is actually finished.
- The mockup drew four features that did not exist. **Header search and Want to Try shipped in v2.5**, so the gap is now two: the **Dish Duel** and the **Memory Graph**. Anyone who reads that page and then signs up will still go looking for both. The page's own line — "this is just the beginning, new pages are coming soon" — softens it but does not cover a screenshot of a vote tally that has never been cast.
- Neither artefact is deployed. `index.html` in this repo is still the older, shorter landing page.

## Naming — the product needs a new name (decided 2026-09-10)

"Bite Book" is being retired. Three separate findings, in order of weight:

- **A live US trademark.** "BITE BOOK" is registered and in force — FORTRUEFOODIESONLY INC., filed Dec 2016, registered Oct 2018, International Class 009, covering *downloadable mobile application software providing food and recipe content*. That is this product's exact lane.
- **Three apps already named BiteBook on the App Store.** The closest is *BiteBook: Food Photos* by Dobbins Innovation Labs (launched ~19 Aug 2026, a personal food photo journal, iPhone/Mac/Vision only, no account, local + iCloud). A second, *BiteBook™* by Itech Pioneer Pty Ltd, is a creator-venue marketing platform and asserts ™. A third listing exists and was not examined.
- **bitebook.com is unavailable** — registered since Dec 2007, paid through 2031, transfer-locked. So is every near variant (thebitebook, mybitebook, bitebooks, bitebookapp, getbitebook, bitebookclub).

Root cause worth remembering: **"Bite Book" is descriptive**, which makes it both crowded and weak — a descriptive mark is hard to register and harder to enforce. The replacement should be coined or distinctive, not another pair of food words.

### Naming brief (set by the user, 2026-09-10)

- **No cuisine or culture signal.** The Indian dishes in the current app (Butter Chicken, Rasoi) are fast-to-type test data, not positioning. The product is for anyone anywhere, eating local food with local friends, whether or not those people are the user's relatives. A name that tells people which kitchen it came from wrongly narrows the category. This rules out Hindi/Urdu names, and food-language names generally.
- Translating "bite book" into another language is **not** a safe route: US trademark law's doctrine of foreign equivalents translates marks in commonly-spoken languages (Spanish, French, Italian, German, Chinese) and compares them to existing English marks — and a translation keeps the original's descriptiveness while adding a spelling problem.
- Clearance order, learned the hard way: say it aloud → descriptive or coined? → App Store search → trademark register (including similar-sounding marks) → *then* the domain. The original name was picked domain-first with the other four steps skipped.

### Candidates with the .com verified free (as of 2026-09-10)

Roughly 130 names were checked against the registry. Survivors that fit the brief:

- **Heirtable** (heirtable.com) — heirloom + table. Says the compounding-over-decades thesis, names no cuisine, invented so it is registrable. Current front-runner.
- **Mealoir** (mealoir.com, mealoirapp.com) — meal + memoir.
- **Keptmeals / The Meals We Kept** (keptmeals.com, mealswekept.com, themealswekept.com) — plain-spoken rather than coined.
- **Table Album** (tablealbum.com), **Table Chronicle** (tablechronicle.com), **A Table Kept** (atablekept.com), **Our Meal Album** (ourmealbum.com, themealalbum.com).
- Also free: heirplate.com, heirmeal.com, heirbite.com, heirfeast.com, heirsupper.com, feastkeep.com, tablemoir.com, secondstable.com, alaidtable.com, everymealever.com.
- Rejected on the brief: kinsupper.com (free, but "supper" is regionally Anglo); all Hindi/Urdu options (ourtiffin, tiffinjournal, thalibook, thaliapp, ourdawat, nivalaapp, zaikaapp — free, but they signal a cuisine); all "common language" translations.

**Still outstanding before any name is adopted:** an App Store search and a paid trademark clearance opinion (~$300–800) on the chosen name. Nothing above has had either.

## Legal and compliance gaps — deliberately deferred (2026-09-10)

The user has seen this list and chosen to park it while the app is shown only to adults he knows and takes no money. The agreed trigger for picking it up: **the first payment taken, or the first sign-up by someone he does not personally know.**

Confirmed absent from the codebase as of 2026-09-10: privacy policy, terms of service, any "delete my account" path, any age gate or consent step. Confirmed present: collection of birthdays and family-member relationships (including children's), photos of identifiable people, and user text/photos sent to Google Gemini with no disclosure. Export already works.

What will apply, in rough order of seriousness:

1. **Trademark clearance** on the new name.
2. **Children's privacy (COPPA, US).** A family album holds children's names, birthdays and faces. The standard shape for a small app is adults-only accounts, children present only as content an adult entered, stated plainly in the terms — needs a lawyer's confirmation.
3. **Privacy law.** GDPR/UK GDPR if any user is in Europe; CCPA/CPRA for California. Both need a privacy notice, data access/deletion, and a named contact. Export exists; deletion does not.
4. **App store gates.** Apple and Google both require a privacy-policy URL; Apple has required an in-app account-deletion path since 2022. These block publication outright.
5. **AI disclosure.** The Gemini proxy must be disclosed, and Google's API terms checked against this use.
6. **Two roadmap items are legal design problems, not paperwork:** restaurant-menu/recipe scraping republishes copyrighted text (dish names and prices are facts and far safer than prose), and cross-user recommendations need a lawful basis designed in from the start rather than retrofitted.

Money adds sales tax/VAT and Apple's 15–30% cut on digital goods sold in-app; the printed yearbook adds shipping, refunds and consumer-goods obligations. Neither bites until the product charges.
