/**
 * The XML reader is hand-written (see the header of xml.ts for why), so it is tested harder than
 * a dependency would be — including the malformed cases, because "refuses clearly" is a feature.
 */

import { describe, expect, it } from 'vitest';
import {
  XmlError,
  cloneXml,
  decodeEntities,
  elementsWithAttr,
  makeElement,
  parseXml,
  replaceChild,
  serializeXml,
  textContent,
  walkXml,
} from './xml';

const MATHML = 'http://www.w3.org/1998/Math/MathML';

describe('parsing', () => {
  it('reads a single element', () => {
    const root = parseXml('<math></math>');
    expect(root.tag).toBe('math');
    expect(root.children).toEqual([]);
    expect(root.parent).toBeNull();
  });

  it('reads attributes, including hyphenated data-* names', () => {
    const root = parseXml('<mfrac data-semantic-id="21" data-semantic-children="16,20"></mfrac>');
    expect(root.attrs.get('data-semantic-id')).toBe('21');
    expect(root.attrs.get('data-semantic-children')).toBe('16,20');
  });

  it('reads single-quoted attribute values', () => {
    expect(parseXml("<mi a='1' b=\"2\"/>").attrs.get('a')).toBe('1');
  });

  it('handles a > inside a quoted attribute value', () => {
    const root = parseXml('<mo title="a > b">x</mo>');
    expect(root.attrs.get('title')).toBe('a > b');
    expect(root.text).toBe('x');
  });

  it('reads nested children and links parents', () => {
    const root = parseXml(`<math xmlns="${MATHML}"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>`);
    const frac = root.children[0];
    expect(frac.tag).toBe('mfrac');
    expect(frac.parent).toBe(root);
    expect(frac.children.map((c) => c.text)).toEqual(['a', 'b']);
    expect(frac.children[0].parent).toBe(frac);
  });

  it('reads self-closing elements', () => {
    const root = parseXml('<math><mspace width="1em"/><mi>x</mi></math>');
    expect(root.children).toHaveLength(2);
    expect(root.children[0].tag).toBe('mspace');
    expect(root.children[0].children).toEqual([]);
  });

  it('skips comments, declarations and processing instructions', () => {
    const root = parseXml('<?xml version="1.0"?><!-- hello --><math><!--x--><mi>a</mi></math>');
    expect(root.tag).toBe('math');
    expect(root.children).toHaveLength(1);
  });

  it('keeps text that sits between children with the right element', () => {
    const root = parseXml('<mrow>before<mi>x</mi>after</mrow>');
    expect(root.text).toBe('beforeafter');
    expect(root.children[0].text).toBe('x');
  });

  it('decodes entities in text and attributes', () => {
    const root = parseXml('<mo title="a &amp; b">&lt;&#x2061;&gt;</mo>');
    expect(root.attrs.get('title')).toBe('a & b');
    expect(root.text).toBe('<⁡>');
  });
});

describe('refusing malformed input', () => {
  it('rejects a mismatched closing tag', () => {
    expect(() => parseXml('<a><b></a></b>')).toThrow(XmlError);
  });

  it('rejects an unclosed element', () => {
    expect(() => parseXml('<math><mi>x</mi>')).toThrow(XmlError);
  });

  it('rejects a closing tag with nothing open', () => {
    expect(() => parseXml('</math>')).toThrow(XmlError);
  });

  it('rejects two root elements', () => {
    expect(() => parseXml('<a/><b/>')).toThrow(XmlError);
  });

  it('rejects input with no element at all', () => {
    expect(() => parseXml('just text')).toThrow(XmlError);
  });
});

describe('serialising', () => {
  it('round-trips a document', () => {
    const xml = `<math xmlns="${MATHML}"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>`;
    expect(serializeXml(parseXml(xml))).toBe(xml);
  });

  it('re-escapes text and attributes', () => {
    const root = makeElement('mo', 'a < b & c', { title: 'x "y" & <z>' });
    const xml = serializeXml(root);
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;');
    // …and reading it back gives the original values.
    const back = parseXml(xml);
    expect(back.text).toBe('a < b & c');
    expect(back.attrs.get('title')).toBe('x "y" & <z>');
  });

  it('writes empty elements in self-closing form', () => {
    expect(serializeXml(makeElement('mspace', '', { width: '1em' }))).toBe('<mspace width="1em"/>');
  });
});

describe('tree utilities', () => {
  const xml = `<math xmlns="${MATHML}"><mfrac data-semantic-id="3"><mi data-semantic-id="1">a</mi><mrow><mi data-semantic-id="2">b</mi></mrow></mfrac></math>`;

  it('finds every element carrying an attribute, in document order', () => {
    const found = elementsWithAttr(parseXml(xml), 'data-semantic-id');
    expect(found.map((e) => e.attrs.get('data-semantic-id'))).toEqual(['3', '1', '2']);
  });

  it('walks parents before children', () => {
    const seen: string[] = [];
    walkXml(parseXml(xml), (e) => seen.push(e.tag));
    expect(seen).toEqual(['math', 'mfrac', 'mi', 'mrow', 'mi']);
  });

  it('collects text across descendants', () => {
    expect(textContent(parseXml(xml))).toBe('ab');
  });

  it('clones deeply, without sharing state', () => {
    const original = parseXml(xml);
    const copy = cloneXml(original);
    copy.children[0].attrs.set('data-semantic-id', 'changed');
    copy.children[0].children[0].text = 'zzz';
    expect(original.children[0].attrs.get('data-semantic-id')).toBe('3');
    expect(original.children[0].children[0].text).toBe('a');
    expect(copy.children[0].parent).toBe(copy);
  });

  it('replaces a child in place and re-parents the replacement', () => {
    const root = parseXml(xml);
    const frac = root.children[0];
    const placeholder = makeElement('mi', 'z');
    expect(replaceChild(frac, frac.children[0], placeholder)).toBe(true);
    expect(frac.children[0].text).toBe('z');
    expect(placeholder.parent).toBe(frac);
    expect(serializeXml(root)).toContain('<mi>z</mi>');
  });

  it('reports when the element is not actually a child', () => {
    const root = parseXml(xml);
    expect(replaceChild(root, makeElement('mi'), makeElement('mi'))).toBe(false);
  });
});

describe('decodeEntities', () => {
  it('handles named, decimal and hexadecimal forms', () => {
    expect(decodeEntities('&amp;&lt;&gt;&quot;&apos;')).toBe('&<>"\'');
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
  });

  it('leaves an unknown entity alone rather than corrupting it', () => {
    expect(decodeEntities('&notarealentity;')).toBe('&notarealentity;');
  });
});
