"use client";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Bell, BellRing, Send } from "lucide-react";
import { resetPlanFromToday, savePushSubscription, sendTestNotification } from "@/app/actions";

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle({ subscribed }: { subscribed: number }) {
  const [state, setState] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const enable = () =>
    start(async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          setState("This browser doesn't support push. On iPhone, install to Home Screen first.");
          return;
        }
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) { setState("Server is missing the VAPID public key."); return; }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { setState("Permission denied. Allow notifications in site settings."); return; }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) }));
        await savePushSubscription(JSON.parse(JSON.stringify(sub)));
        setState("This device is subscribed ✓");
      } catch (e) {
        setState(`Failed: ${(e as Error).message}`);
      }
    });

  return (
    <div className="text-right shrink-0">
      <button type="button" onClick={enable} disabled={pending} className="btn btn-primary btn-sm">
        {subscribed ? <BellRing size={13} /> : <Bell size={13} />} {pending ? "Enabling…" : subscribed ? "Add this device" : "Enable"}
      </button>
      <div className="text-[11.5px] text-muted mt-1 max-w-[200px]">{state ?? (subscribed ? `${subscribed} device(s) subscribed` : "Not enabled")}</div>
    </div>
  );
}

export function TestButton() {
  const [res, setRes] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="btn btn-ghost" disabled={pending}
        onClick={() => start(async () => { const r = await sendTestNotification(); setRes(`Push: ${r.push} · Email: ${r.email}`); })}>
        <Send size={13} /> {pending ? "Sending…" : "Send test"}
      </button>
      {res && <span className="text-[12px] text-muted">{res}</span>}
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-accent" disabled={pending}>{pending ? "Saving…" : children}</button>;
}

export function ResetPlan({ templates, current }: { templates: { id: string; name: string }[]; current: string | null }) {
  const [sel, setSel] = useState(current ?? templates[0].id);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select value={sel} onChange={(e) => { setSel(e.target.value); setConfirm(false); }} className="input w-auto">
        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {!confirm ? (
        <button className="btn btn-ghost" onClick={() => setConfirm(true)}>Rebuild plan</button>
      ) : (
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { await resetPlanFromToday(sel); setConfirm(false); })}>
          {pending ? "Rebuilding…" : "Yes, replace from today"}
        </button>
      )}
    </div>
  );
}
