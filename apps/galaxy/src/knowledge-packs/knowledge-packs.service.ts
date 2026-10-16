import type { PackQuery, PackRefusal, PackReply } from './knowledge-packs.contract';
import type { KnowledgePacksRepository } from './knowledge-packs.repository';

// The knowledge pack read's rules (PRD 2011; ADR-0095), on its repository: the pack the caller asks for,
// or why there is none. The repository is read by its lower-case name, as the App keeps it. A pack the
// caller's workspaces do not hold reads as none, whatever another workspace keeps (law BR-PRODUCT-63:
// row-level security decides, never this service).

/** A service answer: its value, or why it was refused, in plain words. */
type Served<T> = { ok: true; value: T } | { ok: false; kind: PackRefusal; error: string };

const NOT_READ = 'The knowledge pack could not be read. Try again.';

const missing = (repo: string, sha: string | undefined) =>
  sha === undefined
    ? `No knowledge pack of ${repo} in your workspaces yet: the App makes one when a merge touches its knowledge folder or flow config.`
    : `No knowledge pack of ${repo} at ${sha} in your workspaces.`;

export function knowledgePacksService(repository: KnowledgePacksRepository) {
  return {
    /** The pack `query` names, with its files. */
    async read({ repo, sha }: PackQuery): Promise<Served<PackReply>> {
      const name = repo.toLowerCase();
      const pack = await repository.pack(name, sha ?? null);
      if (!pack.ok) return { ok: false, kind: 'database', error: NOT_READ };
      if (pack.value === null) return { ok: false, kind: 'missing', error: missing(name, sha) };
      const files = await repository.files(pack.value.id);
      if (!files.ok) return { ok: false, kind: 'database', error: NOT_READ };
      const { repository: kept, sha: commit, committed_at: committedAt, made_at: madeAt } = pack.value;
      return { ok: true, value: { repository: kept, sha: commit, committedAt, madeAt, files: files.value } };
    },
  };
}

export type KnowledgePacksService = ReturnType<typeof knowledgePacksService>;
