import { describe, expect, it } from "vitest";

import {
  type HistorySituationFilter,
  parseHistoryFilters,
  parseHistoryPeriod,
} from "@/features/handovers/historyFilters";
import { parseRequestFilters } from "@/features/requests/requestFilters";

import {
  deliveredRequestsHref,
  destinationDeliveriesHref,
  lastCountHref,
  linkExtras,
  openRequestsHref,
  passagesListHref,
  requestedItemHref,
  staleRequestsHref,
  toRequestPeriod,
} from "./links";

const TODAY = "2026-11-20";
const SEVEN = parseHistoryPeriod({}, TODAY);
const THIRTY = parseHistoryPeriod({ periodo: "30" }, TODAY);
const RANGE = parseHistoryPeriod(
  { periodo: "intervalo", de: "2026-11-01", ate: "2026-11-10" },
  TODAY,
);
const PERIODS = [SEVEN, THIRTY, RANGE];

const SECTOR = "11111111-1111-4111-8111-111111111111";
const SHIFT = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const DESTINATION = "44444444-4444-4444-8444-444444444444";

// Lê o href de volta como a página o receberia (searchParams).
function paramsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "http://closery.local").searchParams);
}

describe("linkExtras", () => {
  it("operador (sem setor na URL) não leva setor", () => {
    expect(linkExtras(null)).toEqual({});
  });

  it("admin leva o que escolheu: um setor ou todos", () => {
    expect(linkExtras(SECTOR)).toEqual({ sector: SECTOR });
    expect(linkExtras("todos")).toEqual({ sector: "todos" });
  });
});

describe("passagesListHref", () => {
  it("o período 7 não vira parâmetro; 30 e intervalo sim", () => {
    expect(passagesListHref(SEVEN, "delivered")).toBe(
      "/passagens?situacao=entregues",
    );
    expect(passagesListHref(THIRTY, "expected")).toBe(
      "/passagens?periodo=30&situacao=esperadas",
    );
    expect(passagesListHref(RANGE, "confirmed")).toBe(
      "/passagens?periodo=intervalo&de=2026-11-01&ate=2026-11-10&situacao=confirmada",
    );
  });

  it("cada situação do anel tem o parâmetro do selo da lista", () => {
    expect(passagesListHref(SEVEN, "awaiting")).toBe(
      "/passagens?situacao=aguardando",
    );
    expect(passagesListHref(SEVEN, "unconfirmed")).toBe(
      "/passagens?situacao=nao-confirmada",
    );
    expect(passagesListHref(SEVEN, "missing")).toBe(
      "/passagens?situacao=sem-passagem",
    );
  });

  it("Controles: situação entregues + item + setor do item; o segmento leva também o turno", () => {
    expect(
      passagesListHref(SEVEN, "delivered", { sector: SECTOR, itemId: ITEM }),
    ).toBe(`/passagens?situacao=entregues&item=${ITEM}&setor=${SECTOR}`);
    expect(
      passagesListHref(THIRTY, "delivered", {
        sector: SECTOR,
        itemId: ITEM,
        shiftId: SHIFT,
      }),
    ).toBe(
      `/passagens?periodo=30&turno=${SHIFT}&situacao=entregues&item=${ITEM}&setor=${SECTOR}`,
    );
  });

  it("o setor 'todos' do admin também vai (as Passagens, não os Controles)", () => {
    expect(passagesListHref(SEVEN, "missing", linkExtras("todos"))).toBe(
      "/passagens?situacao=sem-passagem&setor=todos",
    );
  });

  it("cada href relido pelo parse da lista dá exatamente o filtro pretendido", () => {
    const situations: HistorySituationFilter[] = [
      "delivered",
      "expected",
      "confirmed",
      "awaiting",
      "unconfirmed",
      "missing",
    ];
    for (const period of PERIODS) {
      for (const situation of situations) {
        for (const extras of [
          {},
          { sector: SECTOR },
          { sector: SECTOR, itemId: ITEM },
          { sector: SECTOR, itemId: ITEM, shiftId: SHIFT },
        ]) {
          const href = passagesListHref(period, situation, extras);
          expect(parseHistoryFilters(paramsOf(href), TODAY), href).toEqual({
            ...period,
            shiftId: "shiftId" in extras ? extras.shiftId : null,
            situation,
            itemId: "itemId" in extras ? extras.itemId : null,
          });
        }
      }
    }
  });
});

describe("lastCountHref", () => {
  it("abre a passagem da última contagem", () => {
    expect(lastCountHref(ITEM)).toBe(`/passagens/${ITEM}`);
  });
});

describe("toRequestPeriod", () => {
  it("7 e 30 dias mantêm o preset e as datas; intervalo vira range", () => {
    expect(toRequestPeriod(SEVEN)).toEqual({
      period: "7",
      from: "2026-11-14",
      to: TODAY,
    });
    expect(toRequestPeriod(THIRTY)).toEqual({
      period: "30",
      from: "2026-10-22",
      to: TODAY,
    });
    expect(toRequestPeriod(RANGE)).toEqual({
      period: "range",
      from: "2026-11-01",
      to: "2026-11-10",
    });
  });
});

describe("links de solicitações (sempre a Tabela)", () => {
  it("abertas agora e paradas agora", () => {
    expect(openRequestsHref()).toBe(
      "/solicitacoes?visao=tabela&status=abertas",
    );
    expect(staleRequestsHref()).toBe("/solicitacoes?visao=tabela&parada=1");
    expect(openRequestsHref({ sector: "todos" })).toBe(
      "/solicitacoes?visao=tabela&status=abertas&setor=todos",
    );
    expect(staleRequestsHref({ sector: SECTOR })).toBe(
      `/solicitacoes?visao=tabela&parada=1&setor=${SECTOR}`,
    );
  });

  it("entregues no período: entrega=7, 30 ou intervalo", () => {
    expect(deliveredRequestsHref(SEVEN)).toBe(
      "/solicitacoes?visao=tabela&entrega=7",
    );
    expect(deliveredRequestsHref(THIRTY)).toBe(
      "/solicitacoes?visao=tabela&entrega=30",
    );
    expect(deliveredRequestsHref(RANGE, { sector: SECTOR })).toBe(
      `/solicitacoes?visao=tabela&entrega=intervalo&entrega_de=2026-11-01&entrega_ate=2026-11-10&setor=${SECTOR}`,
    );
  });

  it("destino: o uuid dele ou 'outro', junto com a entrega", () => {
    expect(destinationDeliveriesHref(SEVEN, DESTINATION)).toBe(
      `/solicitacoes?visao=tabela&destino=${DESTINATION}&entrega=7`,
    );
    expect(
      destinationDeliveriesHref(THIRTY, "outro", { sector: "todos" }),
    ).toBe("/solicitacoes?visao=tabela&destino=outro&entrega=30&setor=todos");
  });

  it("item pedido: criadas no período, sem as canceladas, só o item", () => {
    expect(requestedItemHref(SEVEN, ITEM)).toBe(
      `/solicitacoes?visao=tabela&periodo=7&status=nao-canceladas&item=${ITEM}`,
    );
    expect(requestedItemHref(RANGE, ITEM, { sector: SECTOR })).toBe(
      `/solicitacoes?visao=tabela&periodo=intervalo&de=2026-11-01&ate=2026-11-10&status=nao-canceladas&item=${ITEM}&setor=${SECTOR}`,
    );
  });

  it("cada href relido pelo parse da lista dá exatamente o filtro pretendido", () => {
    for (const period of PERIODS) {
      const request = toRequestPeriod(period);

      const open = parseRequestFilters(paramsOf(openRequestsHref()), TODAY);
      expect(open).toMatchObject({
        view: "table",
        status: "open",
        stale: false,
      });
      expect(open.period).toBe("all");

      const stale = parseRequestFilters(paramsOf(staleRequestsHref()), TODAY);
      expect(stale).toMatchObject({
        view: "table",
        status: "all",
        stale: true,
      });

      const delivered = parseRequestFilters(
        paramsOf(deliveredRequestsHref(period)),
        TODAY,
      );
      expect(delivered.delivery).toEqual(request);
      expect(delivered).toMatchObject({ view: "table", period: "all" });

      for (const key of [DESTINATION, "outro"]) {
        const byDestination = parseRequestFilters(
          paramsOf(destinationDeliveriesHref(period, key)),
          TODAY,
        );
        expect(byDestination.destination).toBe(key);
        expect(byDestination.delivery).toEqual(request);
      }

      const byItem = parseRequestFilters(
        paramsOf(requestedItemHref(period, ITEM)),
        TODAY,
      );
      expect(byItem).toMatchObject({
        view: "table",
        status: "not_cancelled",
        itemId: ITEM,
        period: request.period,
        from: request.from,
        to: request.to,
      });
      expect(byItem.delivery.period).toBe("all");
    }
  });
});
