import { Notice } from '../../../src/ask/page/Notice';
import { SwitchAccount } from '../../../src/ask/page/SignInCard';
import { supabaseEnv } from '../../../src/data/supabase-server';

// A session that does not exist, or belongs to someone else: the same words either way, so a link
// tells nobody whether it is real.

export default function AskSessionNotFound() {
  const env = supabaseEnv();
  return (
    <Notice title="Not found">
      <p className="ask-muted">
        There is no ask session at this link for the account you are signed in with. An ask link opens only for the
        person who switched ask mode on.
      </p>
      {env && <SwitchAccount supabase={env} />}
    </Notice>
  );
}
