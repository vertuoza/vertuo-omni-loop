import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { validPersonaAvatar } from '@omni/design';
import type { Db } from './source';
import { readVoice, voiceView, type VoiceCast, type VoiceView } from './voice';

// Where the User voice tab reads (PRD 822, s3), as the viewer: the shown version of the PRD's voice.json,
// and its workspace's personas (PRD 799's `personas` table, which row-level security keeps to members)
// for the portraits. voice.json names a persona, never its row, so a portrait is the workspace's persona
// of that name; one the cast does not hold, or a cast that cannot be read, draws the name's initial.

type PersonasDb = {
  from(table: 'personas'): {
    select(columns: string): { eq(column: string, value: string): { order(column: string): PromiseLike<{ data: unknown; error: unknown }> } };
  };
};

/** The workspace's personas, in its order, as far as their portraits need; none when they cannot be read. */
export async function readVoiceCast(db: Pick<Db, 'from'>, workspace: string): Promise<VoiceCast[]> {
  try {
    const { data, error } = await (db as unknown as PersonasDb).from('personas').select('name, trade, avatar').eq('workspace_id', workspace).order('ordinal'); // ts-allow: the personas table is read through the narrow port it declares
    if (error) {
      const message = propertyOf(error, 'message');
      throw new Error(`read the personas: ${typeof message === 'string' ? message : 'failed'}`);
    }
    const rows: readonly unknown[] = Array.isArray(data) ? data : [];
    return rows.flatMap((row) => {
      const name = propertyOf(row, 'name'), trade = propertyOf(row, 'trade'), avatar = propertyOf(row, 'avatar');
      return typeof name === 'string' && typeof trade === 'string' && validPersonaAvatar(avatar) ? [{ name, trade, avatar }] : [];
    });
  } catch (error) {
    console.error(error);
    return [];
  }
}

/** The shown voice version as the tab draws it; null when it cannot be read, or is no voice record. */
export async function readShownVoice(content: () => Promise<string | null>, cast: () => Promise<VoiceCast[]>): Promise<VoiceView | null> {
  try {
    const [text, personas] = await Promise.all([content(), cast()]);
    const voice = text === null ? null : readVoice(text);
    return voice ? voiceView(voice, personas) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
