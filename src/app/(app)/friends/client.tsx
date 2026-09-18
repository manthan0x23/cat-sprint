"use client";
import { useState, useTransition } from "react";
import { Check, X, Zap } from "lucide-react";
import { removeFriendship, respondFriendRequest, sendFriendRequest, sendNudgeToFriend } from "@/app/actions";

export function AddFriend() {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="mt-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await sendFriendRequest(name); setMsg(r); if (r.ok) setName(""); }); }}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
          <input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, ""))} className="input !pl-7 num" placeholder="username" />
        </div>
        <button className="btn btn-primary" disabled={pending || name.length < 3}>{pending ? "…" : "Add"}</button>
      </div>
      {msg && <p className={`mt-2 text-[12.5px] ${msg.ok ? "text-good" : "text-bad"}`}>{msg.message}</p>}
    </form>
  );
}

export function RequestButtons({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1.5">
      <button className="btn btn-accent btn-sm !px-2" disabled={pending} onClick={() => start(() => respondFriendRequest(id, true))} aria-label="Accept"><Check size={14} /></button>
      <button className="btn btn-ghost btn-sm !px-2" disabled={pending} onClick={() => start(() => respondFriendRequest(id, false))} aria-label="Decline"><X size={14} /></button>
    </div>
  );
}

export function CancelRequest({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  return <button className="text-[12px] text-muted hover:text-bad" disabled={pending} onClick={() => start(() => removeFriendship(userId))}>Cancel</button>;
}

export function NudgeButton({ userId }: { userId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <button className="btn btn-ghost btn-sm" disabled={pending || !!msg} title="Send them a push/WhatsApp nudge (once a day)"
      onClick={() => start(async () => setMsg(await sendNudgeToFriend(userId)))}>
      <Zap size={12} /> {msg ?? "Nudge"}
    </button>
  );
}

export function FriendAction({ userId, username, kind, requestId }: { userId: string; username: string; kind: "none" | "incoming" | "outgoing" | "friends"; requestId?: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (kind === "none")
    return <button className="btn btn-accent btn-sm" disabled={pending || !!msg} onClick={() => start(async () => setMsg((await sendFriendRequest(username)).message))}>{msg ?? "Add friend"}</button>;
  if (kind === "outgoing")
    return <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(() => removeFriendship(userId))}>Requested · Cancel</button>;
  if (kind === "incoming" && requestId)
    return (
      <div className="flex gap-2">
        <button className="btn btn-accent btn-sm" disabled={pending} onClick={() => start(() => respondFriendRequest(requestId, true))}>Accept request</button>
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(() => respondFriendRequest(requestId, false))}>Decline</button>
      </div>
    );
  return (
    <div className="flex gap-2">
      <NudgeButton userId={userId} />
      {!confirm
        ? <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)}>Friends ✓</button>
        : <button className="btn btn-ghost btn-sm !text-bad" disabled={pending} onClick={() => start(() => removeFriendship(userId))}>Unfriend?</button>}
    </div>
  );
}
