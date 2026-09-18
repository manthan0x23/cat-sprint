export function Avatar({ src, name, size = 36 }: { src: string | null; name: string | null; size?: number }) {
  return (
    <span className="shrink-0 rounded-full overflow-hidden border border-line bg-panel-2 grid place-items-center text-muted font-medium"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (name ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
