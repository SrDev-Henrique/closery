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

  it("mostra 'Olá, {primeiro nome}' e o texto do Início", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "Maria Souza" }));

    render(await Greeting());

    expect(
      screen.getByRole("heading", { level: 1, name: "Olá, Maria" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Em breve: dashboard.")).toBeInTheDocument();
    expect(screen.queryByText(/solicitações/)).not.toBeInTheDocument();
    expect(screen.queryByText(/passagem de turno/)).not.toBeInTheDocument();
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
