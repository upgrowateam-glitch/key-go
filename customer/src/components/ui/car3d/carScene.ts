import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CarRig } from './carRig';
import { buildProceduralCar } from './proceduralCar';

// Timeline (seconds): drive in → drift around the stage → pull into the landing spot → park
const DRIVE_S = 3.4; // time spent on the path
export const PARKED_POSE_S = DRIVE_S + 1.5;

// Path progress profile: constant speed, then a smooth braking phase into the landing spot
const BRAKE_FROM = 0.74;

const SMOKE_COUNT = 480;

// ---------- easing ----------
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * clamp01(x)) - 1) / 2;

// Arc-length progress along the path at time t (0..1)
function pathProgress(t: number) {
  const x = clamp01(t / DRIVE_S);
  const a = BRAKE_FROM;
  const total = a + (1 - a) / 2;
  const dist = x < a ? x : a + (x - a) - ((x - a) * (x - a)) / (2 * (1 - a));
  return dist / total;
}

// Drive in from the frame edge, ¾ of a counter-clockwise lap around the stage, then swing into the centre
const PATH_START = new THREE.Vector3(-7.5, 0, -3.0);
function buildPath() {
  const R = 3.0;
  const pts: THREE.Vector3[] = [
    PATH_START.clone(),
    new THREE.Vector3(-5.2, 0, -3.05),
    new THREE.Vector3(-3.2, 0, -3.05),
  ];
  const start = -Math.PI / 2 + 0.35;
  const end = Math.PI;
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps;
    pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R));
  }
  pts.push(
    new THREE.Vector3(-2.9, 0, -1.3),
    new THREE.Vector3(-1.7, 0, -0.45),
    new THREE.Vector3(-0.75, 0, -0.08),
    new THREE.Vector3(0, 0, 0)
  );
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

// Soft radial falloff used for the contact shadow under the car
function radialTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / (size - 1)) * 2 - 1;
      const dy = (y / (size - 1)) * 2 - 1;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
      data[i + 3] = Math.round(Math.pow(1 - d, 1.6) * 240);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

// Camera-facing soft puffs with per-particle size and opacity
function createSmoke(viewportHeight: number, fovDeg: number, color: THREE.Color) {
  const positions = new Float32Array(SMOKE_COUNT * 3);
  const sizes = new Float32Array(SMOKE_COUNT);
  const alphas = new Float32Array(SMOKE_COUNT);
  const velocities = new Float32Array(SMOKE_COUNT * 3);
  const ages = new Float32Array(SMOKE_COUNT).fill(1);
  const lifetimes = new Float32Array(SMOKE_COUNT).fill(1);
  const growth = new Float32Array(SMOKE_COUNT);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uScale: { value: viewportHeight / (2 * Math.tan((fovDeg * Math.PI) / 360)) },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.2, 1.0, d);
        gl_FragColor = vec4(uColor, a * a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  let next = 0;
  const emit = (origin: THREE.Vector3, drift: THREE.Vector3, strength: number) => {
    const i = next;
    next = (next + 1) % SMOKE_COUNT;
    positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.2;
    positions[i * 3 + 1] = 0.12 + Math.random() * 0.1;
    positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.2;
    velocities[i * 3] = drift.x + (Math.random() - 0.5) * 0.6;
    velocities[i * 3 + 1] = 0.35 + Math.random() * 0.45;
    velocities[i * 3 + 2] = drift.z + (Math.random() - 0.5) * 0.6;
    ages[i] = 0;
    lifetimes[i] = 1.6 + Math.random() * 1.2;
    growth[i] = (1.4 + Math.random() * 1.4) * (0.6 + 0.4 * strength);
    sizes[i] = 0.3;
    alphas[i] = 0;
  };

  const update = (dt: number) => {
    const drag = Math.exp(-1.8 * dt);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      if (ages[i] >= lifetimes[i]) {
        alphas[i] = 0;
        continue;
      }
      ages[i] += dt;
      const life = ages[i] / lifetimes[i];
      velocities[i * 3] *= drag;
      velocities[i * 3 + 1] = velocities[i * 3 + 1] * drag + 0.12 * dt;
      velocities[i * 3 + 2] *= drag;
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      sizes[i] = 0.3 + growth[i] * Math.sqrt(life);
      // quick fade-in, long fade-out
      alphas[i] = 0.3 * Math.min(1, life * 6) * Math.pow(1 - life, 1.5);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  };

  return {
    points,
    emit,
    update,
    setViewportHeight: (h: number) => {
      mat.uniforms.uScale.value = h / (2 * Math.tan((fovDeg * Math.PI) / 360));
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Colors the scene takes from the app theme. */
export interface CarScenePalette {
  background: string;
  floor: string; // softly lit pool under the car
  accent: string; // landing ring, rim light, brake calipers
  paint: string;
  smoke: string;
}

export interface CarScene {
  render: (timeS: number, dtS: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createCarScene(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  options: { useEnvironment: boolean; car?: CarRig; palette: CarScenePalette }
): CarScene {
  const BRAND_BG = new THREE.Color(options.palette.background);
  const ACCENT = new THREE.Color(options.palette.accent);
  renderer.setClearColor(BRAND_BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BRAND_BG, 10, 22);

  const FOV = 26;
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 80);

  // ---------- lighting: dark studio with an overhead softbox ----------
  let pmrem: THREE.PMREMGenerator | null = null;
  if (options.useEnvironment) {
    pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
  }
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x07090c, options.useEnvironment ? 0.35 : 0.9));
  const key = new THREE.SpotLight(0xffffff, 90, 18, 0.75, 0.7, 1.5);
  key.position.set(1.5, 8, 2.5);
  key.target.position.set(0, 0, 0);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xc4d2ff, 0.7);
  fill.position.set(-5, 3, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(ACCENT, 2.4);
  rim.position.set(-4, 2.2, -5);
  scene.add(rim);
  const front = new THREE.DirectionalLight(0xffffff, 0.8);
  front.position.set(6, 1.5, 1);
  scene.add(front);

  const disposables: { dispose: () => void }[] = [];
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    disposables.push(geo, mat);
    return new THREE.Mesh(geo, mat);
  };

  // ---------- floor & landing ring ----------
  // Unlit floor with a baked softbox pool so coloured rim light never tints it
  const floorGeo = new THREE.CircleGeometry(30, 96);
  const floorColors: number[] = [];
  const pool = new THREE.Color(options.palette.floor);
  const edge = new THREE.Color(BRAND_BG);
  const pos = floorGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i) / 1.3, pos.getY(i));
    const c = edge.clone().lerp(pool, Math.pow(clamp01(1 - d / 7), 1.6));
    floorColors.push(c.r, c.g, c.b);
  }
  floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(floorColors, 3));
  // Not tone-mapped so its edge matches the clear colour exactly (no visible horizon)
  const floor = mesh(floorGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ringMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false });
  const ring = mesh(new THREE.RingGeometry(2.6, 2.66, 128), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  scene.add(ring);

  // ---------- car ----------
  const car =
    options.car ??
    buildProceduralCar({
      useEnvironment: options.useEnvironment,
      paint: options.palette.paint,
      caliper: options.palette.accent,
    });
  scene.add(car.root);

  const shadowTex = radialTexture();
  disposables.push(shadowTex);
  const shadow = mesh(
    new THREE.PlaneGeometry(car.length * 1.25, car.trackHalfWidth * 3.5),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.9 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  car.root.add(shadow);

  const smoke = createSmoke(height, FOV, new THREE.Color(options.palette.smoke));
  scene.add(smoke.points);

  const path = buildPath();
  const pathLength = path.getLength();

  // ---------- per-frame update ----------
  const tangent = new THREE.Vector3();
  const aheadTangent = new THREE.Vector3();
  const tyre = new THREE.Vector3();
  const smokeDrift = new THREE.Vector3();
  let prevU = pathProgress(0);
  let rollAngle = 0;
  let smokeCarry = 0;
  const prevPos = PATH_START.clone();
  let prevYaw = 0;

  const headingOf = (v: THREE.Vector3) => Math.atan2(-v.z, v.x);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

  const render = (time: number, dt: number) => {
    const t = Math.max(0, time);
    const u = pathProgress(t);
    const speed = dt > 0 ? ((u - prevU) * pathLength) / dt : 0; // units per second
    prevU = u;

    // Position and travel direction along the path
    const p = path.getPointAt(Math.min(u, 0.9999));
    path.getTangentAt(Math.min(u, 0.9999), tangent);
    path.getTangentAt(Math.min(u + 0.01, 0.9999), aheadTangent);
    const heading = headingOf(tangent);
    const turn = Math.sign(wrap(headingOf(aheadTangent) - heading)); // +1 turning left

    // Drift: rear steps out while circling, straightens up for the landing
    const driftAmount = smooth(0.1, 0.2, u) * (1 - smooth(0.72, 0.9, u));
    const drift = 0.6 * driftAmount * turn;
    // Settle exactly square to the camera at the landing spot
    const yaw = (heading + drift) * (1 - smooth(0.9, 1, u));

    car.root.position.set(u >= 0.9999 ? 0 : p.x, 0, u >= 0.9999 ? 0 : p.z);
    car.root.rotation.y = yaw;

    // Wheels roll with distance travelled; fronts counter-steer against the slide
    rollAngle += (speed / car.wheelRadius) * dt * (1 + 0.6 * driftAmount); // rears spin up in the drift
    for (const w of car.wheels) {
      w.spinner.rotation.z = w.spinSign * rollAngle;
      if (w.front) w.steer.rotation.y = -0.55 * drift;
    }

    // Suspension: roll outward in the drift, brake dive and settle at the landing
    const landing = t - DRIVE_S;
    const brakeDive = -0.035 * smooth(0.8, 0.97, u) * (1 - smooth(0, 0.35, landing));
    const settle = landing > 0 && landing < 1 ? 0.018 * Math.sin(landing * Math.PI * 3) * (1 - landing) : 0;
    car.body.rotation.z = brakeDive + settle;
    car.body.rotation.x = -0.035 * driftAmount * turn;

    // Headlights on as the car arrives
    car.setLights(smooth(0, 0.6, t));

    // Tyre smoke from the rear wheels, strongest mid-drift, plus a puff when it stops
    const brakePuff = landing > -0.5 && landing < 0.2 ? 0.6 : 0;
    const smokeRate = 170 * driftAmount * clamp01(Math.abs(speed) / 6) + 70 * brakePuff;
    smokeCarry += smokeRate * dt;
    const emitCount = Math.floor(smokeCarry);
    smokeCarry -= emitCount;
    for (let k = 0; k < emitCount; k++) {
      // Spread puffs along this frame's motion so the trail stays continuous at any frame rate
      const f = (k + 1) / emitCount;
      const ex = prevPos.x + (car.root.position.x - prevPos.x) * f;
      const ez = prevPos.z + (car.root.position.z - prevPos.z) * f;
      const ey = prevYaw + wrap(yaw - prevYaw) * f;
      const cosY = Math.cos(ey);
      const sinY = Math.sin(ey);
      // Smoke is thrown backwards relative to the car
      smokeDrift.set(-cosY * 1.4, 0, sinY * 1.4);
      const side = k % 2 ? 1 : -1;
      const lx = car.rearAxleX;
      const lz = side * car.trackHalfWidth;
      // local (x, z) → world, matching rotation.y = yaw
      tyre.set(ex + lx * cosY + lz * sinY, 0, ez - lx * sinY + lz * cosY);
      smoke.emit(tyre, smokeDrift, driftAmount);
    }
    prevPos.copy(car.root.position);
    prevYaw = yaw;
    smoke.update(dt);

    // Landing ring glows up once the car is home
    const ringIn = smooth(-0.4, 0.4, landing);
    const pulse = landing > 0 && landing < 1.2 ? Math.sin((landing / 1.2) * Math.PI) : 0;
    ringMat.opacity = 0.3 * ringIn + 0.4 * pulse;
    ring.scale.setScalar(0.85 + 0.15 * ringIn + 0.06 * pulse);

    // Camera: wide shot for the drift, then dolly in to the hero 3/4 view and drift gently
    const closeIn = easeInOutSine((t - (DRIVE_S - 1.4)) / 1.8);
    const idle = Math.max(0, t - DRIVE_S);
    const theta = 0.95 - 0.23 * closeIn + 0.1 * Math.sin(idle * 0.35) * smooth(0, 2, idle);
    const radius = 11 - 4.2 * closeIn;
    const camY = 4 - 2.6 * closeIn;
    camera.position.set(Math.cos(theta) * radius, camY, Math.sin(theta) * radius);
    // Follow the car a little while it drifts so it stays prominent in the small hero frame
    const follow = 0.35 * (1 - closeIn);
    camera.lookAt(0.15 + (car.root.position.x - 0.15) * follow, 0.5, car.root.position.z * follow);

    renderer.render(scene, camera);
  };

  const resize = (w: number, h: number) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    smoke.setViewportHeight(h);
  };
  resize(width, height);

  // Compile every shader now so the first animated frame doesn't stall
  render(0, 0);
  renderer.compile(scene, camera);

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
    smoke.dispose();
    car.dispose();
    scene.environment?.dispose();
    pmrem?.dispose();
    renderer.dispose();
  };

  return { render, resize, dispose };
}
