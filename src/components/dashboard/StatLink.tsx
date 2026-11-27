import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { formatInteger } from "@/lib/numberFormat";

// Um número do dashboard: sempre um link para a lista que conta exatamente
// aquilo (D-F5-3). O nome acessível é número + rótulo + legenda.
export function StatLink({
  label,
  value,
  href,
  icon: Icon,
  caption,
}: {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  caption?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 flex-col gap-1 rounded-lg border bg-card p-3 text-card-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
    >
      <span className="text-3xl font-semibold tabular-nums">
        {formatInteger(value)}
      </span>{" "}
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </span>
      {caption && " "}
      {caption && (
        <span className="text-xs text-muted-foreground">{caption}</span>
      )}
    </Link>
  );
}
