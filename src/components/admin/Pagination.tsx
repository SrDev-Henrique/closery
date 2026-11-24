import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { buildPageHref } from "@/features/admin/pagination";

export function Pagination({
  page,
  pageCount,
  pathname,
  params,
  param = "pagina",
  label = "Paginação",
}: {
  page: number;
  pageCount: number;
  pathname: string;
  params: Record<string, string | undefined>;
  param?: string;
  // Nome do <nav>: duas paginações na mesma tela (Equipe) precisam de nomes
  // diferentes para o leitor de tela distingui-las.
  label?: string;
}) {
  if (pageCount <= 1) return null;

  const previous =
    page > 1 ? buildPageHref(pathname, params, param, page - 1) : null;
  const next =
    page < pageCount ? buildPageHref(pathname, params, param, page + 1) : null;
  const buttonClass = buttonVariants({ variant: "outline" });

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-2">
      {previous ? (
        <Link href={previous} className={buttonClass}>
          Anterior
        </Link>
      ) : (
        <Button type="button" variant="outline" disabled>
          Anterior
        </Button>
      )}
      <span className="text-sm text-muted-foreground tabular-nums">
        Página {page} de {pageCount}
      </span>
      {next ? (
        <Link href={next} className={buttonClass}>
          Próxima
        </Link>
      ) : (
        <Button type="button" variant="outline" disabled>
          Próxima
        </Button>
      )}
    </nav>
  );
}
