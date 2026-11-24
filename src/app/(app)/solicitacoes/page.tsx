import type { Metadata } from "next";
import { Suspense } from "react";

import { RequestsScreen } from "@/components/solicitacoes/RequestsScreen";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Solicitações" };

// A leitura da sessão e do banco vive dentro do <Suspense> (Cache Components).
export default function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequestsScreen searchParams={searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-10 w-72 max-w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
