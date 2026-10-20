import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../../supabase/database.types.ts';
import type { Persona } from '../../business/personas';
import { databasePersonas, demoPersonasPort, type PersonaPort } from '../../business/personas-store';
import type { WriteSource } from '../constituents/knowledge-reader';

// The Personas section's writes in the browser (PRD 2240 s4): the persona functions of
// supabase/migrations/20261022090000_personas.sql, called as the signed-in person, as Settings › Business
// called them (../../business/personas-store.ts); in the demo, the same rules kept in memory.

export const personaPortFor = (source: WriteSource, personas: Persona[]): PersonaPort =>
  source.kind === 'demo'
    ? demoPersonasPort(personas)
    : databasePersonas(createBrowserClient<Database>(source.url, source.key), source.workspace);
