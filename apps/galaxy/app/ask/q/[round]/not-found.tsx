import { Notice } from '../../../../src/ask/page/Notice';
import { SwitchAccount } from '../../../../src/ask/page/SignInCard';
import { supabaseEnv } from '../../../../src/data/supabase-server';

// A question that does not exist, or belongs to another workspace: the same words either way, so a
// link tells nobody whether it is real.

export default function AskQuestionNotFound() {
  const env = supabaseEnv();
  return (
    <Notice title="Not found">
      <p className="ask-muted">
        There is no question at this link for the account you are signed in with. A shared question opens only for the
        members of the workspace it was asked in.
      </p>
      {env && <SwitchAccount supabase={env} />}
    </Notice>
  );
}
