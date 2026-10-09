// Email (PRD 1322 s2): one message to one address through Resend, which the sender is handed so a test
// hands a fake. A refusal or a throw is logged and counts as not sent; nothing is retried.

/** One email: its address, subject, and the same words as text and as HTML. */
type Email = { to: string; subject: string; text: string; html: string };

/** Sends one email; true when Resend took it. */
export type EmailSender = (email: Email) => Promise<boolean>;

/** The one call the sender makes of Resend's client. */
export type EmailLib = {
  emails: {
    send(payload: { from: string; to: string; subject: string; text: string; html: string }): Promise<{ error: { message: string } | null }>;
  };
};

/** A sender writing as `from` (`Name <address>` or an address). Never throws. */
export function emailSender(from: string, lib: EmailLib, log: (line: string) => void): EmailSender {
  return async (email) => {
    try {
      const { error } = await lib.emails.send({ from, ...email });
      if (!error) return true;
      log(`notify: an email was refused: ${error.message}`);
    } catch (error) {
      log(`notify: an email failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  };
}
