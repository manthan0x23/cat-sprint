// Browser-only: ask for notification permission and subscribe this device to web push.
import { savePushSubscription } from "@/app/actions";

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// Returns null on success, or a message saying why it didn't work.
export async function subscribeThisDevice(): Promise<string | null> {
  try {
    if (!pushSupported()) return "This browser doesn't support push. On iPhone, install to Home Screen first.";
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return "Server is missing the VAPID public key.";
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "Permission denied. Allow notifications in site settings.";
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) }));
    await savePushSubscription(JSON.parse(JSON.stringify(sub)));
    return null;
  } catch (e) {
    return `Failed: ${(e as Error).message}`;
  }
}
