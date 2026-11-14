import type { CreatedVirtualFleet, CreateVirtualFleetRequest, RefusalField, VirtualFleetRefusal } from './virtual-fleets.contract';
import type { VirtualFleetsRepository, Written } from './virtual-fleets.repository';

// The Virtual Fleets' rules (PRD 2842 s1; ADR-0095), over the repository as the signed-in person. Who
// may make one (any member of the workspace) and what a name, an icon and the roles must be are the
// database's to say; this turns each refusal into its words and the drawer's field they go under. A
// field's refusal (22023) already names its field first, in the drawer's words (`Name taken: choose
// another`), and carries the field as its hint (ADR-0050).

type Served<T> = { ok: true; value: T } | { ok: false; kind: VirtualFleetRefusal; error: string; field: RefusalField; cause?: string };

export const ONLY_MEMBERS = 'Only a member of the workspace creates its virtual fleets.';
export const FAILED = 'The fleet could not be created. Try again.';

type Refused = Extract<Written<unknown>, { ok: false }>;

/** The drawer's field a hint names; the cap of 12 fleets (`fleets`) and anything else go in its foot. */
function fieldOf(hint: string | null): RefusalField {
  return hint === 'name' || hint === 'mascot' || hint === 'heroes' ? hint : 'form';
}

/** A refused write in its words; anything unforeseen is a failure, its words kept for the log only. */
function refusal(written: Refused): Served<never> {
  if (written.code === '42501') return { ok: false, kind: 'forbidden', error: ONLY_MEMBERS, field: 'form' };
  if (written.code === '22023' && written.message) return { ok: false, kind: 'invalid', error: written.message, field: fieldOf(written.hint) };
  return { ok: false, kind: 'database', error: FAILED, field: 'form', cause: `${written.code ?? 'no code'}: ${written.message}` };
}

type Port = Pick<VirtualFleetsRepository, 'create' | 'names'>;

export function virtualFleetsService(repository: Port) {
  return {
    /** Makes a Virtual Fleet with a hero per role left on: the fleet as made, to land on. */
    async create(request: CreateVirtualFleetRequest): Promise<Served<CreatedVirtualFleet>> {
      const written = await repository.create(request);
      return written.ok ? { ok: true, value: { fleet: written.value } } : refusal(written);
    },

    /** The keys of the workspace's virtual fleets: the Fleet section marks their chips. */
    names(workspace: string): Promise<string[]> {
      return repository.names(workspace);
    },
  };
}

export type VirtualFleetsService = ReturnType<typeof virtualFleetsService>;
