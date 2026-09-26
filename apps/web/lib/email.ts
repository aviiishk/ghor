import { Resend } from "resend";
import type { WaitlistLead } from "@/types/waitlist";

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.WAITLIST_FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    return null;
  }

  return {
    apiKey,
    fromEmail
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createWelcomeEmailHtml(name: string) {
  const safeName = escapeHtml(name);

  return `
    <div style="margin:0;background:#f8fafc;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <table role="presentation" style="width:100%;max-width:560px;margin:0 auto;border-collapse:collapse;">
        <tr>
          <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:32px;box-shadow:0 20px 60px rgba(15,23,42,0.08);">
            <div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">GHOR</div>
            <h1 style="margin:28px 0 12px;font-size:28px;line-height:1.2;color:#0f172a;">You're officially on the GHOR waitlist</h1>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#334155;">Hi ${safeName},</p>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#334155;">Thanks for joining the GHOR waitlist.</p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#334155;">You're now among the first users who will get early access when GHOR launches.</p>
            <div style="background:#eff6ff;border:1px solid #dbeafe;border-radius:18px;padding:20px;margin:0 0 24px;">
              <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1d4ed8;">Your early access benefits</p>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#0f172a;">&bull; Early access</p>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#0f172a;">&bull; Founding member perks</p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;">&bull; Priority room alerts</p>
            </div>
            <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#334155;">We'll keep you updated.</p>
            <p style="margin:0;font-size:16px;line-height:1.7;color:#0f172a;">- Team GHOR</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export async function sendWaitlistWelcomeEmail(lead: WaitlistLead) {
  const config = getEmailConfig();

  if (!config) {
    console.warn("[Waitlist welcome email skipped] Resend is not configured.");
    return null;
  }

  const resend = new Resend(config.apiKey);
  const result = await resend.emails.send({
    from: config.fromEmail,
    to: lead.email,
    subject: "You're officially on the GHOR waitlist",
    html: createWelcomeEmailHtml(lead.name),
    text: `Hi ${lead.name},

Thanks for joining the GHOR waitlist.

You're now among the first users who will get early access when GHOR launches.

Benefits:

- Early access
- Founding member perks
- Priority room alerts

We'll keep you updated.

- Team GHOR`
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}
