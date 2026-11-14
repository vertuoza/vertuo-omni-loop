import type { AddHeroRequest, Hero, HeroRefusal, HeroRefusalField, RemoveHeroRequest } from './heroes.contract';
import type { HeroesRepository, Written } from './heroes.repository';

// The Heroes tab's rules (PRD 2842 s6; ADR-0095), over the repository as the signed-in person. Who may
// add or remove a hero (an owner of the workspace), that a fleet holds one hero per role and keeps at
// least one are the database's to say; this turns each refusal into its words and the field they belong
// to. A field's refusal (22023) already carries its words (`Role: this fleet already has that hero.`)
// and its field as its hint (ADR-0050).

type Served<T> = { ok: true; value: T } | { ok: false; kind: HeroRefusal; error: string; field: HeroRefusalField; cause?: string };

export const ONLY_OWNERS = 'Only an owner of the workspace adds or removes a hero.';
export const FAILED = 'The hero could not be changed. Try again.';

type Refused = Extract<Written<unknown>, { ok: false }>;

/** The tab's field a hint names; anything else goes in the foot. */
function fieldOf(hint: string | null): HeroRefusalField {
  return hint === 'role' || hint === 'hero' ? hint : 'form';
}

/** A refused write in its words; anything unforeseen is a failure, its words kept for the log only. */
function refusal({ code, hint, message }: Refused): Served<never> {
  const foreseen = code === '42501' ? { kind: 'forbidden' as const, error: ONLY_OWNERS, field: 'form' as const }
    : code === '22023' && message ? { kind: 'invalid' as const, error: message, field: fieldOf(hint) }
      : null;
  return foreseen ? { ok: false, ...foreseen } : { ok: false, kind: 'database', error: FAILED, field: 'form', cause: `${code ?? 'no code'}: ${message}` };
}

type Port = Pick<HeroesRepository, 'add' | 'remove' | 'heroes' | 'owns'>;

export function heroesService(repository: Port) {
  return {
    /** A virtual fleet's heroes. */
    heroes: (workspace: string, fleet: string): Promise<Hero[]> => repository.heroes(workspace, fleet),

    /** True when the person owns the workspace: the tab shows its buttons to them alone. */
    owns: (workspace: string, person: string): Promise<boolean> => repository.owns(workspace, person),

    /** Adds a hero of a role the fleet lacks: the hero as made. */
    async add(request: AddHeroRequest): Promise<Served<{ hero: Hero }>> {
      const written = await repository.add(request);
      return written.ok ? { ok: true, value: { hero: written.value } } : refusal(written);
    },

    /** Removes a hero, a fleet's last one never. */
    async remove(request: RemoveHeroRequest): Promise<Served<{ removed: string }>> {
      const written = await repository.remove(request);
      return written.ok ? { ok: true, value: { removed: request.hero } } : refusal(written);
    },
  };
}

export type HeroesService = ReturnType<typeof heroesService>;
