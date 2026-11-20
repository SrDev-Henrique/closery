import type { Metadata } from "next";
import { Suspense } from "react";

import { Greeting } from "@/components/app-shell/Greeting";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Início" };

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Greeting />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-80 max-w-full" />
    </div>
  );
}
