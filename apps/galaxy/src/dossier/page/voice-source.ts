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

type Row = { name?: unknown; trade?: unknown; avatar?: unknown };

/** The workspace's personas, in its order, as far as their portraits need; none when they cannot be read. */
export async function readVoiceCast(db: Pick<Db, 'from'>, workspace: string): Promise<VoiceCast[]> {
  try {
    const { data, error } = await (db as unknown as PersonasDb).from('personas').select('name, trade, avatar').eq('workspace_id', workspace).order('ordinal');
    if (error) throw new Error(`read the personas: ${(error as { message?: string }).message ?? 'failed'}`);
    return ((data ?? []) as Row[]).flatMap((row) =>
      typeof row.name === 'string' && typeof row.trade === 'string' && validPersonaAvatar(row.avatar)
        ? [{ name: row.name, trade: row.trade, avatar: row.avatar }]
        : [],
    );
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
