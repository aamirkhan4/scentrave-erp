/**
 * Sends transactional email via Resend if RESEND_API_KEY is configured.
 * Falls back to a console log so the call site never has to branch on
 * whether email is set up — this is intentionally best-effort/non-blocking.
 */
export async function sendEmail(input: { to: string; subject: string; body: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.NOTIFICATIONS_FROM_EMAIL ?? 'alerts@scentrave.example';

  if (!apiKey) {
    console.log(`[email:not-configured] would send to ${input.to}: ${input.subject}`);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress, to: input.to, subject: input.subject, text: input.body }),
    });
    if (!res.ok) {
      console.error(`[email:failed] ${res.status} ${await res.text()}`);
    }
  } catch (error) {
    console.error('[email:error]', error);
  }
}
