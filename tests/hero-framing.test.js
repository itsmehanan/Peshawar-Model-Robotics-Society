/**
 * Hero framing guard.
 *
 * The original hero was a flat render stretched to fit its box, and the brief
 * called that out by name. A 3D replacement can fail the same way for a subtler
 * reason: a camera distance tuned on one screen crops the subject on another, or
 * leaves it small enough that the poster-to-canvas fade reads as a jump.
 *
 * This rebuilds the scene graph (geometry only, no renderer needed) and projects
 * its REAL vertices through the same camera math the app uses, at six aspect
 * ratios from a wide desktop to a narrow phone.
 *
 * Note it projects vertices rather than bounding-box corners. A box corner at
 * (+2.54, +2.20, +2.87) is a point no part of the object occupies -- the orbit
 * reaches x=2.54 only near z=0 -- so corners report clipping that does not
 * happen. That mistake cost an hour of chasing a nonexistent bug.
 */
import * as THREE from 'three';

const { PerspectiveCamera, Vector3, Group, Mesh, BoxGeometry, TorusGeometry } = THREE;

// Must match hero3d.js
const FOV = 40;
const FRAME_FILL = 0.9;
const SUBJECT_HALF_W = 2.54;
const SUBJECT_HALF_H = 2.2;

function fitDistance(camera, fill) {
  const halfFov = (camera.fov * Math.PI) / 360;
  const needVertical = SUBJECT_HALF_H / (Math.tan(halfFov) * fill);
  const needHorizontal = SUBJECT_HALF_W / (Math.tan(halfFov) * camera.aspect * fill);
  return Math.max(needVertical, needHorizontal);
}

function buildScene() {
  const root = new Group();

  const ring = new Group();
  ring.add(new Mesh(new TorusGeometry(1.92, 0.15, 20, 96)));
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const tooth = new Mesh(new BoxGeometry(0.3, 0.2, 0.14));
    tooth.position.set(Math.cos(angle) * 2.06, Math.sin(angle) * 2.06, 0);
    tooth.rotation.z = angle;
    ring.add(tooth);
  }
  ring.add(new Mesh(new TorusGeometry(1.62, 0.05, 12, 84)));
  ring.rotation.set(0.16, -0.24, 0.1);
  root.add(ring);

  const orbit = new Mesh(new TorusGeometry(2.32, 0.028, 10, 128));
  orbit.rotation.set(1.24, 0.42, -0.2);
  root.add(orbit);

  const cube = new Group();
  cube.position.set(0.78, 1.18, 0.12);
  cube.add(new Mesh(new BoxGeometry(0.82, 0.82, 0.82)));
  cube.rotation.set(0.42, 0.62, 0.1);
  root.add(cube);

  root.updateMatrixWorld(true);
  return root;
}

function sampleVertices(root) {
  const points = [];
  const v = new Vector3();
  root.traverse((object) => {
    if (!object.isMesh) return;
    const position = object.geometry.attributes.position;
    const step = Math.max(1, Math.floor(position.count / 400));
    for (let i = 0; i < position.count; i += step) {
      v.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      points.push(v.clone());
    }
  });
  return points;
}

const scene = buildScene();
const points = sampleVertices(scene);
const failures = [];

if (points.length < 500) failures.push(`only ${points.length} vertices sampled; the scene may be incomplete`);

const ASPECTS = [
  ['ultrawide 2.40', 2.4],
  ['desktop 1.40', 1.4],
  ['square 1.00', 1.0],
  ['phone 0.85', 0.85],
  ['narrow 0.55', 0.55],
  ['narrowest 0.42', 0.42],
];

const rows = [];
for (const [label, aspect] of ASPECTS) {
  const camera = new PerspectiveCamera(FOV, aspect, 0.1, 100);
  camera.aspect = aspect;
  camera.fov = FOV;
  camera.position.set(0, 0.16, fitDistance(camera, FRAME_FILL));
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    const p = point.clone().project(camera);
    maxX = Math.max(maxX, Math.abs(p.x));
    maxY = Math.max(maxY, Math.abs(p.y));
  }
  const fill = Math.max(maxX, maxY);
  rows.push({ label, aspect, maxX, maxY, fill });

  if (maxX > 1 || maxY > 1) {
    failures.push(`${label}: subject is cropped (x ${(maxX * 100).toFixed(0)}%, y ${(maxY * 100).toFixed(0)}%)`);
  }
  // Too small is also a failure: it would make the crossfade from the poster
  // visible as a shrink. The poster emblem fills ~95% of its frame.
  if (fill < 0.75) {
    failures.push(`${label}: subject fills only ${(fill * 100).toFixed(0)}% of the frame, so the poster swap will jump`);
  }
}

for (const row of rows) {
  console.log(
    `  ${row.label.padEnd(15)} x ${(row.maxX * 100).toFixed(0).padStart(3)}%  y ${(row.maxY * 100).toFixed(0).padStart(3)}%`,
  );
}

if (failures.length) {
  console.error('');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nHero framing failed at ${failures.length} point(s).`);
  process.exit(1);
}
console.log(`Hero framing: fully in frame and well-scaled at ${ASPECTS.length} aspect ratios.`);
