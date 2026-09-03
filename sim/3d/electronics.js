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
// v8.5 (2026-08-26) dropped the whole tower 14mm: the motor now stands on a cup in
// the box floor and the mid-plate is gone. Every z in this file moved with it.
export const POD = {
  length: 68, width: 68, height: 46.5,  // esp32_pod_params.scad — v8.8, 44 -> 46.5
  wall: 4, floor: 3,
  devkit: { l: 51.5, w: 28.0, t: 1.6, xOffset: -2 },   // :44-45, :57
  hdr: { pitch: 25.6, w: 2.7, h: 8.5, len: 40.0 },     // :49-52
  boardUnderZ: 10.5,                                   // :81 pod_floor+hdr_strip_h-channel
  usb: { w: 14, h: 9, z: 9.5 },                        // :78-82
  jack: { dia: 11.5, x: -20, y: 18 },                  // :66-71
  pogo: { w: 10, h: 8, z: 15.5, recess: 1 },            // dock_interface.scad dock_center_z
  mag: { dia: 8.4, ys: [-14, 14], z: 13.5 },           // dock_interface.scad dock_mag_z
};
const CELL = { length: 68, width: 68, height: 46.5 };  // outer_box shell_height

// 28BYJ-48, 5V geared stepper. The shaft is OFFSET from the body centre by 8mm —
// this is the single most commonly wrong detail in models of this motor.
// All MEASURED, from cad/scad/motor_spec.scad — which now owns every motor number.
export const MOTOR = {
  dia: 28.1, height: 19.0, xOffset: -7.5,
  shaftDia: 5.0, shaftLen: 9.5, earSpan: 34.7, earW: 7.0, earT: 1.0,
  bossDia: 9.0, bossH: 2.0,   // raised ring at the shaft base; the hub stops on it
  seatZ: 4.0,             // can bottom sits on the box floor (floor_thickness)
  faceZ: 23.0,            // 4 + 19 — the mounting face, was 41
};

// The driver, from cad/scad/electronics_spec.scad. A bare ULN2003AN in a DIP-16
// socket on cut perfboard — the breakout module does not fit the cell at all.
export const DRIVER = {
  pcbLen: 28.0, pcbW: 18.0, pcbT: 1.6,      // 11 x 7 holes off a 10x4cm board
  socketH: 3.4, tail: 1.5,                  // socketed: a dead ULN is replaceable
  icLen: 19.5, icW: 6.4, icH: 4.5, rowPitch: 7.62, pinPitch: 2.54,
  overallH: 11.0,                           // elec_overall_h, tails to chip top
  x: 16.0, y: 0.0, z: 4.0,                  // stands on the box floor, +X gap
};

// ---- shared materials -------------------------------------------------
const M = {};
function mats() {
  if (M.pcbBlue) return M;
  const pbr = (color, metalness, roughness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  M.pcbBlue   = pbr(0x1b4b8f, 0.15, 0.55);
  M.pcbFr4    = pbr(0x9c8862, 0.05, 0.72);   // bare perfboard, no soldermask
  M.pcbBlack  = pbr(0x14161c, 0.15, 0.55);
  M.shellPETG = pbr(0x5a6b7c, 0.05, 0.75, { transparent: true, opacity: 1 });
  M.tin       = pbr(0xc8ccd2, 0.60, 0.46);
  M.gold      = pbr(0xd6b45a, 0.62, 0.42);
  M.blackPlas = pbr(0x1a1a1e, 0.05, 0.60);
  M.whitePlas = pbr(0xe8e8ea, 0.05, 0.55);
  M.bluePlas  = pbr(0x2f6fd0, 0.05, 0.50);
  M.copper    = pbr(0xb5651d, 0.80, 0.35);
  M.ledRed    = pbr(0xff3b3b, 0.10, 0.35, { emissive: 0x330000 });
  M.ledGreen  = pbr(0x3bff7a, 0.10, 0.35, { emissive: 0x003311 });
  M.motorCan  = pbr(0x9ba3aa, 0.55, 0.50);
  M.resistor  = pbr(0x2b2b30, 0.10, 0.45);   // SMD chip resistor, black body
  M.resistTHT = pbr(0xd8c89a, 0.05, 0.55);   // through-hole, beige
  M.capCer    = pbr(0xc9a06a, 0.05, 0.60);   // ceramic, tan
  M.capElec   = pbr(0x23252c, 0.25, 0.55);   // electrolytic can
  // Metalness near 1 with low roughness makes a part a MIRROR. On specks this
  // size the only thing they can mirror is the three environment panels, so a
  // slow orbit dragged a bright streak across every pad and can — it read as
  // something spinning under the motor. Rougher and less metallic kills it.
  M.solder    = pbr(0xb9bcc2, 0.55, 0.52);
  M.crystal   = pbr(0xd9dde3, 0.60, 0.44);
  M.magnet    = pbr(0xb8bcc4, 0.60, 0.46);
  M.wire = {
    red:    pbr(0xd93b3b, 0.02, 0.42), black: pbr(0x1b1c20, 0.02, 0.45),
    yellow: pbr(0xe0bf34, 0.02, 0.42), green: pbr(0x3aa757, 0.02, 0.42),
    blue:   pbr(0x3a72c4, 0.02, 0.42), white: pbr(0xdfe2e6, 0.02, 0.42),
    orange: pbr(0xe07b2c, 0.02, 0.42), purple: pbr(0x8a54c4, 0.02, 0.42),
  };
  // The scene supplies a PMREM environment, so metals have something to reflect.
  // Without bumping this the tiny parts read as flat grey chips.
  // Was 0.42 here against 1.5 in app.js — a 3.5x mismatch that made the
  // mechanism and the electronics look photographed in different rooms.
  // One value now; wires stay lower because silicone really is matte.
  Object.values(M).forEach(m => { if (m.isMaterial) m.envMapIntensity = 1.0; });
  Object.values(M.wire).forEach(m => { m.envMapIntensity = 0.7; });
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
// v8.8: the 35 x 32mm breakout is GONE. It never fitted — flat it wants 32mm of
// width against 12.35mm of clear strip, on edge it wants 32mm of height against
// 23mm. Almost all of that was the JST socket, the LED row and the header, none
// of which the cell uses. What remains is the part that does the work: a bare
// ULN2003AN in a DIP-16 socket on a cut scrap of perfboard.
// Every number here is from cad/scad/electronics_spec.scad.
function uln2003() {
  const m = mats(), g = new THREE.Group();
  const { pcbLen, pcbW, pcbT, socketH, icLen, icW, icH, rowPitch, pinPitch,
          tail } = DRIVER;

  // Drawn flat in its own frame: board in XY, stack up +Z. The caller stands it
  // on edge. Board origin is the top face, so z=0 is the component surface.
  g.add(box(pcbW, pcbLen, pcbT, m.pcbFr4, [0, 0, -pcbT / 2], 'pcb'));

  // the 11 x 7 hole grid, drawn as pads — it is what makes it read as perfboard
  for (let ix = -3; ix <= 3; ix++)
    for (let iy = -5; iy <= 5; iy++)
      g.add(cyl(1.5, 0.06, m.gold, [ix * pinPitch, iy * pinPitch, 0.03], null, 8));

  // DIP-16 socket, then the chip seated in it
  g.add(box(icW + 1.6, icLen + 1.2, socketH, m.blackPlas, [0, 0, socketH / 2],
            'dip_socket'));
  const ic = new THREE.Group();
  ic.add(box(icW, icLen, icH, m.blackPlas, [0, 0, icH / 2]));
  ic.add(cyl(1.6, 0.3, m.pcbFr4, [0, -icLen / 2 + 2, icH], null, 12));  // pin 1
  for (let i = 0; i < 8; i++)
    for (const sx of [-1, 1])
      ic.add(box(0.6, 0.5, socketH,
                 m.solder, [sx * rowPitch / 2, -icLen / 2 + 1.5 + i * pinPitch,
                            socketH / 2]));
  ic.position.z = socketH;
  ic.name = 'uln_ic';
  g.add(ic);

  // trimmed pin tails on the solder side
  for (let i = 0; i < 8; i++)
    for (const sx of [-1, 1])
      g.add(box(0.6, 0.5, tail, m.solder,
                [sx * rowPitch / 2, -icLen / 2 + 1.5 + i * pinPitch,
                 -pcbT - tail / 2]));

  // the spare hole rows earn their place: motor pigtail pads, flyback commons,
  // and the 5V/GND pair the pogo bus lands on
  g.add(electrolytic(m, 4.0, 4.5, [0, pcbLen / 2 - 3.5, 0]));
  g.add(smd0805(m, [-pinPitch, -pcbLen / 2 + 3.5, 0], m.capCer));
  return g;
}

// ---------------------------------------------------- 28BYJ-48 stepper
// Replaces the plain cylinder baked into the GLB. The offset shaft, the gearbox
// bulge and the connector are what make it recognisable as this exact motor.
function stepper28byj() {
  const m = mats(), g = new THREE.Group();
  const { dia, height, xOffset, shaftDia, shaftLen, earSpan, earW, earT,
          bossDia, bossH } = MOTOR;
  g.add(cyl(dia, height, m.motorCan, [0, 0, height / 2], 'motor_can', 32));
  g.add(cyl(dia - 1.5, 0.8, m.motorCan, [0, 0, height - 0.4], null, 32));   // crimped lid
  // The shaft boss, then the shaft. shaftLen is measured face-to-tip, so the
  // 5mm cylinder only covers what is left above the boss.
  g.add(cyl(bossDia, bossH, m.motorCan, [-xOffset, 0, height + bossH / 2], null, 20));
  const stub = shaftLen - bossH;
  g.add(cyl(shaftDia, stub, m.tin, [-xOffset, 0, height + bossH + stub / 2], 'shaft', 16));
  // mounting ears
  for (const s of [-1, 1])
    g.add(box(earW, earT, earW, m.tin, [s * earSpan / 2 - 0, 0, height - earW / 2]));
  // the blue 5-pin connector, and a hint of the wire bundle
  g.add(box(6, 14.5, 8, m.bluePlas, [dia / 2 - 1, 0, height / 2], 'connector'));
  g.add(cyl(3.4, 12, m.blackPlas, [dia / 2 + 6, 0, height / 2], 'harness', 12, 0));
  return g;
}

// --------------------------------------------------------- A3144 hall
// base_plate.scad:98-106 — the pocket is 4.1 wide x 3.1 deep x 1.6 HIGH, buried in
// the plate with 0.4mm of material left between it and the cam pocket floor. It was
// previously drawn 3.1mm tall standing up at z=45, which put it inside the cam disc.
function hallSensor() {
  const m = mats(), g = new THREE.Group();
  g.add(box(4.1, 3.1, 1.6, m.blackPlas, [0, 0, 0], 'to92'));
  for (let i = -1; i <= 1; i++)
    g.add(box(0.45, 0.45, 5, m.tin, [i * 1.27, 0, -3.3]));   // legs hang below
  return g;
}

// ---------------------------------------------------------- barrel jack
function barrelJack() {
  const m = mats(), g = new THREE.Group();
  g.add(cyl(11.5, 3, m.blackPlas, [0, 0, 1.5], 'flange', 20));
  g.add(cyl(8.0, 11, m.blackPlas, [0, 0, -5.5], 'body', 20));
  g.add(cyl(7.4, 6.5, m.blackPlas, [0, 0, 6.25], 'barrel', 20));
  // the centre pin lives INSIDE the barrel; it used to spear 6mm out past the rim
  // and read as a second motor shaft sticking out of the lid
  g.add(cyl(2.1, 5.0, m.tin, [0, 0, 5.5], 'pin', 12));
  return g;
}

// ------------------------------------------------------------ pogo pins
// Four spring-loaded pins on the pod's dock face, meeting flat pads on the cell.
// This is the whole reason cells can be chained without a wiring loom.
function pogoPins(count = 4) {
  const m = mats(), g = new THREE.Group();
  const pitch = 2.54, span = (count - 1) * pitch;
  // axis along X (toward the cell). Setting rotation.x AND rotation.y compounded
  // into a quarter-turn that squashed each pin into a flat disc.
  const alongX = o => { o.rotation.set(0, 0, Math.PI / 2); return o; };
  for (let i = 0; i < count; i++) {
    const y = -span / 2 + i * pitch;
    g.add(alongX(cyl(1.9, 4.5, m.tin, [-1.2, y, 0], null, 14)));      // body
    g.add(alongX(cyl(1.0, 3.6, m.gold, [2.0, y, 0], null, 12)));      // plunger
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), m.gold);
    tip.position.set(3.8, y, 0);
    g.add(tip);
  }
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
// NOTHING crosses the dock gap. That is the entire point of the pogo interface:
// four spring pins meet four flat pads and carry 5V, GND, SDA, SCL
// (docs/DEMO_VS_PRODUCT.md:130). Each cell drives its own motor locally, so the
// coil lines never leave the cell they belong to. An earlier version ran jumpers
// straight through the pod wall into the cell, which would have made the pogo
// pins decorative.
const POGO_NET = ['5V', 'GND', 'SDA', 'SCL'];
const pogoY = i => -3.81 + i * 2.54;

// Where the per-cell I/O expander goes in the multi-cell product. It does not exist
// yet, and pretending otherwise is why several wires used to stop in mid-air: SDA,
// SCL and the four IN lines have nothing on a ULN2003 to land on. They terminate
// here instead, on a real footprint, which is the honest picture.
const EXPANDER = [-20, -4, 4.6];   // on the box floor (4mm) now the bay is gone
function expanderSlot() {
  const m = mats(), g = new THREE.Group();
  g.name = 'expander_slot';
  g.add(box(24, 20, 0.4, m.pcbBlue, [0, 0, 0]));
  for (const s of [-1, 1])
    for (let i = 0; i < 8; i++)
      g.add(box(1.4, 1.4, 0.5, m.gold, [-8.9 + i * 2.54, s * 6.5, 0.35]));
  g.position.set(...EXPANDER);
  return g;
}

// Inside the pod: DevKit header -> the four pogo pins on the dock wall.
function podHarness() {
  const m = mats(), g = new THREE.Group(), W = m.wire;
  g.name = 'pod_wiring';
  const cols = [W.red, W.black, W.blue, W.yellow];
  const hdrY = POD.hdr.pitch / 2;                       // +Y header row
  const hdrZ = POD.boardUnderZ - 2.5;                   // just under the pins
  const pinX = POD.length / 2 - POD.pogo.recess - 2.5;
  // v8.5: the dock centre dropped to 15.5, barely above the board, so these no
  // longer climb a wall — they run out along the floor and lift at the end.
  for (let i = 0; i < 4; i++) {
    const x0 = POD.devkit.xOffset + 8 + i * 2.54;
    const o = (i - 1.5) * 1.1;
    g.add(wire([
      [x0, hdrY, hdrZ],
      [x0 + 3, hdrY + 3 + o, POD.floor + 2],
      [12, 18 + o, POD.floor + 1.5],
      [22, 15 + o, POD.floor + 3],
      [27, 8 + o, 11],
      [pinX, pogoY(i), POD.pogo.z],
    ], cols[i], 0.85));
  }
  return g;
}

// Inside the cell: pogo pads -> driver, driver -> motor, hall -> the pocket.
// Every control point is kept inside the shell. There is no mid plate and no
// electronics bay any more, so every run is a hop across the open box floor.
function cellHarness() {
  const m = mats(), g = new THREE.Group(), W = m.wire;
  g.name = 'cell_wiring';
  const cols = [W.red, W.black, W.blue, W.yellow];
  const FACE = -CELL.length / 2;                        // -34, the dock face
  const FLOOR = 4.6;                                    // box floor top

  // pads -> across the open floor to the expander footprint. There is no 14mm
  // bay any more, so nothing has to thread down a pocket wall.
  const exPin = i => [EXPANDER[0] - 8.9 + i * 2.54, EXPANDER[1] + 6.5, EXPANDER[2] + 0.6];
  // The driver's solder side faces +X at x=20.0, so every wire lands on a
  // perfboard pad rather than a connector — there is no JST plug now.
  const PAD_X = 20.4;
  const pad = (y, z) => [PAD_X, y, z];
  const drvPwr = pad(11, 19);                          // 5V / GND pads, top row
  for (let i = 0; i < 4; i++) {
    const y = pogoY(i);
    const end = i < 2 ? drvPwr : exPin(i + 2);
    g.add(wire([
      [FACE + 4, y, POD.pogo.z],
      [FACE + 8, y * 1.8, 12],
      [-18, y * 2.2, FLOOR + 2],
      [end[0] - 10, end[1] + (i < 2 ? -4 : 4), FLOOR + 2],
      end,
    ], cols[i], 0.85));
  }

  // driver IN1..IN4 -> the expander that will drive them
  for (let i = 0; i < 4; i++)
    g.add(wire([
      pad(-2 + i * 2.54, 16),
      [22, -14 + i * 1.4, FLOOR + 3],
      [4, -14 + i * 1.2, FLOOR + 1.5],
      exPin(i),
    ], [W.green, W.orange, W.purple, W.white][i], 0.8));

  // driver coil pads -> the motor. Both stand on the floor now, so this is a
  // short hop across it rather than a climb through a mid-plate notch.
  const CAN = [MOTOR.xOffset, 0], R = MOTOR.dia / 2;
  for (let i = 0; i < 5; i++) {
    const o = (i - 2) * 1.2;
    g.add(wire([
      pad(-13 + i * 2.54, 8),
      [22, -20 + o, FLOOR + 2],
      [8, -19 + o, FLOOR + 2],
      [CAN[0] + R * 0.7, -13 + o, 9 + o * 0.4],          // onto the can's near side
    ], [W.blue, W.purple, W.yellow, W.orange, W.red][i], 0.8));
  }

  // hall legs -> the expander, hugging the underside of the base plate (29.5)
  for (const [c, dy, i] of [[W.red, -1.27, 5], [W.black, 0, 6], [W.white, 1.27, 7]])
    g.add(wire([
      [dy, 17.35, 28.0],
      [dy - 4, 21, 25.0],
      [-26, 22, 16],
      [-30, 12, 9],
      exPin(i),
    ], c, 0.8));
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

  // pins sit in the 1mm recess on the dock face, not back at the inner wall
  const pins = pogoPins();
  pins.name = 'pogo_pins';
  pins.position.set(L / 2 - POD.pogo.recess - 2.5, 0, POD.pogo.z);
  pod.add(pins);

  pod.add(podHarness());

  // Dock magnets. esp32_pod_shell.scad:52 cuts the pocket from the OUTER dock face
  // inward, so the disc sits FLUSH with x = +L/2 with its axis along X — not buried
  // mid-wall, and not lying on its side.
  const mags = new THREE.Group();
  mags.name = 'pod_magnets';
  for (const y of POD.mag.ys) {
    const mag = cyl(POD.mag.dia, 1.2, m.magnet, [L / 2 - 0.6, y, POD.mag.z], null, 20);
    mag.rotation.set(0, 0, Math.PI / 2);   // cylinder's Y axis -> X, facing the cell
    mags.add(mag);
  }
  pod.add(mags);
  return pod;
}

// ======================================== electronics inside the cell
// `realMotor` is motor.glb — the downloaded 28BYJ-48 with its five fake straight
// leads stripped and the output shaft landed on the origin. Falls back to the
// procedural can if it is missing.
export function buildCellElectronics(realMotor) {
  const m = mats(), g = new THREE.Group();
  g.name = 'cell_electronics';

  // The 14mm electronics bay no longer exists. outer_box.scad:12 — "the driver
  // board now stands on edge against the +X wall, which frees the whole floor".
  // The driver stands on edge in the only gap that takes it: between the motor
  // cup at x=+9.75 and the corner bosses at x=+22.10. 12.35mm of strip, 11.0mm
  // of assembly, 1.35mm of spare.
  //
  // NOTE: electronics_spec.scad calls elec_pcb_x=16.0 "the board's mid-plane",
  // but that reading does not fit — it puts the chip at x=7.3, inside the motor
  // cup. Read as the ASSEMBLY mid-plane it lands at 10.50..21.50 with exactly
  // the 1.35mm the handoff quotes, so that is what is drawn. Flagged upstream.
  const drv = uln2003();
  drv.name = 'uln2003';
  drv.rotation.set(0, -Math.PI / 2, 0);   // board plane -> YZ, chip faces -X
  drv.position.set(DRIVER.x + DRIVER.overallH / 2 - DRIVER.tail - DRIVER.pcbT,
                   DRIVER.y, DRIVER.z + DRIVER.pcbW / 2);
  g.add(drv);

  const mot = realMotor || stepper28byj();
  mot.name = 'stepper';
  // the GLB already carries the 8mm body offset, the procedural one does not
  mot.position.set(realMotor ? 0 : MOTOR.xOffset, 0, MOTOR.faceZ - MOTOR.height);
  g.add(mot);

  // v8.8: base plate spans 29.5..34.5, cam pocket floor 31.5, and the hall pocket
  // sits 0.4mm under it — so the sensor body occupies 29.5..31.1, clear of the cam.
  const hall = hallSensor();
  hall.name = 'hall';
  hall.position.set(0, 17.35, 30.3);
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

  g.add(expanderSlot());
  g.add(cellHarness());
  return g;
}

// ============================================ what each piece actually is
export const PART_INFO = [
  ['brain_pod', 'ESP32 BRAIN POD',
   'A 68x68x58 shell, the same brick size as a cell so a docked chain looks uniform. Holds the controller and the power inlet. One pod drives the whole chain.'],
  ['esp32', 'ESP32-WROOM-32 DEVKIT',
   'The controller. 51.5x28mm, dropped onto two female header strips so it lifts out with no soldering. Runs the text-to-braille encoding and drives the motor.'],
  ['dc_jack', 'DC BARREL JACK 5.5/2.1',
   'Power in, on the lid. Sits away from the board so the barrel hangs over open floor. Polarity verified: centre positive.'],
  ['pogo_pins', 'POGO PINS - 5V / GND / SDA / SCL',
   'Four spring contacts on the dock face, pressing onto flat pads. Only power and the I2C bus cross here - never the motor coils. Each cell drives its own motor locally, which is why adding a cell needs no extra wiring at all.'],
  ['pod_shell', 'POD SHELL (PETG)',
   'The real printed part, straight from esp32_pod_shell.scad - 4mm walls, the USB service opening, the pogo recess, the magnet pockets and the slotted grille that keeps the WiFi antenna out of solid plastic.'],
  ['stepper', '28BYJ-48 STEPPER  (model: NandouTech, CC-BY)',
   'The only moving actuator. 28mm can, 19mm tall, 4096 steps per turn. Its output shaft is offset 7.5mm from the body centre, and that offset drives the whole in-box layout. The shaft stands 9.5mm above the mounting face, and its first 2mm is a 9mm boss the cam hub stops against, leaving 7.5mm of grabbable shaft.'],
  ['expander_slot', 'I/O EXPANDER FOOTPRINT (empty)',
   'Where the per-cell MCP23017 goes in the multi-cell product. Nothing is fitted yet, which is why SDA, SCL and the four IN lines terminate here rather than on the driver - a ULN2003 has no pins for them.'],
  ['uln2003', 'ULN2003AN DRIVER  (DIP-16 on perfboard)',
   'Darlington array. The ESP32 cannot supply the motor coils directly, so four GPIO lines switch this instead. The ready-made breakout was dropped: at 35x32mm it fits nowhere in the cell, and nearly all of it is a JST socket, an LED row and headers this build does not use. What is left is the bare chip in a socket on a 28x18mm scrap of perfboard - 11mm tall, standing on edge in the 12.35mm strip beside the motor. The socket is deliberate: a ULN2003 dies shorted on coil kickback, and desoldering 16 pins inside a glued box is not a repair.'],
  ['hall', 'HALL SENSOR (BARE TO-92)',
   'Finds home. On power-up the cam turns until the magnet passes it - the only way the firmware learns which of the 64 positions it is sitting on. Shown as the bare TO-92 because the module it ships on is too big for the pocket, so the sensor gets desoldered off its blue carrier board.'],
  ['pogo_pads', 'POGO PADS',
   'The flat gold targets the pins press onto. Flat-to-sprung means no alignment tolerance problem and nothing to snap off.'],
  ['pod_magnets', 'DOCK MAGNETS 8x1mm',
   'Two per face, flush with the dock wall at y +/-14. Poles are reversed between pod and cell so they only latch the right way round - you physically cannot dock a cell backwards.'],
  ['cell_wiring', 'THE 13-WIRE LOOM',
   'Dupont jumpers, no soldering. Four coil lines and power reach the driver, five cores go on to the motor, and three run back from the hall sensor. Colour coding matches the build guide.'],
];
