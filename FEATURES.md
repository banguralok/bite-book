# Bite Book — Features & Functionality

Bite Book is a personal food-journaling site: a guided wizard for logging meals, plus pages for browsing, searching, ranking, and reflecting on everything you've eaten. It's a static site (HTML/CSS/vanilla JS, no build step, no server) that stores everything locally in the browser via `localStorage` — nothing is sent anywhere.

This document has two parts: a **Feature List** (what the app can do, at a glance) and a **Functionality List** (how each part actually works, page by page).

---

## Feature List

**Logging a meal**
- 9-step guided entry wizard: What → When → Where → Who You Ate With → Who Made It → Why It Was Made → Ingredients → What You Loved → Photos/Videos
- Autosave on every field, with resumable drafts (leave anytime, pick back up exactly where you left off)
- "Finish Later" exit available on every step
- Quick Log: a one-field fast-capture path for when you just want to log the food name and fill in the rest later
- Smart auto-detection throughout — meal type and time-of-day guessed from the clock, place type and cuisine guessed from GPS + OpenStreetMap, "made by" guessed from restaurant detection, and birthday/anniversary occasions guessed from your saved dates — always shown as an overridable suggestion, never locked in

**Browsing & managing entries**
- Searchable, filterable "My Entries" list (search by food/place/ingredients/reflection/people; filter by complete/draft)
- Draft entries resume at the correct wizard step automatically
- Delete with a 6-second undo window
- "Log This Again" — duplicate a past entry's core details into a fresh draft
- Read-only "story view" page for each completed entry, with a hero photo and all the details laid out narratively
- Share any entry as a downloadable image (auto-generated PNG card)

**Insights**
- Stats page: totals, average rating, entries this month, top-rated dish, and breakdowns of your most common cuisines, meal times, dining companions, and cooks
- Rankings page: manually reorder your complete entries (drag-free, up/down arrows), defaulting to rating order

**Personalization**
- Profile page: name, avatar, home address (for home-vs-restaurant detection), your birthday and anniversary
- Family members: add people with a relationship (Mom, Dad, Sibling, Spouse, etc.), optional name, and optional birthday/anniversary — they then become quick-tap options under "Who You Ate With," and their special dates power the auto-suggested occasion in "Why It Was Made"

**Data safety**
- Export your full journal (entries + profile) as a JSON backup file, anytime
- Import a JSON backup to restore or merge entries

**Platform**
- Installable as a Progressive Web App (home-screen icon, offline-capable shell)
- Mobile-responsive layout throughout
- Accessible chip/toggle controls (`aria-pressed`, labeled icon buttons, visible focus states)

---

## Functionality List

### The 9-Step Entry Wizard

Every step shares the same shell: a progress bar ("Step N of 9"), a debounced autosave badge, a "Finish Later" link back to My Entries, and Back/Continue buttons that carry the entry's ID through the URL. Continue is disabled until that step's required field is filled. Reopening a link with `?id=` restores every prior answer.

1. **What** ([entry.html](entry.html)) — Food name (free text), meal type (single-select chips), cuisine (single-select chips). *Smart guess:* meal type is pre-picked from the current clock time (breakfast/lunch/high tea/dinner/supper), with a hint and one-tap override.
2. **When** ([entry-when.html](entry-when.html)) — Date (Today/Yesterday/2 days ago/pick a date) and time (fuzzy time-of-day chips or an exact time picker). *Smart guess:* time-of-day chip pre-picked from the current hour.
3. **Where** ([entry-where.html](entry-where.html)) — Place name, optional address, place type. *Smart guess:* "Use My Current Location" reverse-geocodes via OpenStreetMap; within 150m of your saved home address it tags "Home," otherwise OSM's amenity tags can auto-tag "Restaurant/Café" and infer cuisine.
4. **Who You Ate With** ([entry-who.html](entry-who.html)) — Companion type (multi-select chips: solo, family, friends, etc. — "Just Me" is exclusive of everything else). Selecting "Family" reveals your saved family members as quick-tap chips. Optional free-text name field.
5. **Who Made It** ([entry-made.html](entry-made.html)) — Single-select maker (you, mom, dad, a chef/restaurant, store-bought, etc.). *Smart guess:* pre-selects "A Chef/Restaurant" if the Where step detected a restaurant.
6. **Why It Was Made** ([entry-why.html](entry-why.html)) — Single-select reason (birthday, anniversary, celebration, comfort food, craving, etc.). *Smart guess:* if the meal's date matches your saved birthday/anniversary — or a family member's — the matching reason is pre-selected with a hint like "Looks like it's Sunita's birthday." Date-relevant reasons reveal an optional occasion-date field.
7. **Ingredients** ([entry-ingredients.html](entry-ingredients.html)) — Optional: free-text ingredients, a recipe link (auto-detects Instagram/YouTube/TikTok/Pinterest/etc. and shows a platform badge), or a single file upload (image/PDF/doc, capped at 1.5MB).
8. **What You Loved** ([entry-loved.html](entry-loved.html)) — Multi-select liked qualities, 5-star rating, "would eat again" (yes/maybe/no), frequency, personal rank, and an optional reflection.
9. **Photos/Videos** ([entry-photos.html](entry-photos.html)) — Up to 6 photos (compressed client-side via canvas to fit local storage) and up to 4 videos (short upload or pasted link). Finishing this step marks the entry `complete`.

### Story View — [entry-view.html](entry-view.html)
Read-only narrative page for a finished entry: hero photo, title, and conditionally-rendered sections for place, company, maker, occasion, ingredients, what-you-loved, reflection, extra photos, and videos. Actions: **Edit** (back into the wizard), **Log This Again** (duplicates core fields into a new draft), and **Share** (renders the entry onto a canvas — photo, title, key facts, reflection quote, watermark — and downloads it as a PNG). All links are scheme-checked before being made clickable.

### My Entries — [entries.html](entries.html)
- Live search across food, place, ingredients, reflection, maker, and companion names.
- Status filter: All / Complete / Draft.
- Each card shows a tag summary, status, and last-updated time; complete entries link to the story view, drafts resume at the exact wizard step they left off on.
- **Export**: downloads all entries + your profile as a timestamped JSON backup.
- **Import**: restores/merges entries from a JSON backup file (with confirmation), sanitizing any unsafe links before merging.
- **Delete**: confirms, then hides the entry immediately with a 6-second "Undo" toast before the deletion is finalized.
- **Log This Again** available directly from the list.

### Quick Log — [quick-log.html](quick-log.html)
A single food-name field for fast capture. Submitting saves a draft immediately and auto-fills, in the background: today's date, meal type and time-of-day (guessed from the clock), and place/maker/cuisine (guessed from geolocation the same way the Where step does — home-proximity first, restaurant detection second). A live preview shows what was auto-captured before you submit, and a link escapes to the full wizard if you'd rather fill it in by hand.

### Stats — [stats.html](stats.html)
Computed live from your entries: total/complete counts, average rating, entries logged this month, your top-rated dish, and four ranked breakdowns (top cuisines, most common meal times, most common company, most common cooks), each shown as a bar chart of your top 5.

### Rankings — [ranking.html](ranking.html)
Every complete entry, defaulted to rating order, with your own manual reordering (via Up/Down arrows) remembered separately and taking precedence. Each row shows a thumbnail, title (linking to the story view), and star rating.

### Profile — [profile.html](profile.html)
Name, avatar, home address (with a "use my current location" geolocation button), your birthday and anniversary, and a family roster. Each family member has a relationship, optional name, and optional birthday/anniversary. This data is used only locally — to power the home/restaurant detection in Quick Log and the Where step, the family quick-picker in Who You Ate With, and the birthday/anniversary auto-suggestion in Why It Was Made.

### Landing Page — [index.html](index.html)
Static introduction: hero with a "Start My First Entry" call to action, a 3-step "how it works" explainer, and a preview of everything an entry can capture.

### Progressive Web App
[manifest.json](manifest.json) makes the site installable (home-screen icon, standalone window, portrait lock). [service-worker.js](service-worker.js) caches the app shell on install and serves network-first with a cache fallback, so previously visited pages keep working offline.

### Data Safety
Everything lives in the browser's `localStorage` — there is no account and nothing leaves your device. Because of that, **Export** (JSON download of every entry plus your profile) and **Import** (restore/merge from that file) exist as your backup net against clearing browser data, switching devices, or browser storage limits.

---

*Not yet built: a real account system with server-side storage/sync (currently deferred — everything is local-only, tied to one browser on one device).*
