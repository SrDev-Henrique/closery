import { Skeleton } from "@/components/ui/skeleton";

export function AdminListSkeleton({ rows = 4 }: { rows?: number }) {
  const keys = Array.from({ length: rows }, (_, index) => `linha-${index}`);

  return (
    <ul
      aria-busy="true"
      aria-label="Carregando"
      className="flex flex-col gap-2"
    >
      {keys.map((key) => (
        <li key={key}>
          <Skeleton className="h-16 w-full" />
        </li>
      ))}
    </ul>
  );
}
