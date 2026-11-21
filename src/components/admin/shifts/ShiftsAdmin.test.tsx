import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { authzOf } from "../../../../test/authz";
import { resetDb } from "../../../../test/db";
import { insertSector, insertShift } from "../../../../test/fixtures";
import { ShiftsAdmin } from "./ShiftsAdmin";

const NOT_FOUND = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

const mocks = vi.hoisted(
  (): {
    requireAdmin: ReturnType<typeof vi.fn>;
    client: PGlite | undefined;
  } => ({ requireAdmin: vi.fn(), client: undefined }),
);

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/admin/turnos/actions", () => ({
  createShiftAction: vi.fn(),
  updateShiftAction: vi.fn(),
  setShiftActiveAction: vi.fn(),
  moveShiftAction: vi.fn(),
}));

async function renderPage(search: Record<string, string> = {}) {
  render(
    <TooltipProvider>
      {await ShiftsAdmin({ searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
}

describe("ShiftsAdmin", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireAdmin.mockReset();
    mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
  });

  it("operador: requireAdmin lança (notFound) e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
    await expect(
      ShiftsAdmin({ searchParams: Promise.resolve({}) }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("sem setor ativo: título, estado vazio e link para Setores", async () => {
    await insertSector(db, "Parado", { active: false });
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Turnos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByText("Cadastre ou reative um setor para criar turnos."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
    expect(screen.queryByLabelText("Nome do turno")).not.toBeInTheDocument();
  });

  it("setor sem turnos: formulário com padrões e estado vazio", async () => {
    await insertSector(db, "ULD");
    await renderPage();

    expect(screen.getByText("Novo turno")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do turno")).toHaveValue("Turno 1");
    expect(screen.getByLabelText("Início")).toHaveValue("06:00");
    expect(screen.getByLabelText("Fim")).toHaveValue("14:00");
    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar turno" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("lista turnos com horário, meia-noite, aviso de sobreposição e inativo", async () => {
    const uld = await insertSector(db, "ULD");
    await insertShift(db, {
      sectorId: uld.id,
      name: "Noite",
      startsAt: "22:00",
      endsAt: "06:00",
    });
    await insertShift(db, {
      sectorId: uld.id,
      name: "Madrugada",
      startsAt: "05:00",
      endsAt: "07:00",
    });
    await insertShift(db, {
      sectorId: uld.id,
      name: "Antigo",
      startsAt: "10:00",
      endsAt: "12:00",
      active: false,
    });
    await renderPage();

    const byName = (name: string): HTMLElement => {
      const row = screen.getByText(name).closest("li");
      if (!row) throw new Error(`linha ${name} ausente`);
      return row;
    };

    expect(
      within(byName("Noite")).getByText("22:00–06:00"),
    ).toBeInTheDocument();
    expect(
      within(byName("Noite")).getByText("Atravessa a meia-noite"),
    ).toBeInTheDocument();
    expect(
      within(byName("Noite")).getByText(
        "Sobrepõe o turno Madrugada (05:00–07:00)",
      ),
    ).toBeInTheDocument();
    expect(
      within(byName("Madrugada")).getByText(
        "Sobrepõe o turno Noite (22:00–06:00)",
      ),
    ).toBeInTheDocument();
    expect(within(byName("Antigo")).getByText("Inativo")).toBeInTheDocument();
    expect(
      within(byName("Antigo")).queryByText(/Sobrepõe/),
    ).not.toBeInTheDocument();
    expect(
      within(byName("Antigo")).getByRole("button", { name: "Reativar Antigo" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do turno")).toHaveValue("Turno 4");
  });

  it("filtro ?setor= mostra só o setor pedido e marca o seletor", async () => {
    const almox = await insertSector(db, "Almoxarifado");
    const uld = await insertSector(db, "ULD");
    await insertShift(db, { sectorId: almox.id, name: "Só do almoxarifado" });
    await insertShift(db, { sectorId: uld.id, name: "Só da ULD" });

    await renderPage({ setor: uld.id });
    expect(screen.getByText("Só da ULD")).toBeInTheDocument();
    expect(screen.queryByText("Só do almoxarifado")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ULD" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("setor inválido ou inativo cai no primeiro setor ativo", async () => {
    const almox = await insertSector(db, "Almoxarifado");
    const off = await insertSector(db, "Parado", { active: false });
    await insertShift(db, { sectorId: almox.id, name: "Do almoxarifado" });
    await insertShift(db, { sectorId: off.id, name: "Do parado" });

    await renderPage({ setor: off.id });
    expect(screen.getByText("Do almoxarifado")).toBeInTheDocument();
    expect(screen.queryByText("Do parado")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Parado" }),
    ).not.toBeInTheDocument();
  });

  it("pagina: a segunda página mostra Anterior e 'Página 2 de 2' mantendo o setor", async () => {
    const uld = await insertSector(db, "ULD");
    for (let n = 1; n <= 51; n += 1) {
      await insertShift(db, {
        sectorId: uld.id,
        name: `T${String(n).padStart(2, "0")}`,
        startsAt: "06:00",
        endsAt: "07:00",
      });
    }
    await renderPage({ setor: uld.id, pagina: "2" });

    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      `/admin/turnos?setor=${uld.id}`,
    );
    expect(screen.getByText("T51")).toBeInTheDocument();
    expect(screen.queryByText("T01")).not.toBeInTheDocument();
  });
});
