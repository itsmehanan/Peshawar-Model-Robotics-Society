/**
 * Hero loader.
 *
 * The 3D scene is a bundled side module (hero3d.build.js, tree-shaken Three.js)
 * that is only fetched once the hero is on screen — it must never sit in the
 * critical path of a page that already paints a static poster.
 *
 * Progressive enhancement, in order:
 *   1. Respect reduced-motion and save-data: keep the poster, do nothing.
 *   2. No WebGL: keep the poster, do nothing.
 *   3. Scene fails to build or frame: keep the poster, do nothing.
 *   4. Success: the canvas fades in over the poster.
 */
const POSTER_FADE_MS = 0;

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

function prefersCalm() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function saveData() {
  const conn = navigator.connection;
  return Boolean(conn?.saveData) || /(^|-)2g$/.test(conn?.effectiveType || '');
}

export async function mountHero3D(stage) {
  if (!stage || stage.dataset.hero3d === 'mounted') return null;
  const canvas = stage.querySelector('[data-hero-canvas]');
  if (!canvas) return null;

  // Reduced motion gets the still render, deliberately: a slowly rotating metal
  // object is exactly the kind of ambient movement that setting exists to stop.
  if (!supportsWebGL()) {
    stage.dataset.hero3d = 'unsupported';
    stage.classList.add('hero-3d-unavailable');
    return null;
  }
  // The object itself remains rendered for reduced-motion and data-saver users;
  // only scroll/idle movement is reduced in the scene.

  try {
    const module = await import('./hero3d.js');
    if (stage.dataset.hero3d === 'mounted') return null;

    const controller = module.mountHeroScene(canvas, {
      reducedMotion: prefersCalm() || saveData(),
    });
    // Prove a frame renders before showing anything, so a driver that silently
    // produces a black canvas never replaces a good poster.
    if (!controller.firstFrame()) {
      controller.dispose();
      stage.dataset.hero3d = 'static';
      return null;
    }

    canvas.hidden = false;
    requestAnimationFrame(() => {
      canvas.classList.add('is-live');
      stage.dataset.hero3d = 'mounted';
    });
    stage.classList.add('has-3d');

    canvas.addEventListener('herocontextlost', () => {
      canvas.classList.remove('is-live');
      canvas.hidden = true;
      stage.dataset.hero3d = 'static';
      stage.classList.remove('has-3d');
    });

    return controller;
  } catch {
    // Anything at all — a blocked chunk, a shader compile failure, a driver
    // quirk — leaves the poster in place. The hero is never empty.
    stage.dataset.hero3d = 'error';
    stage.classList.add('hero-3d-unavailable');
    return null;
  }
}

/** Observe the hero and load the scene when it comes into view. */
export function bootHero3D() {
  const stage = document.querySelector('[data-hero-stage]');
  if (!stage) return;
  stage.dataset.hero3d = 'pending';

  if (!('IntersectionObserver' in window)) {
    mountHero3D(stage);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        mountHero3D(stage);
      }
    },
    { rootMargin: '200px' },
  );
  io.observe(stage);
}
