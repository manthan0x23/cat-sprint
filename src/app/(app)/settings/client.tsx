"use client";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Bell, BellRing, Send } from "lucide-react";
import { resetPlanFromToday, sendTestNotification } from "@/app/actions";
import { subscribeThisDevice } from "@/lib/push-client";

export function PushToggle({ subscribed }: { subscribed: number }) {
  const [state, setState] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const enable = () =>
    start(async () => setState((await subscribeThisDevice()) ?? "This device is subscribed ✓"));

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
