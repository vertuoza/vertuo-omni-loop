import 'server-only';
import { limitWaitRepository } from '../limit-wait.repository';
import { repairRepository } from '../repair.repository';
import type { RoomView } from './room';
import { roomRepository, type RoomDb } from './room.repository';
import { roomService } from './room.service';

// The Operation room's real read (PRD 2842 s8), as the person `db` acts for, never a service key (ADR-0051).

/** The room of `fleet` in `workspace`, as the person `db` acts for. */
export const loadRoom = (db: RoomDb, workspace: string, fleet: string, color: string | null, query: Record<string, string | string[] | undefined>): Promise<RoomView> =>
  roomService({ ...roomRepository(db), waits: (missions: readonly string[]) => limitWaitRepository(db).facts(missions), repairs: (missions: readonly string[]) => repairRepository(db).facts(missions) }).view(workspace, fleet, color, query, new Date());
