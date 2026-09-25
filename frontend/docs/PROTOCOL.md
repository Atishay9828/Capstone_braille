# Braillix wire protocol — v1

The contract between the laptop and the hardware. It follows §4B and §7 of the hardware team's
`SOFTWARE_TEAM_README` and fills in the parts that document left open.

Everything here is implemented three times, and all three are tested against the same suite:

| Implementation | Where | Purpose |
|---|---|---|
| `SimTransport` | `app/src/transport/sim.ts` | The display with nothing plugged in. Always available. |
| `WebSerialTransport` | `app/src/transport/webserial.ts` | A pod over USB. **Recommended for demos** — no network involved. |
| `HttpPodTransport` | `app/src/transport/httppod.ts` | A pod over Wi-Fi, exactly as §7 describes. |
| `tools/virtual-pod` | Node, zero dependencies | A pod that isn't there. Speaks both transports for real. |
| `firmware/pod` | ESP32, Arduino C++ | The pod itself. Same verbs on both links. |

---

## 1 · The model

```
 laptop  ──HTTP or USB serial──►  brain pod  ──I2C 0x20..0x27──►  muscle cells
   │                                  │                                │
 decides what every cell shows   relays and reports              goes to a cam position
```

The laptop is the only thing that thinks. The pod relays. A cell goes where it is told. That split
is the hardware team's design decision and this protocol does not renegotiate it.

**Cam positions are 0–63.** One per 6-dot pattern. Which bit drives which cam track is a *laptop-side*
setting (see §6), so a mis-wired cam never requires new firmware.

## 2 · Discovery — never assume a size

The pod scans I2C addresses `0x20`–`0x27` on boot and whenever asked, and reports what answered.
The laptop asks on every connection and uses the answer; it never assumes a cell count.

```http
GET /chain
→ 200 {"cells":[32,33,34,35],"count":4,"pod":0,"firmware":"braillix-pod/1.0"}
```

`cells` are I2C addresses in physical left-to-right order. `count` is redundant but is checked
against `cells.length`; a disagreement is a hard error, not something to paper over.

## 3 · Showing something

```http
POST /show   {"positions":[19,5,12,12]}                     ← full frame, one entry per cell
POST /show   {"updates":[{"cell":2,"position":19}]}          ← only what changed
→ 200 {"ok":true,"moved":1,"skipped":3}
```

Both forms are valid. The sparse form exists because moving a 28BYJ-48 through one cam position is
64 half-steps, so not moving is the cheapest thing a display can do. The pod additionally skips any
cell already at the requested position — the cell is the only thing that truly knows where it is.

`positions` must be exactly `count` long. Anything else is rejected with `400`; silently truncating
a frame would show the reader a different expression from the one they asked for.

## 4 · Homing

```http
POST /home  {}
→ 200 {"ok":true,"homed":4}
```

A stepper has no idea where it is at power-up, so each cell rotates until its hall sensor sees the
magnet — that is cam position 0 — and counts from there. After homing, the laptop's belief about
what the display shows is discarded and the next frame is sent in full.

## 5 · Buttons

Three buttons on the pod: **Prev**, **Select**, **Next** (GPIO 32/33/25, `INPUT_PULLUP`, active-LOW).

```http
GET /buttons
→ 200 {"prev":0,"select":1,"next":0,"seq":42}
```

`seq` increments on every press so a poll that misses an edge can still tell that something
happened. Over USB serial, presses are *pushed* instead:

```json
{"event":"button","button":"select","seq":42}
```

**What they do.** Prev and Next move between sibling parts of the expression; Select steps into the
part you are on; a long press of Select (>600 ms) steps back out. This is the same navigation the
arrow keys drive, because the Reader's model — a tree, not a tape — is what makes one cell usable.

## 6 · Multiple pods

The laptop is the single brain. It sums the cells across all pods and computes each pod's slice,
then sends every pod the same overall layout so they can never disagree about the message:

```http
POST /layout
{
  "total_pods": 3,
  "this_pod_index": 0,
  "cells_on_this_pod": 4,
  "full_text": "x squared plus 1",
  "my_slice": [19, 5, 12, 12]
}
```

Every pod receives identical `total_pods` and `full_text`; each acts only on `my_slice`. Transport
is one HTTP connection per pod — the handoff's own recommendation, and the one that fails visibly
rather than subtly.

## 7 · USB serial

Newline-delimited JSON at **115200 baud**. Same verbs, so one firmware serves both links and the
laptop code differs only in how bytes move.

Host → pod:

```json
{"cmd":"chain"}
{"cmd":"show","positions":[19,5,12,12]}
{"cmd":"show","updates":[{"cell":2,"position":19}]}
{"cmd":"home"}
{"cmd":"layout","total_pods":1,"this_pod_index":0,"cells_on_this_pod":4,"full_text":"…","my_slice":[…]}
{"cmd":"ping"}
```

Pod → host:

```json
{"ok":true,"cmd":"chain","cells":[32,33,34,35],"count":4,"pod":0,"firmware":"braillix-pod/1.0"}
{"ok":true,"cmd":"show","moved":1,"skipped":3}
{"ok":false,"cmd":"show","error":"expected 4 positions, got 3"}
{"event":"button","button":"next","seq":43}
{"event":"ready","firmware":"braillix-pod/1.0"}
```

Every command gets exactly one reply. Unsolicited messages always carry `event`, never `ok`, so a
client can tell a reply from a notification without tracking state.

## 8 · Pod → cell (I2C)

One byte: the cam position, 0–63. A second byte is a command when the first byte is `0xFF`:

| Bytes | Meaning |
|---|---|
| `0x00`–`0x3F` | go to this cam position |
| `0xFF 0x01` | home now |
| `0xFF 0x02` | report status on the next read |

Reading one byte from a cell returns its state: `0` ready, `1` moving, `2` homing, `3` fault.

## 9 · What is deliberately NOT in this protocol

- **No braille.** The pod never sees a dot pattern, a language, or a maths code. It sees numbers
  0–63. That is what lets the braille logic change without touching a single line of firmware — the
  hardware team's stated goal in §2 of the handoff.
- **No timing or animation.** Cells move as fast as they can; sequencing is the laptop's business.
- **No discovery protocol.** Pod addresses are entered or remembered. mDNS is parked (`NOTES.md`).

## 10 · The two things to confirm against the physical hardware

Both are flagged in the handoff and both are settings in Braillix, not code:

1. **Cam bit order.** The default is dot1→bit0 … dot6→bit5. If a printed cell shows the wrong dots,
   open the Hardware screen, raise one dot at a time, and correct the mapping there. Export the
   config for the hardware team.
2. **Cell direction.** If cell 0 turns out to be on the right, tick "reversed". No re-flash.
