import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { sector } from "@/db/schema/sectors";
import type { Authz } from "@/features/authz/authz";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { HandoverDetail } from "./HandoverDetail";

const NOT_FOUND = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

const mocks = vi.hoisted(
  (): {
    requireUser: Mock;
    notFound: Mock;
    redirect: Mock;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    notFound: vi.fn(),
    redirect: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/passagens/actions", () => ({
  confirmHandoverAction: vi.fn(),
  saveHandoverFieldAction: vi.fn(),
  deliverHandoverAction: vi.fn(),
  correctHandoverAction: vi.fn(),
}));

type World = Awaited<ReturnType<typeof seed>>;

// Setor ULD com turno Manhã, três itens, Ana (entregou) e Bia (colega).
async function seed() {
  const sector = await insertSector(db, "ULD");
  const shift = await insertShift(db, {
    sectorId: sector.id,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const nets = await insertItem(db, {
    sectorId: sector.id,
    name: "Rede de proteção",
    unit: "unidade",
    kind: "control",
  });
  const tape = await insertItem(db, {
    sectorId: sector.id,
    name: "Fita adesiva",
    unit: "rolo",
    kind: "stock",
  });
  const cones = await insertItem(db, {
    sectorId: sector.id,
    name: "Cone",
    unit: "unidade",
    kind: "stock",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Bia Teste",
  });
  const admin = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const actor = (who: { id: string }, name: string): Authz =>
    authzOf({ role: "operator", userId: who.id, sectorId: sector.id, name });
  return {
    sector,
    shift,
    nets,
    tape,
    cones,
    ana,
    bia,
    admin,
    asAna: actor(ana, "Ana Teste"),
    asBia: actor(bia, "Bia Teste"),
    asAdmin: authzOf({ role: "admin", userId: admin.id, name: "Admin Teste" }),
  };
}

async function deliveredHandover(world: World) {
  const created = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    status: "delivered",
    deliveredBy: world.ana.id,
    deliveredAt: spDate("2026-11-20", "14:05"),
    occurrencesText: "Chuva forte no pátio.",
    nextShiftText: "Conferir as redes do galpão 2.",
    shiftNameSnapshot: "Manhã",
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: world.nets.id,
    quantity: 3,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: world.tape.id,
    quantity: 1234,
    note: "Pedir mais",
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: world.cones.id,
    quantity: 0,
    snapshot: true,
  });
  return created.id;
}

async function confirmedHandover(world: World) {
  const created = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    operationalDate: "2026-11-19",
    status: "confirmed",
    deliveredBy: world.ana.id,
    deliveredAt: spDate("2026-11-19", "14:05"),
    confirmedBy: world.bia.id,
    confirmedAt: spDate("2026-11-19", "14:20"),
    confirmationNote: "Tudo conferido",
    shiftNameSnapshot: "Manhã",
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: world.nets.id,
    quantity: 2,
    snapshot: true,
  });
  return created.id;
}

async function renderDetail(id: string, search: Record<string, string> = {}) {
  render(
    <TooltipProvider>
      {await HandoverDetail({ id, searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
}

const headingNames = () =>
  screen.getAllByRole("heading").map((heading) => heading.textContent);

describe("HandoverDetail", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    for (const mock of [mocks.requireUser, mocks.notFound, mocks.redirect]) {
      mock.mockReset();
    }
    mocks.notFound.mockImplementation(() => {
      throw NOT_FOUND;
    });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT;${url}`);
    });
  });

  describe("acesso", () => {
    it("sem sessão: requireUser redireciona e nada é lido", async () => {
      const redirectError = new Error("NEXT_REDIRECT;/entrar");
      mocks.requireUser.mockRejectedValue(redirectError);

      await expect(
        HandoverDetail({
          id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toBe(redirectError);
    });

    it("id que não é uuid → notFound, sem consultar o banco", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asBia);

      await expect(
        HandoverDetail({ id: "abc", searchParams: Promise.resolve({}) }),
      ).rejects.toBe(NOT_FOUND);
    });

    it("uuid que não existe → notFound", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asBia);

      await expect(
        HandoverDetail({
          id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toBe(NOT_FOUND);
    });

    it("operador de outro setor → notFound (não revela que existe)", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      const other = await insertSector(db, "Outro setor");
      const stranger = await insertUser(db, {
        role: "operator",
        sectorId: other.id,
      });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: stranger.id, sectorId: other.id }),
      );

      await expect(
        HandoverDetail({ id, searchParams: Promise.resolve({}) }),
      ).rejects.toBe(NOT_FOUND);
    });

    it("rascunho: redireciona para a nova passagem daquele turno e dia", async () => {
      const world = await seed();
      const draft = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        operationalDate: "2026-11-18",
      });
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await expect(
        HandoverDetail({
          id: draft.id,
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow(
        `NEXT_REDIRECT;/passagens/nova?turno=${world.shift.id}&data=2026-11-18&setor=${world.sector.id}`,
      );
    });
  });

  describe("resumo na ordem do briefing", () => {
    it("título, subtítulo e as seções na ordem", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.getByRole("heading", { level: 1, name: "Passagem de turno" }),
      ).toBeInTheDocument();
      expect(screen.getByText("ULD · Manhã · 20/11/2026")).toBeInTheDocument();
      expect(headingNames()).toEqual([
        "Passagem de turno",
        "Fica para o próximo turno",
        "Controles",
        "Estoque",
        "Ocorrências do turno",
        "Entrega",
      ]);
    });

    it("'Fica para o próximo turno' vem em destaque com o texto", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      const section = screen
        .getByRole("heading", { name: "Fica para o próximo turno" })
        .closest("section");
      expect(section).toHaveClass("border-warning");
      expect(
        within(section as HTMLElement).getByText(
          "Conferir as redes do galpão 2.",
        ),
      ).toBeInTheDocument();
    });

    it("itens com valor ou observação aparecem; os zerados ficam recolhidos", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(screen.getByText("Rede de proteção")).toBeInTheDocument();
      expect(screen.getByText("3 unidade")).toBeInTheDocument();
      expect(screen.getByText("Fita adesiva")).toBeInTheDocument();
      expect(screen.getByText("1.234 rolo")).toBeInTheDocument();
      expect(screen.getByText("Pedir mais")).toBeInTheDocument();

      const summary = screen.getByText("Demais itens: 0 (1)");
      const details = summary.closest("details");
      expect(details).not.toBeNull();
      expect(details).not.toHaveAttribute("open");
      expect(
        within(details as HTMLElement).getByText("Cone"),
      ).toBeInTheDocument();
    });

    it("item zerado com observação é destacado, não recolhido", async () => {
      const world = await seed();
      const created = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        operationalDate: "2026-11-17",
        status: "delivered",
        deliveredBy: world.ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId: world.cones.id,
        quantity: 0,
        note: "Sem cones no pátio",
        snapshot: true,
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(created.id);

      expect(screen.getByText("Cone")).toBeInTheDocument();
      expect(screen.getByText("Sem cones no pátio")).toBeInTheDocument();
      expect(screen.queryByText(/Demais itens/)).not.toBeInTheDocument();
    });

    it("sem nada destacado: avisa e mostra só os zerados recolhidos", async () => {
      const world = await seed();
      const created = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        status: "delivered",
        deliveredBy: world.ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId: world.nets.id,
        snapshot: true,
      });
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId: world.tape.id,
        snapshot: true,
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(created.id);

      expect(
        screen.getByText("Nenhum item com valor ou observação."),
      ).toBeInTheDocument();
      expect(screen.getByText("Demais itens: 0 (2)")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Controles" })).toBeNull();
    });

    it("textos vazios mostram a frase de vazio", async () => {
      const world = await seed();
      const created = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        status: "delivered",
        deliveredBy: world.ana.id,
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(created.id);

      expect(
        screen.getByText("Nada registrado para o próximo turno."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Nenhuma ocorrência registrada."),
      ).toBeInTheDocument();
    });

    it("a snapshot vence a renomeação posterior do item", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      await mocks.client?.exec(
        "update item set name = 'Rede nova', unit = 'caixa' where name = 'Rede de proteção'",
      );
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(screen.getByText("Rede de proteção")).toBeInTheDocument();
      expect(screen.getByText("3 unidade")).toBeInTheDocument();
      expect(screen.queryByText("Rede nova")).not.toBeInTheDocument();
    });
  });

  describe("entrega e recebimento", () => {
    it("entregue: 'Entregue por {nome} em {data} às {hora}.' e selo Aguardando", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.getByText("Entregue por Ana Teste em 20/11/2026 às 14:05."),
      ).toBeInTheDocument();
      expect(screen.getByText("Aguardando recebimento")).toBeInTheDocument();
      expect(screen.queryByText(/Recebido por/)).not.toBeInTheDocument();
    });

    it("outra pessoa do setor vê o formulário de confirmar recebimento", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.getByRole("button", { name: "Confirmar recebimento" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", {
          name: "Observação do recebimento (opcional)",
        }),
      ).toBeInTheDocument();
    });

    it("quem entregou não vê o botão e lê o aviso", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id);

      expect(
        screen.queryByRole("button", { name: "Confirmar recebimento" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Você entregou este turno. Outra pessoa do setor confirma o recebimento.",
        ),
      ).toBeInTheDocument();
    });

    it("admin que não entregou também confirma", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expect(
        screen.getByRole("button", { name: "Confirmar recebimento" }),
      ).toBeInTheDocument();
    });

    it("confirmada: mostra quem recebeu e a observação, sem botão de confirmar", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expect(
        screen.getByText("Entregue por Ana Teste em 19/11/2026 às 14:05."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Recebido por Bia Teste em 19/11/2026 às 14:20."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Observação do recebimento: Tudo conferido"),
      ).toBeInTheDocument();
      expect(screen.getByText("Confirmada por Bia Teste")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Confirmar recebimento" }),
      ).not.toBeInTheDocument();
    });

    it("confirmada sem observação não escreve a linha da observação", async () => {
      const world = await seed();
      const created = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        status: "confirmed",
        deliveredBy: world.ana.id,
        confirmedBy: world.bia.id,
      });
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(created.id);

      expect(
        screen.queryByText(/Observação do recebimento:/),
      ).not.toBeInTheDocument();
    });

    it("entregue que não é a mais recente do setor aparece como Não confirmada", async () => {
      const world = await seed();
      const old = await deliveredHandover(world);
      await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        operationalDate: "2026-11-21",
        status: "delivered",
        deliveredBy: world.ana.id,
        deliveredAt: spDate("2026-11-21", "14:05"),
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(old);

      expect(screen.getByText("Não confirmada")).toBeInTheDocument();
      expect(
        screen.queryByText("Aguardando recebimento"),
      ).not.toBeInTheDocument();
    });
  });

  describe("selo Corrigida, correções e links", () => {
    it("sem correção não há selo nem seção Correções", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expect(screen.queryByText("Corrigida")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Correções" }),
      ).not.toBeInTheDocument();
    });

    it("com correções: selo Corrigida e linha do tempo em ordem", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);
      await insertHandoverCorrection(db, {
        handoverId: id,
        field: "item_quantity",
        itemId: world.nets.id,
        oldValue: "1",
        newValue: "2",
        reason: "Contagem errada",
        correctedBy: world.admin.id,
        correctedAt: spDate("2026-11-20", "08:00"),
      });
      await insertHandoverCorrection(db, {
        handoverId: id,
        field: "occurrences_text",
        oldValue: "",
        newValue: "Chuva",
        reason: "Esqueceram de anotar",
        correctedBy: world.admin.id,
        correctedAt: spDate("2026-11-20", "09:00"),
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(screen.getByText("Corrigida")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Correções" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Rede de proteção: quantidade"),
      ).toBeInTheDocument();
      expect(screen.getByText("1 → 2")).toBeInTheDocument();
      expect(screen.getByText("(vazio) → Chuva")).toBeInTheDocument();
      expect(screen.getByText("Motivo: Contagem errada")).toBeInTheDocument();
      expect(
        screen.getAllByText("Admin Teste · 20/11/2026, 08:00"),
      ).toHaveLength(1);
      const reasons = screen
        .getAllByText(/^Motivo: /)
        .map((node) => node.textContent);
      expect(reasons).toEqual([
        "Motivo: Contagem errada",
        "Motivo: Esqueceram de anotar",
      ]);
    });

    it("quem entregou vê o link Corrigir na entregue", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);

      mocks.requireUser.mockResolvedValue(world.asAna);
      await renderDetail(id);
      expect(screen.getByRole("link", { name: "Corrigir" })).toHaveAttribute(
        "href",
        `/passagens/${id}?editar=1`,
      );
    });

    it("outro operador não vê Corrigir na entregue", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.queryByRole("link", { name: /^Corrigir/ }),
      ).not.toBeInTheDocument();
    });

    it("operador não vê link de correção na confirmada", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);

      mocks.requireUser.mockResolvedValue(world.asBia);
      await renderDetail(id);
      expect(
        screen.queryByRole("link", { name: /^Corrigir/ }),
      ).not.toBeInTheDocument();
    });

    it("admin: link 'Corrigir com motivo' aponta para ?editar=1", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expect(
        screen.getByRole("link", { name: "Corrigir com motivo" }),
      ).toHaveAttribute("href", `/passagens/${id}?editar=1`);
    });

    it("sempre oferece 'Ver todas as passagens'", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.getByRole("link", { name: "Ver todas as passagens" }),
      ).toHaveAttribute("href", "/passagens");
    });
  });

  describe("setor inativo: só leitura (P37)", () => {
    const NOTICE = "Setor inativo: só leitura.";

    async function deactivate(world: World) {
      await db
        .update(sector)
        .set({ active: false })
        .where(eq(sector.id, world.sector.id));
    }

    function expectReadOnly() {
      expect(screen.getByRole("alert")).toHaveTextContent(NOTICE);
      expect(
        screen.getByText("Peça a um administrador para reativá-lo."),
      ).toBeInTheDocument();
      for (const name of [
        "Confirmar recebimento",
        "Corrigir",
        "Corrigir com motivo",
      ]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
      }
      expect(
        screen.queryByRole("textbox", {
          name: "Observação do recebimento (opcional)",
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Você entregou este turno/),
      ).not.toBeInTheDocument();
    }

    it("entregue, operador que não entregou: aviso e sem Confirmar recebimento", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      await deactivate(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expectReadOnly();
    });

    it("entregue, quem entregou: aviso, sem Corrigir e sem a frase 'Você entregou este turno…'", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      await deactivate(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id);

      expectReadOnly();
    });

    it("entregue, admin: aviso, sem Confirmar recebimento e sem Corrigir", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      await deactivate(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expectReadOnly();
    });

    it("confirmada, admin: aviso e sem 'Corrigir com motivo'", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);
      await deactivate(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expectReadOnly();
    });

    it("o resumo continua legível, e o aviso vem logo depois do cabeçalho", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      await deactivate(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.getByText("Conferir as redes do galpão 2."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Entregue por Ana Teste em 20/11/2026 às 14:05."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Ver todas as passagens" }),
      ).toBeInTheDocument();
      const alert = screen.getByRole("alert");
      const nextShift = screen.getByRole("heading", {
        name: "Fica para o próximo turno",
      });
      expect(
        alert.compareDocumentPosition(nextShift) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("setor ativo: sem aviso e com as ações de sempre", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Confirmar recebimento" }),
      ).toBeInTheDocument();
    });
  });
});
