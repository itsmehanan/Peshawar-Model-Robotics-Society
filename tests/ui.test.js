/**
 * Browser-level smoke tests using jsdom against the real server.
 *
 * The client app imports browser modules; here we serve them through Node's
 * ESM loader inside a jsdom window so the actual production code runs (not a
 * copy of it). This is what catches "button does nothing" regressions.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data-ui-test');
fs.rmSync(DATA_DIR, { recursive: true, force: true });

process.env.DATA_DIR = DATA_DIR;
// Set TEST_DATABASE_URL to run this suite against a real hosted PostgreSQL.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PORT = '3998';
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = 'ui-admin@test.local';
process.env.ADMIN_PASSWORD = 'UiAdminPass123';

const { start } = await import('../server/index.js');
const server = await start();
const ORIGIN = 'http://127.0.0.1:3998';

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✗ ${name}\n    ${error.message}`);
  }
}

/* ------------------------------------------------------------------ boot */
const nodeFetch = globalThis.fetch;

/**
 * One shared cookie jar + request function for every window. The app modules
 * resolve the bare `fetch` binding, so a single global shim keeps sessions
 * consistent the way a browser profile would.
 */
const jar = new Map();
function serializeJar() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}
globalThis.fetch = async (input, options = {}) => {
  const url = String(input).startsWith('http') ? String(input) : `${ORIGIN}${input}`;
  const headers = { ...(options.headers || {}), Origin: ORIGIN };
  const cookie = serializeJar();
  if (cookie) headers.Cookie = cookie;
  const response = await nodeFetch(url, { ...options, headers });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(';')[0];
    const key = pair.slice(0, pair.indexOf('='));
    const value = pair.slice(pair.indexOf('=') + 1);
    if (!value) jar.delete(key);
    else jar.set(key, value);
  }
  return response;
};

async function bootWindow(route = '/') {
  const html = await (await nodeFetch(`${ORIGIN}${route}`)).text();
  const dom = new JSDOM(html, {
    url: `${ORIGIN}/${route === '/' ? '' : route}#/`,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.fetch = globalThis.fetch;
  dom.jar = jar;

  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.Element.prototype.scrollIntoView = () => {};
  window.Element.prototype.focus = function focus() {};
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);

  global.window = window;
  global.document = window.document;
  Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true, writable: true });
  // theme.js reads localStorage off the global, which jsdom scopes to the window
  Object.defineProperty(global, 'localStorage', { value: window.localStorage, configurable: true });
  global.HTMLElement = window.HTMLElement;
  global.Element = window.Element;
  global.Node = window.Node;
  global.RadioNodeList = window.RadioNodeList;
  global.FormData = window.FormData;
  global.URLSearchParams = window.URLSearchParams;
  global.MutationObserver = window.MutationObserver;
  global.FileReader = window.FileReader;
  global.getComputedStyle = window.getComputedStyle;
  global.IntersectionObserver = window.IntersectionObserver;
  global.MutationObserver = window.MutationObserver;
  global.Event = window.Event;
  global.FileReader = window.FileReader;

  return { dom, window };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 4000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await fn();
    if (value) return value;
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const text = () => global.document.getElementById('main')?.textContent || '';
const q = (sel) => global.document.querySelector(sel);
const qAll = (sel) => [...global.document.querySelectorAll(sel)];

/* ----------------------------------------------------------------- tests */
console.log('\nLanding page');

const { window } = await bootWindow('/');
const app = await import('../public/assets/js/main.js');
window.__app = app;

await test('renders the hero, nav and footer from API content', async () => {
  await waitFor(() => text().includes('Build something'), 5000, 'hero');
  assert.match(text(), /Fields of entry/);
  assert.ok(q('#siteFoot').textContent.includes('PMRS'), 'the footer names the society');
  // The cover plate is a real studio render shipped as a static asset
  // (WebP with a PNG fallback), framed by hairline guides and registration ticks.
  const plate = q('.plate .plate__object');
  assert.ok(plate, 'hero object must render');
  const plateImg = plate.querySelector('img');
  assert.ok(plateImg, 'hero object must contain an image');
  assert.match(plateImg.getAttribute('src'), /\/assets\/art\/hero-sm\.png$/);
  assert.ok(plate.querySelector('source[type="image/webp"]'), 'hero must offer WebP');
  assert.ok(q('.plate .plate__guides'), 'orbital guides must frame the object');
  assert.ok(q('.plate .plate__ticks span'), 'registration ticks must render');
  const cardMedia = q('.field-card .field-card__media img');
  assert.ok(cardMedia, 'field cards must carry artwork');
  assert.match(cardMedia.getAttribute('src'), /\/assets\/art\/field-/);
});

await test('the hidden modal backdrop cannot cover the page', async () => {
  // `[hidden]` is only `display: none` in the UA stylesheet, so a class rule that
  // sets `display` silently defeats it. `.modal-root` sets display:grid plus
  // position:fixed; inset:0 and a dark background, so the always-present
  // `<div id="modalRoot" hidden>` painted a full-screen veil over the entire site.
  // Assert the two things that make that impossible:
  const root = global.document.getElementById('modalRoot');
  assert.ok(root, 'the modal root must exist');
  assert.equal(root.hidden, true, 'the modal root starts closed');

  const css = fs.readFileSync(path.join(ROOT, 'public/assets/app.css'), 'utf8');
  assert.match(
    css,
    /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/,
    'a [hidden] override must exist, otherwise author display rules win',
  );

  // And a closed overlay must not be laid out at all.
  const cs = global.window.getComputedStyle(root);
  assert.notEqual(
    cs.display !== 'none' && cs.position === 'fixed',
    true,
    'the closed modal must not be a fixed full-screen layer',
  );

  // The guard must not stop a real modal from opening.
  root.hidden = false;
  assert.notEqual(
    global.window.getComputedStyle(root).display,
    'none',
    'an open modal must still render',
  );
  root.hidden = true;
});

await test('every artwork variant in the page resolves to a real file', async () => {
  // The helper used to append "-sm.png" to a base that already ended in ".png",
  // producing /assets/art/field-robotics.png-sm.png — a 404 on every browser
  // that fell back to the PNG <img>. Fetch each declared URL and insist on 200.
  const urls = new Set();
  for (const pic of qAll('picture')) {
    const img = pic.querySelector('img');
    if (img?.getAttribute('src')) urls.add(img.getAttribute('src'));
    for (const source of pic.querySelectorAll('source')) {
      for (const part of (source.getAttribute('srcset') || '').split(',')) {
        const url = part.trim().split(' ')[0];
        if (url) urls.add(url);
      }
    }
  }
  assert.ok(urls.size >= 8, `expected hero + card variants, found ${urls.size}`);
  const broken = [];
  for (const url of urls) {
    const res = await fetch(`${ORIGIN}${url}`, { method: 'GET' });
    if (res.status !== 200) broken.push(`${url} → ${res.status}`);
  }
  assert.deepEqual(broken, [], `broken artwork: ${broken.join(', ')}`);
});

await test('header shows Register, not the dashboard, when signed out', async () => {
  await waitFor(() => !q('[data-register-link]').hidden, 3000, 'register link');
  assert.ok(q('[data-auth-in]').hidden, 'dashboard link hidden when signed out');
});

await test('navigating to Fields renders four field cards', async () => {
  window.location.hash = '#/fields';
  await waitFor(() => text().includes('Pick the field'), 4000, 'fields page');
  assert.equal(q('.grid .field-card').parentElement.children.length >= 4, true);
});

await test('unknown route falls back to the 404 view', async () => {
  window.location.hash = '#/definitely-not-a-page';
  await waitFor(() => text().includes('That page is not here'), 4000, '404');
});

console.log('\nRegistration flow');

await test('register page renders the three team modes and the field selector', async () => {
  window.location.hash = '#/register';
  await waitFor(() => q('#registerForm'), 4000, 'register form');
  const modes = [...global.document.querySelectorAll('input[name="teamMode"]')].map((i) => i.value);
  assert.deepEqual(modes.sort(), ['create', 'join', 'none']);
  assert.equal(global.document.querySelectorAll('#reg-category option').length, 5);
});

await test('switching to "join" reveals the team finder', async () => {
  const join = global.document.querySelector('input[name="teamMode"][value="join"]');
  join.checked = true;
  join.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(120);
  assert.equal(q('#joinFields').hidden, false);
  assert.equal(q('#createFields').hidden, true);
});

await test('team finder explains that no teams exist yet', async () => {
  const school = q('#reg-school');
  school.value = 'UI Test School';
  school.dispatchEvent(new window.Event('change', { bubbles: true }));
  const field = q('#reg-category');
  field.value = 'robotics';
  field.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => q('#join-status').textContent.includes('No teams'), 4000, 'empty team list');
});

await test('submitting a valid registration navigates to the welcome page', async () => {
  const create = global.document.querySelector('input[name="teamMode"][value="create"]');
  create.checked = true;
  create.dispatchEvent(new window.Event('change', { bubbles: true }));

  q('#reg-name').value = 'UI Student';
  q('#reg-class').value = 'Grade 9';
  q('#reg-school').value = 'UI Test School';
  q('#reg-email').value = 'ui-student@test.local';
  q('#reg-password').value = 'password123';
  q('#reg-category').value = 'robotics';
  q('#reg-teamname').value = 'UI Breakers';
  q('#reg-teamcode').value = 'ui-passcode';
  q('#reg-max').value = '3';

  q('#registerForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => text().includes("You're on the list"), 6000, 'welcome page');
});

await test('header switches to "My dashboard" and hides Register after signing up', async () => {
  await waitFor(() => !q('[data-auth-in]').hidden, 3000, 'dashboard link');
  assert.ok(q('[data-register-link]').hidden, 'register link must be hidden once registered');
});

await test('revisiting #/register shows the already-registered view, not the form', async () => {
  window.location.hash = '#/dashboard'; // leave first so the hashchange fires
  await waitFor(() => text().includes('Student dashboard') || text().includes('Hello'), 4000, 'dashboard');
  window.location.hash = '#/register';
  await waitFor(() => text().includes('already on the list'), 4000, 'already registered view');
  assert.equal(q('#registerForm'), null, 'registration form must not be rendered again');
});

console.log('\nDashboard');

await test('dashboard lists the team and marks the leader', async () => {
  window.location.hash = '#/dashboard/team';
  await waitFor(() => window.location.hash === '#/dashboard/team' && text().includes('UI Breakers'), 4000, 'team view');
  await waitFor(() => q('#teamForm'), 4000, 'team settings form');
  assert.ok(text().includes('UI Breakers'), 'team name rendered');
  assert.ok(q('#teamForm'), 'leader sees team settings');
});

await test('profile edit saves and re-renders with new values', async () => {
  window.location.hash = '#/dashboard/profile';
  await waitFor(() => q('#profileForm'), 4000, 'profile form');
  q('#p-class').value = 'Grade 11';
  q('#p-project').value = 'UI rover';
  q('#profileForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => q('#p-class')?.value === 'Grade 11', 5000, 'saved class');
});

await test('field change on a team creates a pending request banner', async () => {
  window.location.hash = '#/dashboard/field';
  await waitFor(() => q('#fieldForm'), 4000, 'field form');
  q('#f-category').value = 'science';
  q('#fieldForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => text().includes('awaiting review'), 6000, 'pending banner');
});

console.log('\nSession persistence');

/**
 * A "refresh" is simulated by re-running the boot sequence in the same window:
 * the cookie jar survives, every module-level cache is cleared, and the route
 * re-resolves. That is exactly the sequence a browser performs on reload.
 */
async function reloadApp() {
  const store = await import('../public/assets/js/store.js');
  const api = await import('../public/assets/js/api.js');
  api.invalidateContent();
  await store.boot();
  await window.__app.reroute();
}

await test('a reload keeps the student signed in (server session, not storage)', async () => {
  assert.ok(jar.has('orbit_sid'), 'a session cookie must exist');
  jar.set('orbit_sid', jar.get('orbit_sid')); // unchanged across "restart"
  window.location.hash = '#/dashboard';
  await reloadApp();
  await waitFor(() => text().includes('Preparation checklist'), 8000, 'dashboard after reload');
  assert.ok(q('[data-register-link]').hidden, 'register stays hidden after reload');
  assert.equal(window.localStorage.length, 0, 'no app state may live in localStorage');
});

await test('signing out clears the session and restores the Register button', async () => {
  q('[data-action="logout"]').click();
  await waitFor(() => !q('[data-register-link]').hidden, 6000, 'register button back');
  assert.ok(!jar.has('orbit_sid'), 'session cookie removed');
  window.location.hash = '#/dashboard';
  await reloadApp();
  await waitFor(() => text().includes('Sign in to see your entry'), 6000, 'signed-out dashboard');
});

console.log('\nAdmin');

await test('admin page requires sign-in and shows the login form', async () => {
  window.location.hash = '#/admin';
  await reloadApp();
  await waitFor(() => q('#adminLoginForm'), 6000, 'admin login form');
  assert.ok(!text().includes('Registered students'), 'no admin data before sign-in');
});

await test('admin sign-in loads the dashboard with real metrics', async () => {
  q('#a-email').value = 'ui-admin@test.local';
  q('#a-password').value = 'UiAdminPass123';
  q('#adminLoginForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => text().includes('Registered students'), 8000, 'admin overview');
  assert.match(text(), /Pending requests/);
});

await test('the admin section menu is collapsed on a phone, not covering the panel', async () => {
  // The 14-row section list used to be a sticky sidebar at every width, so on a
  // phone it filled the viewport and pushed the actual panel off-screen.
  const menu = q('[data-admin-menu]');
  assert.ok(menu, 'the admin menu must be a <details> so it can collapse');
  assert.equal(menu.open, false, 'on a narrow viewport the menu starts collapsed');
  assert.ok(q('.admin-menu__toggle'), 'a phone needs a visible way to open it');
  // Opening it is a plain <details> toggle, so it still works without JS.
  menu.open = true;
  assert.equal(menu.open, true, 'the menu can be opened');
  menu.open = false;
});

await test('the section menu opens on a desktop and collapses on a phone', async () => {
  // Driven through the real mount path: build the page, run mountAdmin, read the
  // <details> state. Going through a hash change is unreliable here because the
  // route is already #/admin/... and re-rendering is asynchronous.
  const { adminPage, mountAdmin } = await import('../public/assets/js/pages/admin.js');
  const main = global.document.getElementById('main');
  const renderWith = async (wide) => {
    window.matchMedia = (query) => ({
      matches: wide && query.includes('min-width: 980px'),
      addEventListener() {},
      removeEventListener() {},
    });
    main.innerHTML = adminPage({ section: 'overview' });
    await mountAdmin(main, { section: 'overview', navigate: () => {}, refresh: async () => {} });
    return main.querySelector('[data-admin-menu]').open;
  };
  assert.equal(await renderWith(true), true, 'a desktop sidebar stays open');
  assert.equal(await renderWith(false), false, 'a phone menu starts collapsed');
  // restore the narrow default and re-render the real page for later tests
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.location.hash = '#/admin/students';
  await waitFor(() => text().includes('ui-student@test.local'), 8000, 'students table');
});

await test('an admin session replaces the Register button', async () => {
  // The screenshot that started this had "Register" in the header while the
  // organiser was signed in — the header only tracked the student session.
  const adminLink = q('[data-admin-in]');
  assert.ok(adminLink, 'the header needs an admin affordance');
  assert.equal(adminLink.hidden, false, 'Admin panel link is shown to a signed-in organiser');
  for (const node of document.querySelectorAll('[data-auth-out]')) {
    assert.equal(node.hidden, true, 'signed-in admin must not be offered Sign in / Register');
  }
});

await test('admin students table lists the registered student', async () => {
  window.location.hash = '#/admin/students';
  await waitFor(() => text().includes('ui-student@test.local'), 8000, 'students table');
});

await test('admin branding form renders current site name', async () => {
  window.location.hash = '#/admin/site';
  await waitFor(() => q('#settingsForm'), 8000, 'site settings');
  assert.equal(q('#settingsForm').elements.name.value, 'PMRS');
});

await test('approving the pending request moves the team field', async () => {
  window.location.hash = '#/admin/requests';
  await waitFor(() => text().includes('Pending field changes'), 8000, 'requests page');
  const approve = q('[data-approve]');
  assert.ok(approve, 'an approve button must exist');
  approve.click();
  await waitFor(() => text().includes('No pending requests'), 9000, 'approval applied');
});

/* --------------------------------------------------------------- report */
const failed = results.filter((r) => !r.ok);

/* ------------------------------------------------------------------ brand */

await test('the logo is the PMRS emblem, not a letter in a box', async () => {
  const mark = q('.site-head .brand__img');
  assert.ok(mark, 'the header shows a logo image');
  const src = mark.getAttribute('src');
  assert.ok(
    src === '/assets/logo-mark.svg' || src.startsWith('http'),
    `expected the SVG emblem, got ${src}`,
  );
  // The old mark was a rotated <span> holding a monogram. It must be gone, or the
  // favicon, header and footer disagree about what the society looks like.
  assert.equal(q('.site-head .brand__mark'), null, 'the monogram box is gone');
});

await test('the document carries the PMRS identity, not the old name', async () => {
  const title = window.document.title;
  assert.ok(/Peshawar Model Robotics Society/i.test(title), `title was "${title}"`);
  assert.ok(!/orbit/i.test(title), 'no leftover event name in the title');
  const desc = q('meta[name="description"]').getAttribute('content');
  assert.ok(!/orbit/i.test(desc), 'no leftover event name in the description');
});

/* ------------------------------------------------------------------ theme */

await test('the theme is applied before paint, so there is no flash', async () => {
  const html = window.document.documentElement;
  assert.ok(['dark', 'light'].includes(html.getAttribute('data-theme')));
  // The inline boot script must be in <head>, ahead of the module that mounts
  // the UI: a theme set from a deferred module flashes the wrong palette first.
  const inline = Array.from(window.document.head.querySelectorAll('script')).find(
    (s) => !s.src && /pmrs-theme/.test(s.textContent || ''),
  );
  assert.ok(inline, 'the inline theme boot script is present');
});

await test('the theme toggle switches, persists and relabels itself', async () => {
  const { currentTheme, storedTheme, mountThemeToggle } = await import('../public/assets/js/theme.js');
  mountThemeToggle(window.document);
  const button = q('[data-theme-toggle]');
  assert.ok(button, 'a theme toggle exists');

  const before = currentTheme();
  assert.match(button.getAttribute('aria-label'), /switch to/i, 'the label describes the action');

  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  const after = currentTheme();
  assert.notEqual(after, before, 'the theme actually changed');
  assert.equal(storedTheme(), after, 'the choice was persisted');
  assert.equal(window.document.documentElement.getAttribute('data-theme'), after);
  assert.match(button.getAttribute('aria-label'), after === 'light' ? /dark/i : /light/i);

  // put it back so later tests see the default
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
});

console.log(`\n${results.length - failed.length}/${results.length} browser tests passed`);

await new Promise((resolve) => server.close(resolve));
fs.rmSync(DATA_DIR, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
