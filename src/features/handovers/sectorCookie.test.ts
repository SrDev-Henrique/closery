import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.get, set: mocks.set }),
}));

import { readRememberedSector, rememberSector } from "./sectorCookie";

describe("sectorCookie", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.set.mockReset();
    vi.unstubAllEnvs();
  });

  it("lê o valor do cookie closery_setor", async () => {
    mocks.get.mockReturnValue({ name: "closery_setor", value: "setor-1" });

    expect(await readRememberedSector()).toBe("setor-1");
    expect(mocks.get).toHaveBeenCalledWith("closery_setor");
  });

  it("sem cookie, devolve undefined", async () => {
    mocks.get.mockReturnValue(undefined);

    expect(await readRememberedSector()).toBeUndefined();
  });

  it("grava com os atributos de F3-15 (fora de produção, sem secure)", async () => {
    vi.stubEnv("NODE_ENV", "test");

    await rememberSector("setor-1");

    expect(mocks.set).toHaveBeenCalledWith("closery_setor", "setor-1", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 31_536_000,
    });
  });

  it("em produção o cookie é secure", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await rememberSector("setor-1");

    expect(mocks.set).toHaveBeenCalledWith(
      "closery_setor",
      "setor-1",
      expect.objectContaining({ secure: true }),
    );
  });
});
