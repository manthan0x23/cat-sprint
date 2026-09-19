"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import clsx from "clsx";
import { BellRing, Check, Globe, Users } from "lucide-react";
import { setVisibility } from "@/app/actions";
import { pushSupported, subscribeThisDevice } from "@/lib/push-client";

type Visibility = "friends" | "public";

const OPTIONS: { v: Visibility; icon: typeof Users; title: string; body: string }[] = [
  { v: "friends", icon: Users, title: "Friends only", body: "Only people you've accepted as friends can see your stats and progress." },
  { v: "public", icon: Globe, title: "Public", body: "Anyone signed in to CAT Sprint can see your stats at /u/username." },
];

// Two big radio cards. With `name`, it posts as a normal form field.
export function VisibilityChoice({ value, onChange, name }: { value: Visibility; onChange: (v: Visibility) => void; name?: string }) {
  return (
    <div role="radiogroup" aria-label="Profile visibility" className="grid gap-2 sm:grid-cols-2">
      {OPTIONS.map(({ v, icon: Icon, title, body }) => (
        <label key={v} className={clsx("cursor-pointer text-left rounded-xl border p-4 transition-all",
          value === v ? "border-accent bg-accent-soft ring-2 ring-accent/15" : "border-line bg-panel hover:border-line-2")}>
          <input type="radio" name={name ?? "visibility-choice"} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
          <div className="flex items-center justify-between">
            <span className="font-medium inline-flex items-center gap-2"><Icon size={15} /> {title}</span>
            {value === v && <span className="size-5 rounded-full bg-accent text-white grid place-items-center"><Check size={12} /></span>}
          </div>
          <p className="mt-1 text-[13px] text-muted leading-relaxed">{body}</p>
        </label>
      ))}
    </div>
  );
}

// Settings form version: uncontrolled from the server's point of view, posts `visibility`.
export function VisibilityField({ initial }: { initial: Visibility }) {
  const [v, setV] = useState<Visibility>(initial);
  return <VisibilityChoice name="visibility" value={v} onChange={setV} />;
}

function Dialog({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4">
      <div role="dialog" aria-modal="true" aria-label={label}
        className="card w-full md:max-w-md rounded-b-none md:rounded-b-[14px] p-5 rise">
        {children}
      </div>
    </div>
  );
}

// Existing users who never picked friends/public: ask once. Saving marks it chosen server-side.
export function VisibilityPrompt({ current }: { current: Visibility }) {
  const [v, setV] = useState<Visibility>(current);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return null;
  return (
    <Dialog label="Choose who can see your profile">
      <h2 className="text-[19px] font-semibold tracking-tight">Who can see your profile?</h2>
      <p className="mt-1 text-[13.5px] text-muted">
        New: you can make your profile public or keep it to friends. Your &ldquo;why&rdquo;, notes and notification settings are never shared. You can change this any time in Settings.
      </p>
      <div className="mt-4"><VisibilityChoice value={v} onChange={setV} /></div>
      <button className="btn btn-accent w-full mt-4 h-10" disabled={pending}
        onClick={() => start(async () => { await setVisibility(v); setDone(true); })}>
        {pending ? "Saving…" : `Save · ${v === "public" ? "Public" : "Friends only"}`}
      </button>
    </Dialog>
  );
}

const NEVER = "notif-prompt:never"; // localStorage: "don't show again" on this browser
const LATER = "notif-prompt:later"; // sessionStorage: "not now" for this visit

function shouldAsk() {
  try {
    return pushSupported() && Notification.permission === "default"
      && localStorage.getItem(NEVER) !== "1" && sessionStorage.getItem(LATER) !== "1";
  } catch { return false; }
}

// Shown on entry while this browser hasn't answered the notification permission yet.
export function NotificationPrompt() {
  const ask = useSyncExternalStore(() => () => {}, shouldAsk, () => false);
  const [closed, setClosed] = useState(false);
  const [never, setNever] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!ask || closed) return null;

  const dismiss = () => {
    try {
      if (never) localStorage.setItem(NEVER, "1");
      sessionStorage.setItem(LATER, "1");
    } catch {}
    setClosed(true);
  };
  const allow = () => start(async () => {
    const err = await subscribeThisDevice();
    if (err) setError(err);
    else setClosed(true);
  });

  return (
    <Dialog label="Turn on notifications">
      <div className="flex items-start gap-3">
        <span className="size-9 shrink-0 rounded-full bg-accent-soft text-accent grid place-items-center"><BellRing size={17} /></span>
        <div>
          <h2 className="text-[19px] font-semibold tracking-tight">Allow notifications on this device?</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            The coach checks in during your study window: when you&apos;re behind, almost done, or finished. Your browser will ask for permission next.
          </p>
        </div>
      </div>
      {error && <p className="mt-3 text-[12.5px] text-bad">{error}</p>}
      <label className="mt-4 flex items-center gap-2 text-[13px] text-muted">
        <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="accent-[var(--accent)]" />
        Don&apos;t show this again on this device
      </label>
      <div className="mt-4 flex gap-2">
        <button className="btn btn-ghost flex-1 h-10" onClick={dismiss} disabled={pending}>Ignore</button>
        <button className="btn btn-accent flex-1 h-10" onClick={allow} disabled={pending}>{pending ? "Allowing…" : "Allow"}</button>
      </div>
    </Dialog>
  );
}
