import { Resend } from 'resend';
import { getDb } from '../db/index.js';
import { logOutgoingEmail } from './tracking.js';

let _resend: Resend | null = null;

// Resend çağrısını wrap'ler: gönderim sonucunu outgoing_emails tablosuna logla.
async function sendAndLog(args: {
  resend: Resend;
  template: string;
  userId?: number | null;
  payload: Parameters<Resend['emails']['send']>[0];
}): Promise<{ ok: boolean; error?: string }> {
  let ok = false;
  let error: string | undefined;
  try {
    const res = await args.resend.emails.send(args.payload);
    if (res.error) {
      error = res.error.message;
    } else {
      ok = true;
    }
  } catch (err) {
    error = (err as Error).message;
  }

  try {
    const to = Array.isArray(args.payload.to) ? args.payload.to[0] : args.payload.to;
    logOutgoingEmail(getDb(), {
      toEmail: String(to ?? ''),
      subject: args.payload.subject ?? '',
      template: args.template,
      bodyHtml: 'html' in args.payload ? (args.payload.html as string) : null,
      status: ok ? 'sent' : 'failed',
      error: error ?? null,
      userId: args.userId ?? null,
    });
  } catch {
    /* noop */
  }

  return { ok, error };
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

const FROM_DEFAULT = 'Fonoloji <no-reply@fonoloji.com>';
const FROM_EMAIL = process.env.FONOLOJI_MAIL_FROM ?? FROM_DEFAULT;
const BRAND_COLOR_A = '#8B5CF6';
const BRAND_COLOR_B = '#06B6D4';
const SITE_URL = process.env.FONOLOJI_SITE_URL ?? 'https://fonoloji.com';

export function generateVerifyCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

interface SendResult {
  ok: boolean;
  error?: string;
  devCode?: string;
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  name: string | null,
): Promise<SendResult> {
  const resend = getResend();
  const firstName = (name?.split(' ')[0] || to.split('@')[0] || 'orada').slice(0, 30);

  if (!resend) {
    console.log(`[mail] RESEND_API_KEY yok. ${to} için doğrulama kodu: ${code}`);
    return { ok: false, error: 'Mail servisi yapılandırılmamış', devCode: code };
  }

  const html = verificationTemplate(firstName, code);
  const text = `Fonoloji'ye hoş geldin ${firstName}!\n\nHesabını aktif etmek için 6 haneli kod: ${code}\n\nKod 10 dakika içinde geçersiz olur.\n\nFonoloji\n${SITE_URL}`;

  const result = await sendAndLog({
    resend,
    template: 'verification',
    payload: {
      from: FROM_EMAIL,
      to,
      subject: `Fonoloji doğrulama kodu: ${code}`,
      html,
      text,
      replyTo: process.env.FONOLOJI_REPLY_TO,
    },
  });
  return result;
}

export async function sendContactNotification(
  adminEmail: string,
  data: { fullName: string; email: string; subject: string; message: string },
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.log(`[mail] Contact → ${adminEmail}: ${data.subject} (${data.email})`);
    return { ok: false, error: 'Mail servisi yapılandırılmamış' };
  }

  const html = contactTemplate(data);
  const text = `Yeni iletişim mesajı\n\n${data.fullName} <${data.email}>\nKonu: ${data.subject}\n\n${data.message}`;

  return sendAndLog({
    resend,
    template: 'contact-notification',
    payload: {
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `[Fonoloji] ${data.subject}`,
      html,
      text,
      replyTo: data.email,
    },
  });
}

const FROM_MAP: Record<string, string> = {
  'no-reply': 'Fonoloji <no-reply@fonoloji.com>',
  hello: 'Fonoloji <hello@fonoloji.com>',
  alikemal: 'Ali Kemal · Fonoloji <alikemal@fonoloji.com>',
};

export async function sendAdminBroadcast(args: {
  from: 'no-reply' | 'hello' | 'alikemal';
  to: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}): Promise<{ ok: boolean; sent: number; failed: number; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log(`[mail] Broadcast → ${args.to.length} alıcı: ${args.subject}`);
    return { ok: false, sent: 0, failed: args.to.length, error: 'Mail servisi yapılandırılmamış' };
  }

  const fromAddr = FROM_MAP[args.from] ?? FROM_MAP['no-reply']!;

  // Plain mode = send exactly what admin typed, as raw text email. No template, no footer.
  // HTML mode = send HTML as-is (admin provided full HTML).
  const sendArgs = args.isHtml
    ? { html: args.body, text: stripHtml(args.body) }
    : { text: args.body };

  // Send one-by-one with Promise.all + Resend rate-limits ~10 req/s.
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  const BATCH = 8;
  for (let i = 0; i < args.to.length; i += BATCH) {
    const chunk = args.to.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map((addr) =>
        sendAndLog({
          resend,
          template: 'admin-broadcast',
          payload: {
            from: fromAddr,
            to: addr,
            subject: args.subject,
            ...sendArgs,
          },
        }),
      ),
    );
    for (const r of results) {
      if (r.ok) sent++;
      else {
        failed++;
        if (r.error && errors.length < 5) errors.push(r.error);
      }
    }
    // Simple throttle to stay under Resend rate limits (~10/s)
    if (i + BATCH < args.to.length) await new Promise((r) => setTimeout(r, 900));
  }

  return {
    ok: failed === 0,
    sent,
    failed,
    error: errors.length ? errors.join('; ') : undefined,
  };
}

function broadcastTemplate(body: string, subject: string): string {
  const bodyHtml = escapeHtml(body).replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8ec;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0b10;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:0 0 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:linear-gradient(135deg,${BRAND_COLOR_A},${BRAND_COLOR_B});width:40px;height:40px;border-radius:12px;text-align:center;vertical-align:middle;font-size:22px;color:#fff;font-weight:800;line-height:40px;font-family:Georgia,serif;font-style:italic;">f</td>
              <td style="padding-left:12px;font-size:20px;font-weight:700;color:#f5f5f7;letter-spacing:-0.5px;font-family:Georgia,serif;">Fonoloji</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#15151b;border:1px solid #24242b;border-radius:20px;overflow:hidden;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="background:linear-gradient(135deg,${BRAND_COLOR_A} 0%,${BRAND_COLOR_B} 100%);height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding:32px 36px;">
              <div style="font-size:15px;line-height:1.75;color:#d8d8dc;">${bodyHtml}</div>
            </td></tr>
            <tr><td style="padding:0 36px 28px;border-top:1px solid #24242b;">
              <p style="margin:16px 0 0;font-size:11px;color:#61616c;line-height:1.6;">
                Bu maili <a href="${SITE_URL}" style="color:#a8a8b3;text-decoration:none;">fonoloji.com</a> üyeliğin nedeniyle alıyorsun.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export async function sendContactReply(
  to: string,
  data: {
    subject: string;
    body: string;
    originalSubject: string;
    originalMessage: string;
    customerName: string;
  },
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.log(`[mail] Reply → ${to}: ${data.subject}`);
    return { ok: false, error: 'Mail servisi yapılandırılmamış' };
  }

  const html = replyTemplate(data);
  const text = `${data.body}\n\n\n---\nİlk mesajın:\n\nKonu: ${data.originalSubject}\n\n${data.originalMessage}\n\n---\nFonoloji · ${SITE_URL}`;

  return sendAndLog({
    resend,
    template: 'contact-reply',
    payload: {
      from: FROM_EMAIL,
      to,
      subject: data.subject,
      html,
      text,
      replyTo: process.env.FONOLOJI_REPLY_TO,
    },
  });
}

function verificationTemplate(firstName: string, code: string): string {
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fonoloji doğrulama kodu</title></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8ec;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0b10;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">
        <tr><td align="center" style="padding:0 0 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:linear-gradient(135deg,${BRAND_COLOR_A},${BRAND_COLOR_B});width:40px;height:40px;border-radius:12px;text-align:center;vertical-align:middle;font-size:22px;color:#fff;font-weight:800;line-height:40px;font-family:Georgia,serif;font-style:italic;">f</td>
              <td style="padding-left:12px;font-size:20px;font-weight:700;color:#f5f5f7;letter-spacing:-0.5px;font-family:Georgia,serif;">Fonoloji</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#15151b;border:1px solid #24242b;border-radius:20px;overflow:hidden;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="background:linear-gradient(135deg,${BRAND_COLOR_A} 0%,${BRAND_COLOR_B} 100%);height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding:36px 36px 8px;">
              <h1 style="margin:0 0 14px;font-size:22px;font-weight:400;color:#f5f5f7;letter-spacing:-0.5px;font-family:Georgia,serif;">Merhaba ${escapeHtml(firstName)},</h1>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#a8a8b3;">
                TEFAS fonlarının akılcı analizine hoş geldin. Hesabını aktif etmek için aşağıdaki 6 haneli doğrulama kodunu kullan.
              </p>
            </td></tr>
            <tr><td align="center" style="padding:4px 36px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="background:linear-gradient(135deg,#1a1a24,#12121a);border:2px solid ${BRAND_COLOR_A}35;border-radius:16px;padding:22px 30px;">
                  <div style="font-size:10px;font-weight:700;color:${BRAND_COLOR_A};text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;text-align:center;">Doğrulama kodu</div>
                  <div style="font-size:40px;font-weight:600;color:#f5f5f7;letter-spacing:14px;font-family:'SF Mono',Monaco,Consolas,monospace;text-align:center;">${code}</div>
                </td></tr>
              </table>
            </td></tr>
            <tr><td style="padding:0 36px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0f0f16;border-radius:12px;border:1px solid #24242b;">
                <tr>
                  <td style="padding:14px 18px;font-size:12.5px;color:#7a7a85;line-height:1.6;">
                    <strong style="color:#c8c8d2;">⏰ Süre:</strong> Kod 10 dakika içinde geçerliliğini yitirir.<br>
                    <strong style="color:#c8c8d2;">🔒 Güvenlik:</strong> Bu kodu kimseyle paylaşma.
                  </td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:0 36px 36px;">
              <p style="margin:0;font-size:12px;color:#61616c;line-height:1.6;">
                Bu kayıt sen değilsen bu maili görmezden gelebilirsin — hesap aktif olmayacak.
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:24px 0 0;">
          <p style="margin:0;font-size:11px;color:#61616c;">© Fonoloji · <a href="${SITE_URL}" style="color:#a8a8b3;text-decoration:none;">fonoloji.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function contactTemplate(d: { fullName: string; email: string; subject: string; message: string }): string {
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8ec;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:40px 16px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="max-width:620px;width:100%;background:#15151b;border:1px solid #24242b;border-radius:20px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,${BRAND_COLOR_A} 0%,${BRAND_COLOR_B} 100%);height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 36px 8px;">
  <div style="font-size:10px;font-weight:700;color:${BRAND_COLOR_A};text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;">Yeni iletişim mesajı</div>
  <h2 style="margin:0 0 16px;font-size:20px;color:#f5f5f7;font-family:Georgia,serif;font-weight:400;letter-spacing:-0.5px;">${escapeHtml(d.subject)}</h2>
</td></tr>
<tr><td style="padding:0 36px 24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0f0f16;border-radius:12px;border:1px solid #24242b;">
    <tr><td style="padding:14px 18px;font-size:13px;color:#a8a8b3;">
      <div><strong style="color:#f5f5f7;">${escapeHtml(d.fullName)}</strong> &lt;<a href="mailto:${escapeHtml(d.email)}" style="color:${BRAND_COLOR_B};text-decoration:none;">${escapeHtml(d.email)}</a>&gt;</div>
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:0 36px 32px;">
  <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#d8d8dc;">${escapeHtml(d.message)}</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function replyTemplate(d: {
  subject: string;
  body: string;
  originalSubject: string;
  originalMessage: string;
  customerName: string;
}): string {
  const firstName = (d.customerName?.split(' ')[0] || 'merhaba').slice(0, 30);
  const bodyHtml = escapeHtml(d.body).replace(/\n/g, '<br>');
  const origHtml = escapeHtml(d.originalMessage).replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(d.subject)}</title></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8ec;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0b10;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:0 0 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:linear-gradient(135deg,${BRAND_COLOR_A},${BRAND_COLOR_B});width:40px;height:40px;border-radius:12px;text-align:center;vertical-align:middle;font-size:22px;color:#fff;font-weight:800;line-height:40px;font-family:Georgia,serif;font-style:italic;">f</td>
              <td style="padding-left:12px;font-size:20px;font-weight:700;color:#f5f5f7;letter-spacing:-0.5px;font-family:Georgia,serif;">Fonoloji</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="background:#15151b;border:1px solid #24242b;border-radius:20px;overflow:hidden;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="background:linear-gradient(135deg,${BRAND_COLOR_A} 0%,${BRAND_COLOR_B} 100%);height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding:32px 36px 8px;">
              <div style="font-size:10px;font-weight:700;color:${BRAND_COLOR_A};text-transform:uppercase;letter-spacing:3px;margin-bottom:12px;">Yanıt</div>
              <h2 style="margin:0 0 20px;font-size:22px;color:#f5f5f7;font-family:Georgia,serif;font-weight:400;letter-spacing:-0.4px;">Merhaba ${escapeHtml(firstName)},</h2>
            </td></tr>
            <tr><td style="padding:0 36px 28px;">
              <div style="font-size:15px;line-height:1.75;color:#d8d8dc;">${bodyHtml}</div>
            </td></tr>
            <tr><td style="padding:0 36px 28px;">
              <div style="font-size:12px;color:#61616c;line-height:1.5;">
                — Fonoloji ekibi<br>
                <a href="${SITE_URL}" style="color:#a8a8b3;text-decoration:none;">fonoloji.com</a>
              </div>
            </td></tr>
            <tr><td style="padding:0 36px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0f0f16;border-radius:12px;border:1px solid #24242b;">
                <tr><td style="padding:14px 18px;">
                  <div style="font-size:10px;font-weight:700;color:#7a7a85;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">İlk mesajın</div>
                  <div style="font-size:12.5px;color:#a8a8b3;margin-bottom:6px;"><strong style="color:#c8c8d2;">Konu:</strong> ${escapeHtml(d.originalSubject)}</div>
                  <div style="font-size:12.5px;color:#a8a8b3;line-height:1.65;white-space:normal;">${origHtml}</div>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:24px 0 0;">
          <p style="margin:0;font-size:11px;color:#61616c;">Bu yanıt Fonoloji admin paneli aracılığıyla gönderildi.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
