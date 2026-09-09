/**
 * Sends a WhatsApp message via the Meta WhatsApp Cloud API if
 * WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID are configured. Falls back to a
 * console log — best-effort/non-blocking, same pattern as lib/notify/email.ts.
 */
export async function sendWhatsAppMessage(input: { to: string; body: string }): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`[whatsapp:not-configured] would send to ${input.to}: ${input.body}`);
    return;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: sanitizePhoneForWhatsApp(input.to),
        type: 'text',
        text: { body: input.body },
      }),
    });
    if (!res.ok) {
      console.error(`[whatsapp:failed] ${res.status} ${await res.text()}`);
    }
  } catch (error) {
    console.error('[whatsapp:error]', error);
  }
}

function sanitizePhoneForWhatsApp(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/** wa.me deep link for the "share invoice" flow — no API/token required, opens WhatsApp with a prefilled message. */
export function buildWhatsAppShareLink(phone: string, message: string): string {
  return `https://wa.me/${sanitizePhoneForWhatsApp(phone)}?text=${encodeURIComponent(message)}`;
}
