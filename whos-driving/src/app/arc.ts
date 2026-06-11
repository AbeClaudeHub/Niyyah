/*
 * The signature motif: a thin gold arc that fills as the audit progresses,
 * then becomes the score dial on the verdict. One motif, carried through.
 *
 * The arc is a 270° dial, opening at the bottom, drawn with stroke-dash on
 * a circle. `progress` is 0..1 of the dial's sweep.
 */

const SWEEP = 0.75; // 270° of the circle

export function arcSvg(opts: {
  size: number;
  progress: number;
  strokeWidth?: number;
  /** Class applied to the progress stroke, for CSS transitions. */
  cls?: string;
  label?: string;
}): string {
  const { size, progress, strokeWidth = 1.5, cls = "", label = "" } = opts;
  const r = (size - strokeWidth * 2) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const track = circumference * SWEEP;
  const fill = track * Math.min(Math.max(progress, 0), 1);
  // Rotate so the 270° sweep starts at the lower-left gap.
  const rotation = 135;
  return `
    <svg class="arc ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
         role="img" aria-label="${label}" ${label ? "" : 'aria-hidden="true"'}>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none"
        stroke="var(--gold-hairline)" stroke-width="${strokeWidth}"
        stroke-dasharray="${track} ${circumference}"
        transform="rotate(${rotation} ${c} ${c})" />
      <circle class="arc-fill" cx="${c}" cy="${c}" r="${r}" fill="none"
        stroke="var(--gold)" stroke-width="${strokeWidth}" stroke-linecap="round"
        stroke-dasharray="${fill} ${circumference}"
        transform="rotate(${rotation} ${c} ${c})" />
    </svg>`;
}

/** Animates the dial fill and a numeric count-up together. */
export function animateDial(
  svgHost: HTMLElement,
  numberHost: HTMLElement,
  target: number,
  max: number,
  duration = 900,
): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fillCircle = svgHost.querySelector<SVGCircleElement>(".arc-fill");
  if (!fillCircle) return;
  const dash = fillCircle.getAttribute("stroke-dasharray") ?? "0 0";
  const circumference = Number(dash.split(" ")[1]);
  const track = circumference * SWEEP;
  const setProgress = (p: number) => {
    fillCircle.setAttribute("stroke-dasharray", `${track * (target / max) * p} ${circumference}`);
    numberHost.textContent = String(Math.round(target * p));
  };
  if (reduced) {
    setProgress(1);
    return;
  }
  setProgress(0);
  const t0 = performance.now();
  const tick = (t: number) => {
    const raw = Math.min((t - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - raw, 3);
    setProgress(eased);
    if (raw < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
