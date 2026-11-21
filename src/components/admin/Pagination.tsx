import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { buildPageHref } from "@/features/admin/pagination";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  pathname,
  params,
  param = "pagina",
}: {
  page: number;
  pageCount: number;
  pathname: string;
  params: Record<string, string | undefined>;
  param?: string;
}) {
  if (pageCount <= 1) return null;

  const previous =
    page > 1 ? buildPageHref(pathname, params, param, page - 1) : null;
  const next =
    page < pageCount ? buildPageHref(pathname, params, param, page + 1) : null;
  const buttonClass = buttonVariants({ variant: "outline" });

  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between gap-2"
    >
      {previous ? (
        <Link href={previous} className={buttonClass}>
          Anterior
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(buttonClass, "pointer-events-none opacity-50")}
        >
          Anterior
        </span>
      )}
      <span className="text-sm text-muted-foreground tabular-nums">
        Página {page} de {pageCount}
      </span>
      {next ? (
        <Link href={next} className={buttonClass}>
          Próxima
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(buttonClass, "pointer-events-none opacity-50")}
        >
          Próxima
        </span>
      )}
    </nav>
  );
}
