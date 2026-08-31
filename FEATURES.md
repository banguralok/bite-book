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
- **Smart Entry**: describe a meal in a sentence ("Had biryani at the Dhaba with mom for her birthday, loved it") and/or attach a photo, and AI (Google Gemini, free tier) fills in as much of the 9-step form as it can — food, meal type, cuisine, date, place, who was there (including matching your saved family members), who made it, why, rating, and more — all pre-filled and ready to review/edit through the normal wizard. A photo alone is enough — AI identifies the dish, and the photo carries forward into Step 9 automatically
- Smart auto-detection throughout — meal type and time-of-day guessed from the clock, place type and cuisine guessed from GPS + OpenStreetMap, "made by" guessed from restaurant detection, and birthday/anniversary occasions guessed from your saved dates — always shown as an overridable suggestion, never locked in
- Place-name autocomplete on the Where step: suggests places you've typed before as you type, so the same place stays spelled the same way instead of drifting into near-duplicates over time (no AI, no network — instant and free). Suggestions are weighted by distance from your saved home (or your live location, if just fetched) — a restaurant a few towns over can show up, but a place from a trip across the country or overseas won't clutter today's suggestions

**Browsing & managing entries**
- Searchable, filterable "My Entries" list (search by food/place/ingredients/reflection/people; filter by complete/draft)
- **Smart Search**: when a plain search comes up empty, AI can search by meaning instead — "something spicy" finds dishes tagged with a spicy quality even if the word "spicy" never appears
- **Clean Up Places**: AI scans your place names for likely duplicates from inconsistent typing ("Spice Villa" vs "Spice Villa Restaurant") and lets you review and merge each group — nothing changes without your approval
- Draft entries resume at the correct wizard step automatically
- Delete with a 6-second undo window
- "Log This Again" — duplicate a past entry's core details into a fresh draft
- Read-only "story view" page for each completed entry, with a hero photo and all the details laid out narratively
- Share any entry as a downloadable image (auto-generated PNG card)

**Insights**
- Stats page: totals, average rating, entries this month, top-rated dish, and breakdowns of your most common cuisines, meal times, dining companions, and cooks — plus on-demand **AI Insights**, a few specific, data-grounded observations about your eating patterns
- Rankings page: manually reorder your complete entries (drag-free, up/down arrows), defaulting to rating order
- **Ask Your Journal**: a chat interface (AI, Google Gemini free tier) that answers natural-language questions about everything you've logged — "What's my highest-rated dish?", "How often does mom cook for me?" — with follow-up questions understood in context

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
3. **Where** ([entry-where.html](entry-where.html)) — Place name, optional address, place type. The place-name field autocompletes from your own past entries (a native `<datalist>`) so retyping "Spice Villa" doesn't drift into "Spice Villa Restaurant" a few entries later — this is the preventive counterpart to [Clean Up Places](dedupe.html), which catches drift that already happened. Suggestions are geography-aware: places within ~250km of your saved home (or your freshly-detected current location, once fetched) are ranked by distance; places you've only ever logged with no known coordinates still show up, ranked by how often you've used them; anything farther than ~250km is left out entirely, so a place from a distant trip won't surface while you're typing a local entry. *Smart guess:* "Use My Current Location" reverse-geocodes via OpenStreetMap; within 150m of your saved home address it tags "Home," otherwise OSM's amenity tags can auto-tag "Restaurant/Café" and infer cuisine.
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
- **Smart Search**: if the live substring search returns nothing for the current query, a "✨ Try Smart Search" button appears. It sends the query plus a compact snapshot of your entries (cuisine, ingredients, liked qualities, reflection, etc.) to Gemini and asks which ones plausibly match in meaning, not just literal words — results are labeled so it's clear they came from AI reasoning rather than an exact match.

### Quick Log — [quick-log.html](quick-log.html)
A single food-name field for fast capture. Submitting saves a draft immediately and auto-fills, in the background: today's date, meal type and time-of-day (guessed from the clock), and place/maker/cuisine (guessed from geolocation the same way the Where step does — home-proximity first, restaurant detection second). A live preview shows what was auto-captured before you submit, and a link escapes to the full wizard if you'd rather fill it in by hand.

### Smart Entry — [smart-entry.html](smart-entry.html)
A free-text box and/or a photo upload: describe a meal in a sentence or two, attach a photo, or both, and an AI model (Google Gemini, called directly from the browser with your own free API key) parses it into a structured draft entry — food, meal type, cuisine, date (relative dates like "yesterday" resolved automatically), place, who was there (matched against your saved family members by name/relationship), who made it, why, liked qualities, and rating, wherever the input clearly supports it. A photo alone is enough to identify the dish (and is carried straight into Step 9's photo grid, already attached). Anything the AI can't confidently infer falls back to the same clock-based smart guesses used elsewhere (meal type/time-of-day), or is left blank for you to fill in. The result is saved as a normal draft and you're taken straight into Step 1 of the regular wizard to review and correct anything before continuing — nothing is ever silently accepted. Requires a free Gemini API key, entered once on the Profile page (see below); without one, the page explains how to get one instead of failing silently.

### Stats — [stats.html](stats.html)
Computed live from your entries: total/complete counts, average rating, entries logged this month, your top-rated dish, and four ranked breakdowns (top cuisines, most common meal times, most common company, most common cooks), each shown as a bar chart of your top 5. An **AI Insights** section generates 3-5 specific, data-grounded observations on demand (e.g. "Social dining brings out your highest ratings — every meal shared with family or friends scored 4+ stars") — nothing runs automatically, only when you click Generate.

### Rankings — [ranking.html](ranking.html)
Every complete entry, defaulted to rating order, with your own manual reordering (via Up/Down arrows) remembered separately and taking precedence. Each row shows a thumbnail, title (linking to the story view), and star rating.

### Ask Your Journal — [ask.html](ask.html)
A chat page (linked from My Entries, next to Stats and Rankings). Every question is sent to Gemini along with a snapshot of your journal (food, dates, ratings, companions, reasons, reflections — everything except photos/videos, which stay out of the payload) as system context, so it can answer specifically — citing dish names, dates, and people rather than generic advice. Conversation history is kept for the session so follow-up questions ("Would I eat that again?") are understood in context without repeating yourself. If the data can't answer a question, it says so rather than guessing. Uses the same Gemini API key as Smart Entry.

### Clean Up Places — [dedupe.html](dedupe.html)
A utility page (linked from My Entries) for catching place names that drifted apart from inconsistent typing over time. "✨ Find Possible Duplicates" sends your distinct place names to Gemini, which groups ones it's fairly confident refer to the same real place (conservatively — it's told to leave anything uncertain separate) and suggests a canonical name for each group. Each group is a card with an editable name field and its own Merge/Skip buttons — nothing is changed until you click Merge on that specific group, which rewrites `placeName` across every affected entry.

### Profile — [profile.html](profile.html)
Name, avatar, home address (with a "use my current location" geolocation button), your birthday and anniversary, and a family roster. Each family member has a relationship, optional name, and optional birthday/anniversary. This data is used only locally — to power the home/restaurant detection in Quick Log and the Where step, the family quick-picker in Who You Ate With, and the birthday/anniversary auto-suggestion in Why It Was Made. Also holds the optional **Gemini API key** that powers every AI feature (Smart Entry, Ask Your Journal, Smart Search, AI Insights, Clean Up Places) — stored separately from the rest of your profile so it's never swept up in the Export/Import backup file.

### Landing Page — [index.html](index.html)
Static introduction: hero with a "Start My First Entry" call to action, a 3-step "how it works" explainer, and a preview of everything an entry can capture.

### Progressive Web App
[manifest.json](manifest.json) makes the site installable (home-screen icon, standalone window, portrait lock). [service-worker.js](service-worker.js) caches the app shell on install and serves network-first with a cache fallback, so previously visited pages keep working offline.

### Data Safety
Everything lives in the browser's `localStorage` — there is no account and nothing leaves your device. Because of that, **Export** (JSON download of every entry plus your profile) and **Import** (restore/merge from that file) exist as your backup net against clearing browser data, switching devices, or browser storage limits.

---

*Not yet built: a real account system with server-side storage/sync (currently deferred — everything is local-only, tied to one browser on one device).*
