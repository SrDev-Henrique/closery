import { Suspense } from "react";

import { AdminOverview } from "@/components/app-shell/AdminOverview";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito: o <title> sai antes do portão e diria
// "Administração | Closery" ao operador (T12). O título visível fica dentro do
// Suspense: quem não é admin vê "Página não encontrada" sem ver "Administração"
// piscar antes (spec §4.1: não revelar o que existe).
export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminOverview />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["setores", "turnos", "itens", "destinos", "equipe"].map((card) => (
          <Skeleton key={card} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
