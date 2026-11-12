// A product's knowledge as one list of entries (PRD 2707 s3), built anew on each call from the knowledge
// packs the key may read and the product's own rows. Pure: the kit's own parsers read the pack files, so
// what an agent reads here is what the terminal and the business-law judge read.
//
//   business-law  the law home's pack only (lawsOfPackFiles, the judge's read)    BL-QUOTES-1
//   adr           each pack's `paths.adr` records (parseDecisionRecord)          <repo>/ADR-0067
//   rule          each pack's registers (readKnowledge on memorySource)          <repo>/BR-PRODUCT-3
//   legal         product_legal                                                  L-GDPR-2
//   term          product_glossary                                               term:API key
//   never         the product's live Never lines                                 never#6
//
// A repository entry's id carries the repository's short name, as the knowledge graph names it (PRD 1798),
// so two repositories that both hold an ADR-0012 never collide. The product's own entries carry none.
import { CONFIG_FILE, lawOwnerParts, parseConfig } from 'omni-loop/kit/lib/config.ts';
import type { Config } from 'omni-loop/kit/lib/types.ts';
import { parseDecisionRecord } from 'omni-loop/kit/lib/playbook/decisions.ts';
import { isLaw, memorySource, readKnowledge, type KnowledgeEntry as RegisterEntry } from 'omni-loop/kit/lib/knowledge/registers.ts';
import { lawsOfPackFiles } from '../business-laws/law-home';
import type { KnowledgeEntry } from './product-mcp.contract';

/** One file of a knowledge pack, by its repository path. */
export type PackText = { path: string; content: string };

/** What the entries are built from: the packs the key reads (`files: null` with none yet), the law home's pack, and the product's rows. */
export type EntrySources = {
  repositories: readonly { repo: string; files: readonly PackText[] | null }[];
  lawHome: { repo: string; files: readonly PackText[] } | null;
  legal: readonly { id: string; statement: string; source: string; owner: string | null }[];
  glossary: readonly { term: string; meaning: string; avoid: readonly string[] }[];
  never: readonly { seq: number; body: string }[];
};

/** The kit's own config: what a pack with no config, or one that does not read, is read by. */
const DEFAULTS = parseConfig('kit: 1\n');

const trimmed = (path: string): string => path.replace(/^\.\/+/, '').replace(/\/+$/, '');

/** The pack's own config, or the kit's defaults. */
function configOf(files: readonly PackText[]): Config {
  const file = files.find((f) => f.path === CONFIG_FILE);
  if (file === undefined) return DEFAULTS;
  try {
    return parseConfig(file.content, CONFIG_FILE, { ignoreUnknownKeys: true });
  } catch {
    return DEFAULTS;
  }
}

/** The short name of an `owner/name` slug. */
const shortName = (repo: string): string => repo.slice(repo.indexOf('/') + 1);

/** The lines that hold something, joined as a body. */
const lines = (...parts: (string | null | false)[]): string => parts.filter((part): part is string => typeof part === 'string' && part !== '').join('\n');

function decisionEntries(repo: string, files: readonly PackText[], adrDir: string | null): KnowledgeEntry[] {
  if (adrDir === null || adrDir === '') return [];
  const prefix = `${trimmed(adrDir)}/`;
  return files.flatMap((file) => {
    const rest = file.path.startsWith(prefix) ? file.path.slice(prefix.length) : '';
    if (rest === '' || rest.includes('/')) return [];
    const record = parseDecisionRecord(file.path, file.content);
    if (record.number === '') return [];
    const id = `ADR-${record.number}`;
    return [{
      id: `${shortName(repo)}/${id}`,
      kind: 'adr' as const,
      title: record.title ?? id,
      repo,
      domain: record.domain ?? null,
      body: record.text,
      file: file.path,
      status: record.status,
    }];
  });
}

/** What a register entry is: a law when a person locked it, else its kind. */
const kindWord = (entry: RegisterEntry): string => (isLaw(entry) ? 'law' : entry.kind ?? 'rule');
const statusOf = (entry: RegisterEntry): string => (isLaw(entry) ? 'law' : entry.proposed !== null ? 'proposed' : 'confirmed');

function registerEntries(repo: string, files: readonly PackText[], knowledgeRoot: string): KnowledgeEntry[] {
  const texts: Record<string, string> = {};
  for (const file of files) texts[file.path] = file.content;
  const { entries } = readKnowledge({ ctx: { root: '', layout: { knowledgeRoot } }, source: memorySource(texts) });
  return entries.map((entry) => ({
    id: `${shortName(repo)}/${entry.id}`,
    kind: 'rule' as const,
    title: entry.statement,
    repo,
    domain: entry.domain,
    body: lines(entry.statement, entry.why !== null && `Why: ${entry.why}`, `Kind: ${kindWord(entry)}`, `Status: ${statusOf(entry)}`,
      entry.enforcedBy !== null && `Enforced by: ${entry.enforcedBy}`),
    file: entry.file,
    status: statusOf(entry),
  }));
}

function lawEntries(home: { repo: string; files: readonly PackText[] }): KnowledgeEntry[] {
  const config = configOf(home.files);
  const owners = config.laws.owners.map((owner) => lawOwnerParts(owner).owner);
  return lawsOfPackFiles(home.files, trimmed(config.paths.knowledge)).map((law) => ({
    id: law.id,
    kind: 'business-law' as const,
    title: law.statement,
    repo: null,
    domain: law.domain,
    body: lines(law.statement, law.why !== null && `Why: ${law.why}`, `Domains: ${[law.domain, ...law.also].join(', ')}`,
      owners.length > 0 && `Owner: ${owners.join(', ')}`),
    file: law.file,
    status: null,
  }));
}

/** Every entry of the product's knowledge, in id order. */
export function knowledgeEntries(sources: EntrySources): KnowledgeEntry[] {
  const fromRepositories = sources.repositories.flatMap(({ repo, files }) => {
    if (files === null) return [];
    const config = configOf(files);
    return [...decisionEntries(repo, files, config.paths.adr), ...registerEntries(repo, files, trimmed(config.paths.knowledge))];
  });
  const legal = sources.legal.map((row): KnowledgeEntry => ({
    id: row.id, kind: 'legal', title: row.statement, repo: null, domain: null, file: null, status: null,
    body: lines(row.statement, `Source: ${row.source}`, row.owner !== null && `Owner: ${row.owner}`),
  }));
  const terms = sources.glossary.map((row): KnowledgeEntry => ({
    id: `term:${row.term}`, kind: 'term', title: row.term, repo: null, domain: null, file: null, status: null,
    body: lines(row.meaning, row.avoid.length > 0 && `Avoid: ${row.avoid.join(', ')}`),
  }));
  const never = sources.never.map((row): KnowledgeEntry => ({
    id: `never#${String(row.seq)}`, kind: 'never', title: row.body, repo: null, domain: null, file: null, status: null, body: row.body,
  }));
  const all = [...(sources.lawHome ? lawEntries(sources.lawHome) : []), ...legal, ...fromRepositories, ...terms, ...never];
  return all.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
