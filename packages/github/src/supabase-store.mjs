// The client's store in Supabase (PRD 902, s1): github_etags and github_budget, written and read with the
// service role, the only role granted them (supabase/migrations/*_github_budget.sql). `db` is a
// supabase-js client; nothing here imports it, so either app passes its own. Every refusal throws, and
// the client then calls GitHub without the store.

const ms = (value) => (value === null || value === undefined ? null : Date.parse(value));
const iso = (value) => new Date(value).toISOString();

function refused(what, error) {
  if (error) throw new Error(`Supabase refused to ${what}: ${error.message}`);
}

export function supabaseGithubStore(db) {
  return {
    async etag(installation, url) {
      const { data, error } = await db.from('github_etags').select('etag, body, content_type, read_at')
        .eq('installation_id', installation).eq('url', url).maybeSingle();
      refused('read an ETag', error);
      return data ? { etag: data.etag, body: data.body, contentType: data.content_type, readAt: ms(data.read_at) } : null;
    },
    async saveEtag(installation, url, { etag, body, contentType = null, at }) {
      const { error } = await db.from('github_etags').upsert(
        { installation_id: installation, url, etag, body, content_type: contentType, read_at: iso(at) },
        { onConflict: 'installation_id,url' },
      );
      refused('store an ETag', error);
    },
    async touchEtag(installation, url, at) {
      const { error } = await db.from('github_etags').update({ read_at: iso(at) }).eq('installation_id', installation).eq('url', url);
      refused('mark an ETag read', error);
    },
    async budget(installation, resource) {
      const { data, error } = await db.from('github_budget').select('limit, remaining, reset_at, paused_until, updated_at')
        .eq('installation_id', installation).eq('resource', resource).maybeSingle();
      refused('read the GitHub budget', error);
      return data
        ? { limit: data.limit, remaining: data.remaining, resetAt: ms(data.reset_at), pausedUntil: ms(data.paused_until), updatedAt: ms(data.updated_at) }
        : null;
    },
    /** What an answer reported; the columns it leaves out (paused_until) keep their value. */
    async saveBudget(installation, resource, { limit, remaining, resetAt, at }) {
      const { error } = await db.from('github_budget').upsert(
        { installation_id: installation, resource, limit, remaining, reset_at: iso(resetAt), updated_at: iso(at) },
        { onConflict: 'installation_id,resource' },
      );
      refused('store the GitHub budget', error);
    },
    async pause(installation, resource, until, at) {
      const { data, error } = await db.from('github_budget').update({ paused_until: iso(until), updated_at: iso(at) })
        .eq('installation_id', installation).eq('resource', resource).select('resource');
      refused('pause the GitHub budget', error);
      if (data && data.length > 0) return;
      const inserted = await db.from('github_budget').upsert(
        { installation_id: installation, resource, limit: 0, remaining: 0, reset_at: iso(until), paused_until: iso(until), updated_at: iso(at) },
        { onConflict: 'installation_id,resource' },
      );
      refused('pause the GitHub budget', inserted.error);
    },
  };
}
