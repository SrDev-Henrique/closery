import type { Metadata } from "next";
import { Suspense } from "react";

import { NewHandover } from "@/components/passagens/NewHandover";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Nova passagem" };

export default function NewHandoverPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewHandover searchParams={props.searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
