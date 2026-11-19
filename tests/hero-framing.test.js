/**
 * Retired hero-art regression guard.
 * The mechanical gear/clock visual is no longer part of any public entry route.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('public/assets/js/pages/home.js');
const admin = read('public/assets/js/pages/admin.js');
const auth = read('public/assets/js/pages/auth.js');
const css = read('public/assets/pmrs-studio.css');

assert.doesNotMatch(home, /hero-boot|target-hero-poster|data-hero-canvas|target-legacy-assets|assets\/art\/hero(?:-sm)?\.(?:png|webp)/i);
assert.doesNotMatch(admin, /assets\/art\/hero(?:-sm)?\.(?:png|webp)/i);
assert.doesNotMatch(auth, /assets\/art\/hero(?:-sm)?\.(?:png|webp)/i);
assert.match(css, /\.auth-art::before,\.auth-art::after\{display:none!important/);
assert.match(css, /\.pmrs-target-home \.target-menu-toggle\{flex:0 0 40px/);
console.log('Hero artwork regression: gear/clock artwork is absent from homepage and sign-in routes.');
