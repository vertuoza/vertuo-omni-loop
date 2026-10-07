// The `system` fonts provider: no file, the computer's own sans-serif. The kind's default: a setting
// naming a provider that is gone, or a font that cannot be had, falls back to it.
import { SYSTEM_STACK } from './css.ts';
import type { FontsProvider } from '../types.ts';

export const systemFonts: FontsProvider = Object.freeze({
  kind: 'fonts',
  id: 'system',
  load: () => Promise.resolve({ css: '', files: [], stack: SYSTEM_STACK }),
});
