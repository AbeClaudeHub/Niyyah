# The Trader and the Nafs — landing page

Static promotional / book landing page for *The Trader and the Nafs*.
No build step; the only external dependency is Google Fonts (CDN). The book
cover renders as inline SVG.

- `index.html` — the landing page (publish root)
- `downloads/` — lead magnet + free chapter PDFs (linked with relative paths)
- `assets/cover.png` — high-res cover for social / og image
- `.nojekyll` — bypass Jekyll (plain HTML)
- `vercel.json` — security headers + SPA fallback (kept from previous setup)
