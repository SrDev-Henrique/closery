import Link from "next/link";

import { Pagination } from "@/components/admin/Pagination";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Page } from "@/features/admin/pagination";
import { formatDateBR, saoPauloParts } from "@/features/handovers/saoPaulo";
import { destinationLabel } from "@/features/requests/text";
import type { RequestListItem } from "@/features/requests/types";
import { REQUESTS_PATH, requestHref } from "@/features/requests/urls";

import { RequestStatusBadge } from "./RequestStatusBadge";
import { StaleBadge } from "./StaleBadge";

// Tabela: lista plana paginada (a Tabela é o arquivo, sem a janela de 30 dias).
// O contêiner do primitivo rola na horizontal sozinho: a página nunca rola.
// O link da descrição é o alvo de toque da linha (44px no celular).
export function RequestTable({
  page,
  showSector,
  pageParams,
}: {
  page: Page<RequestListItem>;
  showSector: boolean;
  pageParams: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableCaption className="sr-only">Solicitações</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            {showSector && <TableHead>Setor</TableHead>}
            <TableHead>Destino</TableHead>
            <TableHead className="text-right">Itens</TableHead>
            <TableHead>Quem criou</TableHead>
            <TableHead className="text-right">Criada em</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Dias no status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-xs whitespace-normal">
                <Link
                  href={requestHref(row.id)}
                  scroll={false}
                  className="inline-flex min-h-9 items-center font-medium underline-offset-4 hover:underline max-md:min-h-11"
                >
                  <span className="line-clamp-2">{row.description}</span>
                </Link>
              </TableCell>
              {showSector && <TableCell>{row.sectorName}</TableCell>}
              <TableCell>
                {destinationLabel(row.destinationName, row.destinationIsOther)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.itemCount}
              </TableCell>
              <TableCell>{row.createdByName}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatDateBR(saoPauloParts(row.createdAt).date)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  <RequestStatusBadge status={row.status} />
                  {row.stale && <StaleBadge days={row.daysInStatus} />}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.daysInStatus}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pathname={REQUESTS_PATH}
        params={pageParams}
      />
    </div>
  );
}
