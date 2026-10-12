// The push store's read (PRD 1322 s9), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// every person's alert switches, parsed with the schema the profile parses them with.
import type { Boundary } from '../data/parse-rows';
import { AlertChannels } from './device';
import { CHANNEL_COLUMNS } from './store';

export const boundaries: Boundary[] = [
  { name: 'push: alert_channels', read: (db) => db.from('alert_channels').select(CHANNEL_COLUMNS), schema: AlertChannels, shape: 'rows' },
];
