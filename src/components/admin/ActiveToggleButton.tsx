"use client";

import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { AdminResult } from "@/features/admin/result";

// "Desativar" / "Reativar" de uma linha de cadastro. Nada se apaga (F2-2).
export function ActiveToggleButton({
  entity,
  name,
  active,
  onToggle,
}: {
  entity: "Setor" | "Turno" | "Item" | "Destino";
  name: string;
  active: boolean;
  onToggle: (nextActive: boolean) => Promise<AdminResult<object>>;
}) {
  const { pending, run } = useAdminAction();
  const label = active ? "Desativar" : "Reativar";

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "outline" : "default"}
      aria-label={`${label} ${name}`}
      disabled={pending}
      onClick={() => {
        void run(() => onToggle(!active), {
          success: `${entity} ${active ? "desativado" : "reativado"}.`,
        });
      }}
    >
      {label}
    </Button>
  );
}
