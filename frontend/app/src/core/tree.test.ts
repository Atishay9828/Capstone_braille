/**
 * The Reader's foundation. If this is wrong, navigating an expression tells a student something
 * false about the maths — which is worse than showing nothing.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { cellsToUnicode, translateLatex } from './translate';
import { initSre } from './sre-service';
import {
  buildTree,
  describeNode,
  firstChild,
  parentOf,
  pathTo,
  renderExpanded,
  renderFolded,
  renderNode,
  sibling,
  type SemTree,
} from './tree';
import { FULL_CELL } from './braille';

beforeAll(async () => {
  const status = await initSre();
  expect(status.ok, status.reason).toBe(true);
}, 60_000);

async function treeFor(latex: string): Promise<{ tree: SemTree; enriched: string }> {
  const translation = await translateLatex(latex);
  const tree = buildTree(translation.enriched);
  expect(tree, `no semantic tree for ${latex}`).not.toBeNull();
  return { tree: tree!, enriched: translation.enriched };
}

describe('building the tree', () => {
  it('finds the fraction at the root and its two children', async () => {
    const { tree } = await treeFor('\\frac{a}{b}');
    const root = tree.nodes.get(tree.rootId)!;
    expect(root.type).toBe('fraction');
    expect(root.childIds).toHaveLength(2);
    expect(root.parentId).toBeNull();
    expect(root.depth).toBe(0);
  });

  it('records parents, depths and children consistently for every node', async () => {
    const { tree } = await treeFor('\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}');
    expect(tree.nodes.size).toBeGreaterThan(5);
    for (const node of tree.nodes.values()) {
      if (node.parentId === null) {
        expect(node.id).toBe(tree.rootId);
        expect(node.depth).toBe(0);
        continue;
      }
      const parent = tree.nodes.get(node.parentId);
      expect(parent, `parent of ${node.id} missing`).toBeDefined();
      expect(parent!.childIds).toContain(node.id);
      expect(node.depth).toBe(parent!.depth + 1);
    }
  });

  it('returns null rather than throwing when there is no semantic annotation', () => {
    expect(buildTree('')).toBeNull();
    expect(buildTree('<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>')).toBeNull();
    expect(buildTree('not xml at all <<<')).toBeNull();
  });
});

describe('sub-expression braille', () => {
  it('brailles a child on its own, correctly, in its own right', async () => {
    const { tree } = await treeFor('\\frac{a}{b}');
    const root = tree.nodes.get(tree.rootId)!;
    const numerator = tree.nodes.get(root.childIds[0])!;
    expect(cellsToUnicode(await renderExpanded(numerator))).toBe('⠁');
  });

  it('gives a standalone number its numeric indicator, as Nemeth requires', async () => {
    // "2a" read on its own is a new numeric context, so it must carry ⠼ — proof that we are
    // re-translating the sub-expression rather than slicing characters out of the parent.
    const { tree } = await treeFor('\\frac{1}{2a}');
    const root = tree.nodes.get(tree.rootId)!;
    const denominator = tree.nodes.get(root.childIds[1])!;
    expect(cellsToUnicode(await renderExpanded(denominator))).toBe('⠼⠆⠁');
  });

  it('reproduces the whole expression when the root is expanded', async () => {
    const latex = '\\sqrt{x+1}';
    const { tree } = await treeFor(latex);
    const whole = await translateLatex(latex);
    const root = tree.nodes.get(tree.rootId)!;
    expect(cellsToUnicode(await renderExpanded(root))).toBe(whole.unicode);
  });
});

describe('folding', () => {
  it('collapses a fraction to “⠿ over ⠿”, keeping the real fraction indicators', async () => {
    const { tree, enriched } = await treeFor('\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}');
    const root = tree.nodes.get(tree.rootId)!;
    const folded = await renderFolded(enriched, root);

    expect(folded, 'the quadratic formula should fold').not.toBeNull();
    // ⠹ ⠿ ⠌ ⠿ ⠼ — open fraction, something, over, something, close fraction.
    expect(cellsToUnicode(folded!.cells)).toBe('⠹⠿⠌⠿⠼');
    expect(folded!.childCellIndex).toEqual([1, 3]);
  });

  it('turns a 19-cell expression into 5 cells without lying about its structure', async () => {
    const latex = '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}';
    const { tree, enriched } = await treeFor(latex);
    const whole = await translateLatex(latex);
    const folded = await renderFolded(enriched, tree.nodes.get(tree.rootId)!);

    expect(whole.cells.length).toBeGreaterThan(15);
    expect(folded!.cells).toHaveLength(5);
    // Every cell that is not a fold marker also appears in the real full translation.
    for (const [index, cell] of folded!.cells.entries()) {
      if (folded!.childCellIndex.includes(index)) continue;
      expect(whole.cells, `structural cell ${index} is not in the real translation`).toContain(cell);
    }
  });

  it('folds a power into base and exponent', async () => {
    const { tree, enriched } = await treeFor('x^{n+1}');
    const root = tree.nodes.get(tree.rootId)!;
    const folded = await renderFolded(enriched, root);
    expect(folded).not.toBeNull();
    expect(folded!.cells.filter((c) => c === FULL_CELL)).toHaveLength(2);
    expect(cellsToUnicode(folded!.cells)).toContain('⠘'); // the superscript indicator survives
  });

  it('folds a root, keeping its opening and closing indicators', async () => {
    const { tree, enriched } = await treeFor('\\sqrt{b^2-4ac}');
    const folded = await renderFolded(enriched, tree.nodes.get(tree.rootId)!);
    expect(folded).not.toBeNull();
    expect(cellsToUnicode(folded!.cells)).toBe('⠜⠿⠻');
  });

  it('marks exactly one cell per child', async () => {
    for (const latex of ['\\frac{a}{b}', 'x^2', '\\sqrt{y}', 'a+b', '\\frac{1}{x+1}']) {
      const { tree, enriched } = await treeFor(latex);
      const root = tree.nodes.get(tree.rootId)!;
      const folded = await renderFolded(enriched, root);
      if (!folded) continue; // refusing is allowed; lying is not
      expect(folded.childCellIndex, latex).toHaveLength(root.childIds.length);
      expect(folded.cells.filter((c) => c === FULL_CELL), latex).toHaveLength(root.childIds.length);
    }
  });

  it('returns null for a leaf, which has nothing to fold', async () => {
    const { tree, enriched } = await treeFor('\\frac{a}{b}');
    const leaf = tree.nodes.get(tree.nodes.get(tree.rootId)!.childIds[0])!;
    expect(await renderFolded(enriched, leaf)).toBeNull();
  });
});

describe('navigation', () => {
  it('walks down, across and back up', async () => {
    const { tree } = await treeFor('\\frac{a}{b}');
    const root = tree.nodes.get(tree.rootId)!;

    const numerator = firstChild(tree, root.id)!;
    expect(numerator.id).toBe(root.childIds[0]);

    const denominator = sibling(tree, numerator.id, 1)!;
    expect(denominator.id).toBe(root.childIds[1]);

    expect(sibling(tree, denominator.id, 1)).toBeNull(); // no wrap-around
    expect(sibling(tree, numerator.id, -1)).toBeNull();
    expect(parentOf(tree, denominator.id)!.id).toBe(root.id);
    expect(parentOf(tree, root.id)).toBeNull();
  });

  it('gives a path from the root to any node', async () => {
    const { tree } = await treeFor('\\frac{-b}{2a}');
    const root = tree.nodes.get(tree.rootId)!;
    const denominator = tree.nodes.get(root.childIds[1])!;
    const path = pathTo(tree, denominator.id);
    expect(path[0].id).toBe(root.id);
    expect(path[path.length - 1].id).toBe(denominator.id);
  });
});

describe('naming what you are standing on', () => {
  it('says Numerator and Denominator, the way a teacher would', async () => {
    const { tree } = await treeFor('\\frac{a}{b}');
    const root = tree.nodes.get(tree.rootId)!;
    expect(describeNode(tree, root)).toBe('Fraction');
    expect(describeNode(tree, tree.nodes.get(root.childIds[0])!)).toBe('Numerator');
    expect(describeNode(tree, tree.nodes.get(root.childIds[1])!)).toBe('Denominator');
  });

  it('says Radicand under a root and Exponent above a base', async () => {
    const rooted = await treeFor('\\sqrt{x}');
    const rootNode = rooted.tree.nodes.get(rooted.tree.rootId)!;
    expect(describeNode(rooted.tree, rooted.tree.nodes.get(rootNode.childIds[0])!)).toBe('Radicand');

    const powered = await treeFor('x^2');
    const powerNode = powered.tree.nodes.get(powered.tree.rootId)!;
    expect(describeNode(powered.tree, powerNode)).toBe('Power');
    expect(describeNode(powered.tree, powered.tree.nodes.get(powerNode.childIds[1])!)).toBe('Exponent');
  });

  it('never produces an empty label', async () => {
    for (const latex of ['\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', '\\sum_{i=1}^{n} i', '\\sin x = 1']) {
      const { tree } = await treeFor(latex);
      for (const node of tree.nodes.values()) {
        expect(describeNode(tree, node).trim(), `${latex} / ${node.type}`).not.toBe('');
      }
    }
  });
});

describe('folding only when it pays for itself', () => {
  it('folds a fraction, because that trades 19 cells for 5 and keeps the structure', async () => {
    const latex = String.raw`\frac{-b \pm \sqrt{b^2-4ac}}{2a}`;
    const { tree, enriched } = await treeFor(latex);
    const rendering = await renderNode(enriched, tree.nodes.get(tree.rootId)!);
    expect(rendering.folded).toBe(true);
    expect(cellsToUnicode(rendering.cells)).toBe('⠹⠿⠌⠿⠼');
  });

  it('refuses to fold "2a", because ⠿⠿ hides everything and shows nothing', async () => {
    // Implicit multiplication has no visible operator, so folding leaves no structural cell.
    // Two fold markers would be strictly worse than the real braille, which is only two cells.
    const { tree, enriched } = await treeFor(String.raw`\frac{1}{2a}`);
    const denominator = tree.nodes.get(tree.nodes.get(tree.rootId)!.childIds[1])!;
    const rendering = await renderNode(enriched, denominator);
    expect(rendering.folded).toBe(false);
    expect(rendering.reason).toMatch(/hide everything/);
    expect(cellsToUnicode(rendering.cells)).toBe('⠼⠆⠁');
  });

  it('refuses to fold "a+b", because ⠿⠬⠿ is no shorter than ⠁⠬⠃', async () => {
    const { tree, enriched } = await treeFor('a+b');
    const rendering = await renderNode(enriched, tree.nodes.get(tree.rootId)!);
    expect(rendering.folded).toBe(false);
    expect(rendering.reason).toMatch(/shorter/);
    expect(cellsToUnicode(rendering.cells)).toBe('⠁⠬⠃');
  });

  it('shows a leaf as itself and says why', async () => {
    const { tree, enriched } = await treeFor(String.raw`\frac{a}{b}`);
    const leaf = tree.nodes.get(tree.nodes.get(tree.rootId)!.childIds[0])!;
    const rendering = await renderNode(enriched, leaf);
    expect(rendering.folded).toBe(false);
    expect(rendering.reason).toMatch(/single value/);
    expect(cellsToUnicode(rendering.cells)).toBe('⠁');
  });

  it('honours an explicit request to expand', async () => {
    const { tree, enriched } = await treeFor(String.raw`\frac{a}{b}`);
    const rendering = await renderNode(enriched, tree.nodes.get(tree.rootId)!, { fold: false });
    expect(rendering.folded).toBe(false);
    expect(rendering.childCellIndex).toEqual([]);
    expect(cellsToUnicode(rendering.cells)).toBe('⠹⠁⠌⠃⠼');
  });

  it('never returns a folded rendering that is longer than the real one', async () => {
    const samples = [
      String.raw`\frac{-b \pm \sqrt{b^2-4ac}}{2a}`,
      String.raw`\sqrt{x+1}`,
      'x^{n+1}',
      'a+b',
      String.raw`\sum_{i=1}^{n} i`,
      String.raw`\frac{22}{7}`,
    ];
    for (const latex of samples) {
      const { tree, enriched } = await treeFor(latex);
      for (const node of tree.nodes.values()) {
        const rendering = await renderNode(enriched, node);
        if (!rendering.folded) continue;
        const expanded = await renderExpanded(node);
        expect(rendering.cells.length, `${latex} / ${node.type}`).toBeLessThan(expanded.length);
        const structural = rendering.cells.length - rendering.childCellIndex.length;
        expect(structural, `${latex} / ${node.type} has no structural cell`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
