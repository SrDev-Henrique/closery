import { Suspense } from "react";

import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { TeamAdmin } from "@/components/admin/team/TeamAdmin";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito (T12 da Fase 1): o <title> sairia antes do portão.
// O <h1> fica dentro do Suspense, em TeamAdmin, depois de requireAdmin().
export default function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<TeamSkeleton />}>
      <TeamAdmin searchParams={searchParams} />
    </Suspense>
  );
}

function TeamSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <AdminListSkeleton />
    </div>
  );
}
