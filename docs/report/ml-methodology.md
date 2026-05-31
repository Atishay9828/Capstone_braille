# Braillix — Machine Learning Methodology

## 1. Problem

A device that can *display* mathematics in Braille is useful; a device that can
*teach* it is transformative. Teaching requires a model of what the student
already knows, so that each new problem can be pitched at the right level — hard
enough to be instructive, not so hard as to be discouraging. The learner's
knowledge of a skill is, however, *latent*: we never observe "the student knows
quadratics," only a sequence of correct and incorrect answers from which that
knowledge must be inferred. Braillix addresses this with **Bayesian Knowledge
Tracing (BKT)**, the standard probabilistic student model from the intelligent
tutoring literature.

## 2. Approach: Bayesian Knowledge Tracing

BKT was introduced by Corbett and Anderson [1] for the Cognitive Tutor systems and
remains the canonical knowledge-tracing model. It treats mastery of each skill as a
two-state Hidden Markov Model: the hidden state is the binary proposition "the
student knows this skill," and the observations are the correctness of successive
attempts. After each answer, the probability of the hidden "known" state is updated
by Bayes' rule and a learning transition.

### 2.1 The four parameters

BKT is governed by four parameters per skill, each with a direct pedagogical
meaning rather than merely a mathematical one:

| Symbol | Name | Pedagogical meaning |
|--------|------|---------------------|
| **L₀** | *prior* (`p-init`) | Probability the student already knows the skill before any practice. |
| **T** | *transit* (`p-transit`) | Probability the student *learns* the skill (transitions not-known → known) at any one practice opportunity. |
| **G** | *guess* (`p-guess`) | Probability of answering correctly *without* knowing the skill — a lucky guess. |
| **S** | *slip* (`p-slip`) | Probability of answering incorrectly *despite* knowing the skill — a careless slip. |

A well-known identifiability constraint requires `G < 0.3` and `S < 0.1`; outside
this regime a correct answer ceases to be meaningful evidence of knowledge [2].
Braillix's parameters respect this constraint throughout.

### 2.2 The update equations

Let `p = P(Lₙ)` be the current estimate that the student knows the skill. On
observing an answer, we first compute the Bayesian posterior given the observation:

- After a **correct** answer:

  ```
  P(Lₙ | correct) = p(1−S) / [ p(1−S) + (1−p)G ]
  ```

- After an **incorrect** answer:

  ```
  P(Lₙ | incorrect) = pS / [ pS + (1−p)(1−G) ]
  ```

We then apply the learning transition — the student may have *learned* from the
attempt itself:

```
P(Lₙ₊₁) = P(Lₙ | obs) + (1 − P(Lₙ | obs)) · T
```

This online form updates one answer at a time and requires no training data, which
is precisely what a formative-practice setting demands.

### 2.3 Parameter values and their justification

Braillix uses fixed, research-derived parameters per skill rather than fitting them
to data:

| Skill | L₀ | T | G | S |
|-------|----|----|----|----|
| linear | 0.30 | 0.09 | 0.20 | 0.10 |
| quadratic | 0.10 | 0.06 | 0.20 | 0.10 |
| fraction | 0.25 | 0.08 | 0.20 | 0.10 |
| radical | 0.15 | 0.07 | 0.20 | 0.10 |
| trig | 0.12 | 0.06 | 0.20 | 0.10 |
| *default* | 0.20 | 0.08 | 0.20 | 0.10 |

Harder skills are given lower priors (L₀) and slower transitions (T); guess and slip
are held at the conventional 0.20 / 0.10. Using fixed parameters is standard and
defensible in a formative context: individual parameter fitting (e.g. via the EM
algorithm, as in pyBKT [3]) requires substantial per-student response logs that a
practice tool does not have at first contact. We therefore chose a **from-scratch,
~15-line online implementation** over a fitting library: it is fully transparent,
has no heavy dependency, and every number it produces can be explained.

### 2.4 Difficulty recommendation

The mastery estimate drives item selection through a "zone of proximal development"
heuristic — an Item-Response-Theory-*lite* rule without the full IRT machinery.
Target difficulty tracks current mastery: `p < 0.3` selects easy items, `0.3 ≤ p <
0.7` medium, `p ≥ 0.7` hard. The student is thus kept just ahead of their current
competence.

## 3. Distractor Generation

An assessment is only as good as its wrong answers. A *plausible* distractor is not
a random wrong number; it is the answer a student arrives at via a *specific,
common misconception*. Braillix generates distractors by rule, encoding named
error patterns:

| Category | Distractor | Misconception encoded |
|----------|-----------|------------------------|
| Linear `ax+b=c` | `(c+b)/a` | Sign error moving `b` across the equals sign |
| | `c/a` | Dropping the `+b` term entirely |
| Quadratic | discriminant `b²+4ac` | Sign error in the discriminant |
| | a single root | Forgetting the `±` (only one root) |
| Fraction `a/b + c/d` | `(a+c)/(b+d)` | The classic "add across" error |

This rule-based approach is deliberately chosen over a large-language-model
generator. Recent work finds that while LLMs produce fluent distractors, they are
*less* reliable at anticipating the misconceptions real students actually hold [4],
and that for templated school mathematics, rule/constraint-based generation yields
error-consistent options. It also satisfies a hard project constraint — no external
API calls — and, crucially, every distractor maps to a misconception we can name
and explain, which is what gives the assessment pedagogical validity.

## 4. Limitations

We state the model's limitations plainly:

1. **One skill = one binary latent state.** BKT collapses "knowing quadratics" into
   a single bit. Real mathematical understanding is graded and compositional;
   partial knowledge is not represented.
2. **Skill independence.** BKT updates each skill in isolation and does not model
   transfer (e.g. that fluency with fractions aids rational equations).
3. **Fixed, non-personalised parameters.** Without per-student fitting, the model
   cannot adapt L₀/T to an individual; it adapts the *estimate*, not the *model*.
4. **Distractor coverage is templated.** Numeric error-pattern distractors exist
   for linear, quadratic, and fraction items; other categories fall back to an
   "identify the type" question. This is a coverage limit, not an error.

These are acknowledged design boundaries appropriate to a capstone-scope formative
tool, not defects. They also map cleanly onto future work (deep knowledge tracing,
skill graphs, parameter fitting once usage data exists).

## 5. Verification

The correctness of the BKT implementation is asserted numerically in the automated
test suite (`tests/test_knowledge_tracer.py`). For the `linear` skill
(L₀=0.30, T=0.09, G=0.20, S=0.10):

- A single **correct** answer updates mastery `0.300 → 0.68927` (hand-computed:
  posterior `0.27/0.41 = 0.65854`, then `+ (1−0.65854)·0.09`).
- A single **incorrect** answer updates mastery `0.300 → 0.13627`.

These values are checked to within 10⁻⁹, so the formula is verified, not merely
assumed. End to end, the demonstration shows a `quadratic` mastery estimate moving
`0.10 → 0.37` after one correct answer, with the system then recommending continued
practice at the calibrated difficulty.

---

### References

[1] Corbett, A. T., & Anderson, J. R. (1995). *Knowledge Tracing: Modeling the
Acquisition of Procedural Knowledge.* User Modeling and User-Adapted Interaction,
4(4), 253–278. https://doi.org/10.1007/BF01099821

[2] Baker, R. S. J. d., Corbett, A. T., & Aleven, V. (2008). *More Accurate Student
Modeling through Contextual Estimation of Slip and Guess Probabilities in Bayesian
Knowledge Tracing.* Intelligent Tutoring Systems (ITS 2008).

[3] Badrinath, A., Wang, F., & Pardos, Z. (2021). *pyBKT: An Accessible Python
Library of Bayesian Knowledge Tracing Models.* Proceedings of the 14th
International Conference on Educational Data Mining (EDM).

[4] Feng, W., et al. (2024). *Exploring Automated Distractor Generation for Math
Multiple-choice Questions via Large Language Models.* arXiv:2404.02124.
