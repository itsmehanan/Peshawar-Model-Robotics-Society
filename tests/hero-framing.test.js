/** Regression guard: the glass hero and its scroll/pointer controller remain wired. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=(file)=>fs.readFileSync(new URL(file,import.meta.url),'utf8');
const home=read('../public/assets/js/pages/home.js');
const boot=read('../public/assets/js/hero-boot.js');
const scene=read('../public/assets/js/hero3d-target.js');
const css=read('../public/assets/pmrs-studio.css');
assert.match(home,/bootHero3D/);
assert.match(home,/data-hero-canvas/);
assert.match(boot,/hero3d-target\.js/);
assert.match(scene,/transmission\s*:\s*1/);
assert.match(scene,/pointermove/);
assert.match(scene,/scroll/);
assert.doesNotMatch(home,/target-hero-poster|target-legacy-assets|assets\/art\/hero(?:-sm)?\.(?:png|webp)/i);
assert.match(css,/\.pmrs-target-home \.target-canvas\{position:absolute/);
console.log('Glass hero regression: scroll-opening 3D canvas and pointer response are restored without the gear poster.');
