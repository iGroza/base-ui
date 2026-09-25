"use client";

import type { ReactNode } from "react";
import { Link2, Monitor } from "lucide-react";
import { toast } from "sonner";
import { baseTaskUrl, siteTaskUrl } from "@/lib/task-links";
import { cn } from "@/lib/utils";

export function TaskLinkButtons({
  task,
  className,
  labeled = false,
}: {
  task: { id: number; incrId: number | null };
  className?: string;
  labeled?: boolean;
}) {
  const base = baseTaskUrl(task);

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {base ? (
        <CopyButton
          label="Скопировать ссылку в Base"
          short="В Base"
          icon={<Link2 className="size-3.5" />}
          labeled={labeled}
          onCopy={() => copyText(base, "Ссылка в Base скопирована")}
        />
      ) : null}
      <CopyButton
        label="Скопировать ссылку на эту доску"
        short="На доску"
        icon={<Monitor className="size-3.5" />}
        labeled={labeled}
        onCopy={() => copyText(siteTaskUrl(task), "Ссылка на эту доску скопирована")}
      />
    </span>
  );
}

function CopyButton({
  label,
  short,
  icon,
  labeled,
  onCopy,
}: {
  label: string;
  short: string;
  icon: ReactNode;
  labeled: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onCopy();
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-fg-muted hover:bg-white/50 hover:text-fg",
        labeled ? "h-8 gap-1.5 px-2.5 text-xs font-medium" : "size-7",
      )}
    >
      {icon}
      {labeled ? <span>{short}</span> : null}
    </button>
  );
}

async function copyText(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error("Не удалось скопировать");
  }
}
