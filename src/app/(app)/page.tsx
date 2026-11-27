import type { Metadata } from "next";
import { Suspense } from "react";

import { Greeting } from "@/components/app-shell/Greeting";
import { HomeHandovers } from "@/components/passagens/HomeHandovers";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Início" };

export default function HomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sem gap: o espaçamento do hero é do próprio conteúdo (Greeting e a linha do
  // HomeHandovers), igual ao padding da `section` do protótipo.
  return (
    <div className="flex flex-col">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<HandoversSkeleton />}>
        <HomeHandovers searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

// Mesma geometria do Greeting: 28px de topo (12 no celular), eyebrow de 14px,
// 14px de gap e o título (72px × .95 ≈ 68px; 44px × .95 ≈ 42px no celular).
function GreetingSkeleton() {
  return (
    <div className="flex flex-col gap-3.5 pt-7 max-md:pt-3">
      <Skeleton className="h-3.5 w-56 max-w-full" />
      <Skeleton className="h-[68px] w-80 max-w-full rounded-2xl max-md:h-[42px]" />
    </div>
  );
}

// A linha do hero (seletor de 48px) e os cartões de raio 32 no grid do Início
// (1 coluna; 1.3fr/1fr com área útil de 1040px ou mais).
function HandoversSkeleton() {
  return (
    <>
      <div
        data-slot="skeleton-hero-row"
        className="pt-8 pb-10 max-md:pt-6 max-md:pb-7"
      >
        <Skeleton className="h-12 w-[480px] max-w-full rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 @min-[1040px]/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-[32px] bg-card" />
        <Skeleton className="h-72 rounded-[32px] bg-card" />
      </div>
    </>
  );
}
