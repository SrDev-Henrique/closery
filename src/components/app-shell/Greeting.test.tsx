import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Greeting } from "@/components/app-shell/Greeting";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";

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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(spDate("2026-11-27", "09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra a data por extenso (eyebrow) e 'Olá, {primeiro nome}'", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "Maria Souza" }));

    render(await Greeting());

    expect(screen.getByText("SEXTA-FEIRA · 27 NOV 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Olá, Maria" }),
    ).toBeInTheDocument();
  });

  it("a data é a de São Paulo: 02:59Z ainda é dia 27; 03:00Z já é dia 28", async () => {
    mocks.requireUser.mockResolvedValue(authz());
    vi.setSystemTime(new Date("2026-11-28T02:59:00Z"));
    const first = render(await Greeting());
    expect(screen.getByText("SEXTA-FEIRA · 27 NOV 2026")).toBeInTheDocument();
    first.unmount();

    vi.setSystemTime(new Date("2026-11-28T03:00:00Z"));
    render(await Greeting());
    expect(screen.getByText("SÁBADO · 28 NOV 2026")).toBeInTheDocument();
  });

  it("o eyebrow é mono 13px em cinza e o título é Satoshi 900 (72px; 60px com área útil < 900px; 44px no celular)", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    render(await Greeting());

    expect(screen.getByText("SEXTA-FEIRA · 27 NOV 2026")).toHaveClass(
      "font-mono",
      "text-[13px]",
      "font-medium",
      "text-muted-foreground",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      "font-heading",
      "font-black",
      "text-[72px]",
      "leading-[0.95]",
      "tracking-[-0.04em]",
      "md:@max-[899px]/main:text-[60px]",
      "max-md:text-[44px]",
    );
  });

  it("o topo do hero tem 28px no desktop e 12px no celular, com 14px entre eyebrow e título", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    const { container } = render(await Greeting());

    expect(container.firstElementChild).toHaveClass(
      "flex",
      "flex-col",
      "gap-3.5",
      "pt-7",
      "max-md:pt-3",
    );
  });

  it("o link do dashboard não mora mais aqui (vai para a linha do hero)", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    render(await Greeting());

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("nome vazio não deixa vírgula solta", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "  " }));

    render(await Greeting());

    expect(
      screen.getByRole("heading", { level: 1, name: "Olá" }),
    ).toBeInTheDocument();
  });

  it("nome gigante de uma palavra só quebra em vez de estourar o cartão", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "Anastaciosilvestre" }));

    render(await Greeting());

    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      "break-words",
    );
  });

  it("sem sessão, propaga o redirect de requireUser (não renderiza)", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(Greeting()).rejects.toThrow("NEXT_REDIRECT");
  });
});
