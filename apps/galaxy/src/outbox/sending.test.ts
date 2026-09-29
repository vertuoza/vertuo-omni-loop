import { describe, expect, it } from 'vitest';
import { droppedWords, readSending, returned, sendingKey } from './sending';

// The browser's side of a send (PRD 251, s11): what the tab keeps while the person is at GitHub, and what
// it reads on the way back.

const SEND = '00000000-0000-4000-8000-000000000001';

describe('the send the tab waits on', () => {
  it('is kept per dossier', () => {
    expect(sendingKey('d1')).toBe('omni-outbox-sending:d1');
  });

  it('reads back the numbers of the send it names, and nothing else', () => {
    expect(readSending(JSON.stringify({ send: SEND, numbers: [1, 2] }), SEND)).toEqual({ send: SEND, numbers: [1, 2] });
    expect(readSending(JSON.stringify({ send: 'another', numbers: [1] }), SEND)).toBeNull();
    expect(readSending(JSON.stringify({ send: SEND, numbers: [1, 'x', -2, 2.5] }), SEND)).toEqual({ send: SEND, numbers: [1] });
    expect(readSending('not json', SEND)).toBeNull();
    expect(readSending(null, SEND)).toBeNull();
    expect(readSending('null', SEND)).toBeNull();
    expect(readSending(JSON.stringify({ send: SEND }), SEND)).toBeNull();
  });
});

describe('the way back from GitHub', () => {
  it('names the send, or why nothing was touched', () => {
    expect(returned(`?tab=outbox&send=${SEND}`)).toEqual({ send: SEND });
    expect(returned('?tab=outbox&send_error=state')).toEqual({ error: 'state' });
    expect(returned('?tab=outbox&send_error=signin')).toEqual({ error: 'signin' });
  });

  it('ignores anything else', () => {
    expect(returned('?tab=outbox')).toBeNull();
    expect(returned('?send=not-an-id')).toBeNull();
    expect(returned('?send_error=toString')).toBeNull();
    expect(returned('')).toBeNull();
  });
});

describe('a pick settled meanwhile', () => {
  it('is said, one or several', () => {
    expect(droppedWords([4])).toBe('Question 4 was settled meanwhile, so it is left out.');
    expect(droppedWords([4, 9])).toBe('Questions 4, 9 were settled meanwhile, so they are left out.');
  });
});
