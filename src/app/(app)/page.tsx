import type { Metadata } from "next";
import { Suspense } from "react";

import { Greeting } from "@/components/app-shell/Greeting";
import { HomeHandovers } from "@/components/passagens/HomeHandovers";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Início" };

export default function HomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<HandoversSkeleton />}>
        <HomeHandovers searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function GreetingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-80 max-w-full" />
    </div>
  );
}

function HandoversSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
