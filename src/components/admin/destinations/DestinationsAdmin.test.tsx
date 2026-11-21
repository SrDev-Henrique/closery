import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DestinationsAdmin } from "@/components/admin/destinations/DestinationsAdmin";
import type { DestinationRow } from "@/features/admin/destinations";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listDestinations: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/admin/destinations", () => ({
  listDestinations: mocks.listDestinations,
}));
vi.mock("@/app/(app)/admin/destinos/actions", () => ({
  createDestinationAction: vi.fn(),
  renameDestinationAction: vi.fn(),
  setDestinationActiveAction: vi.fn(),
}));

function page(
  rows: DestinationRow[],
  extra: Partial<{ page: number; pageCount: number }> = {},
) {
  return {
    rows,
    total: rows.length,
    page: extra.page ?? 1,
    pageCount: extra.pageCount ?? 1,
    pageSize: 50,
  };
}

const NO_PARAMS = Promise.resolve({});

describe("DestinationsAdmin", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
    mocks.listDestinations.mockReset();
    mocks.requireAdmin.mockResolvedValue({ role: "admin" });
  });

  it("mostra título, texto, link de volta e o cartão 'Novo destino'", async () => {
    mocks.listDestinations.mockResolvedValue(
      page([{ id: "d1", name: "Almoxarifado", active: true }]),
    );

    render(await DestinationsAdmin({ searchParams: NO_PARAMS }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Destinos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Para onde os pedidos de material vão. Valem para todos os setores.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Novo destino")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do destino")).toHaveValue("");
    expect(screen.getByText("Almoxarifado")).toBeInTheDocument();
  });

  it("destino inativo ganha o selo 'Inativo' e o botão 'Reativar'", async () => {
    mocks.listDestinations.mockResolvedValue(
      page([{ id: "d1", name: "Antigo", active: false }]),
    );

    render(await DestinationsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reativar Antigo" }),
    ).toBeInTheDocument();
  });

  it("sem destinos mostra o estado vazio", async () => {
    mocks.listDestinations.mockResolvedValue(page([]));

    render(await DestinationsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByText("Nenhum destino ainda.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Crie o primeiro destino acima, por exemplo o almoxarifado.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("lê ?pagina= e mostra a paginação", async () => {
    mocks.listDestinations.mockResolvedValue(
      page([{ id: "d1", name: "Oficina", active: true }], {
        page: 2,
        pageCount: 2,
      }),
    );

    render(
      await DestinationsAdmin({
        searchParams: Promise.resolve({ pagina: "2" }),
      }),
    );

    expect(mocks.listDestinations).toHaveBeenCalledWith({}, { page: 2 });
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/destinos",
    );
  });

  it("operador: requireAdmin lança (notFound) e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new Error("NEXT_HTTP_ERROR_FALLBACK;404"),
    );

    await expect(
      DestinationsAdmin({ searchParams: NO_PARAMS }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.listDestinations).not.toHaveBeenCalled();
  });
});
