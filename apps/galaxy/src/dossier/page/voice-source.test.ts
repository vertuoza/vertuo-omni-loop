import { afterEach, describe, expect, it, vi } from 'vitest';
import { readShownVoice, readVoiceCast } from './voice-source';

// Where the User voice tab reads (PRD 822, s3): the shown voice.json version, and the workspace's
// personas as the viewer reads them, for the portraits. A cast that cannot be read draws initials, never
// an error; a version that cannot be read says so on the tab.

const AVATAR = { v: 1, skin: 2, hair: 1, hairColor: 1, outfit: 2, accessory: 1 };
const VOICE = JSON.stringify({
  rounds: [{ stage: 'design', date: '2026-09-30', personas: [{ name: 'Marc', stance: 'skeptical', score: 3, reaction: 'Too big.', citations: ['persona:Marc'] }] }],
});

/** A client whose `personas` read answers `answer`, remembering what it was asked. */
function personasDb(answer: { data: unknown; error: unknown } | Error) {
  const asked: unknown[] = [];
  const chain = {
    select(columns: string) { asked.push(['select', columns]); return chain; },
    eq(column: string, value: string) { asked.push(['eq', column, value]); return chain; },
    order(column: string) {
      asked.push(['order', column]);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
  return { asked, db: { from: (table: string) => { asked.push(['from', table]); return chain; } } as never };
}

afterEach(() => vi.restoreAllMocks());

describe('the workspace\'s personas, for the portraits', () => {
  it('reads each persona\'s name, trade and avatar, in the workspace\'s order', async () => {
    const { db, asked } = personasDb({ data: [{ name: 'Marc', trade: 'plumber', avatar: AVATAR }], error: null });
    expect(await readVoiceCast(db, 'w1')).toEqual([{ name: 'Marc', trade: 'plumber', avatar: AVATAR }]);
    expect(asked).toEqual([['from', 'personas'], ['select', 'name, trade, avatar'], ['eq', 'workspace_id', 'w1'], ['order', 'ordinal']]);
  });

  it('leaves out a persona whose avatar is not one the design draws', async () => {
    const { db } = personasDb({ data: [{ name: 'Marc', trade: 'plumber', avatar: { v: 9 } }, { name: 'Sofia', trade: 'office', avatar: AVATAR }], error: null });
    expect((await readVoiceCast(db, 'w1')).map((c) => c.name)).toEqual(['Sofia']);
  });

  it('is none when they cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await readVoiceCast(personasDb({ data: null, error: { message: 'down' } }).db, 'w1')).toEqual([]);
    expect(await readVoiceCast(personasDb(new Error('offline')).db, 'w1')).toEqual([]);
  });
});

describe('the shown voice version', () => {
  it('is the tab\'s grid, the portraits from the cast', async () => {
    const view = await readShownVoice(() => Promise.resolve(VOICE), () => Promise.resolve([{ name: 'Marc', trade: 'plumber', avatar: { ...AVATAR, v: 1 as const } }]));
    expect(view?.rows[0]).toMatchObject({ name: 'Marc', portrait: { trade: 'plumber' } });
  });

  it('is null when the version cannot be read, or is no voice record', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cast = () => Promise.resolve([]);
    expect(await readShownVoice(() => Promise.resolve(null), cast)).toBeNull();
    expect(await readShownVoice(() => Promise.resolve('{"rounds": []}'), cast)).toBeNull();
    expect(await readShownVoice(() => Promise.reject(new Error('down')), cast)).toBeNull();
  });
});
