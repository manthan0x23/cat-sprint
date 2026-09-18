import "server-only";
import webpush from "web-push";
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
