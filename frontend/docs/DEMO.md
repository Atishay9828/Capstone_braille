# Braillix — the demo (one page)

**The sentence to open with:** *"This app is the teacher's blackboard; the braille cells are the
child's eyes. A teacher writes whatever she is teaching — by hand, by typing, or by photographing
a book — and it lands on the student's fingers, live and verified."*

Everything below works with **nothing plugged in and no network**. Use **Chrome or Edge**.
The live site is **https://braillix.vercel.app** — it carries the full recognition model.

## Setup (night before, two minutes)

Open https://braillix.vercel.app once on the demo machine (it caches itself for offline).
Or run locally: `npm install && npm run fetch:model && npm run dev`.
Sanity check: **Help → Is everything working?** — all lamps green.

## The walk (eight minutes)

1. **Open the app.** *(30 s)* One screen: a blackboard with a worked quadratic already standing
   on it, the braille cell showing it, the chalk tray below. Say: *"There is nothing to learn
   here. If you have used WhatsApp, you can teach on this."*

2. **Teach a class-11 concept by TYPING** *(1.5 min)* — the mentor's test, half one. Type
   `nCr = n!/(r!(n-r)!)` exactly like that — the way it is said in class. The preview shows the
   real formula; the green line says the dots read back as what you wrote. **Enter** — it lands
   and is spoken. Then `(a+b)^n = sum_{r=0}^{n} nCr a^(n-r) b^r` — the binomial theorem, the
   whole of it, on the cells. Say: *"union, intersection, inverse trig, derivatives, matrices,
   Bayes — the full class 11–12 syllabus types like this; 232 curriculum lines are re-proven
   live in Help."*

3. **The SAME kind of concept by WRITING** *(2 min)* — half two. Press the **pencil**. Write
   `sin^2 x + cos^2 x = 1` large, the way you would on the board. Pause — the reading lands in
   the box with its preview and braille verdict. If a symbol misread, fix it in the box (say:
   *"the teacher is always the last word — nothing recognised reaches a child unconfirmed"*).
   **Put on the board**: the line lands with the teacher's own handwriting kept faintly behind
   it.

4. **A question in Hindi.** *(1 min)* Type `दो संख्याओं का योग 12 है`. The words become Bharati
   Braille, the number stays Nemeth, the line is spoken in Hindi. Press **हिन्दी** in the corner:
   the whole interface follows.

5. **The child's side.** *(1.5 min)* Point at the cells strip: *"this is the hardware truth —
   one cell today, forty tomorrow; the software never assumes."* Drag the cell slider to 6.
   Page with **← →** — the walk the pod's own buttons take. Press **Explore**: the quadratic
   formula folds from 19 cells to 5 — *"a whole equation, navigable on one cell — that is the
   core invention."* Press **Why these dots?** — every cell, its meaning, its cam number.

6. **Photograph a textbook.** *(1 min)* Press the **camera** grip, load a sample, read it, and
   send it to the board through the same confirm gate.

7. **Prove it.** *(1 min)* **Help → Prove the syllabus**: all 175 curriculum lines, classes
   1–12, translated and read back live in about a second. *(If hardware is present: Device →
   USB → connect, and the same lesson drives real cams — `npm run pod` emulates one otherwise.)*

## Questions to expect

- **"What if the recognition is wrong?"** — It lands in an editable box behind a preview and a
  braille verdict; the teacher's press is the gate. A silent wrong answer is the one failure
  this product refuses to allow.
- **"What does it need to run?"** — A browser. No server, no account, no key, no network after
  first load. Student data never leaves the machine.
- **"Is the braille correct?"** — Nemeth (BANA 2022) and Bharati tables tested against the
  published standards; every line is independently read back from the dots; 175/175 syllabus
  lines verified live, on stage, in front of you.
