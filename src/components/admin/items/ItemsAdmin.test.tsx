import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { authzOf } from "../../../../test/authz";
import { resetDb } from "../../../../test/db";
import { insertItem, insertSector } from "../../../../test/fixtures";
import { ItemsAdmin } from "./ItemsAdmin";

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
vi.mock("@/app/(app)/admin/itens/actions", () => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
  setItemActiveAction: vi.fn(),
  moveItemAction: vi.fn(),
}));

async function renderPage(search: Record<string, string> = {}) {
  render(
    <TooltipProvider>
      {await ItemsAdmin({ searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest("li");
  if (!row) throw new Error(`linha ${name} ausente`);
  return row;
}

describe("ItemsAdmin", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireAdmin.mockReset();
    mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
  });

  it("operador: requireAdmin lança (notFound) e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
    await expect(
      ItemsAdmin({ searchParams: Promise.resolve({}) }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("sem setor ativo: título, estado vazio e link para Setores", async () => {
    await insertSector(db, "Parado", { active: false });
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Itens" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByText("Cadastre ou reative um setor para criar itens."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
    expect(screen.queryByLabelText("Nome do item")).not.toBeInTheDocument();
  });

  it("setor sem itens: formulário com padrões e estado vazio", async () => {
    await insertSector(db, "ULD");
    await renderPage();

    expect(screen.getByText("Novo item")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do item")).toHaveValue("");
    expect(screen.getByLabelText("Unidade")).toHaveValue("unidade");
    expect(screen.getByText("Nenhum item neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Crie o primeiro item acima. É o que o operador conta na passagem.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar item" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("lista itens com unidade, tipo e selo de inativo", async () => {
    const uld = await insertSector(db, "ULD");
    await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
      unit: "unidade",
      kind: "control",
    });
    await insertItem(db, {
      sectorId: uld.id,
      name: "Rolos de fita",
      unit: "rolo",
      kind: "stock",
    });
    await insertItem(db, {
      sectorId: uld.id,
      name: "Antigo",
      unit: "folha grande",
      active: false,
    });
    await renderPage();

    expect(
      within(rowOf("Redes danificadas")).getByText("Controle"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Redes danificadas")).getByText("Unidade"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Rolos de fita")).getByText("Estoque"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Rolos de fita")).getByText("Rolo"),
    ).toBeInTheDocument();
    expect(within(rowOf("Antigo")).getByText("Inativo")).toBeInTheDocument();
    expect(
      within(rowOf("Antigo")).getByText("folha grande"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Antigo")).getByRole("button", { name: "Reativar Antigo" }),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Redes danificadas")).getByRole("button", {
        name: "Subir Redes danificadas",
      }),
    ).toBeDisabled();
  });

  it("filtro ?setor= mostra só o setor pedido e marca o seletor", async () => {
    const almox = await insertSector(db, "Almoxarifado");
    const uld = await insertSector(db, "ULD");
    await insertItem(db, { sectorId: almox.id, name: "Só do almoxarifado" });
    await insertItem(db, { sectorId: uld.id, name: "Só da ULD" });

    await renderPage({ setor: uld.id });

    expect(screen.getByText("Só da ULD")).toBeInTheDocument();
    expect(screen.queryByText("Só do almoxarifado")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ULD" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Almoxarifado" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("setor inativo na URL cai no primeiro setor ativo", async () => {
    const almox = await insertSector(db, "Almoxarifado");
    const off = await insertSector(db, "Parado", { active: false });
    await insertItem(db, { sectorId: almox.id, name: "Do almoxarifado" });
    await insertItem(db, { sectorId: off.id, name: "Do parado" });

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
      await insertItem(db, {
        sectorId: uld.id,
        name: `I${String(n).padStart(2, "0")}`,
      });
    }

    await renderPage({ setor: uld.id, pagina: "2" });

    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      `/admin/itens?setor=${uld.id}`,
    );
    expect(screen.getByText("I51")).toBeInTheDocument();
    expect(screen.queryByText("I01")).not.toBeInTheDocument();
  });
});
