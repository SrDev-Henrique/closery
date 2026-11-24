import type { Metadata } from "next";
import { Suspense } from "react";

import { HandoverHistory } from "@/components/passagens/HandoverHistory";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Passagens" };

// A leitura da sessão e do banco vive dentro do <Suspense> (Cache Components).
export default function HandoversHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HandoverHistory searchParams={searchParams} />
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
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
