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
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}
