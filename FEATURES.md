# Bite Book — Features & Functionality

Bite Book is a personal food-journaling app for a family and their close circle: a guided (and AI-assisted) way to capture meals as memories — the dish, the place, who was there, why it mattered — plus pages for browsing, sharing, ranking, and reflecting on everything logged. It's a static front end (HTML/CSS/vanilla JS, no build step) backed by Supabase (Postgres, Auth, Storage, and one Edge Function) — accounts, entries, and photos all sync across devices, and privacy is enforced at the database layer via Row Level Security: an entry is visible only to its owner, or to someone it's been explicitly shared with.

This document has two parts: a **Feature List** (what the app can do, at a glance) and a **Functionality List** (how each part actually works, page by page). See `ROADMAP.md` for what shipped when, what's on hold, and what's proposed but not built yet; see `VISION.md` for the why behind the what.

> **Status, 2026-09-09:** everything below is built. The v2.4 and v2.5 items — Trip Story sharing, occasion reminders, streaks, Admin Insights, the icon pass, Year in Review, header search and Want to Try — are **built and committed but not yet pushed to Netlify**, so they are not on the live site yet; `ROADMAP.md` marks them. Everything else here is live.
>
> **Nothing below is aspirational.** That is the entire job of this file, and it matters because presentation material exists which runs ahead of the product. The family pitch deck (`BiteBook_Pitch_002.pptx`) and the landing-page mockup (`bitebook_site_014.html`) describe things the code did not have. **Two of them now exist** — the header search box and the "Want to Try" wishlist, both built 2026-09-09. **Two still do not**: the Family Dish Duel and the Memory Graph, along with restaurant-menu lookup and the reservation agent from the deck. Those four do not appear below, and must not be added until they ship. When this file and the deck disagree, this file is right; `ROADMAP.md` carries the running list under "Where the story runs ahead of the product."

---

## Feature List

**Accounts & sharing**
- Password-based sign-in and self-serve account creation
- Every user gets their own private journal by default — nothing is visible to anyone else until explicitly shared
- The landing page works correctly for everyone: logged-out visitors see the marketing pitch with a simple Sign In / Get Started nav; a signed-in visitor landing there (a bookmark, the logo, a shared link) sees the same page with its calls-to-action pointed at their journal instead — only a genuine invite/magic-link callback skips straight into the app
- **Sharing**: pick anyone in your circle and share a single entry with them; shared entries show up in the recipient's My Entries, tagged with who shared them, and can't be edited or deleted by anyone but the original owner
- **Cross-user duplicate detection**: if two people in the same circle log what looks like the same real-world meal (matching place, date, and — when available — location), both get notified. The earlier-logged entry is treated as the record; the other person is asked whether to remove theirs, with a clear warning that their own rating/reflection/photos on that entry are theirs alone and won't be merged. Removing an entry that wasn't already shared automatically grants the remover access to the surviving one, so agreeing "yes, that's a duplicate" never costs someone their only record of the memory. A lighter, informational notification fires separately if the entry being kept turns out to be missing details (photos, ingredients) the removed one had.

**Logging a meal**
- **Smart Entry** (the default way to log something): describe a meal in a sentence — typed or dictated (🎙 voice capture, where the browser supports it) — and/or attach a photo, optionally tag your current location, and AI fills in as much of the full form as it can. A confirmation card shows what was understood right there on the page — one tap saves it as a finished entry, or you can drop into the full form to fine-tune anything first
- Quick Log: a one-field fast-capture path for when you don't want to type a sentence or wait on AI — auto-fills date/time/place/maker from the clock and your location, no network dependency
- The full 9-step guided wizard is still there as a fallback for anyone who'd rather fill in every field by hand
- Autosave on every field, with resumable drafts and a step-navigator to jump directly to any step while editing, instead of clicking through all 9
- Smart auto-detection throughout — meal type/time-of-day from the clock, place type/cuisine from GPS, "made by" from restaurant detection, birthday/anniversary occasions from your saved dates — always an overridable suggestion, never locked in
- Place-name autocomplete, geography-aware, to keep the same place spelled the same way over time

**Browsing & managing entries**
- **Search from anywhere**: a search box in the header on every page, covering meals, people and places. People and places are results in their own right, not just words inside a meal — clicking a person shows every meal they were at, clicking a place shows every meal eaten there, each with a clearable filter pill at the top of the list. The index is built the first time you type rather than on every page load
- Searchable, filterable My Entries list, with entries you own and entries shared with you shown together (shared ones tagged with who shared them, and without a delete button, since only the owner can remove them)
- **On This Day**: surfaces a past entry whose date matches today, from a prior year, right above the list
- **Occasion reminders**: looks *forward* instead of back — any birthday or anniversary saved on your Profile (your own or a family member's) that falls in the next 14 days appears as a card, together with what you ate for it last time. Dismissible per occasion, and it comes back next year. In-app only: it can speak when you open Bite Book, not before
- **Logging streaks**: consecutive days with a logged meal, with food-named milestones (Simmering at 3 days, On the Boil at 5, Full Course Week at 7, Head Chef Month at 30, and up). A streak counts the day the *meal* happened, so backfilling last night's dinner repairs the run; today never breaks a streak until midnight. Hitting a milestone for the first time raises a one-off toast
- **Smart Search**: AI semantic search when a plain substring search comes up empty
- **Clean Up Places**: runs automatically in the background (a free, instant, non-AI heuristic) and shows a dismissible banner only when it actually finds likely duplicate place names; the AI-powered deeper check is now an opt-in "trickier matches" button on the review page, for names the heuristic can't catch
- Draft entries resume at the correct wizard step automatically
- Delete with a 6-second undo window (only available on entries you own)
- "Log This Again" — duplicate a past entry's core details into a fresh draft
- Read-only "story view" for each completed entry, with per-section edit links (hidden on entries shared with you, since you can't edit someone else's entry) and a share action that hands the entry, rendered as a card, straight to your device's share sheet (Instagram, WhatsApp, Messages) where supported — otherwise downloads it as a PNG
- **Trips**: group entries into their own story — create a trip, add existing entries to it, see a small stats strip (meal count, distinct places, date range, top cuisine)
- **Want to Try**: a wishlist of places and dishes someone recommended, kept with *who* said it and *why* — the part that decays fastest. Marking one as tried doesn't delete it: it starts a pre-filled entry, links the two, and moves the item to "already tried", so the list keeps the record that a recommendation paid off. Private to you for now, like Trips
- **Year in Review**: your calendar year as a story — meals, days logged, places, kinds of food, average rating, longest run of days, plus the dish you kept coming back to, your place of the year, who you ate with most, your busiest month and the best thing you ate. It surfaces on its own from 15 December to 31 January and stays quiet the rest of the year; the page itself is openable any time, with a picker for every year you have entries in, and shares as one card
- **Trip Story sharing**: share a whole trip as one card — a collage of up to four photos, the trip name, its date range, the meal and place counts, the dominant cuisine and the best-rated bite — through the same native share sheet a single entry already uses

**Insights**
- **Stats → "Your Food Story"**: leads with a few plain-language narrative observations computed from your own data (dominant cuisine, family-meal average rating, a "problem child" dish, your most-repeated place), with the original tiles and cuisine/meal-time/company/maker breakdowns below as supporting detail, plus on-demand **AI Insights**
- **Rankings → collections**: auto-generated groupings (Hall of Fame, Most Loved, Family Favorites, Places Worth Returning To, Taste Evolution over time) lead the page; manual drag-free reordering is still there, tucked behind a "rank them yourself" toggle
- **Admin Insights** (visible only to an admin): signups, entries, who opened the app in the last 7 and 30 days, day-7 and day-30 return rates, a drop-off funnel from "opened it" through "shared one", a week-by-week table, and a per-person row whose most important column is **days someone opened Bite Book and logged nothing** — that is a visit to remember rather than to maintain a list. Counts and dates only; no dish, note, place or photo is reachable through any of it
- **Ask Your Journal**: a chat interface answering natural-language questions about everything visible to you — your own entries and anything shared with you — correctly attributing shared entries to whoever actually shared them, rather than assuming you were there

**Personalization**
- Profile page: name, avatar, password, home address (for home-vs-restaurant detection), birthday and anniversary
- Family members: add people with a relationship, optional name, and optional birthday/anniversary — quick-tap options under "Who You Ate With," and their special dates power the auto-suggested occasion in "Why It Was Made"
- 🔔 Notifications bell in the header, badge count for anything pending (currently: duplicate-entry notifications)

**Data safety**
- Export your full journal (entries + profile) as a JSON backup file, anytime
- Import a JSON backup to restore or merge entries
- Minimal, privacy-conscious usage analytics (app opens, page views, entries created and by which route, entries and trips shared and by which method) — never the content of an entry. An ordinary account can read only its own activity rows, same as everything else. **An admin is the one exception, added in v2.4:** the Insights page can see counts and dates across everyone — how many people opened the app, how many days each person came back, how many entries each has — but never a dish, note, place, photo or any other content. If Bite Book ever has users outside the family, this is the line a privacy policy has to describe honestly

**Platform**
- Installable as a Progressive Web App (real app icon and logo, home-screen icon, offline-capable shell)
- Drawn outline icons (not emoji) in the header nav, the main action buttons and the empty states — emoji stay inside meal cards, story sections and streak badges, where they are part of the voice rather than placeholder furniture
- Mobile-responsive layout throughout
- Accessible chip/toggle controls (`aria-pressed`, labeled icon buttons, visible focus states)

---

## Functionality List

### Accounts — [login.html](login.html)
Sign in with a password, or create a new account directly (email + password, no invite required for the current beta round — see `ROADMAP.md` for the invite-by-email flow this temporarily replaced, kept in the code but not wired to the UI). A new account lands on the Profile page's welcome flow to pick a name and avatar before going any further.

### Sharing
From an entry's story view, its owner can open a "Share with..." panel listing everyone in their circle (via `profile_directory`, a narrow name/avatar-only mirror of profiles — never birthdays, addresses, or family data) and tap to share or unshare, instantly. RLS enforces that only the owner can create or revoke a share, and that a shared entry is readable — never editable — by the recipient.

### Cross-user duplicate detection — [notifications.html](notifications.html)
Runs client-side whenever My Entries loads: your own complete entries are checked against a narrow, database-wide view (place name, date, owner — never entry content) for likely matches by place and date. A match writes a notification for both people via a security-definer database function (so a client can never write into someone else's notifications, or grant itself a share, directly). The earlier-logged entry is always treated as the keeper. Resolving a notification either dismisses it as "not a duplicate" (remembered, so it won't re-flag) or removes your entry — with a warning that your own rating/reflection/photos on it are yours alone — and, if the two entries weren't already connected by a share, automatically grants you access to the surviving one.

### The Wizard — [entry.html](entry.html) and 8 more steps
Same 9 steps as before (What → When → Where → Who → Made By → Why → Ingredients → Loved It → Photos), each with autosave and a "Finish Later" exit. New: a step-navigator bar (visible whenever editing an existing entry) lets you jump directly to any step instead of clicking Continue through all nine. Data now lives in Supabase — photos/videos upload to a private Storage bucket and are served via short-lived signed URLs, never a public link.

### Smart Entry — [smart-entry.html](smart-entry.html)
The default way to start a new entry (linked from the header's "New Entry" button, the landing page, and the empty-entries state). Describe a meal in a sentence — typed, or dictated via a "🎙 Say It Instead" button where the browser's Web Speech API is available (feature-detected; the button stays hidden on browsers without it, notably iOS Safari, which already has a mic key on its own keyboard) — and/or attach a photo; a "📍 Tag My Location" button optionally captures GPS + reverse-geocoded place details as a fallback for whatever the description didn't cover. AI (Gemini, via a shared server-side proxy — no per-user API key needed) parses the input into a structured entry. Instead of always routing into the full wizard "to review," a confirmation card appears right there showing what was understood; "✅ Looks Good — Save" marks the entry complete and goes straight to its finished story, or "✏️ Let Me Fine-Tune This" drops into the familiar wizard for anyone who wants to adjust something first.

### Story View — [entry-view.html](entry-view.html)
Read-only narrative page for one completed entry: hero photo, title, and conditionally-rendered sections (place, company, maker, occasion, ingredients, what-you-loved, reflection, extra photos, videos), each with its own edit-pencil link back to the relevant wizard step — omitted entirely when the entry isn't yours. Owners also get a "Share with..." panel (see Sharing, above). The "📤 Share" action renders the entry onto a canvas (photo, title, key facts, a reflection quote, watermark) and hands it to the device's native share sheet when available — Instagram, WhatsApp, Messages, anything registered as a share target — falling back to a plain PNG download when it isn't, or if a private-storage photo taints the canvas and the share sheet path fails (retried once, without the photo, rather than failing silently).

### Quick Log — [quick-log.html](quick-log.html)
The fastest path in, and the only one with no network dependency: one field for the dish name, everything else guessed. Date is today, meal type and time of day come from the clock, and — if location is allowed — the place is reverse-geocoded and compared against the home address on your Profile, so eating at home is tagged as home and a restaurant is tagged as a restaurant with its name and short address filled in. Nothing here waits on AI, which is why it still works when Smart Entry can't.

### Header search — every page (`js/search.js`)
A search box in the header, present on every signed-in page. Meals match on dish, place, reflection, ingredients, cook and companions. People are gathered from three places, because a person can be attached to a meal three ways — a saved family member, free text in "who were you with", or whoever cooked it — and places from every distinct place name; both are ranked by how often they appear. Choosing a person or place navigates to My Entries with a `?person=` or `?place=` filter and a clearable pill at the top. Arrow keys move through results, Enter opens one, Escape clears. Entries are fetched the first time someone types, never on page load, so a box on every page does not mean a database round trip on every page. On a page that doesn't load the storage layer the box hides itself rather than failing on the first keystroke.

### My Entries — [entries.html](entries.html)
Live search and status filtering across everything visible to you (owned + shared). A **streak strip** sits at the top (`js/streak.js`), then any **upcoming occasion** cards (`js/occasions.js`), then **On This Day**. Streaks and occasions both deliberately ignore entries other people shared with you — they are about your own logging. An **On This Day** card above the list surfaces a past entry matching today's date from a prior year. A dismissible banner (free, instant, client-side — no AI call) appears only when likely duplicate place names are found among your own entries, linking to Clean Up Places. Entries shared with you show a "shared by" tag and have no delete button. Export/Import, Smart Search, and Log This Again all work as before.

### Trips — [trips.html](trips.html) / [trip-view.html](trip-view.html)
Create a trip, add any of your own complete entries to it, and see a small stats strip (meal count, distinct places, date range, top cuisine) plus the grouped entries themselves. **Share Trip Story** renders the whole trip as one card — a photo collage that adapts to however many pictures actually loaded (1, 2, 3 or 4 up), the trip name, date range, meal/place counts, dominant cuisine and best-rated bite — and hands it to the native share sheet, falling back to a PNG download. The button is unavailable until the trip has at least one entry, since an empty trip has no story. Trips are owner-only for now — not yet shareable with others (a deliberate near-term limit, see `ROADMAP.md`).

### Stats — [stats.html](stats.html)
Leads with "Your Food Story": a handful of plain-language sentences computed from your own data (only the ones that actually qualify — no padding). Below that, the original tiles (totals, average rating, this month, top-rated dish) and ranked breakdowns (cuisines, meal times, company, cooks) remain as supporting detail, followed by on-demand **AI Insights**.

### Rankings — [ranking.html](ranking.html)
Leads with auto-generated collections — Hall of Fame (5-star entries), Most Loved (would-eat-again), Family Favorites, Places Worth Returning To (repeat visits, high average rating), and Taste Evolution (top cuisine + average rating by quarter). The original manual up/down reordering is still available, collapsed behind an "Or rank them yourself" toggle.

### Ask Your Journal — [ask.html](ask.html)
Chat interface over everything visible to you — your own entries plus anything shared with you. Each entry in the AI's context is tagged with its real owner ("me" or the sharer's name), and the system prompt explicitly tells the model not to assume "I" refers to the asker for a shared entry — so a question about a meal someone else shared gets attributed to the right person instead of presented as the asker's own solo meal.

### Clean Up Places — [dedupe.html](dedupe.html)
Runs the same free, instant heuristic used for the My Entries banner automatically on load — no button needed for the common case. A "🔍 Also Check for Trickier Matches (AI)" button remains for name variants the heuristic can't catch (e.g. "IHOP" vs. its full name), since that one costs an API call and stays opt-in.

### Profile — [profile.html](profile.html)
Name, avatar, password, home address (with "use my current location"), birthday/anniversary, and a family roster (relationship, optional name, optional birthday/anniversary) — used for home/restaurant detection, the family quick-picker, and birthday/anniversary auto-suggestions. The AI features no longer need a personal API key here — Gemini calls are proxied through a shared server-side key.

### Insights — [insights.html](insights.html)
Admin-only. Every number comes from a `security definer` function in `supabase/migrations/006_admin_insights.sql` that gates itself on `bb_is_admin()`, so a non-admin who types the URL gets empty results from the *database*, not merely a hidden page. Admin is a row in its own `admins` table rather than a column on `profiles` — the profiles policy is "owner has full access", so an `is_admin` column there could be flipped by any signed-in person from their own browser console; `admins` has a SELECT policy and nothing else, so you can learn whether you are one but cannot make yourself one. Granting admin is a one-line insert in the Supabase SQL editor (the migration carries the exact statement). The page shows headline tiles, day-7/day-30 return rates, a five-step drop-off funnel, a per-person table, a weekly table and a page-popularity table.

### Want to Try — [wishlist.html](wishlist.html)
Add a place or a dish, with who recommended it and why. The kind toggle changes what the form asks for: a dish also offers "where can you get it", a place doesn't need it. The "who recommended it" box suggests names from your family roster and your Bite Book circle but accepts anything typed. The tick button turns an item into a draft entry — a dish pre-fills the food, a place pre-fills where — links the two by `entry_id`, and moves it to a collapsed "already tried" section with a link through to the meal; the circular-arrow button puts it back on the list. Deleting a linked meal does not delete the wish (`on delete set null`). Owner-only, enforced by RLS (`supabase/migrations/008_wishlist.sql`).

### Year in Review — [year.html](year.html)
Your calendar year, computed from your own completed entries — meals shared with you are not your year. Six tiles (meals, days logged, places, kinds of food, average rating, longest run of days) then a set of highlight cards, each of which only appears if the data supports it: the most-logged dish, the most-visited place, the dominant cuisine, who you ate with most, the busiest month, the best-rated meal, trips, and how the year opened. A photo strip of up to six pictures sits above, and "Share My Year" renders the whole thing as one card. The year picker lists every year you have entries in. A banner on My Entries surfaces it from 15 December to 31 January and is dismissible for that year (`js/year-review.js`).

### Notifications — [notifications.html](notifications.html)
Currently used for cross-user duplicate-entry resolution (see above); a 🔔 badge in the header shows the pending count. Built to extend to other notification types later.

### Landing Page — [index.html](index.html)
Hero with a "Start My First Entry" call to action (into Smart Entry), a before/after section showing a plain photo-and-caption turning into a warm "scrapbook card" record, a 3-step "how it works" explainer, and a preview of everything an entry can capture. `js/index-gate.js` only redirects away from this page on a genuine auth callback (an invite/magic-link/confirmation arriving with the right hash or query params) — an ordinary visit while signed in (a bookmark, the logo, a shared link) keeps the landing page and simply retargets its calls-to-action at the journal ("🍽️ Open My Journal") or profile setup ("👋 Finish Setting Up"), whichever applies.

A full redesign of this page exists as a mockup (`bitebook_site_014.html`, 2026-09-08) and is **not** deployed — it is roughly three times the length of the live page and leads with four features the app doesn't have. See `ROADMAP.md` before treating any of it as current.

### Header — [js/partials.js](js/partials.js)
Built from the visitor's actual session on every page, not from whether that page happens to require login. Signed out: brand + a plain "Sign in / ✨ Get Started" — no links that would just bounce to a login wall. Signed in: the full app nav (My Entries, Quick Log, Full Form, New Entry, notifications bell with a pending-count badge, avatar, sign out).

### Progressive Web App
[manifest.json](manifest.json) makes the site installable (real app icon, standalone window, portrait lock). [service-worker.js](service-worker.js) caches the app shell for offline use.

### Product Analytics — `js/track.js`
A minimal `events` table (user, event name, small JSON props, timestamp) records session starts, page views, and entry creation — fired on `bitebook:ready`, fire-and-forget, silently swallowed on failure so analytics can never break or slow a page. Deliberately never records entry content (no dish names, places, photos, reflections). RLS restricts every row to insert-and-read-your-own — nobody, including the person who wrote it, can read someone else's activity or edit their own history after the fact. `supabase/analytics.sql` holds the scorecard queries used to read it back.

### Data Safety
Entries and photos live in Supabase, scoped to your account by Row Level Security — not "on your device" the way the original local-only version worked. **Export** (JSON download of every entry plus your profile) and **Import** (restore/merge from that file) remain as your own backup net, independent of the backend. The `supabase/` folder (schema + every migration) is blocked from being served (`_redirects`) — Netlify otherwise publishes the whole repo root, which would make the database's table shapes and security policies fetchable by anyone who guessed the path (RLS still would have protected the actual data either way, but there's no reason to hand out the blueprint).

---

*The original single-user, `localStorage`-only version of Bite Book is preserved on the `main` branch as a fallback. Everything above describes the current `multiuser-edition` branch.*
