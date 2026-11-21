import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { SectorChoice } from "@/features/admin/sectors";

export function SectorSwitcher({
  sectors,
  selectedId,
  pathname,
}: {
  sectors: readonly SectorChoice[];
  selectedId: string;
  pathname: "/admin/turnos" | "/admin/itens";
}) {
  return (
    <nav aria-label="Setor">
      <ul className="flex flex-wrap gap-2">
        {sectors.map((sector) => {
          const selected = sector.id === selectedId;
          return (
            <li key={sector.id}>
              <Link
                href={`${pathname}?setor=${encodeURIComponent(sector.id)}`}
                aria-current={selected ? "page" : undefined}
                className={buttonVariants({
                  variant: selected ? "default" : "outline",
                })}
              >
                {sector.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
