// The notebook job's reads (./notebook-store.ts), for `pnpm schemas:verify` (PRD 1030): the missions of Virtual Fleets,
// their events, the notebooks' lines and batches and a fleet's daily cap, parsed with the schemas the store parses them with.
// Its write is not here: it writes, and the check only reads.
import type { Boundary } from '../boundary.ts';
import {
  NOTE_BATCH, NOTE_CAP, NOTE_EVENT, NOTE_LINE, NOTE_MISSION,
  NoteBatchRowSchema, NoteCapRowSchema, NoteEventRowSchema, NoteLineRowSchema, NoteMissionRowSchema,
} from './notebook-store.ts';

export const boundaries: Boundary[] = [
  { name: 'missions/notebook-store: missions', read: (db) => db.from('missions').select(NOTE_MISSION).eq('teams.kind', 'virtual').limit(5), schema: NoteMissionRowSchema, shape: 'rows' },
  { name: 'missions/notebook-store: mission events', read: (db) => db.from('mission_events').select(NOTE_EVENT).limit(5), schema: NoteEventRowSchema, shape: 'rows' },
  { name: 'missions/notebook-store: lines', read: (db) => db.from('commander_notes').select(NOTE_LINE).is('deleted_at', null).limit(5), schema: NoteLineRowSchema, shape: 'rows' },
  { name: 'missions/notebook-store: batches', read: (db) => db.from('commander_notes').select(NOTE_BATCH).limit(5), schema: NoteBatchRowSchema, shape: 'rows' },
  { name: 'missions/notebook-store: daily cap', read: (db) => db.from('teams').select(NOTE_CAP).limit(5), schema: NoteCapRowSchema, shape: 'rows' },
];
