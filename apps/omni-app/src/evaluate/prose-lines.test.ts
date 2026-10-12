import { describe, expect, it } from 'vitest';
import { proseLines } from './prose-lines.ts';

describe('proseLines — a pull request body\'s lines outside fenced code (issue 1690)', () => {
  it('keeps every line of a body with no fence, whatever its line endings', () => {
    expect(proseLines('a\nb\r\nc')).toEqual(['a', 'b', 'c']);
    expect(proseLines('')).toEqual(['']);
  });

  it('drops a backtick or tilde fence and everything inside it, an info string and up to three spaces of indent allowed', () => {
    expect(proseLines('a\n```\nin\n```\nb')).toEqual(['a', 'b']);
    expect(proseLines('a\n   ~~~md\nin\n   ~~~\nb')).toEqual(['a', 'b']);
  });

  it('closes a fence only on the same character, at least as long, with nothing after it', () => {
    expect(proseLines('````\nin\n```\n~~~~\n```` x\n````\nb')).toEqual(['b']);
  });

  it('runs an unclosed fence to the end of the body', () => {
    expect(proseLines('a\n```\nin\nstill in')).toEqual(['a']);
  });

  it('opens no fence on four spaces of indent, or on a backtick fence whose info string holds a backtick', () => {
    expect(proseLines('    ```\nb')).toEqual(['    ```', 'b']);
    expect(proseLines('``` a`b\nc')).toEqual(['``` a`b', 'c']);
  });
});
