"use client";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { lockAdmin, unlockAdmin } from "../actions";

export function UnlockForm() {
  const [state, action, pending] = useActionState(unlockAdmin, null);
  return (
    <form action={action} className="mt-6 card p-5 space-y-3">
      <div className="flex items-center gap-2 text-[14px] font-medium"><Lock size={15} /> Admin password</div>
      <input className="input" type="password" name="password" autoComplete="current-password" required maxLength={200} autoFocus aria-label="Admin password" />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Checking…" : "Unlock"}</button>
        {state && !state.ok && <span className="text-[13px] text-bad" role="alert">{state.error}</span>}
      </div>
    </form>
  );
}

export function LockButton() {
  return (
    <form action={lockAdmin}>
      <button className="chip hover:bg-panel-2">Lock</button>
    </form>
  );
}
