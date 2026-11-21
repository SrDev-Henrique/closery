import { Suspense } from "react";

import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { SectorsAdmin } from "@/components/admin/sectors/SectorsAdmin";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito (o <title> sairia antes do portão) e com o <h1>
// dentro do Suspense: o operador vê "Página não encontrada" sem ver "Setores".
export default function SetoresPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SectorsAdmin searchParams={props.searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
      <AdminListSkeleton />
    </div>
  );
}
