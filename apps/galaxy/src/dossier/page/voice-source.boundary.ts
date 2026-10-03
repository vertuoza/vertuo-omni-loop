import type { Boundary } from '../../data/parse-rows';
import { PERSONA_COLUMNS, VoicePersona } from './voice-source';

// The User voice tab's read of the cast (PRD 1030), for `pnpm schemas:verify`: every workspace's
// personas, in their order.
export const boundaries: Boundary[] = [
  { name: 'dossier/voice-source: personas', read: (db) => db.from('personas').select(PERSONA_COLUMNS).order('ordinal').limit(50), schema: VoicePersona, shape: 'rows' },
];
