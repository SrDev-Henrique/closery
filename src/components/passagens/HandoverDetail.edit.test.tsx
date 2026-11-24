import type { PGlite } from "@electric-sql/pglite";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { sector } from "@/db/schema/sectors";
import { ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertRequest,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { HandoverDetail } from "./HandoverDetail";

const mocks = vi.hoisted(
  (): {
    requireUser: Mock;
    saveHandoverFieldAction: Mock;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    saveHandoverFieldAction: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT;${url}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/passagens/actions", () => ({
  saveHandoverFieldAction: mocks.saveHandoverFieldAction,
  deliverHandoverAction: vi.fn(),
  confirmHandoverAction: vi.fn(),
  correctHandoverAction: vi.fn(),
}));

// Setor ULD, turno Manhã, Rede (controle) e Fita (estoque), Ana e Bia.
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
    kind: "control",
  });
  const tape = await insertItem(db, {
    sectorId: sector.id,
    name: "Fita adesiva",
    unit: "rolo",
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
    ana,
    bia,
    admin,
    asAna: actor(ana, "Ana Teste"),
    asBia: actor(bia, "Bia Teste"),
    asAdmin: authzOf({ role: "admin", userId: admin.id, name: "Admin Teste" }),
  };
}

type World = Awaited<ReturnType<typeof seed>>;

async function addLines(world: World, handoverId: string) {
  await insertHandoverItem(db, {
    handoverId,
    itemId: world.nets.id,
    quantity: 3,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId,
    itemId: world.tape.id,
    quantity: 0,
    snapshot: true,
  });
}

async function delivered(world: World) {
  const created = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    status: "delivered",
    deliveredBy: world.ana.id,
    deliveredAt: spDate("2026-11-20", "14:05"),
    occurrencesText: "Chuva forte",
    nextShiftText: "Conferir as redes",
    shiftNameSnapshot: "Manhã",
  });
  await addLines(world, created.id);
  return created.id;
}

async function confirmed(world: World) {
  const created = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    operationalDate: "2026-11-19",
    status: "confirmed",
    deliveredBy: world.ana.id,
    confirmedBy: world.bia.id,
    occurrencesText: "Chuva forte",
    shiftNameSnapshot: "Manhã",
  });
  await addLines(world, created.id);
  return created.id;
}

async function renderDetail(id: string, search: Record<string, string>) {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      {await HandoverDetail({ id, searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
  return { user };
}

const EDIT = { editar: "1" };
const isSummary = () =>
  screen.getByRole("heading", { level: 1, name: "Passagem de turno" });
const isEditPage = () =>
  screen.getByRole("heading", { level: 1, name: "Corrigir passagem" });

describe("HandoverDetail com ?editar=1", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.saveHandoverFieldAction.mockReset();
  });

  describe("passagem entregue (edição direta com salvamento automático)", () => {
    it("quem entregou vê o formulário com o que já foi salvo", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, EDIT);

      isEditPage();
      expect(
        screen.getByText(
          "As alterações valem na hora. Quem recebe vê a versão atual.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("ULD · Manhã · 20/11/2026")).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "Ocorrências do turno" }),
      ).toHaveValue("Chuva forte");
      expect(
        screen.getByRole("textbox", { name: "Fica para o próximo turno" }),
      ).toHaveValue("Conferir as redes");
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
      ).toHaveValue("3");
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Fita adesiva" }),
      ).toHaveValue("0");
      expect(
        screen.getByRole("button", { name: "Ver resumo" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Entregar turno" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("textbox", { name: "Motivo da correção" }),
      ).not.toBeInTheDocument();
    });

    it("mexer num campo salva na hora, pela mesma action do rascunho", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAna);
      mocks.saveHandoverFieldAction.mockResolvedValue(
        ok({ handoverId: id, savedAt: new Date(), savedByName: "Ana Teste" }),
      );
      const { user } = await renderDetail(id, EDIT);

      await user.click(
        screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
      );

      await waitFor(() =>
        expect(mocks.saveHandoverFieldAction).toHaveBeenCalledWith({
          sectorId: world.sector.id,
          shiftId: world.shift.id,
          operationalDate: "2026-11-20",
          field: "quantity",
          itemId: world.nets.id,
          value: 4,
        }),
      );
    });

    it("o admin também edita a entregue", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id, EDIT);

      isEditPage();
      expect(
        screen.getByRole("textbox", { name: "Ocorrências do turno" }),
      ).toBeInTheDocument();
    });

    it("o formulário de edição não mostra a seção de solicitações", async () => {
      const world = await seed();
      const id = await delivered(world);
      await insertRequest(db, {
        sectorId: world.sector.id,
        createdBy: world.ana.id,
        description: "Pedido aberto",
        createdAt: spDate("2026-11-20", "09:00"),
      });
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, EDIT);

      isEditPage();
      expect(
        screen.queryByRole("heading", { name: "Solicitações abertas" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Pedido aberto")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Nova solicitação" }),
      ).not.toBeInTheDocument();
    });

    it("outro operador do setor cai no resumo, sem formulário", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id, EDIT);

      isSummary();
      expect(
        screen.queryByRole("textbox", { name: "Ocorrências do turno" }),
      ).not.toBeInTheDocument();
    });

    it("sem o parâmetro (ou com outro valor) mostra o resumo", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, {});
      isSummary();
    });

    it("editar=0 também mostra o resumo", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, { editar: "0" });
      isSummary();
    });
  });

  describe("passagem confirmada (correção com motivo, só admin)", () => {
    it("admin vê o formulário de correção com os valores vigentes", async () => {
      const world = await seed();
      const id = await confirmed(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id, EDIT);

      isEditPage();
      expect(
        screen.getByText(
          "Esta passagem já foi confirmada. A correção fica registrada com o motivo.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "Motivo da correção" }),
      ).toHaveValue("");
      expect(
        screen.getByRole("button", { name: "Registrar correção" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
        "href",
        `/passagens/${id}`,
      );
      expect(
        screen.getByRole("textbox", { name: "Ocorrências do turno" }),
      ).toHaveValue("Chuva forte");
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
      ).toHaveValue("3");
    });

    it("a correção com motivo não mostra a seção de solicitações", async () => {
      const world = await seed();
      const id = await confirmed(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id, EDIT);

      isEditPage();
      expect(
        screen.queryByRole("heading", { name: "Solicitações abertas" }),
      ).not.toBeInTheDocument();
    });

    it("quem recebeu (operador) cai no resumo", async () => {
      const world = await seed();
      const id = await confirmed(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id, EDIT);

      isSummary();
      expect(
        screen.queryByRole("textbox", { name: "Motivo da correção" }),
      ).not.toBeInTheDocument();
    });

    it("quem entregou (operador) cai no resumo: depois da confirmação só o admin corrige", async () => {
      const world = await seed();
      const id = await confirmed(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, EDIT);

      isSummary();
      expect(
        screen.queryByRole("textbox", { name: "Ocorrências do turno" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Registrar correção" }),
      ).not.toBeInTheDocument();
    });

    it("operador de outro setor: notFound mesmo com ?editar=1", async () => {
      const world = await seed();
      const id = await confirmed(world);
      const other = await insertSector(db, "Outro");
      const stranger = await insertUser(db, {
        role: "operator",
        sectorId: other.id,
      });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: stranger.id, sectorId: other.id }),
      );

      await expect(
        HandoverDetail({ id, searchParams: Promise.resolve(EDIT) }),
      ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    });
  });

  it("rascunho com ?editar=1 continua redirecionando para a nova passagem", async () => {
    const world = await seed();
    const draft = await insertHandover(db, {
      sectorId: world.sector.id,
      shiftId: world.shift.id,
      operationalDate: "2026-11-18",
    });
    mocks.requireUser.mockResolvedValue(world.asAdmin);

    await expect(
      HandoverDetail({ id: draft.id, searchParams: Promise.resolve(EDIT) }),
    ).rejects.toThrow("NEXT_REDIRECT;/passagens/nova?turno=");
  });

  describe("setor inativo (P37)", () => {
    async function deactivate(world: World) {
      await db
        .update(sector)
        .set({ active: false })
        .where(eq(sector.id, world.sector.id));
    }

    it("entregue: quem entregou com ?editar=1 cai no resumo com o aviso, sem formulário", async () => {
      const world = await seed();
      const id = await delivered(world);
      await deactivate(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, EDIT);

      isSummary();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Setor inativo: só leitura.",
      );
      expect(
        screen.queryByRole("textbox", { name: "Ocorrências do turno" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Corrigir" }),
      ).not.toBeInTheDocument();
    });

    it("confirmada: o admin com ?editar=1 cai no resumo com o aviso, sem formulário de correção", async () => {
      const world = await seed();
      const id = await confirmed(world);
      await deactivate(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id, EDIT);

      isSummary();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Setor inativo: só leitura.",
      );
      expect(
        screen.queryByRole("textbox", { name: "Motivo da correção" }),
      ).not.toBeInTheDocument();
    });
  });
});
