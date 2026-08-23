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

// ---------------------------------------------------------------- cam maths
// Direct port of get_height_at_angle() in cad/scad/braille_cam.scad.
const patternBit = (state, track) => (state >> (CAM.dots - 1 - track)) & 1;
const sCurve = t => (1 - Math.cos(t * Math.PI)) / 2;

function heightFactor(aEff, track) {
  aEff = ((aEff % 360) + 360) % 360;
  const k = Math.floor(aEff / SLICE);
  const ais = aEff - k * SLICE;
  const vc = patternBit(k, track);
  const vp = patternBit((k - 1 + STATES) % STATES, track);
  const vn = patternBit((k + 1) % STATES, track);
  const hr = RAMP / 2;
  if (ais < hr)             { const b = sCurve((ais + hr) / RAMP);            return (1 - b) * vp + b * vc; }
  if (ais > SLICE - hr)     { const b = sCurve((ais - (SLICE - hr)) / RAMP);  return (1 - b) * vc + b * vn; }
  return vc;
}

// TRAP: the cam's ramps are centred on SLICE BOUNDARIES. Aiming at pos*SLICE lands
// mid-ramp and every dot sits halfway up — at state 0 all six read exactly 0.5.
// The firmware has this bug today (breadboard_test.ino targets pos*4096/64 with no
// +32). Half a slice further along is the middle of the flat dwell.
const camAngleForState = pos => Z_SIGN * (pos + 0.5) * SLICE;

// A foot fixed at world angle dot_phase sits over disc-local (phase - rotation);
// the carving already bakes in track_phase, so a_eff collapses to -rotation.
function linkageLift(dot, camDeg) {
  const track = CAM.dot_track[dot - 1];
  const aEff = (CAM.dot_phase[dot - 1] - camDeg) - CAM.track_phase[track];
  return heightFactor(aEff, track) * PIN_LIFT;
}

const cellToPos = cell => cell.reduce((v, d) => v | (1 << D2B[d]), 0);

// ---------------------------------------------------------------- scene
const XRAY_PARTS = ['outer_box', 'top_plate', 'dot_insert'];
let renderer, scene, camera, controls, parts = {}, linkages = [];
let pod = null, cellElec = null, glbMotor = [], podShells = [];
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

function buildScene() {
  const stage = document.getElementById('stage');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12131f);
  scene.fog = new THREE.Fog(0x12131f, 260, 640);

  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 1, 2000);
  camera.up.set(0, 0, 1);                    // Z-up, matching the CAD
  camera.position.set(118, -132, 104);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0, 30);
  controls.minDistance = 55;
  controls.maxDistance = 520;
  controls.update();
  homeCam = camera.position.clone();
  homeTarget = controls.target.clone();

  // Lighting kept deliberately modest. The Blender pass blew every surface to pure
  // white because 220W lamps sat 200mm from a 68mm object; irradiance goes as
  // P/(4*pi*r^2), so at this scale small numbers are correct.
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(120, -90, 190);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const d = 120;
  Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 20, far: 460 });
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.6;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
  fill.position.set(-140, -70, 60);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffd9c2, 0.7);
  rim.position.set(-40, 150, 90);
  scene.add(rim);

  scene.add(new THREE.HemisphereLight(0x9aa6d0, 0x141420, 0.5));

  // catch shadows so the mechanism reads as a solid object in space
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(300, 64),
    new THREE.ShadowMaterial({ opacity: 0.42 }));
  floor.position.z = -0.4;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(560, 28, 0x2b2f4d, 0x1d2036);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -0.3;
  scene.add(grid);

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
  panel(0xffffff, 2.6, [0, 0, 70], [120, 120, 1]);    // soft overhead
  panel(0x9fc4ff, 1.0, [-70, 0, 10], [1, 120, 90]);   // cool side
  panel(0xffd9c2, 0.9, [70, 0, 10], [1, 120, 90]);    // warm side
  panel(0x1a1d2e, 1.0, [0, 0, -70], [140, 140, 1]);   // dark floor bounce
  scene.environment = pmrem.fromScene(env, 0.05).texture;
  pmrem.dispose();
}

function applyMaterials(obj) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const n = o.name;
    const m = o.material;
    m.side = THREE.DoubleSide;
    if (n.startsWith('linkage_')) {
      // Shiny chrome, as requested. This only looks right BECAUSE makeEnvironment()
      // gives it something to reflect — at metalness 0.92 with no environment map
      // the dots reflected pure black plus the red cam and blue fill light, which
      // is what made them read as dark smeared beads. Do not remove the env map.
      // No state tinting: a raised dot looks exactly like a lowered one, because
      // that is what the real part does. The braille cell in the corner is where
      // you read the state.
      m.metalness = 0.92;
      m.roughness = 0.18;
      m.color.set(0xc9ced6);
      m.envMapIntensity = 1.5;
    } else if (n === 'cam') {
      m.metalness = 0.35; m.roughness = 0.34; m.color.set(0xe94560);
    } else if (n.startsWith('motor')) {
      m.metalness = 0.85; m.roughness = 0.3;
    } else if (n === 'base_plate' || n === 'mid_plate') {
      m.metalness = 0.05; m.roughness = 0.88; // matte grey
    } else if (XRAY_PARTS.includes(n)) {
      m.metalness = 0.05; m.roughness = 0.6;
      o.userData.opaque = { opacity: 1, transparent: false };
    }
    m.needsUpdate = true;
  });
}

// The pod docks on the cell's -X face: the pod's +X wall meets the cell's -X wall,
// so its centre sits a full brick away. The GLB's plain-cylinder motor is retired
// in favour of the real 28BYJ-48 shape (offset shaft, gearbox boss, connector).
async function buildElectronics(glbScene) {
  const loadOptional = async (file, what) => {
    try {
      return (await new GLTFLoader().loadAsync(file)).scene;
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

  pod.visible = cellElec.visible = false;   // off until asked for
  buildHotspots();
}

function setElectronics(on) {
  elec = on;
  pod.visible = cellElec.visible = on;
  glbMotor.forEach(o => o.visible = false);       // never show the placeholder again
  $('btnElec').classList.toggle('on', on);
  if (on && !xray) setXray(true);                 // pointless to hide them behind walls
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
   'One per dot. A foot rides the cam track; when it meets a raised section the arm pivots and pushes its dot up 0.8mm through the reading surface.'],
  ['top_plate', 'READING SURFACE',
   'What the finger touches. The six dots sit at standard braille spacing - 2.6mm between rows, 4.8mm between the two columns.'],
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
function updateHotspots() {
  if (!SPOTS.length) return;
  const v = new THREE.Vector3();
  for (const s of SPOTS) {
    if (!shown(s.o)) { s.el.style.display = 'none'; continue; }
    v.copy(s.anchor).project(camera);
    if (v.z > 1) { s.el.style.display = 'none'; continue; }   // behind the camera
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    s.el.style.display = 'block';
    s.el.style.left = x + 'px';
    s.el.style.top = y + 'px';
    const d = Math.hypot(x - ptr.x, y - ptr.y);
    const p = s === openSpot ? 1 : Math.max(0, 1 - d / SPOT_MAX);
    s.el.style.setProperty('--p', (p * p).toFixed(3));        // squared: bites late, feels sharper
  }
}

function setXray(on) {
  xray = on;
  // the pod's own walls have to go glass too, or turning on X-ray leaves the
  // controller sealed inside an opaque box while the cell beside it opens up
  const targets = XRAY_PARTS.map(n => parts[n]).concat(podShells);
  targets.forEach(o => {
    if (!o) return;
    o.traverse(c => {
      if (!c.isMesh) return;
      const m = c.material;
      m.transparent = on;
      m.opacity = on ? 0.2 : 1.0;      // 20% transparent glass
      m.depthWrite = !on;
      m.roughness = on ? 0.12 : 0.6;   // polycarbonate read
      m.metalness = on ? 0.0 : 0.05;
      c.castShadow = !on;
      m.needsUpdate = true;
    });
  });
  const b = document.getElementById('btnXray');
  b.classList.toggle('on', on);
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
  $('e_step').textContent = (pos * STEPS_PER_POS + STEPS_PER_POS / 2) + ' / 4096';
  $('e_ang').textContent = (Math.abs(camAngleForState(pos)) % 360).toFixed(2) + '°';
  $('bits').textContent = pos.toString(2).padStart(6, '0');
}

function gotoIndex(i) {
  const cells = currentCells();
  if (!cells.length) return;
  idx = ((i % cells.length) + cells.length) % cells.length;
  const item = cells[idx];
  const pos = cellToPos(item.cell);
  // shortest path: wrap the wanted angle to the nearest equivalent of camDeg, so
  // the cam turns whichever way is closer. 63 -> 0 is 5.6deg back, not 354.4 forward.
  const want = camAngleForState(pos);
  targetDeg = camDeg + ((((want - camDeg) % 360) + 540) % 360) - 180;
  move = Math.abs(targetDeg - camDeg) > 1e-6 ? planMove(camDeg, targetDeg) : null;
  updateReadout(item, pos);

  if (cell && cell.connected) {
    hwBusy = true;
    cell.goToState(pos).finally(() => { hwBusy = false; });
  }
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
  });
  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; });
  // click anywhere that is not a dot or the card itself
  addEventListener('pointerdown', e => {
    if (openSpot && !e.target.closest('#info') && !e.target.closest('.spot')) closeInfo();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeInfo(); });
  $('info').querySelector('.x').addEventListener('click', closeInfo);

  $('btnXray').addEventListener('click', () => setXray(!xray));
  $('btnElec').addEventListener('click', () => setElectronics(!elec));
  wireHardware();
  $('btnStep').addEventListener('click', () => { running = false; syncRun(); gotoIndex(idx + 1); });
  $('btnView').addEventListener('click', () => {
    camera.position.copy(homeCam); controls.target.copy(homeTarget); controls.update();
  });
  $('btnRun').addEventListener('click', () => { running = !running; syncRun(); });
  $('speed').addEventListener('input', e => {
    speed = parseFloat(e.target.value);
    $('speedv').textContent = speed.toFixed(1) + '×';
    // The slider scales simulated TIME by k. Replaying a fixed distance k times
    // faster means velocity k and acceleration k^2, so push those to the motor or
    // the screen and the cam stop agreeing the moment the slider moves.
    if (cell && cell.connected)
      cell.setSpeed(...clampHw(Math.round(FW.vmax * speed), Math.round(FW.accel * speed * speed)));
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function syncRun() {
  const b = $('btnRun');
  b.classList.toggle('on', running);
  b.textContent = running ? 'Pause' : 'Simulate';
}

// ---------------------------------------------------------------- loop
// SINGLE place that moves anything. tick() and the debug snapshot both call this,
// so a screenshot can never show a different mechanism state than the live view.
function updateMechanism(deg) {
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
  if (move) {
    move.t += sdt;
    camDeg = move.from + move.dir * moveAt(move);
    if (move.t >= move.T) { camDeg = targetDeg; move = null; dwell = 0; }
  } else {
    camDeg = targetDeg;
    // A real cell sets the pace: showState() blocks while the motor runs, so we
    // hold until it reports back rather than racing ahead of it.
    if (running && !hwBusy) {
      dwell += sdt;
      if (dwell > FW.gapMs / 1000) { dwell = 0; gotoIndex(idx + 1); }
    } else if (!running) dwell = 0;
  }

  updateMechanism(camDeg);
  updateHotspots();

  controls.update();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- boot
async function main() {
  const err = m => {
    $('loaderr').innerHTML = m;
    document.querySelector('.spin').style.display = 'none';
  };
  try {
    P = await (await fetch('./braillix_params.json')).json();
  } catch (e) {
    return err('Could not load <b>braillix_params.json</b>.<br>' +
      'This app must be served over http, not opened as a file.<br>' +
      'Double-click <b>run.bat</b>.');
  }
  CAM = P.cam; STACK = P.stack;
  STATES = CAM.states; SLICE = CAM.slice_angle; RAMP = CAM.ramp_angle;
  PIN_LIFT = CAM.pin_lift; CAM_FLAT = STACK.cam_flat_z;
  Z_SIGN = P.motion.blender_z_sign; STEPS_PER_POS = P.motion.steps_per_position;
  D2B = Object.fromEntries(Object.entries(P.encoding.DOT_TO_BIT).map(([k, v]) => [+k, v]));

  buildScene();

  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync('./braillix.glb');
  } catch (e) {
    return err('Could not load <b>braillix.glb</b>.<br>Rebuild it with:<br>' +
      '<code>blender --background --factory-startup --python renders/export_glb.py</code>');
  }

  scene.add(gltf.scene);
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

  wireUI();
  syncRun();
  gotoIndex(0);
  camDeg = targetDeg;          // start settled on the first letter, not mid-travel

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
