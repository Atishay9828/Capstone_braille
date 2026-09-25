/**
 * A small XML reader for exactly one job: speech-rule-engine's enriched MathML.
 *
 * Why not a DOM library? Because `tree.ts` is core engine code that must run identically in the
 * browser and in unit tests, and on this project's machines `jsdom` took **50 seconds** to load
 * and `linkedom` took 15 — which would make the verification gate unusable and tempt everyone to
 * stop running it. The input here is not arbitrary XML from the internet: it is one library's
 * well-formed output, with no DTDs, no CDATA, no processing instructions and no namespaces beyond
 * a single declaration. A focused reader is a few hundred lines, has no supply chain, and is
 * itself tested.
 *
 * See DECISIONS.md D3.1.
 */

export class XmlError extends Error {}

export interface XmlElement {
  readonly tag: string;
  readonly attrs: Map<string, string>;
  readonly children: XmlElement[];
  /** Text directly inside this element, in document order, with child text excluded. */
  text: string;
  parent: XmlElement | null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

function encodeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function encodeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/** Parse an XML document into a tree of elements. Throws `XmlError` on anything malformed. */
export function parseXml(source: string): XmlElement {
  let i = 0;
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;

  const fail = (message: string): never => {
    throw new XmlError(`${message} at offset ${i}`);
  };

  while (i < source.length) {
    const lt = source.indexOf('<', i);

    if (lt === -1) break;

    // Text between the previous tag and this one belongs to the element on top of the stack.
    if (lt > i && stack.length > 0) {
      stack[stack.length - 1].text += decodeEntities(source.slice(i, lt));
    }

    // Comments, declarations and processing instructions: skip wholesale.
    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith('<?', lt) || source.startsWith('<!', lt)) {
      const end = source.indexOf('>', lt);
      i = end === -1 ? source.length : end + 1;
      continue;
    }

    // Closing tag.
    if (source.startsWith('</', lt)) {
      const end = source.indexOf('>', lt);
      if (end === -1) fail('unterminated closing tag');
      const tag = source.slice(lt + 2, end).trim();
      const open = stack.pop();
      if (!open) fail(`closing tag </${tag}> with nothing open`);
      if (open!.tag !== tag) fail(`</${tag}> does not close <${open!.tag}>`);
      i = end + 1;
      continue;
    }

    // Opening tag. Find its end, respecting quoted attribute values.
    let end = lt + 1;
    let quote: string | null = null;
    while (end < source.length) {
      const ch = source[end];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      end += 1;
    }
    if (end >= source.length) fail('unterminated opening tag');

    let body = source.slice(lt + 1, end);
    const selfClosing = body.endsWith('/');
    if (selfClosing) body = body.slice(0, -1);

    const element = parseTagBody(body);
    const parent = stack[stack.length - 1] ?? null;
    element.parent = parent;
    if (parent) parent.children.push(element);
    else if (root) fail('more than one root element');
    else root = element;

    if (!selfClosing) stack.push(element);
    i = end + 1;
  }

  if (stack.length > 0) throw new XmlError(`unclosed element <${stack[stack.length - 1].tag}>`);
  if (!root) throw new XmlError('no root element');
  return root;
}

function parseTagBody(body: string): XmlElement {
  const match = /^\s*([^\s/>]+)/.exec(body);
  if (!match) throw new XmlError(`tag has no name: "${body}"`);
  const tag = match[1];

  const attrs = new Map<string, string>();
  const attrPattern = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let attr: RegExpExecArray | null;
  while ((attr = attrPattern.exec(body)) !== null) {
    attrs.set(attr[1], decodeEntities(attr[3] ?? attr[4] ?? ''));
  }

  return { tag, attrs, children: [], text: '', parent: null };
}

/** Serialise an element back to XML. */
export function serializeXml(element: XmlElement): string {
  const attrs = [...element.attrs]
    .map(([name, value]) => ` ${name}="${encodeAttr(value)}"`)
    .join('');

  if (element.children.length === 0 && element.text === '') {
    return `<${element.tag}${attrs}/>`;
  }

  const inner = element.children.map(serializeXml).join('');
  return `<${element.tag}${attrs}>${encodeText(element.text)}${inner}</${element.tag}>`;
}

/** Deep copy, with `parent` links rebuilt. */
export function cloneXml(element: XmlElement, parent: XmlElement | null = null): XmlElement {
  const copy: XmlElement = {
    tag: element.tag,
    attrs: new Map(element.attrs),
    children: [],
    text: element.text,
    parent,
  };
  for (const child of element.children) copy.children.push(cloneXml(child, copy));
  return copy;
}

/** Depth-first walk, parents before children. */
export function walkXml(element: XmlElement, visit: (element: XmlElement) => void): void {
  visit(element);
  for (const child of element.children) walkXml(child, visit);
}

/** Every element carrying the given attribute, in document order. */
export function elementsWithAttr(root: XmlElement, attr: string): XmlElement[] {
  const found: XmlElement[] = [];
  walkXml(root, (element) => {
    if (element.attrs.has(attr)) found.push(element);
  });
  return found;
}

/** All text inside an element, including its descendants. */
export function textContent(element: XmlElement): string {
  let out = element.text;
  for (const child of element.children) out += textContent(child);
  return out;
}

/** Swap `child` for `replacement` inside `parent`. Returns false when `child` is not a child. */
export function replaceChild(parent: XmlElement, child: XmlElement, replacement: XmlElement): boolean {
  const index = parent.children.indexOf(child);
  if (index === -1) return false;
  replacement.parent = parent;
  parent.children[index] = replacement;
  return true;
}

/** Create a fresh element. */
export function makeElement(tag: string, text = '', attrs: Record<string, string> = {}): XmlElement {
  return { tag, attrs: new Map(Object.entries(attrs)), children: [], text, parent: null };
}
