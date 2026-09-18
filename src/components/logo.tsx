export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#18181B" />
      <rect x="2.5" y="2.5" width="59" height="59" rx="15.5" stroke="#fff" strokeOpacity=".08" />
      <path d="M13 49h8.5v-8.5h8.5v-8.5h8.5v-8.5" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47.5" cy="16.5" r="7" fill="#1D9BF0" />
      <circle cx="47.5" cy="16.5" r="2.75" fill="#fff" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight text-[15px]">
        CAT<span className="text-muted font-normal"> Sprint</span>
      </span>
    </span>
  );
}
