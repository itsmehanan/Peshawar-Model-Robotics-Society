/**
 * Theme.
 *
 * Order of operations matters more than it looks:
 *
 *  1. The stored preference (or the OS preference, on a first visit) is applied
 *     by an inline script in <head>, before the body paints. Doing it here in a
 *     module would show a flash of the wrong theme on every load, which is the
 *     single most obvious "this was assembled, not designed" tell there is.
 *  2. This module only handles switching, and keeps the browser chrome
 *     (theme-color meta, color-scheme) in step with the document.
 *  3. Cross-fading is done with the View Transitions API where it exists, so the
 *     change is a real dissolve rather than a hard cut. It is skipped entirely
 *     under prefers-reduced-motion, and falls back to an instant swap elsewhere.
 */

const KEY = 'pmrs-theme';
const ROOT = document.documentElement;

export const THEMES = ['dark', 'light'];

/** What the inline boot script decided, or a fresh read if it did not run. */
export function currentTheme() {
  const explicit = ROOT.getAttribute('data-theme');
  if (explicit === 'dark' || explicit === 'light') return explicit;
  // The site is a dark instrument by design; light is an explicit choice, not a
  // consequence of the OS setting.
  return 'dark';
}

/** 'dark' | 'light' | null — null means "follow the system". */
export function storedTheme() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function paint(theme) {
  ROOT.setAttribute('data-theme', theme);
  ROOT.style.colorScheme = theme;
  // Keep the mobile browser chrome in step with the page, or the address bar
  // stays near-black above a white page.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', theme === 'light' ? '#f3f4f7' : '#08080a');
  });
  // A failed event must never abort the theme change itself, and the event has to
  // be built from the document's own realm (a CustomEvent from another realm is
  // rejected by dispatchEvent).
  try {
    const EventCtor = document.defaultView?.CustomEvent || CustomEvent;
    window.dispatchEvent(new EventCtor('themechange', { detail: { theme } }));
  } catch {
    /* non-browser host, or an old engine: listeners simply do not fire */
  }
}

/**
 * Apply a theme. `withTransition` cross-dissolves the whole document; it is
 * opt-in because a page-level transition on first load is noise.
 */
export function setTheme(theme, { persist = true, withTransition = false } = {}) {
  const next = THEMES.includes(theme) ? theme : 'dark';
  if (persist) {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the theme still applies for this page */
    }
  }

  const canTransition =
    withTransition &&
    !reducedMotion() &&
    typeof document.startViewTransition === 'function' &&
    currentTheme() !== next;

  if (!canTransition) {
    paint(next);
    return Promise.resolve();
  }

  // The transition pseudo-elements are styled in CSS. The snapshot would
  // otherwise be taken mid-swap, so the paint has to happen inside the callback.
  const transition = document.startViewTransition(() => paint(next));
  return transition.finished.catch(() => {});
}

export function toggleTheme(event) {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  // Anchor the dissolve on the toggle itself, so the change reads as coming
  // from the control the user pressed rather than from nowhere.
  if (event?.currentTarget?.getBoundingClientRect) {
    const r = event.currentTarget.getBoundingClientRect();
    ROOT.style.setProperty('--theme-x', `${Math.round(r.left + r.width / 2)}px`);
    ROOT.style.setProperty('--theme-y', `${Math.round(r.top + r.height / 2)}px`);
  }
  return setTheme(next, { withTransition: true });
}

/** Wire every [data-theme-toggle] and keep its label/icon truthful. */
export function mountThemeToggle(root = document) {
  const buttons = root.querySelectorAll('[data-theme-toggle]');
  if (!buttons.length) return;

  const sync = () => {
    const theme = currentTheme();
    buttons.forEach((button) => {
      const isDark = theme === 'dark';
      // Say what pressing it will do, not what is currently shown: a button
      // labelled with the active theme is a classic toggle mistake.
      const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(!isDark));
      button.dataset.themeState = theme;
    });
  };

  buttons.forEach((button) => {
    if (button.dataset.themeWired === '1') return;
    button.dataset.themeWired = '1';
    button.addEventListener('click', (event) => {
      toggleTheme(event).then(sync);
    });
  });

  sync();
  window.addEventListener('themechange', sync);

  // No OS-following listener: dark is the designed default and light is a
  // deliberate switch, so a system theme change must not repaint the page.
}
