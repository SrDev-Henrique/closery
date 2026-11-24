import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto com o formato do detalhe (título, propriedades, itens, comentários).
export function RequestDetailSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-64 max-w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
