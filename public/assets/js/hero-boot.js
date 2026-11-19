/**
 * Hero loader. Loads the pinned Three.js module and the reference scene only
 * when the homepage hero approaches the viewport.
 */
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
  if (!stage || stage.dataset.hero3d === 'mounted' || stage.dataset.hero3d === 'loading') return null;
  const canvas = stage.querySelector('[data-hero-canvas]');
  if (!canvas) return null;

  // Keep the still poster as the complete experience when motion or data
  // saving is requested. Do this before probing WebGL so the state is stable
  // on devices and in browsers without a graphics context.
  if (prefersCalm() || saveData()) {
    stage.dataset.hero3d = 'static';
    stage.classList.add('hero-3d-static');
    return null;
  }

  if (!supportsWebGL()) {
    stage.dataset.hero3d = 'unsupported';
    stage.classList.add('hero-3d-unavailable');
    return null;
  }

  stage.dataset.hero3d = 'loading';
  try {
    // Loads the reference Three.js scene for the scroll-driven glass robotics module.
    const module = await import('./hero3d-target.js');
    if (!stage.isConnected) return null;

    const controller = module.mountHeroScene(canvas, {
      reducedMotion: prefersCalm() || saveData(),
    });

    if (!controller.firstFrame()) {
      controller.dispose();
      stage.dataset.hero3d = 'error';
      return null;
    }

    canvas.hidden = false;
    canvas.classList.add('is-live');
    stage.classList.add('has-3d');
    stage.dataset.hero3d = 'mounted';

    canvas.addEventListener('herocontextlost', () => {
      canvas.classList.remove('is-live');
      stage.dataset.hero3d = 'context-lost';
      stage.classList.remove('has-3d');
    }, { once: true });

    return controller;
  } catch (error) {
    stage.dataset.hero3d = 'error';
    stage.classList.add('hero-3d-unavailable');
    console.error('[PMRS] 3D hero failed to initialise:', error);
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
      if (entries.some((entry) => entry.isIntersecting)) {
        io.disconnect();
        mountHero3D(stage);
      }
    },
    { rootMargin: '200px' },
  );
  io.observe(stage);
}


/** Mount the same glass-and-circuit 3D object in a sign-in side panel. */
export async function bootAuth3D(root) {
  const stage = root?.querySelector('[data-auth-3d-stage]');
  const canvas = stage?.querySelector('[data-auth-hero-canvas]');
  if (!stage || !canvas || stage.dataset.hero3d === 'loading' || stage.dataset.hero3d === 'mounted') return;
  stage.dataset.hero3d = 'loading';
  try {
    const module = await import('./hero3d-target.js');
    if (!stage.isConnected) return;
    const controller = module.mountHeroScene(canvas, { reducedMotion: prefersCalm() });
    if (!controller.firstFrame()) { controller.dispose(); stage.dataset.hero3d = 'error'; return; }
    stage.dataset.hero3d = 'mounted';
    canvas.classList.add('is-live');
    canvas.addEventListener('herocontextlost', () => {
      stage.dataset.hero3d = 'context-lost';
      canvas.classList.remove('is-live');
    }, { once: true });
  } catch (error) {
    stage.dataset.hero3d = 'error';
    console.error('[PMRS] Sign-in 3D object failed to initialise:', error);
  }
}
