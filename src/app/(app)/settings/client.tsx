"use client";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Bell, BellRing, Check, Send } from "lucide-react";
import type { FormResult } from "@/lib/forms";
import { resetPlanFromToday, sendTestNotification } from "@/app/actions";
import { subscribeThisDevice } from "@/lib/push-client";

type SettingsAction = (prev: FormResult | null, formData: FormData) => Promise<FormResult>;

// Every settings form goes through here: the action reports problems as a value, which lands
// next to the button, instead of throwing and blanking the page.
export function SettingsForm({ action, submit, className, aside, children }: {
  action: SettingsAction; submit: string; className?: string; aside?: React.ReactNode; children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {aside ?? <span />}
        <div className="flex items-center gap-3 ml-auto">
          {state && !state.ok && <span className="text-[12.5px] text-bad">{state.error}</span>}
          {state?.ok && <span className="text-[12.5px] text-good inline-flex items-center gap-1"><Check size={12} /> Saved</span>}
          <SubmitButton>{submit}</SubmitButton>
        </div>
      </div>
    </form>
  );
}

// Controlled so a rejected save keeps what was typed: React resets uncontrolled inputs in a
// form once its action finishes, which would otherwise snap the field back to the saved name.
export function UsernameField({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  return (
    <div className="relative mt-1">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
      <input name="username" required pattern="[a-z0-9_]{3,20}" maxLength={20} value={v}
        onChange={(e) => setV(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
        className="input !pl-7 num" />
    </div>
  );
}

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
