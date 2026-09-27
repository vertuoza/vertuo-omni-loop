import { DesignScreen } from '../../src/design/DesignScreen';

// /design: the Omni Loop design system, public and outside the arcade (PRD 141). It reads no session
// and no database, so it opens for anyone and is prerendered at build time.
export default function DesignPage() {
  return <DesignScreen />;
}
