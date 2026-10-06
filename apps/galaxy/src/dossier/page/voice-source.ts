import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { validPersonaAvatar } from '@omni/design';
import { z } from 'zod';
import { orEmpty, parseRows } from '../../data/parse-rows';
import type { Db } from './source';
import { readVoice, voiceView, type VoiceCast, type VoiceView } from './voice';

// Where the User voice tab reads (PRD 822, s3), as the viewer: the shown version of the PRD's voice.json,
// and its workspace's personas (PRD 799's `personas` table, which row-level security keeps to members)
// for the portraits. voice.json names a persona, never its row, so a portrait is the workspace's persona
// of that name; one the cast does not hold, or a cast that cannot be read, draws the name's initial.

/** What the portraits read of a persona; an avatar the design does not draw leaves that persona out. */
export const PERSONA_COLUMNS = 'name, trade, avatar';
export const VoicePersona = z.object({ name: z.string(), trade: z.string(), avatar: z.unknown() });

/** The workspace's personas, in its order, as far as their portraits need; none when they cannot be read. */
export async function readVoiceCast(db: Pick<Db, 'from'>, workspace: string): Promise<VoiceCast[]> {
  try {
    const { data, error } = await db.from('personas').select(PERSONA_COLUMNS).eq('workspace_id', workspace).order('ordinal');
    if (error) {
      const message = propertyOf(error, 'message');
      throw new Error(`read the personas: ${typeof message === 'string' ? message : 'failed'}`);
    }
    return orEmpty(parseRows(VoicePersona, data, 'dossier/voice-source: personas'))
      .flatMap(({ name, trade, avatar }) => (validPersonaAvatar(avatar) ? [{ name, trade, avatar }] : []));
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
