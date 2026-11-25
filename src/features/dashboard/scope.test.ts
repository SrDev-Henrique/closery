import type { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Authz } from "@/features/authz/authz";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  deactivateSector,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { resolveDashboardScope } from "./scope";

const mocks = vi.hoisted(() => ({ readRememberedSector: vi.fn() }));
vi.mock("@/features/handovers/sectorCookie", () => ({
  readRememberedSector: mocks.readRememberedSector,
}));

// 21/11/2026 14:30 em São Paulo.
const NOW = spDate("2026-11-21", "14:30");
const ADMIN = authzOf({ role: "admin" });

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  mocks.readRememberedSector.mockReset();
  mocks.readRememberedSector.mockResolvedValue(undefined);
});

async function twoSectors() {
  const alfa = await insertSector(db, "Alfa Teste");
  const beta = await insertSector(db, "Beta Teste");
  return { alfa, beta };
}

async function scopeOf(
  actor: Authz,
  params: Record<string, string | string[] | undefined> = {},
  now: Date = NOW,
) {
  const result = await resolveDashboardScope(db, actor, params, now);
  if (result.kind !== "ok") throw new Error(`escopo: ${result.kind}`);
  return result;
}

describe("resolveDashboardScope: setor", () => {
  it("admin sem nenhum setor ativo: none", async () => {
    const dormant = await insertSector(db, "Setor Dormente");
    await deactivateSector(db, dormant.id);
    await expect(resolveDashboardScope(db, ADMIN, {}, NOW)).resolves.toEqual({
      kind: "none",
    });
  });

  it("admin sem ?setor= e sem cookie: o primeiro setor ativo, nunca 'Todos'", async () => {
    const { alfa, beta } = await twoSectors();
    const { scope, sectors } = await scopeOf(ADMIN);
    expect(scope).toMatchObject({
      sectorId: alfa.id,
      sectorName: "Alfa Teste",
      sectorParam: alfa.id,
      showSector: false,
    });
    expect(sectors.map((sector) => sector.id)).toEqual([alfa.id, beta.id]);
  });

  it("admin com ?setor=<id>: esse setor", async () => {
    const { beta } = await twoSectors();
    const { scope } = await scopeOf(ADMIN, { setor: beta.id });
    expect(scope).toMatchObject({
      sectorId: beta.id,
      sectorName: "Beta Teste",
      sectorParam: beta.id,
      showSector: false,
    });
  });

  it("admin com ?setor=todos: sem setor, sem nome, com showSector", async () => {
    await twoSectors();
    const { scope } = await scopeOf(ADMIN, { setor: "todos" });
    expect(scope).toMatchObject({
      sectorId: null,
      sectorName: null,
      sectorParam: "todos",
      showSector: true,
    });
  });

  it("admin: o cookie vale quando a URL não escolhe, e a URL vence o cookie", async () => {
    const { alfa, beta } = await twoSectors();
    mocks.readRememberedSector.mockResolvedValue(beta.id);
    expect((await scopeOf(ADMIN)).scope.sectorId).toBe(beta.id);
    expect((await scopeOf(ADMIN, { setor: alfa.id })).scope.sectorId).toBe(
      alfa.id,
    );
  });

  it("admin: ?setor= inativo, inexistente ou lixo cai no cookie e depois no primeiro", async () => {
    const { alfa, beta } = await twoSectors();
    const dormant = await insertSector(db, "Dormente");
    await deactivateSector(db, dormant.id);
    for (const setor of [dormant.id, "nao-existe", "", "TODOS"]) {
      expect((await scopeOf(ADMIN, { setor })).scope.sectorId).toBe(alfa.id);
    }
    mocks.readRememberedSector.mockResolvedValue(beta.id);
    expect((await scopeOf(ADMIN, { setor: dormant.id })).scope.sectorId).toBe(
      beta.id,
    );
  });

  it("operador: o próprio setor, sem seletor, e nunca lê o cookie", async () => {
    const { alfa } = await twoSectors();
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: alfa.id,
      name: "Ana Teste",
    });
    const actor = authzOf({
      role: "operator",
      userId: ana.id,
      sectorId: alfa.id,
    });
    const { scope, sectors } = await scopeOf(actor);
    expect(scope).toMatchObject({
      sectorId: alfa.id,
      sectorName: "Alfa Teste",
      sectorParam: null,
      showSector: false,
    });
    expect(sectors).toEqual([]);
    expect(mocks.readRememberedSector).not.toHaveBeenCalled();
  });

  it("operador com ?setor= de outro setor (ou 'todos'): continua no próprio", async () => {
    const { alfa, beta } = await twoSectors();
    const actor = authzOf({ role: "operator", sectorId: alfa.id });
    for (const setor of [beta.id, "todos"]) {
      const { scope } = await scopeOf(actor, { setor });
      expect(scope.sectorId).toBe(alfa.id);
      expect(scope.sectorParam).toBeNull();
      expect(scope.showSector).toBe(false);
    }
  });

  it("operador de setor inativo, ou de setor que não existe: inactive", async () => {
    const { alfa } = await twoSectors();
    await deactivateSector(db, alfa.id);
    await expect(
      resolveDashboardScope(
        db,
        authzOf({ role: "operator", sectorId: alfa.id }),
        {},
        NOW,
      ),
    ).resolves.toEqual({ kind: "inactive" });
    await expect(
      resolveDashboardScope(
        db,
        authzOf({
          role: "operator",
          sectorId: "00000000-0000-4000-8000-0000000000ff",
        }),
        {},
        NOW,
      ),
    ).resolves.toEqual({ kind: "inactive" });
  });
});

describe("resolveDashboardScope: período", () => {
  it("padrão: últimos 7 dias, período anterior de 7 dias, today em São Paulo", async () => {
    await twoSectors();
    const { scope } = await scopeOf(ADMIN);
    expect(scope.period).toEqual({
      period: "7",
      from: "2026-11-15",
      to: "2026-11-21",
    });
    expect(scope.previous).toEqual({ from: "2026-11-08", to: "2026-11-14" });
    expect(scope.days).toBe(7);
    expect(scope.today).toBe("2026-11-21");
  });

  it("periodo=30: 30 dias e o anterior com 30 dias", async () => {
    await twoSectors();
    const { scope } = await scopeOf(ADMIN, { periodo: "30" });
    expect(scope.period).toEqual({
      period: "30",
      from: "2026-10-23",
      to: "2026-11-21",
    });
    expect(scope.previous).toEqual({ from: "2026-09-23", to: "2026-10-22" });
    expect(scope.days).toBe(30);
  });

  it("intervalo válido, de um dia e invertido", async () => {
    await twoSectors();
    const range = await scopeOf(ADMIN, {
      periodo: "intervalo",
      de: "2026-11-10",
      ate: "2026-11-14",
    });
    expect(range.scope.period).toEqual({
      period: "range",
      from: "2026-11-10",
      to: "2026-11-14",
    });
    expect(range.scope.days).toBe(5);
    expect(range.scope.previous).toEqual({
      from: "2026-11-05",
      to: "2026-11-09",
    });

    const oneDay = await scopeOf(ADMIN, {
      periodo: "intervalo",
      de: "2026-11-10",
      ate: "2026-11-10",
    });
    expect(oneDay.scope.days).toBe(1);
    expect(oneDay.scope.previous).toEqual({
      from: "2026-11-09",
      to: "2026-11-09",
    });

    const swapped = await scopeOf(ADMIN, {
      periodo: "intervalo",
      de: "2026-11-14",
      ate: "2026-11-10",
    });
    expect(swapped.scope.period).toMatchObject({
      from: "2026-11-10",
      to: "2026-11-14",
    });
  });

  it("intervalo de 94 dias é encurtado para 93 (de = ate − 92)", async () => {
    await twoSectors();
    const { scope } = await scopeOf(ADMIN, {
      periodo: "intervalo",
      de: "2026-08-19",
      ate: "2026-11-20",
    });
    expect(scope.period).toEqual({
      period: "range",
      from: "2026-08-20",
      to: "2026-11-20",
    });
    expect(scope.days).toBe(93);
    expect(scope.previous).toEqual({ from: "2026-05-19", to: "2026-08-19" });
  });

  it("intervalo no futuro, lixo e data irreal caem nos últimos 7 dias", async () => {
    await twoSectors();
    for (const params of [
      { periodo: "intervalo", de: "2026-12-01", ate: "2026-12-10" },
      { periodo: "intervalo", de: "2026-02-30", ate: "2026-11-10" },
      { periodo: "intervalo" },
      { periodo: "xyz" },
    ]) {
      const { scope } = await scopeOf(ADMIN, params);
      expect(scope.period.period).toBe("7");
      expect(scope.days).toBe(7);
    }
  });

  it("'hoje' é o dia de São Paulo: 23:30 ainda é o dia anterior, 00:00 já é o novo", async () => {
    await twoSectors();
    const lateNight = spDate("2026-11-20", "23:30");
    const midnight = spDate("2026-11-21", "00:00");
    expect((await scopeOf(ADMIN, {}, lateNight)).scope.today).toBe(
      "2026-11-20",
    );
    expect((await scopeOf(ADMIN, {}, midnight)).scope.today).toBe("2026-11-21");
    expect((await scopeOf(ADMIN, {}, midnight)).scope.period.to).toBe(
      "2026-11-21",
    );
  });
});
