import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Page } from "@/features/admin/pagination";
import type { PersonRow } from "@/features/admin/people";
import type { PendingInviteRow } from "@/features/admin/teamInvites";
import { TeamAdmin } from "./TeamAdmin";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listPeople: vi.fn(),
  listPendingInvites: vi.fn(),
  listActiveSectors: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/admin/people", () => ({ listPeople: mocks.listPeople }));
vi.mock("@/features/admin/teamInvites", () => ({
  listPendingInvites: mocks.listPendingInvites,
}));
vi.mock("@/features/admin/sectors", () => ({
  listActiveSectors: mocks.listActiveSectors,
}));
vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  updatePersonAction: vi.fn(),
  setPersonActiveAction: vi.fn(),
  createInviteAction: vi.fn(),
  cancelInviteAction: vi.fn(),
}));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
// 17:30 UTC = 14:30 em São Paulo.
const EXPIRES_AT = new Date("2026-11-28T17:30:00.000Z");

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

function pendingInvite(
  overrides: Partial<PendingInviteRow> = {},
): PendingInviteRow {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    inviteeLabel: "Maria do Turno",
    role: "operator",
    sectorName: "Almoxarifado",
    inviterName: "Carla Admin",
    expiresAt: EXPIRES_AT,
    createdAt: new Date("2026-11-21T17:30:00.000Z"),
    ...overrides,
  };
}

function page<T>(rows: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return {
    rows,
    total: rows.length,
    page: 1,
    pageCount: 1,
    pageSize: 50,
    ...overrides,
  };
}

async function renderTeam(
  searchParams: Record<string, string | string[]> = {},
) {
  render(await TeamAdmin({ searchParams: Promise.resolve(searchParams) }));
}

function peopleSection() {
  return within(screen.getByRole("region", { name: "Pessoas" }));
}

function invitesSection() {
  return within(screen.getByRole("region", { name: "Convites pendentes" }));
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
  mocks.listPendingInvites.mockResolvedValue(page([pendingInvite()]));
  mocks.listActiveSectors.mockResolvedValue([
    { id: SECTOR_ID, name: "Almoxarifado" },
  ]);
});

describe("TeamAdmin", () => {
  it("mostra título, texto, link de volta e as três seções", async () => {
    await renderTeam();

    expect(
      screen.getByRole("heading", { level: 1, name: "Equipe" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pessoas, papéis e convites.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Convidar pessoa")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gerar convite" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Convites pendentes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Pessoas" }),
    ).toBeInTheDocument();
  });

  it("o formulário de convite oferece os setores ativos", async () => {
    await renderTeam();
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_ID);
  });

  describe("convites pendentes", () => {
    it("linha de operador: nome, papel · setor, validade, quem convidou e cancelar", async () => {
      await renderTeam();

      const row = invitesSection().getByRole("listitem");
      expect(within(row).getByText("Maria do Turno")).toBeInTheDocument();
      expect(
        within(row).getByText("Operador · Almoxarifado"),
      ).toBeInTheDocument();
      expect(
        within(row).getByText("Válido até 28/11/2026, 14:30"),
      ).toBeInTheDocument();
      expect(
        within(row).getByText("Convidado por Carla Admin"),
      ).toBeInTheDocument();
      expect(
        within(row).getByRole("button", {
          name: "Cancelar convite Maria do Turno",
        }),
      ).toBeInTheDocument();
    });

    it("convite de administrador sem nome e sem convidante", async () => {
      mocks.listPendingInvites.mockResolvedValue(
        page([
          pendingInvite({
            inviteeLabel: null,
            role: "admin",
            sectorName: null,
            inviterName: null,
          }),
        ]),
      );

      await renderTeam();

      const row = invitesSection().getByRole("listitem");
      expect(
        within(row).getByText("Sem nome de referência"),
      ).toBeInTheDocument();
      expect(within(row).getByText("Administrador")).toBeInTheDocument();
      expect(
        within(row).getByText("Convidado pelo sistema"),
      ).toBeInTheDocument();
      expect(
        within(row).getByRole("button", {
          name: "Cancelar convite sem nome",
        }),
      ).toBeInTheDocument();
    });

    it("sem convites: estado vazio", async () => {
      mocks.listPendingInvites.mockResolvedValue(page([]));

      await renderTeam();

      expect(
        invitesSection().getByText("Nenhum convite pendente."),
      ).toBeInTheDocument();
      expect(invitesSection().queryByRole("list")).not.toBeInTheDocument();
    });

    it("lê a página de ?convites= (com a hora atual) e cai na 1 se for inválida", async () => {
      await renderTeam({ convites: "2" });
      expect(mocks.listPendingInvites).toHaveBeenLastCalledWith(
        {},
        { page: 2 },
        expect.any(Date),
      );

      await renderTeam({ convites: "0" });
      expect(mocks.listPendingInvites).toHaveBeenLastCalledWith(
        {},
        { page: 1 },
        expect.any(Date),
      );
    });

    it("a paginação dos convites usa ?convites= e preserva ?pagina=", async () => {
      mocks.listPendingInvites.mockResolvedValue(
        page([pendingInvite()], { page: 1, pageCount: 2, total: 60 }),
      );

      await renderTeam({ pagina: "3" });

      const nav = invitesSection().getByRole("navigation", {
        name: "Paginação dos convites pendentes",
      });
      expect(
        within(nav).getByRole("link", { name: "Próxima" }),
      ).toHaveAttribute("href", "/admin/equipe?pagina=3&convites=2");
    });
  });

  it("com as duas listas paginadas há dois navs de nomes distintos", async () => {
    mocks.listPendingInvites.mockResolvedValue(
      page([pendingInvite()], { page: 1, pageCount: 2, total: 60 }),
    );
    mocks.listPeople.mockResolvedValue(
      page([person()], { page: 2, pageCount: 3, total: 120 }),
    );

    await renderTeam();

    expect(
      screen
        .getAllByRole("navigation")
        .map((nav) => nav.getAttribute("aria-label")),
    ).toEqual(["Paginação dos convites pendentes", "Paginação das pessoas"]);
  });

  describe("pessoas", () => {
    it("linha de operador: nome, e-mail, papel, setor e os botões", async () => {
      await renderTeam();

      const row = peopleSection().getByRole("listitem");
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

      const row = peopleSection().getByRole("listitem");
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

      const row = peopleSection().getByRole("listitem");
      expect(within(row).getByText("Inativo")).toBeInTheDocument();
      expect(
        within(row).getByRole("button", { name: "Reativar Bruno Fictício" }),
      ).toBeInTheDocument();
    });

    it("setor inativo da pessoa aparece com (inativo)", async () => {
      mocks.listPeople.mockResolvedValue(
        page([person({ sectorActive: false })]),
      );

      await renderTeam();

      expect(
        peopleSection().getByText("Almoxarifado (inativo)"),
      ).toBeInTheDocument();
    });

    it("sem pessoas: estado vazio", async () => {
      mocks.listPeople.mockResolvedValue(page([]));

      await renderTeam();

      expect(
        peopleSection().getByText("Nenhuma pessoa ainda."),
      ).toBeInTheDocument();
      expect(peopleSection().queryByRole("list")).not.toBeInTheDocument();
    });

    it("lê a página de ?pagina=, cai na 1 se for inválida e usa o primeiro valor repetido", async () => {
      await renderTeam({ pagina: "3" });
      expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 3 });

      await renderTeam({ pagina: "abc" });
      expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 1 });

      await renderTeam({ pagina: ["2", "3"] });
      expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 2 });
    });

    it("a paginação das pessoas usa ?pagina= e preserva ?convites=", async () => {
      mocks.listPeople.mockResolvedValue(
        page([person()], { page: 2, pageCount: 3, total: 120 }),
      );

      await renderTeam({ pagina: "2", convites: "4" });

      const nav = peopleSection().getByRole("navigation", {
        name: "Paginação das pessoas",
      });
      expect(within(nav).getByText("Página 2 de 3")).toBeInTheDocument();
      expect(
        within(nav).getByRole("link", { name: "Anterior" }),
      ).toHaveAttribute("href", "/admin/equipe?convites=4");
      expect(
        within(nav).getByRole("link", { name: "Próxima" }),
      ).toHaveAttribute("href", "/admin/equipe?convites=4&pagina=3");
    });
  });

  it("operador: requireAdmin lança notFound e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      TeamAdmin({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(NOT_FOUND);
    expect(mocks.listPeople).not.toHaveBeenCalled();
    expect(mocks.listPendingInvites).not.toHaveBeenCalled();
    expect(mocks.listActiveSectors).not.toHaveBeenCalled();
  });
});
