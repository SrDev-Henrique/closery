"use client";

import { Button } from "@/components/ui/button";
import { moveLabel } from "@/features/requests/status";
import type { BoardStatus } from "@/features/requests/types";
import { cn } from "@/lib/utils";

import { REQUEST_STATUS_STYLE } from "./statusStyle";

// Ação que muda status: o texto nomeia o resultado e a cor é a do status de
// destino (ui-rules §2.4).
export function MoveStatusButton({
  to,
  onClick,
  disabled = false,
  size = "default",
  className,
}: {
  to: BoardStatus;
  onClick: () => void;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
}) {
  const { icon: Icon, buttonClass } = REQUEST_STATUS_STYLE[to];
  return (
    <Button
      type="button"
      size={size}
      className={cn(buttonClass, className)}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      {moveLabel(to)}
    </Button>
  );
}
