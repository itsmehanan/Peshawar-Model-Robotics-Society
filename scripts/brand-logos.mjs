#!/usr/bin/env node
/**
 * Brand mark generator — Peshawar Model Robotics Society.
 *
 * Emits the logo family as hand-built, scalable SVG, so the identity holds from a
 * 16px favicon to a printed banner with no raster in the way:
 *
 *   logo-mark.svg        emblem only (square; avatars, app icon, social)
 *   logo-mark-mono.svg   one-colour line-art emblem (print, foil, embossing)
 *   logo-full.svg        horizontal lockup for dark backgrounds
 *   logo-full-light.svg  the same lockup tuned for light backgrounds
 *   favicon.svg          optically simplified emblem that survives 16px
 *
 * Run `node scripts/brand-logos.mjs`. Output is committed: the running site must
 * never depend on this script.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/assets');
mkdirSync(OUT, { recursive: true });

const nf = (v) => Number(v.toFixed(2));
const r3 = (v) => Number(v.toFixed(3));

/* --------------------------------------------------------------- geometry */

const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [nf(cx + r * Math.cos(a)), nf(cy + r * Math.sin(a))];
};

/**
 * Gear ring = annulus + trapezoid teeth.
 *
 * The tempting one-path approach (walk valley -> tip -> valley around the
 * circle) is a self-intersecting "flower" whose interior is the whole disc, so
 * it needs the bore to cut it back and renders differently depending on the
 * fill rule. Two unambiguous primitives overlap into the same silhouette and
 * every renderer agrees on the result.
 */
function gear({ cx = 100, cy = 100, bore = 58, body = 77, tip = 87, teeth = 12, toothDeg = 9.2 } = {}) {
  const ring =
    `M${cx - body} ${cy}A${body} ${body} 0 1 0 ${cx + body} ${cy}` +
    `A${body} ${body} 0 1 0 ${cx - body} ${cy}Z` +
    `M${cx - bore} ${cy}A${bore} ${bore} 0 1 1 ${cx + bore} ${cy}` +
    `A${bore} ${bore} 0 1 1 ${cx - bore} ${cy}Z`;

  const pitch = 360 / teeth;
  const half = toothDeg / 2;
  const tipHalf = half * 0.58; // slight taper reads as machined, not laser-cut
  let toothPaths = '';
  for (let i = 0; i < teeth; i += 1) {
    const mid = i * pitch;
    const pts = [
      polar(cx, cy, body - 3, mid - half),
      polar(cx, cy, tip, mid - tipHalf),
      polar(cx, cy, tip, mid + tipHalf),
      polar(cx, cy, body - 3, mid + half),
    ];
    toothPaths += `M${pts.map((p) => p.join(' ')).join('L')}Z`;
  }
  return { ring, toothPaths };
}

/** Centre-line arc path, for stroking (ringArc is a closed band). */
function arcCenterline(cx, cy, r, from, to) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `${a[0]} ${a[1]}A${r} ${r} 0 ${large} 1 ${b[0]} ${b[1]}`;
}

/** Annular sector with round ends — the gold orbit. */
function ringArc({ cx, cy, r, from, to, width }) {
  const ro = r + width / 2;
  const ri = Math.max(0.5, r - width / 2);
  const a = polar(cx, cy, ro, from);
  const b = polar(cx, cy, ro, to);
  const c = polar(cx, cy, ri, to);
  const d = polar(cx, cy, ri, from);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${a[0]} ${a[1]}A${nf(ro)} ${nf(ro)} 0 ${large} 1 ${b[0]} ${b[1]}` +
    `L${c[0]} ${c[1]}A${nf(ri)} ${nf(ri)} 0 ${large} 0 ${d[0]} ${d[1]}Z`;
}

/* --------------------------------------------------------------- palette */

const COLORS = {
  ink: '#0b1118',
  gold: 'url(#gGold)',
  goldFlat: '#e0b061',
  spark: 'url(#gSparks)',
};

const metalGradient = (id, stops) =>
  `<linearGradient id="${id}" x1="0.12" y1="0" x2="0.82" y2="1">` +
  stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') +
  '</linearGradient>';

const DEFS = `
  ${metalGradient('gMetal', [[0, '#ffffff'], [0.18, '#d3ddea'], [0.46, '#8f9cad'], [0.6, '#e6edf7'], [0.8, '#7d8a9c'], [1, '#c2cedd']])}
  ${metalGradient('gMetalLight', [[0, '#ffffff'], [0.3, '#e2eaf5'], [0.56, '#a7b4c6'], [0.76, '#edf3fb'], [1, '#96a4b7']])}
  ${metalGradient('gMetalDeep', [[0, '#5d6877'], [0.5, '#39424f'], [1, '#6f7c8d']])}
  ${metalGradient('gMetalDark', [[0, '#ffffff'], [0.2, '#cfd9e6'], [0.5, '#7b889a'], [0.65, '#dee7f2'], [1, '#8d9aac']])}
  ${metalGradient('gMetalLightDark', [[0, '#e9eff7'], [0.35, '#b6c2d2'], [0.6, '#8593a6'], [0.85, '#cfd9e6'], [1, '#9aa8bb']])}
  ${metalGradient('gMetalDeepDark', [[0, '#6b7888'], [0.5, '#4a5563'], [1, '#7d8a9a']])}
  <linearGradient id="gGold" x1="0" y1="0" x2="1" y2="0.7">
    <stop offset="0" stop-color="#f9e3ae"/><stop offset="0.35" stop-color="#e8b866"/>
    <stop offset="0.72" stop-color="#c89342"/><stop offset="1" stop-color="#f6d88f"/>
  </linearGradient>
  <linearGradient id="gSparks" x1="0" y1="0" x2="0.55" y2="1">
    <stop offset="0" stop-color="#cdf3ff"/><stop offset="0.45" stop-color="#3ab8f3"/>
    <stop offset="1" stop-color="#1d8ecd"/>
  </linearGradient>
  <linearGradient id="gCube" x1="0" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="#6fd6ff" stop-opacity="0.34"/>
    <stop offset="0.55" stop-color="#1d9fe0" stop-opacity="0.15"/>
    <stop offset="1" stop-color="#0f6ea6" stop-opacity="0.28"/>
  </linearGradient>`;

/* ------------------------------------------------------------------ emblem */

/**
 * The emblem: a machined gear ring holding an articulated arm that presents a
 * wireframe cube, with a gold orbit sweeping beneath it. Gear and joints carry
 * the engineering; the cube carries the ambition. Deliberately not a robot head
 * or a circuit trace, which are the two most generic possible answers.
 */
function emblemBody({ mono = false, light = false } = {}) {
  const ink = '#0b1118';
  const metal = mono ? ink : light ? 'url(#gMetalDark)' : 'url(#gMetal)';
  const metalDeep = mono ? ink : light ? 'url(#gMetalDeepDark)' : 'url(#gMetalDeep)';
  const metalLight = mono ? ink : light ? 'url(#gMetalLightDark)' : 'url(#gMetalLight)';
  const spokes = mono ? ink : light ? 'url(#gMetalDark)' : 'url(#gMetalLight)';
  const gold = mono ? ink : COLORS.gold;
  const spark = mono ? ink : COLORS.spark;
  const g = gear({});

  if (mono) {
    // Single ink. Solid silhouettes collapse into mud in one colour, so this is
    // drawn as line art: ring as outline, arm as filled strokes, cube as an open
    // outline. Prints, embosses and foils cleanly at any size.
    return `
  <g fill="none" stroke="${ink}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round">
    <path d="${g.ring}"/>
    <path d="${g.toothPaths}"/>
    <path d="M136 20 L166 37 L166 71 L136 88 L106 71 L106 37 Z"/>
    <path d="M106 37 L136 54 L166 37 M136 54 L136 88"/>
  </g>
  <g stroke="${ink}" stroke-linecap="round" fill="none">
    <path d="M60 146 L88 110" stroke-width="13"/>
    <path d="M88 110 L116 76" stroke-width="11"/>
  </g>
  <g fill="${ink}">
    <circle cx="60" cy="146" r="8.5"/>
    <circle cx="88" cy="110" r="6.6"/>
    <circle cx="126" cy="67" r="7"/>
  </g>
  <circle cx="135" cy="61" r="11.5" fill="none" stroke="${ink}" stroke-width="3.4"/>`;
  }

  return `
  <!-- spokes: four machined ribs so the ring reads as a structure, not a hoop -->
  <g fill="${spokes}" opacity="${light ? 0.9 : 0.75}">
    <path d="M97 34 L103 34 L103 66 L97 66 Z"/>
    <path d="M97 134 L103 134 L103 166 L97 166 Z"/>
    <path d="M34 97 L34 103 L66 103 L66 97 Z"/>
    <path d="M134 97 L134 103 L166 103 L166 97 Z"/>
  </g>

  <!-- gear ring: engineering, the discipline underneath the ambition -->
  <g fill="${metal}" fill-rule="evenodd">
    <path d="${g.ring}"/>
    <path d="${g.toothPaths}"/>
  </g>
  <path d="${g.ring}" fill="none" stroke="#f9fcff" stroke-opacity="${light ? 0.5 : 0.16}" stroke-width="0.8"/>
  <circle cx="100" cy="100" r="67" fill="none" stroke="${metalDeep}" stroke-width="4" opacity="0.9"/>
  <circle cx="100" cy="100" r="67" fill="none" stroke="#f9fcff" stroke-opacity="${light ? 0.55 : 0.35}" stroke-width="1"/>

  <!-- gold orbit: progress sweeping under the work, proud of the ring so it reads
       as a foreground element instead of tangling with the teeth -->
  <path d="${ringArc({ cx: 100, cy: 104, r: 83, from: 16, to: 214, width: 5.4 })}" fill="${gold}"/>
  <path d="${ringArc({ cx: 100, cy: 104, r: 83, from: 16, to: 214, width: 1.5 })}" fill="#fff8e6" opacity="0.45"/>

  <!-- articulated arm: segments taper, every joint is cased. A bare line reads as
       a stick rather than as a machine. -->
  <g stroke-linecap="round">
    <path d="M60 146 L88 110" stroke="${metalDeep}" stroke-width="20"/>
    <path d="M60 146 L88 110" stroke="${metal}" stroke-width="14.5"/>
    <path d="M65 140 L86 113" stroke="#f9fcff" stroke-opacity="0.55" stroke-width="3.2"/>
    <path d="M88 110 L116 76" stroke="${metalDeep}" stroke-width="17"/>
    <path d="M88 110 L116 76" stroke="${metalLight}" stroke-width="12"/>
    <path d="M92 105 L113 79" stroke="#f9fcff" stroke-opacity="0.5" stroke-width="2.8"/>
    <path d="M116 76 L129 66" stroke="${metal}" stroke-width="10"/>
  </g>

  <g>
    <circle cx="60" cy="146" r="12" fill="${metalDeep}"/>
    <circle cx="60" cy="146" r="8.4" fill="${metal}"/>
    <circle cx="60" cy="146" r="3.4" fill="${ink}"/>
    <circle cx="60" cy="146" r="3.4" fill="${spark}" opacity="0.6"/>
    <circle cx="88" cy="110" r="9.4" fill="${metalDeep}"/>
    <circle cx="88" cy="110" r="6.4" fill="${metalLight}"/>
    <circle cx="88" cy="110" r="2.5" fill="${ink}"/>
  </g>

  <!-- faceplate the arm presents: a ring, so the cube sits ON it -->
  <circle cx="135" cy="61" r="15" fill="${metalDeep}"/>
  <circle cx="135" cy="61" r="11" fill="${metal}"/>
  <circle cx="135" cy="61" r="6" fill="${ink}"/>
  <circle cx="135" cy="61" r="6" fill="${spark}" opacity="0.35"/>

  <!-- the cube: a wireframe idea held at the fingertips -->
  <g>
    <path d="M136 20 L166 37 L166 71 L136 88 L106 71 L106 37 Z"
          fill="url(#gCube)" stroke="${spark}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M106 37 L136 54 L166 37 M136 54 L136 88" stroke="${spark}"
          stroke-width="1.6" fill="none" opacity="0.85" stroke-linejoin="round"/>
    <path d="M136 20 L166 37 L166 71 L136 88 L106 71 L106 37 Z" fill="none"
          stroke="#d4f5ff" stroke-width="0.9" opacity="0.6"/>
  </g>`;
}

function emblemSvg({ mono = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img"
     aria-label="Peshawar Model Robotics Society">
  <title>PMRS</title>
  <defs>${DEFS}${mono ? '' : `
    <radialGradient id="gHalo" cx="0.5" cy="0.46" r="0.52">
      <stop offset="0" stop-color="#1f8fd4" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#1f8fd4" stop-opacity="0"/>
    </radialGradient>`}
  </defs>
  ${mono ? '' : '<circle cx="100" cy="100" r="99" fill="url(#gHalo)"/>'}
  ${emblemBody({ mono })}
</svg>
`;
}

/* ----------------------------------------------------------------- favicon */

/**
 * Below ~32px the arm, joints and gold orbit all collapse into mud. This keeps
 * the two marks that survive — the gear ring and the cube — and pushes contrast
 * hard: bright metal on the dark tile, no hairlines, one gold accent.
 */
function faviconSvg() {
  const teeth = 8;
  const pitch = 360 / teeth;
  const toothDeg = 17;
  const rootR = 20.5;
  const tipR = 25.5;
  let teethPaths = '';
  for (let i = 0; i < teeth; i += 1) {
    const mid = i * pitch;
    const pts = [
      polar(32, 32, rootR - 1, mid - toothDeg / 2),
      polar(32, 32, tipR, mid - toothDeg / 2.7),
      polar(32, 32, tipR, mid + toothDeg / 2.7),
      polar(32, 32, rootR - 1, mid + toothDeg / 2),
    ];
    teethPaths += `M${pts.map((p) => p.join(' ')).join('L')}Z`;
  }
  const ring =
    `M${32 - rootR} 32A${rootR} ${rootR} 0 1 0 ${32 + rootR} 32A${rootR} ${rootR} 0 1 0 ${32 - rootR} 32Z` +
    `M17 32A15 15 0 1 1 47 32A15 15 0 1 1 17 32Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="PMRS">
  <title>PMRS</title>
  <defs>
    <linearGradient id="fRing" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#cfdaea"/>
      <stop offset="0.7" stop-color="#94a3b6"/><stop offset="1" stop-color="#e6eefa"/>
    </linearGradient>
    <linearGradient id="fCube" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#8fe0ff"/><stop offset="1" stop-color="#1f9de0"/>
    </linearGradient>
    <linearGradient id="fGold" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="#f9e2ae"/><stop offset="1" stop-color="#d9a44e"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="13" fill="#0b1118"/>
  <g fill="url(#fRing)" fill-rule="evenodd"><path d="${ring}"/><path d="${teethPaths}"/></g>
  <path d="M12.4 47.6A22 22 0 0 1 14.8 19.6" fill="none" stroke="url(#fGold)"
        stroke-width="2.8" stroke-linecap="round"/>
  <path d="M32 12 L47.5 21 L47.5 40 L32 49 L16.5 40 L16.5 21 Z"
        fill="#1f9de0" fill-opacity="0.3" stroke="url(#fCube)" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M16.5 21 L32 30 L47.5 21 M32 30 L32 49" stroke="url(#fCube)" stroke-width="2"
        fill="none" stroke-linejoin="round" opacity="0.9"/>
</svg>
`;
}

/* ------------------------------------------------------------------ lockup */

/**
 * PMRS letterforms, drawn rather than typeset.
 *
 * Cap height 100, baseline y=0, stems 22. Squares terminals and a shallow M
 * centre are the details a webfont cannot reproduce. The M's centre vertex stops
 * short of the baseline and the S keeps a fully rounded spine, so the word reads
 * as letters and not as a bar chart.
 */
const WORD = {
  P: `M0 0 V100 H26 V62 H44 C70 62 86 49 86 31 C86 12 70 0 44 0 Z
      M26 18 H42 C56 18 62 23 62 31 C62 39 56 44 42 44 H26 Z`,
  M: `M0 100 V0 H26 L54 34 L82 0 H108 V100 H84 V34 L54 64 L24 34 V100 Z`,
  R: `M0 0 V100 H26 V63 H33 L53 100 H80 L56 59 C72 54 81 44 81 32
      C81 12 66 0 41 0 Z M26 18 H39 C52 18 58 23 58 31 C58 40 52 45 39 45 H26 Z`,
  S: `M46 0 C20 0 5 11 5 28 C5 43 15 51 33 55 L44 57 C55 59 61 63 61 70
      C61 78 53 83 41 83 C26 83 17 77 15 66 L0 66 C2 88 18 100 42 100
      C68 100 82 89 82 70 C82 54 72 46 53 42 L43 40 C33 38 27 34 27 28
      C27 21 33 16 44 16 C54 16 61 21 63 30 L78 30 C76 11 63 0 46 0 Z`,
};
const ADV = { P: 96, M: 120, R: 92, S: 90 };
const TRACK = 18;

function wordmark({ fill = 'url(#wMetal)', gold = 'url(#wGold)' } = {}) {
  let x = 0;
  const glyphs = [];
  const slash = (w) => `<path d="M${nf(w - 76)} 38 L${nf(w - 42)} 38 L${nf(w)} 100 L${nf(w - 34)} 100 Z" fill="${gold}"/>`;
  for (const ch of 'PMRS') {
    glyphs.push(
      `<path d="${WORD[ch].replace(/\s+/g, ' ').trim()}" transform="translate(${nf(x)} 0)" ` +
        `fill="${fill}" fill-rule="evenodd"/>`,
    );
    x += ADV[ch] + TRACK;
  }
  // The gold diagonal strikes the R's leg and breaks the baseline: the one
  // flourish in the lockup. Narrow, so the R still reads as an R.
  return `<g>${glyphs.join('')}${slash(x - TRACK)}</g>`;
}

function lockupSvg({ dark = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 200" role="img"
     aria-label="Peshawar Model Robotics Society">
  <title>Peshawar Model Robotics Society</title>
  <defs>${DEFS}
    <linearGradient id="wMetal" x1="0" y1="0" x2="0.28" y2="1">
      <stop offset="0" stop-color="${dark ? '#ffffff' : '#1d2a38'}"/>
      <stop offset="0.5" stop-color="${dark ? '#e9eff8' : '#2c3c4d'}"/>
      <stop offset="1" stop-color="${dark ? '#c6d2e1' : '#16222e'}"/>
    </linearGradient>
    <linearGradient id="wGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f9e3ae"/><stop offset="0.5" stop-color="#e0ae5c"/>
      <stop offset="1" stop-color="#f6d88f"/>
    </linearGradient>
  </defs>
  <g transform="translate(8 4) scale(0.96)">${emblemBody({ light: !dark })}</g>
  <g transform="translate(268 52) scale(0.94)">${wordmark()}</g>
</svg>
`;
}

/* -------------------------------------------------------------------- write */

const files = {
  'logo-mark.svg': emblemSvg(),
  'logo-mark-mono.svg': emblemSvg({ mono: true }),
  'logo-full.svg': lockupSvg({ dark: true }),
  'logo-full-light.svg': lockupSvg({ dark: false }),
  'favicon.svg': faviconSvg(),
};

for (const [name, svg] of Object.entries(files)) {
  writeFileSync(join(OUT, name), svg);
  console.log(`wrote public/assets/${name}  ${(svg.length / 1024).toFixed(1)} KB`);
}
