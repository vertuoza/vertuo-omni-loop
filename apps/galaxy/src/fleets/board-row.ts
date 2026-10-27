import { z } from 'zod';

// What the fleets page reads of a fleet's GitHub project board (PRD 2530): its link, and the App's last note.

export const BOARD_COLUMNS = 'name, project_url, project_note, project_noted_at';
export const StoredBoard = z.strictObject({
  name: z.string(),
  project_url: z.string().nullable(),
  project_note: z.string().nullable(),
  project_noted_at: z.string().nullable(),
});
