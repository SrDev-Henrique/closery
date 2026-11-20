import { Skeleton } from "@/components/ui/skeleton";

// Ocupa o lugar da página enquanto a sessão carrega no layout.
export function PageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}
