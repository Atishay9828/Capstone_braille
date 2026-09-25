# Braillix — software → hardware handoff

What the hardware team needs from the software side, and the three things we need back.

This is the mirror of your `SOFTWARE_TEAM_README`. Everything below is implemented and tested; the
protocol is not a proposal.

**Credit where the physics lives:** the hardware architecture this seam is built against — the
brain-pod/muscle-cell split, the I2C chain, the 64-position cam, the homing behaviour — is the
hardware team's design (Atishay, lead · Mridul), stated in their `SOFTWARE_TEAM_README` and
implemented faithfully here. The software half drives their machine; it did not invent it.

---

## 1 · What the software already does

The laptop turns a maths expression into a **cam position per cell, 0–63**, and sends it. It never
sends braille, letters, or a language — only numbers. That is deliberate, and it is what your §2
asked for: the braille logic can change completely without anyone reflashing a board.

Three transports, one protocol (`PROTOCOL.md`):

| | When to use it |
|---|---|
| **Simulator** | Nothing plugged in. This is the primary mode and it is complete. |
| **USB (Web Serial)** | **Recommended for the demo.** No network, no IP address, no router. |
| **Wi-Fi** | Exactly the endpoints in your §7. Needs the laptop and pod on one network. |

There is also `tools/virtual-pod` — a pod that isn't there, speaking the real protocol. You can test
firmware behaviour against it, and we test the app against it, before any hardware exists.

## 2 · Firmware we have written for you

Both are in `firmware/` and are written against the same spec the laptop uses.

**`firmware/pod/pod.ino`** — ESP32 brain pod.
- Serves the protocol over **both** USB serial (115200, newline-delimited JSON) and Wi-Fi HTTP, from
  one command handler. Leave `WIFI_SSID` blank and it is a USB-only device, which is a perfectly
  good configuration.
- Scans I2C `0x20`–`0x27` on boot and on `/chain`, and reports what actually answered. Nothing
  assumes a cell count anywhere.
- Skips any cell already at the requested position — the cheapest motor command is the one never
  sent.
- Debounced Prev/Select/Next with long-press on Select.
- No external libraries beyond the ESP32 core, so it flashes without a library-manager setup.

**`firmware/cell/cell.ino`** — muscle cell.
- I2C address read from the solder jumpers at boot, so **one binary flashes every cell**.
- Hall-sensor homing, bounded to one revolution: if the magnet never appears it reports a fault
  rather than spinning forever.
- 4096 half-steps per revolution, 64 per cam position, exactly as your §5 states.
- **Takes the shorter way round the cam.** 60 → 2 is six positions forward, not fifty-eight
  backward. The cell is the only part of the system that knows where it currently is, so this is
  the only place the decision can honestly be made.
- Cuts coil current when idle, because a 28BYJ-48 held in position gets hot and a display spends
  most of its life not moving.

## 3 · The three things we need from you

### 3.1 Confirm the cam bit order — 30 seconds, no code

Your §3 flags this as unconfirmed, and it is the single most likely cause of "the dots are wrong".

1. Open Braillix → **Hardware**.
2. Press **dot 1**. Every cell should raise the **top-left** dot only.
3. If a different dot rises, change the "cam track bit" for dot 1 in the table until it is right.
4. Repeat for dots 2–6, then press **Copy config for the hardware team** and send us the JSON.

No firmware change, no rebuild, no code. If the physical cam is wired differently from the default,
that is a setting.

**Sanity check without hardware:** with the default mapping, dots 1-2-5 is cam position **19** —
the worked example in your own §3. The Hardware screen shows this live.

### 3.2 Confirm the cell order along the dock

If cell 1 turns out to be on the right, tick "Cell 1 is on the right" on the same screen. Also a
setting.

### 3.3 Tell us the I2C addresses you actually fitted

The pod discovers them, so we do not need to be told in advance — but if a jumper is wrong, the pod
will report (say) three cells when four are fitted, and Braillix will believe it. The Hardware
screen shows the discovered addresses; check them against the boards once.

## 4 · What happens when things go wrong

Every failure is reported on screen with what to do about it, rather than as a silent nothing:

| Symptom | What Braillix says |
|---|---|
| Pod not on the network | `could not reach 192.168.x.x` + check the network or use USB |
| No cells answered the I2C scan | `the pod found no muscle cells` + check 5V/GND/SDA/SCL and the jumpers |
| Pod says 4 cells but lists 3 addresses | refuses to connect and says so — it will not guess |
| A cell does not acknowledge | the frame is rejected rather than half-applied |
| Wrong number of positions sent | `expected 4 positions, got 3` — never silently truncated |

## 5 · Things we would like, but do not need

Not blockers. Listed so they are on the record rather than discovered late.

- **A second cell.** Everything is written for *N* cells and tested from 1 to 40, but two real cells
  would let us verify ordering along a physical dock rather than in a simulator.
- **The `braille_cam.scad` cam file.** We would like to generate the Cell Atlas sheet directly from
  the cam geometry rather than from the default mapping.
- **A cell status read.** The protocol has it (`0xFF 0x02`, then read one byte); the firmware
  implements it; nothing on the laptop side depends on it yet. If a cell can report "fault", we can
  show which cell is stuck instead of just "something did not acknowledge".

## 6 · Try it right now, with no hardware

```bash
npm install
npm run dev          # the whole product, simulated
npm run pod          # in another terminal: a pod that isn't there
```

Then in Braillix: **Hardware → Wi-Fi pods → `127.0.0.1:8080` → Connect**. The terminal running the
virtual pod draws the dots as they change and reports how much motor time each frame would cost.

Print the **Cell atlas** screen and hold it against the physical cam — all 64 positions, their dots,
and what each one means in Nemeth, on one sheet.

---

## Added 20 August 2026 — several pods, and what they mean together

Braillix now asks a question it used to answer by assumption. With more than one pod address, the
Device screen offers two arrangements, and the software never guesses between them:

**Joined** (`/layout`, as in §4B of your handoff). The pods are one long display. Pod 0 shows the
first cells, pod 1 the next, and the laptop sends each pod its own slice along with the overall
layout so two pods can never disagree about the message. Total width = the sum of the pods.

**Mirrored** (`/show` to every pod). Every pod shows the *same* cells — one teacher, one
expression, a display in front of each child. Two things about this are worth knowing on the
hardware side:

1. **The width is the smallest pod, not the largest.** A frame the small display cannot show would
   leave one child reading a truncated equation with no way to know that is what happened.
2. **A wider pod has its spare cells blanked**, in the same frame. Nothing is left showing what it
   was showing before.

Nothing on the pod changes for either mode. Mirrored, a pod receives an ordinary `/show` with a
full-width `positions` array, exactly as a single pod does today. The whole difference is in the
laptop.

Both are exercised by the conformance suite against two virtual pods (`npm run pod`), and the
mirrored test asks the pods what they are showing rather than trusting what the laptop believes it
sent.
