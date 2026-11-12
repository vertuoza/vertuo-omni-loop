// The `embed` Edge Function (PRD 2728), the repository's first: Supabase's built-in gte-small model behind
// handler.ts. Supabase already processes the product's data, so no new processor sees it (L-GDPR-5).
// The `supabase` workflow deploys it on `main`, after the migrations; CI's local stack never starts the
// edge runtime, and the tests run the handler with a fake session.
import { MODEL, handleEmbed, type EmbedSession } from './handler.ts';

// The edge runtime's globals, declared here so the repository's Node typecheck and lint read this file.
declare const Deno: { serve(handler: (request: Request) => Promise<Response>): unknown };
declare const Supabase: { ai: { Session: new (model: string) => EmbedSession } };

const session = new Supabase.ai.Session(MODEL);

Deno.serve((request) => handleEmbed(request, session));
