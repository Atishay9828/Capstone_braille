// =====================================================================
// Braillix — brain pod and electronics, built procedurally.
//
// Why procedural and not sourced CAD: every dimension below is traceable to
// cad/scad/esp32_pod_params.scad or docs/ELECTRONICS_BOM.md. A downloaded
// GrabCAD model looks nicer and tells you nothing about YOUR part — and most
// of them cannot be redistributed from a public repo anyway. A TO-92 is three
// cylinders; paying a licence headache for that is a bad trade.
//
// Coordinates match the CAD: Z up, millimetres, cell centred on the origin.
// =====================================================================
import * as THREE from 'three';

// ---- dimensions, all from the CAD ------------------------------------
export const POD = {
  length: 68, width: 68, height: 58,   // esp32_pod_params.scad:21-23
  wall: 4, floor: 3,
  devkit: { l: 51.5, w: 28.0, t: 1.6, xOffset: -2 },   // :44-45, :57
  hdr: { pitch: 25.6, w: 2.7, h: 8.5, len: 40.0 },     // :49-52
  boardUnderZ: 10.5,                                   // :81 pod_floor+hdr_strip_h-channel
  usb: { w: 14, h: 9, z: 9.5 },                        // :78-82
  jack: { dia: 11.5, x: -20, y: 18 },                  // :66-71
  pogo: { w: 10, h: 8, z: 31 },                        // :87-90
  mag: { dia: 8.4, ys: [-14, 14], z: 29 },             // :96-99
};
const CELL = { length: 68, width: 68, height: 58 };

// 28BYJ-48, 5V geared stepper. The shaft is OFFSET from the body centre by 8mm —
// this is the single most commonly wrong detail in models of this motor.
export const MOTOR = {
  dia: 28.0, height: 19.0, xOffset: -8.0,
  shaftDia: 5.0, shaftLen: 9.5, earSpan: 35.0, earW: 7.0, earT: 1.0,
  faceZ: 41.0,                                          // base-plate underside
};

// ---- shared materials -------------------------------------------------
const M = {};
function mats() {
  if (M.pcbBlue) return M;
  const pbr = (color, metalness, roughness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  M.pcbBlue   = pbr(0x1b4b8f, 0.15, 0.55);
  M.pcbBlack  = pbr(0x14161c, 0.15, 0.55);
  M.shellPETG = pbr(0x5a6b7c, 0.05, 0.75, { transparent: true, opacity: 1 });
  M.tin       = pbr(0xc8ccd2, 0.90, 0.28);
  M.gold      = pbr(0xd6b45a, 0.85, 0.32);
  M.blackPlas = pbr(0x1a1a1e, 0.05, 0.60);
  M.whitePlas = pbr(0xe8e8ea, 0.05, 0.55);
  M.bluePlas  = pbr(0x2f6fd0, 0.05, 0.50);
  M.copper    = pbr(0xb5651d, 0.80, 0.35);
  M.ledRed    = pbr(0xff3b3b, 0.10, 0.35, { emissive: 0x330000 });
  M.ledGreen  = pbr(0x3bff7a, 0.10, 0.35, { emissive: 0x003311 });
  M.motorCan  = pbr(0x9ba3aa, 0.85, 0.30);
  M.resistor  = pbr(0x2b2b30, 0.10, 0.45);   // SMD chip resistor, black body
  M.resistTHT = pbr(0xd8c89a, 0.05, 0.55);   // through-hole, beige
  M.capCer    = pbr(0xc9a06a, 0.05, 0.60);   // ceramic, tan
  M.capElec   = pbr(0x23252c, 0.35, 0.35);   // electrolytic can
  M.solder    = pbr(0xb9bcc2, 0.95, 0.25);
  M.crystal   = pbr(0xd9dde3, 0.92, 0.20);
  M.magnet    = pbr(0xb8bcc4, 0.95, 0.22);
  M.wire = {
    red:    pbr(0xd93b3b, 0.02, 0.42), black: pbr(0x1b1c20, 0.02, 0.45),
    yellow: pbr(0xe0bf34, 0.02, 0.42), green: pbr(0x3aa757, 0.02, 0.42),
    blue:   pbr(0x3a72c4, 0.02, 0.42), white: pbr(0xdfe2e6, 0.02, 0.42),
    orange: pbr(0xe07b2c, 0.02, 0.42), purple: pbr(0x8a54c4, 0.02, 0.42),
  };
  // The scene supplies a PMREM environment, so metals have something to reflect.
  // Without bumping this the tiny parts read as flat grey chips.
  Object.values(M).forEach(m => { if (m.isMaterial) m.envMapIntensity = 1.35; });
  Object.values(M.wire).forEach(m => { m.envMapIntensity = 0.9; });
  return M;
}

// ---- tiny helpers -----------------------------------------------------
const box = (w, d, h, m, pos, name) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), m);
  o.position.set(...pos); if (name) o.name = name;
  o.castShadow = o.receiveShadow = true;
  return o;
};
const cyl = (dia, h, m, pos, name, seg = 24, rotX = 0) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(dia / 2, dia / 2, h, seg), m);
  o.rotation.x = rotX || Math.PI / 2;          // default: cylinder axis -> Z
  o.position.set(...pos); if (name) o.name = name;
  o.castShadow = o.receiveShadow = true;
  return o;
};

// A hollow shell drawn as five thin slabs. Cheaper and cleaner than CSG, and it
// lets the walls go transparent in X-ray while the electronics stay solid.
function hollowShell(L, W, H, wall, floor, mat, skipPlusX) {
  const g = new THREE.Group();
  g.add(box(L, W, floor, mat, [0, 0, floor / 2]));                       // floor
  g.add(box(wall, W, H - floor, mat, [-L / 2 + wall / 2, 0, floor + (H - floor) / 2]));
  if (!skipPlusX)
    g.add(box(wall, W, H - floor, mat, [L / 2 - wall / 2, 0, floor + (H - floor) / 2]));
  g.add(box(L - 2 * wall, wall, H - floor, mat, [0, -W / 2 + wall / 2, floor + (H - floor) / 2]));
  g.add(box(L - 2 * wall, wall, H - floor, mat, [0, W / 2 - wall / 2, floor + (H - floor) / 2]));
  return g;
}

// ---- discrete components ---------------------------------------------
// Real package sizes. 0805 is 2.0x1.25x0.5mm, SOT-23 is 2.9x1.3x1.1, and a DIP-16
// on 7.62mm rows is 19.7 long. At this scale they are specks, but a board with no
// specks on it reads as a toy.
const smd0805 = (m, pos, mat) => {
  const g = new THREE.Group();
  g.add(box(2.0, 1.25, 0.5, mat, [0, 0, 0.25]));
  for (const s of [-1, 1]) g.add(box(0.4, 1.25, 0.52, m.solder, [s * 0.8, 0, 0.26]));
  g.position.set(...pos);
  return g;
};
const dip = (m, pins, pos, name) => {
  const g = new THREE.Group();
  const L = pins / 2 * 2.54, W = 7.0;
  g.add(box(L, W, 3.4, m.blackPlas, [0, 0, 1.7]));
  g.add(cyl(2.2, 0.4, m.pcbBlue, [-L / 2 + 2, 0, 3.4], null, 12));    // pin-1 dimple
  for (let i = 0; i < pins / 2; i++)
    for (const s of [-1, 1])
      g.add(box(0.5, 0.9, 3.2, m.solder,
        [-L / 2 + 1.27 + i * 2.54, s * (W / 2 + 0.3), -1.0]));
  g.position.set(...pos); if (name) g.name = name;
  return g;
};
const electrolytic = (m, dia, h, pos) => {
  const g = new THREE.Group();
  g.add(cyl(dia, h, m.capElec, [0, 0, h / 2], null, 16));
  g.add(cyl(dia * 0.85, 0.3, m.solder, [0, 0, h - 0.15], null, 16));
  g.position.set(...pos);
  return g;
};

// ---------------------------------------------------------------- ESP32
function esp32Devkit() {
  const m = mats(), g = new THREE.Group();
  const { l, w, t } = POD.devkit;
  g.add(box(l, w, t, m.pcbBlack, [0, 0, 0], 'pcb'));
  // WROOM-32 module: the metal can, offset to one end like the real board
  g.add(box(18, 25.5, 3.1, m.tin, [-l / 2 + 12, 0, t / 2 + 1.55], 'wroom'));
  g.add(box(6, 18, 0.6, m.pcbBlack, [-l / 2 + 24, 0, t / 2 + 0.3]));      // antenna keepout
  // USB-C socket at the -X end
  g.add(box(7.5, 9, 3.2, m.tin, [-l / 2 - 0.5, 0, t / 2 + 1.6], 'usb'));
  // two 15-pin male header rows
  for (const s of [-1, 1]) {
    g.add(box(38, 2.5, 2.5, m.blackPlas, [2, s * POD.hdr.pitch / 2, -t / 2 - 1.25]));
    for (let i = 0; i < 15; i++)
      g.add(box(0.6, 0.6, 6, m.gold, [2 - 17.8 + i * 2.54, s * POD.hdr.pitch / 2, -t / 2 - 3.6]));
  }
  const top = t / 2;
  // AMS1117-3.3 regulator in SOT-223 — the big tab is how you spot it
  g.add(box(6.5, 3.5, 1.6, m.blackPlas, [l / 2 - 15, 9.5, top + 0.8], 'ams1117'));
  g.add(box(3.2, 2.0, 0.3, m.solder, [l / 2 - 15, 11.6, top + 0.15]));
  // CH340C USB-serial, SOP-16
  g.add(box(10.0, 4.0, 1.5, m.blackPlas, [l / 2 - 27, -9.5, top + 0.75], 'ch340'));
  // BOOT and EN tactile buttons
  for (const [x, lbl] of [[l / 2 - 5, 'btn_en'], [l / 2 - 13, 'btn_boot']]) {
    g.add(box(6, 6, 2.5, m.blackPlas, [x, -10.5, top + 1.25], lbl));
    g.add(cyl(3.4, 1.0, m.whitePlas, [x, -10.5, top + 3.0], null, 12));
  }
  // power + user LEDs
  g.add(smd0805(m, [l / 2 - 21, -3.5, top], m.ledRed));
  g.add(smd0805(m, [l / 2 - 21, -0.5, top], m.ledGreen));
  // electrolytic bulk cap, and the crystal for the USB bridge
  g.add(electrolytic(m, 5.0, 5.5, [l / 2 - 8, 9.5, top]));
  g.add(box(3.2, 2.5, 0.9, m.crystal, [l / 2 - 27, -4.0, top + 0.45], 'xtal'));
  // decoupling caps and resistors scattered where the real board carries them
  const bits = [
    [-6, 5.5, 'r'], [-6, 8.0, 'r'], [-1, 10.5, 'c'], [4, 10.5, 'c'],
    [9, 5.0, 'r'], [14, 9.0, 'c'], [-11, -6.0, 'r'], [-2, -6.5, 'c'],
    [6, -10.5, 'r'], [12, -6.0, 'c'], [18, 4.0, 'r'], [-14, 9.5, 'c'],
  ];
  for (const [x, y, kind] of bits)
    g.add(smd0805(m, [x, y, top], kind === 'r' ? m.resistor : m.capCer));
  return g;
}

// ------------------------------------------------------------ ULN2003
function uln2003() {
  const m = mats(), g = new THREE.Group();
  const top = 0.8;
  g.add(box(35, 32, 1.6, m.pcbBlue, [0, 0, 0], 'pcb'));

  g.add(dip(m, 16, [-4, 5, top], 'uln_ic'));            // the ULN2003 itself, DIP-16

  // white 5-pin JST the motor plugs into
  g.add(box(13, 8, 9, m.whitePlas, [9, -9, top + 4.5], 'motor_socket'));
  for (let i = 0; i < 5; i++)
    g.add(box(0.7, 0.7, 6, m.solder, [9 - 5.1 + i * 2.54, -9, top + 3]));

  // IN1..IN4 male header
  g.add(box(2.5, 10.5, 2.5, m.blackPlas, [-14.5, -9, top + 1.25]));
  for (let i = 0; i < 4; i++)
    g.add(box(0.64, 0.64, 11, m.gold, [-14.5, -12.8 + i * 2.54, top + 3.5]));
  // power header (5V / GND)
  g.add(box(2.5, 5.4, 2.5, m.blackPlas, [-14.5, 6, top + 1.25]));
  for (let i = 0; i < 2; i++)
    g.add(box(0.64, 0.64, 11, m.gold, [-14.5, 4.7 + i * 2.54, top + 3.5]));

  // the four coil LEDs — these are what let you SEE the step sequence
  for (let i = 0; i < 4; i++) {
    const led = smd0805(m, [-11 + i * 5, 13, top], m.ledRed);
    led.name = 'coil_led_' + (i + 1);
    g.add(led);
    g.add(smd0805(m, [-11 + i * 5, 10.2, top], m.resistor));   // its series resistor
  }
  // jumper link and a decoupling cap
  g.add(box(5, 2.5, 2.5, m.bluePlas, [13, 10, top + 1.25], 'jumper'));
  g.add(smd0805(m, [2, -13, top], m.capCer));
  g.add(electrolytic(m, 4.0, 4.5, [-9, -13, top]));
  return g;
}

// ---------------------------------------------------- 28BYJ-48 stepper
// Replaces the plain cylinder baked into the GLB. The offset shaft, the gearbox
// bulge and the connector are what make it recognisable as this exact motor.
function stepper28byj() {
  const m = mats(), g = new THREE.Group();
  const { dia, height, xOffset, shaftDia, shaftLen, earSpan, earW, earT } = MOTOR;
  g.add(cyl(dia, height, m.motorCan, [0, 0, height / 2], 'motor_can', 32));
  g.add(cyl(dia - 1.5, 0.8, m.motorCan, [0, 0, height - 0.4], null, 32));   // crimped lid
  // gearbox boss and the offset output shaft
  g.add(cyl(9.0, 1.5, m.motorCan, [-xOffset, 0, height + 0.75], null, 20));
  g.add(cyl(shaftDia, shaftLen, m.tin, [-xOffset, 0, height + shaftLen / 2], 'shaft', 16));
  // mounting ears
  for (const s of [-1, 1])
    g.add(box(earW, earT, earW, m.tin, [s * earSpan / 2 - 0, 0, height - earW / 2]));
  // the blue 5-pin connector, and a hint of the wire bundle
  g.add(box(6, 14.5, 8, m.bluePlas, [dia / 2 - 1, 0, height / 2], 'connector'));
  g.add(cyl(3.4, 12, m.blackPlas, [dia / 2 + 6, 0, height / 2], 'harness', 12, 0));
  return g;
}

// --------------------------------------------------------- A3144 hall
function hallSensor() {
  const m = mats(), g = new THREE.Group();
  g.add(box(4.1, 1.5, 3.1, m.blackPlas, [0, 0, 1.55], 'to92'));
  for (let i = -1; i <= 1; i++) g.add(box(0.45, 0.45, 6, m.tin, [i * 1.27, 0, -3]));
  return g;
}

// ---------------------------------------------------------- barrel jack
function barrelJack() {
  const m = mats(), g = new THREE.Group();
  g.add(cyl(11.5, 3, m.blackPlas, [0, 0, 1.5], 'flange', 20));
  g.add(cyl(8.0, 11, m.blackPlas, [0, 0, -5.5], 'body', 20));
  g.add(cyl(2.1, 9, m.tin, [0, 0, 4.5], 'pin', 12));
  return g;
}

// ------------------------------------------------------------ pogo pins
// Four spring-loaded pins on the pod's dock face, meeting flat pads on the cell.
// This is the whole reason cells can be chained without a wiring loom.
function pogoPins(count = 4) {
  const m = mats(), g = new THREE.Group();
  const pitch = 2.54, span = (count - 1) * pitch;
  for (let i = 0; i < count; i++) {
    const y = -span / 2 + i * pitch;
    g.add(cyl(1.6, 4.5, m.tin, [0, y, 0], null, 12, Math.PI / 2));       // barrel
    const p = cyl(0.9, 3.2, m.gold, [3.2, y, 0], null, 10, Math.PI / 2); // plunger
    p.rotation.z = Math.PI / 2; g.add(p);
  }
  g.children.forEach(c => { c.rotation.y = Math.PI / 2; });
  return g;
}
function pogoPads(count = 4) {
  const m = mats(), g = new THREE.Group();
  const pitch = 2.54, span = (count - 1) * pitch;
  for (let i = 0; i < count; i++)
    g.add(box(0.4, 1.8, 6, m.gold, [0, -span / 2 + i * pitch, 0]));
  return g;
}

// ---------------------------------------------------------------- wires
// Dupont jumpers drawn as swept tubes through a Catmull-Rom curve. Real jumpers
// sag and bulge; dead-straight lines look like a schematic, not a build.
function wire(pts, mat, dia = 0.9) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const o = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, dia / 2, 6, false), mat);
  o.castShadow = true;
  return o;
}
const dupontEnd = (m, pos) => box(2.5, 2.5, 6.5, m.blackPlas, pos);

// The 13-wire loom from docs/ELECTRONICS_BOM.md, drawn where it actually runs:
// four coil lines and power from the pod to the driver, driver to motor, and the
// hall sensor back to the ESP32.
function harness() {
  const m = mats(), g = new THREE.Group();
  g.name = 'wiring';
  const W = m.wire;
  const podOut = [-68 + 34 - 4, 0, POD.pogo.z];      // pod dock face, world coords

  // pod -> cell, through the pogo interface
  const sig = [W.blue, W.green, W.yellow, W.orange];
  sig.forEach((c, i) => {
    const y = -3.8 + i * 2.54;
    g.add(wire([[podOut[0] - 6, y, POD.pogo.z], [podOut[0] + 2, y, POD.pogo.z + 1],
                [-34 + 6, y * 0.7, 26], [-14, y * 0.5, 12], [-6, -4 + i * 1.6, 8]], c));
  });
  g.add(wire([[podOut[0] - 6, -9, 28], [-34, -9, 24], [-18, -12, 10], [-8, -13, 6]], W.red));
  g.add(wire([[podOut[0] - 6, 9, 28], [-34, 9, 24], [-18, 12, 10], [-8, 12, 6]], W.black));

  // driver -> motor: the five-core ribbon on its white plug
  const mot = [MOTOR.xOffset + MOTOR.dia / 2 + 6, 0, MOTOR.faceZ - MOTOR.height / 2];
  for (let i = 0; i < 5; i++) {
    const y = -5 + i * 2.5;
    g.add(wire([[9 - 5 + i * 2.5, -9, 12], [12, -6 + i * 1.5, 16],
                [mot[0] + 2, y * 0.5, 24], [mot[0], y * 0.4, mot[2]]],
      [W.blue, W.pink || W.purple, W.yellow, W.orange, W.red][i], 0.8));
  }
  // hall sensor -> ESP32
  for (const [c, dy] of [[W.red, -1.27], [W.black, 0], [W.white, 1.27]])
    g.add(wire([[dy, 17.35, MOTOR.faceZ + 1], [dy * 2, 22, 34],
                [-20, 24, 30], [-40, 14, 22], [-56, 6, 14]], c, 0.8));
  return g;
}

// ================================================== the assembled pod
// `printed` is the real shell+lid loaded from pod.glb, which OpenSCAD generated from
// esp32_pod_shell.scad. Passing it in beats redrawing the box here: the USB opening,
// pogo recess, antenna grille, magnet pockets and screw bosses are the features people
// actually want to look at, and slabs have none of them.
export function buildBrainPod(printed) {
  const m = mats(), pod = new THREE.Group();
  pod.name = 'brain_pod';
  const { length: L, width: W, height: H, wall, floor } = POD;

  if (printed) {
    pod.add(printed);
  } else {                                  // fallback if pod.glb is missing
    const shell = hollowShell(L, W, H, wall, floor, m.shellPETG.clone(), false);
    shell.name = 'pod_shell';
    pod.add(shell);
    const lid = box(L, W, wall, m.shellPETG.clone(), [0, 0, H - wall / 2]);
    lid.name = 'pod_lid';
    pod.add(lid);
  }

  // header strips, then the DevKit sitting on them
  for (const s of [-1, 1])
    pod.add(box(POD.hdr.len, POD.hdr.w, POD.hdr.h, m.blackPlas,
      [POD.devkit.xOffset + 2, s * POD.hdr.pitch / 2, floor + POD.hdr.h / 2 - 1]));

  const dk = esp32Devkit();
  dk.name = 'esp32';
  dk.position.set(POD.devkit.xOffset, 0, POD.boardUnderZ + POD.devkit.t / 2);
  pod.add(dk);

  const jack = barrelJack();
  jack.name = 'dc_jack';
  jack.position.set(POD.jack.x, POD.jack.y, H - wall);
  pod.add(jack);

  const pins = pogoPins();
  pins.name = 'pogo_pins';
  pins.position.set(L / 2 - wall, 0, POD.pogo.z);
  pod.add(pins);

  // Dock magnets. esp32_pod_shell.scad:52 cuts the pocket from the OUTER dock face
  // inward, so the disc sits FLUSH with x = +L/2 with its axis along X — not buried
  // mid-wall, and not lying on its side.
  for (const y of POD.mag.ys) {
    const mag = cyl(POD.mag.dia, 1.2, m.magnet, [L / 2 - 0.6, y, POD.mag.z], null, 20);
    mag.rotation.set(0, 0, Math.PI / 2);   // cylinder's Y axis -> X, facing the cell
    pod.add(mag);
  }
  return pod;
}

// ======================================== electronics inside the cell
export function buildCellElectronics() {
  const m = mats(), g = new THREE.Group();
  g.name = 'cell_electronics';

  const drv = uln2003();
  drv.name = 'uln2003';
  drv.position.set(6, -6, 5.0);              // in the 14mm electronics pocket
  g.add(drv);

  const mot = stepper28byj();
  mot.name = 'stepper';
  mot.position.set(MOTOR.xOffset, 0, MOTOR.faceZ - MOTOR.height);
  g.add(mot);

  const hall = hallSensor();
  hall.name = 'hall';
  hall.position.set(0, 17.35, MOTOR.faceZ + 4);   // base_plate.scad pocket
  g.add(hall);

  const pads = pogoPads();
  pads.name = 'pogo_pads';
  pads.position.set(-CELL.length / 2, 0, POD.pogo.z);
  g.add(pads);

  // the cell's mating magnets, flush with its -X face and polarised to attract
  for (const y of POD.mag.ys) {
    const mag = cyl(POD.mag.dia, 1.2, m.magnet,
      [-CELL.length / 2 + 0.6, y, POD.mag.z], null, 20);
    mag.rotation.set(0, 0, Math.PI / 2);
    g.add(mag);
  }

  g.add(harness());
  return g;
}

// ============================================ what each piece actually is
export const PART_INFO = [
  ['brain pod', 'ESP32 BRAIN POD',
   'A 68x68x58 shell, the same brick size as a cell so a docked chain looks uniform. Holds the controller and the power inlet. One pod drives the whole chain.'],
  ['esp32', 'ESP32-WROOM-32 DEVKIT',
   'The controller. 51.5x28mm, dropped onto two female header strips so it lifts out with no soldering. Runs the text-to-braille encoding and drives the motor.'],
  ['dc_jack', 'DC BARREL JACK 5.5/2.1',
   'Power in, on the lid. Sits away from the board so the barrel hangs over open floor. Polarity verified: centre positive.'],
  ['pogo_pins', 'POGO PINS',
   'Spring-loaded contacts on the dock face. They press onto flat pads on the next cell, so cells chain together with no wiring loom and no connector to align.'],
  ['pod_shell', 'POD SHELL (PETG)',
   'The real printed part, straight from esp32_pod_shell.scad - 4mm walls, the USB service opening, the pogo recess, the magnet pockets and the slotted grille that keeps the WiFi antenna out of solid plastic.'],
  ['stepper', '28BYJ-48 STEPPER',
   'The only moving actuator. 28mm can, 19mm tall, 4096 steps per turn. Note the output shaft is offset 8mm from the body centre - that offset drives the whole in-box layout.'],
  ['uln2003', 'ULN2003 DRIVER BOARD',
   'Darlington array. The ESP32 cannot supply the motor coils directly, so four GPIO lines switch this instead. The four LEDs show the coil sequence as it steps.'],
  ['hall', 'HALL SENSOR (BARE TO-92)',
   'Finds home. On power-up the cam turns until the magnet passes it - the only way the firmware learns which of the 64 positions it is sitting on. Shown as the bare TO-92 because the module it ships on is too big for the pocket, so the sensor gets desoldered off its blue carrier board.'],
  ['pogo_pads', 'POGO PADS',
   'The flat gold targets the pins press onto. Flat-to-sprung means no alignment tolerance problem and nothing to snap off.'],
  ['magnets', 'DOCK MAGNETS 8x1mm',
   'Two per face, flush with the dock wall at y +/-14. Poles are reversed between pod and cell so they only latch the right way round - you physically cannot dock a cell backwards.'],
  ['wiring', 'THE 13-WIRE LOOM',
   'Dupont jumpers, no soldering. Four coil lines and power reach the driver, five cores go on to the motor, and three run back from the hall sensor. Colour coding matches the build guide.'],
];
