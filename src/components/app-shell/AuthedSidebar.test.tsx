import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AuthedSidebar } from "@/components/app-shell/AuthedSidebar";
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

describe("AuthedSidebar", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
  });

  it("operador: isAdmin false, com nome e e-mail da sessão", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    const element = await AuthedSidebar();

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(AppSidebar);
    expect(element.props).toEqual({
      isAdmin: false,
      userName: "Maria Souza",
      userEmail: "maria@example.com",
    });
  });

  it("admin: isAdmin true", async () => {
    mocks.requireUser.mockResolvedValue(
      authz({ role: "admin", sectorId: null }),
    );

    const element = await AuthedSidebar();

    expect(element.props.isAdmin).toBe(true);
  });

  it("sem sessão, propaga o redirect de requireUser", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AuthedSidebar()).rejects.toThrow("NEXT_REDIRECT");
  });
});
