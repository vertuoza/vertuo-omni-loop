import { describe, expect, it } from 'vitest';
import { codeToCopy } from './copy';

describe('the code a copy button copies (issue #931)', () => {
  it('is the block\'s text, without the newline that ends it', () => {
    expect(codeToCopy('omni signin\n')).toBe('omni signin');
    expect(codeToCopy('ask:\n  url: https://x\n')).toBe('ask:\n  url: https://x');
  });
});
