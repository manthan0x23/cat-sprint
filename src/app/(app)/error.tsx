"use client";
// Last line of defence: a server action or page that throws lands here instead of Next's
// full-page "This page couldn't load", so the nav stays and the user can retry.
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error("[app]", error); }, [error]);
  return (
    <div className="card p-8 max-w-lg mx-auto text-center">
      <span className="size-10 mx-auto rounded-full bg-bad-soft text-bad grid place-items-center"><AlertTriangle size={19} /></span>
      <h2 className="mt-3 text-[19px] font-semibold tracking-tight">That didn&apos;t save</h2>
      <p className="mt-1.5 text-[13.5px] text-muted">
        Something went wrong on our side. Your earlier data is safe — try again, and if it keeps happening, tell me what you were doing.
      </p>
      {error.digest && <p className="mt-2 text-[11.5px] text-muted num">Reference: {error.digest}</p>}
      <div className="mt-5 flex justify-center gap-2">
        <button className="btn btn-accent" onClick={() => retry()}><RotateCw size={13} /> Try again</button>
        <Link className="btn btn-ghost" href="/dashboard">Back to today</Link>
      </div>
    </div>
  );
}
