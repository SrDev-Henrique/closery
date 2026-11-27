import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AuthedSidebar } from "@/components/app-shell/AuthedSidebar";
import type { Authz } from "@/features/authz/authz";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  avatarDataUri: vi.fn((seed: string) => `data:avatar/${seed}`),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/avatar", () => ({ avatarDataUri: mocks.avatarDataUri }));

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

describe("AuthedSidebar", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.avatarDataUri.mockClear();
  });

  it("operador: isAdmin false, com nome, e-mail e avatar (semente = id) da sessão", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    const element = await AuthedSidebar();

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(AppSidebar);
    expect(element.props).toEqual({
      isAdmin: false,
      userName: "Maria Souza",
      userEmail: "maria@example.com",
      avatarSrc: "data:avatar/u1",
    });
    expect(mocks.avatarDataUri).toHaveBeenCalledWith("u1");
  });

  it("o avatar nasce do id, não do nome (trocar o nome não troca o avatar)", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "Outro Nome" }));

    const element = await AuthedSidebar();

    expect(element.props.avatarSrc).toBe("data:avatar/u1");
  });

  it("admin: isAdmin true", async () => {
    mocks.requireUser.mockResolvedValue(
      authz({ role: "admin", sectorId: null }),
    );

    const element = await AuthedSidebar();

    expect(element.props.isAdmin).toBe(true);
  });

  it("sem sessão, propaga o redirect de requireUser e não gera avatar", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AuthedSidebar()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.avatarDataUri).not.toHaveBeenCalled();
  });
});
