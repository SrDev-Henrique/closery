import type { PGlite } from "@electric-sql/pglite";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
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
      screen.queryByRole("group", { name: "Setor" }),
    ).not.toBeInTheDocument();
  });

  it("não mostra cartão de solicitações nesta fase", async () => {
    const { uld, ana } = await setup();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(screen.queryByText(/solicita/i)).not.toBeInTheDocument();
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
    ]);
    expect(screen.getByText("Conferir a rede do box 4.")).toBeInTheDocument();
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
  });

  it("admin: seletor de setor, primeiro setor por padrão e link para Turnos quando não há turno", async () => {
    const carga = await insertSector(db, "Carga");
    await insertSector(db, "ULD");
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHome();

    expect(screen.getByRole("group", { name: "Setor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carga" })).toHaveAttribute(
      "aria-pressed",
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

    expect(screen.getByRole("button", { name: "ULD" })).toHaveAttribute(
      "aria-pressed",
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

    expect(screen.getByRole("button", { name: "ULD" })).toHaveAttribute(
      "aria-pressed",
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
