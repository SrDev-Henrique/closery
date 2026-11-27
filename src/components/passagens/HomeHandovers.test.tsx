import type { PGlite } from "@electric-sql/pglite";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertDestination,
  insertHandover,
  insertRequest,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { HomeHandovers } from "./HomeHandovers";

const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    cookie: { value: string | undefined };
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    cookie: { value: undefined },
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "closery_setor" && mocks.cookie.value !== undefined
        ? { name, value: mocks.cookie.value }
        : undefined,
  }),
}));
vi.mock("@/app/(app)/actions", () => ({ chooseSectorAction: vi.fn() }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const TODAY = "2026-11-20";

async function renderHome(search: Record<string, string> = {}) {
  render(await HomeHandovers({ searchParams: Promise.resolve(search) }));
}

async function setup() {
  const uld = await insertSector(db, "ULD");
  const shiftRow = await insertShift(db, {
    sectorId: uld.id,
    name: "Turno Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  return { uld, shiftRow, ana, bia };
}

describe("HomeHandovers", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.cookie.value = undefined;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(spDate(TODAY, "10:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sem sessão, propaga o redirect do requireUser", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    mocks.requireUser.mockRejectedValue(redirectError);

    await expect(
      HomeHandovers({ searchParams: Promise.resolve({}) }),
    ).rejects.toBe(redirectError);
  });

  describe("hero (linha do seletor/pílula e do dashboard)", () => {
    it("operador: pílula do setor (só leitura) e o botão 'Ver o dashboard'", async () => {
      const { uld, ana } = await setup();
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
      );

      await renderHome();

      const row = document.querySelector('[data-slot="home-hero-row"]');
      const pill = row?.querySelector('[data-slot="sector-pill"]');
      expect(pill).toHaveTextContent("Setor");
      expect(pill).toHaveTextContent("ULD");
      expect(
        screen.queryByRole("radiogroup", { name: "Setor" }),
      ).not.toBeInTheDocument();
      expect(
        within(row as HTMLElement).getByRole("link", {
          name: "Ver o dashboard",
        }),
      ).toHaveAttribute("href", "/dashboard");
    });

    it("admin: o seletor de setor fica na linha, sem a pílula, e o botão do dashboard também", async () => {
      await insertSector(db, "Carga");
      await insertSector(db, "ULD");
      mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

      await renderHome();

      const row = document.querySelector(
        '[data-slot="home-hero-row"]',
      ) as HTMLElement;
      expect(
        within(row).getByRole("radiogroup", { name: "Setor" }),
      ).toBeInTheDocument();
      expect(row.querySelector('[data-slot="sector-pill"]')).toBeNull();
      expect(
        within(row).getByRole("link", { name: "Ver o dashboard" }),
      ).toHaveAttribute("href", "/dashboard");
    });

    it("a linha tem o espaçamento do protótipo: 32px em cima e 40px embaixo (24 e 28 no celular), quebrando linha no celular", async () => {
      const { uld, ana } = await setup();
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
      );

      await renderHome();

      expect(document.querySelector('[data-slot="home-hero-row"]')).toHaveClass(
        "flex",
        "flex-wrap",
        "items-center",
        "justify-between",
        "gap-4",
        "pt-8",
        "pb-10",
        "max-md:pt-6",
        "max-md:pb-7",
      );
    });

    it("a linha vem antes dos cartões, que ficam no ponto de extensão 'home-cards' com 16px de gap", async () => {
      const { uld, ana } = await setup();
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
      );

      await renderHome();

      const row = document.querySelector('[data-slot="home-hero-row"]');
      const cards = document.querySelector('[data-slot="home-cards"]');
      expect(cards).toHaveClass("flex", "flex-col", "gap-4");
      expect(
        (row as Node).compareDocumentPosition(cards as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        within(cards as HTMLElement).getByRole("heading", {
          name: "Passagem do meu turno",
        }),
      ).toBeInTheDocument();
    });

    it("o botão do dashboard é pílula 'surface' de 48px com o ícone decorativo", async () => {
      const { uld, ana } = await setup();
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
      );

      await renderHome();

      const link = screen.getByRole("link", { name: "Ver o dashboard" });
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(link).toHaveClass("bg-card", "rounded-full", "h-12", "px-5");
      // 20px de padding (protótipo), não os 22px do `pill`: o `cn` tira o outro.
      expect(link).not.toHaveClass("px-[22px]");
    });

    it("sem setor ativo (admin) e setor inativo (operador): sem seletor nem pílula, mas o dashboard continua à mão", async () => {
      await insertSector(db, "Parado", { active: false });
      mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
      await renderHome();
      expect(
        screen.getByRole("link", { name: "Ver o dashboard" }),
      ).toHaveAttribute("href", "/dashboard");
      expect(document.querySelector('[data-slot="sector-pill"]')).toBeNull();
      cleanup();

      const parado = await insertSector(db, "Inativo operador", {
        active: false,
      });
      const ana = await insertUser(db, {
        role: "operator",
        sectorId: parado.id,
      });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: parado.id }),
      );
      await renderHome();
      expect(
        screen.getByRole("link", { name: "Ver o dashboard" }),
      ).toHaveAttribute("href", "/dashboard");
      expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    });

    it("sem seletor nem pílula (ramos de erro), o botão do dashboard fica à direita", async () => {
      await insertSector(db, "Parado", { active: false });
      mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

      await renderHome();

      expect(screen.getByRole("link", { name: "Ver o dashboard" })).toHaveClass(
        "ml-auto",
      );
    });
    it("a pílula usa a cor do setor escolhida na tela Setores", async () => {
      const verde = await insertSector(db, "Carga", { color: "green" });
      const ana = await insertUser(db, {
        role: "operator",
        sectorId: verde.id,
      });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: verde.id }),
      );

      await renderHome();

      expect(
        document.querySelector('[data-slot="sector-pill"] .bg-sector-green'),
      ).not.toBeNull();
    });
  });

  it("operador sem passagem: só o cartão do turno, 'Começar passagem', sem seletor", async () => {
    const { uld, shiftRow, ana } = await setup();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(
      screen.queryByRole("heading", { name: "Passagem para confirmar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Passagem do meu turno" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${shiftRow.id}&data=${TODAY}`,
    );
    expect(
      screen.queryByRole("radiogroup", { name: "Setor" }),
    ).not.toBeInTheDocument();
  });

  describe("cartão Solicitações", () => {
    function asAna(world: Awaited<ReturnType<typeof setup>>) {
      mocks.requireUser.mockResolvedValue(
        authzOf({
          role: "operator",
          userId: world.ana.id,
          sectorId: world.uld.id,
        }),
      );
    }

    it("sem abertas: o cartão vem depois de 'Passagem do meu turno' com o estado vazio", async () => {
      const world = await setup();
      asAna(world);

      await renderHome();

      const headings = screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent);
      expect(headings).toEqual(["Passagem do meu turno", "Solicitações"]);
      expect(
        screen.getByText("Nenhuma solicitação aberta."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Ver solicitações" }),
      ).toHaveAttribute("href", "/solicitacoes");
    });

    it("conta abertas e paradas e lista as paradas com link para o detalhe", async () => {
      const world = await setup();
      const doca = await insertDestination(db, { name: "Doca 3" });
      const parada = await insertRequest(db, {
        sectorId: world.uld.id,
        createdBy: world.ana.id,
        destinationId: doca.id,
        description: "Trocar as redes",
        createdAt: spDate("2026-11-16", "09:00"),
      });
      await insertRequest(db, {
        sectorId: world.uld.id,
        createdBy: world.ana.id,
        description: "Recente",
        createdAt: spDate("2026-11-19", "09:00"),
      });
      await insertRequest(db, {
        sectorId: world.uld.id,
        createdBy: world.ana.id,
        description: "Em trânsito",
        status: "in_transit",
        createdAt: spDate("2026-11-19", "09:00"),
        statusChangedAt: spDate("2026-11-19", "10:00"),
      });
      await insertRequest(db, {
        sectorId: world.uld.id,
        createdBy: world.ana.id,
        description: "Entregue",
        status: "delivered",
        createdAt: spDate("2026-11-10", "09:00"),
        statusChangedAt: spDate("2026-11-11", "09:00"),
      });
      asAna(world);

      await renderHome();

      expect(screen.getByText("3 abertas · 1 parada")).toBeInTheDocument();
      expect(screen.getByText("Paradas há mais tempo")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Trocar as redes" }),
      ).toHaveAttribute("href", `/solicitacoes/${parada.id}`);
      expect(screen.getByText("Para Doca 3")).toBeInTheDocument();
      expect(screen.getByText("Parada há 4 dias")).toBeInTheDocument();
      expect(screen.queryByText("Recente")).not.toBeInTheDocument();
    });

    it("72 h exatas não é parada; um minuto a mais, é", async () => {
      const world = await setup();
      await insertRequest(db, {
        sectorId: world.uld.id,
        createdBy: world.ana.id,
        description: "Exatas 72 h",
        createdAt: spDate("2026-11-17", "10:00"),
      });
      asAna(world);

      await renderHome();
      expect(screen.getByText("1 aberta · 0 paradas")).toBeInTheDocument();
      cleanup();

      await insertRequest(db, {
        sectorId: world.uld.id,
        createdBy: world.ana.id,
        description: "72 h e 1 minuto",
        createdAt: spDate("2026-11-17", "09:59"),
      });
      await renderHome();

      expect(screen.getByText("2 abertas · 1 parada")).toBeInTheDocument();
      expect(screen.getByText("Parada há 3 dias")).toBeInTheDocument();
    });

    it("lista só as 5 paradas há mais tempo, mas conta todas", async () => {
      const world = await setup();
      for (let day = 1; day <= 7; day += 1) {
        await insertRequest(db, {
          sectorId: world.uld.id,
          createdBy: world.ana.id,
          description: `Parada ${day}`,
          createdAt: spDate(`2026-11-0${day}`, "09:00"),
        });
      }
      asAna(world);

      await renderHome();

      expect(screen.getByText("7 abertas · 7 paradas")).toBeInTheDocument();
      const items = within(
        screen.getByRole("heading", { name: "Paradas há mais tempo" })
          .parentElement as HTMLElement,
      ).getAllByRole("listitem");
      expect(items).toHaveLength(5);
      expect(items[0]).toHaveTextContent("Parada 1");
      expect(items[4]).toHaveTextContent("Parada 5");
    });

    it("não conta as de outro setor", async () => {
      const world = await setup();
      const carga = await insertSector(db, "Carga");
      await insertRequest(db, {
        sectorId: carga.id,
        createdBy: world.ana.id,
        description: "De outro setor",
        createdAt: spDate("2026-11-01", "09:00"),
      });
      asAna(world);

      await renderHome();

      expect(
        screen.getByText("Nenhuma solicitação aberta."),
      ).toBeInTheDocument();
      expect(screen.queryByText("De outro setor")).not.toBeInTheDocument();
    });

    it("admin: o link leva o setor escolhido e o cartão é desse setor", async () => {
      const world = await setup();
      await insertRequest(db, {
        sectorId: world.uld.id,
        createdBy: world.ana.id,
        createdAt: spDate("2026-11-19", "09:00"),
      });
      mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

      await renderHome({ setor: world.uld.id });

      expect(screen.getByText("1 aberta · 0 paradas")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Ver solicitações" }),
      ).toHaveAttribute("href", `/solicitacoes?setor=${world.uld.id}`);
    });
  });

  it("rascunho existente vira 'Continuar passagem'", async () => {
    const { uld, shiftRow, ana } = await setup();
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      updatedBy: ana.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Rascunho salvo às .* por Ana Teste/),
    ).toBeInTheDocument();
  });

  it("passagem entregue por outra pessoa aparece no topo para confirmar", async () => {
    const { uld, shiftRow, ana, bia } = await setup();
    const delivered = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-19", "14:05"),
      nextShiftText: "Conferir a rede do box 4.",
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: bia.id, sectorId: uld.id }),
    );

    await renderHome();

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Passagem para confirmar",
      "Passagem do meu turno",
      "Solicitações",
    ]);
    expect(screen.getByText("Conferir a rede do box 4.")).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="pending-handover"] img'),
    ).toHaveAttribute("src", expect.stringContaining("data:image/svg+xml"));
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      `/passagens/${delivered.id}`,
    );
  });

  it("quem entregou não vê o cartão de confirmar, só o próprio turno aguardando", async () => {
    const { uld, shiftRow, ana } = await setup();
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate(TODAY, "09:30"),
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(
      screen.queryByRole("heading", { name: "Passagem para confirmar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Entregue às 09:30 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
  });

  it("passagem entregue de outro setor não vaza para o cartão", async () => {
    const { uld, ana } = await setup();
    const carga = await insertSector(db, "Carga");
    const cargaShift = await insertShift(db, { sectorId: carga.id });
    const cargaUser = await insertUser(db, {
      role: "operator",
      sectorId: carga.id,
    });
    await insertHandover(db, {
      sectorId: carga.id,
      shiftId: cargaShift.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: cargaUser.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(
      screen.queryByRole("heading", { name: "Passagem para confirmar" }),
    ).not.toBeInTheDocument();
  });

  it("setor sem turnos: operador vê o pedido ao administrador", async () => {
    const uld = await insertSector(db, "ULD");
    const ana = await insertUser(db, { role: "operator", sectorId: uld.id });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Peça a um administrador para cadastrar os turnos do setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ir para Turnos" }),
    ).not.toBeInTheDocument();
  });

  it("operador de setor inativo vê o aviso, sem cartões", async () => {
    const parado = await insertSector(db, "Parado", { active: false });
    const ana = await insertUser(db, { role: "operator", sectorId: parado.id });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: parado.id }),
    );

    await renderHome();

    expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    expect(
      screen.getByText("Peça a um administrador para reativá-lo."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Passagem do meu turno" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Solicitações" }),
    ).not.toBeInTheDocument();
  });

  it("admin: seletor de setor, primeiro setor por padrão e link para Turnos quando não há turno", async () => {
    const carga = await insertSector(db, "Carga");
    await insertSector(db, "ULD");
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHome();

    expect(
      screen.getByRole("radiogroup", { name: "Setor" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Carga" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("link", { name: "Ir para Turnos" }),
    ).toHaveAttribute("href", `/admin/turnos?setor=${carga.id}`);
  });

  it("admin: ?setor= vence o cookie e vai no link de começar", async () => {
    const carga = await insertSector(db, "Carga");
    const uld = await insertSector(db, "ULD");
    const shiftRow = await insertShift(db, { sectorId: uld.id });
    mocks.cookie.value = carga.id;
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHome({ setor: uld.id });

    expect(screen.getByRole("radio", { name: "ULD" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${shiftRow.id}&data=${TODAY}&setor=${uld.id}`,
    );
  });

  it("admin: sem ?setor=, o cookie escolhe o setor", async () => {
    await insertSector(db, "Carga");
    const uld = await insertSector(db, "ULD");
    mocks.cookie.value = uld.id;
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHome();

    expect(screen.getByRole("radio", { name: "ULD" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("admin sem setor ativo: estado vazio com link para Setores", async () => {
    await insertSector(db, "Parado", { active: false });
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHome();

    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cadastre ou reative um setor para usar a passagem de turno.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
  });
});
