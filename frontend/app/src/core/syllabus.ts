/**
 * The school syllabus, as a teacher would type it.
 *
 * This list is the thing Braillix claims to be able to do. It is written the way a teacher writes
 * on the Board — `1/2`, not `\frac{1}{2}` — because that is the claim being made: not "Nemeth is
 * implemented", but "a maths teacher at an Indian school for the blind can put their own syllabus
 * on the display without learning anything new".
 *
 * `syllabus.test.ts` walks every line and fails if one of them stops translating. `npm run accuracy`
 * walks the same list and writes `docs/ACCURACY.md` — the same evidence, in a form a panel can read
 * without running anything.
 *
 * Topics follow the arithmetic-to-calculus arc of NCERT classes 6–12. Nothing here is aspirational:
 * every line is one somebody would actually write on a blackboard.
 */

export interface SyllabusEntry {
  /** What the teacher types. */
  readonly source: string;
  /** Plain English for the report, so the table can be read by someone who does not read LaTeX. */
  readonly says: string;
  /**
   * Set only where the line genuinely contains words as well as mathematics.
   *
   * It is an assertion, not a note. Every line without it must reach the display as ONE run of
   * Nemeth — which is how `S_n = n/2 (2a + (n-1)d)` was caught being cut in half, with `S_n` sent
   * to the text side as though it were a word.
   */
  readonly words?: true;
}

export interface SyllabusTopic {
  readonly topic: string;
  /** Roughly which years this belongs to, for the report. */
  readonly classes: string;
  readonly entries: readonly SyllabusEntry[];
}

export const SYLLABUS: readonly SyllabusTopic[] = [
  {
    topic: 'Number and arithmetic',
    classes: '1–6',
    entries: [
      { source: '7', says: 'a single digit' },
      { source: '42', says: 'a two-digit number' },
      { source: '1,00,000', says: 'a lakh, grouped the Indian way' },
      { source: '2 + 3 = 5', says: 'addition' },
      { source: '9 - 4 = 5', says: 'subtraction' },
      { source: '3 x 4 = 12', says: 'multiplication, written with a cross' },
      { source: '12 div 4 = 3', says: 'division' },
      { source: '3.14', says: 'a decimal' },
      { source: '-5 + 2 = -3', says: 'negative numbers' },
      { source: '2 + 3 x 4 = 14', says: 'order of operations' },
    ],
  },
  {
    topic: 'Fractions, ratio and percentage',
    classes: '5–8',
    entries: [
      { source: '1/2', says: 'one half' },
      { source: '22/7', says: 'twenty-two sevenths' },
      { source: '2/3 + 1/6 = 5/6', says: 'adding fractions' },
      { source: '3/4 x 2/5', says: 'multiplying fractions' },
      { source: '1/2/3/4/5', says: 'fractions nested four deep' },
      { source: '(x+1)/(x-1)', says: 'an algebraic fraction' },
      { source: '50%', says: 'a percentage' },
      { source: '25% of 80 = 20', says: 'percentage of a quantity', words: true },
      { source: 'Rs 250', says: 'money' },
      { source: '2 : 3', says: 'a ratio' },
    ],
  },
  {
    topic: 'Algebra',
    classes: '6–10',
    entries: [
      { source: 'x + 5 = 12', says: 'a simple equation' },
      { source: '2x + 5 = 15', says: 'an equation with a coefficient' },
      { source: 'x^2 + 3x + 2 = 0', says: 'a quadratic' },
      { source: 'ab + bc', says: 'a product of variables' },
      { source: '(a+b)^2 = a^2 + 2ab + b^2', says: 'an identity' },
      { source: '(-b +- sqrt(b^2 - 4ac))/(2a)', says: 'the quadratic formula' },
      { source: 'x_1 + x_2', says: 'subscripted variables' },
      { source: 'x^3 - 8', says: 'a cube' },
      { source: 'a^2 + b^2 = c^2', says: 'Pythagoras' },
    ],
  },
  {
    topic: 'Roots, indices and surds',
    classes: '8–10',
    entries: [
      { source: 'sqrt(9) = 3', says: 'a square root' },
      { source: 'sqrt(144) = 12', says: 'a larger square root' },
      { source: 'cbrt(27) = 3', says: 'a cube root' },
      { source: 'sqrt(x^2 + y^2)', says: 'a root over an expression' },
      { source: '2^10 = 1024', says: 'a power' },
      { source: 'x^(n+1)', says: 'a symbolic power' },
      { source: '10^-3', says: 'a negative index' },
    ],
  },
  {
    topic: 'Inequalities, sets and logic',
    classes: '8–11',
    entries: [
      { source: '2 <= x', says: 'less than or equal to' },
      { source: 'x >= 5', says: 'greater than or equal to' },
      { source: 'a != b', says: 'not equal to' },
      { source: '1 < x < 5', says: 'a double inequality' },
      { source: '{1,2,3}', says: 'a set' },
      { source: 'A cup B', says: 'union' },
      { source: 'A cap B', says: 'intersection' },
      { source: 'x in A', says: 'membership' },
      { source: '|x| = 5', says: 'absolute value' },
    ],
  },
  {
    topic: 'Geometry and mensuration',
    classes: '6–10',
    entries: [
      { source: '45 degrees', says: 'an angle in degrees' },
      { source: 'angle ABC = 90 degrees', says: 'a named angle' },
      { source: 'triangle ABC', says: 'a triangle' },
      { source: 'pi r^2', says: 'the area of a circle' },
      { source: '2 pi r', says: 'the circumference' },
      { source: '1/2 x b x h', says: 'the area of a triangle' },
      { source: 'AB parallel CD', says: 'parallel lines' },
      { source: 'theta', says: 'an angle by name' },
    ],
  },
  {
    topic: 'Trigonometry',
    classes: '10–12',
    entries: [
      { source: 'sin theta', says: 'sine of an angle' },
      { source: 'sin^2 theta + cos^2 theta = 1', says: 'the fundamental identity' },
      { source: 'tan 45 degrees = 1', says: 'a known value' },
      { source: 'cos 0 = 1', says: 'another known value' },
      { source: 'sin A / cos A = tan A', says: 'a quotient identity' },
    ],
  },
  {
    topic: 'Logarithms and progressions',
    classes: '11–12',
    entries: [
      { source: 'log_10 100 = 2', says: 'a logarithm with a base' },
      { source: 'ln e = 1', says: 'a natural logarithm' },
      { source: 'sum_{i=1}^{n} i = n(n+1)/2', says: 'a summation' },
      { source: 'a + (n-1)d', says: 'the nth term of an AP' },
    ],
  },
  {
    topic: 'Calculus',
    classes: '11–12',
    entries: [
      { source: 'lim_{x -> 0} sin x / x = 1', says: 'a limit' },
      { source: 'int_{0}^{1} x^2', says: 'a definite integral' },
      { source: 'dy/dx', says: 'a derivative' },
      { source: 'infinity', says: 'infinity' },
    ],
  },
  {
    topic: 'Polynomials and identities',
    classes: '8–10',
    entries: [
      { source: 'p(x) = x^3 - 3x^2 + 5x - 3', says: 'a cubic polynomial' },
      { source: '(a-b)^2 = a^2 - 2ab + b^2', says: 'the second identity' },
      { source: '(a+b)(a-b) = a^2 - b^2', says: 'the difference of two squares' },
      { source: 'a^3 + b^3 = (a+b)(a^2 - ab + b^2)', says: 'the sum of two cubes' },
      { source: 'x^2 - (a+b)x + ab', says: 'a factorised quadratic' },
      { source: '2x + 3y = 12', says: 'a linear equation in two variables' },
      { source: 'x/a + y/b = 1', says: 'the intercept form' },
      { source: 'a_1/a_2 = b_1/b_2', says: 'a condition on two lines' },
    ],
  },
  {
    topic: 'Indices and number theory',
    classes: '7–10',
    entries: [
      { source: 'x^0 = 1', says: 'anything to the power zero' },
      { source: '2^3 x 3^2 = 72', says: 'a product of powers' },
      { source: 'a^m x a^n = a^(m+n)', says: 'the first law of indices' },
      { source: '(a^m)^n = a^(mn)', says: 'a power of a power' },
      { source: 'a^-n = 1/a^n', says: 'a negative index' },
      { source: '1.5 x 10^8', says: 'standard form' },
    ],
  },
  {
    topic: 'Coordinate geometry',
    classes: '9–11',
    entries: [
      { source: 'y = mx + c', says: 'a straight line' },
      { source: 'm = (y_2 - y_1)/(x_2 - x_1)', says: 'the slope of a line' },
      { source: 'sqrt((x_2 - x_1)^2 + (y_2 - y_1)^2)', says: 'the distance formula' },
      { source: '(x_1 + x_2)/2', says: 'a midpoint coordinate' },
      { source: 'x^2 + y^2 = r^2', says: 'a circle at the origin' },
      { source: 'ax + by + c = 0', says: 'the general form of a line' },
    ],
  },
  {
    topic: 'Mensuration',
    classes: '7–10',
    entries: [
      { source: '2(l + b)', says: 'the perimeter of a rectangle' },
      { source: '6 a^2', says: 'the surface area of a cube' },
      { source: 'l x b x h', says: 'the volume of a cuboid' },
      { source: '4/3 pi r^3', says: 'the volume of a sphere' },
      { source: '1/3 pi r^2 h', says: 'the volume of a cone' },
      { source: '2 pi r h', says: 'the curved surface of a cylinder' },
      { source: 'pi r l', says: 'the curved surface of a cone' },
      { source: '4 pi r^2', says: 'the surface area of a sphere' },
    ],
  },
  {
    topic: 'Arithmetic progressions',
    classes: '10–11',
    entries: [
      { source: 'a_n = a + (n-1)d', says: 'the nth term' },
      { source: 'S_n = n/2 (2a + (n-1)d)', says: 'the sum of n terms' },
      { source: 'S_n = n/2 (a + l)', says: 'the sum, given the last term' },
      { source: 'a, a+d, a+2d', says: 'the start of a progression' },
    ],
  },
  {
    topic: 'More trigonometry',
    classes: '10–12',
    entries: [
      { source: 'sin 30 degrees = 1/2', says: 'a standard value' },
      { source: 'tan theta = sin theta / cos theta', says: 'the quotient identity' },
      { source: 'sec^2 theta - tan^2 theta = 1', says: 'a Pythagorean identity' },
      { source: '1 + cot^2 theta = cosec^2 theta', says: 'the third identity' },
      { source: 'sin (A + B) = sin A cos B + cos A sin B', says: 'the addition formula' },
      { source: '2 sin A cos A', says: 'the double angle' },
    ],
  },
  {
    topic: 'Statistics and probability',
    classes: '8–12',
    entries: [
      { source: '0 <= P <= 1', says: 'the range of a probability' },
      { source: 'P = 1/6', says: 'the probability of one face of a die' },
      { source: '(sum x)/n', says: 'the mean' },
      { source: 'sigma^2', says: 'the variance' },
      { source: '2.5 + 3.5 + 4.5', says: 'class marks being added' },
      { source: 'x - 45.5', says: 'a deviation from the mean' },
    ],
  },
  {
    topic: 'Complex numbers and matrices',
    classes: '11–12',
    entries: [
      { source: 'i^2 = -1', says: 'the imaginary unit' },
      { source: 'z = a + ib', says: 'a complex number' },
      { source: '|z| = sqrt(a^2 + b^2)', says: 'its modulus' },
      { source: 'ad - bc', says: 'a two-by-two determinant' },
      { source: '2 x 2', says: 'the order of a matrix' },
    ],
  },
  {
    topic: 'More calculus',
    classes: '11–12',
    entries: [
      { source: 'dy/dx = 2x', says: 'a derivative with a value' },
      { source: 'n x^(n-1)', says: 'the power rule' },
      { source: 'x^(n+1)/(n+1)', says: 'the integral of a power' },
      { source: 'lim_{h -> 0} (f - g)/h', says: 'the first principle' },
      { source: 'int_{a}^{b} f', says: 'a definite integral' },
    ],
  },
  {
    topic: 'Units, money and measurement',
    classes: '5–9',
    entries: [
      { source: 'Rs 1,250', says: 'money with a thousands comma' },
      { source: '12.5 cm', says: 'a length' },
      { source: '60%', says: 'a percentage on its own' },
      { source: '5 km + 300 m', says: 'two units added' },
      { source: '90 degrees', says: 'a right angle' },
    ],
  },
  {
    topic: 'The symbols a senior class needs',
    classes: '9–12',
    entries: [
      { source: 'A subset B', says: 'a subset' },
      { source: 'A subseteq B', says: 'a subset, or equal' },
      { source: 'x notin A', says: 'not a member' },
      { source: 'sqrt(2) approx 1.414', says: 'approximately equal to' },
      { source: 'a equiv b', says: 'equivalent to' },
      { source: 'y propto x', says: 'proportional to' },
      { source: 'AB perp CD', says: 'perpendicular lines' },
      { source: 'therefore x = 5', says: 'therefore' },
      { source: 'bar(x) = 45.5', says: 'the mean of a set of readings' },
      { source: '5!', says: 'a factorial' },
      { source: 'Delta ABC', says: 'a capital Greek letter' },
      { source: 'Omega', says: 'another capital Greek letter' },
    ],
  },
  /*
   * The v5 mandate (VISION-BRIEF v5, the mentor's instruction): any class 11-12 concept must be
   * teachable end to end. These four topics are the NCERT senior syllabus at full depth — every
   * line here was first a gap-audit candidate, and every one now round-trips with an "agrees"
   * verdict. Chapter coverage: sets/relations/functions · trigonometry incl. inverse · counting,
   * binomial, sequences · complex numbers · conics · calculus from limits to differential
   * equations · vectors and 3D · matrices and determinants · probability incl. Bayes · LPP.
   */
  {
    topic: 'Sets, relations and functions',
    classes: '11–12',
    entries: [
      { source: 'A union B', says: 'a union, as a teacher says it' },
      { source: 'A intersect B', says: 'an intersection' },
      { source: 'A intersection B', says: 'the long word too' },
      { source: 'x in A', says: 'membership' },
      { source: 'f(x) = 2x + 3', says: 'function notation' },
      { source: 'f(g(x))', says: 'a composite function' },
      { source: 'f: A -> B', says: 'a function from A to B' },
      { source: 'f^(-1)(x)', says: 'an inverse function' },
      { source: 'A x B', says: 'a cartesian product' },
      { source: 'P(k) -> P(k+1)', says: 'the induction step' },
    ],
  },
  {
    topic: 'Trigonometry, counting and series',
    classes: '11–12',
    entries: [
      { source: 'sin^2 theta + cos^2 theta = 1', says: 'the Pythagorean identity' },
      { source: '1 + tan^2 theta = sec^2 theta', says: 'the secant identity' },
      { source: 'sin^(-1) x', says: 'inverse sine, power form' },
      { source: 'arcsin x', says: 'inverse sine, arc form' },
      { source: 'cosec theta = 1/sin theta', says: 'the cosecant' },
      { source: 'cot theta', says: 'the cotangent' },
      { source: 'sin(A + B) = sin A cos B + cos A sin B', says: 'a compound angle' },
      { source: 'nCr = n!/(r!(n-r)!)', says: 'combinations, as written on every board' },
      { source: 'nPr = n!/(n-r)!', says: 'permutations' },
      { source: '5C2 = 10', says: 'a specific combination' },
      { source: '(a+b)^n = sum_{r=0}^{n} nCr a^(n-r) b^r', says: 'the binomial theorem' },
      { source: 'S_n = a(r^n - 1)/(r - 1)', says: 'the sum of a GP' },
      { source: 'a, ar, ar^2', says: 'a geometric progression' },
      { source: 'z = r(cos theta + i sin theta)', says: 'a complex number in polar form' },
      { source: 'bar(z) = a - ib', says: 'the conjugate' },
      { source: 'y - y_1 = m(x - x_1)', says: 'point-slope form' },
      { source: 'x^2/a^2 + y^2/b^2 = 1', says: 'an ellipse' },
      { source: 'y^2 = 4ax', says: 'a parabola' },
      { source: '|x - 2| < 5', says: 'a modulus inequality' },
      { source: 'log_a (mn) = log_a m + log_a n', says: 'the log product rule' },
    ],
  },
  {
    topic: 'Calculus, end to end',
    classes: '11–12',
    entries: [
      { source: 'lim_{x -> infinity} 1/x = 0', says: 'a limit at infinity' },
      { source: 'd/dx (x^n) = n x^(n-1)', says: 'the derivative operator' },
      { source: "f'(x)", says: 'prime notation' },
      { source: 'd^2y/dx^2', says: 'a second derivative' },
      { source: 'dy/dx = dy/du x du/dx', says: 'the chain rule' },
      { source: 'd/dx (uv) = u dv/dx + v du/dx', says: 'the product rule' },
      { source: 'int x^2 dx = x^3/3 + C', says: 'an indefinite integral, dx and all' },
      { source: 'int_{0}^{pi} sin x dx = 2', says: 'a definite integral' },
      { source: 'int u dv = uv - int v du', says: 'integration by parts' },
      { source: 'A = int_{a}^{b} y dx', says: 'area under a curve' },
      { source: 'e^x', says: 'the exponential' },
      { source: 'dy/dx + y = e^x', says: 'a differential equation' },
    ],
  },
  {
    topic: 'Vectors, matrices and probability',
    classes: '12',
    entries: [
      { source: 'vec(a) . vec(b) = ab cos theta', says: 'a dot product' },
      { source: 'vec(a) x vec(b)', says: 'a cross product' },
      { source: '|vec(a)| = sqrt(a_1^2 + a_2^2 + a_3^2)', says: 'a vector magnitude' },
      { source: 'l^2 + m^2 + n^2 = 1', says: 'direction cosines' },
      { source: 'det(A) = ad - bc', says: 'a determinant, as det' },
      { source: '|A| = ad - bc', says: 'a determinant, as bars' },
      { source: 'A^(-1) = adj(A)/|A|', says: 'the inverse of a matrix' },
      { source: 'A = [[a, b], [c, d]]', says: 'a 2×2 matrix, row by row' },
      { source: 'A^T', says: 'a transpose' },
      { source: 'P(A|B) = P(A intersect B)/P(B)', says: 'conditional probability' },
      { source: 'P(A|B) = P(B|A) P(A)/P(B)', says: 'Bayes’ theorem' },
      { source: 'P(A union B) = P(A) + P(B) - P(A intersect B)', says: 'the addition rule' },
      { source: 'sigma^2 = sum (x_i - bar(x))^2 / n', says: 'variance' },
      { source: 'E(X) = sum x_i p_i', says: 'expectation' },
      { source: 'Maximise Z = 3x + 4y', says: 'a linear-programming objective', words: true },
    ],
  },
  {
    topic: 'Whole questions, as an exam paper writes them',
    classes: 'all',
    entries: [
      { source: 'The sum of two numbers is 25 and their difference is 7. Find the numbers.', says: 'a two-sentence word problem', words: true },
      { source: 'If 2x + 3 = 11, find the value of x.', says: 'a condition and an instruction', words: true },
      { source: 'The length of a rectangle is 12 cm and its breadth is 5 cm. Find its area.', says: 'two measurements in one question', words: true },
      { source: 'In triangle ABC, angle A = 50 degrees and angle B = 60 degrees. Find angle C.', says: 'a question that opens with the word "In"', words: true },
      { source: 'A shopkeeper bought a pen for Rs 40 and sold it for Rs 50. Find his profit per cent.', says: 'a question that opens with the article "A"', words: true },
      { source: 'The radius of a circle is 7 cm. Find its area, taking pi = 22/7.', says: 'a value given at the end of a sentence', words: true },
      { source: 'If a = 3 and b = 4, find sqrt(a^2 + b^2).', says: 'three separate pieces of mathematics', words: true },
      { source: 'A number is increased by 20% and then decreased by 20%. What is the net change?', says: '"by" as English, not as division', words: true },
      { source: 'Find the value of sin 30 degrees + cos 60 degrees.', says: 'a trigonometric instruction', words: true },
      { source: 'एक वृत्त की त्रिज्या 7 cm है। pi = 22/7 लेकर क्षेत्रफल ज्ञात कीजिए।', says: 'a Hindi question in two sentences', words: true },
      { source: 'दो संख्याओं का योग 25 है और उनका अंतर 7 है।', says: 'a Hindi question with two numbers', words: true },
      { source: 'দুটি সংখ্যার যোগফল 25 এবং তাদের অন্তর 7।', says: 'the same question in Bengali', words: true },
      { source: 'Ravi ke paas 5 सेब हैं और Sita ke paas 3 सेब हैं।', says: 'Latin and Devanagari alternating', words: true },
      { source: 'A right-angled triangle has sides 3 cm, 4 cm and 5 cm.', says: 'a hyphenated English adjective', words: true },
      { source: 'The angles are 30 degrees, 60 degrees and 90 degrees.', says: 'a list of angles separated by commas', words: true },
      { source: 'Find the value of x (in cm).', says: 'an English word inside brackets', words: true },
    ],
  },
  {
    topic: 'How an exam paper is laid out',
    classes: 'all',
    entries: [
      { source: '(i) 2x + 3 = 7', says: 'a sub-question label' },
      { source: '(ii) Find the value of x.', says: 'a sub-question that is a sentence', words: true },
      { source: 'Q1. Find the area.', says: 'a numbered question', words: true },
      { source: 'The sum of 5 and ___ is 12.', says: 'a blank inside a sentence', words: true },
      { source: 'Find the value of x. (2 marks)', says: 'a question with its marks printed after it', words: true },
      { source: '9.8 m/s^2', says: 'an acceleration' },
      { source: '6.02 x 10^23', says: "Avogadro's number" },
      { source: '5 cm^2', says: 'a square unit' },
      { source: 'Rs 1,250.50', says: 'money with paise' },
      { source: 'Which is greater: 2/3 or 3/5?', says: 'a question ending in a question mark', words: true },
    ],
  },
  {
    topic: 'Questions with words in them',
    classes: 'all',
    entries: [
      { source: 'Find the value of 2x + 5 = 15', says: 'an English word problem', words: true },
      { source: 'दो संख्याओं का योग 12 है', says: 'a Hindi word problem', words: true },
      { source: 'The area is pi r^2', says: 'words around an expression', words: true },
      { source: 'एक कोण 45 degrees का है', says: 'Hindi with an angle in it', words: true },
      { source: 'The perimeter is 2(l + b)', says: 'a formula introduced by words', words: true },
      { source: 'দুটি সংখ্যার যোগফল 12', says: 'a Bengali word problem', words: true },
      { source: 'ஒரு கோணம் 45 degrees', says: 'a Tamil word problem', words: true },
      { source: 'ਦੋ ਸੰਖਿਆਵਾਂ ਦਾ ਜੋੜ 12', says: 'a Gurmukhi word problem', words: true },
      { source: 'రెండు సంఖ్యల మొత్తం 12', says: 'a Telugu word problem', words: true },
      { source: 'Solve for x: 3x - 7 = 8', says: 'an instruction with a colon in it', words: true },
      { source: 'Ravi के पास 5 सेब हैं', says: 'two scripts and a number on one line', words: true },
      { source: 'ਇੱਕ ਕੋਣ 60 degrees', says: 'Gurmukhi with an addak in it', words: true },
    ],
  },
];

/** Every line, flattened — for tests and for the report. */
export function allEntries(): { topic: string; entry: SyllabusEntry }[] {
  return SYLLABUS.flatMap((topic) => topic.entries.map((entry) => ({ topic: topic.topic, entry })));
}
