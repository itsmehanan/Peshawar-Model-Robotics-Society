/**
 * Hero centrepiece — Transparent Glass Robotics Module (Exploded-View Assembly).
 *
 * Built in Three.js with MeshPhysicalMaterial glass/transmission, brushed steel,
 * internal PCB processor core, precision gear mechanism, and signal-orange
 * (#FF4D14) accent gaskets.
 *
 * Scroll-driven exploded-view animation:
 *  - As the user scrolls, the top and bottom polycarbonate/glass shells separate
 *    vertically to reveal the internal circuit board and gear assembly.
 *  - Mouse parallax on desktop only.
 *  - Capped at 2x DPR, pauses when off-screen, and falls back to the static
 *    poster image if WebGL is unavailable or prefers-reduced-motion is set.
 */
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  Clock,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  PMREMGenerator,
  Scene,
  TorusGeometry,
  WebGLRenderer,
} from 'three';

const ACCENT_ORANGE = 0xff4d14;
const BRUSHED_STEEL = 0xa8aeb8;
const DARK_ANODIZED = 0x1a1b1e;
const PCB_DARK = 0x101418;
const COPPER_GOLD = 0xd49b4b;

function createGearMesh(teeth, innerR, outerR, thickness, material) {
  const group = new Group();
  const ringGeo = new CylinderGeometry(outerR * 0.86, outerR * 0.86, thickness, 32);
  const ring = new Mesh(ringGeo, material);
  group.add(ring);

  const hubGeo = new CylinderGeometry(innerR, innerR, thickness * 1.4, 24);
  const hub = new Mesh(hubGeo, material);
  group.add(hub);

  const toothGeo = new BoxGeometry((outerR - outerR * 0.82) * 1.4, thickness * 0.92, (outerR * 2 * Math.PI) / (teeth * 2.3));
  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    const tooth = new Mesh(toothGeo, material);
    const r = outerR * 0.9;
    tooth.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    tooth.rotation.y = -angle;
    group.add(tooth);
  }
  return group;
}

export function mountHero3D(canvas) {
  if (!canvas) return () => {};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return () => {};

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return () => {};
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.35, 6.2);

  // Studio lighting for glass & brushed metal reflections
  const ambient = new AmbientLight(0xffffff, 0.65);
  scene.add(ambient);

  const keyLight = new DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const rimLight = new DirectionalLight(0xdbe8ff, 1.6);
  rimLight.position.set(-5, 3, -4);
  scene.add(rimLight);

  const orangeFill = new PointLight(ACCENT_ORANGE, 2.4, 8);
  orangeFill.position.set(-2.2, -1.4, 2.5);
  scene.add(orangeFill);

  // Subtle procedural environment for realistic glass/metal reflections
  try {
    const pmrem = new PMREMGenerator(renderer);
    const envScene = new Scene();
    const l1 = new DirectionalLight(0xffffff, 3);
    l1.position.set(5, 5, 5);
    envScene.add(l1);
    const l2 = new DirectionalLight(ACCENT_ORANGE, 1.2);
    l2.position.set(-5, -2, 3);
    envScene.add(l2);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  } catch {
    // Fallback gracefully if PMREM fails on older WebGL1 contexts
  }

  // Materials
  const glassMat = new MeshPhysicalMaterial({
    color: 0xeef3f8,
    metalness: 0.05,
    roughness: 0.08,
    transmission: 0.78,
    thickness: 0.6,
    ior: 1.48,
    transparent: true,
    opacity: 0.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });

  const steelMat = new MeshStandardMaterial({
    color: BRUSHED_STEEL,
    metalness: 0.88,
    roughness: 0.24,
  });

  const darkMetalMat = new MeshStandardMaterial({
    color: DARK_ANODIZED,
    metalness: 0.72,
    roughness: 0.36,
  });

  const orangeMat = new MeshStandardMaterial({
    color: ACCENT_ORANGE,
    metalness: 0.25,
    roughness: 0.42,
    emissive: ACCENT_ORANGE,
    emissiveIntensity: 0.18,
  });

  const pcbMat = new MeshStandardMaterial({
    color: PCB_DARK,
    metalness: 0.35,
    roughness: 0.55,
  });

  const copperMat = new MeshStandardMaterial({
    color: COPPER_GOLD,
    metalness: 0.9,
    roughness: 0.2,
  });

  const wireMat = new LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
  });

  // Root assembly
  const root = new Group();
  root.rotation.set(0.32, -0.48, 0.08);
  scene.add(root);

  // 1. Top Glass Shell
  const topShell = new Group();
  const topBoxGeo = new BoxGeometry(2.15, 0.46, 2.15);
  const topBox = new Mesh(topBoxGeo, glassMat);
  topBox.position.y = 0.48;
  topShell.add(topBox);

  const topEdges = new LineSegments(new EdgesGeometry(topBoxGeo), wireMat);
  topEdges.position.copy(topBox.position);
  topShell.add(topEdges);

  // Orange corner bumpers on top shell
  const bumperGeo = new BoxGeometry(0.24, 0.14, 0.24);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bumper = new Mesh(bumperGeo, orangeMat);
      bumper.position.set(sx * 0.98, 0.28, sz * 0.98);
      topShell.add(bumper);
    }
  }
  root.add(topShell);

  // 2. Internal AI Processor & PCB Core
  const coreGroup = new Group();
  const pcbGeo = new BoxGeometry(1.85, 0.12, 1.85);
  const pcb = new Mesh(pcbGeo, pcbMat);
  coreGroup.add(pcb);

  // Central AI die + copper heatsink fins
  const dieGeo = new BoxGeometry(0.68, 0.18, 0.68);
  const die = new Mesh(dieGeo, steelMat);
  die.position.y = 0.12;
  coreGroup.add(die);

  const dieAccent = new Mesh(new BoxGeometry(0.36, 0.04, 0.36), orangeMat);
  dieAccent.position.y = 0.22;
  coreGroup.add(dieAccent);

  // Copper pins / traces around the die
  const pinGeo = new BoxGeometry(0.06, 0.05, 0.14);
  for (let i = -3; i <= 3; i++) {
    const p1 = new Mesh(pinGeo, copperMat);
    p1.position.set(i * 0.12, 0.08, 0.56);
    coreGroup.add(p1);
    const p2 = new Mesh(pinGeo, copperMat);
    p2.position.set(i * 0.12, 0.08, -0.56);
    coreGroup.add(p2);
  }
  root.add(coreGroup);

  // 3. Precision Gear Mechanism (below PCB)
  const gearGroup = new Group();
  gearGroup.position.y = -0.22;

  const mainGear = createGearMesh(16, 0.22, 0.72, 0.12, steelMat);
  gearGroup.add(mainGear);

  const subGear = createGearMesh(10, 0.12, 0.42, 0.12, darkMetalMat);
  subGear.position.set(0.68, 0, 0.52);
  gearGroup.add(subGear);

  const accentRing = new Mesh(new TorusGeometry(0.86, 0.035, 16, 48), orangeMat);
  accentRing.rotation.x = Math.PI / 2;
  gearGroup.add(accentRing);

  root.add(gearGroup);

  // 4. Bottom Glass Shell
  const bottomShell = new Group();
  const botBoxGeo = new BoxGeometry(2.15, 0.42, 2.15);
  const botBox = new Mesh(botBoxGeo, glassMat);
  botBox.position.y = -0.54;
  bottomShell.add(botBox);

  const botEdges = new LineSegments(new EdgesGeometry(botBoxGeo), wireMat);
  botEdges.position.copy(botBox.position);
  bottomShell.add(botEdges);

  // Brushed steel base plate
  const basePlate = new Mesh(new BoxGeometry(1.9, 0.08, 1.9), darkMetalMat);
  basePlate.position.y = -0.74;
  bottomShell.add(basePlate);
  root.add(bottomShell);

  // Resize handling
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Scroll-driven exploded view + desktop mouse parallax
  let scrollProgress = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;
  let currentMouseX = 0;
  let currentMouseY = 0;

  const onScroll = () => {
    const maxScroll = Math.max(window.innerHeight * 0.85, 400);
    scrollProgress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const isDesktop = window.matchMedia('(pointer: fine)').matches;
  const onPointerMove = (e) => {
    if (!isDesktop) return;
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 0.35;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 0.25;
  };
  if (isDesktop) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  }

  // Pause when off-screen
  let visible = true;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    },
    { threshold: 0.02 }
  );
  io.observe(canvas);

  const clock = new Clock();
  let rafId = 0;
  let firstFrame = true;

  function tick() {
    rafId = requestAnimationFrame(tick);
    if (!visible) return;

    const t = clock.getElapsedTime();

    // Smooth mouse parallax
    currentMouseX += (targetMouseX - currentMouseX) * 0.06;
    currentMouseY += (targetMouseY - currentMouseY) * 0.06;

    // Gentle idle rotation + scroll-driven rotation
    root.rotation.y = -0.48 + t * 0.16 + scrollProgress * 0.65 + currentMouseX;
    root.rotation.x = 0.32 + Math.sin(t * 0.4) * 0.04 + currentMouseY;

    // Exploded-view separation driven by scrollProgress (with subtle breathing)
    const explode = scrollProgress * 0.72;
    topShell.position.y = explode * 1.1;
    coreGroup.position.y = explode * 0.15;
    gearGroup.position.y = -0.22 - explode * 0.35;
    bottomShell.position.y = -explode * 0.95;

    // Internal gear rotation
    mainGear.rotation.y = t * 0.45;
    subGear.rotation.y = -t * 0.72;

    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      canvas.hidden = false;
      canvas.dataset.ready = '1';
    }
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener('scroll', onScroll);
    if (isDesktop) window.removeEventListener('pointermove', onPointerMove);
    renderer.dispose();
  };
}
