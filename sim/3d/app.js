// =====================================================================
// Braillix mechanism simulator
//
// Loads braillix.glb (built from the real STLs by renders/export_glb.py) and
// drives it with the ACTUAL cam profile from the OpenSCAD source. Nothing here
// is hand-animated: if the printed cam could not produce a motion, this app
// cannot show it. That is the whole reason it is worth building.
//
// Units are MILLIMETRES throughout, matching braillix_params.json and the CAD.
// The GLB is exported Z-up (export_yup=False), so camera.up is set to +Z and
// every coordinate here reads the same as it does in the .scad files.
// =====================================================================
// vendor/ mirrors three/examples/jsm exactly (controls/, loaders/, utils/) so the
// addons' own relative imports — GLTFLoader does `../utils/BufferGeometryUtils.js` —
// resolve without patching a single line of vendored code.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildBrainPod, buildCellElectronics, PART_INFO } from './electronics.js';
import { Cell, BleCell, supported as serialSupported, bleSupported } from './hardware.js';

// ---------------------------------------------------------------- braille
// Grade 1, mirrors firmware/braille_mapping.py
const LETTERS = {
  a:[1], b:[1,2], c:[1,4], d:[1,4,5], e:[1,5], f:[1,2,4], g:[1,2,4,5],
  h:[1,2,5], i:[2,4], j:[2,4,5], k:[1,3], l:[1,2,3], m:[1,3,4], n:[1,3,4,5],
  o:[1,3,5], p:[1,2,3,4], q:[1,2,3,4,5], r:[1,2,3,5], s:[2,3,4], t:[2,3,4,5],
  u:[1,3,6], v:[1,2,3,6], w:[2,4,5,6], x:[1,3,4,6], y:[1,3,4,5,6], z:[1,3,5,6],
  ' ':[],
};

// Indicators are CELLS IN THEIR OWN RIGHT — the mechanism displays them exactly
// like a letter, one full cam index each. "A1" is three cells, not two.
const SIGN = {
  number:  [3,4,5,6],   // digits follow, until a space or a letter sign
  capital: [6],         // the NEXT letter is upper case. Braille is lower case by default.
  letter:  [5,6],       // cancels number mode so a letter can follow a digit
};
// There is deliberately NO "lower case" sign: lower case is the default state, and a
// sign marking the absence of a change would cost a cell for nothing. Capitals are
// what need announcing — once per letter, or twice to capitalise a whole word.
// digits reuse a-j: 1->a ... 9->i, 0->j
const DIGIT = { '1':'a','2':'b','3':'c','4':'d','5':'e','6':'f','7':'g','8':'h','9':'i','0':'j' };
const PUNCT = {
  ',':[2], ';':[2,3], ':':[2,5], '.':[2,5,6], '?':[2,3,6],
  '!':[2,3,5], "'":[3], '-':[3,6],
};

let P, CAM, STACK, D2B, STATES, SLICE, RAMP, PIN_LIFT, CAM_FLAT, Z_SIGN, STEPS_PER_POS;

// Must match use_gray_order in cad/scad/braille_cam.scad and USE_GRAY_ORDER in
// firmware/braille_cell/braille_cell.ino. All three or none.
const GRAY_ORDER = true;
const grayToBinary = g => { let b = g; while (g >>= 1) b ^= g; return b; };

// ---------------------------------------------------------------- cam maths
// Direct port of get_height_at_angle() in cad/scad/braille_cam.scad.
// v8.2: mirrors get_pattern_bit() in braille_cam.scad, which now carries the
// pattern gray(i) at slice i. This models the cam SURFACE; camAngleForState
// below does the inverse, turning a wanted pattern into the slice that holds it.
const bitOf = (v, b) => (v >> b) & 1;
const grayBit = (i, b) => bitOf(i, b) ^ bitOf(i, b + 1);
const patternBit = (slice, track) => {
  const b = CAM.dots - 1 - track;
  return GRAY_ORDER ? grayBit(slice, b) : bitOf(slice, b);
};
const sCurve = t => (1 - Math.cos(t * Math.PI)) / 2;

function heightFactor(aEff, track) {
  aEff = ((aEff % 360) + 360) % 360;
  const k = Math.floor(aEff / SLICE);
  const ais = aEff - k * SLICE;
  const vc = patternBit(k, track);
  const vp = patternBit((k - 1 + STATES) % STATES, track);
  const vn = patternBit((k + 1) % STATES, track);
  // R-07 sizes each ramp from its OWN track's arc, so the six differ: 3.43 deg
  // on the innermost up to 4.23 on the outermost. This used to be one global
  // 1.125 for all six, which is both 3x too narrow AND the very uniformity R-07
  // was written to remove — dots snapped up where the real cam eases them.
  const ramp = RAMP[track];
  const hr = ramp / 2;
  if (ais < hr)             { const b = sCurve((ais + hr) / ramp);            return (1 - b) * vp + b * vc; }
  if (ais > SLICE - hr)     { const b = sCurve((ais - (SLICE - hr)) / ramp);  return (1 - b) * vc + b * vn; }
  return vc;
}

// TRAP: the cam's ramps are centred on SLICE BOUNDARIES. Aiming at pos*SLICE lands
// mid-ramp and every dot sits halfway up — at state 0 all six read exactly 0.5.
// The firmware has this bug today (breadboard_test.ino targets pos*4096/64 with no
// +32). Half a slice further along is the middle of the flat dwell.
// v8.2: the cam carries pattern gray(i) at slice i, so a pattern's angle is the
// slice whose Gray value is that pattern — grayToBinary(pattern). Must match
// use_gray_order in cad/scad/braille_cam.scad and USE_GRAY_ORDER in the firmware.
const stateToSlice = pos => GRAY_ORDER ? grayToBinary(pos) : pos;
const camAngleForState = pos => Z_SIGN * (stateToSlice(pos) + 0.5) * SLICE;

// A foot fixed at world angle dot_phase sits over disc-local (phase - rotation);
// the carving already bakes in track_phase, so a_eff collapses to -rotation.
function linkageLift(dot, camDeg) {
  const track = CAM.dot_track[dot - 1];
  const aEff = (CAM.dot_phase[dot - 1] - camDeg) - CAM.track_phase[track];
  return heightFactor(aEff, track) * PIN_LIFT;
}

const cellToPos = cell => cell.reduce((v, d) => v | (1 << D2B[d]), 0);

// ---------------------------------------------------------------- scene
const XRAY_PARTS = ['outer_box', 'top_plate', 'dot_insert', 'comb'];
let renderer, scene, camera, controls, parts = {}, linkages = [];
let pod = null, cellElec = null, glbMotor = [], podShells = [];

// ---- MULTI-CELL ----------------------------------------------------------
// Stacking is the product's whole argument: a display is a ROW of these, each
// with its own motor, and adding one costs no extra wiring because only power
// and I2C cross the dock. So the simulator has to be able to show more than one.
//
// A unit is one physical brick. Object3D.clone() shares geometry AND materials
// by reference, which is exactly right here: X-ray and the finish palette then
// apply to every cell at once, while transforms (cam angle, linkage lift) stay
// independent, which is the only thing that must differ per cell.
const CELL_PITCH = 68;            // outer_box is 68mm; bricks butt face to face
const MAX_UNITS = 4;
let units = [];                   // [{root, elec, linkages, cam, deg, target, move}]
let unitTemplate = null;          // the loaded GLB scene, cloned per unit
let running = true, xray = false, elec = false, speed = 1;
let cell = null, hwBusy = false;      // the real hardware, over Web Serial
let move = null;                      // the active trapezoid, or null when parked

// Straight from firmware/braille_cell/braille_cell.ino. The animation used to run
// at a flat 150 deg/s with no ramp, which is 1.7x the motor's top speed and gets
// short moves badly wrong: a one-state hop is only 64 steps, so it is ACCELERATION
// limited and never reaches vmax at all. Keep these in step with the sketch.
const FW = { vmax: 1000, accel: 2000, gapMs: 250 };   // half-steps/s, /s^2, ms
// The 28BYJ-48 itself stalls above ~1200 half-steps/s (see the sketch's own
// !speed warning) — the sim's speed slider goes to 3x, which is 3000. Screen
// speed and motor speed are DIFFERENT axes: the visual can run fast, the real
// coil can't, so whatever the slider asks for gets clamped before it ever
// reaches the hardware.
const HW_VMAX_CAP = 1100, HW_ACCEL_CAP = 3000;
const clampHw = (v, a) => [Math.min(v, HW_VMAX_CAP), Math.min(a, HW_ACCEL_CAP)];
const DEG_PER_STEP = 360 / 4096;
const VMAX_DEG  = FW.vmax  * DEG_PER_STEP;    // 87.9 deg/s
const ACCEL_DEG = FW.accel * DEG_PER_STEP;    // 175.8 deg/s^2

// AccelStepper's profile in closed form. Integrating it frame by frame instead
// ran 6-16% fast — worst on ONE-STATE moves, which are the common case — because
// forward Euler overshoots during the ramp and the stopping threshold clips the
// final crawl. Solving for position at time t has no such drift.
function planMove(from, to) {
  const d = Math.abs(to - from), dir = Math.sign(to - from);
  const dAcc = (VMAX_DEG * VMAX_DEG) / (2 * ACCEL_DEG);
  let tAcc, tCruise;
  if (d <= 2 * dAcc) { tAcc = Math.sqrt(d / ACCEL_DEG); tCruise = 0; }   // triangular
  else { tAcc = VMAX_DEG / ACCEL_DEG; tCruise = (d - 2 * dAcc) / VMAX_DEG; }
  return { from, dir, d, tAcc, tCruise, T: 2 * tAcc + tCruise, t: 0 };
}

function moveAt(m) {
  const { d, tAcc, tCruise, T, t } = m;
  if (t >= T) return d;
  if (t <= tAcc) return 0.5 * ACCEL_DEG * t * t;
  if (t <= tAcc + tCruise) return 0.5 * ACCEL_DEG * tAcc * tAcc + VMAX_DEG * (t - tAcc);
  const r = T - t;
  return d - 0.5 * ACCEL_DEG * r * r;
}
let word = 'Braille 101', idx = 0, camDeg = 0, targetDeg = 0, dwell = 0;
let homeCam = null, homeTarget = null;

// Read a colour straight out of the stylesheet so the palette has exactly one
// home. Color.set() treats a hex string as sRGB and converts to linear working
// space; scene.background is encoded back on output, so the canvas and the rail
// match numerically rather than approximately.
const cssColor = n => new THREE.Color(
  getComputedStyle(document.documentElement).getPropertyValue(n).trim());

// A soft occlusion blob. This is what makes an object look like it is SITTING on
// something; a cast shadow alone leaves it hovering. Canvas texture, no file.
function aoBlob() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,.62)');
  g.addColorStop(0.45, 'rgba(0,0,0,.26)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(185, 185),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c), transparent: true,
      depthWrite: false, color: 0x000000, fog: false,
    }));
  m.position.z = -0.32;
  m.renderOrder = -1;
  return m;
}

function resizeStage() {
  const st = document.getElementById('stage');
  const r = st.getBoundingClientRect();
  const w = Math.max(1, r.width), h = Math.max(1, r.height);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  SB = { left: r.left, top: r.top, width: w, height: h };
  if (units.length) frameRow();
}

function buildScene() {
  const stage = document.getElementById('stage');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const vp = () => {
    const r = stage.getBoundingClientRect();
    return [Math.max(1, r.width), Math.max(1, r.height)];
  };
  renderer.setSize(...vp());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft is deprecated in r185
  renderer.outputColorSpace = THREE.SRGBColorSpace;   // r185 default; state it
  // AgX over ACES Filmic: ACES pushes bright neutrals toward orange, which
  // fights an amber accent and tints the white chrome highlights. AgX rolls
  // highlights off neutral and holds detail in a near-black background.
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.85;
  stage.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  // ONE definition of the ground colour. This used to be 0x12131f hardcoded
  // twice here while --bg lived in the stylesheet, so a palette change had to be
  // made in two places or the canvas and the rail stopped matching.
  const BG = cssColor('--bg-0');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 420, 1500);

  const [vw0, vh0] = vp();
  camera = new THREE.PerspectiveCamera(38, vw0 / vh0, 1, 2000);
  camera.up.set(0, 0, 1);                    // Z-up, matching the CAD
  camera.position.set(118, -132, 104);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0, 30);
  controls.minDistance = 55;
  // 520 was fine for one brick. A row of four plus the pod needs ~900 to frame
  // in portrait, and the clamp was silently cropping the ends of the row.
  controls.maxDistance = 1400;
  controls.update();
  homeCam = camera.position.clone();
  homeTarget = controls.target.clone();

  // Lighting kept deliberately modest. The Blender pass blew every surface to pure
  // white because 220W lamps sat 200mm from a 68mm object; irradiance goes as
  // P/(4*pi*r^2), so at this scale small numbers are correct.
  const key = new THREE.DirectionalLight(0xfff6ea, 2.0);
  key.position.set(120, -90, 190);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const d = 85;    // the part is 68mm; a 240mm frustum spent 2/3 of the map on air
  Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 20, far: 460 });
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.15;   // FrontSide lets this come way down
  key.shadow.radius = 3;
  scene.add(key);

  // Near-neutral. A blue fill against an orange rim is the look of a gaming
  // keyboard, not a bench instrument, and it was tinting the white PETG.
  const fill = new THREE.DirectionalLight(0xd8dee8, 0.38);
  fill.position.set(-120, -140, 50);
  scene.add(fill);

  // Brighter and WHITE. Separating a dark object from a dark ground is the
  // single biggest thing a rim light does, and a tinted one cannot do it.
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(-30, 170, 140);
  scene.add(rim);

  scene.add(new THREE.HemisphereLight(0xc7ceda, 0x0a0b0c, 0.18));

  // catch shadows so the mechanism reads as a solid object in space
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(200, 64),
    new THREE.ShadowMaterial({ opacity: 0.55 }));
  floor.position.z = -0.4;
  floor.receiveShadow = true;
  scene.add(floor);

  // A GridHelper used to sit here. It is the single most recognisable "started
  // from a three.js example" element there is, and a wireframe floor is not what
  // a photographed object sits on. What actually sells contact is a soft
  // occlusion blob directly under the part, which costs one canvas texture.
  scene.add(aoBlob());

  makeEnvironment(renderer, scene);
}

// A tiny image-based environment. Without one, `metalness` near 1.0 reflects pure
// black plus whatever geometry happens to be nearby — which made every braille dot
// look like a dark chrome bead smeared with red (the cam) and blue (the fill light).
// Three soft emissive panels are enough to give metals something sane to reflect.
function makeEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const panel = (hex, gain, pos, size) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(gain) });
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(...pos);
    env.add(m);
  };
  // A softbox, not three coloured slabs. The cool-left/warm-right pair was
  // tinting every neutral surface and giving the chrome a blue-orange split
  // that read as plastic.
  panel(0xffffff, 1.5, [0, 20, 80], [150, 90, 1]);    // overhead-front key
  panel(0xffffff, 0.55, [-80, 0, 20], [1, 140, 100]); // broad neutral left
  panel(0xe9edf4, 0.28, [80, 0, 20], [1, 140, 100]);  // dim neutral right
  panel(0x101113, 1.0, [0, 0, -75], [160, 160, 1]);   // floor bounce = --bg-1
  scene.environment = pmrem.fromScene(env, 0.035)   // >0.04 clips: three caps the sample count at 20.texture;
  pmrem.dispose();
}

// Every printed part gets an AUTHORED finish. Four of these meshes previously
// kept whatever colour the GLB happened to bake, so the enclosure had no design
// intent at all -- and the cam was painted 0xe94560, the literal UI accent,
// which is why the whole scene read as "one red thing on grey".
//
// The cam stays the hero by being the brightest and most specular part with the
// most geometric interest, not by being the only coloured one. Separation is by
// value and finish. A coloured hero part is the marketing move.
//
// One envMapIntensity for both subsystems: this file used 1.5 on the linkages
// while electronics.js used 0.42, a 3.5x mismatch that made the mechanism and
// the electronics look photographed in different rooms.
const ENV_INTENSITY = 1.0;

function applyMaterials(obj) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const n = o.name;
    const m = o.material;
    // FrontSide, not DoubleSide: back faces doubled fragment cost AND wrote
    // depth from the light's view, which is why the shadow bias had to be
    // dialled so hard. The CAD meshes are verified manifold.
    m.side = THREE.FrontSide;
    if (n.startsWith('linkage_')) {
      // Shiny chrome, as requested. This only looks right BECAUSE makeEnvironment()
      // gives it something to reflect — at metalness 0.92 with no environment map
      // the dots reflected pure black plus the red cam and blue fill light, which
      // is what made them read as dark smeared beads. Do not remove the env map.
      // No state tinting: a raised dot looks exactly like a lowered one, because
      // that is what the real part does. The braille cell in the corner is where
      // you read the state.
      // Brushed steel rather than mirror chrome. At 0.92/0.18 these reflected
      // only the four environment panels, so a bright streak dragged across
      // every dot as the camera moved and read as motion that was not there.
      m.metalness = 0.85;
      m.roughness = 0.26;
      m.color.set(0xd3d7dc);
      m.envMapIntensity = ENV_INTENSITY;
    } else if (n === 'cam') {
      m.metalness = 0.65; m.roughness = 0.28; m.color.set(0xb9bec4);
      m.envMapIntensity = ENV_INTENSITY;
    } else if (n.startsWith('motor')) {
      m.metalness = 0.55; m.roughness = 0.5; m.envMapIntensity = ENV_INTENSITY;
    } else if (n === 'base_plate' || n === 'mid_plate') {
      m.metalness = 0.10; m.roughness = 0.74; m.color.set(0x8e939a);
      m.envMapIntensity = ENV_INTENSITY;
    } else if (n === 'pod_shell' || n === 'pod_lid') {
      // the pod fell through every branch and kept its baked colour, which is
      // half of why the two enclosures never looked like the same product
      m.metalness = 0.0; m.roughness = 0.66; m.color.set(0x646b73);
      m.envMapIntensity = ENV_INTENSITY;
    } else if (XRAY_PARTS.includes(n)) {
      m.metalness = 0.0; m.roughness = 0.62; m.color.set(0x4a5057);
      m.envMapIntensity = ENV_INTENSITY;
      o.userData.opaque = { opacity: 1, transparent: false };
    }
    m.needsUpdate = true;
  });
}

// The pod docks on the cell's -X face: the pod's +X wall meets the cell's -X wall,
// so its centre sits a full brick away. The GLB's plain-cylinder motor is retired
// in favour of the real 28BYJ-48 shape (offset shaft, gearbox boss, connector).
// Every .glb here is a build artefact that gets regenerated whenever the CAD
// moves, and the browser will happily serve an old one for its heuristic cache
// lifetime. That is not cosmetic: a stale braillix.glb means old geometry drawn
// against freshly extracted params, which is precisely the desync this project
// keeps having. It cost a debugging session already — the page kept showing
// 400-triangle linkages after the 3228-triangle rebuild.
//
// GLTFLoader has no cache option, so fetch the bytes ourselves with
// cache: 'no-cache' (revalidate, do not refuse to store) and hand them to
// parse(). The '' path argument is fine because these files embed everything.
// Weighted so the bar is monotonic across all three assets rather than
// restarting at 0% twice.
const GLB_WEIGHT = { './braillix.glb': 0.90, './pod.glb': 0.06, './motor.glb': 0.04 };
let glbDone = 0;

function loadProgress(file, got, total) {
  const w = GLB_WEIGHT[file] ?? 0;
  const frac = total ? got / total : 0;
  const pct = Math.min(100, Math.round((glbDone + w * frac) * 100));
  const bar = $('loadbar');
  if (bar) bar.firstElementChild.style.width = pct + '%';
  const nm = $('loadname');
  if (nm) nm.textContent = file.replace('./', '');
  const pc = $('loadpct');
  if (pc) pc.textContent = pct + '%';
}

async function loadGlb(file) {
  const res = await fetch(file, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  // Read the stream so the progress bar reports real bytes. Switching to
  // GLTFLoader.load() to get its onProgress would drop cache:'no-cache' and
  // silently bring back the stale-GLB desync described above.
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    loadProgress(file, got, total);
  }
  glbDone += GLB_WEIGHT[file] ?? 0;
  const buf = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return new Promise((ok, no) =>
    new GLTFLoader().parse(buf.buffer, '', ok, no));
}

async function buildElectronics(glbScene) {
  const loadOptional = async (file, what) => {
    try {
      return (await loadGlb(file)).scene;
    } catch (e) {
      console.warn(`${file} missing — falling back to the built-in ${what}.`);
      return null;
    }
  };
  const printed = await loadOptional('./pod.glb', 'slab shell');
  if (printed) applyMaterials(printed);
  const realMotor = await loadOptional('./motor.glb', 'motor');

  pod = buildBrainPod(printed);
  pod.position.set(-68, 0, 0);
  podShells = ['pod_shell', 'pod_lid'].map(n => pod.getObjectByName(n)).filter(Boolean);
  scene.add(pod);

  cellElec = buildCellElectronics(realMotor);
  scene.add(cellElec);

  for (const n of ['motor_body', 'motor_shaft', 'motor_ear_l', 'motor_ear_r']) {
    const o = glbScene.getObjectByName(n);
    if (o) { o.visible = false; glbMotor.push(o); }
  }

  cellElec.visible = false;                 // the cell's innards start hidden
  pod.visible = true;                       // the pod itself never hides
  buildHotspots();
}

function setElectronics(on) {
  elec = on;
  // The pod is a brick sitting next to the cell, not something buried inside it,
  // so it stays on screen whatever this toggle says. Only the cell's own innards
  // are hidden behind it.
  units.forEach(u => { if (u.elec) u.elec.visible = on; });
  glbMotor.forEach(o => o.visible = false);       // never show the placeholder again
  $('btnElec').classList.toggle('on', on);
  $('btnElec').setAttribute('aria-pressed', String(on));
  // Deliberately does NOT force X-ray on. Two buttons reaching into each other
  // makes the state unpredictable — if you want to see through the walls, press
  // X-Ray yourself.
}

// ---------------------------------------------------------------- hotspots
// A dot pinned to each real part, instead of a wall of text on the right. It
// grows and brightens as the pointer approaches, and only opens on a click, so
// the model stays the thing you look at.
const SPOTS = [];
const MECH_INFO = [
  ['cam', 'THE CAM DISC',
   'The whole mechanism in one part. Six concentric tracks, 64 angular slices - one per possible dot pattern. Rotating it to an angle IS choosing a character.'],
  ['linkage_1', 'LINKAGE (x6)',
   'One per dot. A foot rides the cam track; when it meets a raised section the arm pivots and pushes its dot up 0.5mm through the reading surface.'],
  ['top_plate', 'READING SURFACE',
   'What the finger touches. Braille pitch is SQUARE - 2.6mm between rows AND between the two columns. A cell looks tall because it is 2 columns by 3 rows, not because the pitch is uneven.'],
];
const SPOT_MAX = 190;             // px: beyond this the dot is at its dimmest

function buildHotspots() {
  const layer = $('spots');
  for (const [name, title, body] of [...MECH_INFO, ...PART_INFO]) {
    const o = scene.getObjectByName(name);
    if (!o) continue;
    const anchor = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const el = document.createElement('button');
    el.className = 'spot';
    el.title = title;
    el.setAttribute('aria-label', `${title} — show details`);
    el.setAttribute('aria-expanded', 'false');
    el.setAttribute('aria-controls', 'info');
    el.addEventListener('click', ev => { ev.stopPropagation(); openInfo(spot, ev); });
    layer.appendChild(el);
    const spot = { o, el, anchor, title, body };
    SPOTS.push(spot);
  }
}

let openSpot = null;
function openInfo(spot, ev) {
  openSpot = spot;
  SPOTS.forEach(s => s.el.classList.toggle('open', s === spot));
  $('infoTitle').textContent = spot.title;
  $('infoBody').textContent = spot.body;
  const card = $('info');
  card.classList.add('on');
  // sit beside the dot, but never off-screen
  const r = spot.el.getBoundingClientRect();
  const w = 268, h = card.offsetHeight || 120;
  card.style.left = Math.min(Math.max(12, r.left + 24), innerWidth - w - 12) + 'px';
  card.style.top  = Math.min(Math.max(12, r.top - 10), innerHeight - h - 12) + 'px';
}
function closeInfo() {
  openSpot = null;
  SPOTS.forEach(s => s.el.classList.remove('open'));
  $('info').classList.remove('on');
}

// visible only if the object and every parent above it is visible
const shown = o => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };

const ptr = { x: -1e4, y: -1e4 };
// cached canvas box; refreshed by resizeStage rather than measured every frame
let SB = { left: 0, top: 0, width: 1, height: 1 };

function updateHotspots() {
  if (!SPOTS.length) return;
  const v = new THREE.Vector3();
  for (const s of SPOTS) {
    if (!shown(s.o)) { s.el.style.display = 'none'; continue; }
    v.copy(s.anchor).project(camera);
    if (v.z > 1) { s.el.style.display = 'none'; continue; }   // behind the camera
    // The canvas is NOT the window: the rail insets it on desktop and the sheet
    // insets it on mobile. Projecting against innerWidth/innerHeight put every
    // dot at a fraction of its true offset, so they drifted off their parts and
    // pooled below the model. #spots is fixed to the window, so the canvas
    // origin has to be added back.
    const x = SB.left + (v.x * 0.5 + 0.5) * SB.width;
    const y = SB.top + (-v.y * 0.5 + 0.5) * SB.height;
    s.el.style.display = 'block';
    s.el.style.left = x + 'px';
    s.el.style.top = y + 'px';
    const d = Math.hypot(x - ptr.x, y - ptr.y);
    const p = s === openSpot ? 1 : Math.max(0, 1 - d / SPOT_MAX);
    s.el.style.setProperty('--p', (p * p).toFixed(3));        // squared: bites late, feels sharper
  }
}

// X-ray used to be a hard cut: one frame opaque, the next 20% glass, which
// reads as a glitch rather than a transition and loses the viewer's place
// inside the mechanism. It is a tween now, driven from tick().
//
// The shell has to be `transparent` for the WHOLE tween, not just at the end --
// flipping that flag mid-fade re-sorts the draw order and pops. depthWrite and
// castShadow switch once, at the point where the wall stops being solid enough
// to matter.
const XRAY_DUR = 0.34;             // seconds
let xrayT = 0;                     // 0 = solid, 1 = glass
let xrayFrom = 0, xrayTo = 0, xrayEl = XRAY_DUR;

function xrayTargets() {
  const t = [];
  for (const u of units) t.push(...u.xray);
  return t.concat(podShells);
}

function applyXray(k) {
  const ease = k * k * (3 - 2 * k);          // smoothstep
  xrayTargets().forEach(o => {
    if (!o) return;
    o.traverse(c => {
      if (!c.isMesh) return;
      const m = c.material;
      m.transparent = ease > 0.001;
      m.opacity = 1 - 0.86 * ease;           // 1.0 -> 0.14
      m.depthWrite = ease < 0.5;
      m.roughness = 0.62 - 0.55 * ease;      // matte print -> polycarbonate
      m.metalness = 0;
      m.envMapIntensity = 1 + 1.0 * ease;    // glassier as it thins
      c.castShadow = ease < 0.5;
      m.needsUpdate = true;
    });
  });
}

function stepXray(dt) {
  if (xrayEl >= XRAY_DUR) return;
  xrayEl = Math.min(XRAY_DUR, xrayEl + dt);
  xrayT = xrayFrom + (xrayTo - xrayFrom) * (xrayEl / XRAY_DUR);
  applyXray(xrayT);
}

function setXray(on) {
  xray = on;
  xrayFrom = xrayT;
  xrayTo = on ? 1 : 0;
  xrayEl = 0;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    xrayT = xrayTo; xrayEl = XRAY_DUR; applyXray(xrayT);
  }
  const b = document.getElementById('btnXray');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? 'X-Ray: ON' : 'X-Ray Vision';
}

// ---------------------------------------------------------------- UI
const $ = id => document.getElementById(id);

// Expand a typed string into the cells a real display would show. Indicators cost
// a cell each, so "A1" -> capital, a, number, a  =  four cam positions.
function currentCells() {
  const out = [];
  let numeric = false;
  const push = (glyph, cell, kind, note) => out.push({ ch: glyph, cell, kind, note });
  const src = word || ' ';
  const isLetter = c => c && LETTERS[c.toLowerCase()] && c !== ' ';

  for (let i = 0; i < src.length; i++) {
    const raw = src[i];
    const ch = raw.toLowerCase();

    // ALL-CAPS run of 2+ letters: one capital WORD sign beats one sign per letter.
    // Only when the whole run is upper case, so no terminator is ever needed.
    if (isLetter(raw) && raw !== ch) {
      let j = i;
      while (j < src.length && isLetter(src[j])) j++;
      const run = src.slice(i, j);
      if (run.length > 1 && run === run.toUpperCase()) {
        if (numeric) { push('~', SIGN.letter, 'sign', 'ends the number'); numeric = false; }
        push('^^', SIGN.capital, 'sign', 'whole word is capital');
        push('^^', SIGN.capital, 'sign', 'second half of the pair');
        for (const c of run) push(c, LETTERS[c.toLowerCase()], 'letter', 'upper case');
        i = j - 1;
        continue;
      }
    }

    if (raw === ' ') {                       // space always drops numeric mode
      numeric = false;
      push(' ', [], 'space', 'word break');
    } else if (DIGIT[raw]) {
      if (!numeric) { push('#', SIGN.number, 'sign', 'digits follow'); numeric = true; }
      push(raw, LETTERS[DIGIT[raw]], 'digit', 'digit ' + raw + ' = letter ' + DIGIT[raw].toUpperCase());
    } else if (LETTERS[ch] && ch !== ' ') {
      if (numeric) { push('~', SIGN.letter, 'sign', 'ends the number'); numeric = false; }
      if (raw !== ch) push('^', SIGN.capital, 'sign', 'next letter is capital');
      push(raw, LETTERS[ch], 'letter', raw === ch ? 'lower case' : 'upper case');
    } else if (PUNCT[raw]) {
      // a . or , inside a number stays part of it (2.5, 1,000)
      if (numeric && raw !== '.' && raw !== ',') numeric = false;
      push(raw, PUNCT[raw], 'punct', 'punctuation');
    } else {
      numeric = false;
      push(raw, [], 'space', 'not in this chart');
    }
  }
  return out.length ? out : [{ ch: ' ', cell: [], kind: 'space', note: 'word break' }];
}

const KIND_LABEL = {
  sign:   { '#': 'NUMBER SIGN', '^': 'CAPITAL SIGN', '^^': 'CAPITAL WORD', '~': 'LETTER SIGN' },
  digit:  'NUMBER', letter: 'LETTER', punct: 'PUNCTUATION', space: 'SPACE',
};

function updateReadout(item, pos) {
  const { ch, cell, kind, note } = item;
  const glyph = $('glyph');
  const isSign = kind === 'sign';
  const isSpace = kind === 'space';

  glyph.textContent = isSpace ? 'SPACE'
    : isSign ? { '#': '#', '^': '⇧', '^^': '⇪', '~': '↩' }[ch] : ch;
  glyph.classList.toggle('space', isSpace);
  glyph.classList.toggle('sign', isSign);

  const label = isSign ? KIND_LABEL.sign[ch] : KIND_LABEL[kind];
  $('cellmeta').textContent = label;
  $('cellmeta').classList.toggle('sign', isSign);
  $('cellnote').textContent = note || '';

  for (let d = 1; d <= 6; d++) $('d' + d).classList.toggle('up', cell.includes(d));

  $('e_char').textContent = isSpace ? '(space)' : isSign ? label.toLowerCase() : ch;
  $('e_dots').textContent = cell.length ? cell.join(' · ') : 'none';
  $('e_pos').textContent = pos + ' / 63';
  $('e_step').textContent = (stateToSlice(pos) * STEPS_PER_POS + STEPS_PER_POS / 2) + ' / 4096';
  $('e_ang').textContent = (Math.abs(camAngleForState(pos)) % 360).toFixed(2) + '°';
  $('bits').textContent = pos.toString(2).padStart(6, '0');

  // Unicode braille: U+2800 + a bitmask where dot n is bit n-1. NOTE this is
  // NOT the same bit order as D2B/DOT_TO_BIT, which is the cam's TRACK ordering.
  // They must not be merged; the cam would break silently.
  const uni = String.fromCodePoint(0x2800 + cell.reduce((v, d) => v | (1 << (d - 1)), 0));
  announce(`${isSpace ? 'space' : ch}, ${label.toLowerCase()}. ` +
           (cell.length ? `Dots ${cell.join(', ')}.` : 'No dots raised.') +
           ` Cam position ${pos} of 63. ${uni}`);
}

// One live region for the whole readout. The six dot divs are aria-hidden --
// announcing them individually is noise, and this sentence says the same thing
// better. Throttled: at the 250ms auto-advance an unthrottled region is unusable.
let annT = 0, annPending = null;
function announce(text) {
  annPending = text;
  clearTimeout(annT);
  annT = setTimeout(() => {
    const el = $('live');
    if (el && annPending) el.textContent = annPending;
  }, running ? 900 : 120);
}

function gotoIndex(i) {
  const seq = currentCells();
  if (!seq.length) return;
  idx = ((i % seq.length) + seq.length) % seq.length;

  // Unit k shows the character k places along, so a word spreads across the row
  // and then flows through it — which is the thing a photo of one cell can
  // never show and is the entire reason for the Add cell button.
  units.forEach((u, k) => {
    const item = seq[(idx + k) % seq.length];
    const pos = cellToPos(item.cell);
    // shortest path: wrap the wanted angle to the nearest equivalent of u.deg, so
    // the cam turns whichever way is closer. 63 -> 0 is 5.6deg back, not 354.4 forward.
    const want = camAngleForState(pos);
    u.target = u.deg + ((((want - u.deg) % 360) + 540) % 360) - 180;
    u.move = Math.abs(u.target - u.deg) > 1e-6 ? planMove(u.deg, u.target) : null;
    u.pos = pos;
    if (k === 0) { targetDeg = u.target; move = u.move; updateReadout(item, pos); }
  });

  // one real cell exists, so it follows unit 0
  if (cell && cell.connected) {
    hwBusy = true;
    cell.goToState(units[0].pos).finally(() => { hwBusy = false; });
  }
}

// Build one more brick. The clone shares geometry and materials with the first,
// so a second cell costs transforms and draw calls, not memory.
function addUnit() {
  if (!unitTemplate || units.length >= MAX_UNITS) return;
  const k = units.length;
  const root = k === 0 ? unitTemplate : unitTemplate.clone(true);
  root.position.x = k * CELL_PITCH;
  if (k) scene.add(root);

  const u = {
    root,
    linkages: [1, 2, 3, 4, 5, 6].map(d => root.getObjectByName('linkage_' + d)),
    cam: root.getObjectByName('cam'),
    xray: XRAY_PARTS.map(n => root.getObjectByName(n)).filter(Boolean),
    elec: null,
    deg: units.length ? units[0].deg : 0,
    target: 0, move: null, pos: 0,
  };
  if (k) {
    u.elec = cellElec.clone(true);
    u.elec.position.x = k * CELL_PITCH;
    u.elec.visible = elec;
    scene.add(u.elec);
    // the clone must match whatever X-ray state the page is already in
    root.traverse(c => { if (c.isMesh) c.castShadow = !xray; });
  } else {
    u.elec = cellElec;
  }
  units.push(u);
  syncUnitUI();
  gotoIndex(idx);
}

function removeUnit() {
  if (units.length <= 1) return;
  const u = units.pop();
  scene.remove(u.root);
  if (u.elec) scene.remove(u.elec);
  u.root.traverse(o => { if (o.isMesh) o.geometry?.dispose?.(); });
  syncUnitUI();
  gotoIndex(idx);
}

function syncUnitUI() {
  const n = units.length;
  const lbl = $('unitcount');
  if (lbl) lbl.textContent = n + (n === 1 ? ' cell' : ' cells');
  const add = $('btnAddCell'), rm = $('btnDelCell');
  if (add) add.disabled = n >= MAX_UNITS;
  if (rm) rm.disabled = n <= 1;
  // Frame the whole row, not just the first brick, or adding a cell pushes it
  // off screen and looks like nothing happened.
  frameRow();
}

// Fit the camera to the ACTUAL bounds of everything on screen. A width estimate
// is not enough: the row is viewed on a diagonal, so its projected extent is not
// its length, and a phone is portrait while a row of bricks is wide. A bounding
// sphere is angle-independent, which is the only thing that survives both.
function frameRow() {
  if (!units.length) return;
  const box = new THREE.Box3();
  for (const u of units) box.expandByObject(u.root);
  if (pod) box.expandByObject(pod);
  const sph = box.getBoundingSphere(new THREE.Sphere());

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  // fit whichever axis is tighter -- portrait makes the horizontal one bind
  const dist = sph.radius / Math.sin(Math.min(vFov, hFov) / 2);

  controls.target.copy(sph.center);
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (!dir.lengthSq()) dir.set(0.62, -0.68, 0.39).normalize();
  camera.position.copy(controls.target).addScaledVector(
    dir, THREE.MathUtils.clamp(dist * 1.08, 80, 1300));
  controls.update();
  homeCam = camera.position.clone();
  homeTarget = controls.target.clone();
}


// ---------------------------------------------------------------- hardware
// The textbox already drives the animation; this makes it drive the real cell
// too. gotoIndex() sends the cam STATE and then holds the animation until the
// firmware answers, so what you watch on screen is what the motor has actually
// finished doing — not a guess running alongside it.
function wireHardware() {
  const btnUsb = $('btnHw'), btnBle = $('btnBle'), stat = $('hwstat');
  // One status line, not a scrolling log — the Arduino monitor owns the chatter.
  // But a failure has to be VISIBLE: the first version only did console.log, so a
  // busy COM port looked exactly like nothing happening.
  const say = (text, kind) => {
    stat.textContent = text;
    stat.className = text ? 'on ' + (kind || '') : '';
  };
  const line = t => console.log('[cell]', t);

  // Both transports expose the same goToState/setSpeed, so everything downstream
  // is identical whether the cell is on a cable or on its own access point.
  const onState = (usb) => (st) => {
    const on = st === 'connected';
    const btn = usb ? btnUsb : btnBle, other = usb ? btnBle : btnUsb;
    btn.textContent = on ? (usb ? 'USB: LIVE' : 'Bluetooth: LIVE')
                         : (usb ? 'Connect USB' : 'Connect Bluetooth');
    btn.classList.toggle('on', on);
    other.disabled = on;                 // one transport at a time
    if (!on) { hwBusy = false; say('disconnected'); }
  };

  async function attach(make, btn, usb) {
    if (cell && cell.connected) { await cell.disconnect(); cell = null; return; }
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = 'Connecting…';
    say(usb ? 'waiting for the board to reset and home…'
            : 'pick Braillix-Cell in the Bluetooth chooser…');
    try {
      cell = make();
      await cell.connect();
      await cell.setSpeed(...clampHw(FW.vmax, FW.accel));
      say('live — the cam follows the text box', 'good');
      gotoIndex(idx);
    } catch (e) {
      cell = null;
      btn.textContent = was;
      btn.classList.remove('on');
      say(e.message, 'bad');
      line(e.message);
    } finally {
      btn.disabled = false;
    }
  }

  if (!serialSupported()) {
    // Android runs Chrome but has no Web Serial at all, so "needs Chrome" reads
    // as nonsense on a tablet. Name the real requirement: a desktop.
    btnUsb.textContent = 'USB: desktop only';
    btnUsb.disabled = true;
    say('Web Serial needs Chrome or Edge on a computer. Bluetooth works here, '
      + 'and is the only one that works from GitHub Pages.', 'bad');
  } else {
    // requestPort() must be reached straight from the click, not after an await
    btnUsb.addEventListener('click', () =>
      attach(() => new Cell(line, onState(true)), btnUsb, true));
  }

  if (!bleSupported()) {
    btnBle.textContent = 'Bluetooth: unsupported';
    btnBle.disabled = true;
  } else {
    btnBle.addEventListener('click', () =>
      attach(() => new BleCell(line, onState(false)), btnBle, false));
  }
}

function wireUI() {
  $('word').addEventListener('input', e => {
    word = e.target.value || ' ';   // case is meaningful now: it drives the capital sign
    idx = 0; gotoIndex(0);
    syncWordMeta();
  });
  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; });
  // click anywhere that is not a dot or the card itself
  addEventListener('pointerdown', e => {
    if (openSpot && !e.target.closest('#info') && !e.target.closest('.spot')) closeInfo();
  });
  addEventListener('keydown', e => {
    // never steal keys from the text field, and never fight a browser shortcut
    if (e.target.matches('input,textarea,summary') ||
        e.metaKey || e.ctrlKey || e.altKey) {
      if (e.key === 'Escape') closeInfo();
      return;
    }
    switch (e.key) {
      case ' ':          e.preventDefault(); running = !running; syncRun(); break;
      case 'ArrowRight': e.preventDefault(); running = false; syncRun(); gotoIndex(idx + 1); break;
      case 'ArrowLeft':  e.preventDefault(); running = false; syncRun(); gotoIndex(idx - 1); break;
      case 'x': case 'X': setXray(!xray); break;
      case 'e': case 'E': setElectronics(!elec); break;
      case 'r': case 'R': resetView(); break;
      case 'c': case 'C': $('railToggle').click(); break;
      case 'Escape':      closeInfo(); break;
    }
  });

  // the two panes are tabs only below 840px; above it they are both always on
  const tabs = [['tabCtl', 'paneCtl'], ['tabEnc', 'paneEnc']];
  for (const [t, pane] of tabs)
    $(t).addEventListener('click', () => {
      for (const [t2, p2] of tabs) {
        const on = t2 === t;
        $(t2).setAttribute('aria-selected', String(on));
        $(p2).classList.toggle('on', on);
      }
    });
  $('info').querySelector('.x').addEventListener('click', closeInfo);

  $('btnAddCell').addEventListener('click', addUnit);
  $('btnDelCell').addEventListener('click', removeUnit);

  // Collapsed by default on a phone, where 46dvh of chrome buries the model;
  // open by default on a desktop, where the rail is not in the model's way.
  const narrow = matchMedia('(max-width:840px)');
  const setRail = open => {
    document.body.classList.toggle('railoff', !open);
    const t = $('railToggle');
    t.setAttribute('aria-expanded', String(open));
    t.setAttribute('aria-label', open ? 'Hide controls' : 'Show controls');
    // the canvas box is observed, so nothing has to guess when the rail
    // transition has finished
  };
  setRail(!narrow.matches);
  $('railToggle').addEventListener('click',
    () => setRail(document.body.classList.contains('railoff')));

  $('btnXray').addEventListener('click', () => setXray(!xray));
  $('btnElec').addEventListener('click', () => setElectronics(!elec));
  wireHardware();
  $('btnStep').addEventListener('click', () => { running = false; syncRun(); gotoIndex(idx + 1); });
  $('btnView').addEventListener('click', resetView);
  $('btnRun').addEventListener('click', () => { running = !running; syncRun(); });
  $('speed').addEventListener('input', e => {
    speed = parseFloat(e.target.value);
    $('speedv').textContent = speed.toFixed(1) + '×';
    e.target.setAttribute('aria-valuetext', speed.toFixed(2) + ' times');
    syncSpeedFill();
    // The slider scales simulated TIME by k. Replaying a fixed distance k times
    // faster means velocity k and acceleration k^2, so push those to the motor or
    // the screen and the cam stop agreeing the moment the slider moves.
    if (cell && cell.connected)
      cell.setSpeed(...clampHw(Math.round(FW.vmax * speed), Math.round(FW.accel * speed * speed)));
  });
  // The stage is inset by the rail, so the window is the wrong box to measure.
  // Debounced through rAF because iOS fires resize on every URL-bar scroll pixel.
  let rz = 0;
  const onBox = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(resizeStage); };
  addEventListener('resize', onBox);
  // The rail collapsing changes the canvas box without firing `resize`, and a
  // setTimeout tuned to the CSS transition was landing a frame early -- the
  // canvas stayed 432px tall inside an 800px stage and the row sat high and
  // small. Observing the element removes the guess entirely.
  new ResizeObserver(onBox).observe(document.getElementById('stage'));
}

function syncRun() {
  const b = $('btnRun');
  b.classList.toggle('on', running);
  b.textContent = running ? 'Pause' : 'Simulate';
}

function resetView() {
  camera.position.copy(homeCam);
  controls.target.copy(homeTarget);
  controls.update();
}

function syncSpeedFill() {
  const el = $('speed');
  if (el) el.style.setProperty('--fill',
    (((speed - 0.25) / 2.75) * 100).toFixed(1) + '%');
}

// "11 chars -> 13 cells" under the input. Free, and it teaches the indicator-cell
// idea that currentCells() works hard to model -- capitals and digits cost a cell.
function syncWordMeta() {
  const el = $('wordmeta');
  if (!el) return;
  const n = $('word').value.length, c = currentCells().length;
  el.textContent = `${n} char${n === 1 ? '' : 's'} → ${c} cell${c === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------- loop
// SINGLE place that moves anything. tick() and the debug snapshot both call this,
// so a screenshot can never show a different mechanism state than the live view.
function updateMechanism() {
  for (const u of units) {
    if (u.cam) u.cam.rotation.z = THREE.MathUtils.degToRad(u.deg);
    u.linkages.forEach((o, i) => {
      o.position.z = CAM_FLAT + linkageLift(i + 1, u.deg);
    });
  }
}

// kept for the debug hooks, which drive a single angle by hand
function updateMechanismAt(deg) {
  if (parts.cam) parts.cam.rotation.z = THREE.MathUtils.degToRad(deg);
  // Position only. Nothing about a linkage's appearance changes with its state —
  // a raised dot looks exactly like a lowered one, just 0.8mm higher, because that
  // is what the real part does. Read the state off the braille cell in the corner.
  linkages.forEach((o, i) => {
    o.position.z = CAM_FLAT + linkageLift(i + 1, deg);
  });
}

let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // the cam always drives toward targetDeg, running or not — otherwise Step sets a
  // new target and nothing turns. Only the auto-advance is gated on `running`.
  // `speed` scales simulated TIME, so the profile shape stays identical to the
  // real motor's — at 1.0x the screen and the cam take the same milliseconds.
  const sdt = dt * speed;
  let busy = false;
  for (const u of units) {
    if (!u.move) { u.deg = u.target; continue; }
    u.move.t += sdt;
    u.deg = u.move.from + u.move.dir * moveAt(u.move);
    if (u.move.t >= u.move.T) { u.deg = u.target; u.move = null; }
    else busy = true;
  }
  // unit 0 is what the readout and the real hardware follow
  if (units.length) { camDeg = units[0].deg; move = units[0].move; }

  if (busy) dwell = 0;
  else if (running && !hwBusy) {
    // A real cell sets the pace: showState() blocks while the motor runs, so we
    // hold until it reports back rather than racing ahead of it.
    dwell += sdt;
    if (dwell > FW.gapMs / 1000) { dwell = 0; gotoIndex(idx + 1); }
  } else if (!running) dwell = 0;

  stepXray(dt);
  updateMechanism();
  updateHotspots();

  controls.update();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- boot
async function main() {
  const err = m => {
    $('loaderr').innerHTML = m;
    $('loadbar').classList.add('err');
    $('loadname').textContent = 'failed';
    $('loadpct').textContent = '';
  };
  try {
    // no-cache, not no-store: the browser still keeps the file, it just has to
    // ask whether it changed. Without this a stale copy sticks around for the
    // heuristic lifetime — locally that showed the OLD ramp angles against
    // freshly rebuilt geometry, and on GitHub Pages it would outlive a deploy.
    P = await (await fetch('./braillix_params.json',
                           { cache: 'no-cache' })).json();
  } catch (e) {
    return err('Could not load <b>braillix_params.json</b>.<br>' +
      'This app must be served over http, not opened as a file.<br>' +
      'Double-click <b>run.bat</b>.');
  }
  CAM = P.cam; STACK = P.stack;
  STATES = CAM.states; SLICE = CAM.slice_angle;
  // ramp_angle became a per-track array at R-07. Tolerate the old scalar so an
  // out-of-date params file degrades to the previous behaviour instead of
  // silently making every ramp NaN.
  RAMP = Array.isArray(CAM.ramp_angle)
    ? CAM.ramp_angle
    : new Array(CAM.dots).fill(CAM.ramp_angle);
  PIN_LIFT = CAM.pin_lift; CAM_FLAT = STACK.cam_flat_z;
  Z_SIGN = P.motion.blender_z_sign; STEPS_PER_POS = P.motion.steps_per_position;
  D2B = Object.fromEntries(Object.entries(P.encoding.DOT_TO_BIT).map(([k, v]) => [+k, v]));

  buildScene();

  let gltf;
  try {
    gltf = await loadGlb('./braillix.glb');
  } catch (e) {
    return err('Could not load <b>braillix.glb</b>.<br>Rebuild it with:<br>' +
      '<code>blender --background --factory-startup --python renders/export_glb.py</code>');
  }

  scene.add(gltf.scene);
  unitTemplate = gltf.scene;
  gltf.scene.traverse(o => { if (o.isMesh || o.isObject3D) parts[o.name] = parts[o.name] || o; });
  applyMaterials(gltf.scene);

  linkages = [];
  for (let d = 1; d <= 6; d++) {
    const o = gltf.scene.getObjectByName('linkage_' + d);
    if (!o) return err(`GLB is missing <b>linkage_${d}</b>. Re-run renders/export_glb.py`);
    linkages.push(o);
  }
  parts.cam = gltf.scene.getObjectByName('cam');
  XRAY_PARTS.forEach(n => parts[n] = gltf.scene.getObjectByName(n));

  await buildElectronics(gltf.scene);
  addUnit();                       // unit 0 wraps the template already in the scene

  wireUI();
  syncRun();
  gotoIndex(0);
  camDeg = targetDeg;          // start settled on the first letter, not mid-travel

  // Respect reduced motion: do not auto-advance, and stop the camera drifting
  // after a drag. The cam's own trapezoid is content, not decoration, so Step
  // still animates -- a user who presses it is asking for exactly that.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    running = false;
    controls.enableDamping = false;
  }
  syncRun();
  syncSpeedFill();
  syncWordMeta();
  $('loading').classList.add('gone');

  // Verification hook. The plan requires checking that the dots raised in 3D match
  // the encoding table exactly, and that no dot ever rests at a partial height
  // (which is how a lost mid-dwell offset shows up). Cheap to keep, and it is the
  // only way to test the real scene rather than just the readout.
  window.__braillix = {
    scene: () => scene,
    look: (px, py, pz, tx, ty, tz) => {          // debug: park the camera precisely
      camera.position.set(px, py, pz);
      controls.target.set(tx, ty, tz);
      controls.update();
    },
    lift: (d, deg = camDeg) => linkageLift(d, deg),
    units: () => units.length,
    unitState: () => units.map((u, k) => ({
      k, deg: +u.deg.toFixed(2), target: +u.target.toFixed(2),
      pos: u.pos, moving: !!u.move,
      camRot: +(u.cam.rotation.z * 180 / Math.PI).toFixed(2),
    })),
    addUnit, removeUnit,
    linkZ: () => linkages.map(o => +o.position.z.toFixed(4)),
    camDeg: () => camDeg,
    posFor: ch => cellToPos(LETTERS[ch.toLowerCase()] ?? []),
    settledLifts: ch => {
      const deg = camAngleForState(cellToPos(LETTERS[ch.toLowerCase()] ?? []));
      return [1, 2, 3, 4, 5, 6].map(d => +linkageLift(d, deg).toFixed(4));
    },
    parts: () => Object.keys(parts),
    bbox: name => {
      const o = scene.getObjectByName(name);
      if (!o) return null;
      const b = new THREE.Box3().setFromObject(o);
      return { z: [+b.min.z.toFixed(3), +b.max.z.toFixed(3)],
               x: [+b.min.x.toFixed(2), +b.max.x.toFixed(2)],
               y: [+b.min.y.toFixed(2), +b.max.y.toFixed(2)] };
    },
    mat: name => {
      const o = scene.getObjectByName(name);
      if (!o || !o.material) return null;
      const m = o.material;
      return { metalness: m.metalness, roughness: m.roughness,
               color: '#' + m.color.getHexString(), opacity: m.opacity,
               transparent: m.transparent };
    },
    // Force one frame and hand back a JPEG. requestAnimationFrame is paused when the
    // tab is not compositing, so without this there is no way to eyeball the render
    // from a headless check. preserveDrawingBuffer is off, so the capture MUST happen
    // in the same turn as the draw.
    snap: (w = 720, q = 0.55) => {
      updateMechanism(camDeg);
  updateHotspots();
      renderer.render(scene, camera);
      const src = renderer.domElement;
      const c = document.createElement('canvas');
      c.width = w; c.height = Math.round(w * src.height / src.width);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q);
    },
    setAngleTo: ch => {
      camDeg = targetDeg = camAngleForState(cellToPos(LETTERS[ch.toLowerCase()] ?? []));
      return camDeg;
    },
  };

  requestAnimationFrame(tick);
}

main();
