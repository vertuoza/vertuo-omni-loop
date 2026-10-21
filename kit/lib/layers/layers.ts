// The words a repository and the Omni page share for what a file is and what a repository is for
// (PRD 2346): ten layers and nine roles, each with a one-line definition, and the alias tables that
// read the words in use before them. `docs/guide/knowledge-map.md` documents the same lists.

/** The ten canonical layers, each with what it covers. A file may be in several. */
export const CANONICAL_LAYERS: Readonly<Record<string, string>> = Object.freeze({
  ui: 'screens and components',
  api: 'REST or RPC routes and their payloads',
  schema: 'GraphQL or other typed contracts callers compile against',
  db: 'stored shapes, migrations, row-level security',
  auth: 'identity, sign-in, access',
  event: 'webhooks, queues, messages between services',
  cli: 'commands a person or an agent types',
  job: 'cron, workers, background runs',
  infra: 'deploy, environments, hosting',
  ci: 'pipelines, hooks, checks',
});

/** The nine canonical roles of a repository in a product, each with what it is. */
export const CANONICAL_ROLES: Readonly<Record<string, string>> = Object.freeze({
  api: 'serves routes, data and business rules to other repositories',
  web: 'a web application a person opens in a browser',
  mobile: 'a mobile application',
  ui: 'a shared set of screens, components or design tokens',
  library: 'code other repositories install and call',
  infra: 'deploy, environments and hosting for the product',
  plan: "holds the product's plans and delivery, and builds no feature itself",
  doc: 'documentation, guides and written knowledge',
  monorepo: 'several of the roles above in one repository',
});

/** The layers a role usually holds: guidance only, never checked. */
export const ROLE_LAYERS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  api: ['api', 'schema', 'db', 'auth', 'event', 'job'],
  web: ['ui', 'auth', 'api'],
  mobile: ['ui', 'auth', 'api'],
  ui: ['ui'],
  library: ['api', 'cli'],
  infra: ['infra', 'ci'],
  plan: ['cli', 'ci'],
  doc: [],
  monorepo: ['ui', 'api', 'schema', 'db', 'auth', 'event', 'cli', 'job', 'infra', 'ci'],
});

/** Layer words in use before the list, read once as their canonical layer. */
export const LAYER_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  rest: 'api',
  graphql: 'schema',
  database: 'db',
  migration: 'db',
});

/** Role words in use before the list, read once as their canonical role. */
export const ROLE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'back-end': 'api',
  backend: 'api',
  'front-end': 'web',
  frontend: 'web',
  docs: 'doc',
});

const has = (table: Readonly<Record<string, unknown>>, word: string): boolean => Object.hasOwn(table, word);

/** Whether `word` is one of the ten canonical layers. */
export const isLayer = (word: string): boolean => has(CANONICAL_LAYERS, word);

/** Whether `word` is one of the nine canonical roles. */
export const isRole = (word: string): boolean => has(CANONICAL_ROLES, word);

/** `word` as its canonical layer when it is an alias; any other word unchanged. */
export function layerOf(word: string): string {
  return has(LAYER_ALIASES, word) ? (LAYER_ALIASES[word] ?? word) : word;
}

/** `word` as its canonical role when it is an alias; any other word unchanged. */
export function roleOf(word: string): string {
  return has(ROLE_ALIASES, word) ? (ROLE_ALIASES[word] ?? word) : word;
}

/** The ten layers, in order, as one line: `ui, api, schema, …`. */
export const layerList = (): string => Object.keys(CANONICAL_LAYERS).join(', ');

/** The nine roles, in order, as one line. */
export const roleList = (): string => Object.keys(CANONICAL_ROLES).join(', ');
