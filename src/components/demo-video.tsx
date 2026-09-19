"use client";
import { useEffect, useRef, useState } from "react";

/** Quiet, muted, looping product tour for the landing page. Respects reduced motion (no autoplay; controls instead). */
export function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ref.current?.pause();
      setReduced(true); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, []);
  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="absolute -inset-x-10 -inset-y-6 -z-10 rounded-[40px] bg-accent/10 blur-3xl" aria-hidden />
      <video ref={ref} src="/demo.mp4" poster="/demo-poster.jpg" autoPlay={!reduced} muted loop playsInline preload="metadata" controls={reduced}
        aria-label="37-second tour of CAT Sprint: daily targets, mock tracking, score vs percentile, coach notifications"
        className="w-full rounded-2xl border border-line shadow-2xl shadow-black/20 opacity-90" />
    </div>
  );
}
