import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOverview } from "@/components/app-shell/AdminOverview";
import type { AdminOverviewCounts } from "@/features/admin/overview";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminOverviewCounts: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: { marca: "db" } }));
vi.mock("@/features/admin/overview", () => ({
  getAdminOverviewCounts: mocks.getAdminOverviewCounts,
}));

function counts(
  overrides: Partial<AdminOverviewCounts> = {},
): AdminOverviewCounts {
  return {
    sectors: 3,
    shifts: 7,
    items: 12,
    destinations: 4,
    people: 9,
    pendingInvites: 2,
    ...overrides,
  };
}

async function renderOverview(overrides: Partial<AdminOverviewCounts> = {}) {
  mocks.requireAdmin.mockResolvedValue({ role: "admin" });
  mocks.getAdminOverviewCounts.mockResolvedValue(counts(overrides));
  render(await AdminOverview());
}

describe("AdminOverview", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
    mocks.getAdminOverviewCounts.mockReset();
  });

  it("admin vê o título, o texto e um cartão link para cada cadastro", async () => {
    await renderOverview();

    expect(
      screen.getByRole("heading", { level: 1, name: "Administração" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cadastros que a passagem de turno usa."),
    ).toBeInTheDocument();

    const expected = [
      ["Setores", "/admin/setores", "Onde cada pessoa trabalha.", "3 ativos"],
      ["Turnos", "/admin/turnos", "Horários de cada setor.", "7 ativos"],
      ["Itens", "/admin/itens", "O que se conta na passagem.", "12 ativos"],
      ["Destinos", "/admin/destinos", "Para onde os pedidos vão.", "4 ativos"],
      [
        "Equipe",
        "/admin/equipe",
        "Pessoas, papéis e convites.",
        "9 pessoas ativas · 2 convites pendentes",
      ],
    ] as const;
    for (const [title, href, description, count] of expected) {
      const link = screen.getByRole("link", { name: new RegExp(`^${title}`) });
      expect(link).toHaveAttribute("href", href);
      expect(within(link).getByText(description)).toBeInTheDocument();
      expect(within(link).getByText(count)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("consulta as contagens com o banco e a hora atual", async () => {
    await renderOverview();

    expect(mocks.getAdminOverviewCounts).toHaveBeenCalledTimes(1);
    const [db, now] = mocks.getAdminOverviewCounts.mock.calls[0] ?? [];
    expect(db).toEqual({ marca: "db" });
    expect(now).toBeInstanceOf(Date);
  });

  it("zero: tudo no plural, nunca vazio", async () => {
    await renderOverview({
      sectors: 0,
      shifts: 0,
      items: 0,
      destinations: 0,
      people: 0,
      pendingInvites: 0,
    });

    expect(screen.getAllByText("0 ativos")).toHaveLength(4);
    expect(
      screen.getByText("0 pessoas ativas · 0 convites pendentes"),
    ).toBeInTheDocument();
  });

  it("um: singular em cada cartão", async () => {
    await renderOverview({
      sectors: 1,
      shifts: 1,
      items: 1,
      destinations: 1,
      people: 1,
      pendingInvites: 1,
    });

    expect(screen.getAllByText("1 ativo")).toHaveLength(4);
    expect(
      screen.getByText("1 pessoa ativa · 1 convite pendente"),
    ).toBeInTheDocument();
  });

  it("mistura singular e plural na Equipe", async () => {
    await renderOverview({ people: 1, pendingInvites: 5 });

    expect(
      screen.getByText("1 pessoa ativa · 5 convites pendentes"),
    ).toBeInTheDocument();
  });

  it("operador: requireAdmin lança (notFound), nada é renderizado e o banco não é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new Error("NEXT_HTTP_ERROR_FALLBACK;404"),
    );

    await expect(AdminOverview()).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    expect(mocks.getAdminOverviewCounts).not.toHaveBeenCalled();
  });

  it("falha ao ler as contagens propaga o erro (vai para o error boundary)", async () => {
    mocks.requireAdmin.mockResolvedValue({ role: "admin" });
    mocks.getAdminOverviewCounts.mockRejectedValue(new Error("banco fora"));

    await expect(AdminOverview()).rejects.toThrow("banco fora");
  });
});
