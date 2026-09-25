import { describe, expect, it } from 'vitest';
import { stringifyEnriched } from './sre-service';

/**
 * speech-rule-engine hands back a string under Node and a live DOM element in a browser. Getting
 * that wrong disables structural navigation *only in the browser* — passing every unit test and
 * then failing in front of an audience. So the coercion is tested against both shapes explicitly.
 */
describe('stringifyEnriched', () => {
  it('passes a string through unchanged', () => {
    expect(stringifyEnriched('<math><mi>x</mi></math>')).toBe('<math><mi>x</mi></math>');
  });

  it('reads outerHTML when handed a DOM-like element', () => {
    expect(stringifyEnriched({ outerHTML: '<math data-semantic-id="1"/>' })).toBe(
      '<math data-semantic-id="1"/>',
    );
  });

  it('never returns the "[object Object]" coercion', () => {
    expect(stringifyEnriched({ nodeType: 1 })).toBe('');
    expect(stringifyEnriched({})).toBe('');
    expect(stringifyEnriched(null)).toBe('');
    expect(stringifyEnriched(undefined)).toBe('');
  });

  it('accepts an object whose toString is real markup', () => {
    expect(stringifyEnriched({ toString: () => '<math/>' })).toBe('<math/>');
  });
});
