# VISION BRIEF v3 — BRAILLIX (Software)

From: Shaurya (Showie), founder · To: the studio team (Claude Code + studio-* skills)
Captured 21 August 2026, 13:30 IST
**This brief REPLACES `VISION-BRIEF-Braillix-v2.md`. v2's vision was right — this is the
final window, and it is about depth, speed and finish, not a new direction.**

---

## READ THIS FIRST

v2 landed. The teacher's-blackboard product is live, verified in a real browser, and the
founder's judgement is: **"things have improved a lot."** This is not another reset.

**The one constraint that outranks everything in this brief:** there must be a working,
deployed, demonstrable app at the end of this window. The founder presents to a capstone panel
tomorrow morning and will not be available to rescue anything. Any plan whose failure mode is
"half-finished at the deadline" is the wrong plan, however good its ceiling.

Within that constraint you have complete freedom of method. Product shape, screens, flows,
naming, stack, what to keep and what to throw away — all yours, decided by your own review
against the clock. Reuse something only because you verified it and it fits, never because it
already exists; rewrite anything you judge worth rewriting. Nobody is asking you to protect
the existing code. Somebody is asking you not to hand back a broken app at 16:30.

**Also: this brief and any internal planning document must never be committed to the GitHub
repository.** Gitignore them. Only documentation meant to ship with the product belongs in
the repo.

**Verify through the live tools** — the Chrome DevTools MCP, the virtual pod, real device
paths. A green test suite is not evidence that a village teacher can use this.

## THE TIME BOX

**Two to three hours, hard.** Roughly 13:45–16:30 IST on 21 August. After that the team writes
its report and prepares for the panel. Work continuously, no check-ins, no waiting.

> "main unbothered rahun jab aaun dekhun toh app bani hui mile"

## THE DREAM — unchanged, and now the whole point

> "jaise hamare teachers blackboard pe humein padhate hain, jo mann mein aaya likh sakte hain —
> inn bachon ke teachers apna blackboard iss app ko bana sakein, and hum toh blackboard dekh ke
> padhai hui cheez follow kar lete hain, bache saara kuch synced devices pe follow kar sakein"

> "humein like fark mitana hai apni iss app ke through normal aur blind mein, that too minimal
> cost — joki hardware solve kar raha hai. Thats the whole problem statement my friend."

And the second-order win he is actually chasing:

> "aise toh dekh kayi scholar teachers bhi schools visit karke blind bachon ko padha payenge if
> this happens — as if unke liye app use karni normal blackboard use karne jaisi hogi… aur log
> will join this cause"

That is the real product test. Not "can a trained user operate it" — **can a maths graduate who
has never taught a blind child walk into a blind school, open this, and teach, because using it
feels exactly like using a blackboard.**

## THE ACCEPTANCE SCENE

A village teacher who only uses Google, WhatsApp and Facebook sits down with this app, writes
whatever comes into her head the way she would write it on a blackboard, solves a full question
end to end in front of the class — and a blind child follows every line, in order, the way a
sighted child follows a blackboard. Nobody explains the app to her first.

If any part of that sentence needs an explanation from the founder, it hasn't passed.

## THE BAR — his words, and take them literally about *depth*, not scope

> "jaise jis purpose ke liye facebook bani hai, it solves it really well andar tak jaake —
> easy to use features, intuitive ki koi villager bhi use kar le, but strong and powerful
> models, sab run karta hai"

> "ye last shot hai… it needs to be an actual app like whatsapp facebook, something jisko
> google bole 'I wanna acquire it man, kya app banadi tumne' — this is the bar"

Read that as an instruction about **finish**: one purpose, solved completely, with nothing in
the way of it. WhatsApp is not admired for having many features. It is admired because the one
thing it does is instant, obvious, and never fails. Depth over breadth, in every hour of this
window.

> "ui bahut sundar kardo, godly website pe jaake can take inspo too"

Art direction is yours (`studio-taste`) with one override: **it must look obvious to a village
teacher.** Beautiful is welcome. Intimidating is a failure.

## WHAT HE HIT — symptoms, in his words. Diagnosis is yours.

- **Recognition is too slow to teach with.**
  > "buttons now work, but it takes forever to process"

  This is the loudest complaint in the window. A teacher mid-lesson cannot wait. Whatever the
  cause — model size, cold start, worker startup, image size, the pipeline running work it
  doesn't need to — find it and fix it. Speed here is a correctness issue, because a tool too
  slow to use during a live lesson does not solve the problem statement at all.
- **He does not believe the recognition actually works.**
  > "ocr wagara I don't think working hain"

  Whether that's true or a trust gap from v1's dead button, the fix is the same: prove it in
  front of him. Real photograph, real handwriting, real textbook page, visible timing.
- **Symbol coverage for class 11–12.** He needs certainty that a senior-class lesson can be
  taught. Verify coverage against a real curriculum and make the answer visible, rather than
  asserting it.
- **Hardware correctness.** He raised this unprompted and it is the thing he is most afraid of
  being wrong:
  > "sahi pins upar neeche hon hamesha, cells ki sab sahi ho — bahut zaruri hai, ye kaam bhi
  > hamara hai, bachon ke cells pe display ka sahi aana"

  Whatever reaches a physical cell must be right, every time, and integration must stay dead
  easy and adaptable to however many cells exist. How many get stacked, and when, is unknown
  and must stay unknown to the software.

## HIS STANDARD, AND WHERE HE ALREADY DREW THE HONEST LINE

> "models working, fine tuned sab chahiye… bahut zyada strong"

> "mujhe hamari problem statement solve karti hui ek proper application chahiye… errors na hon,
> kyunki jinke liye app bana rahe voh koi error deserve nahi karte"

He also, unprompted, described the correct design for the one part that cannot be perfect:

> "haan I agree model yahaan 1 percent chance hai rarely galti kar sakta — voh chal, abhi jab
> hum voice typing karte hain, Google ek aadha word galat pakad leta hai, manually theek kar
> dete toh sahi. Aise teacher bhi dekh le."

Take that seriously as a design principle from the founder himself: **recognition is allowed to
be imperfect if the teacher can see and fix it in one motion, before it ever reaches a child.**
That correction has to be as fast and as obvious as fixing a voice-typed word — if fixing it is
slower than retyping, the feature has failed.

Translation to braille is a different matter and gets no such latitude: a blind child cannot see
that a dot is wrong. Where certainty is impossible, say so out loud. A silent wrong answer is
the only unforgivable failure in this product.

## CONSTRAINTS

- **Free only.** No paid services, no paid APIs. Any model, any source (Hugging Face or
  otherwise) is fine if it is free and it genuinely runs.
- **English and Hindi only.**
- **Nothing that was cut comes back** — no worksheets, drills, practice modules, student
  records, or anything that exists to look impressive rather than to help a teacher teach.
- **Ground truth for the hardware seam** remains the Braillix Software Team Handoff document.
- **He cannot audit you.**
  > "my domain knowledge is scarce so main sirf vision share kar sakta hun… errors mujhse
  > handle nahi ho payengi dost"

  The verification burden is entirely yours. Do not hand him something and ask if it's right.
  Prove it, and produce evidence he can hold up in front of a panel that will ask.

## REQUIRED SECOND DELIVERABLE — the report pack

A teammate is writing the project report and needs source material. Generate, at the end,
**one document containing everything a report writer would need**: what the product does and
for whom, the problem statement it addresses, the full technology stack and why each piece was
chosen, system architecture and data flow, the hardware interface, the models used and what
they do, testing and verification results with real numbers, accuracy evidence, limitations
stated honestly, and future work.

Write it from the actual codebase as it finally stands, not from memory or from these notes.
Plain, formal English, no marketing voice, ready to be read by someone who was not in the room.
Put it where the founder can find it immediately.

## UNSPECIFIED — you decide, log it in `DECISIONS.md`

- Every product, technical and design decision in the window: what to fix first, what to
  rebuild, what to cut, what the interface becomes, which models run, how the correction
  motion works.
- How to spend the last thirty minutes. Suggest to yourself: leave the app deployed, verified
  and demonstrable rather than mid-change.

## THE AUTONOMY CHARTER

He is not reachable. Do not ask him to choose. Interrupt only for:

1. Spending real money / anything outside a free tier
2. Anything irreversible
3. A missing credential — once, in one message, with exact baby-step instructions

Everything else: decide it, log one line in `DECISIONS.md`, keep moving. `PROGRESS.md` holds
current state and exactly one next action so any session resumes cold.

## HOW HE WILL JUDGE IT

He will open it, teach one line, scan one page, and watch how long it takes. If it feels like a
blackboard and nothing makes him wait or think, it passed.
