import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequireUser } from "@/components/app-shell/RequireUser";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));

describe("RequireUser", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
  });

  it("com sessão, devolve os filhos", async () => {
    mocks.requireUser.mockResolvedValue({ userId: "u1" });

    render(await RequireUser({ children: <p>Conteúdo da página</p> }));

    expect(screen.getByText("Conteúdo da página")).toBeInTheDocument();
    expect(mocks.requireUser).toHaveBeenCalledTimes(1);
  });

  it("sem sessão, propaga o redirect de requireUser e não renderiza os filhos", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      RequireUser({ children: <p>Conteúdo da página</p> }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
