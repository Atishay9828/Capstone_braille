/**
 * "cells 4–7 of 19" — in whichever language the interface is in.
 *
 * This used to live in `core/frame.ts`, which meant the engine had an opinion about English. Core
 * now reports the three numbers and this turns them into a sentence, so the same window can be
 * described in Hindi without a second implementation of the rule (CLAUDE.md Law 5).
 */

import type { Frame } from '../core/frame';
import type { StringKey } from './i18n';

type Translator = (key: StringKey, vars?: Record<string, string | number>) => string;

export function describeWindow(t: Translator, frame: Pick<Frame, 'windowStart' | 'width' | 'total'>): string {
  const { windowStart, width, total } = frame;
  if (total === 0) return t('window.nothing');
  if (total === 1) return t('window.one');
  if (width >= total) return t('window.all', { total });
  if (width === 1) return t('window.single', { index: windowStart + 1, total });
  return t('window.range', { from: windowStart + 1, to: Math.min(windowStart + width, total), total });
}
