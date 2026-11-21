import { Suspense } from "react";

import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { ShiftsAdmin } from "@/components/admin/shifts/ShiftsAdmin";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito (o <title> sairia antes do portão) e com o <h1>
// dentro do Suspense: quem não é admin vê "Página não encontrada" e nada mais.
export default function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShiftsAdmin searchParams={searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <AdminListSkeleton />
    </div>
  );
}
