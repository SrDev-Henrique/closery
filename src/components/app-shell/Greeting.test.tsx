import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Greeting } from "@/components/app-shell/Greeting";
import type { Authz } from "@/features/authz/authz";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));

function authz(overrides: Partial<Authz> = {}): Authz {
  return {
    userId: "u1",
    name: "Maria Souza",
    email: "maria@example.com",
    role: "operator",
    sectorId: "s1",
    ...overrides,
  };
}

describe("Greeting", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
  });

  it("mostra 'Olá, {primeiro nome}' e o link para o dashboard", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "Maria Souza" }));

    render(await Greeting());

    expect(
      screen.getByRole("heading", { level: 1, name: "Olá, Maria" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver o dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByText(/Em breve/)).not.toBeInTheDocument();
    expect(screen.queryByText(/solicitações/)).not.toBeInTheDocument();
    expect(screen.queryByText(/passagem de turno/)).not.toBeInTheDocument();
  });

  it("o link do dashboard tem alvo de toque de 44px no celular e a classe do desktop continua (P12)", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    render(await Greeting());

    const link = screen.getByRole("link", { name: "Ver o dashboard" });
    expect(link).toHaveClass(
      "max-md:inline-flex",
      "max-md:min-h-11",
      "max-md:items-center",
    );
    expect(link).toHaveClass(
      "underline",
      "underline-offset-4",
      "hover:text-foreground",
    );
  });

  it("nome vazio não deixa vírgula solta", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "  " }));

    render(await Greeting());

    expect(
      screen.getByRole("heading", { level: 1, name: "Olá" }),
    ).toBeInTheDocument();
  });

  it("sem sessão, propaga o redirect de requireUser (não renderiza)", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(Greeting()).rejects.toThrow("NEXT_REDIRECT");
  });
});
