import { describe, expect, it } from 'vitest';
import { boundaries } from './voice-source.boundary';
import { VoicePersona } from './voice-source';

// The personas the User voice tab reads for its portraits, parsed where they come in (PRD 1030).

const AVATAR = { v: 1, skin: 2, hair: 1, hairColor: 1, outfit: 2, accessory: 1 };
const row = { name: 'Marc', trade: 'plumber', avatar: AVATAR };

describe('a persona, as the database answers it', () => {
  it('parses the row the read answers, its avatar left to the design\'s check', () => {
    expect(VoicePersona.parse(row)).toEqual(row);
    expect(VoicePersona.parse({ ...row, avatar: { v: 9 } })).toEqual({ ...row, avatar: { v: 9 } });
  });

  it('refuses a missing column, a wrong type and a forbidden null', () => {
    expect(VoicePersona.safeParse({ name: 'Marc', avatar: AVATAR }).success).toBe(false);
    expect(VoicePersona.safeParse({ ...row, name: 3 }).success).toBe(false);
    expect(VoicePersona.safeParse({ ...row, trade: null }).success).toBe(false);
  });

  it('is registered for schemas:verify with the schema the cast is parsed with', () => {
    expect(boundaries.map((b) => [b.name, b.schema, b.shape])).toEqual([['dossier/voice-source: personas', VoicePersona, 'rows']]);
  });
});
