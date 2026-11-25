import { describe, expect, it } from "vitest";

import { sectorRedirectHref } from "./sectorRedirect";
import { chooseSectorPath, SECTOR_PICKER_PATHS } from "./urls";

const TODAY = "2026-11-21";
const OLD = "11111111-1111-4111-8111-111111111111";
const NEW = "22222222-2222-4222-8222-222222222222";
const SHIFT = "33333333-3333-4333-8333-333333333333";
const DESTINATION = "44444444-4444-4444-8444-444444444444";

function href(path: (typeof SECTOR_PICKER_PATHS)[number], query: string) {
  return sectorRedirectHref(path, NEW, query, TODAY);
}

describe("sectorRedirectHref", () => {
  describe("/passagens", () => {
    it("mantém período e situação, tira o turno e a página e põe o setor novo", () => {
      expect(
        href(
          "/passagens",
          `periodo=30&turno=${SHIFT}&situacao=aguardando&pagina=3&setor=${OLD}`,
        ),
      ).toBe(`/passagens?periodo=30&situacao=aguardando&setor=${NEW}`);
    });

    it("mantém o intervalo (de e ate)", () => {
      expect(
        href("/passagens", "periodo=intervalo&de=2026-11-01&ate=2026-11-10"),
      ).toBe(
        `/passagens?periodo=intervalo&de=2026-11-01&ate=2026-11-10&setor=${NEW}`,
      );
    });

    it("lixo vira o padrão: nunca copia o que não passa no parse", () => {
      expect(
        href(
          "/passagens",
          "periodo=xx&situacao=lixo&turno=nao-e-uuid&de=abc&foo=bar",
        ),
      ).toBe(`/passagens?setor=${NEW}`);
      expect(
        href("/passagens", "periodo=intervalo&de=2026-11-30&ate=2026-12-31"),
      ).toBe(`/passagens?setor=${NEW}`);
    });

    it("o intervalo de mais de 93 dias sai encurtado, como na tela", () => {
      expect(
        href("/passagens", "periodo=intervalo&de=2026-08-20&ate=2026-11-21"),
      ).toBe(
        `/passagens?periodo=intervalo&de=2026-08-21&ate=2026-11-21&setor=${NEW}`,
      );
    });

    it("o setor de dentro do query é ignorado: o novo vence (inclusive 'todos')", () => {
      expect(href("/passagens", `setor=${OLD}`)).toBe(
        `/passagens?setor=${NEW}`,
      );
      expect(
        sectorRedirectHref("/passagens", "todos", `setor=${OLD}`, TODAY),
      ).toBe("/passagens?setor=todos");
    });

    it("aceita o ? inicial e parâmetro repetido vale o primeiro", () => {
      expect(href("/passagens", "?periodo=30&periodo=7")).toBe(
        `/passagens?periodo=30&setor=${NEW}`,
      );
    });
  });

  describe("/solicitacoes", () => {
    it("mantém visão, destino, período e busca; tira o criador, o 'mais' e a página", () => {
      expect(
        href(
          "/solicitacoes",
          `visao=tabela&destino=outro&periodo=7&criador=user-1&busca=rede&mais_solicitada=40&pagina=2&setor=${OLD}`,
        ),
      ).toBe(
        `/solicitacoes?visao=tabela&destino=outro&periodo=7&busca=rede&setor=${NEW}`,
      );
    });

    it("mantém o destino por id e o intervalo", () => {
      expect(
        href(
          "/solicitacoes",
          `destino=${DESTINATION}&periodo=intervalo&de=2026-11-01&ate=2026-11-10`,
        ),
      ).toBe(
        `/solicitacoes?destino=${DESTINATION}&periodo=intervalo&de=2026-11-01&ate=2026-11-10&setor=${NEW}`,
      );
    });

    it("lixo vira o padrão", () => {
      expect(
        href(
          "/solicitacoes",
          "visao=xx&destino=nao-e-uuid&periodo=99&busca=&mais_solicitada=abc&foo=bar",
        ),
      ).toBe(`/solicitacoes?setor=${NEW}`);
    });

    it("o setor de dentro do query é ignorado e o parâmetro repetido vale o primeiro", () => {
      expect(
        href("/solicitacoes", `setor=${OLD}&visao=lista&visao=quadro`),
      ).toBe(`/solicitacoes?visao=lista&setor=${NEW}`);
    });
  });

  describe("caminhos sem filtros do setor", () => {
    it.each([
      "/",
      "/passagens/nova",
    ] as const)("%s ignora o query (turno e dia são do setor antigo)", (path) => {
      expect(href(path, `turno=${SHIFT}&data=2026-11-20&periodo=30`)).toBe(
        `${path}?setor=${NEW}`,
      );
    });
  });

  describe("query vazio: o mesmo destino de sempre", () => {
    it.each(SECTOR_PICKER_PATHS)("%s", (path) => {
      expect(href(path, "")).toBe(`${path}?setor=${NEW}`);
      expect(sectorRedirectHref(path, "todos", "", TODAY)).toBe(
        `${path}?setor=todos`,
      );
    });
  });

  it("o período relativo é o de hoje: 30 dias não carrega datas velhas", () => {
    expect(
      sectorRedirectHref("/passagens", NEW, "periodo=30", "2026-12-05"),
    ).toBe(`/passagens?periodo=30&setor=${NEW}`);
  });
});

describe("sectorRedirectHref: /solicitacoes e os filtros novos", () => {
  const hoje = "2026-11-23";
  const setorNovo = "22222222-2222-4222-8222-222222222222";
  const setorAntigo = "11111111-1111-4111-8111-111111111111";
  const itemId = "33333333-3333-4333-8333-333333333333";

  it("o item cai com o setor antigo; status, parada e entrega ficam", () => {
    const query = `visao=tabela&status=abertas&parada=1&entrega=intervalo&entrega_de=2026-11-01&entrega_ate=2026-11-10&item=${itemId}&criador=ana&pagina=3&setor=${setorAntigo}`;

    expect(sectorRedirectHref("/solicitacoes", setorNovo, query, hoje)).toBe(
      `/solicitacoes?visao=tabela&status=abertas&parada=1&entrega=intervalo&entrega_de=2026-11-01&entrega_ate=2026-11-10&setor=${setorNovo}`,
    );
  });

  it("só o item: sobra o setor novo", () => {
    expect(
      sectorRedirectHref("/solicitacoes", setorNovo, `item=${itemId}`, hoje),
    ).toBe(`/solicitacoes?setor=${setorNovo}`);
  });

  it("lixo nos filtros novos cai no padrão (o parse nunca lança)", () => {
    expect(
      sectorRedirectHref(
        "/solicitacoes",
        setorNovo,
        "status=%3Cscript%3E&parada=sim&entrega=9999&item=abc",
        hoje,
      ),
    ).toBe(`/solicitacoes?setor=${setorNovo}`);
  });

  it("nao-canceladas e entrega de 30 dias sobrevivem à troca de setor", () => {
    expect(
      sectorRedirectHref(
        "/solicitacoes",
        setorNovo,
        "status=nao-canceladas&entrega=30",
        hoje,
      ),
    ).toBe(`/solicitacoes?status=nao-canceladas&entrega=30&setor=${setorNovo}`);
  });
});

describe("sectorRedirectHref: /passagens e o item", () => {
  const hoje = "2026-11-23";
  const setorNovo = "22222222-2222-4222-8222-222222222222";
  const setorAntigo = "11111111-1111-4111-8111-111111111111";
  const itemId = "33333333-3333-4333-8333-333333333333";
  const turnoId = "55555555-5555-4555-8555-555555555555";

  it("o item cai junto com o turno; período e situação ficam", () => {
    const query = `periodo=intervalo&de=2026-11-01&ate=2026-11-10&turno=${turnoId}&situacao=entregues&item=${itemId}&pagina=3&setor=${setorAntigo}`;

    expect(sectorRedirectHref("/passagens", setorNovo, query, hoje)).toBe(
      `/passagens?periodo=intervalo&de=2026-11-01&ate=2026-11-10&situacao=entregues&setor=${setorNovo}`,
    );
  });

  it("só o item: sobra o setor novo", () => {
    expect(
      sectorRedirectHref("/passagens", setorNovo, `item=${itemId}`, hoje),
    ).toBe(`/passagens?setor=${setorNovo}`);
  });

  it("situação esperadas fica e lixo no item cai", () => {
    expect(
      sectorRedirectHref(
        "/passagens",
        setorNovo,
        "situacao=esperadas&item=abc",
        hoje,
      ),
    ).toBe(`/passagens?situacao=esperadas&setor=${setorNovo}`);
  });
});

describe("sectorRedirectHref (Tarefa 12): /dashboard", () => {
  const NEW_SECTOR = "22222222-2222-4222-8222-222222222222";
  const OLD_SECTOR = "11111111-1111-4111-8111-111111111111";
  const TODAY = "2026-11-20";

  it("query vazia dá o mesmo destino de chooseSectorPath", () => {
    expect(sectorRedirectHref("/dashboard", NEW_SECTOR, "", TODAY)).toBe(
      chooseSectorPath("/dashboard", NEW_SECTOR),
    );
  });

  it("mantém o período 30 e põe o setor novo; o setor antigo e o resto caem", () => {
    expect(
      sectorRedirectHref(
        "/dashboard",
        NEW_SECTOR,
        `periodo=30&setor=${OLD_SECTOR}&turno=x&pagina=2`,
        TODAY,
      ),
    ).toBe(`/dashboard?periodo=30&setor=${NEW_SECTOR}`);
  });

  it("mantém um intervalo válido (o '?' inicial é aceito)", () => {
    expect(
      sectorRedirectHref(
        "/dashboard",
        NEW_SECTOR,
        "?periodo=intervalo&de=2026-11-01&ate=2026-11-05",
        TODAY,
      ),
    ).toBe(
      `/dashboard?periodo=intervalo&de=2026-11-01&ate=2026-11-05&setor=${NEW_SECTOR}`,
    );
  });

  it("intervalo inválido, lixo e período no futuro caem nos últimos 7 dias", () => {
    for (const query of [
      "periodo=intervalo&de=2026-02-30&ate=2026-11-05",
      "periodo=lixo",
      "periodo=intervalo&de=2026-12-01&ate=2026-12-05",
    ]) {
      expect(sectorRedirectHref("/dashboard", NEW_SECTOR, query, TODAY)).toBe(
        `/dashboard?setor=${NEW_SECTOR}`,
      );
    }
  });

  it("intervalo invertido é trocado e 'ate' futuro é cortado em hoje", () => {
    expect(
      sectorRedirectHref(
        "/dashboard",
        NEW_SECTOR,
        "periodo=intervalo&de=2026-11-05&ate=2026-11-01",
        TODAY,
      ),
    ).toBe(
      `/dashboard?periodo=intervalo&de=2026-11-01&ate=2026-11-05&setor=${NEW_SECTOR}`,
    );
    expect(
      sectorRedirectHref(
        "/dashboard",
        NEW_SECTOR,
        "periodo=intervalo&de=2026-11-15&ate=2026-12-31",
        TODAY,
      ),
    ).toBe(
      `/dashboard?periodo=intervalo&de=2026-11-15&ate=2026-11-20&setor=${NEW_SECTOR}`,
    );
  });

  it("'todos' como setor novo é aceito e o parâmetro repetido vale o primeiro", () => {
    expect(
      sectorRedirectHref("/dashboard", "todos", "periodo=30&periodo=7", TODAY),
    ).toBe("/dashboard?periodo=30&setor=todos");
  });
});
