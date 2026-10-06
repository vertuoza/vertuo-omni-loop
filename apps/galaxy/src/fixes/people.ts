import { peopleOf, type People } from '../people/load';

// Whom the fix screens name (PRD 652, s6), by GitHub login: the people directory of a fix's workspace.
// A fix list spans the viewer's workspaces, so it asks for one directory per workspace.

/** The people directory of a workspace, by its id. */
export type PeopleIn = (workspace: string) => People;

/** No directory: every login gets its public GitHub photo. */
export const NOBODY = (): People => peopleOf([], []);
