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
  M.motorCan  = pbr(0x9ba3aa, 0.85, 0.30);
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
  // regulator, two buttons, two LEDs — enough to read as a real board
  g.add(box(4, 4, 1.6, m.blackPlas, [l / 2 - 16, 9, t / 2 + 0.8]));
  for (const x of [l / 2 - 5, l / 2 - 12])
    g.add(box(4.5, 3.5, 2.2, m.blackPlas, [x, -10, t / 2 + 1.1]));
  g.add(box(1.6, 0.8, 0.6, m.ledRed, [l / 2 - 20, -4, t / 2 + 0.3]));
  return g;
}

// ------------------------------------------------------------ ULN2003
function uln2003() {
  const m = mats(), g = new THREE.Group();
  g.add(box(35, 32, 1.6, m.pcbBlue, [0, 0, 0], 'pcb'));
  g.add(box(20, 7, 3.5, m.blackPlas, [-4, 6, 2.55], 'ic'));             // the ULN2003 chip
  g.add(box(15, 8, 9, m.whitePlas, [8, -8, 5.3], 'socket'));            // 5-pin motor socket
  for (let i = 0; i < 4; i++)                                           // IN1..IN4 header
    g.add(box(2.5, 2.5, 8, m.blackPlas, [-14, -12 + i * 2.6, 4.8]));
  for (let i = 0; i < 4; i++)                                           // the four LEDs
    g.add(box(2, 1.2, 0.9, m.ledRed, [-12 + i * 5, 13, 1.25]));
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

  // dock magnets
  for (const y of POD.mag.ys)
    pod.add(cyl(8.4, 1.2, m.tin, [L / 2 - wall / 2, y, POD.mag.z], null, 16, 0));

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
];
