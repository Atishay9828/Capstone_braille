/**
 * The semantic tree — what makes a one-cell display readable.
 *
 * Mathematics is a tree. Print draws that tree in two dimensions; braille flattens it into one;
 * a single cell flattens it again, into time. Every flattening throws the shape away, which is
 * exactly what the school told us: reading a whole expression through one cell is very difficult.
 *
 * So Braillix gives the shape back. speech-rule-engine's enriched MathML carries the tree with
 * stable ids, and this module turns it into something a reader can walk: siblings left and right,
 * children below, parent above — with any sub-expression collapsible to a single ⠿ cell that you
 * can step over or step into. (Borrowed from code folding in an IDE; see DECISIONS.md.)
 *
 * THE FOLDING MECHANISM, precisely:
 *   A folded view is the node's own braille with its semantic children *elided*. We never
 *   concatenate children's braille — Nemeth is context-sensitive, and gluing sub-expressions
 *   together produces subtly wrong braille. Instead we hand SRE a SKELETON of the node in which
 *   each child has been replaced by a placeholder identifier, let SRE braille that skeleton
 *   properly, and then swap the placeholder cells for ⠿.
 *
 *   To find the placeholder cells reliably we braille the skeleton twice, under two disjoint
 *   placeholder alphabets. Cells that differ between the two renderings are exactly the
 *   placeholders; everything identical is genuine structure. No substring searching, no guessing —
 *   and if the two renderings disagree in length we refuse to fold rather than show
 *   plausible-but-wrong braille.
 */

import { FULL_CELL, unicodeStringToMasks, type DotMask } from './braille';
import { toNemeth, toSpeechText, type SpeechLocale } from './sre-service';
import {
  cloneXml,
  elementsWithAttr,
  makeElement,
  parseXml,
  replaceChild,
  serializeXml,
  textContent,
  walkXml,
  type XmlElement,
} from './xml';

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

/** Two disjoint single-letter alphabets. Each brailles to exactly one Nemeth cell. */
const PLACEHOLDERS_A = 'abcdefghijklm';
const PLACEHOLDERS_B = 'zyxwvutsrqpon';

const ID_ATTR = 'data-semantic-id';
const CHILDREN_ATTR = 'data-semantic-children';

export interface SemNode {
  readonly id: string;
  /** SRE's semantic type: 'fraction', 'sqrt', 'infixop', 'number', 'identifier', … */
  readonly type: string;
  /** SRE's semantic role: 'division', 'addition', 'latinletter', … */
  readonly role: string;
  readonly parentId: string | null;
  readonly childIds: readonly string[];
  /** The node's MathML, detached and stripped of enrichment attributes. */
  readonly mathml: string;
  /** Depth from the root, 0-based. */
  readonly depth: number;
  /** Plain text for leaves ("2", "x", "+"). Empty for structural nodes. */
  readonly text: string;
}

export interface SemTree {
  readonly rootId: string;
  readonly nodes: ReadonlyMap<string, SemNode>;
}

/* ------------------------------------------------------------------ helpers */

/** Remove SRE's bookkeeping so a subtree can be handed back to SRE as fresh input. */
function stripEnrichment(element: XmlElement): void {
  walkXml(element, (node) => {
    for (const name of [...node.attrs.keys()]) {
      if (name.startsWith('data-semantic')) node.attrs.delete(name);
    }
  });
}

/** Wrap an element in a standalone `<math>` document so SRE will translate it on its own. */
function asMathDocument(element: XmlElement): string {
  const clone = cloneXml(element);
  stripEnrichment(clone);
  if (clone.tag === 'math') {
    clone.attrs.set('xmlns', MATHML_NS);
    return serializeXml(clone);
  }
  const math = makeElement('math', '', { xmlns: MATHML_NS });
  clone.parent = math;
  math.children.push(clone);
  return serializeXml(math);
}

function childIdsOf(element: XmlElement, known: ReadonlySet<string>): string[] {
  return (element.attrs.get(CHILDREN_ATTR) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && known.has(s));
}

/* ------------------------------------------------------------------ building */

/**
 * Build the navigable tree from SRE's enriched MathML.
 *
 * Returns `null` when the input carries no semantic annotation — the caller then falls back to
 * plain character-by-character reading rather than failing (CLAUDE.md Law 4).
 */
export function buildTree(enriched: string): SemTree | null {
  if (!enriched || !enriched.includes(ID_ATTR)) return null;

  let document: XmlElement;
  try {
    document = parseXml(enriched);
  } catch {
    return null;
  }

  const annotated = elementsWithAttr(document, ID_ATTR);
  if (annotated.length === 0) return null;

  const byId = new Map<string, XmlElement>();
  for (const element of annotated) byId.set(element.attrs.get(ID_ATTR)!, element);
  const knownIds = new Set(byId.keys());

  // The root is the annotated element with no annotated ancestor.
  const hasAnnotatedAncestor = (element: XmlElement): boolean => {
    let current = element.parent;
    while (current) {
      if (current.attrs.has(ID_ATTR)) return true;
      current = current.parent;
    }
    return false;
  };

  const rootElement = annotated.find((element) => !hasAnnotatedAncestor(element));
  if (!rootElement) return null;
  const rootId = rootElement.attrs.get(ID_ATTR)!;

  const nodes = new Map<string, SemNode>();

  const visit = (id: string, parentId: string | null, depth: number): void => {
    const element = byId.get(id);
    if (!element || nodes.has(id)) return;

    const childIds = childIdsOf(element, knownIds);

    nodes.set(id, {
      id,
      type: element.attrs.get('data-semantic-type') ?? 'unknown',
      role: element.attrs.get('data-semantic-role') ?? 'unknown',
      parentId,
      childIds,
      mathml: asMathDocument(element),
      depth,
      text: childIds.length === 0 ? textContent(element).trim() : '',
    });

    for (const childId of childIds) visit(childId, id, depth + 1);
  };

  visit(rootId, null, 0);
  return { rootId, nodes };
}

/* ------------------------------------------------------------------ folding */

/**
 * The skeleton MathML for a node: the node itself with each semantic child replaced by a single
 * placeholder identifier. Null when there is nothing to fold.
 */
function skeletonFor(enriched: string, node: SemNode, alphabet: string): string | null {
  if (node.childIds.length === 0 || node.childIds.length > alphabet.length) return null;

  let document: XmlElement;
  try {
    document = parseXml(enriched);
  } catch {
    return null;
  }

  const byId = new Map<string, XmlElement>();
  for (const element of elementsWithAttr(document, ID_ATTR)) {
    byId.set(element.attrs.get(ID_ATTR)!, element);
  }

  const target = byId.get(node.id);
  if (!target) return null;

  for (const [index, childId] of node.childIds.entries()) {
    const child = byId.get(childId);
    if (!child?.parent) return null;
    const placeholder = makeElement('mi', alphabet[index]);
    if (!replaceChild(child.parent, child, placeholder)) return null;
  }

  return asMathDocument(target);
}

export interface FoldedRendering {
  readonly cells: readonly DotMask[];
  /** For each of the node's children, which cell index in `cells` stands for it. */
  readonly childCellIndex: readonly number[];
}

/** Braille a node with its children folded to ⠿. Null when folding cannot be done honestly. */
export async function renderFolded(enriched: string, node: SemNode): Promise<FoldedRendering | null> {
  const skeletonA = skeletonFor(enriched, node, PLACEHOLDERS_A);
  const skeletonB = skeletonFor(enriched, node, PLACEHOLDERS_B);
  if (!skeletonA || !skeletonB) return null;

  const brailleA = await toNemeth(skeletonA);
  const brailleB = await toNemeth(skeletonB);
  const a = unicodeStringToMasks(brailleA).cells;
  const b = unicodeStringToMasks(brailleB).cells;
  if (a.length === 0 || a.length !== b.length) return null;

  const differing: number[] = [];
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) differing.push(i);
  }
  if (differing.length !== node.childIds.length) return null;

  const cells = [...a];
  for (const index of differing) cells[index] = FULL_CELL;

  return { cells, childCellIndex: differing };
}

/** Braille a node on its own, fully expanded. */
export async function renderExpanded(node: SemNode): Promise<DotMask[]> {
  const braille = await toNemeth(node.mathml);
  return unicodeStringToMasks(braille).cells;
}

export interface NodeRendering {
  readonly cells: readonly DotMask[];
  /** Cell indices standing for a folded child. Empty when the node is shown expanded. */
  readonly childCellIndex: readonly number[];
  readonly folded: boolean;
  /** When not folded, why not — so the interface can say so instead of just behaving oddly. */
  readonly reason?: string;
}

/**
 * Render a node for the display, folding it only when folding actually helps.
 *
 * Folding is not free: a ⠿ costs the reader a step. It has to buy something. Two cases where it
 * buys nothing, both found by testing real expressions rather than by reasoning:
 *
 *   · **No structure survives.** "2a" is an implicit multiplication, so folding its two children
 *     gives ⠿⠿ — two markers and not one cell of information. The reader learns nothing and has
 *     lost the actual maths.
 *   · **Nothing is saved.** "a+b" folds to ⠿⠬⠿, exactly as long as ⠁⠬⠃. Replacing readable
 *     braille with markers of the same length is a pure loss.
 *
 * So a fold must leave at least one structural cell behind AND be strictly shorter than the real
 * thing. Otherwise the node is shown as it truly reads.
 */
export async function renderNode(
  enriched: string,
  node: SemNode,
  options: { fold: boolean } = { fold: true },
): Promise<NodeRendering> {
  const expanded = await renderExpanded(node);

  if (!options.fold) {
    return { cells: expanded, childCellIndex: [], folded: false };
  }
  if (node.childIds.length === 0) {
    return { cells: expanded, childCellIndex: [], folded: false, reason: 'this is a single value' };
  }

  const folded = await renderFolded(enriched, node);
  if (!folded) {
    return { cells: expanded, childCellIndex: [], folded: false, reason: 'this part cannot be folded reliably' };
  }

  const structuralCells = folded.cells.length - folded.childCellIndex.length;
  if (structuralCells < 1) {
    return {
      cells: expanded,
      childCellIndex: [],
      folded: false,
      reason: 'folding would hide everything and show nothing',
    };
  }
  if (folded.cells.length >= expanded.length) {
    return {
      cells: expanded,
      childCellIndex: [],
      folded: false,
      reason: 'folding would not make it any shorter',
    };
  }

  return { cells: folded.cells, childCellIndex: folded.childCellIndex, folded: true };
}

/** Speak a node, in English or Hindi. */
export function speakNode(node: SemNode, locale: SpeechLocale): Promise<string> {
  return toSpeechText(node.mathml, locale);
}

/* ------------------------------------------------------------------ navigation */

/** The path from the root down to `id`, root first. */
export function pathTo(tree: SemTree, id: string): SemNode[] {
  const path: SemNode[] = [];
  let current = tree.nodes.get(id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? tree.nodes.get(current.parentId) : undefined;
  }
  return path;
}

/** The next sibling in the given direction, or null at the end of the row. No wrap-around. */
export function sibling(tree: SemTree, id: string, direction: -1 | 1): SemNode | null {
  const node = tree.nodes.get(id);
  if (!node?.parentId) return null;
  const parent = tree.nodes.get(node.parentId);
  if (!parent) return null;
  const next = parent.childIds[parent.childIds.indexOf(id) + direction];
  return next ? (tree.nodes.get(next) ?? null) : null;
}

export function firstChild(tree: SemTree, id: string): SemNode | null {
  const childId = tree.nodes.get(id)?.childIds[0];
  return childId ? (tree.nodes.get(childId) ?? null) : null;
}

export function parentOf(tree: SemTree, id: string): SemNode | null {
  const parentId = tree.nodes.get(id)?.parentId;
  return parentId ? (tree.nodes.get(parentId) ?? null) : null;
}

/**
 * A short human name for a node, used in the breadcrumb and spoken on arrival.
 *
 * Where a node has a well-known role in its parent — numerator, denominator, exponent, radicand —
 * we say that, because that is how a teacher says it, and "where am I" is the question a reader
 * on a small display is always asking.
 */
export function describeNode(tree: SemTree, node: SemNode): string {
  const parent = node.parentId ? tree.nodes.get(node.parentId) : null;
  if (parent) {
    const index = parent.childIds.indexOf(node.id);
    if (parent.type === 'fraction') return index === 0 ? 'Numerator' : 'Denominator';
    if (parent.type === 'sqrt') return 'Radicand';
    if (parent.type === 'root') return index === 0 ? 'Index' : 'Radicand';
    if (parent.type === 'superscript') return index === 0 ? 'Base' : 'Exponent';
    if (parent.type === 'subscript') return index === 0 ? 'Base' : 'Subscript';
  }

  switch (node.type) {
    case 'fraction':
      return 'Fraction';
    case 'sqrt':
    case 'root':
      return 'Root';
    case 'superscript':
      return 'Power';
    case 'subscript':
      return 'Subscript';
    case 'relseq':
    case 'multirel':
      return 'Equation';
    case 'infixop':
    case 'prefixop':
    case 'postfixop':
      return capitalise(node.role);
    case 'fenced':
      return 'Bracketed group';
    case 'number':
      return node.text ? `Number ${node.text}` : 'Number';
    case 'identifier':
      return node.text ? `Letter ${node.text}` : 'Letter';
    case 'function':
    case 'appl':
      return 'Function';
    case 'punctuated':
      return 'List';
    default:
      return node.text || capitalise(node.type);
  }
}

function capitalise(value: string): string {
  const cleaned = value.replace(/[-_]/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** "Fraction ▸ Numerator ▸ Root" — the orientation line. */
export function breadcrumb(tree: SemTree, id: string): string {
  return pathTo(tree, id)
    .map((node) => describeNode(tree, node))
    .join(' ▸ ');
}
