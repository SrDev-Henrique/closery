import { beforeEach, describe, expect, it, vi } from "vitest";

import { authzOf } from "../../../../../test/authz";

// O teto real (10.000 linhas) não se alcança com dados de teste: o domínio é
// mockado para devolver "too_large"; o que se prova aqui é a resposta 413.
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  buildPassagesCsv: vi.fn(),
  resolveDashboardScope: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/dashboard/scope", () => ({
  resolveDashboardScope: mocks.resolveDashboardScope,
}));
vi.mock("@/features/dashboard/exportCsv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/dashboard/exportCsv")>()),
  buildPassagesCsv: mocks.buildPassagesCsv,
}));

import { GET } from "./route";

describe("GET /api/dashboard/export acima do teto", () => {
  beforeEach(() => {
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
    mocks.resolveDashboardScope.mockResolvedValue({
      kind: "ok",
      sectors: [],
      scope: {
        sectorId: null,
        sectorName: null,
        sectorParam: "todos",
        showSector: true,
        period: { period: "7", from: "2026-11-14", to: "2026-11-20" },
        previous: { from: "2026-11-07", to: "2026-11-13" },
        days: 7,
        today: "2026-11-20",
      },
    });
    mocks.buildPassagesCsv.mockResolvedValue({
      ok: false,
      reason: "too_large",
      rows: 10_001,
    });
  });

  it("responde 413 com o texto, em texto simples e sem cache", async () => {
    const response = await GET(
      new Request("http://closery.local/api/dashboard/export?periodo=30"),
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe(
      "Período grande demais para exportar. Escolha um intervalo menor.",
    );
  });
});
