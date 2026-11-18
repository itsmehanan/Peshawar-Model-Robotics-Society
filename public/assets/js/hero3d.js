/**
 * Hero centrepiece — a machined arm presenting a wireframe cube.
 *
 * Built in Three.js so the object is genuinely dimensional: it can rotate, catch
 * light and respond to a pointer, none of which a flat render can do. It is
 * composed after the brand emblem (gear ring, articulated arm, wireframe cube,
 * gold orbit) so the site's hero and its logo describe the same idea.
 *
 * Constraints that shaped this file:
 *
 *  - It is a SIDE EFFECT of loading, not an API other code awaits. The hero must
 *    paint its poster image immediately; the 3D only replaces it once it has
 *    actually rendered a frame.
 *  - Everything is merged into as few meshes as possible. A dozen separate
 *    draw calls for a decorative object is a phone battery tax for no gain.
 *  - Rendering is capped at 2x DPR and pauses when the hero scrolls out of view.
 *  - If anything here fails — no WebGL, a lost context, a slow device — the
 *    caller keeps the poster image and the page is unaffected.
 */
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CylinderGeometry,
  Clock,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js';

const GOLD = 0xd8a44e;
const STEEL = 0x9dabbd;
const DARK = 0x2b3542;
const BLUE = 0x35b6ea;

/** Place a cylinder between two points — the primitive every arm segment uses. */
function strut(a, b, radius, material) {
  const start = new Vector3(...a);
  const end = new Vector3(...b);
  const dir = end.clone().sub(start);
  const len = dir.length();
  const geo = new CylinderGeometry(radius, radius, len, 20, 1, false);
  const mesh = new Mesh(geo, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
  return mesh;
}

/** A joint: a dark casing with a bright pin, so it reads as machined. */
function joint(at, radius, metalDark, metalBright) {
  const group = new Group();
  const casing = new Mesh(new SphereGeometry(radius, 24, 16), metalDark);
  casing.position.set(...at);
  const pin = new Mesh(new SphereGeometry(radius * 0.52, 16, 12), metalBright);
  pin.position.set(...at);
  group.add(casing, pin);
  return group;
}

/**
 * Framing constants, measured rather than guessed.
 *
 * The scene's world-space bounds are 4.42 x 4.42 x 0.84 centred on the origin
 * (ring radius plus teeth, plus the cube on top). These two values were solved
 * against that bounding box so the subject fills the same share of the stage in
 * any aspect ratio, and the same share as the poster it fades in over.
 */
const FOV = 40;
const FRAME_FILL = 0.9;
/* Measured from the assembled scene, not from the ring radius. The tilted gold
   orbit torus reaches wider than the gear, so the subject is 5.08 across and
   4.39 tall, centred exactly on the origin. Earlier values taken from the gear
   radius (2.21) or guessed upward (2.9) both cropped it, in opposite aspects.
   The two axes are separate because the subject is not square. */
const SUBJECT_HALF_W = 2.54;
const SUBJECT_HALF_H = 2.2;

/**
 * Distance at which the subject occupies `fill` of the tighter axis.
 *
 * Solved from the projection rather than tuned by hand: for a given field of
 * view the visible half-height at distance d is d * tan(fov/2), and the visible
 * half-width is that times the aspect. Taking the tighter of the two gives the
 * distance that fits, with the depth of the object folded in so it does not
 * poke out of frame when lit from an angle.
 */
function fitDistance(camera, fill) {
  const halfFov = (camera.fov * Math.PI) / 360;
  // Visible half-height at distance d is d * tan(fov/2); half-width adds aspect.
  const needVertical = SUBJECT_HALF_H / (Math.tan(halfFov) * fill);
  const needHorizontal = SUBJECT_HALF_W / (Math.tan(halfFov) * camera.aspect * fill);
  return Math.max(needVertical, needHorizontal);
}

export function mountHeroScene(canvas, { reducedMotion = false } = {}) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.16, 7.4);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearAlpha(0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  /* ------------------------------------------------------------ materials */
  const steel = new MeshStandardMaterial({ color: STEEL, metalness: 0.94, roughness: 0.26 });
  const steelDark = new MeshStandardMaterial({ color: DARK, metalness: 0.8, roughness: 0.5 });
  const steelBright = new MeshStandardMaterial({ color: 0xe8eff8, metalness: 0.9, roughness: 0.18 });
  const gold = new MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.22 });
  const glow = new MeshStandardMaterial({
    color: BLUE,
    emissive: new Color(BLUE),
    emissiveIntensity: 1.5,
    metalness: 0.2,
    roughness: 0.4,
  });

  /* ---------------------------------------------------------------- stage */
  const root = new Group();
  scene.add(root);

  // Gear ring: a torus plus extruded teeth, merged into one group.
  const ring = new Group();
  const band = new Mesh(new TorusGeometry(1.92, 0.15, 20, 96), steel);
  ring.add(band);
  const teeth = 12;
  for (let i = 0; i < teeth; i += 1) {
    const a = (i / teeth) * Math.PI * 2;
    const tooth = new Mesh(new BoxGeometry(0.3, 0.2, 0.14), steel);
    tooth.position.set(Math.cos(a) * 2.06, Math.sin(a) * 2.06, 0);
    tooth.rotation.z = a;
    ring.add(tooth);
  }
  // inner rim, a touch darker so the ring has depth at the bore
  const innerRim = new Mesh(new TorusGeometry(1.62, 0.05, 12, 84), steelDark);
  ring.add(innerRim);
  // slight tilt: a perfectly face-on ring looks like a sticker
  ring.rotation.set(0.16, -0.24, 0.1);
  root.add(ring);

  // Gold orbit, in its own tilted plane so it reads as an independent path.
  const orbit = new Mesh(new TorusGeometry(2.32, 0.028, 10, 128), gold);
  orbit.rotation.set(1.24, 0.42, -0.2);
  root.add(orbit);

  // The arm presents the cube from inside the ring.
  const arm = new Group();
  const shoulder = [-0.95, -0.95, 0.18];
  const elbow = [-0.18, -0.22, 0.02];
  const wrist = [0.42, 0.42, -0.06];
  arm.add(
    strut(shoulder, elbow, 0.13, steel),
    strut(elbow, wrist, 0.1, steelBright),
    joint(shoulder, 0.19, steelDark, steel),
    joint(elbow, 0.14, steelDark, steelBright),
  );
  arm.rotation.z = -0.06;
  root.add(arm);

  // Faceplate + cube held at the fingertips.
  const face = new Group();
  face.position.set(0.62, 0.62, -0.06);
  face.add(
    new Mesh(new CylinderGeometry(0.2, 0.2, 0.07, 28), steelDark),
    new Mesh(new CylinderGeometry(0.13, 0.13, 0.1, 24), steel),
  );
  face.rotation.x = Math.PI / 2;
  root.add(face);

  const cube = new Group();
  cube.position.set(0.78, 1.18, 0.12);

  // The enclosure is built as moving panels around a visible circuit core.
  // Scroll progress separates these pieces; it is not a flat texture or poster.
  const shellMaterial = new MeshStandardMaterial({
    color: BLUE, metalness: 0.18, roughness: 0.16,
    transparent: true, opacity: 0.2,
    emissive: new Color(BLUE), emissiveIntensity: 0.28,
  });
  const shellTop = new Group();
  const shellBottom = new Group();
  const topPanel = new Mesh(new BoxGeometry(0.82, 0.39, 0.82), shellMaterial);
  topPanel.position.y = 0.215;
  const bottomPanel = new Mesh(new BoxGeometry(0.82, 0.39, 0.82), shellMaterial);
  bottomPanel.position.y = -0.215;
  shellTop.add(topPanel);
  shellBottom.add(bottomPanel);
  cube.add(shellTop, shellBottom);

  const edges = new LineSegments(
    new EdgesGeometry(new BoxGeometry(0.82, 0.82, 0.82)),
    new LineBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.7 }),
  );
  cube.add(edges);

  const circuit = new Group();
  const board = new Mesh(
    new BoxGeometry(0.58, 0.045, 0.58),
    new MeshStandardMaterial({ color: 0x172b2b, metalness: 0.72, roughness: 0.32 }),
  );
  circuit.add(board);
  const chip = new Mesh(
    new BoxGeometry(0.22, 0.075, 0.22),
    new MeshStandardMaterial({ color: 0x252b32, metalness: 0.82, roughness: 0.24 }),
  );
  chip.position.y = 0.075;
  circuit.add(chip);
  const traceMaterial = new MeshStandardMaterial({ color: GOLD, metalness: 0.9, roughness: 0.25 });
  for (const [x, z, sx, sz] of [
    [-0.17, 0, 0.16, 0.018], [0.17, 0, 0.16, 0.018],
    [0, -0.17, 0.018, 0.16], [0, 0.17, 0.018, 0.16],
    [-0.2, -0.2, 0.1, 0.018], [0.2, 0.2, 0.1, 0.018],
  ]) {
    const trace = new Mesh(new BoxGeometry(sx, 0.012, sz), traceMaterial);
    trace.position.set(x, 0.04, z);
    circuit.add(trace);
  }
  const pinMaterial = new MeshStandardMaterial({ color: 0xe7bd83, metalness: 1, roughness: 0.18 });
  for (let i = 0; i < 4; i += 1) {
    const pin = new Mesh(new BoxGeometry(0.035, 0.04, 0.035), pinMaterial);
    pin.position.set((i % 2 ? 1 : -1) * 0.27, 0.04, (i < 2 ? 1 : -1) * 0.27);
    circuit.add(pin);
  }
  cube.add(circuit);
  cube.rotation.set(0.42, 0.62, 0.1);
  root.add(cube);

  /* ---------------------------------------------------------------- light */
  // A key light, a cool rim from behind, a warm bounce from below, and a small
  // blue point light inside the cube. Together they give the metal something to
  // actually reflect, which is what separates a lit object from a flat one.
  const key = new DirectionalLight(0xffffff, 3.1);
  key.position.set(3.4, 4.6, 5.2);
  const rim = new DirectionalLight(0x8fd8ff, 2.2);
  rim.position.set(-4.2, 1.6, -3.4);
  const bounce = new DirectionalLight(0xffc478, 0.85);
  bounce.position.set(1.2, -4.2, 1.6);
  const core = new PointLight(BLUE, 9, 3.4, 2);
  core.position.set(0.78, 1.18, 0.4);
  scene.add(key, rim, bounce, core);

  /* ---------------------------------------------------------------- input */
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let pointerActive = false;

  const onPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    pointerActive = true;
  };

  // Listen on the hero, not the canvas: the canvas is behind the copy, and
  // pointer events must keep working over the text.
  const stage = canvas.closest('[data-hero-stage]') || canvas.parentElement;
  stage?.addEventListener('pointermove', onPointer, { passive: true });
  stage?.addEventListener('pointerleave', () => {
    pointerActive = false;
    pointer.x = 0;
    pointer.y = 0;
  }, { passive: true });

  /* ----------------------------------------------------------------- size */
  const resize = () => {
    const parent = canvas.parentElement;
    const w = parent?.clientWidth || canvas.clientWidth || 1;
    const h = parent?.clientHeight || canvas.clientHeight || 1;
    // Cap DPR: a 3x phone renderer draws 9x the pixels for no visible gain.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit the object to the box instead of guessing a distance.
    //
    // The subject is a tall disc in a square frame. A fixed camera distance
    // either crops it in a portrait box or leaves it small in a wide one, and
    // the small version is what makes the poster-to-canvas swap visible: the
    // poster's emblem nearly touches its frame, so a canvas subject at 72% reads
    // as a jump. FRAME_FILL is measured to match the poster's silhouette.
    camera.fov = FOV;
    camera.position.z = fitDistance(camera, FRAME_FILL);
    camera.updateProjectionMatrix();
  };

  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);
  resize();

  /* ----------------------------------------------------------------- loop */
  const clock = new Clock();
  const scrollSection = stage.closest('.hero');
  let scrollProgress = 0;
  let scrollFrame = 0;
  const updateScrollProgress = () => {
    scrollFrame = 0;
    if (!scrollSection) return;
    const rect = scrollSection.getBoundingClientRect();
    const travel = Math.max(1, scrollSection.offsetHeight - window.innerHeight);
    scrollProgress = Math.max(0, Math.min(1, -rect.top / travel));
  };
  const onScroll = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollProgress);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  updateScrollProgress();
  let frame = 0;
  let running = true;
  let visible = true;
  let disposed = false;

  const renderFrame = () => {
    const t = clock.getElapsedTime();

    // Idle motion is slow and layered — the ring, the orbit and the cube turn at
    // different rates, which is what keeps it from looking like one rigid object
    // spinning on a turntable.
    if (!reducedMotion) {
      ring.rotation.z = 0.1 + t * 0.025;
      orbit.rotation.z = -0.2 - t * 0.045;
      cube.rotation.y = 0.62 + t * 0.08;
      cube.rotation.x = 0.42 + Math.sin(t * 0.32) * 0.035;
      arm.rotation.z = -0.06 + Math.sin(t * 0.28) * 0.012;
      core.intensity = 8 + Math.sin(t * 1.1) * 1.2;
    }

    // A measured scroll timeline: rotate the mechanism, lift the lid, lower
    // the base and expose the circuit board in distinct stages.
    const p = scrollProgress;
    root.rotation.y += p * 0.48;
    root.rotation.x += Math.sin(p * Math.PI) * 0.08;
    ring.rotation.z += p * 0.2;
    orbit.rotation.z -= p * 0.34;
    shellTop.position.y = p * 0.78;
    shellTop.rotation.x = -p * 0.34;
    shellBottom.position.y = -p * 0.42;
    shellBottom.rotation.x = p * 0.18;
    circuit.position.y = p * 0.18;
    circuit.scale.setScalar(1 + p * 0.12);
    edges.material.opacity = 0.7 - p * 0.42;
    core.intensity = 8 + p * 5;

    // Pointer parallax, eased. Small on purpose: the object should feel
    // attentive, not glued to the cursor.
    target.x += ((pointerActive ? pointer.x : 0) * 0.2 - target.x) * 0.045;
    target.y += ((pointerActive ? pointer.y : 0) * 0.14 - target.y) * 0.045;
    root.rotation.y = target.x;
    root.rotation.x = target.y * 0.7;
    root.position.y = Math.sin(t * 0.5) * (reducedMotion ? 0 : 0.045);

    renderer.render(scene, camera);
    frame = requestAnimationFrame(renderFrame);
  };

  const start = () => {
    if (disposed || !visible || !running) return;
    cancelAnimationFrame(frame);
    renderFrame();
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  // Do not burn a phone's battery animating something scrolled off-screen.
  const visibility = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    },
    { threshold: 0.01 },
  );
  visibility.observe(canvas);

  const onHidden = () => {
    running = document.visibilityState === 'visible';
    if (running) start();
    else stop();
  };
  document.addEventListener('visibilitychange', onHidden);

  // Context loss (mobile GPU reclaim, tab suspended a long time) is recoverable
  // but not worth fighting: hand the poster back and stop.
  let contextLost = false;
  const onLost = (event) => {
    event.preventDefault();
    contextLost = true;
    stop();
    canvas.dispatchEvent(new CustomEvent('herocontextlost', { bubbles: true }));
  };
  canvas.addEventListener('webglcontextlost', onLost);

  start();

  return {
    /** Render one frame now — used to prove the scene works before revealing it. */
    firstFrame() {
      renderer.render(scene, camera);
      return !contextLost;
    },
    start,
    stop,
    dispose() {
      disposed = true;
      stop();
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(scrollFrame);
      canvas.removeEventListener('webglcontextlost', onLost);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
    },
  };
}
