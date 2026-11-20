import { Skeleton } from "@/components/ui/skeleton";

// Ocupa o lugar da barra lateral enquanto a sessão carrega (só no desktop;
// no celular a barra é uma gaveta e não ocupa espaço).
export function SidebarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="hidden w-(--sidebar-width) shrink-0 flex-col gap-3 border-r bg-sidebar p-4 md:flex"
    >
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
