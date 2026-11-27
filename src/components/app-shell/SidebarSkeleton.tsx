import { Skeleton } from "@/components/ui/skeleton";

// Ocupa o lugar da barra lateral enquanto a sessão carrega (só no desktop;
// no celular a barra é uma gaveta e não ocupa espaço). Mesma forma da barra
// real: wordmark, o grupo de navegação (5 itens de 48px + gaps + padding =
// 264px) e o card do usuário (68px) colado embaixo.
export function SidebarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="hidden w-(--sidebar-width) shrink-0 flex-col gap-5 bg-sidebar px-4 pt-[22px] pb-4 md:flex"
    >
      <Skeleton className="mx-2 h-7 w-28 rounded-full" />
      <Skeleton className="h-[264px] w-full rounded-[28px]" />
      <Skeleton className="mt-auto h-[68px] w-full rounded-[24px]" />
    </div>
  );
}
