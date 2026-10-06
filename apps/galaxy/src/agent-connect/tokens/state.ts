import type { AgentToken } from './model';

// Connect an agent's state in the page (PRD 855 s1): the links listed, the name being typed, the token
// just made (shown once: Done forgets it, and nothing can show it again), and the last refusal.

export interface Shown {
  name: string;
  token: string;
  /** Galaxy's MCP address. */
  url: string;
}

export interface TokensState {
  tokens: AgentToken[];
  name: string;
  shown: Shown | null;
  busy: boolean;
  refusal: string | null;
  /** The setup whose text was just copied, by its label. */
  copied: string | null;
}

export type TokensAction =
  | { type: 'name'; name: string }
  | { type: 'busy' }
  | { type: 'made'; token: string; url: string; listed: AgentToken }
  | { type: 'revoked'; id: string }
  | { type: 'refused'; message: string }
  | { type: 'copied'; label: string }
  | { type: 'done' };

export const initialTokensState = (tokens: readonly AgentToken[]): TokensState =>
  ({ tokens: [...tokens], name: '', shown: null, busy: false, refusal: null, copied: null });

export function tokensReducer(state: TokensState, action: TokensAction): TokensState {
  switch (action.type) {
    case 'name':
      return { ...state, name: action.name, refusal: null };
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'made':
      return {
        ...state, busy: false, name: '', copied: null,
        shown: { name: action.listed.name, token: action.token, url: action.url },
        tokens: [action.listed, ...state.tokens.filter((t) => t.id !== action.listed.id)],
      };
    case 'revoked':
      return { ...state, busy: false, tokens: state.tokens.filter((t) => t.id !== action.id) };
    case 'refused':
      return { ...state, busy: false, refusal: action.message };
    case 'copied':
      return { ...state, copied: action.label };
    case 'done':
      return { ...state, shown: null, copied: null };
  }
}
