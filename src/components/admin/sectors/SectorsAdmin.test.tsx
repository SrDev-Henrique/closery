import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SectorsAdmin } from "@/components/admin/sectors/SectorsAdmin";
import type { SectorRow } from "@/features/admin/sectors";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listSectors: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/admin/sectors", () => ({
  listSectors: mocks.listSectors,
}));
// Os componentes de cliente importam as Server Actions; aqui só a tela importa.
vi.mock("@/app/(app)/admin/setores/actions", () => ({
  createSectorAction: vi.fn(),
  renameSectorAction: vi.fn(),
  setSectorActiveAction: vi.fn(),
}));

function row(overrides: Partial<SectorRow> = {}): SectorRow {
  return {
    id: "s1",
    name: "ULD",
    active: true,
    activePeople: 3,
    pendingInvites: 1,
    ...overrides,
  };
}

function page(
  rows: SectorRow[],
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

describe("SectorsAdmin", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
    mocks.listSectors.mockReset();
    mocks.requireAdmin.mockResolvedValue({ role: "admin" });
  });

  it("mostra título, texto, link de volta e o cartão 'Novo setor'", async () => {
    mocks.listSectors.mockResolvedValue(page([row()]));

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Setores" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Onde cada pessoa trabalha. Turnos e itens são cadastrados por setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Novo setor")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Criar setor" }),
    ).toBeInTheDocument();
  });

  it("cada linha mostra o nome e as contagens, com singular e plural", async () => {
    mocks.listSectors.mockResolvedValue(
      page([
        row({ id: "a", name: "ULD", activePeople: 3, pendingInvites: 1 }),
        row({ id: "b", name: "Pátio", activePeople: 1, pendingInvites: 2 }),
        row({ id: "c", name: "Cargas", activePeople: 0, pendingInvites: 0 }),
      ]),
    );

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByText("3 pessoas ativas · 1 convite pendente"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 pessoa ativa · 2 convites pendentes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("0 pessoas ativas · 0 convites pendentes"),
    ).toBeInTheDocument();
  });

  it("setor inativo ganha o selo 'Inativo' e o botão 'Reativar'", async () => {
    mocks.listSectors.mockResolvedValue(
      page([row({ name: "Antigo", active: false })]),
    );

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reativar Antigo" }),
    ).toBeInTheDocument();
  });

  it("sem setores mostra o estado vazio e o formulário de criação", async () => {
    mocks.listSectors.mockResolvedValue(page([]));

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByText("Nenhum setor ainda.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Crie o primeiro setor acima para cadastrar turnos, itens e convidar operadores.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar setor" }),
    ).toBeInTheDocument();
  });

  it("lê ?pagina= e mostra a paginação", async () => {
    mocks.listSectors.mockResolvedValue(
      page([row()], { page: 2, pageCount: 3 }),
    );

    render(
      await SectorsAdmin({ searchParams: Promise.resolve({ pagina: "2" }) }),
    );

    expect(mocks.listSectors).toHaveBeenCalledWith(
      {},
      { page: 2 },
      expect.any(Date),
    );
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/setores",
    );
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/setores?pagina=3",
    );
  });

  it("?pagina= inválida cai na página 1 e uma página só não mostra paginação", async () => {
    mocks.listSectors.mockResolvedValue(page([row()]));

    render(
      await SectorsAdmin({ searchParams: Promise.resolve({ pagina: "abc" }) }),
    );

    expect(mocks.listSectors).toHaveBeenCalledWith(
      {},
      { page: 1 },
      expect.any(Date),
    );
    expect(
      screen.queryByRole("navigation", { name: "Paginação" }),
    ).not.toBeInTheDocument();
  });

  it("operador: requireAdmin lança (notFound), nada é lido nem renderizado", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new Error("NEXT_HTTP_ERROR_FALLBACK;404"),
    );

    await expect(SectorsAdmin({ searchParams: NO_PARAMS })).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    expect(mocks.listSectors).not.toHaveBeenCalled();
  });
});
