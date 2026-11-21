import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Page } from "@/features/admin/pagination";
import type { PersonRow } from "@/features/admin/people";
import { TeamAdmin } from "./TeamAdmin";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listPeople: vi.fn(),
  listActiveSectors: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/admin/people", () => ({ listPeople: mocks.listPeople }));
vi.mock("@/features/admin/sectors", () => ({
  listActiveSectors: mocks.listActiveSectors,
}));
vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  updatePersonAction: vi.fn(),
  setPersonActiveAction: vi.fn(),
}));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

function person(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: "pessoa-1",
    name: "Bruno Fictício",
    email: "bruno@example.test",
    role: "operator",
    sectorId: SECTOR_ID,
    sectorName: "Almoxarifado",
    sectorActive: true,
    active: true,
    ...overrides,
  };
}

function page(rows: PersonRow[], overrides: Partial<Page<PersonRow>> = {}) {
  return {
    rows,
    total: rows.length,
    page: 1,
    pageCount: 1,
    pageSize: 50,
    ...overrides,
  } satisfies Page<PersonRow>;
}

async function renderTeam(
  searchParams: Record<string, string | string[]> = {},
) {
  render(await TeamAdmin({ searchParams: Promise.resolve(searchParams) }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    userId: "admin-1",
    role: "admin",
    name: "Admin",
    email: "admin@example.test",
    sectorId: null,
  });
  mocks.listPeople.mockResolvedValue(page([person()]));
  mocks.listActiveSectors.mockResolvedValue([
    { id: SECTOR_ID, name: "Almoxarifado" },
  ]);
});

describe("TeamAdmin", () => {
  it("mostra título, texto, seção Pessoas e o link de volta", async () => {
    await renderTeam();

    expect(
      screen.getByRole("heading", { level: 1, name: "Equipe" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pessoas, papéis e convites.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Pessoas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("linha de operador: nome, e-mail, papel, setor e os botões", async () => {
    await renderTeam();

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Bruno Fictício")).toBeInTheDocument();
    expect(within(row).getByText("bruno@example.test")).toBeInTheDocument();
    expect(within(row).getByText("Operador")).toBeInTheDocument();
    expect(within(row).getByText("Almoxarifado")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Editar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Desativar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(within(row).queryByText("Inativo")).not.toBeInTheDocument();
  });

  it("a própria conta mostra Você e o texto de ajuda, sem nenhum botão", async () => {
    mocks.listPeople.mockResolvedValue(
      page([
        person({
          id: "admin-1",
          name: "Carla Admin",
          role: "admin",
          sectorId: null,
          sectorName: null,
          sectorActive: null,
        }),
      ]),
    );

    await renderTeam();

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Você")).toBeInTheDocument();
    expect(within(row).getByText("Administrador")).toBeInTheDocument();
    expect(
      within(row).getByText(
        "Peça a outro administrador para mudar a sua conta.",
      ),
    ).toBeInTheDocument();
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("pessoa inativa mostra o selo e Reativar", async () => {
    mocks.listPeople.mockResolvedValue(page([person({ active: false })]));

    await renderTeam();

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Inativo")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Reativar Bruno Fictício" }),
    ).toBeInTheDocument();
  });

  it("setor inativo da pessoa aparece com (inativo)", async () => {
    mocks.listPeople.mockResolvedValue(page([person({ sectorActive: false })]));

    await renderTeam();

    expect(screen.getByText("Almoxarifado (inativo)")).toBeInTheDocument();
  });

  it("sem pessoas: estado vazio", async () => {
    mocks.listPeople.mockResolvedValue(page([]));

    await renderTeam();

    expect(screen.getByText("Nenhuma pessoa ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("lê a página de ?pagina=, cai na 1 se for inválida e usa o primeiro valor repetido", async () => {
    await renderTeam({ pagina: "3" });
    expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 3 });

    await renderTeam({ pagina: "abc" });
    expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 1 });

    await renderTeam({ pagina: ["2", "3"] });
    expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 2 });
  });

  it("com mais de uma página mostra a paginação com links", async () => {
    mocks.listPeople.mockResolvedValue(
      page([person()], { page: 2, pageCount: 3, total: 120 }),
    );

    await renderTeam({ pagina: "2" });

    const nav = screen.getByRole("navigation", { name: "Paginação" });
    expect(within(nav).getByText("Página 2 de 3")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/equipe",
    );
    expect(within(nav).getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/equipe?pagina=3",
    );
  });

  it("operador: requireAdmin lança notFound e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      TeamAdmin({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(NOT_FOUND);
    expect(mocks.listPeople).not.toHaveBeenCalled();
  });
});
