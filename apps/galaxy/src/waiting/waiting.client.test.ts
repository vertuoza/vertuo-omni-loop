import { describe, expect, it, vi } from 'vitest';
import { partTick, waitingClient, WaitingReadFailed, WaitingSignedOut, type SignedOutGate } from './waiting.client';

// The bell's reads from the browser (PRD 1318, s4), on a fake fetch: each route read with the sign-in
// cookie and parsed with the contract; a 401 throws WaitingSignedOut, which stops the polls; a 500 or a
// shape the contract does not know throws, and the provider keeps what it had.

const question = { kind: 'question', id: 'r1', sessionTitle: 'feat/x', question: 'Which?', askedAt: 1000, sharedBy: null } as const;
const document = { id: 'v1', kind: 'spec', created_at: '2026-10-09T08:00:00Z', dossier: { id: 'd1', prd: 7, title: 'Widgets' } } as const;

function fetching(status: number, body: unknown) {
  return vi.fn((_url: string, _init: RequestInit) => Promise.resolve(Response.json(body, { status })));
}

describe('the waiting client', () => {
  it('reads the Questions part from its route, with the sign-in cookie and nothing cached', async () => {
    const fetchFn = fetching(200, { questions: [question] });
    expect(await waitingClient(fetchFn).questions()).toEqual([question]);
    expect(fetchFn).toHaveBeenCalledWith('/api/waiting/questions', { headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });
  });

  it('reads the New documents part from its route', async () => {
    const fetchFn = fetching(200, { documents: [document] });
    expect(await waitingClient(fetchFn).documents()).toEqual([document]);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('/api/waiting/documents');
  });

  it('throws WaitingSignedOut on a 401', async () => {
    const client = waitingClient(fetching(401, { error: 'signed-out' }));
    await expect(client.questions()).rejects.toBeInstanceOf(WaitingSignedOut);
    await expect(client.documents()).rejects.toBeInstanceOf(WaitingSignedOut);
  });

  it('throws WaitingReadFailed on a 500, naming its status', async () => {
    const failed = waitingClient(fetching(500, { error: 'database' })).questions();
    await expect(failed).rejects.toBeInstanceOf(WaitingReadFailed);
    await expect(failed).rejects.toMatchObject({ status: 500 });
  });

  it('refuses a shape the contract does not know', async () => {
    await expect(waitingClient(fetching(200, { questions: [{ ...question, askedAt: 'yesterday' }] })).questions()).rejects.toThrow();
    await expect(waitingClient(fetching(200, { documents: [{ ...document, kind: 'retro' }] })).documents()).rejects.toThrow();
  });
});

describe('a part\'s poll', () => {
  const part = (gate: SignedOutGate, read: () => Promise<string>) => {
    const seen: string[] = [];
    const failed: unknown[] = [];
    return { seen, failed, tick: partTick(gate, { read, seen: (next) => void seen.push(next), failed: (error) => void failed.push(error) }) };
  };

  it('hands each read on and keeps polling', async () => {
    const p = part({ out: false }, () => Promise.resolve('two questions'));
    expect(await p.tick()).toBe(true);
    expect(p.seen).toEqual(['two questions']);
  });

  it('keeps polling after a failed read, which the part marks unread', async () => {
    const p = part({ out: false }, () => Promise.reject(new WaitingReadFailed('read the questions', 500)));
    expect(await p.tick()).toBe(true);
    expect(p.failed).toHaveLength(1);
    expect(p.seen).toEqual([]);
  });

  it('stops both polls after a 401: the other part asks nothing at its next tick', async () => {
    const gate: SignedOutGate = { out: false };
    const questions = part(gate, () => Promise.reject(new WaitingSignedOut()));
    const read = vi.fn(() => Promise.resolve('documents'));
    const documents = part(gate, read);
    expect(await questions.tick()).toBe(false);
    expect(questions.failed).toEqual([]);
    expect(await documents.tick()).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });
});
