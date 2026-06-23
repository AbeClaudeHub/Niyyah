# Proof images

Drop your screenshots here using the exact filenames below. The proof section in
`docs/index.html` (the **"The discipline shows up in the payouts"** section) wires
each slot to a filename — once a real file exists at that name, it replaces the
dashed "add …" placeholder automatically. No code change needed.

## Filenames the page expects

**My own payouts** (your personal funded-account withdrawals)
- `payout-1.jpg`
- `payout-2.jpg`
- `payout-3.jpg`

**The community, getting paid** (Niyyah members passing accounts / cashing out)
- `community-1.jpg`
- `community-2.jpg`
- `community-3.jpg`
- `community-4.jpg`

**The work is landing** (DMs appreciating the videos & lessons)
- `message-1.jpg`
- `message-2.jpg`
- `message-3.jpg`

## Notes

- **Format / name:** keep the `.jpg` extension and the exact names above. To use
  PNGs instead, change the `src` (and `data-file`) in the matching `<figure>` in
  `docs/index.html`.
- **Shape:** cards are cropped to a 4:5 portrait (`object-fit: cover`). Tall
  phone screenshots fit best; very wide images get center-cropped.
- **Weight:** compress before committing (aim < ~300 KB each) so the page stays
  fast. Any image optimizer works.
- **Add or remove slots:** duplicate or delete a `<figure class="pf-card">` block
  in the proof section of `index.html`. The grid reflows automatically.
- **Consent & privacy:** these are published on a public page. The footnote under
  the section already states the images are shared with permission — only post
  other people's payouts/messages with their consent.
