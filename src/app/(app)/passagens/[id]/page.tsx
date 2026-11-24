import type { Metadata } from "next";
import { Suspense } from "react";

import { HandoverDetail } from "@/components/passagens/HandoverDetail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Passagem" };

type HandoverPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// params e searchParams são dinâmicos: só se leem dentro do <Suspense>. A
// validação do id (uuid) e o 404 de passagem inexistente ou de outro setor
// ficam no HandoverDetail.
export default function HandoverPage({
  params,
  searchParams,
}: HandoverPageProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HandoverContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function HandoverContent({ params, searchParams }: HandoverPageProps) {
  const { id } = await params;
  return <HandoverDetail id={id} searchParams={searchParams} />;
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-80 max-w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
