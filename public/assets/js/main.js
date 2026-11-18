/**
 * Application entry.
 *
 * Boot order matters:
 *   1. fetch session + public content (so "registered" is known before paint)
 *   2. render chrome that depends on it
 *   3. resolve the first route
 */
import { state, boot, subscribe, syncChrome } from './store.js';
import { route, setFallback, resolve, currentPath } from './router.js';
import {
  mountReveal,
  mountFaq,
  toast,
  closeModal,
  modalOpen,
  esc,
  linkLabels,
  mountNavToggle,
  mountTilt,
  mountCounters,
  mountProgress,
} from './ui.js';
import { renderFooter, syncActiveNav, setMobileNav } from './chrome.js';
import { mountThemeToggle } from './theme.js';

import { homePage, mountHome } from './pages/home.js';
import { fieldsPage, fieldDetailPage } from './pages/fields.js';
import { journalPage, articlePage } from './pages/journal.js';
import { aboutPage, mountAbout } from './pages/about.js';
import { contactPage } from './pages/contact.js';
import { registerPage, mountRegister } from './pages/register.js';
import { loginPage, mountLogin, welcomePage } from './pages/auth.js';
import { dashboardPage, mountDashboard } from './pages/dashboard.js';
import { adminPage, mountAdmin } from './pages/admin.js';

const mount = document.getElementById('main');

/* --------------------------------------------------------------- render */
let lastScroll = 0;

async function paint(builder, afterMount) {
  const path = currentPath();
  // Preserve scroll for same-page re-render (dashboard tabs), reset otherwise.
  const sameSection = document.body.dataset.lastRoute === path.split('/').slice(0, 3).join('/');
  if (!sameSection) lastScroll = 0;

  mount.innerHTML = builder();
  mount.querySelectorAll('[data-link]').forEach((a) => {
    a.setAttribute('data-navigable', 'true');
  });
  linkLabels(mount);
  syncActiveNav(path.replace(/^\//, ''));
  syncChrome();
  mountReveal(mount);
  mountFaq(mount);
  mountTilt(mount);
  mountCounters(mount);
  await afterMount?.();
  document.body.dataset.lastRoute = path.split('/').slice(0, 3).join('/');
  if (!sameSection) window.scrollTo({ top: lastScroll, behavior: 'instant' in window ? 'instant' : 'auto' });
  mount.focus({ preventScroll: true });
}

const notFound = () =>
  paint(
    () => `<div class="view"><section class="section">
      <div class="wrap wrap--narrow center">
        <span class="eyebrow eyebrow--plain">404</span>
        <h1 class="display display--sm mt-2">That page is not here.</h1>
        <p class="lede mt-2" style="margin-inline:auto">The link may be old, or the page was renamed by the organisers.</p>
        <div class="row mt-3" style="justify-content:center">
          <a class="btn btn--solid" href="#/" data-link>Back to the start</a>
          <a class="btn btn--ghost" href="#/fields" data-link>Fields of entry</a>
        </div>
      </div>
    </section></div>`,
  );

/* --------------------------------------------------------------- routes */
route('/', () =>
  paint(
    () => homePage(),
    () => mountHome(mount),
  ),
);

route('/fields', () =>
  paint(
    () => fieldsPage(),
    () => mountReveal(mount),
  ),
);

route('/fields/:id', (params) => paint(() => fieldDetailPage({ id: params.id })));

route('/journal', () => paint(() => journalPage()));

route('/journal/:slug', (params) => paint(() => articlePage({ slug: params.slug })));

route('/about', () =>
  paint(
    () => aboutPage(),
    () => mountAbout(mount),
  ),
);

route('/contact', () => paint(() => contactPage()));

route('/register', (_params, query) =>
  paint(
    () => registerPage({ query }),
    () => mountRegister(mount, { navigate: (to) => (window.location.hash = to.replace(/^#/, '')) }),
  ),
);

route('/login', () =>
  paint(
    () => loginPage(),
    () => mountLogin(mount, { navigate: (to) => (window.location.hash = to.replace(/^#/, '')) }),
  ),
);

route('/welcome', () => paint(() => welcomePage()));

route('/dashboard', () => renderDashboard('overview'));
route('/dashboard/:section', (params) => renderDashboard(params.section));

function renderDashboard(section) {
  return paint(
    () => dashboardPage({ section }),
    () =>
      mountDashboard(mount, {
        navigate: (to) => (window.location.hash = to.replace(/^#/, '')),
        refresh: () => resolve(),
      }),
  );
}

route('/admin', () =>
  paint(
    () => adminPage({ section: 'overview' }),
    () =>
      mountAdmin(mount, {
        section: 'overview',
        navigate: (to) => (window.location.hash = to.replace(/^#/, '')),
        refresh: () => resolve(),
      }),
  ),
);

route('/admin/:section', (params) =>
  paint(
    () => adminPage({ section: params.section }),
    () =>
      mountAdmin(mount, {
        section: params.section,
        navigate: (to) => (window.location.hash = to.replace(/^#/, '')),
        refresh: () => resolve(),
      }),
  ),
);

setFallback(notFound);

/* ------------------------------------------------------------ boot logic */
async function start() {
  // Wire the app shell immediately. Never make the first paint or navigation
  // depend on API requests completing; the server embeds enough content for
  // the homepage to render while session/content refreshes happen in parallel.
  mountNavToggle();
  mountThemeToggle();
  mountProgress();

  window.addEventListener('hashchange', () => {
    closeModal();
    setMobileNav(false);
    lastScroll = 0;
    resolve();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-link]')) setMobileNav(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modalOpen()) closeModal();
  });

  const head = document.getElementById('siteHead');
  const onScroll = () => head?.classList.toggle('is-stuck', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // boot() applies embedded content synchronously, then refreshes the API in
  // the background. Paint immediately so a slow/unavailable API cannot leave
  // visitors staring at an empty page with an inert header.
  const bootPromise = boot();
  if (state.content) {
    renderFooter();
    syncChrome();
    await resolve();
  } else {
    mount.innerHTML = `<div class="view"><section class="section"><div class="wrap wrap--narrow center">
      <h1 class="display display--sm">Peshawar Model Robotics Society</h1>
      <p class="lede mt-2">Loading the exhibition…</p>
    </div></section></div>`;
  }

  subscribe(() => {
    syncChrome();
    renderFooter();
  });

  bootPromise.then(async () => {
    if (!state.content) {
      toast('Some content could not load. Showing the available page while the connection is restored.', 'error');
      return;
    }
    renderFooter();
    syncChrome();
    // Refresh auth-dependent labels and the public content when the API settles.
    await resolve();
  }).catch((error) => {
    console.error('[PMRS] Application boot failed:', error);
    if (!state.content) {
      mount.innerHTML = `<div class="view"><section class="section"><div class="wrap wrap--narrow center">
        <h1 class="display display--sm">The site could not load.</h1>
        <p class="lede mt-2" style="margin-inline:auto">${esc(error.message)}</p>
        <button class="btn btn--solid mt-2" onclick="location.reload()">Try again</button>
      </div></section></div>`;
    }
  });
}

/** Exposed for tests and for re-running a route without a hash change. */
export { paint, resolve as reroute };

start();

// Keep other tabs in sync: a sign-out in one tab clears the header in the rest.
window.addEventListener('storage', (event) => {
  if (event.key === null) window.location.reload();
});
