export type Priority = 'interactive' | 'background';
export type Resource = 'core' | 'graphql' | (string & {});

/** The two options githubFetch adds to a fetch's init. */
export interface GithubCallOptions { installation: number; priority: Priority }
export type GithubInit = RequestInit & GithubCallOptions;
export type GithubFetch = (input: string | URL | Request, init: GithubInit) => Promise<Response>;
export type PlainFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Times are epoch milliseconds. */
export interface StoredEtag { etag: string; body: string; contentType: string | null; readAt: number }
export interface StoredBudget { limit: number; remaining: number; resetAt: number; pausedUntil: number | null; updatedAt: number }
export interface GithubStore {
  etag(installation: number, url: string): Promise<StoredEtag | null>;
  saveEtag(installation: number, url: string, value: { etag: string; body: string; contentType?: string | null; at: number }): Promise<void>;
  touchEtag(installation: number, url: string, at: number): Promise<void>;
  budget(installation: number, resource: Resource): Promise<StoredBudget | null>;
  saveBudget(installation: number, resource: Resource, value: { limit: number; remaining: number; resetAt: number; at: number }): Promise<void>;
  pause(installation: number, resource: Resource, until: number, at: number): Promise<void>;
}

export interface GithubClient {
  fetch: GithubFetch;
  /** A plain fetch spending `installation`'s budget at `priority`, for Octokit's `request.fetch`. */
  bound(options: GithubCallOptions): PlainFetch;
}

export declare const BACKGROUND_FLOOR: number;
export declare class GithubDeferred extends Error { readonly until: number; constructor(until: number) }
export declare class GithubPaused extends Error { readonly until: number; constructor(until: number) }
export declare function resourceOf(url: string): Resource;
export declare function githubClient(deps: {
  store: GithubStore | null;
  fetch?: PlainFetch;
  clock?: () => number;
  log?: (line: string) => void;
}): GithubClient;
export declare function memoryGithubStore(): GithubStore;
/** `db` is a supabase-js client holding the service role. */
export declare function supabaseGithubStore(db: { from(table: string): unknown }): GithubStore;
