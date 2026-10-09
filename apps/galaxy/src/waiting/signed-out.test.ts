import { describe, expect, it, vi } from 'vitest';
import { documentsReader } from './documents';
import { questionsReader } from './source';
import { SignedOut } from './session';

// A signed-out tab never reaches the database (bug #1316). The waiting list reads Supabase from the
// browser, as the signed-in person; once the tab's sign-in has expired the browser client holds no
// session and would read with the public key, which the database refuses (42501), every poll, for as
// long as the tab stays open. The Questions and New documents readers first ask the client whether it
// still holds a session, which needs no request, and read nothing without one.

const ME = '00000000-0000-4000-8000-0000000000a1';

/** A browser client whose sign-in is gone: every database read is a spy. */
function signedOutClient() {
  const from = vi.fn(() => { throw new Error('read the database'); });
  const rpc = vi.fn(() => { throw new Error('called the database'); });
  const getSession = vi.fn(() => Promise.resolve({ data: { session: null }, error: null }));
  return { client: { from, rpc, auth: { getSession } }, from, rpc };
}

describe('a signed-out tab', () => {
  it('reads no question from the database', async () => {
    const { client, from, rpc } = signedOutClient();
    await expect(questionsReader(client as never, ME)(Date.now())).rejects.toBeInstanceOf(SignedOut);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reads no new document from the database', async () => {
    const { client, from } = signedOutClient();
    await expect(documentsReader(client as never, ME)(Date.now())).rejects.toBeInstanceOf(SignedOut);
    expect(from).not.toHaveBeenCalled();
  });
});
