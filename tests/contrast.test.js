/**
 * Theme contrast guard.
 *
 * Both themes are hand-authored ramps, so a colour can be changed in one place
 * and quietly fail AA somewhere else -- which is exactly how nine hardcoded dark
 * values ended up leaking into the light theme. This reads app.css, resolves the
 * tokens through their var() aliases, and measures the pairs that carry text.
 *
 * Static by design: no browser needed, so it runs in CI and on every push.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'public/assets/app.css'), 'utf8');

function tokenBlock(selector) {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`missing token block: ${selector}`);
  const open = css.indexOf('{', at);
  let depth = 0;
  let close = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) { close = i; break; }
    }
  }
  const out = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const themes = {
  dark: tokenBlock(':root {'),
  light: tokenBlock(":root[data-theme='light']"),
};

const resolveToken = (tokens, value) => {
  let out = value;
  for (let guard = 0; out?.startsWith('var(') && guard < 8; guard++) out = tokens[out.slice(4, -1).trim()];
  return out;
};

const toRgb = (value) => {
  if (!value?.startsWith('#')) return null;
  const hex = value.length === 4 ? value.slice(1).split('').map((d) => d + d).join('') : value.slice(1);
  if (hex.length !== 6) return null;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Every pair here carries body or label text that a person has to read. */
const PAIRS = [
  ['body text', '--ink', '--bg'],
  ['secondary text', '--ink-2', '--bg'],
  ['muted text', '--ink-3', '--bg'],
  ['gold eyebrow', '--gold', '--bg'],
  ['notice bar', '--ink-2', '--surface-0'],
  ['modal footer', '--ink-2', '--surface-1'],
  ['field text', '--ink', '--field-bg'],
  ['field placeholder', '--ink-3', '--field-bg'],
  ['danger toast', '--danger', '--toast-danger-bg'],
  ['success toast', '--ok', '--toast-ok-bg'],
  ['label on gold', '--on-gold', '--gold'],
];

let failures = 0;
for (const [label, tokens] of Object.entries(themes)) {
  for (const [name, fgToken, bgToken] of PAIRS) {
    const fg = toRgb(resolveToken(tokens, tokens[fgToken]));
    const bg = toRgb(resolveToken(tokens, tokens[bgToken]));
    if (!fg || !bg) {
      console.error(`  ✗ ${label}: ${name} — could not resolve ${fgToken} on ${bgToken}`);
      failures++;
      continue;
    }
    const ratio = contrast(fg, bg);
    if (ratio < 4.5) {
      console.error(`  ✗ ${label}: ${name} is ${ratio.toFixed(2)}:1 (needs 4.5:1)`);
      failures++;
    }
  }
}

if (failures) {
  console.error(`\n${failures} text pair(s) below WCAG AA in one or both themes.`);
  process.exit(1);
}
console.log(`Theme contrast: ${PAIRS.length} pairs meet WCAG AA in both themes.`);
