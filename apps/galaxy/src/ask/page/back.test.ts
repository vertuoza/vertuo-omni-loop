import { describe, it, expect } from 'vitest';
import type { DossierRoundRow } from '../../dossier/store';
import { backAfterSend, type BackRounds } from './back';
import type { QuestionView } from './question';

// The way back from /ask/q/<round> (PRD 384): once the send is read back as answered by this person,
// the page goes to the dossier it was opened from, at its next open round, or to the session's ask page.

const DOSSIER = '00000000-0000-4000-8000-0000000000d1';
const SESSION = '00000000-0000-4000-8000-0000000000a5';

const row = (round_id: string, status: DossierRoundRow['status'], created_at: string) => ({ round_id, status, created_at });
const ROUNDS = [row('r1', 'answered', '2026-09-28T09:00:00Z'), row('r2', 'open', '2026-09-28T09:10:00Z')];

const answered = (byMe: boolean): QuestionView => ({ kind: 'answered', by: byMe ? 'Ada' : 'Bob', byFace: { kind: 'initial', letter: byMe ? 'A' : 'B' }, byMe, via: 'page', lines: [], earlier: [] });
const open: QuestionView = { kind: 'open', canAnswer: true, questions: [], movesAt: 0, earlier: [] };

function reader(rounds: BackRounds | Error) {
  const asked: string[] = [];
  const read = (id: string) => {
    asked.push(id);
    if (rounds instanceof Error) return Promise.reject(rounds);
    return Promise.resolve(rounds);
  };
  return { asked, read };
}

const back = (view: QuestionView, from: string | null, read = reader(ROUNDS).read) =>
  backAfterSend({ view, from, sessionId: SESSION, roundId: 'r1', readRounds: read });

describe('the way back after answering on the question page', () => {
  it('goes to the dossier it came from, at its next open round, read after the answer', async () => {
    const { asked, read } = reader(ROUNDS);
    expect(await back(answered(true), DOSSIER, read)).toBe(`/prd/${DOSSIER}?tab=questions#r2`);
    expect(asked).toEqual([DOSSIER]);
  });

  it('goes to the Questions tab alone when the rounds cannot be read', async () => {
    expect(await back(answered(true), DOSSIER, reader(new Error('offline')).read)).toBe(`/prd/${DOSSIER}?tab=questions`);
    expect(await back(answered(true), DOSSIER, reader(null).read)).toBe(`/prd/${DOSSIER}?tab=questions`);
  });

  it('goes to the session ask page with no from, or a from that is no dossier, without reading any round', async () => {
    for (const from of [null, 'https://evil.example']) {
      const { asked, read } = reader(ROUNDS);
      expect(await back(answered(true), from, read)).toBe(`/ask/${SESSION}`);
      expect(asked).toEqual([]);
    }
  });

  it('stays put when someone else answered first, or the round is not answered', async () => {
    const { asked, read } = reader(ROUNDS);
    expect(await back(answered(false), DOSSIER, read)).toBeNull();
    expect(await back(open, DOSSIER, read)).toBeNull();
    expect(asked).toEqual([]);
  });
});
