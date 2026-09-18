import "server-only";
import webpush from "web-push";
import nodemailer from "nodemailer";
import type { PushSub } from "@/db/schema";

let configured = false;
function setup() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

/** Sends to every subscription; returns endpoints that are gone (404/410) so the caller can prune them. */
export async function sendPush(subs: PushSub[], payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!setup() || !subs.length) return { sent: 0, dead: [] as string[] };
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, JSON.stringify(payload), { TTL: 60 * 60 });
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
        else console.error("[push] failed", code, e);
      }
    }),
  );
  return { sent, dead };
}

/** CallMeBot free WhatsApp API: personal use, messages only go to the phone that activated the key. */
export async function sendWhatsApp(phone: string, apiKey: string, text: string) {
  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", phone.replace(/[^\d+]/g, ""));
  url.searchParams.set("text", text);
  url.searchParams.set("apikey", apiKey);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = await res.text();
    const ok = res.ok && !/error|invalid|not valid/i.test(body.slice(0, 500));
    if (!ok) console.error("[whatsapp] failed", res.status, body.slice(0, 200));
    return ok;
  } catch (e) {
    console.error("[whatsapp] failed", e);
    return false;
  }
}

// ---------- Email (any SMTP: Gmail app password, Brevo, …) ----------

let transport: nodemailer.Transporter | null = null;
function mailer() {
  if (transport) return transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 465);
  transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  return transport;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export async function sendEmail(to: string, subject: string, body: string) {
  const t = mailer();
  if (!t) return false;
  const url = `${process.env.APP_URL ?? ""}/dashboard`;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || `CAT Sprint <${process.env.SMTP_USER}>`,
      to,
      subject: `CAT Sprint · ${subject}`,
      text: `${body}\n\nOpen your dashboard: ${url}`,
      html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b">
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#71717a">CAT Sprint</div>
  <h2 style="margin:8px 0 12px;font-size:20px">${esc(subject)}</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${esc(body)}</p>
  <a href="${url}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9px;font-size:14px">Open dashboard</a>
  <p style="font-size:12px;color:#a1a1aa;margin-top:24px">Turn email off anytime in Settings.</p>
</div>`,
    });
    return true;
  } catch (e) {
    console.error("[email] failed", e);
    return false;
  }
}
