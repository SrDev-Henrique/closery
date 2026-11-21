import type { ReactNode } from "react";

import { InactiveBadge } from "@/components/admin/InactiveBadge";
import { cn } from "@/lib/utils";

export function AdminListRow({
  title,
  subtitle,
  badges,
  notes,
  actions,
  inactive = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  notes?: ReactNode;
  actions?: ReactNode;
  inactive?: boolean;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium break-words",
              inactive && "text-muted-foreground",
            )}
          >
            {title}
          </span>
          {badges}
          {inactive && <InactiveBadge />}
        </div>
        {subtitle && (
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        )}
        {notes}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </li>
  );
}
