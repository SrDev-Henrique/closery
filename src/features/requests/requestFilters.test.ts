import { describe, expect, it } from "vitest";

import { BOARD_MAX_LIMIT, BOARD_PAGE_SIZE, SEARCH_MAX_LENGTH } from "./limits";
import {
  buildRequestsHref,
  clearFiltersHref,
  closedWindowApplies,
  DELIVERY_PARAMS,
  defaultRequestFilters,
  filtersActive,
  LIMIT_PARAM,
  moreHref,
  parseRequestFilters,
  type RequestFilters,
  resetPaging,
  STATUS_FILTER_PARAM,
  VIEW_PARAM,
  viewHrefs,
} from "./requestFilters";

const TODAY = "2026-11-23";
const DEST = "11111111-1111-4111-8111-111111111111";
const DEST_LETTERS = "abcdefab-abcd-4abc-8abc-abcdefabcdef"; // com letras: só ele tem versão em maiúsculas
const SECTOR = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const ITEM_LETTERS = "abcdefab-abcd-4abc-8abc-abcdefabcdef";

const DEFAULTS = defaultRequestFilters();

// Lê o href de volta como parâmetros de URL (o que o Next entregaria à página).
function paramsOf(href: string): Record<string, string> {
  const query = href.split("?")[1] ?? "";
  return Object.fromEntries(new URLSearchParams(query));
}

describe("defaultRequestFilters", () => {
  it("tudo padrão: visão responsiva, todo o período, limites em 20, página 1", () => {
    expect(DEFAULTS).toEqual({
      view: null,
      destination: null,
      period: "all",
      from: null,
      to: null,
      creatorId: null,
      search: "",
      limits: {
        requested: 20,
        in_transit: 20,
        delivered: 20,
        cancelled: 20,
      },
      page: 1,
      status: "all",
      stale: false,
      delivery: { period: "all", from: null, to: null },
      itemId: null,
    });
  });

  it("cada chamada devolve um objeto novo (nunca compartilha os limites)", () => {
    expect(defaultRequestFilters()).not.toBe(defaultRequestFilters());
    expect(defaultRequestFilters().limits).not.toBe(
      defaultRequestFilters().limits,
    );
  });
});

describe("parseRequestFilters", () => {
  it("sem parâmetros: tudo padrão", () => {
    expect(parseRequestFilters({}, TODAY)).toEqual(DEFAULTS);
  });

  it("lixo em todos os parâmetros nunca lança e cai no padrão", () => {
    const garbage = {
      visao: "<script>",
      destino: "'; drop table request;--",
      periodo: "9999",
      de: "ontem",
      ate: "amanhã",
      criador: "../etc/passwd",
      busca: undefined,
      mais_solicitada: "abc",
      mais_transito: "-5",
      mais_entregue: "1e3",
      mais_cancelada: "",
      pagina: "zero",
    };
    expect(parseRequestFilters(garbage, TODAY)).toEqual(DEFAULTS);
  });

  it("parâmetro repetido vale o primeiro", () => {
    const filters = parseRequestFilters(
      {
        visao: ["lista", "tabela"],
        destino: [DEST, "outro"],
        busca: ["a", "b"],
      },
      TODAY,
    );
    expect(filters.view).toBe("list");
    expect(filters.destination).toBe(DEST);
    expect(filters.search).toBe("a");
    expect(parseRequestFilters({ visao: [] }, TODAY).view).toBeNull();
  });

  describe("visão", () => {
    it.each([
      ["quadro", "board"],
      ["lista", "list"],
      ["tabela", "table"],
    ] as const)("visao=%s → %s", (param, view) => {
      expect(parseRequestFilters({ visao: param }, TODAY).view).toBe(view);
    });

    it.each([
      "QUADRO",
      "board",
      "",
      "kanban",
    ])("visao=%j → padrão responsivo (null)", (param) => {
      expect(parseRequestFilters({ visao: param }, TODAY).view).toBeNull();
    });
  });

  describe("destino", () => {
    it("uuid minúsculo e 'outro' valem", () => {
      expect(
        parseRequestFilters({ destino: DEST_LETTERS }, TODAY).destination,
      ).toBe(DEST_LETTERS);
      expect(parseRequestFilters({ destino: DEST }, TODAY).destination).toBe(
        DEST,
      );
      expect(parseRequestFilters({ destino: "outro" }, TODAY).destination).toBe(
        "outro",
      );
    });

    it.each([
      "OUTRO",
      "Outro",
      DEST_LETTERS.toUpperCase(),
      "11111111-1111-4111-8111",
      `${DEST} `,
      "todos",
      "",
    ])("%j → null", (param) => {
      expect(
        parseRequestFilters({ destino: param }, TODAY).destination,
      ).toBeNull();
    });
  });

  describe("período", () => {
    it("7 dias = hoje − 6 até hoje; 30 dias = hoje − 29 até hoje", () => {
      expect(parseRequestFilters({ periodo: "7" }, TODAY)).toMatchObject({
        period: "7",
        from: "2026-11-17",
        to: TODAY,
      });
      expect(parseRequestFilters({ periodo: "30" }, TODAY)).toMatchObject({
        period: "30",
        from: "2026-10-25",
        to: TODAY,
      });
    });

    it("atravessa a virada do ano", () => {
      expect(parseRequestFilters({ periodo: "7" }, "2026-01-03")).toMatchObject(
        { from: "2025-12-28", to: "2026-01-03" },
      );
    });

    it("ausente ou desconhecido = todo o período, sem datas", () => {
      for (const periodo of [undefined, "", "all", "90", "<x>"]) {
        expect(parseRequestFilters({ periodo }, TODAY)).toMatchObject({
          period: "all",
          from: null,
          to: null,
        });
      }
    });

    describe("intervalo", () => {
      function range(de: string | undefined, ate: string | undefined) {
        return parseRequestFilters({ periodo: "intervalo", de, ate }, TODAY);
      }

      it("de e ate válidos", () => {
        expect(range("2026-11-01", "2026-11-10")).toMatchObject({
          period: "range",
          from: "2026-11-01",
          to: "2026-11-10",
        });
      });

      it("um dia só (de = ate)", () => {
        expect(range("2026-11-10", "2026-11-10")).toMatchObject({
          period: "range",
          from: "2026-11-10",
          to: "2026-11-10",
        });
      });

      it("invertido é trocado", () => {
        expect(range("2026-11-10", "2026-11-01")).toMatchObject({
          period: "range",
          from: "2026-11-01",
          to: "2026-11-10",
        });
      });

      it("ate no futuro é cortado em hoje", () => {
        expect(range("2026-11-01", "2026-12-31")).toMatchObject({
          period: "range",
          from: "2026-11-01",
          to: TODAY,
        });
      });

      it("invertido com um lado no futuro: troca e depois corta", () => {
        expect(range("2026-12-31", "2026-11-01")).toMatchObject({
          period: "range",
          from: "2026-11-01",
          to: TODAY,
        });
      });

      it("hoje inclusive vale", () => {
        expect(range(TODAY, TODAY)).toMatchObject({
          period: "range",
          from: TODAY,
          to: TODAY,
        });
      });

      it("o intervalo todo no futuro cai em todo o período", () => {
        expect(range("2026-12-01", "2026-12-31")).toMatchObject({
          period: "all",
          from: null,
          to: null,
        });
        expect(range("2026-11-24", "2026-11-24").period).toBe("all");
      });

      it("data inválida, inexistente ou ausente cai em todo o período", () => {
        expect(range("2026-02-30", "2026-11-10").period).toBe("all");
        expect(range("2026-11-01", "lixo").period).toBe("all");
        expect(range(undefined, "2026-11-10").period).toBe("all");
        expect(range("2026-11-01", undefined).period).toBe("all");
        expect(range(undefined, undefined).period).toBe("all");
      });

      it("sem teto de extensão: anos de intervalo passam", () => {
        expect(range("2020-01-01", "2026-11-10")).toMatchObject({
          period: "range",
          from: "2020-01-01",
          to: "2026-11-10",
        });
      });

      it("de e ate sem periodo=intervalo são ignorados", () => {
        expect(
          parseRequestFilters({ de: "2026-11-01", ate: "2026-11-10" }, TODAY)
            .period,
        ).toBe("all");
      });
    });
  });

  describe("quem criou", () => {
    it.each(["abc123", "user_1-X", "a".repeat(64)])("%j vale", (id) => {
      expect(parseRequestFilters({ criador: id }, TODAY).creatorId).toBe(id);
    });

    it.each([
      "",
      "com espaço",
      "a".repeat(65),
      "a/b",
      "ação",
      " abc",
    ])("%j → null", (id) => {
      expect(parseRequestFilters({ criador: id }, TODAY).creatorId).toBeNull();
    });
  });

  describe("busca", () => {
    it("normaliza: espaços colapsados, trim", () => {
      expect(
        parseRequestFilters({ busca: "  rede   de\nproteção " }, TODAY).search,
      ).toBe("rede de proteção");
    });

    it("só espaços = sem busca", () => {
      expect(parseRequestFilters({ busca: "   " }, TODAY).search).toBe("");
    });

    it("81 pontos de código com emoji são cortados em 80", () => {
      const search = parseRequestFilters(
        { busca: "🙂".repeat(SEARCH_MAX_LENGTH + 1) },
        TODAY,
      ).search;
      expect(Array.from(search)).toHaveLength(SEARCH_MAX_LENGTH);
    });
  });

  describe("limites do 'Carregar mais'", () => {
    it.each([
      ["0", 20],
      ["19", 20],
      ["20", 20],
      ["39", 20],
      ["40", 40],
      ["45", 40],
      ["199", 180],
      ["200", 200],
      ["999", 200],
      ["99999999999999999999", 200],
      ["abc", 20],
      ["-20", 20],
      ["20.5", 20],
      ["", 20],
    ])("mais_solicitada=%j → %i", (raw, expected) => {
      expect(
        parseRequestFilters({ mais_solicitada: raw }, TODAY).limits.requested,
      ).toBe(expected);
    });

    it("cada status tem o seu parâmetro", () => {
      const filters = parseRequestFilters(
        {
          mais_solicitada: "40",
          mais_transito: "60",
          mais_entregue: "80",
          mais_cancelada: "100",
        },
        TODAY,
      );
      expect(filters.limits).toEqual({
        requested: 40,
        in_transit: 60,
        delivered: 80,
        cancelled: 100,
      });
    });

    it("os nomes dos parâmetros são os do contrato", () => {
      expect(LIMIT_PARAM).toEqual({
        requested: "mais_solicitada",
        in_transit: "mais_transito",
        delivered: "mais_entregue",
        cancelled: "mais_cancelada",
      });
      expect(VIEW_PARAM).toEqual({
        board: "quadro",
        list: "lista",
        table: "tabela",
      });
    });
  });

  describe("página da Tabela", () => {
    it.each([
      ["3", 3],
      ["1", 1],
      ["0", 1],
      ["-2", 1],
      ["1.5", 1],
      ["x", 1],
      ["10001", 1],
    ])("pagina=%j → %i", (raw, expected) => {
      expect(parseRequestFilters({ pagina: raw }, TODAY).page).toBe(expected);
    });
  });
});

describe("buildRequestsHref", () => {
  it("sem nada fora do padrão, só o caminho", () => {
    expect(buildRequestsHref(DEFAULTS)).toBe("/solicitacoes");
  });

  it("omite o padrão e leva só o que foi escolhido, na ordem do contrato", () => {
    const filters: RequestFilters = {
      ...DEFAULTS,
      view: "table",
      destination: DEST,
      period: "7",
      from: "2026-11-17",
      to: TODAY,
      creatorId: "ana",
      search: "rede",
      limits: { ...DEFAULTS.limits, requested: 40 },
      page: 2,
    };
    expect(buildRequestsHref(filters, { sector: SECTOR })).toBe(
      `/solicitacoes?visao=tabela&destino=${DEST}&periodo=7&criador=ana&busca=rede&setor=${SECTOR}&mais_solicitada=40&pagina=2`,
    );
  });

  it("de e ate só no intervalo", () => {
    expect(
      buildRequestsHref({
        ...DEFAULTS,
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
      }),
    ).toBe("/solicitacoes?periodo=intervalo&de=2026-11-01&ate=2026-11-10");
    expect(
      buildRequestsHref({
        ...DEFAULTS,
        period: "30",
        from: "2026-10-25",
        to: TODAY,
      }),
    ).toBe("/solicitacoes?periodo=30");
  });

  it("busca com acento, espaço e & sai codificada e volta igual", () => {
    const href = buildRequestsHref({ ...DEFAULTS, search: "rede & lona 100%" });
    expect(href).not.toContain(" ");
    expect(paramsOf(href).busca).toBe("rede & lona 100%");
  });

  it("setor vazio não entra", () => {
    expect(buildRequestsHref(DEFAULTS, { sector: "" })).toBe("/solicitacoes");
  });

  it("limite 20 e página 1 nunca entram", () => {
    expect(
      buildRequestsHref({ ...DEFAULTS, limits: DEFAULTS.limits, page: 1 }),
    ).toBe("/solicitacoes");
  });
});

describe("ida e volta: parse(build(parse(x))) = parse(x)", () => {
  const CASES: Record<string, string | string[] | undefined>[] = [
    {},
    { visao: "lista" },
    { visao: "quadro", destino: "outro", periodo: "30", busca: "rede" },
    { periodo: "7", criador: "ana", pagina: "3" },
    { periodo: "intervalo", de: "2026-11-10", ate: "2026-11-01" },
    { periodo: "intervalo", de: "2026-12-01", ate: "2026-12-05" },
    { mais_solicitada: "60", mais_cancelada: "200", visao: "lista" },
    { busca: "  Separação   Rápida ", destino: DEST },
    { visao: "x", destino: "y", periodo: "z", pagina: "-1" },
  ];

  it.each(CASES)("%j", (raw) => {
    const parsed = parseRequestFilters(raw, TODAY);
    const href = buildRequestsHref(parsed);
    expect(parseRequestFilters(paramsOf(href), TODAY)).toEqual(parsed);
    // e o href gerado a partir do que voltou é o mesmo (estável)
    expect(buildRequestsHref(parseRequestFilters(paramsOf(href), TODAY))).toBe(
      href,
    );
  });

  it("o padrão não deixa nenhum parâmetro", () => {
    expect(
      buildRequestsHref(
        parseRequestFilters({ visao: "x", pagina: "1" }, TODAY),
      ),
    ).toBe("/solicitacoes");
  });
});

describe("resetPaging", () => {
  it("volta os limites a 20 e a página a 1, sem tocar nos filtros", () => {
    const filters: RequestFilters = {
      ...DEFAULTS,
      destination: "outro",
      search: "rede",
      limits: { requested: 100, in_transit: 40, delivered: 20, cancelled: 200 },
      page: 5,
    };
    expect(resetPaging(filters)).toEqual({
      ...filters,
      limits: DEFAULTS.limits,
      page: 1,
    });
  });

  it("não muta a entrada", () => {
    const filters = { ...DEFAULTS, page: 4 };
    resetPaging(filters);
    expect(filters.page).toBe(4);
  });
});

describe("filtersActive", () => {
  it("só visão, limites e página não contam como filtro", () => {
    expect(filtersActive(DEFAULTS)).toBe(false);
    expect(
      filtersActive({
        ...DEFAULTS,
        view: "table",
        page: 3,
        limits: { ...DEFAULTS.limits, requested: 100 },
      }),
    ).toBe(false);
  });

  it.each([
    ["destino", { destination: DEST }],
    ["destino Outro", { destination: "outro" }],
    ["período", { period: "7", from: "2026-11-17", to: TODAY }],
    ["quem criou", { creatorId: "ana" }],
    ["busca", { search: "rede" }],
  ] as const)("%s conta", (_label, patch) => {
    expect(filtersActive({ ...DEFAULTS, ...patch })).toBe(true);
  });
});

describe("clearFiltersHref", () => {
  it("preserva a visão e o setor", () => {
    expect(clearFiltersHref("list")).toBe("/solicitacoes?visao=lista");
    expect(clearFiltersHref("table", { sector: SECTOR })).toBe(
      `/solicitacoes?visao=tabela&setor=${SECTOR}`,
    );
    expect(clearFiltersHref(null, { sector: "todos" })).toBe(
      "/solicitacoes?setor=todos",
    );
  });

  it("sem visão nem setor, só o caminho", () => {
    expect(clearFiltersHref(null)).toBe("/solicitacoes");
  });
});

describe("moreHref", () => {
  it("soma 20 ao limite do status e mantém o resto (filtros, outros limites, visão, setor)", () => {
    const filters: RequestFilters = {
      ...DEFAULTS,
      view: "board",
      search: "rede",
      limits: { ...DEFAULTS.limits, in_transit: 40 },
    };
    const href = moreHref(filters, "requested", { sector: SECTOR });
    expect(paramsOf(href)).toEqual({
      visao: "quadro",
      busca: "rede",
      setor: SECTOR,
      mais_solicitada: "40",
      mais_transito: "40",
    });
    expect(moreHref(filters, "in_transit")).toContain("mais_transito=60");
  });

  it("para no teto de 200", () => {
    const filters = {
      ...DEFAULTS,
      limits: { ...DEFAULTS.limits, delivered: 190 },
    };
    expect(paramsOf(moreHref(filters, "delivered")).mais_entregue).toBe("200");
    const atMax = {
      ...DEFAULTS,
      limits: { ...DEFAULTS.limits, delivered: BOARD_MAX_LIMIT },
    };
    expect(paramsOf(moreHref(atMax, "delivered")).mais_entregue).toBe("200");
  });

  it("zera a página", () => {
    const href = moreHref({ ...DEFAULTS, page: 4 }, "requested");
    expect(paramsOf(href).pagina).toBeUndefined();
  });

  it("o passo é o do Quadro", () => {
    expect(paramsOf(moreHref(DEFAULTS, "cancelled")).mais_cancelada).toBe(
      String(BOARD_PAGE_SIZE * 2),
    );
  });
});

describe("viewHrefs", () => {
  it("mantém os filtros, troca só a visão e zera a paginação", () => {
    const filters: RequestFilters = {
      ...DEFAULTS,
      view: "table",
      destination: "outro",
      search: "rede",
      limits: { ...DEFAULTS.limits, requested: 60 },
      page: 3,
    };
    const hrefs = viewHrefs(filters, { sector: SECTOR });
    expect(Object.keys(hrefs)).toEqual(["board", "list", "table"]);
    expect(paramsOf(hrefs.board)).toEqual({
      visao: "quadro",
      destino: "outro",
      busca: "rede",
      setor: SECTOR,
    });
    expect(paramsOf(hrefs.list).visao).toBe("lista");
    expect(paramsOf(hrefs.table).visao).toBe("tabela");
  });

  it("sem filtros, só a visão", () => {
    expect(viewHrefs(DEFAULTS)).toEqual({
      board: "/solicitacoes?visao=quadro",
      list: "/solicitacoes?visao=lista",
      table: "/solicitacoes?visao=tabela",
    });
  });
});

describe("filtros novos: status, parada, entrega e item", () => {
  it("os nomes dos parâmetros são os do contrato", () => {
    expect(STATUS_FILTER_PARAM).toEqual({
      open: "abertas",
      not_cancelled: "nao-canceladas",
      requested: "solicitada",
      in_transit: "transito",
      delivered: "entregue",
      cancelled: "cancelada",
    });
    expect(DELIVERY_PARAMS).toEqual({
      period: "entrega",
      from: "entrega_de",
      to: "entrega_ate",
    });
  });

  describe("status", () => {
    it.each([
      ["abertas", "open"],
      ["nao-canceladas", "not_cancelled"],
      ["solicitada", "requested"],
      ["transito", "in_transit"],
      ["entregue", "delivered"],
      ["cancelada", "cancelled"],
    ] as const)("status=%s → %s", (param, status) => {
      expect(parseRequestFilters({ status: param }, TODAY).status).toBe(status);
    });

    it.each([
      "ABERTAS",
      "open",
      "",
      "todas",
      "delivered",
      "'; drop table request;--",
    ])("status=%j cai em todos", (param) => {
      expect(parseRequestFilters({ status: param }, TODAY).status).toBe("all");
    });

    it("repetido vale o primeiro; lista vazia é todos", () => {
      expect(
        parseRequestFilters({ status: ["entregue", "abertas"] }, TODAY).status,
      ).toBe("delivered");
      expect(parseRequestFilters({ status: [] }, TODAY).status).toBe("all");
    });
  });

  describe("parada", () => {
    it("só parada=1 liga", () => {
      expect(parseRequestFilters({ parada: "1" }, TODAY).stale).toBe(true);
    });

    it.each([
      "0",
      "true",
      "",
      "sim",
      "2",
      " 1",
    ])("parada=%j não liga", (param) => {
      expect(parseRequestFilters({ parada: param }, TODAY).stale).toBe(false);
    });
  });

  describe("entrega (mesmas regras do período, outras chaves)", () => {
    const delivery = (params: Record<string, string | undefined>) =>
      parseRequestFilters(params, TODAY).delivery;

    it("sem parâmetro: qualquer data", () => {
      expect(delivery({})).toEqual({ period: "all", from: null, to: null });
    });

    it("7 e 30 dias terminam hoje", () => {
      expect(delivery({ entrega: "7" })).toEqual({
        period: "7",
        from: "2026-11-17",
        to: TODAY,
      });
      expect(delivery({ entrega: "30" })).toEqual({
        period: "30",
        from: "2026-10-25",
        to: TODAY,
      });
    });

    it("intervalo válido", () => {
      expect(
        delivery({
          entrega: "intervalo",
          entrega_de: "2026-11-01",
          entrega_ate: "2026-11-10",
        }),
      ).toEqual({ period: "range", from: "2026-11-01", to: "2026-11-10" });
    });

    it("intervalo de um dia e invertido (trocado)", () => {
      expect(
        delivery({
          entrega: "intervalo",
          entrega_de: "2026-11-05",
          entrega_ate: "2026-11-05",
        }),
      ).toMatchObject({ from: "2026-11-05", to: "2026-11-05" });
      expect(
        delivery({
          entrega: "intervalo",
          entrega_de: "2026-11-10",
          entrega_ate: "2026-11-01",
        }),
      ).toEqual({ period: "range", from: "2026-11-01", to: "2026-11-10" });
    });

    it("entrega_ate no futuro é cortado em hoje; tudo no futuro volta a qualquer data", () => {
      expect(
        delivery({
          entrega: "intervalo",
          entrega_de: "2026-11-20",
          entrega_ate: "2027-01-01",
        }),
      ).toEqual({ period: "range", from: "2026-11-20", to: TODAY });
      expect(
        delivery({
          entrega: "intervalo",
          entrega_de: "2026-12-01",
          entrega_ate: "2026-12-31",
        }),
      ).toEqual({ period: "all", from: null, to: null });
    });

    it("data irreal, ausente ou fora do formato volta a qualquer data", () => {
      for (const params of [
        { entrega: "intervalo", entrega_de: "2026-02-30", entrega_ate: TODAY },
        { entrega: "intervalo", entrega_de: "2026-11-01" },
        { entrega: "intervalo", entrega_ate: "2026-11-01" },
        { entrega: "intervalo", entrega_de: "ontem", entrega_ate: "hoje" },
        { entrega: "9999" },
        { entrega: "" },
      ]) {
        expect(delivery(params)).toEqual({
          period: "all",
          from: null,
          to: null,
        });
      }
    });

    it("de e ate do período de criação não vazam para a entrega (e vice-versa)", () => {
      const filters = parseRequestFilters(
        {
          periodo: "intervalo",
          de: "2026-11-01",
          ate: "2026-11-05",
          entrega: "7",
        },
        TODAY,
      );
      expect(filters.period).toBe("range");
      expect(filters.from).toBe("2026-11-01");
      expect(filters.delivery.period).toBe("7");
      expect(
        parseRequestFilters(
          { entrega_de: "2026-11-01", entrega_ate: "2026-11-05" },
          TODAY,
        ).delivery.period,
      ).toBe("all");
    });
  });

  describe("item", () => {
    it("uuid minúsculo é aceito", () => {
      expect(parseRequestFilters({ item: ITEM }, TODAY).itemId).toBe(ITEM);
    });

    it("maiúsculo, lixo e vazio viram nenhum item", () => {
      for (const item of [
        ITEM_LETTERS.toUpperCase(),
        "abc",
        "",
        "'; drop table item;--",
      ]) {
        expect(parseRequestFilters({ item }, TODAY).itemId).toBeNull();
      }
      expect(parseRequestFilters({ item: ITEM_LETTERS }, TODAY).itemId).toBe(
        ITEM_LETTERS,
      );
    });

    it("repetido vale o primeiro", () => {
      expect(
        parseRequestFilters({ item: [ITEM, ITEM_LETTERS] }, TODAY).itemId,
      ).toBe(ITEM);
    });
  });
});

describe("buildRequestsHref: filtros novos", () => {
  it("status, parada, entrega e item na ordem do contrato, entre o período e o criador", () => {
    const filters: RequestFilters = {
      ...DEFAULTS,
      view: "table",
      destination: DEST,
      period: "7",
      from: "2026-11-17",
      to: TODAY,
      status: "open",
      stale: true,
      delivery: { period: "range", from: "2026-11-01", to: "2026-11-10" },
      itemId: ITEM,
      creatorId: "ana",
      search: "rede",
      limits: { ...DEFAULTS.limits, requested: 40 },
      page: 2,
    };
    expect(buildRequestsHref(filters, { sector: "todos" })).toBe(
      `/solicitacoes?visao=tabela&destino=${DEST}&periodo=7&status=abertas&parada=1&entrega=intervalo&entrega_de=2026-11-01&entrega_ate=2026-11-10&item=${ITEM}&criador=ana&busca=rede&setor=todos&mais_solicitada=40&pagina=2`,
    );
  });

  it("o padrão não vira parâmetro", () => {
    expect(buildRequestsHref(DEFAULTS)).toBe("/solicitacoes");
    expect(
      buildRequestsHref({ ...DEFAULTS, status: "all", stale: false }),
    ).toBe("/solicitacoes");
  });

  it("entrega 7 e 30 só levam o preset (sem de e ate)", () => {
    const delivery7 = { period: "7", from: "2026-11-17", to: TODAY } as const;
    expect(buildRequestsHref({ ...DEFAULTS, delivery: delivery7 })).toBe(
      "/solicitacoes?entrega=7",
    );
    expect(
      buildRequestsHref({
        ...DEFAULTS,
        delivery: { period: "30", from: "2026-10-25", to: TODAY },
      }),
    ).toBe("/solicitacoes?entrega=30");
  });

  it.each([
    ["abertas", "open"],
    ["nao-canceladas", "not_cancelled"],
    ["solicitada", "requested"],
    ["transito", "in_transit"],
    ["entregue", "delivered"],
    ["cancelada", "cancelled"],
  ] as const)("status %s", (param, status) => {
    expect(buildRequestsHref({ ...DEFAULTS, status })).toBe(
      `/solicitacoes?status=${param}`,
    );
  });

  it("ida e volta estável: parse → build → parse dá o mesmo filtro", () => {
    const hrefs = [
      "/solicitacoes?visao=tabela&status=abertas",
      "/solicitacoes?visao=tabela&parada=1",
      "/solicitacoes?visao=tabela&entrega=7",
      "/solicitacoes?visao=tabela&entrega=intervalo&entrega_de=2026-11-01&entrega_ate=2026-11-10",
      `/solicitacoes?visao=tabela&destino=outro&entrega=30&item=${ITEM}`,
      `/solicitacoes?visao=tabela&periodo=7&status=nao-canceladas&item=${ITEM}`,
      `/solicitacoes?status=entregue&item=${ITEM_LETTERS}&setor=${SECTOR}`,
    ];
    for (const href of hrefs) {
      const filters = parseRequestFilters(paramsOf(href), TODAY);
      const extras = paramsOf(href).setor ? { sector: SECTOR } : {};
      expect(buildRequestsHref(filters, extras)).toBe(href);
      expect(
        parseRequestFilters(paramsOf(buildRequestsHref(filters)), TODAY),
      ).toEqual(filters);
    }
  });
});

describe("filtros novos: filtersActive, clearFiltersHref, resetPaging", () => {
  it.each([
    ["status", { status: "open" }],
    ["parada", { stale: true }],
    ["entrega", { delivery: { period: "7", from: "2026-11-17", to: TODAY } }],
    ["item", { itemId: ITEM }],
  ] as const)("%s conta como filtro", (_label, patch) => {
    expect(filtersActive({ ...DEFAULTS, ...patch })).toBe(true);
  });

  it("Limpar filtros zera os novos e mantém a visão e o setor", () => {
    expect(clearFiltersHref("table", { sector: SECTOR })).toBe(
      `/solicitacoes?visao=tabela&setor=${SECTOR}`,
    );
  });

  it("resetPaging mantém os filtros novos", () => {
    const filters: RequestFilters = {
      ...DEFAULTS,
      status: "open",
      stale: true,
      delivery: { period: "30", from: "2026-10-25", to: TODAY },
      itemId: ITEM,
      page: 4,
    };
    expect(resetPaging(filters)).toEqual({ ...filters, page: 1 });
  });
});

describe("closedWindowApplies", () => {
  it("a janela de 30 dias só vale sem filtro de tempo", () => {
    expect(closedWindowApplies(DEFAULTS)).toBe(true);
    expect(
      closedWindowApplies({
        ...DEFAULTS,
        period: "7",
        from: "2026-11-17",
        to: TODAY,
      }),
    ).toBe(false);
    expect(
      closedWindowApplies({
        ...DEFAULTS,
        delivery: { period: "7", from: "2026-11-17", to: TODAY },
      }),
    ).toBe(false);
  });

  it("status, parada e item não tiram a janela", () => {
    expect(
      closedWindowApplies({
        ...DEFAULTS,
        status: "delivered",
        stale: true,
        itemId: ITEM,
      }),
    ).toBe(true);
  });
});
