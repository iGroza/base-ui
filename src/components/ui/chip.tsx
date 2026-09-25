import { cn } from "@/lib/utils";

export function Chip({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color?: string | null;
  className?: string;
}) {
  const tone = color ? `chip-${color}` : "";
  return <span className={cn("chip", tone, className)}>{children}</span>;
}

export function Avatar({
  name,
  src,
  size = "sm",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "size-9 text-[13px]" : "size-6 text-[10px]";
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          "rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10",
          dim,
        )}
      />
    );
  }
  const parts = name.trim().split(/\s+/);
  const label =
    parts.length > 1
      ? (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-white/70 font-medium text-fg",
        dim,
      )}
      title={name}
    >
      {label}
    </span>
  );
}
