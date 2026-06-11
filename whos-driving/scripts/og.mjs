// Generates public/og.png (1200×630) from an inline SVG.
// Run once after any copy change: node scripts/og.mjs
import { Resvg } from "@resvg/resvg-js";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import wawoff2 from "wawoff2";

const woff2 = await readFile(
  new URL("../public/fonts/fraunces-latin-opsz-normal.woff2", import.meta.url),
);
const ttf = await wawoff2.decompress(woff2);
const dir = await mkdtemp(join(tmpdir(), "og-fonts-"));
const ttfPath = join(dir, "fraunces.ttf");
await writeFile(ttfPath, Buffer.from(ttf));

const W = 1200;
const H = 630;

// The dial motif: 270° arc, opening at the bottom, ~62% filled.
const cx = 990;
const cy = 315;
const r = 150;
const polar = (deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};
const arcPath = (fromDeg, toDeg) => {
  const [x1, y1] = polar(fromDeg);
  const [x2, y2] = polar(toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#0c0b09"/>
  <path d="${arcPath(-135, 135)}" stroke="rgba(201,162,75,0.3)" stroke-width="3" fill="none"/>
  <path d="${arcPath(-135, 33)}" stroke="#c9a24b" stroke-width="3" fill="none" stroke-linecap="round"/>
  <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-family="Fraunces"
    font-size="64" fill="#c9a24b">11</text>
  <text x="${cx}" y="${cy + 58}" text-anchor="middle" font-family="Fraunces"
    font-size="22" fill="#8d8674">of 15</text>

  <text x="80" y="130" font-family="Fraunces" font-size="24" letter-spacing="10" fill="#c9a24b">NIYYAH</text>
  <text x="80" y="295" font-family="Fraunces" font-size="110" fill="#ede8dd">WHO'S</text>
  <text x="80" y="405" font-family="Fraunces" font-size="110" fill="#ede8dd">DRIVING</text>
  <text x="80" y="480" font-family="Fraunces" font-size="30" fill="#b9b1a0">The Nafs Audit &amp; 30-Day Rebuild</text>
  <text x="80" y="545" font-family="Fraunces" font-size="26" fill="#8d8674">Your strategy isn't the problem. $27, once.</text>
  <rect x="80" y="160" width="380" height="2" fill="rgba(201,162,75,0.4)"/>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: { fontFiles: [ttfPath], loadSystemFonts: false, defaultFontFamily: "Fraunces" },
});
const png = resvg.render().asPng();
await writeFile(new URL("../public/og.png", import.meta.url), png);
console.log(`wrote public/og.png (${png.length} bytes)`);
