import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOverview } from "@/components/app-shell/AdminOverview";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));

describe("AdminOverview", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
  });

  it("admin vê o título e o texto de Administração", async () => {
    mocks.requireAdmin.mockResolvedValue({ role: "admin" });

    render(await AdminOverview());

    expect(
      screen.getByRole("heading", { level: 1, name: "Administração" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Setores, turnos, itens, destinos e equipe chegam na próxima etapa.",
      ),
    ).toBeInTheDocument();
  });

  it("operador: requireAdmin lança (notFound) e nada é renderizado", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new Error("NEXT_HTTP_ERROR_FALLBACK;404"),
    );

    await expect(AdminOverview()).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });
});
