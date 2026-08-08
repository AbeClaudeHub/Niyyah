# The Mirror

A single-file, offline-first intention journal for traders. Not a P&L
tracker — a behavioral audit. You state your intention before a trade and
name your own behavior after it; the app shows you which habit is costing
you the most, in R.

Everything lives in one file: `index.html`. Inline CSS, inline JS, no
build step, no dependencies, no backend, no accounts, no analytics, no
network requests of any kind. It works offline after the first load
because it never fetches anything external — no CDN fonts, no CDN
scripts.

## Data

- All entries are stored in the browser's `localStorage`, on the device
  that opened the page. Nothing is transmitted anywhere.
- Use **Export journal** (Data tab) to download a JSON backup, and
  **Import journal** to restore one — from this device or another.
- If `localStorage` is unavailable (e.g. private/incognito mode in some
  browsers), the app shows a warning banner and keeps working in-memory
  for that session, but nothing will persist after the tab closes.

## Hosting

### GitHub Pages
1. Push this repo to GitHub (already done if you're reading this from
   the repo).
2. Repo Settings → Pages → Build and deployment → Source: **Deploy from
   a branch** → Branch: `main`, folder: `/ (root)`.
3. Save. Your site will be live at `https://<username>.github.io/<repo>/`
   within a minute or two.

### Netlify
1. New site from Git → pick this repo.
2. Build command: leave blank. Publish directory: `/` (repo root).
3. Deploy. No environment variables or build settings are needed since
   there's no build step.

You can also just open `index.html` directly in a browser (`file://`) —
it works standalone, though `localStorage` is per-origin, so entries
made via `file://` won't carry over once it's hosted on a real domain.

## Scripture and hadith placeholders

Per instruction, no verse or hadith text was invented, paraphrased, or
approximated anywhere in the app. Every place a citation would strengthen
a screen is marked with a clearly bracketed placeholder in the UI and
listed here so you can fill in and verify the source yourself. Search
`index.html` for the bracketed text to find each spot.

| Placeholder text | Screen | Theme requested |
|---|---|---|
| `[HADITH PLACEHOLDER — sincerity of intention / niyyah]` | New (step 1, "Why this trade?") | Sincerity/purity of intention before an action |
| `[VERSE PLACEHOLDER — patience / sabr]` | The Mirror | Patience / self-restraint, sitting next to the behavioral cost breakdown |
| `[HADITH PLACEHOLDER — self-reckoning / muhasabah]` | This Week | Holding oneself to account, examining one's own deeds |
| `[VERSE PLACEHOLDER — trust in Allah / tawakkul]` | Data / privacy screen | Trusting outcomes beyond one's control, alongside a note on risk |

All four are implemented in `index.html` via a single `verseBox(theme)`
helper function — search for `verseBox(` to see exactly where each one
is inserted, or to add more.

## Structure

- **New** — the pre-trade wizard: three questions, one per screen
  (why this trade, what invalidates it, what you'll do in the next 10
  minutes if it loses), then a review step and "Log it."
- **Close** — reopen an open entry, see your own stated plan again, tag
  exactly one behavior from a fixed list, note whether you breached your
  own invalidation, optionally log a result in R and a one-line note.
- **Mirror** — the report. Leads with cost-by-behavior (total R lost per
  tag, worst first, drawn as plain HTML/CSS bars), a generated headline
  sentence, your invalidation-breach count, and — last, smaller — your
  discipline rate.
- **Week** — surfaces your own words from your worst entry of the past 7
  days next to what you actually did. No added commentary.
- **Data** — entry counts, the privacy statement, export/import, and a
  delete-everything control.

## Local development

There is nothing to install or build. Open `index.html` in a browser, or
serve the directory with any static file server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.
