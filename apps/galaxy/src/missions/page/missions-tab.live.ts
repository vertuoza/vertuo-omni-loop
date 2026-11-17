import 'server-only';
import { limitWaitRepository } from '../limit-wait.repository';
import { repairRepository } from '../repair.repository';
import type { MissionsView } from './missions-tab';
import { missionsTabRepository, type MissionsTabDb } from './missions-tab.repository';
import { missionsTabService } from './missions-tab.service';

// The Missions tab's real read (PRD 2842 s7), as the person `db` acts for, never a service key (ADR-0051):
// row-level security shows a mission to the members of its workspace and to nobody else.

/** The tab of `fleet` in `workspace`, as the person `db` acts for. */
export const loadMissionsTab = (db: MissionsTabDb, workspace: string, fleet: string): Promise<MissionsView> =>
  missionsTabService({ ...missionsTabRepository(db), waits: (missions: readonly string[]) => limitWaitRepository(db).facts(missions), repairs: (missions: readonly string[]) => repairRepository(db).facts(missions) }).view(workspace, fleet);
