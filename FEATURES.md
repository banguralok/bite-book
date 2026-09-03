# Bite Book — Features & Functionality

Bite Book is a personal food-journaling app for a family and their close circle: a guided (and AI-assisted) way to capture meals as memories — the dish, the place, who was there, why it mattered — plus pages for browsing, sharing, ranking, and reflecting on everything logged. It's a static front end (HTML/CSS/vanilla JS, no build step) backed by Supabase (Postgres, Auth, Storage, and one Edge Function) — accounts, entries, and photos all sync across devices, and privacy is enforced at the database layer via Row Level Security: an entry is visible only to its owner, or to someone it's been explicitly shared with.

This document has two parts: a **Feature List** (what the app can do, at a glance) and a **Functionality List** (how each part actually works, page by page). See `ROADMAP.md` for what shipped when, what's on hold, and what's proposed but not built yet; see `VISION.md` for the why behind the what.

---

## Feature List

**Accounts & sharing**
- Password-based sign-in and self-serve account creation
- Every user gets their own private journal by default — nothing is visible to anyone else until explicitly shared
- **Sharing**: pick anyone in your circle and share a single entry with them; shared entries show up in the recipient's My Entries, tagged with who shared them, and can't be edited or deleted by anyone but the original owner
- **Cross-user duplicate detection**: if two people in the same circle log what looks like the same real-world meal (matching place, date, and — when available — location), both get notified. The earlier-logged entry is treated as the record; the other person is asked whether to remove theirs, with a clear warning that their own rating/reflection/photos on that entry are theirs alone and won't be merged. Removing an entry that wasn't already shared automatically grants the remover access to the surviving one, so agreeing "yes, that's a duplicate" never costs someone their only record of the memory. A lighter, informational notification fires separately if the entry being kept turns out to be missing details (photos, ingredients) the removed one had.

**Logging a meal**
- **Smart Entry** (the default way to log something): describe a meal in a sentence and/or attach a photo, optionally tag your current location, and AI fills in as much of the full form as it can. A confirmation card shows what was understood right there on the page — one tap saves it as a finished entry, or you can drop into the full form to fine-tune anything first
- Quick Log: a one-field fast-capture path for when you don't want to type a sentence or wait on AI — auto-fills date/time/place/maker from the clock and your location, no network dependency
- The full 9-step guided wizard is still there as a fallback for anyone who'd rather fill in every field by hand
- Autosave on every field, with resumable drafts and a step-navigator to jump directly to any step while editing, instead of clicking through all 9
- Smart auto-detection throughout — meal type/time-of-day from the clock, place type/cuisine from GPS, "made by" from restaurant detection, birthday/anniversary occasions from your saved dates — always an overridable suggestion, never locked in
- Place-name autocomplete, geography-aware, to keep the same place spelled the same way over time

**Browsing & managing entries**
- Searchable, filterable My Entries list, with entries you own and entries shared with you shown together (shared ones tagged with who shared them, and without a delete button, since only the owner can remove them)
- **On This Day**: surfaces a past entry whose date matches today, from a prior year, right above the list
- **Smart Search**: AI semantic search when a plain substring search comes up empty
- **Clean Up Places**: runs automatically in the background (a free, instant, non-AI heuristic) and shows a dismissible banner only when it actually finds likely duplicate place names; the AI-powered deeper check is now an opt-in "trickier matches" button on the review page, for names the heuristic can't catch
- Draft entries resume at the correct wizard step automatically
- Delete with a 6-second undo window (only available on entries you own)
- "Log This Again" — duplicate a past entry's core details into a fresh draft
- Read-only "story view" for each completed entry, with per-section edit links (hidden on entries shared with you, since you can't edit someone else's entry) and a "share as image" export
- **Trips**: group entries into their own story — create a trip, add existing entries to it, see a small stats strip (meal count, distinct places, date range, top cuisine)

**Insights**
- **Stats → "Your Food Story"**: leads with a few plain-language narrative observations computed from your own data (dominant cuisine, family-meal average rating, a "problem child" dish, your most-repeated place), with the original tiles and cuisine/meal-time/company/maker breakdowns below as supporting detail, plus on-demand **AI Insights**
- **Rankings → collections**: auto-generated groupings (Hall of Fame, Most Loved, Family Favorites, Places Worth Returning To, Taste Evolution over time) lead the page; manual drag-free reordering is still there, tucked behind a "rank them yourself" toggle
- **Ask Your Journal**: a chat interface answering natural-language questions about everything visible to you — your own entries and anything shared with you — correctly attributing shared entries to whoever actually shared them, rather than assuming you were there

**Personalization**
- Profile page: name, avatar, password, home address (for home-vs-restaurant detection), birthday and anniversary
- Family members: add people with a relationship, optional name, and optional birthday/anniversary — quick-tap options under "Who You Ate With," and their special dates power the auto-suggested occasion in "Why It Was Made"
- 🔔 Notifications bell in the header, badge count for anything pending (currently: duplicate-entry notifications)

**Data safety**
- Export your full journal (entries + profile) as a JSON backup file, anytime
- Import a JSON backup to restore or merge entries

**Platform**
- Installable as a Progressive Web App (real app icon and logo, home-screen icon, offline-capable shell)
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
The default way to start a new entry (linked from the header's "New Entry" button, the landing page, and the empty-entries state). Describe a meal in a sentence and/or attach a photo; a "📍 Tag My Location" button optionally captures GPS + reverse-geocoded place details as a fallback for whatever the description didn't cover. AI (Gemini, via a shared server-side proxy — no per-user API key needed) parses the input into a structured entry. Instead of always routing into the full wizard "to review," a confirmation card appears right there showing what was understood; "✅ Looks Good — Save" marks the entry complete and goes straight to its finished story, or "✏️ Let Me Fine-Tune This" drops into the familiar wizard for anyone who wants to adjust something first.

### My Entries — [entries.html](entries.html)
Live search and status filtering across everything visible to you (owned + shared). An **On This Day** card above the list surfaces a past entry matching today's date from a prior year. A dismissible banner (free, instant, client-side — no AI call) appears only when likely duplicate place names are found among your own entries, linking to Clean Up Places. Entries shared with you show a "shared by" tag and have no delete button. Export/Import, Smart Search, and Log This Again all work as before.

### Trips — [trips.html](trips.html) / [trip-view.html](trip-view.html)
Create a trip, add any of your own complete entries to it, and see a small stats strip (meal count, distinct places, date range, top cuisine) plus the grouped entries themselves. Trips are owner-only for now — not yet shareable with others (a deliberate near-term limit, see `ROADMAP.md`).

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

### Notifications — [notifications.html](notifications.html)
Currently used for cross-user duplicate-entry resolution (see above); a 🔔 badge in the header shows the pending count. Built to extend to other notification types later.

### Landing Page — [index.html](index.html)
Hero with a "Start My First Entry" call to action (into Smart Entry), a before/after section showing a plain photo-and-caption turning into a warm "scrapbook card" record, a 3-step "how it works" explainer, and a preview of everything an entry can capture.

### Progressive Web App
[manifest.json](manifest.json) makes the site installable (real app icon, standalone window, portrait lock). [service-worker.js](service-worker.js) caches the app shell for offline use.

### Data Safety
Entries and photos live in Supabase, scoped to your account by Row Level Security — not "on your device" the way the original local-only version worked. **Export** (JSON download of every entry plus your profile) and **Import** (restore/merge from that file) remain as your own backup net, independent of the backend.

---

*The original single-user, `localStorage`-only version of Bite Book is preserved on the `main` branch as a fallback. Everything above describes the current `multiuser-edition` branch.*
