import * as THREE from 'three';
import type { CarRig, WheelRig } from './carRig';


const WHEEL_RADIUS = 0.35;
const WHEEL_X = 1.4;
const WHEEL_Z = 0.8;
const ARCH_RADIUS = 0.44;

// ---------- lofted surfaces ----------

// Smooth 1D profile through (x, value) control points
function profile(points: [number, number][]) {
  const curve = new THREE.SplineCurve(points.map(([x, v]) => new THREE.Vector2(x, v)));
  const samples = curve.getPoints(600);
  return (x: number) => {
    if (x <= samples[0].x) return samples[0].y;
    for (let i = 1; i < samples.length; i++) {
      const b = samples[i];
      if (x <= b.x) {
        const a = samples[i - 1];
        return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
      }
    }
    return samples[samples.length - 1].y;
  };
}

interface LoftSpec {
  xMin: number;
  xMax: number;
  top: (x: number) => number;
  bottom: (x: number) => number;
  halfWidth: (x: number) => number;
  exponent: number; // superellipse squareness of the cross-section
  endRound: number; // length over which the ends close into rounded caps
}

// Cross-section at x, sampled at angle phi (−π/2 = underside, 0 = right side, π/2 = top)
function sectionPoint(spec: LoftSpec, x: number, phi: number, inflate = 1) {
  const { xMin, xMax, endRound: e } = spec;
  let r = 1;
  if (x > xMax - e) r = Math.sqrt(Math.max(0, 1 - ((x - (xMax - e)) / e) ** 2));
  if (x < xMin + e) r = Math.sqrt(Math.max(0, 1 - ((xMin + e - x) / e) ** 2));
  const top = spec.top(x);
  const bottom = spec.bottom(x);
  const yc = (top + bottom) / 2;
  const hy = ((top - bottom) / 2) * (0.35 + 0.65 * r) * inflate;
  const hz = spec.halfWidth(x) * r * inflate;
  const p = 2 / spec.exponent;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return new THREE.Vector3(
    x,
    yc + hy * Math.sign(s) * Math.pow(Math.abs(s), p),
    hz * Math.sign(c) * Math.pow(Math.abs(c), p)
  );
}

// Builds the surface (or a patch of it) as a grid of cross-sections
function loftGeometry(
  spec: LoftSpec,
  opts: { x0?: number; x1?: number; phi0?: number; phi1?: number; inflate?: number; stations?: number; segments?: number } = {}
) {
  const x0 = opts.x0 ?? spec.xMin;
  const x1 = opts.x1 ?? spec.xMax;
  const phi0 = opts.phi0 ?? -Math.PI / 2;
  const phi1 = opts.phi1 ?? (3 * Math.PI) / 2;
  const N = opts.stations ?? 180;
  const M = opts.segments ?? 64;
  const full = opts.x0 === undefined && opts.x1 === undefined;

  const positions: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // Denser stations near the ends of a full loft so the caps round smoothly
    const x = full ? x0 + (x1 - x0) * (0.5 - 0.5 * Math.cos(Math.PI * u)) : x0 + (x1 - x0) * u;
    for (let j = 0; j <= M; j++) {
      const v = sectionPoint(spec, x, phi0 + (phi1 - phi0) * (j / M), opts.inflate ?? 1);
      positions.push(v.x, v.y, v.z);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j;
      const b = (i + 1) * (M + 1) + j;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Sill line that lifts over each wheel to form the arches
const archedBottom = (base: (x: number) => number) => (x: number) => {
  let y = base(x);
  for (const wx of [-WHEEL_X, WHEEL_X]) {
    const d = x - wx;
    if (Math.abs(d) < ARCH_RADIUS) {
      y = Math.max(y, WHEEL_RADIUS + Math.sqrt(ARCH_RADIUS * ARCH_RADIUS - d * d) - 0.02);
    }
  }
  return y;
};

const BODY: LoftSpec = {
  xMin: -2.32,
  xMax: 2.32,
  top: profile([
    [-2.32, 0.74], [-2.1, 0.88], [-1.7, 0.94], [-1.1, 0.95], [-0.3, 0.92],
    [0.6, 0.9], [1.2, 0.84], [1.75, 0.76], [2.1, 0.64], [2.32, 0.5],
  ]),
  bottom: archedBottom(profile([[-2.32, 0.4], [-2.05, 0.3], [0, 0.26], [2.05, 0.28], [2.32, 0.36]])),
  halfWidth: profile([
    [-2.32, 0.78], [-2.0, 0.92], [-1.4, 0.97], [-0.5, 0.92], [0.5, 0.92],
    [1.4, 0.95], [1.95, 0.9], [2.32, 0.72],
  ]),
  exponent: 4.2,
  endRound: 0.22,
};

const CABIN: LoftSpec = {
  xMin: -1.62,
  xMax: 0.72,
  top: profile([
    [-1.62, 0.9], [-1.25, 1.1], [-0.75, 1.27], [-0.25, 1.3], [0.2, 1.2], [0.72, 0.88],
  ]),
  bottom: () => 0.62,
  halfWidth: profile([[-1.62, 0.66], [-0.9, 0.78], [-0.1, 0.8], [0.72, 0.74]]),
  exponent: 3.2,
  endRound: 0.35,
};

// Code-built coupe used until a downloaded model is available. Faces +X, sits on y = 0.
export function buildProceduralCar(options: {
  useEnvironment: boolean;
  paint: string;
  caliper: string;
}): CarRig {
  const metalBoost = options.useEnvironment ? 1 : 0.5;
  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(options.paint),
    metalness: 0.6 * metalBoost,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x04070a,
    metalness: 0.4,
    roughness: 0.03,
    clearcoat: 1,
    clearcoatRoughness: 0.0,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0a0c0f, roughness: 0.5, metalness: 0.3 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a2e34, metalness: 0.9 * metalBoost, roughness: 0.25 });
  const rimLip = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.95 * metalBoost, roughness: 0.18 });
  const disc = new THREE.MeshStandardMaterial({ color: 0x6a6e74, metalness: 0.7 * metalBoost, roughness: 0.35 });
  const caliper = new THREE.MeshStandardMaterial({ color: new THREE.Color(options.caliper), roughness: 0.35, metalness: 0.2 });
  const headlight = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, emissive: 0xeaf6ff, emissiveIntensity: 0 });
  const taillight = new THREE.MeshStandardMaterial({ color: 0x2a0508, emissive: 0xff0a1a, emissiveIntensity: 0 });

  const disposables: { dispose: () => void }[] = [
    paint, glass, trim, tire, rimMat, rimLip, disc, caliper, headlight, taillight,
  ];
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    disposables.push(geo);
    return new THREE.Mesh(geo, mat);
  };

  const root = new THREE.Group();

  // Sprung mass: everything that pitches and rolls on the suspension
  const body = new THREE.Group();
  root.add(body);

  const pan = mesh(new THREE.BoxGeometry(3.9, 0.06, 1.2), trim);
  pan.position.y = 0.27;
  body.add(pan);
  body.add(mesh(loftGeometry(BODY), paint));
  const patch = (mat: THREE.Material, o: Parameters<typeof loftGeometry>[1]) =>
    body.add(mesh(loftGeometry(BODY, { stations: 24, segments: 16, inflate: 1.006, ...o }), mat));
  // Swept LED headlights wrapping the front corners
  patch(headlight, { x0: 1.9, x1: 2.24, phi0: 0.45, phi1: 0.85 });
  patch(headlight, { x0: 1.9, x1: 2.24, phi0: Math.PI - 0.85, phi1: Math.PI - 0.45 });
  // Full-width tail light bar
  patch(taillight, { x0: -2.235, x1: -2.19, phi0: 0.3, phi1: Math.PI - 0.3 });
  // Black lower intake, rockers and diffuser
  patch(trim, { x0: 2.1, x1: 2.3, phi0: -Math.PI / 2 - 0.9, phi1: -Math.PI / 2 + 0.9 });
  patch(trim, { x0: -0.95, x1: 0.95, phi0: -0.55, phi1: -0.2 });
  patch(trim, { x0: -0.95, x1: 0.95, phi0: Math.PI + 0.2, phi1: Math.PI + 0.55 });
  patch(trim, { x0: -2.3, x1: -2.05, phi0: -Math.PI / 2 - 0.9, phi1: -Math.PI / 2 + 0.9 });
  for (const side of [-1, 1]) {
    // Door mirrors sit on the shoulder line, just ahead of the canopy
    const shoulder = sectionPoint(BODY, 0.4, side === 1 ? 0.3 : Math.PI - 0.3);
    const mirror = mesh(new THREE.SphereGeometry(0.065, 16, 12), paint);
    mirror.scale.set(1.5, 0.75, 1);
    mirror.position.set(shoulder.x, shoulder.y + 0.07, shoulder.z + side * 0.08);
    body.add(mirror);
    const stalk = mesh(new THREE.BoxGeometry(0.05, 0.03, 0.1), trim);
    stalk.position.set(shoulder.x, shoulder.y + 0.05, shoulder.z + side * 0.02);
    body.add(stalk);
  }
  body.add(mesh(loftGeometry(CABIN, { stations: 120, segments: 48 }), glass));

  const spoiler = new THREE.Group();
  const wing = mesh(new THREE.BoxGeometry(0.3, 0.03, 1.7), trim);
  wing.position.set(0, 0.14, 0);
  wing.rotation.z = -0.1;
  spoiler.add(wing);
  for (const side of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.06, 0.14, 0.03), trim);
    post.position.set(0, 0.07, side * 0.5);
    spoiler.add(post);
  }
  spoiler.position.set(-2.0, BODY.top(-2.0) - 0.02, 0);
  body.add(spoiler);

  // Wheels: tire with rounded sidewalls, multi-spoke rim with bright lip, brake disc and caliper
  const wheels: WheelRig[] = [];
  const wheelPositions: [number, 1 | -1][] = [
    [WHEEL_X, 1], [WHEEL_X, -1], [-WHEEL_X, 1], [-WHEEL_X, -1],
  ];
  for (const [x, side] of wheelPositions) {
    const steer = new THREE.Group();
    steer.position.set(x, WHEEL_RADIUS, side * WHEEL_Z);
    const mount = new THREE.Group();
    if (side === -1) mount.rotation.y = Math.PI; // outer face points away from the car
    steer.add(mount);

    const brake = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.025, 32), disc);
    brake.rotation.x = Math.PI / 2;
    brake.position.z = -0.01;
    mount.add(brake);
    const cal = mesh(new THREE.BoxGeometry(0.09, 0.15, 0.06), caliper);
    cal.position.set(-0.12, 0.09, 0.03);
    cal.rotation.z = 0.6;
    mount.add(cal);

    const spinner = new THREE.Group();
    const tread = mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.2, 48, 1, true), tire);
    tread.rotation.x = Math.PI / 2;
    spinner.add(tread);
    for (const z of [-0.1, 0.1]) {
      const wall = mesh(new THREE.TorusGeometry(WHEEL_RADIUS - 0.045, 0.045, 14, 48), tire);
      wall.position.z = z;
      spinner.add(wall);
    }
    const lip = mesh(new THREE.TorusGeometry(0.255, 0.016, 10, 48), rimLip);
    lip.position.z = 0.1;
    spinner.add(lip);
    for (let k = 0; k < 10; k++) {
      const spoke = mesh(new THREE.BoxGeometry(0.032, 0.21, 0.03), k % 2 ? rimMat : rimLip);
      const a = (k / 10) * Math.PI * 2;
      spoke.position.set(Math.sin(a) * 0.14, Math.cos(a) * 0.14, 0.085);
      spoke.rotation.z = -a;
      spinner.add(spoke);
    }
    const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 20), rimLip);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.1;
    spinner.add(hub);
    mount.add(spinner);

    root.add(steer);
    // Spinner's local Z points outward, so forward roll is negative on the right side and positive on the left
    wheels.push({ steer, spinner, front: x > 0, spinSign: side === 1 ? -1 : 1 });
  }

  return {
    root,
    body,
    wheels,
    wheelRadius: WHEEL_RADIUS,
    rearAxleX: -WHEEL_X,
    trackHalfWidth: WHEEL_Z,
    length: 4.64,
    setLights: (intensity) => {
      headlight.emissiveIntensity = 3.5 * intensity;
      taillight.emissiveIntensity = 1.6 * intensity;
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
