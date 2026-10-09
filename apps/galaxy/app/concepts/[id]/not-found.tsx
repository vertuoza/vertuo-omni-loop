import { Notice } from '../../../src/ask/page/Notice';
import { SwitchAccount } from '../../../src/ask/page/SignInCard';
import { supabaseEnv } from '../../../src/data/supabase-server';

// A concept that does not exist, belongs to another workspace, or is a dossier of another kind (PRD 1272,
// s3): the same words either way, so a link tells nobody whether it is real.

export default function ConceptNotFound() {
  const env = supabaseEnv();
  return (
    <Notice title="Not found">
      <p className="ask-muted">
        There is no concept at this link for the account you are signed in with. It opens only for the members
        of its workspace.
      </p>
      {env && <SwitchAccount supabase={env} />}
    </Notice>
  );
}
