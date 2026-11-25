import { Skeleton } from "@/components/ui/skeleton";

// Carregando é esqueleto, nunca zero: o título do bloco já aparece e a forma
// dele fica reservada.
export function DashboardBlockSkeleton({ title }: { title: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={title}
      className="flex flex-col gap-4"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>
      <Skeleton className="h-11 w-80 max-w-full" />
      <DashboardBlockSkeleton title="Passagens" />
      <DashboardBlockSkeleton title="Controles" />
      <DashboardBlockSkeleton title="Estoque" />
      <DashboardBlockSkeleton title="Solicitações" />
    </div>
  );
}
