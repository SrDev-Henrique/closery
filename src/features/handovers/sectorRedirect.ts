import {
  buildRequestsHref,
  parseRequestFilters,
  resetPaging,
} from "@/features/requests/requestFilters";
import { queryRecord } from "@/lib/searchParams";

import { buildHistoryHref, parseHistoryFilters } from "./historyFilters";
import { chooseSectorPath, type SectorPickerPath } from "./urls";

/**
 * Para onde a escolha de setor do admin navega (P45). O `query` vem do
 * cliente e **nunca** é usado como veio: é reinterpretado pelo mesmo parse da
 * tela (que nunca lança e só devolve valores válidos) e o href é remontado com
 * o setor novo. Caem o que é do setor antigo (o turno, o criador) e a
 * paginação; período, situação, visão, destino e busca seguem. `/` e
 * `/passagens/nova` ignoram o query: o turno e o dia são do setor antigo.
 * Sem query o destino é o de sempre (`chooseSectorPath`).
 */
export function sectorRedirectHref(
  path: SectorPickerPath,
  sectorId: string,
  query: string,
  today: string,
): string {
  // O setor de dentro do query é o antigo: quem vale é o escolhido.
  const params = Object.fromEntries(
    Object.entries(queryRecord(query)).filter(([key]) => key !== "setor"),
  );
  switch (path) {
    case "/":
    case "/passagens/nova":
      return chooseSectorPath(path, sectorId);
    case "/passagens":
      return buildHistoryHref(
        { ...parseHistoryFilters(params, today), shiftId: null },
        { sector: sectorId },
      );
    case "/solicitacoes":
      return buildRequestsHref(
        {
          ...resetPaging(parseRequestFilters(params, today)),
          creatorId: null,
        },
        { sector: sectorId },
      );
  }
}
